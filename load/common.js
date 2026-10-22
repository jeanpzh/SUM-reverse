import http from 'k6/http'
import { check } from 'k6'
import { randomBytes } from 'k6/crypto'
import { Counter, Gauge } from 'k6/metrics'
import { SharedArray } from 'k6/data'
import { validateManifest } from './profile-config.mjs'

const population = new Gauge('scenario_actor_count')
const accessRefreshes = new Counter('session_access_refreshes')
const academicRenewals = new Counter('session_academic_renewals')
const AUTH_TTL_MS = 15 * 60 * 1000
const RENEW_BEFORE_MS = 90 * 1000

export function safeJson(response) {
  try {
    return response && typeof response.json === 'function' ? response.json() : null
  } catch {
    return null
  }
}

export function runtimeConfig() {
  const base = (__ENV.SIMULATOR_BASE_URL || 'http://web').replace(/\/$/, '')
  if (!/^http:\/\/(?:web|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?|\[::1\](?::\d+)?)$/.test(base)) throw new Error('SIMULATOR_BASE_URL must target the owned web service or loopback')
  const port = Number(__ENV.SIMULATOR_HTTP_PORT || '5189')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SIMULATOR_HTTP_PORT must be a valid local port')
  const expectedOrigin = `http://127.0.0.1:${port}`
  const origin = __ENV.SIMULATOR_ORIGIN || expectedOrigin
  if (origin !== expectedOrigin) throw new Error('SIMULATOR_ORIGIN must be the configured simulator UI origin')
  const file = __ENV.SIMULATOR_MANIFEST || '/runtime/manifest.json'
  // Parsed once and shared read-only across VUs: a per-VU copy of a 1422-actor manifest exhausts ENV-H memory.
  let parsed
  const load = () => (parsed ??= validateManifest(JSON.parse(open(file))))
  const header = new SharedArray(`manifest-header:${file}`, () => {
    const { actors, ...rest } = load()
    return [rest]
  })[0]
  const actors = new SharedArray(`manifest-actors:${file}`, () => load().actors)
  return { base, origin, manifest: { ...header, actors } }
}

function headers(config) {
  return { 'Content-Type': 'application/json', Origin: config.origin }
}

export function requestTags(config, scenario, operation, name, extra = {}) {
  return { operation, name, profile: config.manifest.scenarioProfile, actor_count: String(config.manifest.actorCount), load_scenario: __ENV.SCENARIO_NAME || scenario, ...extra }
}

function expiresAt(value) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function loginAndSession(config, actor, scenario = 'shared') {
  population.add(config.manifest.actorCount)
  const login = http.post(`${config.base}/api/simulator/auth/v1/login`, JSON.stringify({ credential: actor.credential }), { headers: headers(config), tags: requestTags(config, scenario, 'auth', 'auth-login') })
  const loginBody = safeJson(login)
  const loginOk = check(login, { 'synthetic login succeeds': () => login.status === 200 && loginBody?.data?.actorId === actor.actorId && loginBody.data.campaignId === config.manifest.campaignId && loginBody.data.runId === config.manifest.runId && expiresAt(loginBody.data.expiresAt) > Date.now() && expiresAt(loginBody.data.expiresAt) <= Date.now() + AUTH_TTL_MS + 30000 })
  if (!loginOk) return null

  const session = http.post(`${config.base}/api/local/matricula-regular/v1/sesiones`, JSON.stringify({ runId: config.manifest.runId, actorId: actor.actorId }), { headers: headers(config), tags: requestTags(config, scenario, 'session', 'academic-session') })
  const sessionBody = safeJson(session)
  const sessionOk = check(session, { 'academic session succeeds': () => session.status === 200 && sessionBody?.data?.actorId === actor.actorId && sessionBody.data.runId === config.manifest.runId && typeof sessionBody.data.sessionId === 'string' && expiresAt(sessionBody.data.expiresAt) > Date.now() })
  if (!sessionOk) return null
  return { sessionId: sessionBody.data.sessionId, sessionExpiresAt: expiresAt(sessionBody.data.expiresAt), accessExpiresAt: expiresAt(loginBody.data.expiresAt) }
}

export function maintainSession(config, actor, identity, scenario = 'shared') {
  if (!identity) return false
  if (identity.accessExpiresAt - Date.now() <= RENEW_BEFORE_MS) {
    const login = http.post(`${config.base}/api/simulator/auth/v1/login`, JSON.stringify({ credential: actor.credential }), { headers: headers(config), tags: requestTags(config, scenario, 'auth', 'auth-refresh') })
    const body = safeJson(login)
    const ok = check(login, { 'access session refresh succeeds before expiry': () => login.status === 200 && body?.data?.actorId === actor.actorId && body.data.campaignId === config.manifest.campaignId && body.data.runId === config.manifest.runId && expiresAt(body.data.expiresAt) > Date.now() && expiresAt(body.data.expiresAt) <= Date.now() + AUTH_TTL_MS + 30000 })
    if (!ok) return false
    identity.accessExpiresAt = expiresAt(body.data.expiresAt)
    accessRefreshes.add(1)
  }

  if (identity.sessionExpiresAt - Date.now() <= RENEW_BEFORE_MS) {
    const renewal = http.post(`${config.base}/api/local/matricula-regular/v1/sesiones/${encodeURIComponent(identity.sessionId)}/renovar`, JSON.stringify({ runId: config.manifest.runId, actorId: actor.actorId }), { headers: headers(config), tags: requestTags(config, scenario, 'session', 'academic-session-renew') })
    const body = safeJson(renewal)
    const ok = check(renewal, { 'academic session renews before expiry': () => renewal.status === 200 && body?.data?.sessionId === identity.sessionId && body.data.actorId === actor.actorId && body.data.runId === config.manifest.runId && expiresAt(body.data.expiresAt) > Date.now() })
    if (!ok) return false
    identity.sessionExpiresAt = expiresAt(body.data.expiresAt)
    academicRenewals.add(1)
  }

  return true
}

export function errorFor(response) {
  if (!response || response.status >= 500 || response.status === 0) return 'transport_or_server'
  if (response.status >= 400) return `http_${response.status}`
  return null
}

export function uuidV4() {
  const bytes = new Uint8Array(randomBytes(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

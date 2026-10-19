import http from 'k6/http'
import { check } from 'k6'
import { randomBytes } from 'k6/crypto'

export function runtimeConfig() {
  const base = (__ENV.SIMULATOR_BASE_URL || 'http://web').replace(/\/$/, '')
  if (!/^http:\/\/(?:web|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?|\[::1\](?::\d+)?)$/.test(base)) throw new Error('SIMULATOR_BASE_URL must target the owned web service or loopback')
  const origin = __ENV.SIMULATOR_ORIGIN || 'http://127.0.0.1:5189'
  if (origin !== 'http://127.0.0.1:5189') throw new Error('SIMULATOR_ORIGIN must be the configured simulator UI origin')
  const file = __ENV.SIMULATOR_MANIFEST || '/runtime/manifest.json'
  const manifest = JSON.parse(open(file))
  if (!manifest || !Array.isArray(manifest.actors) || manifest.actors.length !== 100 || typeof manifest.runId !== 'string' || typeof manifest.campaignId !== 'string') throw new Error('Synthetic seed manifest has an invalid shape')
  const contention = manifest.contention || 'shared'
  if (contention !== 'shared' && contention !== 'distributed') throw new Error('Synthetic seed contention mode is invalid')
  const validSelection = (items) => Array.isArray(items) && items.length > 0 && items.every((item) => item && typeof item.courseId === 'string' && typeof item.sectionId === 'string')
  if (contention === 'shared' && !validSelection(manifest.selection)) throw new Error('Shared synthetic seed selection is invalid')
  if (contention === 'distributed' && manifest.selection !== undefined) throw new Error('Distributed synthetic seed must use per-actor selections')
  for (const actor of manifest.actors) {
    if (!/^SYN-[A-Z0-9-]+$/.test(actor.actorId) || !/^[A-Za-z0-9_-]{43}$/.test(actor.credential)) throw new Error('Synthetic manifest actor credential is invalid')
    if (contention === 'distributed' && !validSelection(actor.selection)) throw new Error('Distributed synthetic actor selection is invalid')
    if (contention === 'shared' && actor.selection !== undefined && !validSelection(actor.selection)) throw new Error('Synthetic actor selection is invalid')
  }
  const expectedAccepted = manifest.expectedAccepted ?? (contention === 'distributed' ? manifest.actors.length : 10)
  if (!Number.isSafeInteger(expectedAccepted) || expectedAccepted < 0 || expectedAccepted > manifest.actors.length) throw new Error('Synthetic seed expectedAccepted is outside actor bounds')
  if (expectedAccepted !== (contention === 'distributed' ? manifest.actors.length : 10)) throw new Error('Synthetic seed accepted count does not match contention mode')
  return { base, origin, manifest: { ...manifest, contention, expectedAccepted } }
}

export function loginAndSession(config, actor) {
  const headers = { 'Content-Type': 'application/json', Origin: config.origin }
  const login = http.post(`${config.base}/api/simulator/auth/v1/login`, JSON.stringify({ credential: actor.credential }), { headers, tags: { operation: 'auth', name: 'auth-login' } })
  if (!check(login, { 'synthetic login succeeds': (r) => r.status === 200 && !!r.json('data.actorId') })) return null
  const session = http.post(`${config.base}/api/local/matricula-regular/v1/sesiones`, JSON.stringify({ runId: config.manifest.runId, actorId: actor.actorId }), { headers, tags: { operation: 'session', name: 'academic-session' } })
  if (!check(session, { 'academic session succeeds': (r) => r.status === 200 && !!r.json('data.sessionId') })) return null
  return { sessionId: session.json('data.sessionId') }
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

import http from 'k6/http'
import { check, fail, sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { runtimeConfig, loginAndSession, maintainSession, requestTags, safeJson } from './common.js'

const config = runtimeConfig()
const actors = config.manifest.actors
const duration = __ENV.DURATION || '80s'
const pollSeconds = Number(__ENV.RESILIENCE_POLL_SECONDS || 1)
const apiDownStart = Number(__ENV.RESILIENCE_API_DOWN_START_SECONDS || 15)
const apiDownDuration = Number(__ENV.RESILIENCE_API_DOWN_DURATION_SECONDS || 5)
const dbDownStart = Number(__ENV.RESILIENCE_DB_DOWN_START_SECONDS || 25)
const dbDownDuration = Number(__ENV.RESILIENCE_DB_DOWN_DURATION_SECONDS || 5)
const ready = new Counter('resilience_sessions_ready')
const recovered = new Counter('resilience_recovered')
const apiTransient = new Counter('resilience_api_transient_failures')
const dbTransient = new Counter('resilience_db_transient_failures')
const unexpected = new Counter('resilience_unexpected')
const iterations = new Counter('resilience_iterations_completed')
const recoveryMs = new Trend('resilience_recovery_ms')
const recoveryTransient = new Counter('resilience_recovery_transient_failures')
const recoveryLimitMs = Number(__ENV.RESILIENCE_RECOVERY_LIMIT_MS || 60000)

if (![pollSeconds, apiDownStart, apiDownDuration, dbDownStart, dbDownDuration].every(Number.isFinite) || pollSeconds <= 0 || apiDownStart < 0 || apiDownDuration <= 0 || dbDownStart < 0 || dbDownDuration <= 0) throw new Error('Resilience timing values must be positive finite durations')
const outageEndSeconds = Math.max(apiDownStart + apiDownDuration, dbDownStart + dbDownDuration)

export const options = {
  noCookiesReset: true,
  systemTags: ['status', 'method', 'scenario', 'name', 'group', 'check', 'expected_response'],
  scenarios: { controlled_outages: { executor: 'constant-vus', vus: actors.length, duration, exec: 'resilienceLoop', gracefulStop: '10s' } },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    resilience_sessions_ready: [`count==${actors.length}`],
    resilience_recovered: [`count==${actors.length}`],
    resilience_api_transient_failures: ['count>0'],
    resilience_db_transient_failures: ['count>0'],
    resilience_unexpected: ['count==0'],
    resilience_iterations_completed: ['count>0'],
    'resilience_recovery_ms': [`max<${recoveryLimitMs}`],
  },
}

let identity
let announcedReady = false
let announcedRecovery = false

export function setup() {
  return { startAt: Date.now() }
}

function expectedWindow(elapsedSeconds) {
  if (elapsedSeconds >= apiDownStart && elapsedSeconds < apiDownStart + apiDownDuration) return 'api'
  if (elapsedSeconds >= dbDownStart && elapsedSeconds < dbDownStart + dbDownDuration) return 'database'
  if (elapsedSeconds >= outageEndSeconds && elapsedSeconds < outageEndSeconds + recoveryLimitMs / 1000) return 'recovery'
  return null
}

function read(actor, phase) {
  const url = `${config.base}/api/local/perfiles/v1/consultas/programacion?runId=${encodeURIComponent(config.manifest.runId)}&actorId=${encodeURIComponent(actor.actorId)}&sessionId=${encodeURIComponent(identity.sessionId)}`
  const response = http.get(url, { tags: requestTags(config, 'resilience', 'read', 'dashboard', { outage_phase: phase || 'normal' }) })
  const body = safeJson(response)
  if (response.status === 200) {
    const ok = check(response, { 'resilience dashboard read succeeds': () => body?.data?.actorId === actor.actorId && body.data.key === 'programacion' })
    if (!ok) unexpected.add(1)
    return { ok, transient: false }
  }
  const transient = response.status === 0 || [502, 503, 504].includes(response.status)
  const allowed = transient && phase !== null
  check(response, { 'only known transient outage responses are allowed': () => allowed })
  if (allowed && phase === 'api') apiTransient.add(1)
  else if (allowed && phase === 'database') dbTransient.add(1)
  else if (allowed && phase === 'recovery') recoveryTransient.add(1)
  else unexpected.add(1)
  return { ok: false, transient: allowed }
}

export function resilienceLoop(run) {
  const actor = actors[__VU - 1]
  if (!actor) { unexpected.add(1); fail('Resilience actor mapping is outside the validated manifest') }
  if (!identity) {
    identity = loginAndSession(config, actor, 'resilience')
    if (!identity) { unexpected.add(1); fail('Resilience actor authentication failed; inspect aggregate metrics') }
  }
  if (!announcedReady) {
    const initial = read(actor, null)
    if (!initial.ok) { unexpected.add(1); fail('Initial resilience read failed before the planned outage') }
    ready.add(1)
    announcedReady = true
  }

  const elapsedSeconds = (Date.now() - run.startAt) / 1000
  const phase = expectedWindow(elapsedSeconds)
  const result = read(actor, phase)
  if (elapsedSeconds >= outageEndSeconds && result.ok && !announcedRecovery) {
    if (!maintainSession(config, actor, identity, 'resilience')) { unexpected.add(1); fail('Resilience session maintenance failed after recovery') }
    announcedRecovery = true
    recovered.add(1)
    recoveryMs.add(Date.now() - run.startAt - outageEndSeconds * 1000)
  }
  if (result.ok || result.transient) iterations.add(1)
  else fail('Resilience read failed outside the allowed transient outage responses')
  sleep(pollSeconds)
}

export default function (run) { resilienceLoop(run) }

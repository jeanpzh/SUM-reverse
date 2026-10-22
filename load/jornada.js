import http from 'k6/http'
import { check, sleep } from 'k6'
import exec from 'k6/execution'
import { Counter, Trend } from 'k6/metrics'
import { runtimeConfig, loginAndSession, requestTags, safeJson, uuidV4 } from './common.js'
import { waveOffsets } from './wave-schedule.mjs'

const config = runtimeConfig()
const actors = config.manifest.actors
const expectedAccepted = Number(config.manifest.expectedAccepted)
const expectedRejected = Number(config.manifest.expectedRejected)
if (config.manifest.scenarioProfile !== 'fisi-schools' || config.manifest.fisi?.mode !== 'jornada' || !actors.every((actor) => Number.isSafeInteger(actor.wave))) throw new Error('jornada requires a fisi-schools manifest prepared with SIMULATOR_FISI_FRANJA=jornada (actors with wave 1..9)')
const waveInterval = Number(__ENV.WAVE_INTERVAL || 60)
const frontload = Number(__ENV.WAVE_FRONTLOAD ?? 1)
const startDelay = Number(__ENV.START_DELAY_MS || 10000)
const offsets = waveOffsets(actors, { intervalMs: waveInterval * 1000, delayMs: startDelay, frontload })
const accepted = new Counter('jornada_accepted')
const rejected = new Counter('jornada_rejected')
const unexpected = new Counter('jornada_unexpected')
const completed = new Counter('jornada_completed')
const startLag = new Trend('jornada_start_lag_ms')

const thresholds = {
  checks: ['rate==1'],
  dropped_iterations: ['count==0'],
  jornada_accepted: [`count==${expectedAccepted}`],
  jornada_rejected: [`count==${expectedRejected}`],
  jornada_completed: [`count==${actors.length}`],
  jornada_unexpected: ['count==0'],
  'http_req_duration{name:auth-login}': [`p(95)<${Number(__ENV.LOGIN_P95_MS || 2000)}`, `p(99)<${Number(__ENV.LOGIN_P99_MS || 5000)}`],
  'http_req_duration{operation:submit}': [`p(95)<${Number(__ENV.ENROLLMENT_P95_MS || 2000)}`, `p(99)<${Number(__ENV.ENROLLMENT_P99_MS || 5000)}`],
}

export const options = {
  noCookiesReset: true,
  systemTags: ['status', 'method', 'scenario', 'name', 'group', 'check', 'expected_response'],
  scenarios: { jornada: { executor: 'per-vu-iterations', vus: actors.length, iterations: 1, maxDuration: __ENV.MAX_DURATION || `${Math.ceil(9 * waveInterval + startDelay / 1000 + 120)}s`, exec: 'jornadaOnce' } },
  thresholds,
}

export function setup() {
  return { startedAt: Date.now() }
}

export function jornadaOnce(start) {
  const actor = actors[__VU - 1]
  if (!actor) { unexpected.add(1); return }
  // The wave is a low-cardinality number 1..9, never an identity; it tags every request of this VU.
  if (exec.vu.tags) exec.vu.tags.wave = String(actor.wave)
  const extra = { wave: String(actor.wave) }
  const scheduled = start.startedAt + offsets[__VU - 1]
  const wait = scheduled - Date.now()
  if (wait > 0) sleep(wait / 1000)
  startLag.add(Math.max(0, Date.now() - scheduled))

  const identity = loginAndSession(config, actor, 'jornada')
  if (!identity) { unexpected.add(1); return }
  const context = http.get(`${config.base}/api/local/matricula-regular/v1/contextos/${encodeURIComponent(actor.actorId)}`, { tags: requestTags(config, 'jornada', 'prepare', 'enrollment-context', extra) })
  const contextBody = safeJson(context)
  if (!check(context, { 'jornada context prepared': () => context.status === 200 && typeof contextBody?.data?.profileRevision === 'string' })) { unexpected.add(1); return }
  // Same submit construction as enrollment.js (not exported from there; kept minimal).
  const requestId = uuidV4()
  const body = {
    runId: config.manifest.runId,
    actorId: actor.actorId,
    sessionId: identity.sessionId,
    requestId,
    profileRevision: contextBody.data.profileRevision,
    selection: actor.selection || config.manifest.selection,
  }
  const response = http.post(`${config.base}/api/local/matricula-regular/v1/solicitudes`, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', Origin: config.origin },
    tags: requestTags(config, 'jornada', 'submit', 'enrollment', extra),
  })
  const responseBody = safeJson(response)
  const state = responseBody?.data?.state
  if (!check(response, { 'jornada submission has a known terminal outcome': () => response.status === 200 && ['accepted', 'rejected'].includes(state) && responseBody.data.requestId === requestId })) {
    unexpected.add(1)
    return
  }
  if (state === 'accepted') accepted.add(1)
  else {
    const hasSectionFull = (responseBody.data.causes || []).some((cause) => cause.code === 'SECTION_FULL')
    if (hasSectionFull) rejected.add(1)
    else unexpected.add(1)
    check(hasSectionFull, { 'jornada rejected only because a section is full': (value) => value === true })
  }
  completed.add(1)
}

export default function (start) { jornadaOnce(start) }

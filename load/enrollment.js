import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter } from 'k6/metrics'
import { Trend } from 'k6/metrics'
import { runtimeConfig, loginAndSession, requestTags, safeJson, uuidV4 } from './common.js'

const config = runtimeConfig()
const accepted = new Counter('enrollments_accepted')
const capacityRejected = new Counter('enrollments_section_full')
const unexpected = new Counter('enrollments_unexpected')
const completed = new Counter('enrollment_iterations_completed')
const startOffset = new Trend('submit_start_offset_ms')
const actors = config.manifest.actors
const expectedAccepted = Number(config.manifest.expectedAccepted)
const expectedRejected = Number(config.manifest.expectedRejected)
const barrierDelay = Number(__ENV.BARRIER_DELAY_MS || 60000)
const barrierTolerance = Number(__ENV.BARRIER_TOLERANCE_MS || 1000)

const thresholds = {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    enrollments_accepted: [`count==${expectedAccepted}`],
    enrollments_unexpected: ['count==0'],
    enrollment_iterations_completed: [`count==${actors.length}`],
    'submit_start_offset_ms': [`max<${barrierTolerance}`],
    'http_req_duration{operation:submit}': [`p(95)<${Number(__ENV.ENROLLMENT_P95_MS || 2000)}`, `p(99)<${Number(__ENV.ENROLLMENT_P99_MS || 5000)}`],
  }
if (expectedRejected > 0) thresholds.enrollments_section_full = [`count==${expectedRejected}`]

export const options = {
  noCookiesReset: true,
  systemTags: ['status', 'method', 'scenario', 'name', 'group', 'check', 'expected_response'],
  scenarios: { hot_section: { executor: 'per-vu-iterations', vus: actors.length, iterations: 1, maxDuration: __ENV.MAX_DURATION || '5m', exec: 'enrollOnce' } },
  thresholds,
}

export function setup() {
  return { notBefore: Date.now() + barrierDelay }
}

export function enrollOnce(barrier) {
  const actor = actors[__VU - 1]
  const identity = loginAndSession(config, actor, 'enrollment')
  if (!identity) { unexpected.add(1); return }
  const context = http.get(`${config.base}/api/local/matricula-regular/v1/contextos/${encodeURIComponent(actor.actorId)}`, { tags: requestTags(config, 'enrollment', 'prepare', 'enrollment-context') })
  const contextBody = safeJson(context)
  if (!check(context, { 'enrollment context prepared': () => context.status === 200 && typeof contextBody?.data?.profileRevision === 'string' })) { unexpected.add(1); return }
  const profileRevision = contextBody.data.profileRevision
  while (Date.now() < barrier.notBefore) sleep(0.1)
  const delay = Math.max(0, Date.now() - barrier.notBefore)
  startOffset.add(delay)
  const withinTolerance = check(delay, { 'submission is within synchronization tolerance': (value) => value < barrierTolerance })
  if (!withinTolerance) { unexpected.add(1); return }
  const requestId = uuidV4()
  const body = {
    runId: config.manifest.runId,
    actorId: actor.actorId,
    sessionId: identity.sessionId,
    requestId,
    profileRevision,
    selection: actor.selection || config.manifest.selection,
  }
  const response = http.post(`${config.base}/api/local/matricula-regular/v1/solicitudes`, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', Origin: config.origin },
    tags: requestTags(config, 'enrollment', 'submit', 'enrollment'),
  })
  const responseBody = safeJson(response)
  const state = responseBody?.data?.state
  if (!check(response, { 'submission has a known terminal outcome': () => response.status === 200 && ['accepted', 'rejected'].includes(state) && responseBody.data.requestId === requestId })) {
    unexpected.add(1)
    return
  }
  if (state === 'accepted') accepted.add(1)
  else {
    const causes = responseBody.data.causes || []
    const hasSectionFull = causes.some((cause) => cause.code === 'SECTION_FULL')
    if (hasSectionFull) capacityRejected.add(1)
    else unexpected.add(1)
    check(hasSectionFull, { 'rejected only because hot section is full': (value) => value === true })
  }
  completed.add(1)
}

export default function (barrier) { enrollOnce(barrier) }

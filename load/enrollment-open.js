import http from 'k6/http'
import { check } from 'k6'
import exec from 'k6/execution'
import { Counter } from 'k6/metrics'
import { runtimeConfig, loginAndSession, requestTags, safeJson, uuidV4 } from './common.js'

const config = runtimeConfig()
const actors = config.manifest.actors
const rate = Number(__ENV.RATE || 10)
const duration = __ENV.DURATION || '60s'
if (!Number.isFinite(rate) || rate <= 0) throw new Error('RATE must be a positive number of submits per second')
const preAllocatedVUs = Number(__ENV.PRE_ALLOCATED_VUS || Math.max(10, Math.ceil(rate * 3)))
const maxVUs = Number(__ENV.MAX_VUS || Math.max(preAllocatedVUs, Math.ceil(rate * 10)))
const submits = new Counter('open_submits')
const accepted = new Counter('open_accepted')
const rejected = new Counter('open_rejected')
const unexpected = new Counter('open_unexpected')
const exhausted = new Counter('open_population_exhausted')

export const options = {
  noCookiesReset: true,
  systemTags: ['status', 'method', 'scenario', 'name', 'group', 'check', 'expected_response'],
  scenarios: { enrollment_open: { executor: 'constant-arrival-rate', rate, timeUnit: '1s', duration, preAllocatedVUs, maxVUs, exec: 'openOnce', gracefulStop: '30s' } },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    open_unexpected: ['count==0'],
    // RATE x DURATION must not exceed the actor population: an actor never submits twice.
    open_population_exhausted: ['count==0'],
    'http_req_duration{name:auth-login}': [`p(95)<${Number(__ENV.LOGIN_P95_MS || 2000)}`, `p(99)<${Number(__ENV.LOGIN_P99_MS || 5000)}`],
    'http_req_duration{operation:submit}': [`p(95)<${Number(__ENV.ENROLLMENT_P95_MS || 2000)}`, `p(99)<${Number(__ENV.ENROLLMENT_P99_MS || 5000)}`],
  },
}

export function openOnce() {
  const actor = actors[exec.scenario.iterationInTest]
  if (!actor) { exhausted.add(1); return }
  const identity = loginAndSession(config, actor, 'enrollment-open')
  if (!identity) { unexpected.add(1); return }
  const context = http.get(`${config.base}/api/local/matricula-regular/v1/contextos/${encodeURIComponent(actor.actorId)}`, { tags: requestTags(config, 'enrollment-open', 'prepare', 'enrollment-context') })
  const contextBody = safeJson(context)
  if (!check(context, { 'open context prepared': () => context.status === 200 && typeof contextBody?.data?.profileRevision === 'string' })) { unexpected.add(1); return }
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
    tags: requestTags(config, 'enrollment-open', 'submit', 'enrollment'),
  })
  submits.add(1)
  const responseBody = safeJson(response)
  const state = responseBody?.data?.state
  if (!check(response, { 'open submission has a known terminal outcome': () => response.status === 200 && ['accepted', 'rejected'].includes(state) && responseBody.data.requestId === requestId })) {
    unexpected.add(1)
    return
  }
  if (state === 'accepted') accepted.add(1)
  else {
    const hasSectionFull = (responseBody.data.causes || []).some((cause) => cause.code === 'SECTION_FULL')
    if (hasSectionFull) rejected.add(1)
    else unexpected.add(1)
    check(hasSectionFull, { 'open rejected only because a section is full': (value) => value === true })
  }
}

export default function () { openOnce() }

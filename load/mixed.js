import http from 'k6/http'
import { check, fail, sleep } from 'k6'
import { Counter } from 'k6/metrics'
import { runtimeConfig, loginAndSession, maintainSession, requestTags, safeJson, uuidV4 } from './common.js'

const config = runtimeConfig()
const actors = config.manifest.actors
const duration = __ENV.DURATION || '10m'
const minThink = Number(__ENV.THINK_MIN_SECONDS || 1)
const maxThink = Number(__ENV.THINK_MAX_SECONDS || 5)
const completed = new Counter('mixed_iterations_completed')
const unexpected = new Counter('mixed_unexpected')
const reads = new Counter('mixed_read_actions')
const prepares = new Counter('mixed_prepare_actions')
const submits = new Counter('mixed_submit_actions')
const accepted = new Counter('mixed_submissions_accepted')
if (config.manifest.scenarioProfile !== 'ample' || config.manifest.expectedAccepted !== actors.length) throw new Error('mixed scenario requires unique actors in an ample profile with all actors expected accepted')
if (!Number.isFinite(minThink) || !Number.isFinite(maxThink) || minThink < 0 || maxThink < minThink) throw new Error('THINK_MIN_SECONDS and THINK_MAX_SECONDS must be valid nonnegative bounds')

export const options = {
  noCookiesReset: true,
  systemTags: ['status', 'method', 'scenario', 'name', 'group', 'check', 'expected_response'],
  scenarios: { mixed_workload: { executor: 'constant-vus', vus: actors.length, duration, exec: 'mixedIteration', gracefulStop: '10s' } },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    mixed_iterations_completed: ['count>0'],
    mixed_unexpected: ['count==0'],
    mixed_read_actions: ['count>0'],
    mixed_prepare_actions: ['count>0'],
    mixed_submit_actions: [`count==${actors.length}`],
    mixed_submissions_accepted: [`count==${actors.length}`],
    'http_req_duration{operation:submit}': [`p(95)<${Number(__ENV.ENROLLMENT_P95_MS || 2000)}`, `p(99)<${Number(__ENV.ENROLLMENT_P99_MS || 5000)}`],
  },
}

let identity
let iteration = 0
let submitted = false

function readDashboard(actor) {
  const url = `${config.base}/api/local/perfiles/v1/consultas/programacion?runId=${encodeURIComponent(config.manifest.runId)}&actorId=${encodeURIComponent(actor.actorId)}&sessionId=${encodeURIComponent(identity.sessionId)}`
  const response = http.get(url, { tags: requestTags(config, 'mixed', 'read', 'dashboard') })
  const body = safeJson(response)
  const ok = check(response, { 'mixed dashboard read succeeds': () => response.status === 200 && body?.data?.actorId === actor.actorId && body.data.key === 'programacion' })
  if (!ok) { unexpected.add(1); return false }
  reads.add(1)
  return true
}

export function mixedIteration() {
  const actor = actors[__VU - 1]
  if (!actor) { unexpected.add(1); fail('Mixed actor mapping is outside the validated manifest') }
  if (!identity) {
    identity = loginAndSession(config, actor, 'mixed')
    if (!identity) { unexpected.add(1); fail('Mixed actor authentication failed; inspect aggregate metrics') }
  }
  if (!maintainSession(config, actor, identity, 'mixed')) { unexpected.add(1); fail('Mixed session maintenance failed; inspect aggregate metrics') }
  sleep(minThink + Math.random() * (maxThink - minThink))

  const actorPhase = Math.floor((__VU - 1) / Math.ceil(actors.length / 10))
  const actionIndex = (iteration + actorPhase) % 10
  iteration += 1
  if (actionIndex < 7 || (actionIndex === 9 && submitted)) {
    if (!readDashboard(actor)) fail('Mixed read failed; inspect aggregate metrics')
  } else if (actionIndex < 9) {
    const context = http.get(`${config.base}/api/local/matricula-regular/v1/contextos/${encodeURIComponent(actor.actorId)}`, { tags: requestTags(config, 'mixed', 'prepare', 'context') })
    const body = safeJson(context)
    const ok = check(context, { 'mixed preparation context succeeds': () => context.status === 200 && typeof body?.data?.profileRevision === 'string' })
    if (!ok) { unexpected.add(1); fail('Mixed preparation failed; inspect aggregate metrics') }
    prepares.add(1)
  } else {
    const context = http.get(`${config.base}/api/local/matricula-regular/v1/contextos/${encodeURIComponent(actor.actorId)}`, { tags: requestTags(config, 'mixed', 'prepare', 'submit-context') })
    const contextBody = safeJson(context)
    const contextOk = check(context, { 'mixed submit context succeeds': () => context.status === 200 && typeof contextBody?.data?.profileRevision === 'string' })
    if (!contextOk) { unexpected.add(1); fail('Mixed submit preparation failed; inspect aggregate metrics') }
    const requestId = uuidV4()
    const payload = {
      runId: config.manifest.runId,
      actorId: actor.actorId,
      sessionId: identity.sessionId,
      requestId,
      profileRevision: contextBody.data.profileRevision,
      selection: actor.selection || config.manifest.selection,
    }
    const response = http.post(`${config.base}/api/local/matricula-regular/v1/solicitudes`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json', Origin: config.origin },
      tags: requestTags(config, 'mixed', 'submit', 'first-enrollment'),
    })
    const body = safeJson(response)
    const ok = check(response, { 'mixed first submission has expected academic acceptance': () => response.status === 200 && body?.data?.state === 'accepted' && body.data.requestId === requestId })
    if (!ok) { unexpected.add(1); fail('Mixed submission outcome was unexpected; inspect aggregate metrics') }
    submitted = true
    submits.add(1)
    accepted.add(1)
  }
  completed.add(1)
}

export default function () { mixedIteration() }

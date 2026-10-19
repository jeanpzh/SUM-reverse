import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter } from 'k6/metrics'
import { runtimeConfig, loginAndSession, requestTags, safeJson, uuidV4 } from './common.js'

const config = runtimeConfig()
const actors = config.manifest.actors
const initialAccepted = new Counter('retry_initial_accepted')
const replayed = new Counter('retry_replays')
const conflicts = new Counter('retry_payload_conflicts')
const alreadyEnrolled = new Counter('retry_already_enrolled')
const recovered = new Counter('retry_request_recovered')
const reports = new Counter('retry_reports_verified')
const completed = new Counter('retry_iterations_completed')
const unexpected = new Counter('retry_unexpected')
const transientResponses = new Counter('retry_transient_responses')
const maxAttempts = Number(__ENV.RETRY_MAX_ATTEMPTS || 8)
if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 12) throw new Error('RETRY_MAX_ATTEMPTS must be 1..12')

if (config.manifest.scenarioProfile !== 'ample' || config.manifest.expectedAccepted !== actors.length) throw new Error('retry scenario requires unique actors in an ample profile with all actors expected accepted')

export const options = {
  noCookiesReset: true,
  systemTags: ['status', 'method', 'scenario', 'name', 'group', 'check', 'expected_response'],
  batch: 20,
  batchPerHost: 20,
  scenarios: { retries: { executor: 'per-vu-iterations', vus: actors.length, iterations: 1, maxDuration: __ENV.MAX_DURATION || '2m', exec: 'retryOnce' } },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    retry_initial_accepted: [`count==${actors.length}`],
    retry_replays: [`count==${actors.length * 2}`],
    retry_payload_conflicts: [`count==${actors.length}`],
    retry_already_enrolled: [`count==${actors.length}`],
    retry_request_recovered: [`count==${actors.length}`],
    retry_reports_verified: [`count==${actors.length}`],
    retry_iterations_completed: [`count==${actors.length}`],
    retry_unexpected: ['count==0'],
  },
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  return value
}

function sameJson(left, right) {
  return left !== null && right !== null && JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}

function requestWithRetry(method, url, body, params) {
  let response
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    response = http.request(method, url, body, params)
    if (response.status !== 0 && ![502, 503, 504].includes(response.status)) return response
    transientResponses.add(1)
    if (attempt + 1 < maxAttempts) sleep(Math.min(2, 0.15 * (2 ** attempt)) + Math.random() * 0.2)
  }
  return response
}

export function retryOnce() {
  const actor = actors[__VU - 1]
  if (!actor) { unexpected.add(1); return }
  const identity = loginAndSession(config, actor, 'retry')
  if (!identity) { unexpected.add(1); return }

  const context = requestWithRetry('GET', `${config.base}/api/local/matricula-regular/v1/contextos/${encodeURIComponent(actor.actorId)}`, null, { tags: requestTags(config, 'retry', 'prepare', 'context') })
  const contextBody = safeJson(context)
  if (!check(context, { 'retry context succeeds': () => context.status === 200 && typeof contextBody?.data?.profileRevision === 'string' })) { unexpected.add(1); return }

  const body = {
    runId: config.manifest.runId,
    actorId: actor.actorId,
    sessionId: identity.sessionId,
    requestId: uuidV4(),
    profileRevision: contextBody.data.profileRevision,
    selection: actor.selection || config.manifest.selection,
  }
  const url = `${config.base}/api/local/matricula-regular/v1/solicitudes`
  const params = { headers: { 'Content-Type': 'application/json', Origin: config.origin }, tags: requestTags(config, 'retry', 'submit', 'first-request') }
  const first = requestWithRetry('POST', url, JSON.stringify(body), params)
  const firstBody = safeJson(first)
  const firstOk = check(first, { 'first request is accepted': () => first.status === 200 && firstBody?.data?.state === 'accepted' && firstBody.data.requestId === body.requestId })
  if (!firstOk) { unexpected.add(1); return }
  initialAccepted.add(1)

  const expectedResponse = JSON.stringify(canonical(firstBody))
  const replayParams = { ...params, tags: requestTags(config, 'retry', 'replay', 'same-request-id') }
  const replayResponses = http.batch(Array.from({ length: 2 }, () => ({ method: 'POST', url, body: JSON.stringify(body), params: replayParams })))
  let replayOk = true
  for (let response of replayResponses) {
    if (response.status === 0 || [502, 503, 504].includes(response.status)) {
      transientResponses.add(1)
      response = requestWithRetry('POST', url, JSON.stringify(body), replayParams)
    }
    const responseBody = safeJson(response)
    const ok = check(response, { 'concurrent same id replay returns the full original response': () => response.status === 200 && JSON.stringify(canonical(responseBody)) === expectedResponse })
    if (ok) replayed.add(1)
    else replayOk = false
  }

  const changedSelection = body.selection.map((item, index) => index === 0 ? { ...item, sectionId: `${item.sectionId.slice(0, -1)}${item.sectionId.endsWith('A') ? 'B' : 'A'}` } : item)
  const conflict = requestWithRetry('POST', url, JSON.stringify({ ...body, selection: changedSelection }), {
    headers: params.headers,
    responseCallback: http.expectedStatuses(200, 409),
    tags: requestTags(config, 'retry', 'conflict', 'changed-payload'),
  })
  const conflictBody = safeJson(conflict)
  const conflictOk = check(conflict, { 'changed payload with same id conflicts': () => conflict.status === 409 && conflictBody?.error?.code === 'REQUEST_CONFLICT' })
  if (conflictOk) conflicts.add(1)

  const duplicateId = uuidV4()
  const duplicate = requestWithRetry('POST', url, JSON.stringify({ ...body, requestId: duplicateId }), { ...params, tags: requestTags(config, 'retry', 'submit', 'already-enrolled') })
  const duplicateBody = safeJson(duplicate)
  const duplicateOk = check(duplicate, { 'new id for enrolled actor is rejected': () => duplicate.status === 200 && duplicateBody?.data?.state === 'rejected' && duplicateBody.data.requestId === duplicateId && (duplicateBody.data.causes || []).some((cause) => cause.code === 'ALREADY_ENROLLED') })
  if (duplicateOk) alreadyEnrolled.add(1)

  const lookupUrl = `${config.base}/api/local/matricula-regular/v1/solicitudes/${encodeURIComponent(body.requestId)}?runId=${encodeURIComponent(body.runId)}&actorId=${encodeURIComponent(actor.actorId)}`
  const lookup = requestWithRetry('GET', lookupUrl, null, { tags: requestTags(config, 'retry', 'recover', 'request-lookup') })
  const lookupBody = safeJson(lookup)
  const lookupOk = check(lookup, { 'durable result is recovered by request id': () => lookup.status === 200 && lookupBody?.data?.state === 'known' && sameJson(lookupBody.data.outcome, firstBody.data) })
  if (lookupOk) recovered.add(1)

  const enrollmentId = firstBody.data.enrollmentId
  const reportUrl = `${config.base}/api/local/matricula-regular/v1/reportes/${encodeURIComponent(enrollmentId)}?runId=${encodeURIComponent(body.runId)}&actorId=${encodeURIComponent(actor.actorId)}`
  const report = requestWithRetry('GET', reportUrl, null, { tags: requestTags(config, 'retry', 'read', 'enrollment-report') })
  const reportBody = safeJson(report)
  const reportOk = check(report, { 'accepted enrollment report is readable': () => report.status === 200 && reportBody?.data?.enrollmentId === enrollmentId && Array.isArray(reportBody.data.rows) })
  if (reportOk) reports.add(1)

  if (!replayOk || !conflictOk || !duplicateOk || !lookupOk || !reportOk) { unexpected.add(1); return }
  completed.add(1)
}

export default function () { retryOnce() }

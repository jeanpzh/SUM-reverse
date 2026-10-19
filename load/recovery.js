import http from 'k6/http'
import { check } from 'k6'
import { Counter } from 'k6/metrics'
import { runtimeConfig, loginAndSession, requestTags, safeJson, uuidV4 } from './common.js'

const config = runtimeConfig()
const initialAccepted = new Counter('recovery_initial_accepted')
const replays = new Counter('recovery_replays')
const payloadConflicts = new Counter('recovery_payload_conflicts')
const alreadyEnrolled = new Counter('recovery_already_enrolled')
const unexpected = new Counter('recovery_unexpected')
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  return value
}

export const options = {
  systemTags: ['status', 'method', 'scenario', 'name', 'group', 'check', 'expected_response'],
  batch: 20,
  batchPerHost: 20,
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    recovery_initial_accepted: ['count==1'],
    recovery_replays: ['count==20'],
    recovery_payload_conflicts: ['count==1'],
    recovery_already_enrolled: ['count==1'],
    recovery_unexpected: ['count==0'],
  },
}

export default function () {
  try {
    const actor = config.manifest.actors[0]
    const identity = loginAndSession(config, actor, 'recovery')
    if (!identity) { unexpected.add(1); return }
    const context = http.get(`${config.base}/api/local/matricula-regular/v1/contextos/${encodeURIComponent(actor.actorId)}`, { tags: requestTags(config, 'recovery', 'prepare', 'context') })
    const contextBody = safeJson(context)
    if (!check(context, { 'context read succeeds': () => context.status === 200 && typeof contextBody?.data?.profileRevision === 'string' })) { unexpected.add(1); return }
    const requestId = uuidV4()
    const body = {
      runId: config.manifest.runId,
      actorId: actor.actorId,
      sessionId: identity.sessionId,
      requestId,
      profileRevision: contextBody.data.profileRevision,
      selection: actor.selection || config.manifest.selection,
    }
    const submitUrl = `${config.base}/api/local/matricula-regular/v1/solicitudes`
    const submitParams = { headers: { 'Content-Type': 'application/json', Origin: config.origin }, tags: requestTags(config, 'recovery', 'submit', 'enrollment') }
    const first = http.post(submitUrl, JSON.stringify(body), submitParams)
    const firstBody = safeJson(first)
    const firstOk = check(first, { 'initial request accepted': () => first.status === 200 && firstBody?.data?.state === 'accepted' })
    if (!firstOk) { unexpected.add(1); return }
    initialAccepted.add(1)
    const expected = JSON.stringify(canonical(firstBody))
    const replayParams = { ...submitParams, tags: requestTags(config, 'recovery', 'replay', 'same-request-id') }
    const replayResponses = http.batch(Array.from({ length: 20 }, () => ({ method: 'POST', url: submitUrl, body: JSON.stringify(body), params: replayParams })))
    for (const response of replayResponses) {
      const responseBody = safeJson(response)
      const replayOk = check(response, { 'same request id replays complete original outcome': () => response.status === 200 && JSON.stringify(canonical(responseBody)) === expected })
      if (replayOk) replays.add(1)
    }
    const mismatch = http.post(`${config.base}/api/local/matricula-regular/v1/solicitudes`, JSON.stringify({ ...body, selection: body.selection.slice(1) }), {
      headers: { 'Content-Type': 'application/json', Origin: config.origin },
      responseCallback: http.expectedStatuses(200, 409),
      tags: requestTags(config, 'recovery', 'conflict', 'changed-payload'),
    })
    const mismatchBody = safeJson(mismatch)
    const conflictOk = check(mismatch, { 'same id with changed payload conflicts': () => mismatch.status === 409 && mismatchBody?.error?.code === 'REQUEST_CONFLICT' })
    if (conflictOk) payloadConflicts.add(1)
    const newId = http.post(`${config.base}/api/local/matricula-regular/v1/solicitudes`, JSON.stringify({ ...body, requestId: uuidV4() }), {
      headers: { 'Content-Type': 'application/json', Origin: config.origin }, tags: requestTags(config, 'recovery', 'submit', 'new-request'),
    })
    const newIdBody = safeJson(newId)
    const duplicateOk = check(newId, { 'new id for enrolled actor is rejected as already enrolled': () => newId.status === 200 && newIdBody?.data?.state === 'rejected' && (newIdBody.data.causes || []).some((cause) => cause.code === 'ALREADY_ENROLLED') })
    if (duplicateOk) alreadyEnrolled.add(1)
    if (!conflictOk || !duplicateOk) unexpected.add(1)
  } catch (error) {
    unexpected.add(1)
    throw error
  }
}

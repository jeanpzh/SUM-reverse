import http from 'k6/http'
import { check } from 'k6'
import { Counter } from 'k6/metrics'
import { runtimeConfig, loginAndSession, uuidV4 } from './common.js'

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
    const identity = loginAndSession(config, actor)
    if (!identity) { unexpected.add(1); return }
    const context = http.get(`${config.base}/api/local/matricula-regular/v1/contextos/${encodeURIComponent(actor.actorId)}`, { tags: { operation: 'prepare', name: 'context' } })
    if (!check(context, { 'context read succeeds': (r) => r.status === 200 })) { unexpected.add(1); return }
    const requestId = uuidV4()
    const body = {
      runId: config.manifest.runId,
      actorId: actor.actorId,
      sessionId: identity.sessionId,
      requestId,
      profileRevision: context.json('data.profileRevision'),
      selection: actor.selection || config.manifest.selection,
    }
    const submitUrl = `${config.base}/api/local/matricula-regular/v1/solicitudes`
    const submitParams = { headers: { 'Content-Type': 'application/json', Origin: config.origin }, tags: { operation: 'recovery', name: 'enrollment' } }
    const first = http.post(submitUrl, JSON.stringify(body), submitParams)
    const firstOk = check(first, { 'initial request accepted': (r) => r.status === 200 && r.json('data.state') === 'accepted' })
    if (firstOk) initialAccepted.add(1)
    const expected = JSON.stringify(canonical(first.json()))
    const replayResponses = http.batch(Array.from({ length: 20 }, () => ({ method: 'POST', url: submitUrl, body: JSON.stringify(body), params: submitParams })))
    for (const response of replayResponses) {
      const replayOk = check(response, { 'same request id replays complete original outcome': (r) => r.status === 200 && JSON.stringify(canonical(r.json())) === expected })
      if (replayOk) replays.add(1)
    }
    const mismatch = http.post(`${config.base}/api/local/matricula-regular/v1/solicitudes`, JSON.stringify({ ...body, selection: body.selection.slice(1) }), {
      headers: { 'Content-Type': 'application/json', Origin: config.origin },
      responseCallback: http.expectedStatuses(200, 409),
      tags: { operation: 'recovery', name: 'payload-conflict' },
    })
    const conflictOk = check(mismatch, { 'same id with changed payload conflicts': (r) => r.status === 409 && r.json('error.code') === 'REQUEST_CONFLICT' })
    if (conflictOk) payloadConflicts.add(1)
    const newId = http.post(`${config.base}/api/local/matricula-regular/v1/solicitudes`, JSON.stringify({ ...body, requestId: uuidV4() }), {
      headers: { 'Content-Type': 'application/json', Origin: config.origin }, tags: { operation: 'recovery', name: 'new-request' },
    })
    const duplicateOk = check(newId, { 'new id for enrolled actor is rejected as already enrolled': (r) => r.status === 200 && r.json('data.state') === 'rejected' && (r.json('data.causes') || []).some((cause) => cause.code === 'ALREADY_ENROLLED') })
    if (duplicateOk) alreadyEnrolled.add(1)
    if (!firstOk || !conflictOk || !duplicateOk) unexpected.add(1)
  } catch (error) {
    unexpected.add(1)
    throw error
  }
}

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateRequestId } from '../../../shared/matricula-regular.mjs'
import { createMatriculaRegularApi } from './matriculaRegular.ts'
import {
  canonicalSelection,
  classifySubmitError,
  createIntent,
  createSubmissionFlow,
  intentStorageKey,
  outcomeMatchesIntent,
  restoreIntent,
} from './matriculaRegularRecovery.ts'
import {
  acceptedOutcome, actorSis, actorSoft, canonicalSelectionSis, counter, enrollmentId, errorResponse,
  fakeStorage, jsonResponse, newSessionId, otherRunId, pendingOutcome, recordingFetch, rejectedOutcome,
  requestId, revisionSis, revisionSoft, runId, selectionSoft, sessionId, unorderedSelectionSis,
} from '../../tests/fixtures/matriculaRegularKit.ts'
import { MatriculaRegularApiError } from './matriculaRegular.ts'

const input = (overrides: Partial<Parameters<ReturnType<typeof createSubmissionFlow>['submit']>[0]> = {}) => ({
  runId, actorId: actorSis, sessionId, profileRevision: revisionSis, selection: unorderedSelectionSis, ...overrides,
})

function flowWith(handler: Parameters<typeof recordingFetch>[0], storageOptions: Parameters<typeof fakeStorage>[0] = {}) {
  const sequence = counter()
  const fetchRecorder = recordingFetch(handler, sequence)
  const store = fakeStorage({ ...storageOptions, sequence })
  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: fetchRecorder.fetchImpl })
  const flow = createSubmissionFlow({ api, storage: store.storage, newRequestId: () => requestId })
  return { flow, calls: fetchRecorder.calls, ...store }
}

const outcomeOk = (outcome = acceptedOutcome()) => jsonResponse(200, { runId, data: outcome })

// ---------------------------------------------------------------------------
// T038: UUID estable, canonical immutable selection, persisted BEFORE first POST
// ---------------------------------------------------------------------------

test('T038: the intent is a valid UUIDv4 with a canonical, frozen selection (default generator)', () => {
  const intent = createIntent(input())
  validateRequestId(intent.requestId)
  assert.deepEqual(intent.selection, canonicalSelectionSis)
  assert.ok(Object.isFrozen(intent) && Object.isFrozen(intent.selection))
  assert.notEqual(intent.selection, unorderedSelectionSis, 'must not alias the caller array')
  assert.deepEqual(unorderedSelectionSis.map((c) => c.courseId), ['SYN-SIS-C2', 'SYN-SIS-C1'], 'caller array untouched')
  assert.deepEqual(canonicalSelection(unorderedSelectionSis), canonicalSelectionSis)
})

test('T038: the intent is stored under mr:intent:{runId}:{actorId} BEFORE the first POST leaves the client', async () => {
  const { flow, calls, log, map } = flowWith(() => outcomeOk())
  const attempt = await flow.submit(input())
  assert.equal(attempt.result.kind, 'outcome')
  const firstSet = log.find((entry) => entry.op === 'set')
  assert.ok(firstSet, 'intent persisted')
  assert.equal(firstSet.key, `mr:intent:${runId}:${actorSis}`)
  assert.ok(firstSet.order < calls[0]!.order, 'storage write must precede the POST')
  assert.equal(map.size, 0, 'a definitive outcome clears the intent')
})

test('T038/T043: stored value is exactly {runId,actorId,requestId,profileRevision,selection} — no session, outcome, report or debug data', async () => {
  const { flow, map } = flowWith(() => { throw new TypeError('network down') })
  await flow.submit(input())
  assert.equal(map.size, 1)
  const stored = JSON.parse(map.get(intentStorageKey(runId, actorSis))!) as Record<string, unknown>
  assert.deepEqual(Object.keys(stored).sort(), ['actorId', 'profileRevision', 'requestId', 'runId', 'selection'])
  assert.deepEqual(stored.selection, canonicalSelectionSis)
  assert.ok(!JSON.stringify(stored).includes(sessionId), 'sessionId is not part of the identity')
})

test('T038: double click shares ONE identity and ONE POST (synchronous single-flight lock)', async () => {
  const { flow, calls } = flowWith(() => outcomeOk())
  const first = flow.submit(input())
  const second = flow.submit(input())
  assert.equal(first, second, 'the second click receives the in-flight attempt')
  assert.equal(flow.isBusy(), true)
  await first
  assert.equal(calls.length, 1)
  assert.equal(flow.isBusy(), false)
  // After resolution a later click is a NEW attempt with a new identity generator call.
})

test('T038: POST body carries the canonical selection and the current session, with credentials omitted', async () => {
  const { flow, calls } = flowWith(() => outcomeOk())
  await flow.submit(input())
  assert.deepEqual(calls[0]!.body, {
    runId, actorId: actorSis, sessionId, requestId, profileRevision: revisionSis, selection: canonicalSelectionSis,
  })
  assert.equal(calls[0]!.url, '/api/local/matricula-regular/v1/solicitudes')
})

test('T038: accepted, rejected and configuration-pending outcomes are definitive and clear the intent', async () => {
  for (const outcome of [acceptedOutcome(), rejectedOutcome(), pendingOutcome()]) {
    const { flow, map } = flowWith(() => outcomeOk(outcome))
    const attempt = await flow.submit(input())
    assert.equal(attempt.result.kind, 'outcome')
    if (attempt.result.kind === 'outcome') assert.equal(attempt.result.outcome.state, outcome.state)
    assert.equal(map.size, 0, `${outcome.state} clears the stored intent`)
  }
})

test('T038: network, abort, protocol and LOCAL_FAILURE are UNCERTAIN: intent kept, exactly one POST, never a rejection', async () => {
  const cases: [string, Parameters<typeof recordingFetch>[0], string][] = [
    ['network', () => { throw new TypeError('connection reset') }, 'network'],
    ['abort', () => { throw new DOMException('aborted', 'AbortError') }, 'aborted'],
    ['html gateway', () => new Response('<html>502</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }), 'protocol'],
    ['malformed 2xx', () => jsonResponse(200, { runId, data: { nope: 1 } }), 'protocol'],
    ['framework 500', () => jsonResponse(500, { statusCode: 500, message: 'Internal server error' }), 'protocol'],
    ['LOCAL_FAILURE', () => errorResponse(500, 'LOCAL_FAILURE'), 'local-failure'],
  ]
  for (const [name, handler, reason] of cases) {
    const { flow, calls, map } = flowWith(handler)
    const attempt = await flow.submit(input())
    assert.equal(attempt.result.kind, 'uncertain', name)
    if (attempt.result.kind === 'uncertain') assert.equal(attempt.result.reason, reason, name)
    assert.equal(calls.length, 1, `${name}: no automatic re-POST`)
    assert.equal(map.size, 1, `${name}: identity kept for recovery`)
  }
})

test('T038: protocol 4xx/409 without Outcome are definitive for that identity (not academic rejections) and clear it', async () => {
  const definitive: [number, string][] = [
    [400, 'INVALID_REQUEST'], [404, 'ACTOR_NOT_FOUND'], [404, 'CHOICE_NOT_FOUND'], [404, 'SESSION_NOT_FOUND'],
    [409, 'PROFILE_CHANGED'], [409, 'SESSION_EXPIRED'], [409, 'SESSION_CONTEXT_MISMATCH'],
  ]
  for (const [status, code] of definitive) {
    const { flow, map } = flowWith(() => errorResponse(status, code))
    const attempt = await flow.submit(input())
    assert.equal(attempt.result.kind, 'definitive', code)
    if (attempt.result.kind === 'definitive') {
      assert.equal(attempt.result.code, code)
      assert.equal(attempt.result.status, status)
    }
    assert.equal(map.size, 0, `${code} clears the attempt`)
  }
})

test('T038: REQUEST_CONFLICT is a client bug: keep the original intent and do not regenerate', async () => {
  const { flow, map } = flowWith(() => errorResponse(409, 'REQUEST_CONFLICT'))
  const attempt = await flow.submit(input())
  assert.equal(attempt.result.kind, 'conflict')
  assert.equal(map.size, 1)
  assert.equal(JSON.parse(map.get(intentStorageKey(runId, actorSis))!).requestId, requestId)
})

test('T038: an unrecognised HTTP code is not treated as rejection and keeps the identity', async () => {
  const { flow, map } = flowWith(() => errorResponse(503, 'SOMETHING_NEW'))
  const attempt = await flow.submit(input())
  assert.equal(attempt.result.kind, 'uncertain')
  assert.equal(map.size, 1)
})

test('T038: RUN_CHANGED on submit clears the intent without any further POST', async () => {
  const { flow, calls, map } = flowWith(() => errorResponse(409, 'RUN_CHANGED', otherRunId, ['runId']))
  const attempt = await flow.submit(input())
  assert.equal(attempt.result.kind, 'run-changed')
  assert.equal(map.size, 0)
  assert.equal(calls.length, 1)
})

test('T038: a validated Outcome whose selection or revision differs from the intent is not shown as success', async () => {
  const mismatches = [
    acceptedOutcome({ selection: [{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' }] }),
    acceptedOutcome({ profileRevision: 'MR-SYN-SIS-2' }),
  ]
  for (const outcome of mismatches) {
    const { flow, map } = flowWith(() => outcomeOk(outcome))
    const attempt = await flow.submit(input())
    assert.equal(attempt.result.kind, 'uncertain')
    if (attempt.result.kind === 'uncertain') assert.equal(attempt.result.reason, 'uncorrelated')
    assert.equal(map.size, 1, 'uncorrelated reply keeps the identity')
  }
  const intent = createIntent(input(), () => requestId)
  assert.equal(outcomeMatchesIntent(intent, acceptedOutcome()), true)
  assert.equal(outcomeMatchesIntent(intent, acceptedOutcome({ actorId: actorSoft })), false)
})

test('T038: storage write failure still sends the request, reports persisted=false and keeps the intent in memory', async () => {
  const { flow, calls } = flowWith(() => { throw new TypeError('down') }, { failSet: true })
  const attempt = await flow.submit(input())
  assert.equal(attempt.persisted, false)
  assert.equal(attempt.result.kind, 'uncertain')
  assert.equal(calls.length, 1)
  assert.equal(attempt.intent.requestId, requestId)
})

test('T038: classifySubmitError maps adapter errors without reading messages', () => {
  const make = (kind: 'network' | 'aborted' | 'protocol' | 'http', code?: string, status?: number) =>
    new MatriculaRegularApiError({ kind, operation: 'submit', message: 'x', code, status })
  assert.deepEqual(classifySubmitError(make('network')), { kind: 'uncertain', reason: 'network' })
  assert.deepEqual(classifySubmitError(make('aborted')), { kind: 'uncertain', reason: 'aborted' })
  assert.deepEqual(classifySubmitError(make('protocol')), { kind: 'uncertain', reason: 'protocol' })
  assert.deepEqual(classifySubmitError(new Error('boom')), { kind: 'uncertain', reason: 'protocol' })
})

// ---------------------------------------------------------------------------
// T043: consult (GET), manual replay (same identity/payload), restore, run reset
// ---------------------------------------------------------------------------

test('T043: consult known clears the intent and returns the correlated Outcome; GET has no body and no session', async () => {
  const { flow, calls, map } = flowWith((call) => call.method === 'GET'
    ? jsonResponse(200, { runId, data: { state: 'known', outcome: acceptedOutcome() } })
    : (() => { throw new TypeError('lost') })())
  const lost = await flow.submit(input())
  assert.equal(lost.result.kind, 'uncertain')
  const consulted = await flow.consult({ intent: lost.intent })
  assert.equal(consulted.kind, 'known')
  if (consulted.kind === 'known') assert.equal(consulted.outcome.enrollmentId, enrollmentId)
  const get = calls[1]!
  assert.equal(get.method, 'GET')
  assert.equal(get.body, undefined)
  const url = new URL(get.url, 'http://local')
  assert.equal(url.pathname, `/api/local/matricula-regular/v1/solicitudes/${requestId}`)
  assert.deepEqual([...url.searchParams.keys()].sort(), ['actorId', 'runId'])
  assert.equal(map.size, 0)
})

test('T043: consult unknown is an explicit state: keeps the identity and is NOT "no recibido" nor a rejection', async () => {
  const { flow, map } = flowWith((call) => call.method === 'GET'
    ? jsonResponse(200, { runId, data: { state: 'unknown', outcome: null } })
    : (() => { throw new TypeError('lost') })())
  const lost = await flow.submit(input())
  const consulted = await flow.consult({ intent: lost.intent })
  assert.deepEqual(consulted, { kind: 'unknown' })
  assert.equal(map.size, 1)
})

test('T043: consult transport failure or uncorrelated lookup keeps the identity as uncertain', async () => {
  for (const reply of [
    () => { throw new TypeError('offline') },
    () => jsonResponse(200, { runId, data: { state: 'known', outcome: acceptedOutcome({ selection: selectionSoft }) } }),
  ]) {
    const { flow, map } = flowWith((call) => call.method === 'GET' ? reply() : (() => { throw new TypeError('lost') })())
    const lost = await flow.submit(input())
    const consulted = await flow.consult({ intent: lost.intent })
    assert.equal(consulted.kind, 'error')
    assert.equal(map.size, 1)
  }
})

test('T043: consult with an old run (409 RUN_CHANGED) clears the intent and never re-POSTs', async () => {
  const { flow, calls, map } = flowWith((call) => call.method === 'GET'
    ? errorResponse(409, 'RUN_CHANGED', otherRunId, ['runId'])
    : (() => { throw new TypeError('lost') })())
  const lost = await flow.submit(input())
  const consulted = await flow.consult({ intent: lost.intent })
  assert.deepEqual(consulted, { kind: 'run-changed' })
  assert.equal(map.size, 0)
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
})

test('T043: manual replay sends the SAME requestId and payload (new session only) and returns the original Outcome', async () => {
  const { flow, calls } = flowWith((_call, index) => {
    if (index === 0) throw new TypeError('lost after commit')
    return outcomeOk(acceptedOutcome())
  })
  const lost = await flow.submit(input())
  assert.equal(calls.length, 1, 'no automatic replay')
  const replayed = await flow.replay({ intent: lost.intent, sessionId: newSessionId })
  assert.equal(replayed.result.kind, 'outcome')
  assert.equal(calls.length, 2)
  const { sessionId: firstSession, ...firstPayload } = calls[0]!.body as Record<string, unknown>
  const { sessionId: secondSession, ...secondPayload } = calls[1]!.body as Record<string, unknown>
  assert.deepEqual(secondPayload, firstPayload, 'identity + canonical payload identical')
  assert.equal(firstSession, sessionId)
  assert.equal(secondSession, newSessionId)
  assert.equal(calls[1]!.method, 'POST')
})

test('T043: replay after an expired session without stored result is definitive SESSION_EXPIRED and clears the intent', async () => {
  const { flow, map } = flowWith((_call, index) => {
    if (index === 0) throw new TypeError('lost before commit')
    return errorResponse(409, 'SESSION_EXPIRED')
  })
  const lost = await flow.submit(input())
  const replayed = await flow.replay({ intent: lost.intent, sessionId: newSessionId })
  assert.equal(replayed.result.kind, 'definitive')
  assert.equal(map.size, 0)
})

test('T043: restore returns the intent for the same run and actor, validated by the real wire validators', async () => {
  const { flow, storage } = flowWith(() => { throw new TypeError('lost') })
  const lost = await flow.submit(input())
  const restored = restoreIntent(storage, { runId, actorId: actorSis })
  assert.equal(restored.kind, 'restored')
  if (restored.kind === 'restored') assert.deepEqual(restored.intent, lost.intent)
})

test('T043: restoring under a different run warns, clears the stale intent and never offers it for POST', async () => {
  const { flow, storage, map } = flowWith(() => { throw new TypeError('lost') })
  await flow.submit(input())
  const restored = restoreIntent(storage, { runId: otherRunId, actorId: actorSis })
  assert.deepEqual(restored, { kind: 'reset', staleRunIds: [runId] })
  assert.equal(map.size, 0)
})

test('T043: two actors keep separate recoverable intents and switching never mixes or deletes the other', async () => {
  const sequence = counter()
  const store = fakeStorage({ sequence })
  const fetchRecorder = recordingFetch(() => { throw new TypeError('lost') }, sequence)
  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: fetchRecorder.fetchImpl })
  const ids = ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2']
  const flow = createSubmissionFlow({ api, storage: store.storage, newRequestId: () => ids.shift()! })
  await flow.submit(input())
  await flow.submit(input({ actorId: actorSoft, profileRevision: revisionSoft, selection: selectionSoft }))
  assert.equal(store.map.size, 2)
  const sis = restoreIntent(store.storage, { runId, actorId: actorSis })
  const soft = restoreIntent(store.storage, { runId, actorId: actorSoft })
  assert.ok(sis.kind === 'restored' && soft.kind === 'restored')
  if (sis.kind === 'restored' && soft.kind === 'restored') {
    assert.equal(sis.intent.actorId, actorSis)
    assert.equal(soft.intent.actorId, actorSoft)
    assert.notEqual(sis.intent.requestId, soft.intent.requestId)
  }
  restoreIntent(store.storage, { runId: otherRunId, actorId: actorSis })
  assert.equal(store.map.size, 1, 'only the requested actor was reset; the other actor intent survives')
  assert.ok(store.map.has(intentStorageKey(runId, actorSoft)))
})

test('T043: corrupt, foreign or shape-violating stored values are discarded, never replayed', () => {
  const key = intentStorageKey(runId, actorSis)
  const good = { runId, actorId: actorSis, requestId, profileRevision: revisionSis, selection: canonicalSelectionSis }
  const bad = [
    'not json', JSON.stringify({ ...good, sessionId }), JSON.stringify({ ...good, requestId: 'x' }),
    JSON.stringify({ ...good, actorId: actorSoft }), JSON.stringify({ ...good, selection: [] }),
    JSON.stringify({ ...good, profileRevision: 'bad' }),
  ]
  for (const value of bad) {
    const { storage, map } = fakeStorage({ seed: { [key]: value } })
    assert.deepEqual(restoreIntent(storage, { runId, actorId: actorSis }), { kind: 'none' }, value)
    assert.equal(map.size, 0, 'invalid entry removed')
  }
})

test('T043: unavailable storage restores nothing instead of throwing', () => {
  assert.deepEqual(restoreIntent(null, { runId, actorId: actorSis }), { kind: 'none' })
  const { storage } = fakeStorage({ failGet: true })
  assert.deepEqual(restoreIntent(storage, { runId, actorId: actorSis }), { kind: 'none' })
})

test('T043: errors propagate — no mock fallback and no automatic retry on consult', async () => {
  const { flow, calls } = flowWith((call) => call.method === 'GET'
    ? errorResponse(500, 'LOCAL_FAILURE')
    : (() => { throw new TypeError('lost') })())
  const lost = await flow.submit(input())
  const consulted = await flow.consult({ intent: lost.intent })
  assert.equal(consulted.kind, 'error')
  assert.equal(calls.length, 2, 'one POST + one GET, no retries')
})

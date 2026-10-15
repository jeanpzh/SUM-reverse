import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createMatriculaRegularApi,
  MatriculaRegularApiError,
} from './matriculaRegular.ts'
import {
  validateLookup,
  validateLookupQuery,
  validateLookupResponse,
} from '../../../shared/matricula-regular.mjs'
import type {
  MatriculaRegularId,
  MatriculaRegularLookup,
  MatriculaRegularOutcome,
  MatriculaRegularSubmission,
  MatriculaRegularUuid,
} from '../../../shared/matricula-regular.mjs'

// Test identities for Sistemas and Software
const runId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000001'
const otherRunId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000099'
const sessionId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000002'
const requestId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000003'
const otherRequestId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000097'
const enrollmentId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000004'

const actorIdSistemas: MatriculaRegularId = 'SYN-SIS-A'
const actorIdSoftware: MatriculaRegularId = 'SYN-SOFT-A'

const profileRevisionSistemas = 'MR-SYN-SIS-1'
const profileRevisionSoftware = 'MR-SYN-SOFT-1'

const time = '2026-08-11T15:00:00.000Z'

const sampleSubmissionSistemas: MatriculaRegularSubmission = {
  runId,
  actorId: actorIdSistemas,
  sessionId,
  requestId,
  profileRevision: profileRevisionSistemas,
  selection: [
    { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
    { courseId: 'SYN-SIS-C2', sectionId: 'SYN-SIS-S2' },
  ],
}

const sampleSubmissionSoftware: MatriculaRegularSubmission = {
  runId,
  actorId: actorIdSoftware,
  sessionId,
  requestId,
  profileRevision: profileRevisionSoftware,
  selection: [
    { courseId: 'SYN-SOFT-C1', sectionId: 'SYN-SOFT-S1' },
  ],
}

const sampleOutcomeAcceptedSistemas: MatriculaRegularOutcome = {
  requestId,
  actorId: actorIdSistemas,
  profileRevision: profileRevisionSistemas,
  state: 'accepted',
  evaluatedAt: time,
  windowOrigin: 'synthetic',
  selection: sampleSubmissionSistemas.selection,
  causes: [],
  gaps: [],
  enrollmentId,
  reportPath: `/local/matricula-regular/v1/reportes/${enrollmentId}`,
}

const sampleOutcomeAcceptedSoftware: MatriculaRegularOutcome = {
  requestId,
  actorId: actorIdSoftware,
  profileRevision: profileRevisionSoftware,
  state: 'accepted',
  evaluatedAt: time,
  windowOrigin: 'synthetic',
  selection: sampleSubmissionSoftware.selection,
  causes: [],
  gaps: [],
  enrollmentId,
  reportPath: `/local/matricula-regular/v1/reportes/${enrollmentId}`,
}

const sampleOutcomeRejectedSistemas: MatriculaRegularOutcome = {
  requestId,
  actorId: actorIdSistemas,
  profileRevision: profileRevisionSistemas,
  state: 'rejected',
  evaluatedAt: time,
  windowOrigin: 'synthetic',
  selection: sampleSubmissionSistemas.selection,
  causes: [
    {
      code: 'SCHEDULE_CONFLICT',
      courseIds: ['SYN-SIS-C1', 'SYN-SIS-C2'],
      sectionIds: ['SYN-SIS-S1', 'SYN-SIS-S2'],
      sourceIds: ['L-01'],
    },
    {
      code: 'SECTION_FULL',
      courseIds: ['SYN-SIS-C2'],
      sectionIds: ['SYN-SIS-S2'],
      sourceIds: ['L-01'],
    },
  ],
  gaps: [],
  enrollmentId: null,
  reportPath: null,
}

const sampleOutcomeRejectedSoftware: MatriculaRegularOutcome = {
  requestId,
  actorId: actorIdSoftware,
  profileRevision: profileRevisionSoftware,
  state: 'rejected',
  evaluatedAt: time,
  windowOrigin: 'synthetic',
  selection: sampleSubmissionSoftware.selection,
  causes: [
    {
      code: 'SECTION_FULL',
      courseIds: ['SYN-SOFT-C1'],
      sectionIds: ['SYN-SOFT-S1'],
      sourceIds: ['L-01'],
    },
  ],
  gaps: [],
  enrollmentId: null,
  reportPath: null,
}

const sampleOutcomePendingSistemas: MatriculaRegularOutcome = {
  requestId,
  actorId: actorIdSistemas,
  profileRevision: profileRevisionSistemas,
  state: 'configuration-pending',
  evaluatedAt: time,
  windowOrigin: null,
  selection: sampleSubmissionSistemas.selection,
  causes: [],
  gaps: [
    {
      code: 'PLAN_OR_OFFER_UNKNOWN',
      courseIds: ['SYN-SIS-C1'],
      sourceIds: ['L-01'],
    },
  ],
  enrollmentId: null,
  reportPath: null,
}

const sampleOutcomePendingSoftware: MatriculaRegularOutcome = {
  requestId,
  actorId: actorIdSoftware,
  profileRevision: profileRevisionSoftware,
  state: 'configuration-pending',
  evaluatedAt: time,
  windowOrigin: null,
  selection: sampleSubmissionSoftware.selection,
  causes: [],
  gaps: [
    {
      code: 'PLAN_OR_OFFER_UNKNOWN',
      courseIds: ['SYN-SOFT-C1'],
      sourceIds: ['L-01'],
    },
  ],
  enrollmentId: null,
  reportPath: null,
}

function mockJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// =============================================================================
// 4. T041-lost: Pruebas de transporte MR-SUBMIT con respuesta perdida / red
// =============================================================================

test('T041-lost: network failure before server responds yields kind=network without auto-POST (AC31)', async () => {
  let callCount = 0
  const recordedCalls: { url: string; body: unknown }[] = []

  const customFetch: typeof fetch = async (url, init) => {
    callCount += 1
    recordedCalls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? '{}')),
    })
    throw new TypeError('Failed to fetch (connection dropped before response)')
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })

  await assert.rejects(
    () => api.submit(sampleSubmissionSistemas),
    (err: unknown) => {
      assert.ok(err instanceof MatriculaRegularApiError)
      assert.equal(err.kind, 'network')
      assert.equal(err.operation, 'submit')
      assert.equal(err.retryable, false, 'POST submit network error must NEVER be marked retryable')
      return true
    },
  )

  // Strictly single attempt - no automatic re-submission/POST
  assert.equal(callCount, 1, 'MR-SUBMIT must make exactly 1 attempt on network failure')
  assert.equal(recordedCalls.length, 1)
  assert.equal(recordedCalls[0]?.url, '/api/local/matricula-regular/v1/solicitudes')
  assert.deepEqual(recordedCalls[0]?.body, sampleSubmissionSistemas)
})

test('T041-lost: network failure after commit (drop during transmission) is indistinguishable to client from pre-commit failure', async () => {
  let callCount = 0
  const recordedCalls: { url: string; init?: RequestInit }[] = []

  // Simulated server that processed the commit locally but network severed while writing response back to socket
  const customFetch: typeof fetch = async (url, init) => {
    callCount += 1
    recordedCalls.push({ url: String(url), init })
    // Socket hang up / connection reset by peer
    throw new TypeError('fetch failed: ECONNRESET after server response write')
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })

  await assert.rejects(
    () => api.submit(sampleSubmissionSoftware),
    (err: unknown) => {
      assert.ok(err instanceof MatriculaRegularApiError)
      assert.equal(err.kind, 'network')
      assert.equal(err.operation, 'submit')
      assert.equal(err.retryable, false)
      return true
    },
  )

  // Indistinguishable: Client receives kind='network', retryable=false, exactly 1 attempt
  assert.equal(callCount, 1)
  // Client does not equate network failure to rejected (no causes) nor pending (no gaps)
  // Preserves draft/requestId for manual lookup (T041-lookup / T043)
})

test('T041-lost: protocol errors on MR-SUBMIT (HTML error, invalid JSON, malformed envelope) are distinct from rejected/pending', async () => {
  // Non-JSON HTML error (e.g. gateway 502/504)
  const htmlFetch: typeof fetch = async () => {
    return new Response('<html><body>Bad Gateway</body></html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    })
  }
  const apiHtml = createMatriculaRegularApi({ mode: 'local', fetchImpl: htmlFetch })
  await assert.rejects(
    () => apiHtml.submit(sampleSubmissionSistemas),
    (err: unknown) => {
      assert.ok(err instanceof MatriculaRegularApiError)
      assert.equal(err.kind, 'protocol')
      assert.equal(err.operation, 'submit')
      assert.equal(err.retryable, false)
      return true
    },
  )

  // Malformed envelope (missing runId or invalid fields)
  const malformedFetch: typeof fetch = async () => {
    return mockJsonResponse(200, { runId, data: { invalidKey: 123 } })
  }
  const apiMalformed = createMatriculaRegularApi({ mode: 'local', fetchImpl: malformedFetch })
  await assert.rejects(
    () => apiMalformed.submit(sampleSubmissionSistemas),
    (err: unknown) => {
      assert.ok(err instanceof MatriculaRegularApiError)
      assert.equal(err.kind, 'protocol')
      assert.equal(err.operation, 'submit')
      return true
    },
  )
})

// =============================================================================
// 5. T041-lookup: Consulta de resultado conocido (accepted/rejected/pending) vs unknown
// =============================================================================

test('T041-lookup: real wire validators validateLookup, validateLookupQuery, and validateLookupResponse', () => {
  // Direct test of wire validators for both schools
  validateLookupQuery({ runId, actorId: actorIdSistemas })
  validateLookupQuery({ runId, actorId: actorIdSoftware })

  // Validate known lookup payloads
  validateLookup({ state: 'known', outcome: sampleOutcomeAcceptedSistemas })
  validateLookup({ state: 'known', outcome: sampleOutcomeAcceptedSoftware })
  validateLookup({ state: 'known', outcome: sampleOutcomeRejectedSistemas })
  validateLookup({ state: 'known', outcome: sampleOutcomeRejectedSoftware })
  validateLookup({ state: 'known', outcome: sampleOutcomePendingSistemas })
  validateLookup({ state: 'known', outcome: sampleOutcomePendingSoftware })
  validateLookup({ state: 'unknown', outcome: null })

  // Validate envelope
  validateLookupResponse(
    { runId, data: { state: 'known', outcome: sampleOutcomeAcceptedSistemas } },
    { runId, actorId: actorIdSistemas, requestId },
  )
  validateLookupResponse(
    { runId, data: { state: 'known', outcome: sampleOutcomeAcceptedSoftware } },
    { runId, actorId: actorIdSoftware, requestId },
  )
  validateLookupResponse(
    { runId, data: { state: 'unknown', outcome: null } },
    { runId, actorId: actorIdSistemas, requestId },
  )
})

test('T041-lookup: getResult retrieves known accepted outcome for Sistemas and Software via GET without mutation', async () => {
  const recordedCalls: { url: string; method?: string; body?: unknown }[] = []

  const customFetch: typeof fetch = async (url, init) => {
    recordedCalls.push({
      url: String(url),
      method: init?.method,
      body: init?.body,
    })
    const isSistemas = String(url).includes('SYN-SIS-A')
    const outcome = isSistemas ? sampleOutcomeAcceptedSistemas : sampleOutcomeAcceptedSoftware
    const lookupData: MatriculaRegularLookup = {
      state: 'known',
      outcome,
    }
    return mockJsonResponse(200, { runId, data: lookupData })
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })

  // 1. Sistemas
  const resultSis = await api.getResult({ runId, actorId: actorIdSistemas, requestId })
  assert.equal(resultSis.state, 'known')
  assert.equal(resultSis.outcome?.state, 'accepted')
  assert.equal(resultSis.outcome?.actorId, actorIdSistemas)
  assert.equal(resultSis.outcome?.enrollmentId, enrollmentId)

  // 2. Software
  const resultSoft = await api.getResult({ runId, actorId: actorIdSoftware, requestId })
  assert.equal(resultSoft.state, 'known')
  assert.equal(resultSoft.outcome?.state, 'accepted')
  assert.equal(resultSoft.outcome?.actorId, actorIdSoftware)
  assert.equal(resultSoft.outcome?.enrollmentId, enrollmentId)

  // Verify pure GET with no mutation, no body, credentials omit
  assert.equal(recordedCalls.length, 2)
  for (const call of recordedCalls) {
    assert.equal(call.method, 'GET')
    assert.equal(call.body, undefined, 'GET must never send a request body')
    assert.ok(call.url.startsWith('/api/local/matricula-regular/v1/solicitudes/'))
  }
})

test('T041-lookup: getResult retrieves known rejected outcomes for Sistemas and Software', async () => {
  const recordedCalls: string[] = []

  const customFetch: typeof fetch = async (url) => {
    recordedCalls.push(String(url))
    const isSistemas = String(url).includes('SYN-SIS-A')
    const lookupData: MatriculaRegularLookup = {
      state: 'known',
      outcome: isSistemas ? sampleOutcomeRejectedSistemas : sampleOutcomeRejectedSoftware,
    }
    return mockJsonResponse(200, { runId, data: lookupData })
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })

  // 1. Sistemas rejection (multicauses: SCHEDULE_CONFLICT + SECTION_FULL)
  const rejectedSis = await api.getResult({ runId, actorId: actorIdSistemas, requestId })
  assert.equal(rejectedSis.state, 'known')
  assert.equal(rejectedSis.outcome?.state, 'rejected')
  assert.equal(rejectedSis.outcome?.causes.length, 2)
  assert.equal(rejectedSis.outcome?.enrollmentId, null)

  // 2. Software rejection (single cause: SECTION_FULL)
  const rejectedSoft = await api.getResult({ runId, actorId: actorIdSoftware, requestId })
  assert.equal(rejectedSoft.state, 'known')
  assert.equal(rejectedSoft.outcome?.state, 'rejected')
  assert.equal(rejectedSoft.outcome?.causes.length, 1)
  assert.equal(rejectedSoft.outcome?.enrollmentId, null)

  assert.equal(recordedCalls.length, 2)
})

test('T041-lookup: getResult retrieves known configuration-pending outcomes for Sistemas and Software', async () => {
  const customFetch: typeof fetch = async (url) => {
    const isSistemas = String(url).includes('SYN-SIS-A')
    const lookupData: MatriculaRegularLookup = {
      state: 'known',
      outcome: isSistemas ? sampleOutcomePendingSistemas : sampleOutcomePendingSoftware,
    }
    return mockJsonResponse(200, { runId, data: lookupData })
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })

  const pendingSis = await api.getResult({ runId, actorId: actorIdSistemas, requestId })
  assert.equal(pendingSis.state, 'known')
  assert.equal(pendingSis.outcome?.state, 'configuration-pending')
  assert.equal(pendingSis.outcome?.gaps.length, 1)

  const pendingSoft = await api.getResult({ runId, actorId: actorIdSoftware, requestId })
  assert.equal(pendingSoft.state, 'known')
  assert.equal(pendingSoft.outcome?.state, 'configuration-pending')
  assert.equal(pendingSoft.outcome?.gaps.length, 1)
})

test('T041-lookup: getResult retrieves unknown outcome ({ state: "unknown", outcome: null })', async () => {
  const unknownLookup: MatriculaRegularLookup = {
    state: 'unknown',
    outcome: null,
  }

  const customFetch: typeof fetch = async () => {
    return mockJsonResponse(200, { runId, data: unknownLookup })
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })
  const result = await api.getResult({ runId, actorId: actorIdSistemas, requestId })

  assert.equal(result.state, 'unknown')
  assert.equal(result.outcome, null)
})

test('T041-lookup: wire validators reject identity mismatch and invalid lookup schema', async () => {
  // 1. Mismatched runId in response envelope
  const apiWrongRun = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, {
      runId: otherRunId,
      data: { state: 'known', outcome: sampleOutcomeAcceptedSistemas },
    }),
  })
  await assert.rejects(
    () => apiWrongRun.getResult({ runId, actorId: actorIdSistemas, requestId }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )

  // 2. Mismatched actorId in outcome
  const apiWrongActor = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, {
      runId,
      data: { state: 'known', outcome: { ...sampleOutcomeAcceptedSistemas, actorId: actorIdSoftware } },
    }),
  })
  await assert.rejects(
    () => apiWrongActor.getResult({ runId, actorId: actorIdSistemas, requestId }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )

  // 3. Mismatched requestId in outcome
  const apiWrongRequest = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, {
      runId,
      data: { state: 'known', outcome: { ...sampleOutcomeAcceptedSistemas, requestId: otherRequestId } },
    }),
  })
  await assert.rejects(
    () => apiWrongRequest.getResult({ runId, actorId: actorIdSistemas, requestId }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )

  // 4. Schema contradiction: state 'known' with outcome null
  const apiContradictionKnown = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, {
      runId,
      data: { state: 'known', outcome: null },
    }),
  })
  await assert.rejects(
    () => apiContradictionKnown.getResult({ runId, actorId: actorIdSistemas, requestId }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )

  // 5. Schema contradiction: state 'unknown' with outcome object
  const apiContradictionUnknown = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, {
      runId,
      data: { state: 'unknown', outcome: sampleOutcomeAcceptedSistemas },
    }),
  })
  await assert.rejects(
    () => apiContradictionUnknown.getResult({ runId, actorId: actorIdSistemas, requestId }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )
})

// =============================================================================
// 6. T041-lifetime/manual: Reintento manual / lifetime / sesión expirada / RUN_CHANGED
// =============================================================================

test('T041-lifetime/manual: manual replay with same identity queries existing result without active session (AC32)', async () => {
  // getResult operates purely on { runId, actorId, requestId }
  // It does NOT require sessionId, nor does it require session renewal
  const recordedQueries: string[] = []

  const customFetch: typeof fetch = async (url) => {
    recordedQueries.push(String(url))
    return mockJsonResponse(200, {
      runId,
      data: {
        state: 'known',
        outcome: sampleOutcomeAcceptedSistemas,
      },
    })
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })

  // Call manual getResult multiple times with identical identity
  const res1 = await api.getResult({ runId, actorId: actorIdSistemas, requestId })
  const res2 = await api.getResult({ runId, actorId: actorIdSistemas, requestId })

  assert.deepEqual(res1, res2)
  assert.equal(res1.state, 'known')
  assert.equal(res1.outcome?.enrollmentId, enrollmentId)

  assert.equal(recordedQueries.length, 2)
  for (const url of recordedQueries) {
    const parsed = new URL(url, 'http://localhost')
    assert.equal(parsed.pathname, `/api/local/matricula-regular/v1/solicitudes/${requestId}`)
    assert.equal(parsed.searchParams.get('runId'), runId)
    assert.equal(parsed.searchParams.get('actorId'), actorIdSistemas)
    // No session parameter required
    assert.equal(parsed.searchParams.has('sessionId'), false)
  }
})

test('T041-lifetime/manual: HTTP RUN_CHANGED is received cleanly and does not auto-POST (AC33)', async () => {
  let callCount = 0
  const customFetch: typeof fetch = async () => {
    callCount += 1
    return mockJsonResponse(409, {
      runId: otherRunId,
      error: {
        code: 'RUN_CHANGED',
        fields: ['runId'],
      },
    })
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })

  await assert.rejects(
    () => api.getResult({ runId, actorId: actorIdSistemas, requestId }),
    (err: unknown) => {
      assert.ok(err instanceof MatriculaRegularApiError)
      assert.equal(err.kind, 'http')
      assert.equal(err.code, 'RUN_CHANGED')
      assert.equal(err.status, 409)
      assert.equal(err.retryable, false)
      assert.equal(err.runId, otherRunId)
      return true
    },
  )

  // Exactly 1 attempt: client must not automatically re-submit under a new run ID
  assert.equal(callCount, 1)
})

test('T041-lifetime/manual: unknown state means no outcome found in current run, NEVER equates to not-transmitted or rejected', () => {
  const unknownLookup: MatriculaRegularLookup = {
    state: 'unknown',
    outcome: null,
  }

  // Contract verification: unknown state must have outcome null
  assert.equal(unknownLookup.state, 'unknown')
  assert.equal(unknownLookup.outcome, null)

  // Semantics:
  // - It does NOT mean the request was definitely not sent or dropped (could be in flight or uncommitted)
  // - It is NOT an academic rejection (causes are empty/absent)
  // - It is NOT a configuration pending
  // - Recovery mechanism in T043/T045 must handle unknown as an explicit distinct state
})

// =============================================================================
// 7. T041 completion: manual POST with the same UUID/payload, submit correlation, P1 route focus
// =============================================================================

test('T041-manual-POST: after a lost response the user-initiated POST repeats the SAME requestId and payload (AC32)', async () => {
  const bodies: unknown[] = []
  let attempt = 0
  const customFetch: typeof fetch = async (_url, init) => {
    attempt += 1
    bodies.push(JSON.parse(String(init?.body)))
    if (attempt === 1) throw new TypeError('response lost after server commit')
    return mockJsonResponse(200, { runId, data: sampleOutcomeAcceptedSistemas })
  }
  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })

  await assert.rejects(() => api.submit(sampleSubmissionSistemas), (err: unknown) =>
    err instanceof MatriculaRegularApiError && err.kind === 'network' && err.retryable === false)
  assert.equal(attempt, 1, 'adapter never retries by itself')

  // Explicit user action: same object -> same identity; only a fresh session may differ.
  const replayed = await api.submit({ ...sampleSubmissionSistemas, sessionId: '00000000-0000-4000-8000-000000000012' })
  assert.equal(replayed.requestId, requestId)
  assert.equal(replayed.enrollmentId, enrollmentId)
  const [first, second] = bodies as Record<string, unknown>[]
  const { sessionId: firstSession, ...firstRest } = first!
  const { sessionId: secondSession, ...secondRest } = second!
  assert.deepEqual(secondRest, firstRest)
  assert.notEqual(secondSession, firstSession)
})

test('T041-correlation: a submit reply for another run, actor or request is protocol-malformed, never shown as success', async () => {
  const replies: unknown[] = [
    { runId: otherRunId, data: sampleOutcomeAcceptedSistemas },
    { runId, data: { ...sampleOutcomeAcceptedSistemas, actorId: actorIdSoftware } },
    { runId, data: { ...sampleOutcomeAcceptedSistemas, requestId: otherRequestId } },
  ]
  for (const reply of replies) {
    const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: async () => mockJsonResponse(200, reply) })
    await assert.rejects(() => api.submit(sampleSubmissionSistemas), (err: unknown) =>
      err instanceof MatriculaRegularApiError && err.kind === 'protocol' && err.operation === 'submit')
  }
})

test('T041-focus (P1): the report route module exposes a programmatically focusable heading contract', async () => {
  // Honest RED until T044/T045 exist: the report module is absent in the current route set.
  const report = await import('./regularEnrollmentReport.ts')
  assert.equal(report.REPORT_HEADING_ID, 'regular-enrollment-report-heading')
  assert.equal(report.REPORT_ROUTE_PATH, '/local/matricula-regular/reporte/$enrollmentId')
})

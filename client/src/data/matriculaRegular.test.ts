import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createMatriculaRegularApi,
  MatriculaRegularApiError,
} from './matriculaRegular.ts'
import type {
  MatriculaRegularUuid,
  MatriculaRegularId,
  MatriculaRegularChoice,
  MatriculaRegularContext,
  MatriculaRegularSession,
  MatriculaRegularOutcome,
  MatriculaRegularEnrollmentReport,
  MatriculaRegularSubmission,
} from '../../../shared/matricula-regular.mjs'

const runId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000001'
const otherRunId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000099'
const sessionId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000002'
const otherSessionId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000098'
const requestId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000003'
const otherRequestId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000097'
const enrollmentId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000004'
const otherEnrollmentId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000096'

const actorId: MatriculaRegularId = 'SYN-SIS-A'
const otherActorId: MatriculaRegularId = 'SYN-SOFT-A'

const scope: {
  facultyId: string
  schoolId: string
  period: string
  planId: MatriculaRegularId
  modality: 'regular-virtual'
} = {
  facultyId: 'FISI',
  schoolId: 'SISTEMAS',
  period: '2026-II',
  planId: 'SYN-SIS-PLAN',
  modality: 'regular-virtual',
}

const time = '2026-08-11T15:00:00.000Z'
const profileRevision = 'MR-SYN-SIS-1'

function createSyntheticContext(actor: MatriculaRegularId = actorId): MatriculaRegularContext {
  return {
    actorId: actor,
    scope,
    profileRevision,
    serverNow: time,
    preEnrollmentEnabled: true,
    preEnrollmentComplete: true,
    preEnrollment: [
      {
        courseId: 'SYN-SIS-C1',
        planId: 'SYN-SIS-PLAN',
        name: 'Asignatura sintética 1',
        credits: 4,
      },
    ],
    offerKnown: true,
    offer: [
      {
        courseId: 'SYN-SIS-C1',
        planId: 'SYN-SIS-PLAN',
        name: 'Asignatura sintética 1',
        credits: 4,
        prerequisiteIds: [],
        sections: [
          {
            sectionId: 'SYN-SIS-S1',
            capacity: 30,
            occupied: 10,
            schedule: [
              {
                day: 1,
                startMinute: 480,
                endMinute: 600,
              },
            ],
          },
        ],
      },
    ],
    calendar: {
      publishedRows: [],
      effectiveWindows: [
        {
          id: 'SYN-WINDOW-1',
          startsAt: '2026-08-11T14:00:00.000Z',
          endsAt: '2026-08-11T16:00:00.000Z',
          minPp: 0,
          origin: 'synthetic',
          sourceIds: ['DECISION-SYNTHETIC-WINDOW'],
        },
      ],
      unknownDates: [],
    },
    eligibility: {
      state: 'eligible',
      windowId: 'SYN-WINDOW-1',
      windowOrigin: 'synthetic',
      causes: [],
      gaps: [],
    },
    sources: [
      {
        id: 'DECISION-SYNTHETIC-WINDOW',
        origin: 'local-decision',
        class: null,
        reference: 'Ventana de prueba sintética para verificación local',
        date: '2026-08-11',
        status: 'local-only',
      },
    ],
  }
}

const syntheticSession: MatriculaRegularSession = {
  runId,
  actorId,
  sessionId,
  startedAt: time,
  expiresAt: '2026-08-11T15:15:00.000Z',
}

const syntheticSelection: MatriculaRegularChoice[] = [{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' }]

const syntheticOutcome: MatriculaRegularOutcome = {
  requestId,
  actorId,
  profileRevision,
  state: 'accepted',
  evaluatedAt: time,
  windowOrigin: 'synthetic',
  selection: syntheticSelection,
  causes: [],
  gaps: [],
  enrollmentId,
  reportPath: `/local/matricula-regular/v1/reportes/${enrollmentId}`,
}

const syntheticReport: MatriculaRegularEnrollmentReport = {
  enrollmentId,
  requestId,
  actorId,
  scope,
  profileRevision,
  acceptedAt: time,
  windowOrigin: 'synthetic',
  rows: [
    {
      courseId: 'SYN-SIS-C1',
      sectionId: 'SYN-SIS-S1',
      planId: scope.planId,
      name: 'Asignatura sintética 1',
      credits: 4,
      schedule: [
        {
          day: 1,
          startMinute: 480,
          endMinute: 600,
        },
      ],
    },
  ],
  totalCredits: 4,
}

function mockJsonResponse(status: number, data: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

test('createMatriculaRegularApi configuration rejects non-local modes', () => {
  assert.throws(
    () => createMatriculaRegularApi({ mode: 'mock' }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'configuration',
  )
  assert.throws(
    () => createMatriculaRegularApi({ mode: 'remote' }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'configuration',
  )
})

test('six operations execute with exact methods, paths, credentials omit and body rules', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const expectedResponses = [
    createSyntheticContext(),
    syntheticSession,
    syntheticSession,
    syntheticOutcome,
    { state: 'known', outcome: syntheticOutcome },
    syntheticReport,
  ]

  const customFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return mockJsonResponse(200, { runId, data: expectedResponses[calls.length - 1] })
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })

  const contextRes = await api.getContext(actorId)
  assert.deepEqual(contextRes, { runId, data: createSyntheticContext() })

  const sessionRes = await api.createSession({ runId, actorId })
  assert.deepEqual(sessionRes, syntheticSession)

  const renewRes = await api.renewSession(sessionId, { runId, actorId })
  assert.deepEqual(renewRes, syntheticSession)

  const submission: MatriculaRegularSubmission = {
    runId,
    actorId,
    sessionId,
    requestId,
    profileRevision,
    selection: syntheticSelection,
  }
  const submitRes = await api.submit(submission)
  assert.deepEqual(submitRes, syntheticOutcome)

  const lookupRes = await api.getResult({ runId, actorId, requestId })
  assert.deepEqual(lookupRes, { state: 'known', outcome: syntheticOutcome })

  const reportRes = await api.getReport({ runId, actorId, enrollmentId, requestId })
  assert.deepEqual(reportRes, syntheticReport)

  assert.equal(calls.length, 6)
  assert.deepEqual(calls.map((c) => c.init?.method), ['GET', 'POST', 'POST', 'POST', 'GET', 'GET'])
  assert.ok(calls.every((c) => c.url.startsWith('/api/local/matricula-regular/v1/') && c.init?.credentials === 'omit'))
  assert.ok(calls.filter((c) => c.init?.method === 'GET').every((c) => !Object.hasOwn(c.init ?? {}, 'body')))
  assert.equal((calls[0].init?.headers as Record<string, string>)?.Accept, 'application/json')
  assert.equal((calls[1].init?.headers as Record<string, string>)?.['Content-Type'], 'application/json')
})

test('session response correlation rejects mismatched actorId or sessionId', async () => {
  const mismatchedActorSession = { ...syntheticSession, actorId: otherActorId }
  const apiActor = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, { runId, data: mismatchedActorSession }),
  })
  await assert.rejects(
    () => apiActor.createSession({ runId, actorId }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )

  const mismatchedSessionId = { ...syntheticSession, sessionId: otherSessionId }
  const apiSession = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, { runId, data: mismatchedSessionId }),
  })
  await assert.rejects(
    () => apiSession.renewSession(sessionId, { runId, actorId }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )
})

test('submit response correlation rejects mismatched actorId, requestId or runId', async () => {
  const submission: MatriculaRegularSubmission = {
    runId,
    actorId,
    sessionId,
    requestId,
    profileRevision,
    selection: syntheticSelection,
  }

  const mismatchedOutcomeActor = { ...syntheticOutcome, actorId: otherActorId }
  const apiActor = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, { runId, data: mismatchedOutcomeActor }),
  })
  await assert.rejects(
    () => apiActor.submit(submission),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )

  const mismatchedOutcomeRequest = { ...syntheticOutcome, requestId: otherRequestId }
  const apiRequest = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, { runId, data: mismatchedOutcomeRequest }),
  })
  await assert.rejects(
    () => apiRequest.submit(submission),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )

  const apiRun = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, { runId: otherRunId, data: syntheticOutcome }),
  })
  await assert.rejects(
    () => apiRun.submit(submission),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )
})

test('result and report correlation rejects foreign actorId, requestId or enrollmentId', async () => {
  const foreignResult = {
    state: 'known',
    outcome: { ...syntheticOutcome, actorId: otherActorId },
  }
  const apiResult = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, { runId, data: foreignResult }),
  })
  await assert.rejects(
    () => apiResult.getResult({ runId, actorId, requestId }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )

  const foreignReportActor = { ...syntheticReport, actorId: otherActorId }
  const apiReportActor = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, { runId, data: foreignReportActor }),
  })
  await assert.rejects(
    () => apiReportActor.getReport({ runId, actorId, enrollmentId, requestId }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )

  const foreignReportEnrollment = { ...syntheticReport, enrollmentId: otherEnrollmentId }
  const apiReportEnrollment = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, { runId, data: foreignReportEnrollment }),
  })
  await assert.rejects(
    () => apiReportEnrollment.getReport({ runId, actorId, enrollmentId, requestId }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol',
  )
})

test('POST failure and network error on write execute single attempt without retryable/replay', async () => {
  let attempts = 0
  const submission: MatriculaRegularSubmission = {
    runId,
    actorId,
    sessionId,
    requestId,
    profileRevision,
    selection: syntheticSelection,
  }

  const customFetch: typeof fetch = async () => {
    attempts += 1
    throw new TypeError('Network connection lost during POST')
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })
  await assert.rejects(
    () => api.submit(submission),
    (err: unknown) => {
      assert.ok(err instanceof MatriculaRegularApiError)
      assert.equal(err.kind, 'network')
      assert.equal(err.retryable, false)
      return true
    },
  )
  assert.equal(attempts, 1)
})

test('GET network failure is marked retryable=true with single attempt without automatic retry', async () => {
  let attempts = 0
  const customFetch: typeof fetch = async () => {
    attempts += 1
    throw new TypeError('Connection reset')
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })
  await assert.rejects(
    () => api.getContext(actorId),
    (err: unknown) => {
      assert.ok(err instanceof MatriculaRegularApiError)
      assert.equal(err.kind, 'network')
      assert.equal(err.retryable, true)
      return true
    },
  )
  assert.equal(attempts, 1)
})

test('aborted request stops cleanly with kind=aborted and retryable=false', async () => {
  const controller = new AbortController()
  const customFetch: typeof fetch = async (_url, init) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'))
      })
    })
  }

  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl: customFetch })
  const promise = api.getContext(actorId, { signal: controller.signal })
  controller.abort()

  await assert.rejects(
    promise,
    (err: unknown) => {
      assert.ok(err instanceof MatriculaRegularApiError)
      assert.equal(err.kind, 'aborted')
      assert.equal(err.retryable, false)
      return true
    },
  )
})

test('malformed, extra keys, non-JSON or invalid status envelopes throw protocol errors', async () => {
  const apiNonJson = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => new Response('<html>Error</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
  })
  await assert.rejects(apiNonJson.getContext(actorId), (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol')

  const apiExtra = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, { runId, data: { ...createSyntheticContext(), unexpectedExtra: true } }),
  })
  await assert.rejects(apiExtra.getContext(actorId), (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol')

  const apiMissing = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(200, { runId, data: { actorId } }),
  })
  await assert.rejects(apiMissing.getContext(actorId), (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'protocol')
})

test('HTTP errors preserve error response shape and RUN_CHANGED bypasses run comparison', async () => {
  const apiError = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(400, { runId, error: { code: 'PRE_ENROLLMENT_NOT_ENABLED', fields: ['actorId'] } }),
  })
  await assert.rejects(
    apiError.getContext(actorId),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'http' && err.code === 'PRE_ENROLLMENT_NOT_ENABLED' && err.status === 400,
  )

  const apiRunChanged = createMatriculaRegularApi({
    mode: 'local',
    fetchImpl: async () => mockJsonResponse(409, { runId: otherRunId, error: { code: 'RUN_CHANGED', fields: [] } }),
  })
  await assert.rejects(
    apiRunChanged.getContext(actorId, { expectedRunId: runId }),
    (err: unknown) => err instanceof MatriculaRegularApiError && err.kind === 'http' && err.code === 'RUN_CHANGED' && err.status === 409,
  )
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { MatriculaRegularChoice, MatriculaRegularContext } from '../../../shared/matricula-regular.mjs'
import {
  acceptedOutcome,
  actorSis,
  actorSoft,
  errorResponse,
  jsonResponse,
  otherRunId,
  pendingOutcome,
  recordingFetch,
  rejectedOutcome,
  revisionSis,
  runId,
  sessionId,
  syntheticContext,
} from '../../tests/fixtures/matriculaRegularKit.ts'
import { createMatriculaRegularApi } from './matriculaRegular.ts'
import { createSubmissionFlow } from './matriculaRegularRecovery.ts'
import { chooseSection, summarizeSelection } from './sumEnrollmentTable.ts'
import {
  applyContextRefresh,
  formatDroppedSelectionNotice,
  isRecoverableBusinessRejection,
  reconcileSelectionWithContext,
  resolveProfileSnapshotTransition,
  resolveRejectionClose,
} from './enrollmentRejectionRecovery.ts'
import type { ProfileScopeIdentity } from './enrollmentRejectionRecovery.ts'

function operationalContext(overrides: Partial<MatriculaRegularContext> = {}): MatriculaRegularContext {
  const base = syntheticContext()
  const planId = base.scope.planId
  return syntheticContext({
    preEnrollment: [
      { courseId: 'SYN-SIS-C09', planId, name: 'Arquitectura de Computadoras', credits: 2 },
      { courseId: 'SYN-SIS-C10', planId, name: 'Sistemas Operativos', credits: 4 },
      { courseId: 'SYN-SIS-C11', planId, name: 'Base de Datos', credits: 3 },
      { courseId: 'SYN-SIS-C12', planId, name: 'Redes de Computadoras', credits: 3 },
    ],
    offer: [
      {
        courseId: 'SYN-SIS-C09', planId, name: 'Arquitectura de Computadoras', credits: 2, prerequisiteIds: [],
        sections: [{ sectionId: 'SYN-SIS-S01', label: '1', capacity: 40, occupied: 10, schedule: [{ day: 1, startMinute: 480, endMinute: 600 }] }],
      },
      {
        courseId: 'SYN-SIS-C10', planId, name: 'Sistemas Operativos', credits: 4, prerequisiteIds: [],
        sections: [{ sectionId: 'SYN-SIS-S01', label: '1', capacity: 40, occupied: 12, schedule: [{ day: 2, startMinute: 480, endMinute: 600 }] }],
      },
      {
        courseId: 'SYN-SIS-C11', planId, name: 'Base de Datos', credits: 3, prerequisiteIds: [],
        sections: [{ sectionId: 'SYN-SIS-S01', label: '1', capacity: 40, occupied: 8, schedule: [{ day: 3, startMinute: 480, endMinute: 600 }] }],
      },
      {
        courseId: 'SYN-SIS-C12', planId, name: 'Redes de Computadoras', credits: 3, prerequisiteIds: [],
        sections: [{ sectionId: 'SYN-SIS-S01', label: '1', capacity: 40, occupied: 5, schedule: [{ day: 4, startMinute: 480, endMinute: 600 }] }],
      },
    ],
    ...overrides,
  })
}

test('Ticket C regression (paso 18): CREDIT_LOAD_INVALID preserves selection on closeRejected and allows a new idempotent retry', async () => {
  const initialContext = operationalContext()
  let selection: MatriculaRegularChoice[] = chooseSection([], 'SYN-SIS-C09', 'SYN-SIS-S01')
  assert.equal(summarizeSelection(initialContext, selection).credits, 2)

  const creditRejected = rejectedOutcome({
    selection,
    causes: [{
      code: 'CREDIT_LOAD_INVALID',
      courseIds: ['SYN-SIS-C09'],
      sectionIds: ['SYN-SIS-S01'],
      sourceIds: ['CREDIT-LOAD', 'F1'],
    }],
  })

  const ids = ['00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102']
  const { fetchImpl, calls } = recordingFetch((call, index) => {
    const body = call.body as { requestId: string; selection: MatriculaRegularChoice[] }
    if (index === 0) {
      return jsonResponse(200, { runId, data: { ...creditRejected, requestId: body.requestId } })
    }
    return jsonResponse(200, {
      runId,
      data: acceptedOutcome({ requestId: body.requestId, selection: body.selection }),
    })
  })
  const flow = createSubmissionFlow({
    api: createMatriculaRegularApi({ mode: 'local', fetchImpl }),
    storage: null,
    newRequestId: () => ids.shift()!,
  })

  // 1. Submit 2 credits -> rejected with CREDIT_LOAD_INVALID
  const firstAttempt = await flow.submit({
    runId, actorId: actorSis, sessionId, profileRevision: revisionSis, selection,
  })
  assert.equal(firstAttempt.result.kind, 'outcome')
  if (firstAttempt.result.kind !== 'outcome') throw new Error('expected outcome')
  assert.equal(firstAttempt.result.outcome.state, 'rejected')
  assert.equal(isRecoverableBusinessRejection(firstAttempt.result.outcome), true)

  // 2. Close rejection dialog -> must keep SYN-SIS-C09 sec1 AND request context refresh
  const closed = resolveRejectionClose({
    outcome: firstAttempt.result.outcome,
    currentSelection: selection,
  })
  assert.equal(closed.shouldRefreshContext, true)
  assert.equal(closed.preserved, true)
  assert.deepEqual(closed.selection, [{ courseId: 'SYN-SIS-C09', sectionId: 'SYN-SIS-S01' }])

  // 3. Refreshed context with updated vacancies keeps C09 sec1
  const refreshed = applyContextRefresh({
    envelope: { runId, data: operationalContext() },
    currentSelection: closed.selection,
    expectedRunId: runId,
    expectedActorId: actorSis,
  })
  assert.equal(refreshed.accepted, true)
  selection = refreshed.reconciled.choices
  assert.deepEqual(selection, [{ courseId: 'SYN-SIS-C09', sectionId: 'SYN-SIS-S01' }])

  // 4. User completes to 12 credits without re-picking C09 and submits a NEW idempotent requestId
  selection = chooseSection(selection, 'SYN-SIS-C10', 'SYN-SIS-S01')
  selection = chooseSection(selection, 'SYN-SIS-C11', 'SYN-SIS-S01')
  selection = chooseSection(selection, 'SYN-SIS-C12', 'SYN-SIS-S01')
  assert.equal(summarizeSelection(initialContext, selection).credits, 12)

  const retryAttempt = await flow.submit({
    runId, actorId: actorSis, sessionId, profileRevision: revisionSis, selection,
  })
  assert.equal(retryAttempt.result.kind, 'outcome')
  if (retryAttempt.result.kind === 'outcome') {
    assert.equal(retryAttempt.result.outcome.state, 'accepted')
  }
  assert.equal(calls.length, 2, 'manual retry only, never auto-retry')
  assert.notEqual(
    (calls[0]!.body as { requestId: string }).requestId,
    (calls[1]!.body as { requestId: string }).requestId,
    'new attempt after rejection uses a fresh requestId',
  )
})

test('Ticket C: SCHEDULE_CONFLICT and SECTION_FULL are recoverable; ALREADY_ENROLLED and OUTSIDE_WINDOW clear selection', () => {
  const selection: MatriculaRegularChoice[] = [
    { courseId: 'SYN-SIS-C09', sectionId: 'SYN-SIS-S01' },
    { courseId: 'SYN-SIS-C10', sectionId: 'SYN-SIS-S01' },
  ]
  for (const code of ['SCHEDULE_CONFLICT', 'SECTION_FULL'] as const) {
    const outcome = rejectedOutcome({
      selection,
      causes: [{ code, courseIds: ['SYN-SIS-C09'], sectionIds: ['SYN-SIS-S01'], sourceIds: ['L-01'] }],
    })
    const closed = resolveRejectionClose({ outcome, currentSelection: selection })
    assert.equal(closed.preserved, true, code)
    assert.deepEqual(closed.selection, selection, code)
    assert.equal(closed.shouldRefreshContext, true, code)
  }

  for (const code of ['ALREADY_ENROLLED', 'OUTSIDE_WINDOW', 'ACADEMIC_INELIGIBILITY'] as const) {
    const outcome = rejectedOutcome({
      selection,
      causes: [{ code, courseIds: [], sectionIds: [], sourceIds: ['L-01'] }],
    })
    const closed = resolveRejectionClose({ outcome, currentSelection: selection })
    assert.equal(closed.preserved, false, code)
    assert.deepEqual(closed.selection, [], code)
    assert.equal(closed.shouldRefreshContext, true, code)
  }
})

test('Ticket C: context refresh filters removed courses or sections and clears when context becomes ineligible or incomplete', () => {
  const initialSelection: MatriculaRegularChoice[] = [
    { courseId: 'SYN-SIS-C09', sectionId: 'SYN-SIS-S01' },
    { courseId: 'SYN-SIS-C10', sectionId: 'SYN-SIS-S01' },
  ]

  // Remove SYN-SIS-C10 from offer and SYN-SIS-S01 from C09? Keep C09 S01, remove C10.
  const base = operationalContext()
  const changedOfferContext = operationalContext({
    offer: base.offer.filter((course) => course.courseId !== 'SYN-SIS-C10'),
  })
  const filtered = reconcileSelectionWithContext(initialSelection, changedOfferContext)
  assert.deepEqual(filtered.choices, [{ courseId: 'SYN-SIS-C09', sectionId: 'SYN-SIS-S01' }])
  assert.deepEqual(filtered.droppedChoices, [{ courseId: 'SYN-SIS-C10', sectionId: 'SYN-SIS-S01' }])
  assert.equal(filtered.clearedReason, 'stale-offer')
  assert.ok(formatDroppedSelectionNotice(filtered)?.includes('no están disponibles'))

  // Remove section SYN-SIS-S01 from SYN-SIS-C09 (replaced by SYN-SIS-S02)
  const changedSectionContext = operationalContext({
    offer: base.offer.map((course) =>
      course.courseId === 'SYN-SIS-C09'
        ? { ...course, sections: [{ ...course.sections[0]!, sectionId: 'SYN-SIS-S02', label: '2' }] }
        : course,
    ),
  })
  const sectionFiltered = reconcileSelectionWithContext(initialSelection, changedSectionContext)
  assert.deepEqual(sectionFiltered.choices, [{ courseId: 'SYN-SIS-C10', sectionId: 'SYN-SIS-S01' }])
  assert.deepEqual(sectionFiltered.droppedChoices, [{ courseId: 'SYN-SIS-C09', sectionId: 'SYN-SIS-S01' }])

  // Context becomes ineligible -> clears all
  const ineligibleContext = operationalContext({
    eligibility: {
      state: 'ineligible',
      windowId: null,
      windowOrigin: null,
      causes: [{ code: 'OUTSIDE_WINDOW', courseIds: [], sectionIds: [], sourceIds: ['L-01'] }],
      gaps: [],
    },
  })
  const ineligibleResult = reconcileSelectionWithContext(initialSelection, ineligibleContext)
  assert.deepEqual(ineligibleResult.choices, [])
  assert.equal(ineligibleResult.clearedReason, 'ineligible')
})

test('Ticket C: actor change, run change, or session expiration transitions reset/expire properly without mixing runs or actors', () => {
  const activeSisA: ProfileScopeIdentity = {
    status: 'active', runId, actorId: actorSis, sessionId, generation: 1,
  }
  // Session renew keeps same runId/actorId/generation -> unchanged
  assert.equal(resolveProfileSnapshotTransition(activeSisA, { ...activeSisA }), 'unchanged')
  // Session expires -> expired
  assert.equal(resolveProfileSnapshotTransition(activeSisA, { ...activeSisA, status: 'expired' }), 'expired')
  // Actor change -> reset
  assert.equal(
    resolveProfileSnapshotTransition(activeSisA, { ...activeSisA, actorId: actorSoft, generation: 2 }),
    'reset',
  )
  // Run change -> reset
  assert.equal(
    resolveProfileSnapshotTransition(activeSisA, { ...activeSisA, runId: otherRunId, generation: 2 }),
    'reset',
  )
  // Stale envelope from another run/actor is rejected
  const staleEnvelope = applyContextRefresh({
    envelope: { runId: otherRunId, data: operationalContext() },
    currentSelection: [{ courseId: 'SYN-SIS-C09', sectionId: 'SYN-SIS-S01' }],
    expectedRunId: runId,
    expectedActorId: actorSis,
  })
  assert.equal(staleEnvelope.accepted, false)
})

test('Ticket C: accepted outcome remains immutable and uncertain/configuration-pending are never treated as definitive rejection', () => {
  const selection: MatriculaRegularChoice[] = [{ courseId: 'SYN-SIS-C09', sectionId: 'SYN-SIS-S01' }]
  const accepted = acceptedOutcome({ selection })
  assert.equal(isRecoverableBusinessRejection(accepted), false)
  const afterAccepted = resolveRejectionClose({ outcome: accepted, currentSelection: selection })
  assert.equal(afterAccepted.shouldRefreshContext, false)
  assert.deepEqual(afterAccepted.selection, selection)

  const pending = pendingOutcome({ selection })
  assert.equal(isRecoverableBusinessRejection(pending), false)
  const afterPending = resolveRejectionClose({ outcome: pending, currentSelection: selection })
  assert.equal(afterPending.shouldRefreshContext, false)
  assert.deepEqual(afterPending.selection, selection)

  // Reload + consult/replay recoverable rejection recovers selection from outcome.selection when currentSelection is []
  const reloadedRejected = rejectedOutcome({
    selection,
    causes: [{ code: 'CREDIT_LOAD_INVALID', courseIds: ['SYN-SIS-C09'], sectionIds: ['SYN-SIS-S01'], sourceIds: ['CREDIT-LOAD'] }],
  })
  const recoveredAfterReload = resolveRejectionClose({ outcome: reloadedRejected, currentSelection: [] })
  assert.equal(recoveredAfterReload.preserved, true)
  assert.deepEqual(recoveredAfterReload.selection, selection)
})

test('Ticket C: uncertain transport failure and consult unknown are never treated as rejection; manual replay keeps requestId and preserves selection on recoverable rejection', async () => {
  const selection: MatriculaRegularChoice[] = [{ courseId: 'SYN-SIS-C09', sectionId: 'SYN-SIS-S01' }]
  const firstId = '00000000-0000-4000-8000-000000000201'
  const requestIds = [firstId, '00000000-0000-4000-8000-000000000202']
  let postCount = 0
  const { fetchImpl, calls } = recordingFetch((call) => {
    if (call.method === 'POST') {
      postCount += 1
      const body = call.body as { requestId: string }
      if (postCount === 1) {
        return errorResponse(503, 'LOCAL_FAILURE')
      }
      return jsonResponse(200, {
        runId,
        data: rejectedOutcome({
          requestId: body.requestId,
          selection,
          causes: [{ code: 'CREDIT_LOAD_INVALID', courseIds: ['SYN-SIS-C09'], sectionIds: ['SYN-SIS-S01'], sourceIds: ['CREDIT-LOAD'] }],
        }),
      })
    }
    return jsonResponse(200, {
      runId,
      data: { state: 'unknown', outcome: null },
    })
  })

  const flow = createSubmissionFlow({
    api: createMatriculaRegularApi({ mode: 'local', fetchImpl }),
    storage: null,
    newRequestId: () => requestIds.shift()!,
  })

  // 1. Submit hits LOCAL_FAILURE -> uncertain (not a rejection)
  const firstAttempt = await flow.submit({
    runId, actorId: actorSis, sessionId, profileRevision: revisionSis, selection,
  })
  assert.equal(firstAttempt.result.kind, 'uncertain')
  assert.equal(firstAttempt.intent.requestId, firstId)

  // 2. Consult returns unknown -> still not treated as rejection; selection stays intact in intent
  const consultResult = await flow.consult({ intent: firstAttempt.intent })
  assert.equal(consultResult.kind, 'unknown')
  assert.deepEqual(firstAttempt.intent.selection, selection)

  // 3. Manual replay reuses the exact same requestId, receives CREDIT_LOAD_INVALID, and closing preserves selection
  const replayAttempt = await flow.replay({ intent: firstAttempt.intent, sessionId })
  assert.equal(replayAttempt.result.kind, 'outcome')
  if (replayAttempt.result.kind !== 'outcome') throw new Error('expected outcome')
  assert.equal(replayAttempt.result.outcome.state, 'rejected')
  assert.equal(replayAttempt.result.outcome.requestId, firstAttempt.intent.requestId)

  const closed = resolveRejectionClose({
    outcome: replayAttempt.result.outcome,
    currentSelection: selection,
  })
  assert.equal(closed.preserved, true)
  assert.equal(closed.shouldRefreshContext, true)
  assert.deepEqual(closed.selection, selection)
  assert.equal(calls.filter((c) => c.method === 'POST').length, 2)
  assert.equal(
    (calls[0]!.body as { requestId: string }).requestId,
    (calls[2]!.body as { requestId: string }).requestId,
  )
})


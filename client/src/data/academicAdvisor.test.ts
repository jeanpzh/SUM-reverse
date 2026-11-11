import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PLANNING_LIMITS } from '../../../shared/academic-planning-policy.mjs'
import { ACADEMIC_API } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicAdvisorResponse } from './academicScheduling.ts'
import { defaultAcademicAdvisorSelection, fetchAcademicProposalAdvice, hasCurrentAdvisorImpact } from './academicScheduling.ts'
import { createPlanningSession, initialPlanningSessionState, reducePlanningSession } from './planningSession.ts'

// Independently constructed synthetic advisor records. No services or private datasets.
const advice: AcademicAdvisorResponse = {
  proposalId: 'synthetic-proposal', editVersion: 2,
  source: { mode: 'deterministic-fallback', providerLabel: null, fallbackReason: 'not_configured' },
  summary: '**Análisis sintético**', bottlenecks: [],
  recommendations: [{ id: 'enable-afternoon', title: 'Habilitar tardes', rationale: 'Más franjas disponibles',
    impactSummary: 'Más alternativas', recommendedByDefault: true,
    patch: { kind: 'enable_planning_window', allowAfternoon: true } }],
  verifiedImpact: { currentScheduledSessions: 0, projectedScheduledSessions: 1, requiredSessions: 1,
    currentCompleteSections: 0, projectedCompleteSections: 1, totalSections: 1,
    recommendationIds: ['enable-afternoon'], solverStatus: 'complete' },
  reasoningSteps: [{ toolName: 'simulate_patches_cpsat', inputSummary: 'Un parche sintético', outputSummary: 'Una sección completa' }],
}

function fakeFetch(response: unknown, inspect?: (url: string, init?: RequestInit) => void): typeof fetch {
  return async (input, init) => {
    inspect?.(String(input), init)
    return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
}

test('advisor uses existing route and distinguishes omitted selection from empty selection', async () => {
  for (const selected of [undefined, [], ['enable-afternoon']]) {
    await fetchAcademicProposalAdvice(advice.proposalId, 2, fakeFetch(advice, (url, init) => {
      assert.equal(url, `${ACADEMIC_API}/propuestas/synthetic-proposal/consejero`)
      assert.equal(init?.method, 'POST')
      assert.equal(init?.credentials, 'omit')
      const body = JSON.parse(String(init?.body))
      assert.deepEqual(body, selected === undefined ? { expectedEditVersion: 2 }
        : { expectedEditVersion: 2, selectedRecommendationIds: selected })
    }), undefined, selected)
  }
})

test('advisor rejects stale versions, different proposals and malformed impact at the data boundary', async () => {
  for (const response of [{ ...advice, editVersion: 1 }, { ...advice, proposalId: 'other-synthetic' },
    { ...advice, verifiedImpact: { ...advice.verifiedImpact, projectedCompleteSections: -1 } }]) {
    await assert.rejects(fetchAcademicProposalAdvice(advice.proposalId, 2, fakeFetch(response)))
  }
})

test('verified preview requires exact selected IDs and current proposal version; legacy response has no preview', () => {
  assert.equal(hasCurrentAdvisorImpact(advice, advice.proposalId, 2, ['enable-afternoon']), true)
  for (const ids of [[], ['other'], ['enable-afternoon', 'other'], ['enable-afternoon', 'enable-afternoon']]) {
    assert.equal(hasCurrentAdvisorImpact(advice, advice.proposalId, 2, ids), false)
  }
  assert.equal(hasCurrentAdvisorImpact(advice, advice.proposalId, 3, ['enable-afternoon']), false)
  assert.equal(hasCurrentAdvisorImpact(advice, 'other', 2, ['enable-afternoon']), false)
  assert.equal(hasCurrentAdvisorImpact({ ...advice, verifiedImpact: undefined }, advice.proposalId, 2, ['enable-afternoon']), false)
  assert.equal(hasCurrentAdvisorImpact(null, advice.proposalId, 2, []), false)
})

test('advisor preview respects abort signal and does not turn transport failure into fallback success', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(fetchAcademicProposalAdvice(advice.proposalId, 2, async (_input, init) => {
    assert.equal(init?.signal, controller.signal)
    throw new DOMException('Cancelled', 'AbortError')
  }, controller.signal), { name: 'AbortError' })
})

test('stale advisor application is rejected before mutating workspace or invoking generation', async () => {
  const session = createPlanningSession()
  const before = session.getState()
  await assert.rejects(session.commands.applyAdvisorPatchesAndRegenerate([advice.recommendations[0].patch],
    { proposalId: advice.proposalId, editVersion: 2 }), /propuesta cambió/)
  assert.equal(session.getState(), before)
  session.dispose()
})

test('preparation keeps cold selection empty and selects the current catalog without sending requests', () => {
  const catalog = { revision: 'PA-DEMO-1', courses: [1, 2, 3].map((n) => ({
    courseId: `SYN${n}`, name: `Curso sintético ${n}`, estimatedDemand: 20, targetCapacity: 20,
    weeklySessions: [{ id: `SYN${n}-T`, durationMinutes: 60 }],
  })), teachers: [], rooms: [], windows: [], startStepMinutes: 30, maxExplorations: 100 }
  const cold = reducePlanningSession(initialPlanningSessionState(), { type: 'catalog/succeeded', catalog })
  assert.deepEqual(cold.selectedCourses, [])
  const selected = reducePlanningSession(cold, { type: 'selectCourses', courseIds: catalog.courses.map((course) => course.courseId) })
  assert.deepEqual(selected.selectedCourses, ['SYN1', 'SYN2', 'SYN3'])
  assert.equal(selected.dirty, true)
  assert.equal(selected.proposal, null)
  assert.equal(selected.busy.generate, false)
})

test('current advisor patches update the local policy and regenerate once with synthetic resources', async () => {
  const catalog = { revision: 'PA-DEMO-1', courses: [], teachers: [], rooms: [], windows: [], startStepMinutes: 30, maxExplorations: 100 }
  const initial = reducePlanningSession(initialPlanningSessionState(), { type: 'catalog/succeeded', catalog })
  initial.proposal = {
    proposalId: advice.proposalId, editVersion: 2, createdAt: '2026-11-08T00:00:00.000Z', expiresAt: '2026-11-08T01:00:00.000Z',
    status: 'search-limit', sections: [], assignments: [], pending: [], diagnostics: [], coverageComplete: false,
    counts: { sections: 0, requiredSessions: 0, scheduledSessions: 0 },
    stats: { exploredCandidates: 0, candidateVisits: 0, backtracks: 0, limitReason: 'time' },
  }
  const nextProposal = { ...initial.proposal, proposalId: 'synthetic-regenerated' }
  let calls = 0
  const { defaultPlanningSessionClient } = await import('./planningSession.ts')
  const session = createPlanningSession({ ...defaultPlanningSessionClient, createProposal: async (request) => {
    calls++
    assert.equal(request.planningPolicy?.allowAfternoon, true)
    assert.deepEqual(request.resources, { teachers: [], rooms: [] })
    return nextProposal
  } }, initial)
  assert.equal(await session.commands.applyAdvisorPatchesAndRegenerate([advice.recommendations[0].patch],
    { proposalId: advice.proposalId, editVersion: 2 }), true)
  assert.equal(calls, 1)
  assert.equal(session.getState().policy?.allowAfternoon, true)
  assert.equal(session.getState().proposal, nextProposal)
  assert.equal(session.getState().advisorOutcome?.proposalId, nextProposal.proposalId)
  assert.equal(session.getState().advisorOutcome?.recommendationCount, 1)
  assert.equal(session.getState().dirty, true)
  const outcome = session.getState().advisorOutcome!
  session.commands.edit({ type: 'updateResources', value: { teachers: [], rooms: [] } })
  assert.equal(session.getState().advisorOutcome, null)
  assert.equal(reducePlanningSession(session.getState(), { type: 'advisor/applied', outcome }).advisorOutcome, null)
  session.dispose()
  const failed = createPlanningSession({ ...defaultPlanningSessionClient, createProposal: async () => { throw new Error('Synthetic regeneration failure') } }, initial)
  assert.equal(await failed.commands.applyAdvisorPatchesAndRegenerate([advice.recommendations[0].patch],
    { proposalId: advice.proposalId, editVersion: 2 }), false)
  assert.equal(failed.getState().advisorOutcome, null)
  assert.equal(failed.getState().proposal, null)
  assert.match(failed.getState().errors.proposal ?? '', /Synthetic regeneration failure/)
  failed.dispose()
})

test('non-policy advisor patches preserve an absent policy; explicit window patch creates one', () => {
  const before = { ...initialPlanningSessionState(), policy: null }
  const next = reducePlanningSession(before, { type: 'applyAdvisorPatches', patches: [
    { kind: 'change_delivery_mode', courseIds: ['SYN1'], deliveryMode: 'split' },
  ] })
  assert.equal(next.policy, null)
  assert.equal(next.deliveryModes.SYN1, 'split')
  const window = reducePlanningSession(before, { type: 'applyAdvisorPatches', patches: [
    { kind: 'enable_planning_window', allowSaturday: true },
  ] })
  assert.equal(window.policy?.allowSaturday, true)
  assert.equal(window.policy?.allowAfternoon, false)
})

test('teacher load increase is never selected by default even in a legacy response', () => {
  const legacy: AcademicAdvisorResponse = { ...advice, recommendations: [...advice.recommendations, {
    id: 'synthetic-load', title: 'Escenario sintético', rationale: 'Prueba', impactSummary: 'Prueba', recommendedByDefault: true,
    patch: { kind: 'increase_teacher_load', adjustments: [{ teacherId: 'SYN', previousMaxWeeklyMinutes: 60, nextMaxWeeklyMinutes: 120 }] },
  }] }
  assert.deepEqual(defaultAcademicAdvisorSelection(legacy), ['enable-afternoon'])
})

test('reference patches keep incomplete fields empty and reject duplicate/unknown references', () => {
  const state = { ...initialPlanningSessionState(), catalog: { revision: 'PA-DEMO-1', courses: [], teachers: [], rooms: [], windows: [], startStepMinutes: 30, maxExplorations: 1, referenceTeachers: [{ id: 'SYN-REF', name: 'Synthetic', courseIds: ['SYN'] }] } }
  const patch = { kind: 'incorporate_reference_resource' as const, teacherIds: ['SYN-REF'], roomIds: [] }
  const next = reducePlanningSession(state, { type: 'applyAdvisorPatches', patches: [patch] })
  assert.deepEqual(next.resources.teachers.find(t => t.id === 'SYN-REF'), { id: 'SYN-REF', name: 'Synthetic', courseIds: ['SYN'], maxWeeklyMinutes: 0, availability: [] })
  assert.equal(reducePlanningSession(next, { type: 'applyAdvisorPatches', patches: [patch] }).resources.teachers.filter(t => t.id === 'SYN-REF').length, 1)
  for (const ids of [['UNKNOWN'], ['SYN-REF', 'SYN-REF']]) assert.throws(() => reducePlanningSession(state, { type: 'applyAdvisorPatches', patches: [{ ...patch, teacherIds: ids }] }))
})
test('load patches respect exact configuration, period, duration and authorization', () => {
  const teacher = { id: 'SYN-T', name: 'Synthetic', courseIds: ['SYN'], maxWeeklyMinutes: 60, availability: [], regime: 'tiempo-completo' as const, appointment: 'faculty-ordinary' as const }
  const state = { ...initialPlanningSessionState(), period: '2027-I' as const, lectiveHourMinutes: 60 as const, resources: { teachers: [teacher], rooms: [] } }
  const patch = (previous: number, next: number) => ({ kind: 'increase_teacher_load' as const, adjustments: [{ teacherId: 'SYN-T', previousMaxWeeklyMinutes: previous, nextMaxWeeklyMinutes: next }] })
  assert.equal(reducePlanningSession(state, { type: 'applyAdvisorPatches', patches: [patch(60, 120)] }).resources.teachers[0].maxWeeklyMinutes, 120)
  for (const value of [patch(59, 120), patch(60, 721)]) assert.throws(() => reducePlanningSession(state, { type: 'applyAdvisorPatches', patches: [value] }))
  const authorized = { ...state, resources: { teachers: [{ ...teacher, loadAuthorizations: [{ kind: 'voluntary-declaration' as const, reference: 'SYN-DOCUMENT' }] }], rooms: [] } }
  assert.equal(reducePlanningSession(authorized, { type: 'applyAdvisorPatches', patches: [patch(60, 1200)] }).resources.teachers[0].maxWeeklyMinutes, 1200)
  assert.throws(() => reducePlanningSession({ ...state, lectiveHourMinutes: undefined }, { type: 'applyAdvisorPatches', patches: [patch(60, 120)] }))
  assert.throws(() => reducePlanningSession({ ...state, period: '2026-I' }, { type: 'applyAdvisorPatches', patches: [patch(60, 120)] }))
})

test('reference incorporation validates composed resource limits before changing the session', () => {
  const teacher = (n: number) => ({ id: `SYN-T${n}`, name: `Synthetic ${n}`, courseIds: ['SYN'], maxWeeklyMinutes: 0, availability: [] })
  const room = (n: number) => ({ id: `SYN-R${n}`, name: `Synthetic ${n}`, capacity: 45, availability: [] })
  const catalog = { revision: 'PA-DEMO-1', courses: [], teachers: [], rooms: [], windows: [], startStepMinutes: 30, maxExplorations: 1,
    referenceTeachers: [{ id: 'SYN-REF-T', name: 'Synthetic reference', courseIds: ['SYN'] }],
    referenceRooms: [{ id: 'SYN-REF-R', name: 'Synthetic reference', capacity: 45, kind: 'classroom' as const, pavilion: 'AP' as const }] }
  const state = { ...initialPlanningSessionState(), catalog,
    resources: { teachers: Array.from({ length: PLANNING_LIMITS.teachers }, (_, n) => teacher(n)), rooms: Array.from({ length: PLANNING_LIMITS.rooms }, (_, n) => room(n)) } }
  const session = createPlanningSession(undefined, state)
  for (const patch of [
    { kind: 'incorporate_reference_resource' as const, teacherIds: ['SYN-REF-T'], roomIds: [] },
    { kind: 'incorporate_reference_resource' as const, teacherIds: [], roomIds: ['SYN-REF-R'] },
  ]) {
    assert.throws(() => session.commands.edit({ type: 'applyAdvisorPatches', patches: [patch] }))
    assert.equal(session.getState(), state, 'invalid patch is atomic and keeps the prior state')
  }
  const below = { ...state, resources: { teachers: state.resources.teachers.slice(1), rooms: state.resources.rooms.slice(1) } }
  const atLimit = reducePlanningSession(below, { type: 'applyAdvisorPatches', patches: [{
    kind: 'incorporate_reference_resource', teacherIds: ['SYN-REF-T'], roomIds: ['SYN-REF-R'],
  }] })
  assert.equal(atLimit.resources.teachers.length, PLANNING_LIMITS.teachers)
  assert.equal(atLimit.resources.rooms.length, PLANNING_LIMITS.rooms)
  session.dispose()
})

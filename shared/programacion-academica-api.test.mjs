import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACADEMIC_REVISION, validateAcademicCatalog, validateAcademicRequest, validateAcademicResources, validateAcademicProposal, validateAcademicAdjustment, validateAcademicSearch, validateAcademicSearchRequest } from './programacion-academica-api.mjs'

test('partial proposal counters, termination reason and diagnostics cannot contradict each other', () => {
  const proposal = {
    proposalId: 'PARTIAL', createdAt: '2026-10-29T12:00:00Z', expiresAt: '2026-10-29T12:15:00Z',
    status: 'search-limit', coverageComplete: false,
    sections: ['S1', 'S2'].map((sectionId) => ({ sectionId, courseId: 'C1', courseName: 'Curso', capacity: 45, deliveryMode: 'continuous' })),
    assignments: [0, 1].map((i) => ({ sessionId: `A${i}`, sectionId: 'S1', courseId: 'C1', courseName: 'Curso', teacherId: 'T1', teacherName: 'Docente', roomId: 'R1', roomName: 'Aula', day: 1, startMinute: 1080 + i * 120, endMinute: 1200 + i * 120 })),
    pending: [0, 1].map((i) => ({ sessionId: `P${i}`, sectionId: 'S2', courseId: 'C1', durationMinutes: 120 })),
    diagnostics: [{ code: 'SEARCH_LIMIT', message: 'Búsqueda inconclusa', sessionIds: ['P0', 'P1'] }],
    counts: { sections: 2, requiredSessions: 4, scheduledSessions: 2 },
    stats: { exploredCandidates: 1, candidateVisits: 3, backtracks: 0, limitReason: 'explorations' },
  }
  assert.doesNotThrow(() => validateAcademicProposal(proposal))
  for (const state of ['running', 'cancelled']) {
    const live = { ...proposal, coverageProof: 'inconclusive', diagnostics: [], stats: { ...proposal.stats, limitReason: state } }
    const job = { jobId: 'SYN-JOB', state, phase: 'coverage', elapsedSeconds: 1, budgetSeconds: 30,
      progress: { requiredSessions: 4, scheduledSessions: 2, requiredSections: 2, scheduledSections: 1, improvements: 1 }, proposal: live, error: null }
    assert.doesNotThrow(() => validateAcademicSearch(job))
    assert.throws(() => validateAcademicSearch({ ...job, proposal: { ...live, stats: { ...live.stats, limitReason: 'time' } } }))
    assert.throws(() => validateAcademicSearch({ ...job, progress: { ...job.progress, scheduledSessions: 3 } }))
    assert.throws(() => validateAcademicSearch({ ...job, proposal: { ...live, coverageProof: 'shortfall-proven' } }))
    assert.throws(() => validateAcademicSearch({ ...job, state: 'failed' }))
  }

  assert.throws(() => validateAcademicProposal({ ...proposal, coverageProof: 'complete' }))
  assert.doesNotThrow(() => validateAcademicProposal({ ...proposal, coverageProof: 'inconclusive' }))
  assert.doesNotThrow(() => validateAcademicProposal({ ...proposal, status: 'impossible', diagnostics: [], stats: { ...proposal.stats, limitReason: null }, coverageProof: 'shortfall-proven' }))
  assert.throws(() => validateAcademicProposal({ ...proposal, coverageProof: 'shortfall-proven' }))
  assert.doesNotThrow(() => validateAcademicProposal({ ...proposal, editVersion: 1, manuallyAdjustedSectionIds: ['S1'] }))
  for (const metadata of [
    { editVersion: 1 }, { manuallyAdjustedSectionIds: [] },
    { editVersion: -1, manuallyAdjustedSectionIds: [] },
    { editVersion: 0, manuallyAdjustedSectionIds: ['S1'] },
    { editVersion: 1, manuallyAdjustedSectionIds: ['unknown'] },
    { editVersion: 1, manuallyAdjustedSectionIds: ['S1', 'S1'] },
    { editVersion: 1, manuallyAdjustedSectionIds: [] },
    { editVersion: 1, manuallyAdjustedSectionIds: ['S1', 'S2'] },
  ]) assert.throws(() => validateAcademicProposal({ ...proposal, ...metadata }))
  assert.throws(() => validateAcademicProposal({ ...proposal, status: 'impossible' }))
  assert.throws(() => validateAcademicProposal({ ...proposal, counts: { ...proposal.counts, scheduledSessions: 0 } }))
  assert.throws(() => validateAcademicProposal({ ...proposal, status: 'complete', coverageComplete: true }))
  const mixed = structuredClone(proposal)
  mixed.assignments[1].teacherId = 'T2'
  assert.throws(() => validateAcademicProposal(mixed))
  const duplicated = structuredClone(proposal)
  duplicated.assignments[1].sessionId = duplicated.assignments[0].sessionId
  assert.throws(() => validateAcademicProposal(duplicated))
})

test('manual adjustment accepts only an explicit bounded block edit, never a replacement authority', () => {
  const adjustment = { expectedVersion: 0, sectionId: 'S1', sessionIds: ['A1', 'A2'], teacherId: 'T1', day: 3, startMinute: 1080, roomIds: ['R1', 'R1'] }
  assert.doesNotThrow(() => validateAcademicAdjustment(adjustment))
  for (const change of [
    { expectedVersion: -1 }, { expectedVersion: 0.5 }, { expectedVersion: '0' },
    { day: 0 }, { day: 8 }, { startMinute: 1440 }, { startMinute: -1 },
    { sectionId: ' S1' }, { teacherId: '' }, { sessionIds: [] },
    { sessionIds: ['A1', 'A1'] }, { roomIds: ['R1'] },
    { roomIds: ['R1', ''] }, { sessionIds: Array(129).fill('A1') },
    { authority: {} }, { resources: { teachers: [], rooms: [] } }, { endMinute: 1200 },
  ]) assert.throws(() => validateAcademicAdjustment({ ...adjustment, ...change }))
})

const planningResources = () => ({
  teachers: [{ id: 'T1', name: 'Docente compartido de demostración', courseIds: ['C1', 'C2'], maxWeeklyMinutes: 300,
    availability: [{ day: 1, startMinute: 480, endMinute: 780 }] }],
  rooms: [{ id: 'R1', name: 'Laboratorio de demostración', kind: 'laboratory', capacity: 30,
    availability: [{ day: 1, startMinute: 480, endMinute: 780 }] }],
})

test('editable resources accept shared teachers, laboratories and intentionally empty lists', () => {
  assert.doesNotThrow(() => validateAcademicResources(planningResources()))
  assert.doesNotThrow(() => validateAcademicResources({ teachers: [], rooms: [] }))
  assert.doesNotThrow(() => validateAcademicRequest({ revision: ACADEMIC_REVISION, demands: [], resources: planningResources() }))
  const configured = planningResources()
  configured.teachers[0].preferences = [{ day: 1, startMinute: 600, endMinute: 780 }]
  configured.teachers[0].sectionLimits = [{ courseId: 'C1', maxSections: 2 }]
  assert.doesNotThrow(() => validateAcademicRequest({ revision: ACADEMIC_REVISION, demands: [], resources: configured, allocationPolicy: 'balanced' }))
})

test('editable resource boundary rejects duplicate identities and invalid capacities, loads, intervals and fields', () => {
  for (const mutate of [
    (r) => r.teachers.push(structuredClone(r.teachers[0])),
    (r) => r.rooms.push(structuredClone(r.rooms[0])),
    (r) => { r.rooms[0].capacity = 0 },
    (r) => { r.rooms[0].kind = 'anything' },
    (r) => { r.teachers[0].maxWeeklyMinutes = -1 },
    (r) => { r.teachers[0].maxWeeklyMinutes = 10081 },
    (r) => { r.teachers[0].name = '   ' },
    (r) => { r.rooms[0].availability[0].endMinute = 480 },
    (r) => { r.teachers[0].availability[0].day = 8 },
    (r) => { r.teachers[0].courseIds.push('C1') },
    (r) => { r.teachers[0].preferences = [{ day: 1, startMinute: 780, endMinute: 600 }] },
    (r) => { r.teachers[0].sectionLimits = [{ courseId: 'C1', maxSections: -1 }] },
    (r) => { r.teachers[0].sectionLimits = [{ courseId: 'C1', maxSections: 1 }, { courseId: 'C1', maxSections: 2 }] },
    (r) => { r.authority = [] },
    (r) => { r.teachers = Array.from({ length: 129 }, (_, i) => ({ ...r.teachers[0], id: `T${i}` })) },
    (r) => { r.rooms[0].availability = Array.from({ length: 33 }, () => ({ day: 1, startMinute: 480, endMinute: 780 })) },
  ]) {
    const value = planningResources()
    mutate(value)
    assert.throws(() => validateAcademicResources(value))
  }
})

test('planning request accepts selection, target capacity and authorized-pattern identifier shape', () => {
  assert.doesNotThrow(() => validateAcademicRequest({ revision: ACADEMIC_REVISION, demands: [] }))
  const request = { revision: ACADEMIC_REVISION, demands: [{ courseId: 'COURSE', estimatedDemand: 31, targetCapacity: 20, patternId: 'pattern-1' }] }
  assert.doesNotThrow(() => validateAcademicRequest(request))
  assert.doesNotThrow(() => validateAcademicRequest({ ...request, demands: [{ ...request.demands[0], deliveryMode: 'continuous' }] }))
  assert.doesNotThrow(() => validateAcademicRequest({ ...request, demands: [{ ...request.demands[0], deliveryMode: 'split' }] }))
  assert.throws(() => validateAcademicRequest({ ...request, demands: [{ ...request.demands[0], deliveryMode: 'automatic-mixed' }] }))
  for (const capacity of [0, -1, 1.5, '30', null]) {
    assert.throws(() => validateAcademicRequest({ ...request, demands: [{ ...request.demands[0], targetCapacity: capacity }] }))
  }
  assert.throws(() => validateAcademicRequest({ ...request, demands: [{ ...request.demands[0], weeklySessions: [] }] }))
  assert.throws(() => validateAcademicRequest({ ...request, demands: Array.from({ length: 97 }, (_, i) => ({ courseId: `C${i}`, estimatedDemand: 1 })) }))
})

test('catalog can expose 56 courses independently of the bounded planning request', () => {
  const courses = Array.from({ length: 56 }, (_, i) => ({ courseId: `C${i}`, name: `Course ${i}`, estimatedDemand: 0,
    targetCapacity: 30, cycle: 1, credits: 2, weeklySessions: [{ id: 's1', durationMinutes: 60 }],
    planningPatterns: [{ id: 'p1', label: '60 min', weeklySessions: [{ id: 's1', durationMinutes: 60 }] }],
    history: { sections: [{ sectionId: '1', capacity: 5, sessions: [{ day: 4, startMinute: 480, endMinute: 540, room: '--', teacherId: 'REFERENCE-1', type: 'T' }] }] } }))
  const catalog = { revision: ACADEMIC_REVISION, courses, teachers: [], rooms: [], windows: [], startStepMinutes: 60, maxExplorations: 1000,
    source: { kind: 'synthetic-existing', reference: 'synthetic seed', sourcePeriod: 'unknown', planningPeriod: 'demo', assumptions: 'Synthetic planning parameters' } }
  assert.doesNotThrow(() => validateAcademicCatalog(catalog))
  const duplicate = structuredClone(catalog)
  duplicate.courses[1].courseId = duplicate.courses[0].courseId
  assert.throws(() => validateAcademicCatalog(duplicate))
  const invalid = structuredClone(catalog)
  invalid.courses[0].history.sections[0].sessions[0].endMinute = 480
  assert.throws(() => validateAcademicCatalog(invalid))
})

test('teacher teaching-load fields are optional and validated one by one', () => {
  const base = planningResources()
  assert.doesNotThrow(() => validateAcademicResources(base))
  const full = planningResources()
  Object.assign(full.teachers[0], {
    regime: 'tiempo-parcial', appointment: 'faculty-ordinary', weeklyServiceHours: 20, category: 'auxiliar',
    loadConditions: ['renacyt-researcher', 'postgraduate-study', 'on-leave'],
    loadAuthorizations: [{ kind: 'voluntary-declaration', reference: 'DJ-001' }, { kind: 'vrap-authorization', reference: 'VRAP-001', maxLectiveHours: 24 }],
  })
  assert.doesNotThrow(() => validateAcademicResources(full))
  for (const [field, value] of [
    ['regime', 'medio-tiempo'], ['regime', null], ['appointment', 'nombrado'], ['weeklyServiceHours', 0], ['weeklyServiceHours', 40], ['weeklyServiceHours', 12.5],
    ['weeklyServiceHours', '20'], ['loadConditions', ['unknown']], ['loadConditions', ['on-leave', 'on-leave']], ['loadConditions', 'on-leave'],
    ['loadAuthorizations', [{ kind: 'voluntary-declaration' }]],
    ['loadAuthorizations', [{ kind: 'voluntary-declaration', reference: '' }]],
    ['loadAuthorizations', [{ kind: 'voluntary-declaration', reference: '  ' }]],
    ['loadAuthorizations', [{ kind: 'voluntary-declaration', reference: 'DJ-001', maxLectiveHours: 20 }]],
    ['loadAuthorizations', [{ kind: 'vrap-authorization', reference: 'VRAP-001' }]],
    ['loadAuthorizations', [{ kind: 'vrap-authorization', reference: 'VRAP-001', maxLectiveHours: 0 }]],
    ['loadAuthorizations', [{ kind: 'vrap-authorization', reference: 'VRAP-001', maxLectiveHours: 1.5 }]],
    ['loadAuthorizations', [{ kind: 'dean-authorization', reference: 'X' }]],
    ['loadAuthorizations', [{ kind: 'voluntary-declaration', reference: 'DJ-001', extra: true }]],
  ]) {
    const resources = planningResources()
    resources.teachers[0][field] = value
    assert.throws(() => validateAcademicResources(resources), TypeError, `${field}: ${JSON.stringify(value)}`)
  }
})

test('generation transports an explicit lective duration and period without changing legacy requests', () => {
  const request = { revision: ACADEMIC_REVISION, demands: [] }
  assert.doesNotThrow(() => validateAcademicRequest(request))
  assert.doesNotThrow(() => validateAcademicRequest({ ...request, academicPeriod: '2027-I', lectiveHourMinutes: 60 }))
  for (const lectiveHourMinutes of [0, 55, null, '60']) {
    assert.throws(() => validateAcademicRequest({ ...request, lectiveHourMinutes }))
  }
})

test('optional proposal proofs, window decisions and normative blockers have strict runtime shapes', () => {
  const proposal = { proposalId: 'SYN-P', createdAt: '2026-11-10T00:00:00Z', expiresAt: '2026-11-10T00:15:00Z',
    status: 'complete', sections: [], assignments: [], pending: [], diagnostics: [], coverageComplete: true,
    counts: { sections: 0, requiredSessions: 0, scheduledSessions: 0 },
    stats: { exploredCandidates: 0, candidateVisits: 0, backtracks: 0, limitReason: null } }
  const metadata = { coverageProof: 'complete', capacityCertificate: { proven: true, requiredSectionsTotal: 0, coverableSectionsTotal: 0, courses: [] },
    decisions: [{ id: 'window', kind: 'planning-window', teacherId: null, courseIds: [], exceptionKind: null, additionalMinutes: 0,
      sectionsUnlocked: 1, basis: 'window-precheck', policyChange: { allowSaturday: true } }],
    prelation: { levels: [{ id: 'category-rank', value: 0, proven: false }] },
    normative: { profileRevision: null, lectiveHourMinutes: 60, gaps: [{ code: 'REGIME_MISSING', message: 'Synthetic gap', teacherIds: ['SYN-T'] }],
      blockers: [{ teacherId: 'SYN-T', assignedMinutes: 960, authorizedMaxMinutes: 720, reason: 'over-authorized-load', requiredAuthorization: 'voluntary-declaration', sourceIds: ['OF-02'] }] } }
  assert.doesNotThrow(() => validateAcademicProposal(proposal))
  assert.doesNotThrow(() => validateAcademicProposal({ ...proposal, ...metadata }))
  const combined = { ...metadata.decisions[0], courseIds: ['SYN-C'], requiresSplit: true }
  assert.doesNotThrow(() => validateAcademicProposal({ ...proposal, decisions: [combined] }))
  for (const fields of [{ requiresSplit: false }, { requiresSplit: null }, { requiresSplit: 'split' },
    { courseIds: [] }, { kind: 'delivery-mode-split' }, { policyChange: undefined }]) {
    assert.throws(() => validateAcademicProposal({ ...proposal, decisions: [{ ...combined, ...fields }] }))
  }
  for (const coverageProof of ['inconclusive', 'shortfall-proven']) assert.throws(() => validateAcademicProposal({ ...proposal, ...metadata, coverageProof }))
  // The engine lists only courses with a shortfall: rows explain the uncovered sections, not the totals.
  assert.doesNotThrow(() => validateAcademicProposal({ ...proposal, ...metadata, capacityCertificate: { proven: true, requiredSectionsTotal: 10,
    coverableSectionsTotal: 8, courses: [{ courseId: 'SYN-C', requiredSections: 4, coverableSections: 2, requiredMinutes: 960 }] } }))
  for (const patch of [
    { coverageProof: 'optimal' }, { coverageProof: null }, { capacityCertificate: null },
    { capacityCertificate: { ...metadata.capacityCertificate, coverableSectionsTotal: 1 } },
    { decisions: [{ ...metadata.decisions[0], policyChange: { allowSaturday: false } }] },
    { decisions: [{ ...metadata.decisions[0], kind: 'unknown' }] },
    { decisions: [{ ...metadata.decisions[0], additionalMinutes: -1 }] },
    { prelation: { levels: [{ id: 'unknown', value: 0, proven: true }] } },
    { normative: { ...metadata.normative, blockers: [{ ...metadata.normative.blockers[0], reason: 'approved-in-ui' }] } },
    { normative: { ...metadata.normative, lectiveHourMinutes: 55 } },
    { normative: { ...metadata.normative, gaps: [{ code: 'SYN', message: 'Synthetic gap', teacherIds: [4] }] } },
  ]) assert.throws(() => validateAcademicProposal({ ...proposal, ...metadata, ...patch }))
})


test('optional caller correlation is a validated UUID and legacy starts remain compatible', () => {
  const input = { request: { revision: ACADEMIC_REVISION, demands: [] }, budgetSeconds: 30 }
  assert.doesNotThrow(() => validateAcademicSearchRequest(input))
  assert.doesNotThrow(() => validateAcademicSearchRequest({ ...input, requestId: '11111111-1111-4111-8111-111111111111' }))
  for (const requestId of ['', 'wrong', null, 123]) assert.throws(() => validateAcademicSearchRequest({ ...input, requestId }))
})

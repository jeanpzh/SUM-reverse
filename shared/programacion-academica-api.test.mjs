import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACADEMIC_REVISION, validateAcademicCatalog, validateAcademicRequest, validateAcademicResources, validateAcademicProposal, validateAcademicAdjustment } from './programacion-academica-api.mjs'

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

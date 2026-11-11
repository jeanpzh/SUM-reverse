import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveNormativeProfile, teacherLoadLimits } from '../../../shared/academic-normative-profile.mjs'
import { validateTeacherLoadFields } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicPlanningResources, AcademicProposal, AcademicTeacherResource } from '../../../shared/programacion-academica-api.mjs'
import {
  addLoadAuthorization, buildDecisionQueue, describeBlockers, describeCapacity, describeCoverage, describeNormativeSummary,
  describePrelation, removeLoadAuthorization, setTeacherRegime, setWeeklyServiceHours, teacherLoadView, toggleLoadCondition,
  validateTeacherLoadInput,
} from './planningDecisions.ts'
import { initialPlanningSessionState, reducePlanningSession } from './planningSession.ts'
import { AcademicLoadAuthorizationError, publishAcademicDraft } from './academicScheduling.ts'

// Synthetic fixtures only. No real teacher, course or resolution data.
const baseProposal = {
  proposalId: 'synthetic-proposal', createdAt: '2026-11-11T10:00:00.000Z', expiresAt: '2026-11-11T10:15:00.000Z', status: 'search-limit',
  sections: [], assignments: [], pending: [], diagnostics: [], coverageComplete: false,
  counts: { sections: 10, requiredSessions: 10, scheduledSessions: 6 },
  stats: { exploredCandidates: 1, candidateVisits: 1, backtracks: 0, limitReason: null },
} as unknown as AcademicProposal

const withAnalysis = (overrides: Partial<AcademicProposal>): AcademicProposal => ({ ...baseProposal, ...overrides }) as AcademicProposal

const allKindsDecisions: NonNullable<AcademicProposal['decisions']> = [
  { id: 'D-EXC-1', kind: 'teacher-load-exception', teacherId: 'T1', courseIds: [], exceptionKind: 'voluntary-declaration', additionalMinutes: 480, sectionsUnlocked: 3, basis: 'capacity-relaxation',
    requires: ['Solicitud voluntaria del docente', 'Declaración jurada registrada'], sourceIds: ['OF-02'] },
  { id: 'D-EXC-2', kind: 'teacher-load-exception', teacherId: 'T2', courseIds: [], exceptionKind: 'vrap-authorization', additionalMinutes: 240, sectionsUnlocked: 1, basis: 'capacity-relaxation',
    requires: ['Autorización del VRAP'], sourceIds: ['OF-02'] },
  { id: 'D-ADD-1', kind: 'additional-teacher', teacherId: null, courseIds: ['C1'], exceptionKind: null, additionalMinutes: 360, sectionsUnlocked: 2, basis: 'capacity-relaxation' },
  { id: 'D-WIN-1', kind: 'planning-window', teacherId: null, courseIds: [], exceptionKind: null, additionalMinutes: 0, sectionsUnlocked: 5, basis: 'window-precheck', policyChange: { allowAfternoon: true } },
  { id: 'D-WIN-2', kind: 'planning-window', teacherId: null, courseIds: [], exceptionKind: null, additionalMinutes: 0, sectionsUnlocked: 6, basis: 'window-precheck', policyChange: { allowAfternoon: true, allowSaturday: true } },
  { id: 'D-SPL-1', kind: 'delivery-mode-split', teacherId: null, courseIds: ['C2', 'C3'], exceptionKind: null, additionalMinutes: 0, sectionsUnlocked: 5, basis: 'window-precheck' },
]

const teacher = (overrides: Partial<AcademicTeacherResource> = {}): AcademicTeacherResource => ({
  id: 'T1', name: 'Docente sintético', courseIds: [], maxWeeklyMinutes: 720, availability: [],
  regime: 'tiempo-completo', appointment: 'faculty-ordinary', ...overrides,
})
const context = { period: '2027-I' as const, lectiveHourMinutes: 60 as const }

test('coverage state renders three distinct states and nothing for proposals without the field', () => {
  const states = (['complete', 'shortfall-proven', 'inconclusive'] as const).map((coverageProof) => describeCoverage(withAnalysis({ coverageProof }))!)
  assert.deepEqual(states.map((state) => state.kind), ['complete', 'shortfall-proven', 'inconclusive'])
  assert.equal(new Set(states.map((state) => state.label)).size, 3)
  assert.match(states[1].label, /Faltante comprobado/)
  assert.match(states[1].detail, /no es posible programar todas las secciones/)
  assert.doesNotMatch(states[1].detail, /más secciones/) // the proof bounds components, not the section count
  assert.match(states[2].detail, /podrían caber más/i)
  assert.doesNotMatch(states[2].detail, /imposible/i)
  assert.equal(describeCoverage(baseProposal), null)
  assert.equal(describeCapacity(baseProposal), null)
})

test('capacity certificate reports coverable sections out of the total, even when only shortfall courses are listed', () => {
  const capacity = describeCapacity(withAnalysis({ capacityCertificate: { proven: true, requiredSectionsTotal: 166, coverableSectionsTotal: 136,
    courses: [{ courseId: 'C1', requiredSections: 4, coverableSections: 1, requiredMinutes: 900 }] } }))!
  assert.equal(capacity.coverable, 136)
  assert.equal(capacity.required, 166)
  assert.equal(capacity.shortfallCourses, 1)
  assert.match(capacity.text, /136 de 166 secciones/)
  assert.doesNotMatch(capacity.text, /no probado/)
  const unproven = describeCapacity(withAnalysis({ capacityCertificate: { proven: false, requiredSectionsTotal: 10, coverableSectionsTotal: 8, courses: [] } }))!
  assert.match(unproven.text, /no probado/)
})

test('decision queue lists every decision grouped by cause, ordered by sections unlocked', () => {
  const queue = buildDecisionQueue(allKindsDecisions, { period: '2027-I', teacherNames: { T1: 'Docente Uno', T2: 'Docente Dos' }, courseNames: { C1: 'Curso Uno', C2: 'Curso Dos', C3: 'Curso Tres' } })!
  assert.equal(queue.groups.reduce((total, group) => total + group.items.length, 0), allKindsDecisions.length)
  assert.deepEqual(queue.groups.map((group) => group.id).sort(), ['additional-teacher', 'delivery-mode-split', 'load-exception', 'planning-window'])
  const unlocked = queue.groups.map((group) => group.sectionsUnlocked)
  assert.deepEqual([...unlocked].sort((a, b) => b - a), unlocked)
  for (const group of queue.groups) {
    const counts = group.items.map((item) => item.sectionsUnlocked)
    assert.deepEqual([...counts].sort((a, b) => b - a), counts)
  }
  // The minimal set (capacity relaxation) is summed; window alternatives are never added together.
  assert.equal(queue.summary, '3 decisiones cubren 6 secciones')
  assert.match(queue.windowSummary!, /hasta 6 secciones/)
  assert.match(queue.windowSummary!, /alternativas/)
})

test('load exceptions carry teacher, minutes, formal requirements and sources; they never offer a one-click apply', () => {
  const queue = buildDecisionQueue(allKindsDecisions, { period: '2027-I', teacherNames: { T1: 'Docente Uno' } })!
  const item = queue.groups.find((group) => group.id === 'load-exception')!.items[0]
  assert.equal(item.title, 'Docente Uno')
  assert.match(item.effect, /480 min/)
  assert.match(item.effect, /3 secciones/)
  assert.deepEqual(item.requires, ['Solicitud voluntaria del docente', 'Declaración jurada registrada'])
  assert.deepEqual(item.sources.map((source) => source.id), ['OF-02'])
  assert.match(item.sources[0].title, /Reglamento General/)
  assert.deepEqual(item.action, { kind: 'record-authorization', teacherId: 'T1' })
  assert.match(item.necessity, /condición necesaria/i)
  assert.match(item.necessity, /no garantiza/i)
  assert.match(item.kindLabel, /declaración jurada/i)
})

test('window and split decisions reuse the advisor patches and window changes are labelled as testimony', () => {
  const queue = buildDecisionQueue(allKindsDecisions, { period: '2027-I' })!
  const windows = queue.groups.find((group) => group.id === 'planning-window')!.items
  assert.deepEqual(windows[0].action, { kind: 'apply-patches', patches: [{ kind: 'enable_planning_window', allowAfternoon: true, allowSaturday: true }] })
  assert.match(windows[0].provenance!, /testimonio/i)
  assert.match(windows[0].provenance!, /sin norma/i)
  const split = queue.groups.find((group) => group.id === 'delivery-mode-split')!.items[0]
  assert.deepEqual(split.action, { kind: 'apply-patches', patches: [{ kind: 'change_delivery_mode', courseIds: ['C2', 'C3'], deliveryMode: 'split' }] })
  const addTeacher = queue.groups.find((group) => group.id === 'additional-teacher')!.items[0]
  assert.deepEqual(addTeacher.action, { kind: 'add-teacher', courseIds: ['C1'] })
  assert.match(addTeacher.effect, /360 min/)
})

test('queue marks decisions already recorded in the current configuration and handles empty input', () => {
  const resources: AcademicPlanningResources = { teachers: [teacher({ loadAuthorizations: [{ kind: 'voluntary-declaration', reference: 'SYN-DECL' }] })], rooms: [] }
  const queue = buildDecisionQueue(allKindsDecisions, { period: '2027-I', resources, policy: { allowAfternoon: true, allowSaturday: false } })!
  const exception = queue.groups.find((group) => group.id === 'load-exception')!.items.find((item) => item.id === 'D-EXC-1')!
  assert.equal(exception.applied, true)
  assert.equal(queue.groups.find((group) => group.id === 'load-exception')!.items.find((item) => item.id === 'D-EXC-2')!.applied, false)
  assert.equal(queue.groups.find((group) => group.id === 'planning-window')!.items.find((item) => item.id === 'D-WIN-1')!.applied, true)
  assert.equal(buildDecisionQueue([], { period: '2027-I' }), null)
  assert.equal(buildDecisionQueue(undefined, { period: '2027-I' }), null)
})

test('normative summary lists gaps with affected teachers, classifies them and notes the unverified lective hour', () => {
  const summary = describeNormativeSummary(withAnalysis({ normative: { profileRevision: 'UNMSM-AAD-2026-04', lectiveHourMinutes: 60, blockers: [],
    gaps: [
      { code: 'REGIME_MISSING', message: 'No se registró el régimen de dedicación; se conserva el tope declarado.', teacherIds: ['T1', 'T2'] },
      { code: 'ON_LEAVE_INFERRED', message: 'Tratar a un docente con licencia como no disponible es una inferencia (`inferred`).', teacherIds: ['T3'] },
      { code: 'FISI_LECTIVE_HOUR_UNVERIFIED', message: 'La de FISI no está verificada y debe indicarse explícitamente.' },
      { code: 'CONTRACT_LOAD_NOT_REGULATED', message: 'El reglamento (art. 1) alcanza a docentes ordinarios; no regula la carga lectiva de docentes contratados.', teacherIds: ['T4'] },
    ] } }), '2027-I')!
  assert.equal(summary.profileRevision, 'UNMSM-AAD-2026-04')
  assert.equal(summary.lectiveHourMinutes, 60)
  assert.match(summary.lectiveHourNote!, /no está verificada|sin verificar/i)
  assert.deepEqual(summary.gaps.map((gap) => [gap.code, gap.teacherCount, gap.classification]), [
    ['REGIME_MISSING', 2, 'data'], ['ON_LEAVE_INFERRED', 1, 'inference'], ['FISI_LECTIVE_HOUR_UNVERIFIED', 0, 'unverified'], ['CONTRACT_LOAD_NOT_REGULATED', 1, 'regulation'],
  ])
  assert.doesNotMatch(summary.gaps[1].message, /`/)
  assert.equal(describeNormativeSummary(baseProposal, '2027-I'), null)
})

test('prelation readout marks levels that are not proven', () => {
  const levels = describePrelation(withAnalysis({ prelation: { levels: [
    { id: 'contract-sections', value: 12, proven: true }, { id: 'interfaculty-sections', value: 4, proven: false }, { id: 'category-rank', value: 30, proven: false },
  ] } }))!
  assert.deepEqual(levels.map((level) => [level.id, level.value, level.proven, level.mark]), [
    ['contract-sections', 12, true, 'probado'], ['interfaculty-sections', 4, false, 'no probado'], ['category-rank', 30, false, 'no probado'],
  ])
  assert.equal(describePrelation(baseProposal), null)
})

test('recording a voluntary declaration raises the displayed authorized maximum and removing it restores the ordinary one', () => {
  const before = teacherLoadView(teacher(), context)
  assert.equal(before.status, 'ok')
  if (before.status !== 'ok') return
  assert.equal(before.ordinaryMaxMinutes, 720)
  assert.equal(before.authorizedMaxMinutes, 720)
  assert.equal(before.minimumMinutes, 600)
  assert.ok(before.sources.some((source) => source.id === 'OF-02'))

  const added = addLoadAuthorization(teacher(), { kind: 'voluntary-declaration', reference: 'SYN-DECL-001' })
  assert.equal(added.ok, true)
  if (!added.ok) return
  const state = reducePlanningSession(initialPlanningSessionState(), { type: 'updateResources', value: { teachers: [added.teacher], rooms: [] } })
  const after = teacherLoadView(state.resources.teachers[0], context)
  assert.equal(after.status, 'ok')
  if (after.status !== 'ok') return
  assert.equal(after.ordinaryMaxMinutes, 720)
  assert.equal(after.authorizedMaxMinutes, 1200)
  assert.equal(state.proposal, null)
  assert.equal(state.dirty, true)

  const removed = removeLoadAuthorization(added.teacher, 0)
  const restored = teacherLoadView(removed, context)
  assert.equal(restored.status === 'ok' && restored.authorizedMaxMinutes, 720)
  assert.ok(!('loadAuthorizations' in removed))
})

test('teacher load view reports regulation gaps and refuses to compute without a lective hour', () => {
  const contract = teacherLoadView(teacher({ appointment: 'contract', regime: undefined }), context)
  assert.equal(contract.status === 'ok' && contract.authorizedMaxMinutes, null)
  assert.ok(contract.status === 'ok' && contract.gaps.some((gap) => /contratados/.test(gap.message)))
  const noHour = teacherLoadView(teacher(), { period: '2027-I', lectiveHourMinutes: undefined })
  assert.equal(noHour.status, 'unavailable')
  assert.match((noHour as { reason: string }).reason, /hora lectiva/i)
  const early = teacherLoadView(teacher(), { period: '2025-I', lectiveHourMinutes: 60 })
  assert.equal(early.status, 'unavailable')
  const partTime = teacherLoadView(teacher({ regime: 'tiempo-parcial', weeklyServiceHours: 20 }), context)
  assert.equal(partTime.status === 'ok' && partTime.ordinaryMaxMinutes, null)
  assert.ok(partTime.status === 'ok' && partTime.minimumMinutes !== null)
  const vrap = teacherLoadView(teacher({ loadAuthorizations: [{ kind: 'vrap-authorization', reference: 'SYN-VRAP', maxLectiveHours: 24 }] }), context)
  assert.equal(vrap.status === 'ok' && vrap.authorizedMaxMinutes, 1440)
  const onLeave = teacherLoadView(teacher({ loadConditions: ['on-leave'] }), context)
  assert.equal(onLeave.status === 'ok' && onLeave.authorizedMaxMinutes, 0)
})

test('invalid regulatory input is rejected with a readable message before it reaches the resources', () => {
  assert.deepEqual(addLoadAuthorization(teacher(), { kind: 'voluntary-declaration', reference: '   ' }), { ok: false, message: 'Indica la referencia del documento que acredita la autorización.' })
  const vrap = addLoadAuthorization(teacher(), { kind: 'vrap-authorization', reference: 'SYN-VRAP' })
  assert.equal(vrap.ok, false)
  assert.match((vrap as { message: string }).message, /horas lectivas máximas/)
  assert.equal(addLoadAuthorization(teacher(), { kind: 'vrap-authorization', reference: 'SYN-VRAP', maxLectiveHours: 0 }).ok, false)
  assert.equal(addLoadAuthorization(teacher(), { kind: 'voluntary-declaration', reference: 'SYN', maxLectiveHours: 20 }).ok, false)
  for (const value of ['0', '40', '12.5', 'abc']) {
    const result = setWeeklyServiceHours(teacher({ regime: 'tiempo-parcial' }), value)
    assert.equal(result.ok, false, value)
    assert.match((result as { message: string }).message, /entre 1 y 39/)
  }
  const valid = setWeeklyServiceHours(teacher({ regime: 'tiempo-parcial' }), '20')
  assert.equal(valid.ok && valid.teacher.weeklyServiceHours, 20)
  const cleared = setWeeklyServiceHours(teacher({ regime: 'tiempo-parcial', weeklyServiceHours: 20 }), '')
  assert.equal(cleared.ok && 'weeklyServiceHours' in cleared.teacher, false)
})

test('client validation accepts and rejects exactly what the shared validator does', () => {
  const cases: Array<Partial<AcademicTeacherResource>> = [
    {}, { regime: 'tiempo-parcial', weeklyServiceHours: 20 }, { weeklyServiceHours: 0 }, { weeklyServiceHours: 40 }, { weeklyServiceHours: 1 }, { weeklyServiceHours: 39 },
    { regime: 'otro' as never }, { appointment: 'otro' as never }, { loadConditions: ['on-leave', 'on-leave'] }, { loadConditions: ['otra' as never] },
    { loadAuthorizations: [{ kind: 'voluntary-declaration', reference: '' }] }, { loadAuthorizations: [{ kind: 'voluntary-declaration', reference: ' ' }] },
    { loadAuthorizations: [{ kind: 'vrap-authorization', reference: 'SYN' }] }, { loadAuthorizations: [{ kind: 'vrap-authorization', reference: 'SYN', maxLectiveHours: 0 }] },
    { loadAuthorizations: [{ kind: 'vrap-authorization', reference: 'SYN', maxLectiveHours: 169 }] }, { loadAuthorizations: [{ kind: 'vrap-authorization', reference: 'SYN', maxLectiveHours: 24 }] },
    { loadAuthorizations: [{ kind: 'voluntary-declaration', reference: 'SYN', maxLectiveHours: 20 }] }, { loadAuthorizations: [{ kind: 'voluntary-declaration', reference: 'SYN' }] },
  ]
  for (const patch of cases) {
    const candidate = { ...teacher(), ...patch } as AcademicTeacherResource
    let shared = true
    try { validateTeacherLoadFields(candidate) } catch { shared = false }
    const messages = validateTeacherLoadInput(candidate)
    assert.equal(messages.length === 0, shared, JSON.stringify(patch))
    for (const message of messages) assert.doesNotMatch(message, /: (entero|lista) inválid/)
  }
})

test('changing regime or conditions never leaves empty or inapplicable keys that would fail validation', () => {
  const partTime = teacher({ regime: 'tiempo-parcial', weeklyServiceHours: 20 })
  const full = setTeacherRegime(partTime, 'tiempo-completo')
  assert.ok(!('weeklyServiceHours' in full))
  assert.ok(!('regime' in setTeacherRegime(full, undefined)))
  const flagged = toggleLoadCondition(teacher(), 'postgraduate-study', true)
  assert.deepEqual(flagged.loadConditions, ['postgraduate-study'])
  const unflagged = toggleLoadCondition(flagged, 'postgraduate-study', false)
  assert.ok(!('loadConditions' in unflagged))
  assert.deepEqual(validateTeacherLoadInput(unflagged), [])
})

test('blockers explain assigned versus authorized minutes and the required authorization', () => {
  const rows = describeBlockers([
    { teacherId: 'T1', assignedMinutes: 960, authorizedMaxMinutes: 720, reason: 'over-authorized-load', requiredAuthorization: 'voluntary-declaration', sourceIds: ['OF-02'] },
    { teacherId: 'T2', assignedMinutes: 300, authorizedMaxMinutes: 0, reason: 'on-leave', requiredAuthorization: null, sourceIds: ['OF-02', 'INF-LEAVE-UNAVAILABLE'] },
    { teacherId: 'T3', assignedMinutes: 1500, authorizedMaxMinutes: 1200, reason: 'over-authorized-load', requiredAuthorization: 'vrap-authorization', sourceIds: ['OF-02'] },
  ], { T1: 'Docente Uno', T2: 'Docente Dos' }, '2027-I')
  assert.equal(rows[0].teacherName, 'Docente Uno')
  assert.match(rows[0].load, /960 min asignados/)
  assert.match(rows[0].load, /720 min autorizados/)
  assert.match(rows[0].requirement, /declaración jurada/i)
  assert.match(rows[1].requirement, /licencia/i)
  assert.match(rows[1].requirement, /no disponible/i)
  assert.match(rows[2].requirement, /VRAP/)
  assert.equal(rows[2].teacherName, 'T3')
})

test('publication conflicts keep the blocker list at the data seam', async () => {
  const blockers = [{ teacherId: 'T1', assignedMinutes: 960, authorizedMaxMinutes: 720, reason: 'over-authorized-load', requiredAuthorization: 'voluntary-declaration', sourceIds: ['OF-02'] }]
  const fetchImpl = (async () => new Response(JSON.stringify({ error: { code: 'LOAD_AUTHORIZATION_REQUIRED', message: 'wire', blockers } }), { status: 409 })) as typeof fetch
  await assert.rejects(publishAcademicDraft('00000000-0000-4000-8000-000000000001', { expectedVersion: 1, expectedCurrentId: null }, fetchImpl), (error) => {
    assert.ok(error instanceof AcademicLoadAuthorizationError)
    assert.deepEqual(error.blockers, blockers)
    assert.match(error.message, /autorización formal/)
    return true
  })
  const malformed = (async () => new Response(JSON.stringify({ error: { code: 'LOAD_AUTHORIZATION_REQUIRED', message: 'wire', blockers: [{ teacherId: 1 }] } }), { status: 409 })) as typeof fetch
  await assert.rejects(publishAcademicDraft('00000000-0000-4000-8000-000000000001', { expectedVersion: 1, expectedCurrentId: null }, malformed), /formato inválido/)
})

test('gap classes follow the real shared messages, with missing data ahead of cited articles', () => {
  const profile = resolveNormativeProfile({ facultyId: 'FISI', period: '2027-I' })
  const missing = teacherLoadLimits(profile, {}, { lectiveHourMinutes: 60 }).gaps
  const gaps = [...profile.gaps, ...missing].map((gap) => ({ code: gap.code, message: gap.message }))
  const summary = describeNormativeSummary(withAnalysis({ normative: { profileRevision: profile.revision, lectiveHourMinutes: 60, blockers: [], gaps } }), '2027-I')!
  const byCode = Object.fromEntries(summary.gaps.map((gap) => [gap.code, gap.classification]))
  assert.deepEqual(byCode, {
    APPOINTMENT_RANK_INFERRED: 'inference', CONTRACT_LOAD_NOT_REGULATED: 'regulation', FISI_LECTIVE_HOUR_UNVERIFIED: 'unverified',
    PERFORMANCE_EVALUATION_NO_SOURCE: 'data', SOURCE_OF07_URL_NOT_RECORDED: 'data', TP_MINIMUM_BASIS_UNSPECIFIED: 'inference',
    TP_MAXIMUM_NOT_REGULATED: 'regulation', APPOINTMENT_MISSING: 'data', REGIME_MISSING: 'data',
  })
})


test('configuration decisions require an explicit cap edit and no paperwork', () => {
  const queue = buildDecisionQueue([{ id: 'SYN-adjust', kind: 'teacher-load-exception', teacherId: 'T1', courseIds: [],
    exceptionKind: 'configuration-adjustment', additionalMinutes: 60, sectionsUnlocked: 1, basis: 'capacity-relaxation', requires: [], sourceIds: [] }], { period: '2027-I' })!
  const item = queue.groups[0].items[0]
  assert.match(item.kindLabel, /Ajuste dentro/)
  assert.match(item.effect, /No requiere una nueva autorización/)
  assert.deepEqual(item.requires, [])
  assert.equal(item.actionLabel, 'Ajustar carga configurada')
})

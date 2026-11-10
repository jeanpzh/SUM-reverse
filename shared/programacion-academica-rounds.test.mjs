import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ROUND_RECORD_LIMIT, applyRoundOperationToTeacher, checkRoundObjection, initialRoundObjectionStatus, isRoundDeadlineDate, isRoundDeadlineInRange,
  isRoundReviewReady, limaCalendarDate, mapRoundObjectionToOperation, resolvePlanningRoundProfile, resolvedRoundTeacherIds, subtractRoundIntervals,
  validateAcademicRoundControl, validateAcademicRoundObjectionDecision, validateAcademicRoundObjectionInput, validateAcademicRoundProfile,
  validateAcademicRoundRegeneration, validateAcademicRoundRegenerationRequest, validateAcademicRoundResolutionRequest, validateAcademicRoundReviewDecision,
  validateAcademicRoundSubmission,
} from './programacion-academica-rounds.mjs'

const fp = (char) => char.repeat(64)
const monday = (startMinute, endMinute) => ({ day: 1, startMinute, endMinute })

test('R7: the profile resolves only for its synthetic scope and every value carries sources', () => {
  const profile = resolvePlanningRoundProfile({ schoolId: 'SISTEMAS', academicPeriod: '2027-I' })
  assert.equal(profile.profileId, 'SYN-SIS-2027-I-ROUNDS-1')
  assert.equal(profile.maxRounds.value, 3)
  assert.deepEqual(profile.deadline, { mode: 'school-entered', required: false, sourceIds: ['L-ROUNDS-1', 'PROP-13.5'] })
  assert.doesNotThrow(() => validateAcademicRoundProfile(profile))
  const status = Object.fromEntries(profile.sources.map((source) => [source.id, source.status]))
  assert.equal(status['PROP-13.5'], 'unverified')
  assert.ok(profile.sources.every((source) => source.class === null && source.status !== 'documented'), 'no FISI value is presented as official')
  for (const scope of [{ schoolId: 'SISTEMAS', academicPeriod: '2026-II' }, { schoolId: 'SOFTWARE', academicPeriod: '2027-I' }, { schoolId: 'SISTEMAS' }, null, 'SISTEMAS']) {
    assert.equal(resolvePlanningRoundProfile(scope), null)
  }
  profile.maxRounds.value = 9
  assert.equal(resolvePlanningRoundProfile({ schoolId: 'SISTEMAS', academicPeriod: '2027-I' }).maxRounds.value, 3, 'registry is not mutable through a returned copy')
})

test('profile validator rejects bad revisions, ranges, unknown sources and extra keys', () => {
  const base = resolvePlanningRoundProfile({ schoolId: 'SISTEMAS', academicPeriod: '2027-I' })
  const bad = [
    { revision: 'other' }, { unknown: true }, { scope: { ...base.scope, facultyId: 'FIA' } }, { scope: { ...base.scope, academicPeriod: '2027-1' } },
    { maxRounds: { value: 0, sourceIds: ['PROP-4.2.4'] } }, { maxRounds: { value: 11, sourceIds: ['PROP-4.2.4'] } }, { maxRounds: { value: 1.5, sourceIds: ['PROP-4.2.4'] } },
    { maxRounds: { value: 3, sourceIds: ['NOPE'] } }, { maxRounds: { value: 3, sourceIds: [] } }, { deadline: { mode: 'fixed-days', required: false, sourceIds: ['L-ROUNDS-1'] } },
    { deadline: { mode: 'school-entered', required: 'no', sourceIds: ['L-ROUNDS-1'] } }, { sources: [] },
    { sources: [...base.sources, base.sources[0]] }, { sources: [{ ...base.sources[0], status: 'official' }, ...base.sources.slice(1)] },
  ]
  for (const change of bad) assert.throws(() => validateAcademicRoundProfile({ ...base, ...change }), TypeError, JSON.stringify(change))
})

test('R9: deadline is a real calendar date, range is Lima-based and optional in the submission DTO', () => {
  assert.doesNotThrow(() => validateAcademicRoundSubmission({ expectedVersion: 1 }))
  assert.doesNotThrow(() => validateAcademicRoundSubmission({ expectedVersion: 2, deadline: '2027-03-01' }))
  for (const deadline of ['2027-02-30', '2027-2-3', '2027-13-01', '20270301', '2027-03-01T00:00:00Z', ' 2027-03-01', 20270301, null]) {
    assert.throws(() => validateAcademicRoundSubmission({ expectedVersion: 1, deadline }), TypeError, String(deadline))
  }
  assert.throws(() => validateAcademicRoundSubmission({ expectedVersion: 0 }))
  assert.throws(() => validateAcademicRoundSubmission({ expectedVersion: 1, extra: 1 }))
  assert.equal(isRoundDeadlineDate('2028-02-29'), true)
  assert.equal(isRoundDeadlineDate('2027-02-29'), false)
  // 2027-03-02T03:00Z is 2027-03-01 22:00 in Lima.
  assert.equal(limaCalendarDate('2027-03-02T03:00:00.000Z'), '2027-03-01')
  assert.equal(isRoundDeadlineInRange('2027-03-01', '2027-03-02T03:00:00.000Z'), true, 'same Lima day is allowed')
  assert.equal(isRoundDeadlineInRange('2027-02-28', '2027-03-02T03:00:00.000Z'), false, 'before the Lima date')
  assert.equal(isRoundDeadlineInRange('2028-03-01', '2027-03-02T03:00:00.000Z'), true, '366 days after the Lima date 2027-03-01')
  assert.equal(isRoundDeadlineInRange('2028-03-02', '2027-03-02T03:00:00.000Z'), false, '367 days')
  assert.equal(isRoundDeadlineInRange('2027-02-30', '2027-03-02T03:00:00.000Z'), false)
})

const objections = {
  franja: { kind: 'franja-no-disponible', sectionIds: ['S1'], intervals: [monday(480, 600)] },
  minutes: { kind: 'exceso-de-carga', sectionIds: ['S1', 'S2'], limit: { maxWeeklyMinutes: 300 } },
  sections: { kind: 'exceso-de-carga', sectionIds: ['S1', 'S2'], limit: { courseId: 'C1', maxSections: 1 } },
  room: { kind: 'aula-inadecuada', sectionIds: ['S1'], roomIds: ['R1'] },
  other: { kind: 'otra', sectionIds: ['S1'] },
}

test('R10: each objection kind maps to exactly its deterministic operation', () => {
  assert.deepEqual(mapRoundObjectionToOperation(objections.franja, 'T1'), { type: 'remove-teacher-availability', teacherId: 'T1', intervals: [monday(480, 600)] })
  assert.deepEqual(mapRoundObjectionToOperation(objections.minutes, 'T1'), { type: 'limit-teacher-load', teacherId: 'T1', maxWeeklyMinutes: 300 })
  assert.deepEqual(mapRoundObjectionToOperation(objections.sections, 'T1'), { type: 'limit-teacher-sections', teacherId: 'T1', courseId: 'C1', maxSections: 1 })
  assert.deepEqual(mapRoundObjectionToOperation(objections.room, 'T1'), { type: 'exclude-section-rooms', sectionIds: ['S1'], roomIds: ['R1'] })
  assert.deepEqual(mapRoundObjectionToOperation(objections.other, 'T1'), { type: 'manual' })
  assert.deepEqual(mapRoundObjectionToOperation(objections.franja, 'T1'), mapRoundObjectionToOperation(objections.franja, 'T1'))
  const operation = mapRoundObjectionToOperation(objections.franja, 'T1')
  operation.intervals[0].day = 5
  assert.equal(objections.franja.intervals[0].day, 1, 'operation does not alias the input')
  assert.equal(initialRoundObjectionStatus({ type: 'manual' }), 'recorded')
  assert.equal(initialRoundObjectionStatus(mapRoundObjectionToOperation(objections.room, 'T1')), 'proposed')
  assert.throws(() => mapRoundObjectionToOperation(objections.franja, ''))
})

test('R11 shape: invalid objection DTOs are rejected', () => {
  for (const value of Object.values(objections)) assert.doesNotThrow(() => validateAcademicRoundObjectionInput(value))
  const ids = (count) => Array.from({ length: count }, (_, index) => `S${index}`)
  const bad = [
    { kind: 'desconocida', sectionIds: ['S1'] }, { ...objections.other, sectionIds: [] }, { ...objections.other, sectionIds: ids(33) }, { ...objections.other, sectionIds: ['S1', 'S1'] },
    { ...objections.other, extra: 1 }, { ...objections.other, intervals: [monday(0, 60)] }, { ...objections.franja, intervals: [] },
    { ...objections.franja, intervals: Array.from({ length: 9 }, () => monday(0, 60)) }, { ...objections.franja, intervals: [monday(600, 480)] },
    { ...objections.franja, intervals: [{ day: 8, startMinute: 0, endMinute: 60 }] }, { ...objections.room, roomIds: [] },
    { ...objections.room, roomIds: ['R1', 'R1'] }, { ...objections.room, roomIds: Array.from({ length: 9 }, (_, index) => `R${index}`) },
    { ...objections.minutes, limit: {} }, { ...objections.minutes, limit: { maxWeeklyMinutes: -1 } }, { ...objections.minutes, limit: { maxWeeklyMinutes: 1.5 } },
    { ...objections.minutes, limit: { maxWeeklyMinutes: 60, courseId: 'C1', maxSections: 1 } }, { ...objections.sections, limit: { courseId: 'C1', maxSections: -1 } },
    { ...objections.sections, limit: { courseId: 'C1' } }, { ...objections.minutes, limit: null },
  ]
  for (const value of bad) assert.throws(() => validateAcademicRoundObjectionInput(value), TypeError, JSON.stringify(value))
  const decision = { expectedVersion: 3, round: 1, teacherId: 'T1', decision: 'changes-requested', observation: 'No puedo el lunes' }
  assert.doesNotThrow(() => validateAcademicRoundReviewDecision(decision), 'current client DTO without objection stays valid')
  assert.doesNotThrow(() => validateAcademicRoundReviewDecision({ ...decision, objection: objections.franja }))
  assert.throws(() => validateAcademicRoundReviewDecision({ ...decision, decision: 'conformity', observation: '', objection: objections.franja }), 'objection with conformity')
  assert.throws(() => validateAcademicRoundReviewDecision({ ...decision, observation: '' }), 'PA-DEMO-1 observation rule still applies')
  assert.throws(() => validateAcademicRoundReviewDecision({ ...decision, objection: undefined }))
  assert.throws(() => validateAcademicRoundReviewDecision({ ...decision, extra: 1 }))
})

const teacher = { id: 'T1', name: 'Docente sintético', courseIds: ['C1', 'C2'], maxWeeklyMinutes: 600, availability: [monday(480, 720), monday(720, 900)] }
const assignments = [
  { sectionId: 'S1', courseId: 'C1', teacherId: 'T1', roomId: 'R1' },
  { sectionId: 'S2', courseId: 'C1', teacherId: 'T1', roomId: 'R2' },
  { sectionId: 'S3', courseId: 'C2', teacherId: 'T2', roomId: 'R3' },
]

test('R11 semantics: objections that do not hold are refused with a specific message', () => {
  const context = { teacher, assignments }
  for (const value of Object.values(objections)) assert.deepEqual(checkRoundObjection(value, context), { ok: true, message: '' }, value.kind)
  const refused = (value) => { const result = checkRoundObjection(value, context); assert.equal(result.ok, false); assert.ok(result.message.length > 0); return result.message }
  refused({ ...objections.other, sectionIds: ['S3'] })
  refused({ ...objections.other, sectionIds: ['SX'] })
  refused({ ...objections.franja, intervals: [monday(400, 600)] })
  refused({ ...objections.franja, intervals: [{ day: 2, startMinute: 480, endMinute: 600 }] })
  assert.equal(checkRoundObjection({ ...objections.franja, intervals: [monday(600, 800)] }, context).ok, true, 'spans two adjacent declared intervals')
  refused({ ...objections.minutes, limit: { maxWeeklyMinutes: 600 } })
  refused({ ...objections.minutes, limit: { maxWeeklyMinutes: 900 } })
  refused({ ...objections.sections, limit: { courseId: 'C1', maxSections: 2 } })
  refused({ ...objections.sections, limit: { courseId: 'C2', maxSections: 0 } })
  refused({ ...objections.sections, sectionIds: ['S1'], limit: { courseId: 'C2', maxSections: 0 } })
  refused({ ...objections.room, roomIds: ['R3'] })
  refused({ ...objections.room, roomIds: ['R9'] })
  assert.throws(() => checkRoundObjection({ kind: 'otra', sectionIds: [] }, context), TypeError, 'shape is validated first')
})

test('operations apply deterministically to a teacher resource', () => {
  const removed = applyRoundOperationToTeacher(teacher, { type: 'remove-teacher-availability', teacherId: 'T1', intervals: [monday(540, 600), monday(600, 660), monday(840, 960)] })
  assert.deepEqual(removed.availability, [monday(480, 540), monday(660, 840)])
  assert.deepEqual(teacher.availability, [monday(480, 720), monday(720, 900)], 'input is not mutated')
  assert.deepEqual(subtractRoundIntervals([monday(480, 720), { day: 2, startMinute: 0, endMinute: 60 }], [{ day: 2, startMinute: 0, endMinute: 60 }]), [monday(480, 720)])
  assert.deepEqual(subtractRoundIntervals([monday(0, 100)], [monday(200, 300)]), [monday(0, 100)])
  const wide = { ...teacher, availability: Array.from({ length: 32 }, (_, index) => ({ day: 1 + (index % 7), startMinute: 480 + Math.floor(index / 7) * 200, endMinute: 600 + Math.floor(index / 7) * 200 })) }
  const cuts = wide.availability.map(({ day, startMinute }) => ({ day, startMinute: startMinute + 30, endMinute: startMinute + 60 }))
  assert.equal(applyRoundOperationToTeacher(wide, { type: 'remove-teacher-availability', teacherId: 'T1', intervals: cuts.slice(0, 8) }), null, 'over 32 intervals is stale')
  assert.equal(applyRoundOperationToTeacher(teacher, { type: 'limit-teacher-load', teacherId: 'T1', maxWeeklyMinutes: 300 }).maxWeeklyMinutes, 300)
  assert.deepEqual(applyRoundOperationToTeacher(teacher, { type: 'limit-teacher-sections', teacherId: 'T1', courseId: 'C1', maxSections: 1 }).sectionLimits, [{ courseId: 'C1', maxSections: 1 }])
  const limited = { ...teacher, sectionLimits: [{ courseId: 'C1', maxSections: 3 }, { courseId: 'C2', maxSections: 1 }] }
  assert.deepEqual(applyRoundOperationToTeacher(limited, { type: 'limit-teacher-sections', teacherId: 'T1', courseId: 'C1', maxSections: 1 }).sectionLimits, [{ courseId: 'C1', maxSections: 1 }, { courseId: 'C2', maxSections: 1 }])
  assert.equal(applyRoundOperationToTeacher({ ...limited, sectionLimits: [{ courseId: 'C1', maxSections: 1 }] }, { type: 'limit-teacher-sections', teacherId: 'T1', courseId: 'C1', maxSections: 2 }).sectionLimits[0].maxSections, 1, 'never raises a limit')
  assert.throws(() => applyRoundOperationToTeacher(teacher, { type: 'manual' }))
  assert.throws(() => applyRoundOperationToTeacher(teacher, { type: 'exclude-section-rooms', sectionIds: ['S1'], roomIds: ['R1'] }))
  assert.throws(() => applyRoundOperationToTeacher(teacher, { type: 'limit-teacher-load', teacherId: 'T2', maxWeeklyMinutes: 1 }))
})

test('endpoint DTOs for decide, regenerate and resolve are strict', () => {
  assert.doesNotThrow(() => validateAcademicRoundObjectionDecision({ expectedVersion: 2, decision: 'confirm', reason: '' }))
  assert.doesNotThrow(() => validateAcademicRoundObjectionDecision({ expectedVersion: 2, decision: 'reject', reason: 'No procede' }))
  for (const value of [
    { expectedVersion: 2, decision: 'reject', reason: '' }, { expectedVersion: 2, decision: 'maybe', reason: '' }, { expectedVersion: 2, decision: 'confirm', reason: ' x' },
    { expectedVersion: 2, decision: 'confirm', reason: 'x'.repeat(501) }, { expectedVersion: 0, decision: 'confirm', reason: '' }, { expectedVersion: 2, decision: 'confirm' },
  ]) assert.throws(() => validateAcademicRoundObjectionDecision(value), TypeError, JSON.stringify(value))
  assert.doesNotThrow(() => validateAcademicRoundRegenerationRequest({ expectedVersion: 5 }))
  for (const value of [{}, { expectedVersion: 5, scope: 'all' }, { expectedVersion: '5' }]) assert.throws(() => validateAcademicRoundRegenerationRequest(value))
  assert.doesNotThrow(() => validateAcademicRoundResolutionRequest({ expectedVersion: 5, teacherId: 'T2', reason: 'Resuelto por la escuela' }))
  for (const value of [{ expectedVersion: 5, teacherId: 'T2', reason: '' }, { expectedVersion: 5, teacherId: '', reason: 'x' }, { expectedVersion: 5, teacherId: 'T2', reason: 'x'.repeat(501) }, { expectedVersion: 5, teacherId: 'T2' }]) {
    assert.throws(() => validateAcademicRoundResolutionRequest(value), TypeError, JSON.stringify(value))
  }
  const regeneration = { status: 'complete', saved: true, fixedSectionIds: ['S1'], regeneratedSectionIds: ['S2'], appliedObjectionIds: ['objection-4'], diagnostics: [] }
  assert.doesNotThrow(() => validateAcademicRoundRegeneration(regeneration))
  assert.doesNotThrow(() => validateAcademicRoundRegeneration({ ...regeneration, status: 'search-limit', saved: false, appliedObjectionIds: [], diagnostics: [{ code: 'SEARCH_LIMIT', message: 'No se encontró solución dentro del límite', sessionIds: ['x'] }] }))
  for (const change of [{ status: 'impossible' }, { saved: 'yes' }, { status: 'other' }, { saved: false }, { fixedSectionIds: ['S1', 'S1'] }, { diagnostics: [{ code: 'X', message: 'm' }] }, { extra: 1 }]) {
    assert.throws(() => validateAcademicRoundRegeneration({ ...regeneration, ...change }), TypeError, JSON.stringify(change))
  }
})

function reviewOf(statuses, round = 3) {
  const history = []
  for (let n = 1; n <= round; n++) history.push({ type: 'submitted', version: 10 * n, round: n, at: '2027-01-01T00:00:00.000Z', teacherId: null, decision: null, observation: '', fingerprint: null })
  history.push({ type: 'decision', version: 31, round, at: '2027-01-02T00:00:00.000Z', teacherId: 'T2', decision: 'changes-requested', observation: 'No puedo', fingerprint: fp('b') })
  return {
    round, submittedVersion: 10 * round, submittedAt: '2027-01-01T00:00:00.000Z', history,
    teachers: statuses.map((status, index) => ({ teacherId: `T${index + 1}`, teacherName: `Docente ${index + 1}`, fingerprint: fp(index === 1 ? 'b' : 'a'), status, observation: '', decisionVersion: null, decidedAt: null })),
  }
}
function controlOf(extra = {}) {
  return {
    revision: 'PA-ROUNDS-1', profile: resolvePlanningRoundProfile({ schoolId: 'SISTEMAS', academicPeriod: '2027-I' }), legacyRounds: 0,
    rounds: [1, 2, 3].map((round) => ({ round, submittedVersion: 10 * round, deadline: round === 2 ? '2027-03-01' : null })),
    objections: [], regenerations: [], resolutions: [], ...extra,
  }
}
const record = (extra) => ({ ...objections.other, id: 'objection-31', round: 3, teacherId: 'T2', fingerprint: fp('b'), decisionVersion: 31, operation: { type: 'manual' }, status: 'recorded', decidedVersion: null, decidedAt: null, reason: '', appliedVersion: null, ...extra })

test('§8: readiness is one shared rule — conformity, or a school resolution only after the limit', () => {
  const review = reviewOf(['conformity', 'changes-requested'])
  const resolution = { teacherId: 'T2', fingerprint: fp('b'), version: 40, at: '2027-02-01T00:00:00.000Z', reason: 'Resuelto por la escuela' }
  assert.equal(isRoundReviewReady(reviewOf(['conformity', 'conformity']), undefined), true, 'legacy draft: PA-DEMO-1 rule')
  assert.equal(isRoundReviewReady(review, undefined), false)
  assert.equal(isRoundReviewReady(review, controlOf()), false, 'unresolved teacher')
  assert.equal(isRoundReviewReady(review, controlOf({ resolutions: [resolution] })), true)
  assert.deepEqual(resolvedRoundTeacherIds(review, controlOf({ resolutions: [resolution] })), ['T2'])
  assert.equal(isRoundReviewReady(reviewOf(['conformity', 'changes-requested'], 2), controlOf({ resolutions: [resolution] })), false, 'before the limit a resolution does not count')
  assert.equal(isRoundReviewReady(review, controlOf({ resolutions: [{ ...resolution, fingerprint: fp('c') }] })), false, 'a changed fingerprint voids the resolution')
  assert.equal(isRoundReviewReady(reviewOf(['conformity', 'outdated']), controlOf({ resolutions: [resolution] })), true, 'outdated entries hold the current fingerprint')
  assert.equal(isRoundReviewReady({ ...review, teachers: [] }, controlOf()), false, 'no teachers')
  assert.equal(isRoundReviewReady(undefined, undefined), false)
})

test('§9: the persisted control validates and rejects each inconsistency', () => {
  const review = reviewOf(['conformity', 'changes-requested'])
  assert.doesNotThrow(() => validateAcademicRoundControl(controlOf(), review, 50))
  assert.doesNotThrow(() => validateAcademicRoundControl(controlOf({ objections: [record()] }), review, 50))
  const resolution = { teacherId: 'T2', fingerprint: fp('b'), version: 40, at: '2027-02-01T00:00:00.000Z', reason: 'Resuelto' }
  assert.doesNotThrow(() => validateAcademicRoundControl(controlOf({ resolutions: [resolution] }), review, 50))
  const legacy = controlOf({ legacyRounds: 1, rounds: [2, 3].map((round) => ({ round, submittedVersion: 10 * round, deadline: null })) })
  assert.doesNotThrow(() => validateAcademicRoundControl(legacy, review, 50))
  const applied = record({ ...objections.room, id: 'objection-31', operation: { type: 'exclude-section-rooms', sectionIds: ['S1'], roomIds: ['R1'] }, status: 'applied', decidedVersion: 35, decidedAt: '2027-02-01T00:00:00.000Z', appliedVersion: 36 })
  const regeneration = { version: 36, at: '2027-02-02T00:00:00.000Z', fixedSectionIds: ['S3'], regeneratedSectionIds: ['S1'], appliedObjectionIds: ['objection-31'] }
  assert.doesNotThrow(() => validateAcademicRoundControl(controlOf({ objections: [applied], regenerations: [regeneration] }), review, 50))

  const cases = {
    'unknown revision': controlOf({ revision: 'PA-ROUNDS-2' }),
    'extra key': { ...controlOf(), extra: 1 },
    'round count': controlOf({ rounds: controlOf().rounds.slice(1) }),
    'non consecutive': controlOf({ rounds: [1, 3, 2].map((round) => ({ round, submittedVersion: 10 * round, deadline: null })) }),
    'version without event': controlOf({ rounds: controlOf().rounds.map((item, index) => (index ? item : { ...item, submittedVersion: 11 })) }),
    'bad deadline': controlOf({ rounds: controlOf().rounds.map((item, index) => (index ? item : { ...item, deadline: '2027-02-30' })) }),
    'legacy above round': controlOf({ legacyRounds: 4 }),
    'objection without event': controlOf({ objections: [record({ fingerprint: fp('c') })] }),
    'objection wrong id': controlOf({ objections: [record({ id: 'objection-99' })] }),
    'objection wrong operation': controlOf({ objections: [record({ operation: { type: 'limit-teacher-load', teacherId: 'T2', maxWeeklyMinutes: 1 } })] }),
    'otra proposed': controlOf({ objections: [record({ status: 'proposed' })] }),
    'franja recorded': controlOf({ objections: [record({ ...objections.franja, operation: mapRoundObjectionToOperation(objections.franja, 'T2') })] }),
    'decision on undecided': controlOf({ objections: [record({ decidedVersion: 33 })] }),
    'applied without regeneration': controlOf({ objections: [applied] }),
    'regeneration lists unapplied': controlOf({ regenerations: [regeneration] }),
    'rejected without reason': controlOf({ objections: [record({ ...objections.room, operation: { type: 'exclude-section-rooms', sectionIds: ['S1'], roomIds: ['R1'] }, status: 'rejected', decidedVersion: 35, decidedAt: '2027-02-01T00:00:00.000Z' })] }),
    'version above draft': controlOf({ objections: [record({ decisionVersion: 51, id: 'objection-51' })] }),
    'two active for one teacher and round': controlOf({ objections: [record(), record({ id: 'objection-32', decisionVersion: 32 })] }),
    'resolution unknown teacher': controlOf({ resolutions: [{ ...resolution, teacherId: 'T9' }] }),
    'resolution without reason': controlOf({ resolutions: [{ ...resolution, reason: '' }] }),
    'resolution before limit': controlOf({ resolutions: [resolution] }),
    'over capacity': controlOf({ resolutions: Array.from({ length: ROUND_RECORD_LIMIT + 1 }, () => resolution) }),
  }
  for (const [name, value] of Object.entries(cases)) {
    const target = name === 'resolution before limit' ? reviewOf(['conformity', 'changes-requested'], 2) : review
    const data = name === 'resolution before limit' ? { ...value, rounds: value.rounds.slice(0, 2) } : value
    assert.throws(() => validateAcademicRoundControl(data, target, 50), TypeError, name)
  }
  assert.throws(() => validateAcademicRoundControl(controlOf(), undefined, 50), TypeError, 'rounds need a review')
})

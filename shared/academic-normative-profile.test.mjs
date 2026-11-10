import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NormativeProfileGapError, loadAuthorizationBlockers, resolveNormativeProfile, teacherLoadLimits, teacherPrelation,
} from './academic-normative-profile.mjs'

const profile = resolveNormativeProfile({ facultyId: 'FISI', period: '2026-II' })
const ordinary = { appointment: 'faculty-ordinary' }
const de = { ...ordinary, regime: 'dedicacion-exclusiva' }
const tc = { ...ordinary, regime: 'tiempo-completo' }
const voluntary = { kind: 'voluntary-declaration', reference: 'DJ-SINT-1' }
const vrap = (maxLectiveHours) => ({ kind: 'vrap-authorization', reference: 'VRAP-SINT-1', maxLectiveHours })
const limits = (teacher, lectiveHourMinutes = 50) => teacherLoadLimits(profile, teacher, { lectiveHourMinutes })
const codes = (result) => result.gaps.map((item) => item.code)
const sourceIdsOf = () => new Set(profile.sources.map((source) => source.id))

test('profile: amended revision, sources A and B with classes, and the explicit gap list', () => {
  assert.equal(profile.revision, 'UNMSM-AAD-2026-04')
  const byId = new Map(profile.sources.map((source) => [source.id, source]))
  assert.equal(byId.get('OF-02').class, 'normative')
  assert.equal(byId.get('OF-02').date, '2026-02-06')
  assert.equal(byId.get('OF-07').class, 'normative')
  assert.equal(byId.get('OF-07').date, '2026-04-17')
  assert.ok(!/https?:\/\//.test(byId.get('OF-07').reference), 'the gob.pe URL was not recorded and must not be invented')
  for (const id of ['INF-APPOINTMENT-PRELATION', 'INF-PERFORMANCE-INACTIVE', 'INF-LEAVE-UNAVAILABLE', 'INF-VRAP-OVER-POSTGRADUATE']) assert.equal(byId.get(id).class, 'inferred')
  for (const source of profile.sources) assert.deepEqual(Object.keys(source).sort(), ['articles', 'class', 'date', 'id', 'reference', 'status', 'title'])
  const gapCodes = profile.gaps.map((item) => item.code)
  for (const code of ['FISI_LECTIVE_HOUR_UNVERIFIED', 'TP_MAXIMUM_NOT_REGULATED', 'CONTRACT_LOAD_NOT_REGULATED', 'PERFORMANCE_EVALUATION_NO_SOURCE', 'SOURCE_OF07_URL_NOT_RECORDED']) {
    assert.ok(gapCodes.includes(code), code)
  }
  assert.equal(profile.prelation.criteria.find((item) => item.id === 'performance-evaluation').active, false)
  // The returned profile is a copy: callers cannot corrupt the regulation.
  profile.loadRules.voluntaryDeclaration.maxLectiveHours = 99
  assert.equal(resolveNormativeProfile({ facultyId: 'FISI', period: '2026-II' }).loadRules.voluntaryDeclaration.maxLectiveHours, 20)
  profile.loadRules.voluntaryDeclaration.maxLectiveHours = 20
})

test('criterion 7: periods before 2026-II and unknown faculties throw the gap error, later periods resolve, bad input throws TypeError', () => {
  for (const period of ['2026-I', '2026-0', '2025-II', '2020-I']) {
    assert.throws(() => resolveNormativeProfile({ facultyId: 'FISI', period }), (error) => error instanceof NormativeProfileGapError && error.code === 'NORMATIVE_PROFILE_PERIOD_BEFORE_VALIDITY' && error.period === period)
  }
  assert.throws(() => resolveNormativeProfile({ facultyId: 'FMED', period: '2026-II' }), (error) => error instanceof NormativeProfileGapError && error.code === 'NORMATIVE_PROFILE_FACULTY_UNKNOWN')
  for (const period of ['2026-II', '2027-I', '2027-II', '2030-0']) assert.equal(resolveNormativeProfile({ facultyId: 'FISI', period }).revision, 'UNMSM-AAD-2026-04')
  for (const input of [undefined, {}, { facultyId: 'FISI' }, { period: '2026-II' }, { facultyId: 'FISI', period: '2026-III' }, { facultyId: '', period: '2026-II' }]) {
    assert.throws(() => resolveNormativeProfile(input), TypeError, JSON.stringify(input))
  }
})

test('criterion 1: DE and TC at 45, 50 and 60 minutes, without records, with a voluntary declaration and with a VRAP record', () => {
  for (const [minutes, hour] of [[45, 45], [50, 50], [60, 60]]) {
    for (const base of [de, tc]) {
      assert.deepEqual(
        (({ minimumMinutes, ordinaryMaxMinutes, authorizedMaxMinutes }) => ({ minimumMinutes, ordinaryMaxMinutes, authorizedMaxMinutes }))(limits(base, minutes)),
        { minimumMinutes: 10 * hour, ordinaryMaxMinutes: 12 * hour, authorizedMaxMinutes: 12 * hour }, `${base.regime} ${minutes}`,
      )
      assert.equal(limits({ ...base, loadAuthorizations: [voluntary] }, minutes).authorizedMaxMinutes, 20 * hour)
      assert.equal(limits({ ...base, loadAuthorizations: [vrap(24)] }, minutes).authorizedMaxMinutes, 24 * hour)
    }
  }
  const fifty = limits(de)
  assert.deepEqual([fifty.minimumMinutes, fifty.ordinaryMaxMinutes, fifty.authorizedMaxMinutes], [500, 600, 600])
  assert.equal(limits({ ...tc, loadAuthorizations: [voluntary] }).authorizedMaxMinutes, 1000)
  assert.equal(limits({ ...tc, loadAuthorizations: [vrap(24)] }).authorizedMaxMinutes, 1200)
  // A recorded VRAP authorization with a lower figure never reduces what the regulation already allows.
  assert.equal(limits({ ...tc, loadAuthorizations: [voluntary, vrap(15)] }).authorizedMaxMinutes, 1000)
  assert.deepEqual(codes(limits(de)), [])
})

test('criterion 2: the next regulated exception follows the recorded authorizations', () => {
  const first = limits(de).nextException
  assert.deepEqual([first.kind, first.maxMinutes], ['voluntary-declaration', 1000])
  assert.ok(first.requires.length >= 2 && first.sourceIds.includes('OF-02'))
  assert.equal(limits(de, 60).nextException.maxMinutes, 1200)
  const second = limits({ ...de, loadAuthorizations: [voluntary] }).nextException
  assert.deepEqual([second.kind, second.maxMinutes], ['vrap-authorization', null])
  assert.ok(second.requires.some((item) => /VRAP/.test(item)))
  assert.equal(limits({ ...de, loadAuthorizations: [voluntary, vrap(24)] }).nextException, null)
})

test('criterion 3: postgraduate cap, RENACYT minimum and leave', () => {
  const capped = limits({ ...tc, loadConditions: ['postgraduate-study'], loadAuthorizations: [voluntary] })
  assert.deepEqual([capped.minimumMinutes, capped.ordinaryMaxMinutes, capped.authorizedMaxMinutes], [500, 500, 500])
  assert.deepEqual([capped.nextException.kind, capped.nextException.maxMinutes], ['vrap-authorization', null])
  const overCap = limits({ ...tc, loadConditions: ['postgraduate-study'], loadAuthorizations: [vrap(14)] })
  assert.equal(overCap.authorizedMaxMinutes, 700)
  assert.ok(overCap.sourceIds.includes('INF-VRAP-OVER-POSTGRADUATE'), 'VRAP over the postgraduate cap is labeled as an interpretation')
  assert.ok(!capped.sourceIds.includes('INF-VRAP-OVER-POSTGRADUATE'))
  const researcher = limits({ ...de, loadConditions: ['renacyt-researcher'] })
  assert.deepEqual([researcher.minimumMinutes, researcher.ordinaryMaxMinutes, researcher.authorizedMaxMinutes], [300, 600, 600])
  const leave = limits({ ...de, loadConditions: ['on-leave'], loadAuthorizations: [voluntary] })
  assert.equal(leave.authorizedMaxMinutes, 0)
  assert.equal(leave.nextException, null)
  assert.ok(leave.sourceIds.includes('INF-LEAVE-UNAVAILABLE'))
  assert.ok(codes(leave).includes('ON_LEAVE_INFERRED'))
})

test('criterion 4: tiempo parcial minimum is 40 % of the weekly service hours and the maximum is an explicit gap', () => {
  const partTime = { ...ordinary, regime: 'tiempo-parcial', weeklyServiceHours: 20 }
  const result = limits(partTime)
  assert.equal(result.minimumMinutes, 8 * 50)
  assert.equal(limits({ ...partTime, weeklyServiceHours: 15 }, 45).minimumMinutes, 6 * 45)
  assert.equal(limits({ ...partTime, weeklyServiceHours: 13 }, 45).minimumMinutes, 234)
  assert.equal(result.ordinaryMaxMinutes, null)
  assert.equal(result.authorizedMaxMinutes, null)
  assert.equal(result.nextException, null)
  assert.ok(codes(result).includes('TP_MAXIMUM_NOT_REGULATED'))
  const missing = limits({ ...ordinary, regime: 'tiempo-parcial' })
  assert.equal(missing.minimumMinutes, null)
  assert.ok(codes(missing).includes('TP_SERVICE_HOURS_MISSING') && codes(missing).includes('TP_MAXIMUM_NOT_REGULATED'))
  assert.equal(limits({ ...partTime, loadConditions: ['postgraduate-study'] }).authorizedMaxMinutes, 500)
  assert.ok(codes(limits({ ...partTime, loadConditions: ['renacyt-researcher'] })).includes('RENACYT_TIEMPO_PARCIAL_UNRESOLVED'))
})

test('criterion 5: contract appointment and missing regime return nulls with explicit gap codes, never numbers', () => {
  for (const teacher of [{ appointment: 'contract', regime: 'tiempo-completo' }, { appointment: 'contract' }, { appointment: 'contract', regime: 'tiempo-parcial', weeklyServiceHours: 20 }]) {
    const result = limits(teacher)
    assert.deepEqual([result.minimumMinutes, result.ordinaryMaxMinutes, result.authorizedMaxMinutes, result.nextException], [null, null, null, null])
    assert.deepEqual(codes(result), ['CONTRACT_LOAD_NOT_REGULATED'])
  }
  const noRegime = limits({ ...ordinary })
  assert.deepEqual([noRegime.minimumMinutes, noRegime.ordinaryMaxMinutes, noRegime.authorizedMaxMinutes, noRegime.nextException], [null, null, null, null])
  assert.deepEqual(codes(noRegime), ['REGIME_MISSING'])
  assert.deepEqual(codes(limits({})), ['APPOINTMENT_MISSING', 'REGIME_MISSING'])
  // A missing appointment does not erase regulated limits for a known regime, but the scope check stays visible as a gap.
  const noAppointment = limits({ regime: 'tiempo-completo' })
  assert.equal(noAppointment.ordinaryMaxMinutes, 600)
  assert.deepEqual(codes(noAppointment), ['APPOINTMENT_MISSING'])
})

test('criterion 6: category rank follows the amended nine-way table and appointment tiers are 0, 1 and 2', () => {
  const regimes = ['dedicacion-exclusiva', 'tiempo-completo', 'tiempo-parcial']
  const ranks = []
  for (const category of ['principal', 'asociado', 'auxiliar']) {
    for (const regime of regimes) ranks.push(teacherPrelation(profile, { appointment: 'faculty-ordinary', category, regime }).categoryRank)
  }
  assert.deepEqual(ranks, [1, 2, 3, 4, 5, 6, 7, 8, 9])
  // The superseded February order (TP, TC, DE inside each category) must not be used.
  assert.ok(teacherPrelation(profile, { category: 'principal', regime: 'dedicacion-exclusiva' }).categoryRank < teacherPrelation(profile, { category: 'principal', regime: 'tiempo-parcial' }).categoryRank)
  assert.deepEqual(['faculty-ordinary', 'interfaculty-ordinary', 'contract'].map((appointment) => teacherPrelation(profile, { appointment }).appointmentTier), [0, 1, 2])
  const full = teacherPrelation(profile, { appointment: 'interfaculty-ordinary', category: 'asociado', regime: 'tiempo-completo' })
  assert.deepEqual([full.appointmentTier, full.categoryRank], [1, 5])
  assert.ok(full.sourceIds.includes('OF-07') && full.sourceIds.includes('INF-APPOINTMENT-PRELATION'))
  const empty = teacherPrelation(profile, {})
  assert.deepEqual([empty.appointmentTier, empty.categoryRank], [null, null])
  assert.deepEqual(empty.gaps.map((item) => item.code), ['APPOINTMENT_MISSING', 'CATEGORY_MISSING', 'REGIME_MISSING'])
  assert.deepEqual(teacherPrelation(profile, { appointment: 'faculty-ordinary', category: 'principal' }).categoryRank, null)
})

test('criterion 7: a missing or invalid lective hour duration, profile or teacher throws', () => {
  for (const value of [undefined, null, 0, 40, 55, 90, '50', 50.5]) {
    assert.throws(() => teacherLoadLimits(profile, de, { lectiveHourMinutes: value }), TypeError, String(value))
    assert.throws(() => loadAuthorizationBlockers(profile, [], {}, { lectiveHourMinutes: value }), TypeError, String(value))
  }
  assert.throws(() => teacherLoadLimits(profile, de), TypeError)
  assert.throws(() => teacherLoadLimits({}, de, { lectiveHourMinutes: 50 }), TypeError)
  assert.throws(() => teacherLoadLimits({ ...profile, revision: 'OTHER' }, de, { lectiveHourMinutes: 50 }), TypeError)
  for (const teacher of [null, { regime: 'medio-tiempo' }, { weeklyServiceHours: 40 }, { loadConditions: ['unknown'] }, { loadAuthorizations: [{ kind: 'vrap-authorization', reference: 'X' }] }]) {
    assert.throws(() => teacherLoadLimits(profile, teacher, { lectiveHourMinutes: 50 }), TypeError, JSON.stringify(teacher))
  }
})

test('criterion 8: blockers list exactly the teachers above their authorized maximum with the right authorization', () => {
  const teachers = [
    { id: 'T-OK', ...de },
    { id: 'T-12', ...tc },
    { id: 'T-22', ...tc },
    { id: 'T-VOL', ...tc, loadAuthorizations: [voluntary] },
    { id: 'T-VRAP', ...tc, loadAuthorizations: [voluntary, vrap(24)] },
    { id: 'T-CONTRACT', appointment: 'contract' },
    { id: 'T-TP', ...ordinary, regime: 'tiempo-parcial', weeklyServiceHours: 20 },
    { id: 'T-LEAVE', ...de, loadConditions: ['on-leave'] },
    { id: 'T-POST', ...de, loadConditions: ['postgraduate-study'], loadAuthorizations: [voluntary] },
  ]
  const assigned = { 'T-OK': 600, 'T-12': 650, 'T-22': 1100, 'T-VOL': 1050, 'T-VRAP': 1250, 'T-CONTRACT': 9000, 'T-TP': 9000, 'T-LEAVE': 50, 'T-POST': 550 }
  const blockers = loadAuthorizationBlockers(profile, teachers, assigned, { lectiveHourMinutes: 50 })
  assert.deepEqual(blockers.map((item) => [item.teacherId, item.assignedMinutes, item.authorizedMaxMinutes, item.requiredAuthorization]), [
    ['T-12', 650, 600, 'voluntary-declaration'],
    ['T-22', 1100, 600, 'vrap-authorization'],
    ['T-VOL', 1050, 1000, 'vrap-authorization'],
    ['T-VRAP', 1250, 1200, 'vrap-authorization'],
    ['T-LEAVE', 50, 0, 'vrap-authorization'],
    ['T-POST', 550, 500, 'vrap-authorization'],
  ])
  assert.deepEqual(loadAuthorizationBlockers(profile, teachers, new Map(Object.entries(assigned)), { lectiveHourMinutes: 50 }), blockers)
  // Exactly at the authorized maximum is allowed; nothing is listed when all are within limits; unassigned teachers count as zero.
  const within = { 'T-OK': 600, 'T-12': 600, 'T-22': 600, 'T-VOL': 1000, 'T-VRAP': 1200, 'T-LEAVE': 0, 'T-POST': 500, 'T-TP': 9000 }
  assert.deepEqual(loadAuthorizationBlockers(profile, teachers, within, { lectiveHourMinutes: 50 }), [])
  assert.deepEqual(loadAuthorizationBlockers(profile, teachers, {}, { lectiveHourMinutes: 50 }), [])
  assert.deepEqual(loadAuthorizationBlockers(profile, [], {}, { lectiveHourMinutes: 50 }), [])
  assert.throws(() => loadAuthorizationBlockers(profile, [{ id: 'T' }], { T: -1 }, { lectiveHourMinutes: 50 }), TypeError)
})

test('criterion 9: every limit, prelation and blocker carries sourceIds resolvable in the profile with an article', () => {
  const known = sourceIdsOf(profile)
  const teachers = [
    de, tc, { ...tc, loadAuthorizations: [voluntary, vrap(24)] }, { ...de, loadConditions: ['renacyt-researcher', 'postgraduate-study'] }, { ...de, loadConditions: ['on-leave'] },
    { ...ordinary, regime: 'tiempo-parcial', weeklyServiceHours: 20 }, { appointment: 'contract' }, {},
  ]
  for (const teacher of teachers) {
    const result = limits(teacher)
    assert.ok(result.sourceIds.length > 0 && result.sourceIds.every((id) => known.has(id)), JSON.stringify(teacher))
    assert.ok(result.articles.length > 0)
    if (result.nextException) assert.ok(result.nextException.sourceIds.every((id) => known.has(id)))
    const prelation = teacherPrelation(profile, { ...teacher, category: 'principal' })
    assert.ok(prelation.sourceIds.every((id) => known.has(id)))
  }
  for (const group of Object.values(profile.loadRules)) {
    for (const entry of group.sourceIds ? [group] : Object.values(group)) assert.ok(entry.sourceIds.every((id) => known.has(id)) && entry.articles.length > 0)
  }
  for (const criterion of profile.prelation.criteria) assert.ok(criterion.sourceIds.every((id) => known.has(id)))
  const [blocker] = loadAuthorizationBlockers(profile, [{ id: 'T', ...tc }], { T: 9999 }, { lectiveHourMinutes: 50 })
  assert.ok(blocker.sourceIds.every((id) => known.has(id)))
})

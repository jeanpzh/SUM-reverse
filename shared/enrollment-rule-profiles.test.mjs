import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ENROLLMENT_RULE_ISSUE_CODES, ENROLLMENT_RULE_MESSAGES, evaluateCreditRange, evaluateRetakeInclusion, resolveEnrollmentRuleProfile, ruleProfileMissingIssue,
  validateEnrollmentRuleProfile,
} from './enrollment-rule-profiles.mjs'

const scope = { schoolId: 'SISTEMAS', academicPeriod: '2027-I' }
const profile = resolveEnrollmentRuleProfile(scope)
const none = { kind: 'none', applicability: 'not-applicable' }
const codes = (issues) => issues.map((item) => item.code)

test('E1: the profile resolves only for its synthetic scope and labels every value with its sources', () => {
  assert.equal(profile.profileId, 'E2-SYN-SIS-2027-I-1')
  assert.deepEqual(profile.scope, { facultyId: 'FISI', schoolId: 'SISTEMAS', academicPeriod: '2027-I' })
  assert.deepEqual([profile.creditRange.min, profile.creditRange.max], [12, 26])
  assert.deepEqual(profile.creditExceptions.enabled, ['remaining-for-completion', 'return-after-suspension', 'plan-change-no-offer'])
  assert.equal(profile.retakeInclusion.mode, 'mandatory-inclusion')
  assert.doesNotThrow(() => validateEnrollmentRuleProfile(profile))
  for (const wrong of [{ schoolId: 'SISTEMAS', academicPeriod: '2026-II' }, { schoolId: 'SOFTWARE', academicPeriod: '2027-I' }, { academicPeriod: '2027-I' }, {}, null, 'SISTEMAS']) {
    assert.equal(resolveEnrollmentRuleProfile(wrong), null, JSON.stringify(wrong))
  }
  const byId = new Map(profile.sources.map((source) => [source.id, source]))
  for (const group of [profile.creditRange, profile.creditExceptions, profile.retakeInclusion]) assert.ok(group.sourceIds.length > 0 && group.sourceIds.every((id) => byId.has(id)))
  // Norms are normative; applying them here, the exceptions and the retake mode are local decisions; open questions stay unverified.
  assert.equal(byId.get('RN-01').class, 'normative')
  assert.equal(byId.get('L-ENR-SYN-1').status, 'local-only')
  assert.equal(byId.get('PROP-6').status, 'local-only')
  for (const id of ['Q-02', 'Q-16', 'PROP-13.2']) assert.equal(byId.get(id).status, 'unverified', id)
  assert.ok(profile.creditRange.sourceIds.includes('L-ENR-SYN-1') && profile.creditRange.sourceIds.includes('Q-02'), 'range is not presented as an official FISI value')
  assert.ok(profile.retakeInclusion.sourceIds.includes('PROP-13.2'), 'retake scope stays pending with the faculty')
  profile.creditRange.max = 99
  assert.equal(resolveEnrollmentRuleProfile(scope).creditRange.max, 26, 'registry is not mutable through a returned copy')
  profile.creditRange.max = 26
})

test('profile validator rejects incoherent profiles', () => {
  const base = resolveEnrollmentRuleProfile(scope)
  const bad = [
    { revision: 'ENR-RULES-2' }, { extra: 1 }, { scope: { ...base.scope, facultyId: 'FIA' } }, { scope: { ...base.scope, schoolId: 'SOFTWARE' } }, { scope: { ...base.scope, academicPeriod: '' } },
    { creditRange: { ...base.creditRange, min: 27 } }, { creditRange: { ...base.creditRange, min: 0 } }, { creditRange: { ...base.creditRange, max: 12.5 } }, { creditRange: { ...base.creditRange, sourceIds: ['NOPE'] } },
    { creditRange: { ...base.creditRange, sourceIds: [] } }, { creditExceptions: { ...base.creditExceptions, enabled: ['everything'] } },
    { creditExceptions: { ...base.creditExceptions, enabled: ['remaining-for-completion', 'remaining-for-completion'] } },
    { retakeInclusion: { ...base.retakeInclusion, mode: 'optional' } }, { sources: [] }, { sources: [...base.sources, base.sources[0]] },
    { sources: base.sources.map((source, index) => (index ? source : { ...source, status: 'official' })) },
  ]
  for (const change of bad) assert.throws(() => validateEnrollmentRuleProfile({ ...base, ...change }), TypeError, JSON.stringify(change).slice(0, 80))
})

test('E2: credit range boundaries (11, 12, 26, 27 and empty selection)', () => {
  const run = (selectedCredits, selectedCount = 3, exception = none) => evaluateCreditRange({ profile, selectedCredits, selectedCount, exception })
  assert.deepEqual(codes(run(11)), ['CREDIT_BELOW_MIN'])
  assert.deepEqual(run(12), [])
  assert.deepEqual(run(26), [])
  assert.deepEqual(codes(run(27)), ['CREDIT_ABOVE_MAX'])
  assert.deepEqual(run(0, 0), [], 'empty selection is EMPTY_SELECTION territory')
  assert.deepEqual(run(40, 0), [])
  assert.deepEqual(run(18), [])
  const below = run(11)[0]
  assert.deepEqual(below, { kind: 'unmet', code: 'CREDIT_BELOW_MIN', message: ENROLLMENT_RULE_MESSAGES.CREDIT_BELOW_MIN, courseIds: [], sectionIds: [] })
  assert.equal(run(27)[0].kind, 'unmet')
  assert.equal(codes(run(27, 3, { kind: 'remaining-for-completion', applicability: 'applicable' })).join(), 'CREDIT_ABOVE_MAX', 'an exception never lifts the maximum')
  assert.throws(() => run(-1)); assert.throws(() => run(Number.NaN)); assert.throws(() => run(12, 1.5)); assert.throws(() => run('12'))
  assert.throws(() => run(12, 1, { kind: 'other', applicability: 'applicable' })); assert.throws(() => run(12, 1, { kind: 'none', applicability: 'maybe' }))
})

test('E3: exceptions below the minimum — applicable, not applicable, unknown, kind not enabled', () => {
  const run = (exception, active = profile) => codes(evaluateCreditRange({ profile: active, selectedCredits: 8, selectedCount: 2, exception }))
  for (const kind of ['remaining-for-completion', 'return-after-suspension', 'plan-change-no-offer']) {
    assert.deepEqual(run({ kind, applicability: 'applicable' }), [], `${kind} applicable`)
    assert.deepEqual(run({ kind, applicability: 'not-applicable' }), ['CREDIT_BELOW_MIN'], `${kind} not applicable`)
    assert.deepEqual(run({ kind, applicability: 'unknown' }), ['CREDIT_EXCEPTION_UNKNOWN'], `${kind} unknown`)
  }
  assert.equal(evaluateCreditRange({ profile, selectedCredits: 8, selectedCount: 2, exception: { kind: 'return-after-suspension', applicability: 'unknown' } })[0].kind, 'insufficient')
  assert.deepEqual(run({ kind: 'none', applicability: 'applicable' }), ['CREDIT_BELOW_MIN'], 'kind none is never an exception')
  const narrowed = { ...profile, creditExceptions: { ...profile.creditExceptions, enabled: ['remaining-for-completion'] } }
  assert.deepEqual(run({ kind: 'return-after-suspension', applicability: 'applicable' }, narrowed), ['CREDIT_BELOW_MIN'], 'kind not enabled in the profile')
  assert.deepEqual(run({ kind: 'remaining-for-completion', applicability: 'applicable' }, narrowed), [])
  const stricter = { ...profile, creditRange: { ...profile.creditRange, min: 15, max: 20 } }
  assert.deepEqual(codes(evaluateCreditRange({ profile: stricter, selectedCredits: 14, selectedCount: 1, exception: none })), ['CREDIT_BELOW_MIN'], 'values come from the profile, not the evaluator')
  assert.deepEqual(codes(evaluateCreditRange({ profile: stricter, selectedCredits: 21, selectedCount: 1, exception: none })), ['CREDIT_ABOVE_MAX'])
  assert.throws(() => evaluateCreditRange({ profile: { ...profile, revision: 'x' }, selectedCredits: 12, selectedCount: 1, exception: none }), TypeError, 'an invalid profile is never used')
})

test('E4: retake inclusion', () => {
  const base = { profile, offeredCourseIds: ['C1', 'C2'], selectedCourseIds: ['C9'] }
  const run = (failedCourses, extra = {}) => evaluateRetakeInclusion({ ...base, failedCourses, ...extra })
  const retake = { courseId: 'C1', attempts: 1, eligible: true }
  assert.deepEqual(run([retake]), [{ kind: 'unmet', code: 'RETAKE_REQUIRED', message: ENROLLMENT_RULE_MESSAGES.RETAKE_REQUIRED, courseIds: ['C1'], sectionIds: [] }])
  assert.deepEqual(codes(run([{ ...retake, attempts: 2 }])), ['RETAKE_REQUIRED'], 'two failures are still a mandatory retake')
  assert.deepEqual(run([retake], { selectedCourseIds: ['C1'] }), [], 'selected')
  assert.deepEqual(run([retake], { offeredCourseIds: ['C2'] }), [], 'not offered')
  assert.deepEqual(run([{ ...retake, eligible: false }]), [], 'not eligible (prerequisites stay with the eligibility check)')
  const three = run([{ ...retake, attempts: 3 }])
  assert.deepEqual(three, [{ kind: 'insufficient', code: 'REPETITION_RULE_NOT_EVALUATED', message: ENROLLMENT_RULE_MESSAGES.REPETITION_RULE_NOT_EVALUATED, courseIds: ['C1'], sectionIds: [] }])
  assert.deepEqual(codes(run([{ ...retake, attempts: 4 }])), ['REPETITION_RULE_NOT_EVALUATED'])
  const seatPriority = { ...profile, retakeInclusion: { ...profile.retakeInclusion, mode: 'seat-priority' } }
  assert.deepEqual(run([retake], { profile: seatPriority }), [], 'seat priority adds nothing in E2')
  assert.deepEqual(codes(run([{ ...retake, attempts: 3 }], { profile: seatPriority })), ['REPETITION_RULE_NOT_EVALUATED'], 'arts. 19 and 20 are not evaluated in either mode')
  assert.deepEqual(run([]), [])
  const many = run([{ courseId: 'C2', attempts: 1, eligible: true }, { courseId: 'C1', attempts: 3, eligible: true }, { courseId: 'C0', attempts: 1, eligible: true }], { offeredCourseIds: ['C0', 'C1', 'C2'] })
  assert.deepEqual(many.map((item) => [item.code, item.courseIds[0]]), [['RETAKE_REQUIRED', 'C0'], ['REPETITION_RULE_NOT_EVALUATED', 'C1'], ['RETAKE_REQUIRED', 'C2']], 'deterministic order by course')
  assert.throws(() => run([retake, retake])); assert.throws(() => run([{ ...retake, attempts: 0 }])); assert.throws(() => run([{ ...retake, eligible: 'yes' }]))
  assert.throws(() => run([retake], { selectedCourseIds: 'C1' })); assert.throws(() => run([{ ...retake, extra: 1 }]))
})

test('E1/§3.3: a missing profile is an explicit blocking issue and every code has its placeholder message', () => {
  assert.deepEqual(ruleProfileMissingIssue(), { kind: 'insufficient', code: 'RULE_PROFILE_MISSING', message: 'No existe un perfil de reglas para este periodo.', courseIds: [], sectionIds: [] })
  assert.deepEqual(Object.keys(ENROLLMENT_RULE_MESSAGES).sort(), [...ENROLLMENT_RULE_ISSUE_CODES].sort())
  assert.equal(resolveEnrollmentRuleProfile({ schoolId: 'SISTEMAS', academicPeriod: '2026-II' }), null, 'no fallback to the 2027-I profile')
  assert.throws(() => evaluateCreditRange({ profile: null, selectedCredits: 12, selectedCount: 1, exception: none }), TypeError, 'evaluators never run without a profile')
  assert.throws(() => evaluateRetakeInclusion({ profile: null, failedCourses: [], offeredCourseIds: [], selectedCourseIds: [] }), TypeError)
})

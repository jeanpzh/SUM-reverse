import assert from 'node:assert/strict'
import test from 'node:test'
import {
  planningDefaults, validatePlanningPolicy, syntheticTeachingMetadata, PLANNING_LIMITS,
  resolvePlanningTimeProfile, isAllowedPlanningInterval, getEffectivePlanningWindows,
} from './academic-planning-policy.mjs'
import { ACADEMIC_REVISION, validateAcademicRequest, validateAcademicResources } from './programacion-academica-api.mjs'

test('semester parity supplies editable 180/90 demand with 45 seats for all ten cycles', () => {
  for (let cycle = 1; cycle <= 10; cycle++) {
    assert.deepEqual(planningDefaults(cycle, '2027-I'), { estimatedDemand: cycle % 2 ? 180 : 90, targetCapacity: 45 })
    assert.deepEqual(planningDefaults(cycle, '2026-II'), { estimatedDemand: cycle % 2 ? 90 : 180, targetCapacity: 45 })
  }
  for (const cycle of [0, 11, 1.5, '1']) assert.throws(() => planningDefaults(cycle, '2027-I'))
  for (const period of ['2027-1', '27-I', '2027-III']) assert.throws(() => planningDefaults(1, period))
})

test('planning policy is optional, preserves legacy shape, supports explicit profile exceptions and rejects unknown faculties', () => {
  const policy = { revision: 'FISI-PLANNING-1', period: '2027-I', allowAfternoon: false, allowSaturday: false }
  const request = { revision: ACADEMIC_REVISION, demands: [] }
  assert.doesNotThrow(() => validateAcademicRequest(request))
  assert.doesNotThrow(() => validateAcademicRequest({ ...request, planningPolicy: policy }))
  for (const change of [
    { revision: 'unknown' }, { allowSaturday: 1 }, { period: '2027-1' }, { period: '2027-I\n' }, { unknown: true },
    { facultyId: 'FIEE' }, { facultyId: 'UNKNOWN' }, { source: '' },
    { exceptions: { saturdayEndMinute: 840 } }, // requires allowSaturday: true
    { allowSaturday: true, exceptions: { saturdayStartMinute: 900, saturdayEndMinute: 840 } },
    { allowSaturday: true, exceptions: { unknownException: true } },
  ]) {
    assert.throws(() => validatePlanningPolicy({ ...policy, ...change }))
  }

  const legacyProfile = resolvePlanningTimeProfile(policy)
  assert.equal(legacyProfile.facultyId, 'FISI')
  assert.equal(legacyProfile.saturdayEndMinute, 780)
  assert.equal(isAllowedPlanningInterval(7, { day: 5, startMinute: 840, endMinute: 1020 }, policy), false)

  const sat14 = { ...policy, facultyId: 'FISI', source: 'synthetic-test', allowAfternoon: true, allowSaturday: true, exceptions: { saturdayEndMinute: 840 } }
  assert.doesNotThrow(() => validatePlanningPolicy(sat14))
  assert.equal(isAllowedPlanningInterval(6, { day: 6, startMinute: 720, endMinute: 840 }, sat14), true)
  assert.equal(isAllowedPlanningInterval(6, { day: 6, startMinute: 840, endMinute: 960 }, sat14), false)
  assert.equal(isAllowedPlanningInterval(7, { day: 5, startMinute: 840, endMinute: 1020 }, sat14), true)

  const sat1418 = { ...policy, facultyId: 'FISI', source: 'synthetic-test', allowSaturday: true, exceptions: { saturdayStartMinute: 840, saturdayEndMinute: 1080 } }
  const effective = getEffectivePlanningWindows([{ day: 1, startMinute: 480, endMinute: 1320 }], sat1418)
  assert.deepEqual(effective[1], { day: 6, startMinute: 840, endMinute: 1080 })
  assert.equal(isAllowedPlanningInterval(4, { day: 6, startMinute: 840, endMinute: 1080 }, sat1418), true)
  assert.equal(isAllowedPlanningInterval(4, { day: 6, startMinute: 480, endMinute: 600 }, sat1418), false)
})

test('whole synthetic inventory fits the new bounds without removing request limits', () => {
  const availability = [{ day: 1, startMinute: 480, endMinute: 1320 }]
  const resources = {
    teachers: Array.from({ length: 128 }, (_, index) => ({ id: `T${index}`, name: `Sintético ${index}`, courseIds: ['C1'], maxWeeklyMinutes: 2400, availability, ...syntheticTeachingMetadata(index) })),
    rooms: Array.from({ length: 128 }, (_, index) => ({ id: `R${index}`, name: `Aula ${index}`, kind: 'classroom', capacity: 45, availability })),
  }
  assert.doesNotThrow(() => validateAcademicResources(resources))
  const request = { revision: ACADEMIC_REVISION, demands: Array.from({ length: PLANNING_LIMITS.courses }, (_, index) => ({ courseId: `C${index}`, estimatedDemand: 180, targetCapacity: 45 })), resources }
  assert.doesNotThrow(() => validateAcademicRequest(request))
  for (const key of ['teachers', 'rooms']) {
    const overflow = structuredClone(resources)
    overflow[key].push({ ...overflow[key][0], id: 'OVERFLOW' })
    assert.throws(() => validateAcademicResources(overflow))
  }
})


test('effective Saturday windows replace earlier values and remain idempotent', () => {
  const policy = { revision: 'FISI-PLANNING-1', period: '2027-I', allowAfternoon: false, allowSaturday: true,
    exceptions: { saturdayStartMinute: 840, saturdayEndMinute: 1080 } }
  const base = [{ day: 1, startMinute: 480, endMinute: 1320 }, { day: 6, startMinute: 480, endMinute: 780 }]
  const effective = getEffectivePlanningWindows(base, policy)
  assert.deepEqual(effective, [base[0], { day: 6, startMinute: 840, endMinute: 1080 }])
  assert.deepEqual(getEffectivePlanningWindows(effective, policy), effective)
  const closed = { ...policy, allowSaturday: false }
  delete closed.exceptions
  assert.deepEqual(getEffectivePlanningWindows(base, closed), [base[0]])
})

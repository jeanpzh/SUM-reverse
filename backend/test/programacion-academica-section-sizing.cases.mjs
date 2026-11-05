import assert from 'node:assert/strict'
import { calculateRequiredSections, validateCourseDemand } from '../src/programacion-academica/section-sizing.ts'
import { createSyntheticCourseDemands } from '../src/programacion-academica/programacion-academica.fixtures.ts'

/** One set of cases registered by both Node and Vitest. */
export function registerSectionSizingTests(test) {
  const demand = () => ({ courseId: 'SYN-PLANNING-A', estimatedDemand: 70, targetCapacity: 30 })

  for (const [estimatedDemand, targetCapacity, expected] of [
    [0, 30, 0], [60, 30, 2], [30, 30, 1], [70, 30, 3], [1, 30, 1], [31, 30, 2],
    [Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER],
  ]) {
    test(`demand ${estimatedDemand}, capacity ${targetCapacity}: ${expected} sections`, () => {
      const input = { ...demand(), estimatedDemand, targetCapacity }
      assert.deepEqual(calculateRequiredSections(input), { ...input, requiredSections: expected })
    })
  }

  for (const targetCapacity of [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '30', null, undefined]) {
    test(`reject invalid target capacity ${String(targetCapacity)}`, () => {
      assert.throws(() => calculateRequiredSections({ ...demand(), targetCapacity }), /targetCapacity/)
    })
  }

  for (const estimatedDemand of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '70', null, undefined]) {
    test(`reject invalid demand ${String(estimatedDemand)}`, () => {
      assert.throws(() => calculateRequiredSections({ ...demand(), estimatedDemand }), /estimatedDemand/)
    })
  }

  for (const courseId of ['', '   ', ' SYN-A', 'SYN-A ', 123, null, undefined]) {
    test(`reject invalid course ID ${String(courseId)}`, () => {
      assert.throws(() => calculateRequiredSections({ ...demand(), courseId }), /courseId/)
    })
  }

  for (const input of [null, undefined, [], 'course', 12, new Date(0)]) {
    test(`reject non-record input ${String(input)}`, () => {
      assert.throws(() => calculateRequiredSections(input), TypeError)
    })
  }

  for (const field of ['courseId', 'estimatedDemand', 'targetCapacity']) {
    test(`require own field ${field}`, () => {
      const input = demand()
      delete input[field]
      assert.throws(() => validateCourseDemand(input), new RegExp(`${field}: campo obligatorio`))
    })
  }

  test('reject unknown fields, including a caller-supplied result', () => {
    assert.throws(() => calculateRequiredSections({ ...demand(), requiredSections: 99 }), /requiredSections/)
  })

  test('reject inherited inputs', () => {
    assert.throws(() => validateCourseDemand(Object.create(demand())), TypeError)
  })

  test('return a new result without mutating input', () => {
    const input = Object.freeze(demand())
    assert.notEqual(calculateRequiredSections(input), input)
    assert.deepEqual(input, demand())
  })

  test('synthetic fixtures produce 3, 2 and 0 sections and are independent copies', () => {
    const fixtures = createSyntheticCourseDemands()
    assert.deepEqual(fixtures.map(calculateRequiredSections).map((result) => result.requiredSections), [3, 2, 0])
    assert.equal(new Set(fixtures.map((input) => input.courseId)).size, fixtures.length)
    fixtures[0].estimatedDemand = 999
    assert.equal(createSyntheticCourseDemands()[0].estimatedDemand, 70)
  })
}

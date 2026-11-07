import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateAcademicRequest } from './programacion-academica-api.mjs'

const request = (demand = {}) => ({ revision: 'PA-DEMO-1', demands: [{ courseId: 'C1', estimatedDemand: 90, targetCapacity: 45, ...demand }] })

test('F-0: sectionCapacities is optional and absence keeps the current request valid', () => {
  assert.doesNotThrow(() => validateAcademicRequest(request()))
  assert.doesNotThrow(() => validateAcademicRequest(request({ sectionCapacities: [] })))
})

test('F-0: a valid per-section override is accepted, including bounds', () => {
  assert.doesNotThrow(() => validateAcademicRequest(request({ sectionCapacities: [{ ordinal: 1, capacity: 1 }, { ordinal: 2, capacity: 1000 }] })))
})

test('F-0 R5: ordinal, capacity, duplicates, size and shape are rejected', () => {
  for (const sectionCapacities of [
    [{ ordinal: 0, capacity: 30 }],
    [{ ordinal: -1, capacity: 30 }],
    [{ ordinal: 3, capacity: 30 }],
    [{ ordinal: 1.5, capacity: 30 }],
    [{ ordinal: '1', capacity: 30 }],
    [{ ordinal: 1, capacity: 0 }],
    [{ ordinal: 1, capacity: 1001 }],
    [{ ordinal: 1, capacity: 30.5 }],
    [{ ordinal: 1, capacity: 30 }, { ordinal: 1, capacity: 31 }],
    [{ ordinal: 1 }],
    [{ capacity: 30 }],
    [{ ordinal: 1, capacity: 30, extra: true }],
    [null],
    'x',
    { ordinal: 1, capacity: 30 },
  ]) assert.throws(() => validateAcademicRequest(request({ sectionCapacities })), TypeError, JSON.stringify(sectionCapacities))
})

test('F-0 R5: more than 32 entries are rejected', () => {
  const entries = (count) => Array.from({ length: count }, (_, index) => ({ ordinal: index + 1, capacity: 10 }))
  assert.doesNotThrow(() => validateAcademicRequest(request({ estimatedDemand: 32, targetCapacity: 1, sectionCapacities: entries(32) })))
  assert.throws(() => validateAcademicRequest(request({ estimatedDemand: 33, targetCapacity: 1, sectionCapacities: entries(33) })), TypeError)
})

test('F-0: the ordinal is bounded by ceil(estimatedDemand / targetCapacity)', () => {
  assert.doesNotThrow(() => validateAcademicRequest(request({ estimatedDemand: 91, sectionCapacities: [{ ordinal: 3, capacity: 30 }] })))
  assert.throws(() => validateAcademicRequest(request({ estimatedDemand: 90, sectionCapacities: [{ ordinal: 3, capacity: 30 }] })), TypeError)
  assert.throws(() => validateAcademicRequest(request({ estimatedDemand: 0, sectionCapacities: [{ ordinal: 1, capacity: 30 }] })), TypeError)
})

test('F-0: without an explicit targetCapacity the catalog-dependent upper bound is left to the service', () => {
  const demand = { courseId: 'C1', estimatedDemand: 90, sectionCapacities: [{ ordinal: 99, capacity: 30 }] }
  assert.doesNotThrow(() => validateAcademicRequest({ revision: 'PA-DEMO-1', demands: [demand] }))
  assert.throws(() => validateAcademicRequest({ revision: 'PA-DEMO-1', demands: [{ ...demand, sectionCapacities: [{ ordinal: 0, capacity: 30 }] }] }), TypeError)
})

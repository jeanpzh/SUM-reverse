import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTourStepTransition } from '../components/ui/tourNavigation.ts'

// Synthetic navigation only; lives here to run in the existing test:data harness.
test('tour visits all five steps forward and backward and completes after the last', () => {
  let value = 0
  for (const next of [1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5]) {
    const transition = getTourStepTransition(value, next, 5)
    assert.deepEqual(transition, { previousValue: value, value: next, complete: next === 5 })
    value = transition.value
  }
})

test('tour clamps boundary requests and supports shorter or empty step lists', () => {
  assert.deepEqual(getTourStepTransition(0, -1, 5), { previousValue: 0, value: 0, complete: false })
  assert.deepEqual(getTourStepTransition(4, 99, 5), { previousValue: 4, value: 5, complete: true })
  assert.deepEqual(getTourStepTransition(3, 4, 4), { previousValue: 3, value: 4, complete: true })
  assert.deepEqual(getTourStepTransition(0, 1, 0), { previousValue: 0, value: 0, complete: true })
})

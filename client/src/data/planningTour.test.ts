import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTourArrowKeyRequest, getTourStepTransition } from '../components/ui/tourNavigation.ts'

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

test('tour arrow keys request the next or previous step and swap in right-to-left', () => {
  assert.equal(getTourArrowKeyRequest('ArrowRight', 'ltr', 2), 3)
  assert.equal(getTourArrowKeyRequest('ArrowLeft', 'ltr', 2), 1)
  assert.equal(getTourArrowKeyRequest('ArrowRight', 'rtl', 2), 1)
  assert.equal(getTourArrowKeyRequest('ArrowLeft', 'rtl', 2), 3)
})

test('tour arrow keys ignore other keys and never go before the first step', () => {
  assert.equal(getTourArrowKeyRequest('ArrowLeft', 'ltr', 0), null)
  assert.equal(getTourArrowKeyRequest('ArrowRight', 'rtl', 0), null)
  assert.equal(getTourArrowKeyRequest('ArrowUp', 'ltr', 1), null)
  assert.equal(getTourArrowKeyRequest('Enter', 'ltr', 1), null)
})

test('tour arrow key past the last step completes through the shared transition', () => {
  const request = getTourArrowKeyRequest('ArrowRight', 'ltr', 4)
  assert.equal(request, 5)
  assert.deepEqual(getTourStepTransition(4, request as number, 5), { previousValue: 4, value: 5, complete: true })
})

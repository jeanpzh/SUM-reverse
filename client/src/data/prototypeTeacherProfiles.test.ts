import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROTOTYPE_TEACHER_PROFILES, prototypeProfileFor } from '../../../shared/prototype-teacher-profiles.mjs'

test('looks a profile up by reference code and returns null otherwise', () => {
  assert.equal(PROTOTYPE_TEACHER_PROFILES.length, 91)
  assert.deepEqual(prototypeProfileFor('REF-TEACHER-003'), { id: 'REF-TEACHER-003', regime: 'contratado', dedication: 'TP' })
  assert.equal(prototypeProfileFor('REF-TEACHER-001')?.regime, 'ordinario')
  assert.equal(prototypeProfileFor('REF-TEACHER-999'), null)
  assert.equal(prototypeProfileFor(''), null)
})

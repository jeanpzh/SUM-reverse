import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parsePlanningView } from './planningSession.ts'

test('preparation views accept the three URL values', () => {
  for (const view of ['resumen', 'cursos', 'recursos'] as const) {
    assert.equal(parsePlanningView(view, 'preparacion'), view)
  }
})

test('missing and invalid preparation views default to summary', () => {
  for (const value of [undefined, null, '', 'semana', 'CURSOS', 1, ['cursos'], { vista: 'cursos' }]) {
    assert.equal(parsePlanningView(value), 'resumen')
  }
})

test('other stages drop the preparation view', () => {
  for (const stage of ['horario', 'revision', 'aprobacion'] as const) {
    for (const value of ['resumen', 'cursos', 'recursos', undefined, 'invalid']) {
      assert.equal(parsePlanningView(value, stage), undefined)
    }
  }
})

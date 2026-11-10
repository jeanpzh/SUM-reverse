import assert from 'node:assert/strict'
import { test } from 'node:test'
import { regimeNamedIn } from './normativeRegime.ts'

test('detects an explicitly named regime, with or without accents', () => {
  assert.equal(regimeNamedIn('¿Cuál es la carga lectiva máxima para un docente ordinario?'), 'ordinario')
  assert.equal(regimeNamedIn('¿Y para los docentes ORDINARIOS?'), 'ordinario')
  assert.equal(regimeNamedIn('Un profesor contratado, ¿cuántas horas?'), 'contratado')
})

test('returns null when no regime or conflicting regimes are named', () => {
  assert.equal(regimeNamedIn('¿Cuál es la carga lectiva máxima?'), null)
  assert.equal(regimeNamedIn('Ordinario o contratado, ¿qué cambia?'), null)
  assert.equal(regimeNamedIn('¿Quién aprueba la asignación?'), null)
})

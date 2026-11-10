import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateAcademicNormativeResponse } from './programacion-academica-api.mjs'
const response = {
  revision: 'PA-NORMATIVE-1', question: 'carga', context: {
    facultyId: 'FISI', academicPeriod: '2026-II', asOf: '2026-11-08', teacherType: 'unknown',
  }, status: 'not-determined', answer: 'Sin evidencia suficiente.', retrievalMode: 'lexical-only', citations: [], gaps: [],
}
test('old response and optional real generation mode are accepted', () => {
  validateAcademicNormativeResponse(response)
  for (const generation of [
    { mode: 'extractive', providerLabel: null, fallbackReason: 'disabled' },
    { mode: 'extractive', providerLabel: null },
    { mode: 'llm-assisted', providerLabel: 'synthetic provider' },
  ]) validateAcademicNormativeResponse({ ...response, generation })
})
test('generation rejects fabricated modes, invalid fields and false provider claims', () => {
  for (const generation of [null, {}, { mode: 'invented', providerLabel: null },
    { mode: 'llm-assisted', providerLabel: null },
    { mode: 'extractive', providerLabel: 'provider' },
    { mode: 'extractive', providerLabel: null, fallbackReason: null },
    { mode: 'extractive', providerLabel: null, extra: true },
    { mode: 'llm-assisted', providerLabel: 'provider', fallbackReason: 'timeout' },
  ]) assert.throws(() => validateAcademicNormativeResponse({ ...response, generation }))
})

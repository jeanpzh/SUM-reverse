import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateAcademicNormativeRequest, validateAcademicNormativeResponse } from './programacion-academica-api.mjs'
const req = { question: 'carga lectiva', facultyId: 'FISI', academicPeriod: '2027-I', asOf: '2026-11-08', teacherType: 'unknown' }
const response = { revision: 'PA-NORMATIVE-1', question: req.question, context: { facultyId: 'FISI', academicPeriod: req.academicPeriod, asOf: req.asOf, teacherType: req.teacherType }, status: 'not-determined', answer: 'Sin evidencia; no concede autorización.', retrievalMode: 'unavailable', citations: [], gaps: ['Corpus parcial'] }
test('bounded previous user question is optional and stays out of response context', () => {
  const contextual = { ...req, previousQuestion: '¿Cuánto dura la hora académica?' }
  validateAcademicNormativeRequest(contextual)
  validateAcademicNormativeResponse(response, contextual)
  for (const previousQuestion of ['', ' ', 'x'.repeat(1001), [], null]) {
    assert.throws(() => validateAcademicNormativeRequest({ ...req, previousQuestion }))
  }
  assert.throws(() => validateAcademicNormativeResponse({ ...response, context: { ...response.context, previousQuestion: 'otra' } }))
})
test('strict normative request: dates, bounds and unknown fields', () => {
  validateAcademicNormativeRequest(req)
  for (const patch of [{ question: ' ' }, { question: 'x'.repeat(1001) }, { asOf: '2026-02-30' }, { asOf: '2026-1-01' }, { facultyId: 'OTHER' }, { filePath: '/tmp/x' }, { url: 'https://invalid' }, { teacherType: 'principal' }]) assert.throws(() => validateAcademicNormativeRequest({ ...req, ...patch }))
})
test('response identity, explicit gaps and status cannot imply approval', () => {
  validateAcademicNormativeResponse(response, req)
  validateAcademicNormativeResponse({ ...response, nextStep: 'Verifica el acuerdo del periodo.' }, req)
  for (const nextStep of ['', ' ', 'x'.repeat(501), null, []]) assert.throws(() => validateAcademicNormativeResponse({ ...response, nextStep }, req))
  for (const patch of [{ revision: 'other' }, { context: { ...response.context, asOf: '2027-01-01' } }, { question: 'otra' }, { status: 'supported' }, { extra: true }, { retrievalMode: 'semantic' }, { answer: 'x'.repeat(6001) }]) assert.throws(() => validateAcademicNormativeResponse({ ...response, ...patch }, req))
})
test('citations require reviewed HTTPS allowlist and physical page', () => {
  const citation = { id: 'synthetic', documentId: 'synthetic', title: 'Synthetic', article: 'Synthetic article', page: 1, url: 'https://medicina.unmsm.edu.pe/wp-content/uploads/2026/03/RESOLUCION-RECTORAL-001380-2026-R-ANEXO.pdf', excerpt: 'Independently synthetic excerpt', sourceClass: 'normative', scope: 'UNMSM', reviewedAt: '2026-11-08', effectiveFrom: null, effectiveTo: null }
  validateAcademicNormativeResponse({ ...response, citations: [citation] }, req)
  for (const patch of [{ url: 'https://example.org/x.pdf' }, { url: 'file:///tmp/x' }, { page: 0 }, { effectiveFrom: '2027-01-01' }, { reviewedAt: '2026-02-30' }]) assert.throws(() => validateAcademicNormativeResponse({ ...response, citations: [{ ...citation, ...patch }] }, req))
})

test('Nest fallback increase-load scenario requires authorization and is never selected by default', async () => {
  const { buildLocalDeterministicAdvisor } = await import('../backend/dist/programacion-academica/planning-engine.client.js')
  const teacher = { id: 'synthetic-T', name: 'Independent synthetic teacher', courseIds: ['synthetic-C'], maxWeeklyMinutes: 60, availability: [] }
  const course = { courseId: 'synthetic-C', name: 'Independent synthetic course', weeklySessions: [{ id: 'T', durationMinutes: 120 }], cycle: 1 }
  const proposal = { assignments: [], diagnostics: [], pending: [{ courseId: course.courseId, sectionId: 'synthetic-S', sessionId: 'synthetic-component', durationMinutes: 120 }], counts: { scheduledSessions: 0, requiredSessions: 1 } }
  const before = structuredClone(teacher)
  const result = buildLocalDeterministicAdvisor(proposal, { teachers: [teacher], courses: [course] }, { teachers: [teacher], rooms: [] }, { courses: [course] })
  const increase = result.recommendations.find((r) => r.patch.kind === 'increase_teacher_load')
  assert.ok(increase)
  assert.equal(increase.recommendedByDefault, false)
  assert.match(increase.rationale, /autorización externa/)
  assert.deepEqual(teacher, before)
})

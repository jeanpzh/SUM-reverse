// Independently constructed synthetic contract envelopes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAcademicAdvisorRequest, validateAcademicAdvisorResponse } from './programacion-academica-api.mjs'
const response = () => ({
  proposalId: 'synthetic', editVersion: 2,
  source: { mode: 'deterministic-fallback', providerLabel: null, fallbackReason: 'not_configured' },
  summary: 'Diagnóstico sintético', bottlenecks: [], recommendations: [],
})
const impact = () => ({ currentScheduledSessions: 0, projectedScheduledSessions: 0, requiredSessions: 2,
  currentCompleteSections: 0, projectedCompleteSections: 0, totalSections: 1,
  recommendationIds: [], solverStatus: 'impossible' })
test('old and optional selection envelopes, empty selection, reject extra and duplicate inputs', () => {
  validateAcademicAdvisorRequest({ expectedEditVersion: 2 })
  validateAcademicAdvisorRequest({ expectedEditVersion: 2, selectedRecommendationIds: [] })
  for (const input of [{ expectedEditVersion: 2, selectedRecommendationIds: ['x', 'x'] }, { expectedEditVersion: 2, selectedRecommendationIds: null }, { expectedEditVersion: -1 }, { expectedEditVersion: 2, patches: [] }]) {
    assert.throws(() => validateAcademicAdvisorRequest(input))
  }
})
test('old responses and verified empty selection remain compatible', () => {
  validateAcademicAdvisorResponse(response())
  validateAcademicAdvisorResponse({ ...response(), verifiedImpact: impact(), reasoningSteps: [
    { toolName: 'inspect_diagnosis', inputSummary: '{}', outputSummary: '{}' },
    { toolName: 'request_variants', inputSummary: '{"kind":"delivery_mode"}', outputSummary: '[]' },
    { toolName: 'simulate_patches_cpsat', inputSummary: '[]', outputSummary: '0/1' },
  ] })
})
test('reject incomplete, fabricated, out of range and unknown impact or trace fields', () => {
  for (const patch of [{ projectedScheduledSessions: 3 }, { projectedScheduledSessions: 0.5 }, { solverStatus: 'complete' }, { solverStatus: 'optimal' }, { recommendationIds: ['unknown'] }, { totalSections: -1 }, { hidden: 'thoughts' }]) {
    assert.throws(() => validateAcademicAdvisorResponse({ ...response(), verifiedImpact: { ...impact(), ...patch } }))
  }
  const incomplete = impact()
  delete incomplete.totalSections
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), verifiedImpact: incomplete }))
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), reasoningSteps: [{ toolName: 'fabricated', inputSummary: '{}', outputSummary: 'ok' }] }))
})

const citation = (id = 'cit-1') => ({
  id, documentId: 'doc-1', title: 'Resolución sintética', article: 'Artículo 7',
  page: 1, url: 'https://medicina.unmsm.edu.pe/wp-content/uploads/2026/03/RESOLUCION-RECTORAL-001380-2026-R.pdf',
  excerpt: 'Extracto sintético de contraste documental.', sourceClass: 'normative', scope: 'UNMSM',
  reviewedAt: '2026-11-08', effectiveFrom: null, effectiveTo: null,
})
const contrast = () => ({
  topic: 'teacher_load', status: 'not-determined', citations: [citation('cit-1')],
  gaps: ['Corpus parcial'], requiresExternalAuthorization: true,
  authorizationNote: 'Requiere autorización externa.',
})
const recWithContrast = (override = {}) => ({
  id: 'rec-load', title: 'Ampliar carga', rationale: 'Escenario sintético',
  impactSummary: 'Destraba 1 componente', recommendedByDefault: false,
  patch: { kind: 'increase_teacher_load', adjustments: [{ teacherId: 'T1', previousMaxWeeklyMinutes: 600, nextMaxWeeklyMinutes: 720 }] },
  normativeContrast: { ...contrast(), ...override },
})
const mgmtAction = (override = {}) => ({
  id: 'mgmt-1', kind: 'process_load_authorization', title: 'Gestionar autorización',
  detail: 'Requiere trámite administrativo.', relatedCategory: 'teacher_load',
  affectedSessionCount: 3, citations: [citation('cit-1')], executable: false, ...override,
})

test('validates optional normativeContrast and managementActions envelopes strictly', () => {
  validateAcademicAdvisorResponse({
    ...response(),
    recommendations: [
      recWithContrast(),
      {
        ...recWithContrast({ topic: 'delivery_mode', requiresExternalAuthorization: false, authorizationNote: null }),
        id: 'rec-delivery',
        patch: { kind: 'change_delivery_mode', courseIds: ['C1'], deliveryMode: 'split' },
      },
    ],
    managementActions: [mgmtAction()],
  })

  // Invalid enums
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), recommendations: [recWithContrast({ topic: 'unknown_topic' })] }))
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), recommendations: [recWithContrast({ status: 'approved' })] }))
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), managementActions: [mgmtAction({ kind: 'auto_apply' })] }))
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), managementActions: [mgmtAction({ relatedCategory: 'unknown' })] }))

  // executable: true rejected
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), managementActions: [mgmtAction({ executable: true })] }))

  // Extra keys rejected
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), recommendations: [recWithContrast({ extraKey: 1 })] }))
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), managementActions: [mgmtAction({ extraKey: 1 })] }))

  // Max lengths enforced (citations <= 3 on contrast, gaps <= 4, managementActions <= 5, action citations <= 2)
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), recommendations: [recWithContrast({ citations: [citation('1'), citation('2'), citation('3'), citation('4')] })] }))
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), recommendations: [recWithContrast({ gaps: ['g1', 'g2', 'g3', 'g4', 'g5'] })] }))
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), managementActions: Array.from({ length: 6 }, (_, i) => mgmtAction({ id: `m-${i}` })) }))
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), managementActions: [mgmtAction({ citations: [citation('1'), citation('2'), citation('3')] })] }))

  // authorizationNote consistency with requiresExternalAuthorization
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), recommendations: [recWithContrast({ requiresExternalAuthorization: true, authorizationNote: null })] }))
  assert.throws(() => validateAcademicAdvisorResponse({ ...response(), recommendations: [recWithContrast({ requiresExternalAuthorization: false, authorizationNote: 'Sobran notas' })] }))
})

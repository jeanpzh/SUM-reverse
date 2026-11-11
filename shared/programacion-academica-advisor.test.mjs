// Independently constructed synthetic contract envelopes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAcademicAdvisorPatch, validateAcademicAdvisorRequest, validateAcademicAdvisorResponse } from './programacion-academica-api.mjs'
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
  validateAcademicAdvisorResponse({ ...response(), verifiedImpact: impact(), reasoningSteps: [{ toolName: 'simulate_patches_cpsat', inputSummary: '[]', outputSummary: '0/1' }] })
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

const fixture = () => ({ proposalId: 'SYN', editVersion: 0, source: { mode: 'engine-decisions', providerLabel: null }, summary: 'Synthetic', bottlenecks: [],
  recommendations: [{ id: 'SYN-rec', title: 'Window', rationale: 'Retained', impactSummary: 'Necessary', recommendedByDefault: false, decisionIds: ['SYN-decision'], patch: { kind: 'enable_planning_window', allowAfternoon: true } }] })
test('engine source and decision traces reject invalid, duplicate and stale identities; legacy remains readable', () => {
  validateAcademicAdvisorResponse(fixture(), [{ id: 'SYN-decision' }])
  for (const ids of [[], [''], ['SYN-decision', 'SYN-decision'], ['stale']]) {
    const response = fixture(); response.recommendations[0].decisionIds = ids
    assert.throws(() => validateAcademicAdvisorResponse(response, [{ id: 'SYN-decision' }]))
  }
  for (const extra of [{ verifiedImpact: {} }, { reasoningSteps: [] }, { source: { mode: 'engine-decisions', providerLabel: 'LLM' } }, { source: { mode: 'engine-decisions', providerLabel: null, fallbackReason: 'timeout' } }]) assert.throws(() => validateAcademicAdvisorResponse({ ...fixture(), ...extra }))
  const legacy = fixture(); legacy.source = { mode: 'deterministic-fallback', providerLabel: null }; delete legacy.recommendations[0].decisionIds
  validateAcademicAdvisorResponse(legacy)
})

test('combined window patches validate both parts while old patches remain readable', () => {
  const old = { kind: 'enable_planning_window', allowSaturday: true }
  assert.doesNotThrow(() => validateAcademicAdvisorPatch(old))
  assert.doesNotThrow(() => validateAcademicAdvisorPatch({ ...old, splitCourseIds: ['SYN-C'] }))
  for (const fields of [{ allowSaturday: false }, { splitCourseIds: [] }, { splitCourseIds: null },
    { splitCourseIds: [1] }, { splitCourseIds: [''] }, { splitCourseIds: ['SYN-C', 'SYN-C'] }]) {
    assert.throws(() => validateAcademicAdvisorPatch({ ...old, splitCourseIds: ['SYN-C'], ...fields }))
  }
})

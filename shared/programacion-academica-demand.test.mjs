import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateAcademicDemandRequest, validateAcademicDemandEstimate } from './programacion-academica-api.mjs'

const request = () => ({ revision: 'PA-DEMO-1', sourceId: 'independent-120-v1', targetPeriod: '2027-I', courses: [{ courseId: '20118104', targetCapacity: 45 }] })
const estimate = () => ({
  revision: 'PA-DEMO-1',
  source: { id: 'independent-120-v1', label: '120 casos construidos independientemente', revision: 'DEMAND-SYN-1', kind: 'synthetic', targetPeriod: '2027-I', cutoffPeriod: '2026-1', schoolId: 'SISTEMAS', planId: 'SYN-SIS-PLAN', populationSize: 120, recordCount: 120, duplicateRecords: 0, reference: 'Synthetic fixture', limitations: ['No representa intención de matrícula.'] },
  rows: [{ courseId: '20118104', eligible: 60, retakeEligible: 24, nonEligible: 36, insufficient: 24, baseDemand: 60, targetCapacity: 45, suggestedSections: 2,
    reasons: [{ category: 'non-eligible', code: 'ALREADY_APPROVED', message: 'Ya aprobadas', count: 36 }, { category: 'insufficient', code: 'HISTORY_UNKNOWN', message: 'Información insuficiente', count: 24 }] }],
})

test('potential demand request is bounded, explicit and cannot supply its own student authority', () => {
  assert.doesNotThrow(() => validateAcademicDemandRequest(request()))
  assert.doesNotThrow(() => validateAcademicDemandRequest({ ...request(), courses: [] }))
  for (const patch of [
    { sourceId: 'private-snapshot' }, { targetPeriod: '2026-II' }, { students: [] }, { authority: {} },
    { courses: [{ courseId: '20118104', targetCapacity: 0 }] },
    { courses: [{ courseId: '20118104', targetCapacity: 1.5 }] },
    { courses: [{ courseId: '20118104', targetCapacity: '45' }] },
    { courses: [{ courseId: '20118104', targetCapacity: 45, eligible: 180 }] },
    { courses: [request().courses[0], request().courses[0]] },
    { courses: Array.from({ length: 33 }, (_, index) => ({ courseId: `C${index}`, targetCapacity: 45 })) },
  ]) assert.throws(() => validateAcademicDemandRequest({ ...request(), ...patch }))
})

test('eligibility partitions, retake subset and upward section rounding are enforced', () => {
  assert.doesNotThrow(() => validateAcademicDemandEstimate(estimate()))
  for (const mutate of [
    (v) => { v.rows[0].eligible = 84 },
    (v) => { v.rows[0].retakeEligible = 61 },
    (v) => { v.rows[0].baseDemand = 84 },
    (v) => { v.rows[0].suggestedSections = 1 },
    (v) => { v.rows[0].targetCapacity = 0 },
    (v) => { v.rows[0].insufficient = -1 },
    (v) => { v.rows.push(structuredClone(v.rows[0])) },
  ]) { const value = estimate(); mutate(value); assert.throws(() => validateAcademicDemandEstimate(value)) }
  const zero = estimate()
  zero.rows[0] = { ...zero.rows[0], eligible: 0, retakeEligible: 0, baseDemand: 0, nonEligible: 120, insufficient: 0, suggestedSections: 0, reasons: [{ category: 'non-eligible', code: 'ALREADY_APPROVED', message: 'Ya aprobadas', count: 120 }] }
  assert.doesNotThrow(() => validateAcademicDemandEstimate(zero))
  const exact = estimate()
  exact.rows[0].targetCapacity = 30
  assert.doesNotThrow(() => validateAcademicDemandEstimate(exact))
})

test('unknown cases cannot disappear and reasons must sum without duplication', () => {
  for (const mutate of [
    (v) => { v.rows[0].reasons = [] },
    (v) => { v.rows[0].reasons[0].count = 35 },
    (v) => { v.rows[0].reasons[1].category = 'eligible' },
    (v) => { v.rows[0].reasons.push(structuredClone(v.rows[0].reasons[0])) },
    (v) => { v.rows[0].reasons[0].count = 0 },
  ]) { const value = estimate(); mutate(value); assert.throws(() => validateAcademicDemandEstimate(value)) }
})

test('only synthetic aggregate provenance is exposed, without personal fields', () => {
  for (const mutate of [
    (v) => { v.students = [] },
    (v) => { v.source.kind = 'institutional' },
    (v) => { v.source.schoolId = 'SOFTWARE' },
    (v) => { v.source.planId = 'UNKNOWN' },
    (v) => { v.source.populationSize = 121 },
    (v) => { v.source.duplicateRecords = 1 },
    (v) => { v.source.limitations = [] },
    (v) => { v.source.studentNames = [] },
    (v) => { v.rows[0].actorIds = [] },
    (v) => { v.rows[0].reasons[0].studentName = 'PRIVATE' },
  ]) { const value = estimate(); mutate(value); assert.throws(() => validateAcademicDemandEstimate(value)) }
  const duplicates = estimate()
  duplicates.source.recordCount = 130
  duplicates.source.duplicateRecords = 10
  assert.doesNotThrow(() => validateAcademicDemandEstimate(duplicates))
})

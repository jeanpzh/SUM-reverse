import { describe, expect, it } from 'vitest'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import { createDemandSources } from '../src/programacion-academica/demand-fixtures.js'
import type { DemandLearner } from '../src/programacion-academica/demand-fixtures.js'
import { estimateAcademicDemand } from '../src/programacion-academica/demand-estimator.js'

const catalog = createDemoCatalog()
const sources = createDemandSources(catalog)
const request = (sourceId: 'existing-regular-v1' | 'independent-120-v1' = 'independent-120-v1', targetCapacity = 25) => ({
  revision: 'PA-DEMO-1', sourceId, targetPeriod: '2027-I',
  courses: [{ courseId: '20118104', targetCapacity }],
})
const row = (sourceId: 'existing-regular-v1' | 'independent-120-v1' = 'independent-120-v1', capacity = 25) =>
  estimateAcademicDemand(catalog, sources, request(sourceId, capacity)).rows[0]!

function oneLearner(changes: Partial<DemandLearner> = {}): DemandLearner {
  const original = sources.get('independent-120-v1')!.records[0]!.learner
  return { ...structuredClone(original), identity: 'SYN-TEST-001', attempts: [], equivalentCourseCodes: [], ...changes }
}

function setPopulation(learners: DemandLearner[]): void {
  const source = sources.get('existing-regular-v1')!
  source.records = learners.map((learner, index) => ({ learner, recordId: `test-${index + 1}` }))
  source.metadata.populationSize = learners.length
  source.metadata.recordCount = learners.length
  source.metadata.duplicateRecords = 0
}

describe('synthetic academic demand estimation', () => {
  it('uses only two regular SIS profiles and isolates the independent 120-profile formula', () => {
    const regular = row('existing-regular-v1')
    expect(sources.get('existing-regular-v1')!.metadata.populationSize).toBe(2)
    expect(regular.eligible + regular.nonEligible + regular.insufficient).toBe(2)
    expect(sources.get('independent-120-v1')!.metadata.populationSize).toBe(120)
    expect(sources.get('independent-120-v1')!.metadata.recordCount).toBe(132)
    expect(sources.get('independent-120-v1')!.metadata.duplicateRecords).toBe(12)
    expect(row()).toMatchObject({ eligible: 60, retakeEligible: 24, nonEligible: 36, insufficient: 24, baseDemand: 60 })
  })

  it('counts each stable identity once despite duplicate records and multiple failed attempts', () => {
    const result = row()
    expect(result.eligible).toBe(60)
    expect(result.retakeEligible).toBe(24)
    expect(result.reasons.find((reason) => reason.code === 'PREREQUISITE_NOT_MET')?.count).toBe(12)
  })

  it('marks contradictory duplicate identities insufficient without merging their approvals', () => {
    const source = sources.get('existing-regular-v1')!
    const original = source.records[0]!
    const conflict = structuredClone(original)
    conflict.recordId = 'conflict-copy'
    conflict.learner.attempts.push({ courseCode: '20118104', period: '2026-1', result: 'approved' })
    source.records.push(conflict)
    source.metadata.recordCount++
    source.metadata.duplicateRecords++
    const result = row('existing-regular-v1')
    expect(result.insufficient).toBe(1)
    expect(result.reasons.find((reason) => reason.code === 'INVALID_RECORD')?.count).toBe(1)
    source.records.pop()
    source.metadata.recordCount--
    source.metadata.duplicateRecords--
  })

  it('treats reordered identical duplicate projections as the same record', () => {
    const source = sources.get('existing-regular-v1')!
    const duplicate = structuredClone(source.records[0]!)
    duplicate.recordId = 'reordered-copy'
    duplicate.learner.courses.reverse()
    duplicate.learner.attempts.reverse()
    source.records.push(duplicate)
    source.metadata.recordCount++
    source.metadata.duplicateRecords++
    expect(row('existing-regular-v1').insufficient).toBe(0)
    source.records.pop()
    source.metadata.recordCount--
    source.metadata.duplicateRecords--
  })

  it('filters attempts after cutoff and recognizes a later approval at or before cutoff', () => {
    const learner = oneLearner({ attempts: [
      { courseCode: '20118095', period: '2026-1', result: 'approved' },
      { courseCode: '20118104', period: '2025-1', result: 'failed' },
      { courseCode: '20118104', period: '2026-2', result: 'approved' },
    ] })
    setPopulation([learner])
    expect(row('existing-regular-v1')).toMatchObject({ eligible: 1, retakeEligible: 1 })
    learner.attempts.push({ courseCode: '20118104', period: '2026-1', result: 'approved' })
    expect(row('existing-regular-v1')).toMatchObject({ eligible: 0, nonEligible: 1, retakeEligible: 0 })
  })

  it('requires all prerequisites and accepts an explicit equivalence for the course or its prerequisite', () => {
    const learner = oneLearner({
      courses: [
        { courseCode: '20118104', name: 'ERP', prerequisiteIds: ['P1', 'P2'] },
        { courseCode: 'P1', name: 'Prerequisite one', prerequisiteIds: [] },
        { courseCode: 'P2', name: 'Prerequisite two', prerequisiteIds: [] },
      ],
      attempts: [{ courseCode: 'P1', period: '2026-1', result: 'approved' }],
    })
    setPopulation([learner])
    expect(row('existing-regular-v1')).toMatchObject({ eligible: 0, nonEligible: 1 })
    learner.equivalentCourseCodes = ['P2']
    expect(row('existing-regular-v1')).toMatchObject({ eligible: 1, nonEligible: 0 })
    learner.equivalentCourseCodes = ['20118104']
    expect(row('existing-regular-v1')).toMatchObject({ eligible: 0, nonEligible: 1 })
  })

  it('keeps unknown plan, mapping, history and equivalence states out of eligible counts', () => {
    const learner = oneLearner({ attempts: [{ courseCode: '20118095', period: '2026-1', result: 'approved' }], planKnown: false })
    setPopulation([learner])
    expect(row('existing-regular-v1').reasons).toContainEqual(expect.objectContaining({ category: 'insufficient', code: 'UNKNOWN_PLAN', count: 1 }))
    learner.planKnown = true
    learner.historyKnown = false
    expect(row('existing-regular-v1').reasons).toContainEqual(expect.objectContaining({ code: 'UNKNOWN_HISTORY', count: 1 }))
    learner.historyKnown = true
    learner.equivalencesKnown = false
    learner.equivalentCourseCodes = ['20118104']
    expect(row('existing-regular-v1').reasons).toContainEqual(expect.objectContaining({ code: 'UNKNOWN_EQUIVALENCES', count: 1 }))
    learner.equivalentCourseCodes = []
    learner.equivalencesKnown = true
    learner.courses.find((course) => course.courseCode === '20118104')!.prerequisiteIds = ['UNMAPPED']
    expect(row('existing-regular-v1').reasons).toContainEqual(expect.objectContaining({ code: 'INVALID_MAPPING', count: 1 }))
  })

  it('uses the existing section-sizing calculation for zero, exact and rounded capacities', () => {
    const learners = Array.from({ length: 3 }, (_, index) => oneLearner({
      identity: `SYN-SECTION-${index + 1}`,
      attempts: [{ courseCode: '20118095', period: '2026-1', result: 'approved' }],
    }))
    setPopulation(learners)
    expect(estimateAcademicDemand(catalog, sources, { ...request('existing-regular-v1'), courses: [{ courseId: '20118104', targetCapacity: 3 }] }).rows[0]!.suggestedSections).toBe(1)
    expect(estimateAcademicDemand(catalog, sources, { ...request('existing-regular-v1'), courses: [{ courseId: '20118104', targetCapacity: 2 }] }).rows[0]!.suggestedSections).toBe(2)
    expect(estimateAcademicDemand(catalog, sources, { ...request('existing-regular-v1'), courses: [{ courseId: '20118104', targetCapacity: 4 }] }).rows[0]!.suggestedSections).toBe(1)
    for (const learner of learners) learner.attempts.push({ courseCode: '20118104', period: '2025-1', result: 'approved' })
    expect(estimateAcademicDemand(catalog, sources, request('existing-regular-v1')).rows[0]!.suggestedSections).toBe(0)
  })

  it('keeps malformed dates and courses outside a learner plan out of the eligible total', () => {
    const outsidePlan = oneLearner({ identity: 'SYN-OUTSIDE-001', courses: oneLearner().courses.filter((course) => course.courseCode !== '20118104'), attempts: [] })
    const malformed = oneLearner({ identity: 'SYN-MALFORMED-001', attempts: [{ courseCode: '20118095', period: '20X6-1', result: 'approved' }] })
    setPopulation([outsidePlan, malformed])
    const result = row('existing-regular-v1')
    expect(result.eligible).toBe(0)
    expect(result.nonEligible).toBe(1)
    expect(result.insufficient).toBe(1)
    expect(result.reasons).toContainEqual(expect.objectContaining({ code: 'COURSE_NOT_IN_PLAN', count: 1 }))
    expect(result.reasons).toContainEqual(expect.objectContaining({ code: 'INVALID_RECORD', count: 1 }))
  })

  it('counts a stable identity with missing projection fields as insufficient instead of throwing', () => {
    setPopulation([oneLearner({ identity: 'SYN-MISSING-PROJECTION-001' })])
    sources.get('existing-regular-v1')!.records[0]!.learner.courses = undefined as unknown as DemandLearner['courses']
    const result = row('existing-regular-v1')
    expect(result.insufficient).toBe(1)
    expect(result.reasons).toContainEqual(expect.objectContaining({ category: 'insufficient', code: 'INVALID_RECORD', count: 1 }))
  })

  it('rejects invalid capacities, unknown course IDs, stale revisions and client-supplied authority', () => {
    expect(() => estimateAcademicDemand(catalog, sources, { ...request(), extra: 'authority' })).toThrow()
    expect(() => estimateAcademicDemand(catalog, sources, { ...request(), revision: 'OLD' })).toThrow()
    expect(() => estimateAcademicDemand(catalog, sources, { ...request(), courses: [{ courseId: 'UNKNOWN', targetCapacity: 1 }] })).toThrow()
    expect(() => estimateAcademicDemand(catalog, sources, { ...request(), courses: [{ courseId: '20118104', targetCapacity: 0 }] })).toThrow()
    expect(() => estimateAcademicDemand(catalog, sources, { ...request(), courses: [{ courseId: '20118104', targetCapacity: Number.MAX_SAFE_INTEGER + 1 }] })).toThrow()
  })
})


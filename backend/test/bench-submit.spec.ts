import { describe, expect, it } from 'vitest'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { applyVariants, planCatalog, planCohorts, replayIndexes } from '../scripts/bench-variants.js'
import { createSyntheticLoadProfile } from '../scripts/synthetic-load-profile.js'
import { budgetCriticalSectionMs, decideVerdict, hotCohortSize, latencyStats, parseBenchArgs, percentile } from '../scripts/bench-submit.js'

const choice = (sectionId: string) => [{ courseId: 'C1', sectionId }, { courseId: 'C2', sectionId }]

describe('bench-submit options', () => {
  it('applies defaults and accepts valid values', () => {
    expect(parseBenchArgs([])).toEqual({ actors: 100, profile: 'shared', budgetMs: 2000, pools: 2, poolMax: 12, cohorts: 1, replayRatio: 0 })
    expect(parseBenchArgs(['--actors', '400', '--profile', 'multi-uniform', '--budget-ms', '60000', '--pools', '4', '--pool-max', '8', '--out', 'r.json']))
      .toEqual({ actors: 400, profile: 'multi-uniform', budgetMs: 60000, pools: 4, poolMax: 8, cohorts: 1, replayRatio: 0, out: 'r.json' })
  })

  it.each([
    [['--actors', '0']], [['--actors', '2001']], [['--actors', 'abc']], [['--pools', '5']], [['--pools', '0']],
    [['--budget-ms', '-1']], [['--pool-max', '1.5']], [['--profile', 'last-seat']], [['--profile', 'nope']],
    [['--cohorts', '0']], [['--cohorts', '200', '--profile', 'shared']], [['--cohorts', '5', '--profile', 'ample']],
    [['--catalog-sections', '0']], [['--catalog-sections', '3']], [['--catalog-sections', '3', '--profile', 'ample']],
    [['--replay-ratio', '1.5']], [['--replay-ratio', '-0.1']], [['--replay-ratio', 'x']], [['--replay-ratio', '0.1234567', '--profile', 'ample']], [['--replay-ratio', '0.5']],
    [['--bogus', '1']], [['--actors']], [['--actors', '10', '--actors', '20']],
  ])('rejects %j', (argv) => {
    expect(() => parseBenchArgs(argv)).toThrow()
  })
})

describe('bench-submit statistics', () => {
  it('computes nearest-rank percentiles', () => {
    const values = Array.from({ length: 100 }, (_, index) => 100 - index)
    expect(percentile([...values].sort((a, b) => a - b), 0.95)).toBe(95)
    expect(latencyStats(values)).toEqual({ p50: 50, p95: 95, p99: 99, max: 100 })
    expect(latencyStats([])).toEqual({ p50: 0, p95: 0, p99: 0, max: 0 })
    expect(latencyStats([7])).toEqual({ p50: 7, p95: 7, p99: 7, max: 7 })
  })

  it('sizes the hot cohort by identical selections', () => {
    expect(hotCohortSize(Array.from({ length: 400 }, () => choice('G1')))).toBe(400)
    expect(hotCohortSize(Array.from({ length: 400 }, (_, index) => choice(`G${index % 5}`)))).toBe(80)
    expect(hotCohortSize(Array.from({ length: 10 }, (_, index) => choice(`S${index}`)))).toBe(1)
    expect(hotCohortSize([])).toBe(0)
  })

  it('derives the critical-section budget from the p95 SLO', () => {
    expect(budgetCriticalSectionMs(400)).toBeCloseTo(5.263, 3)
    expect(budgetCriticalSectionMs(0)).toBe(0)
  })
})

describe('bench-submit verdict', () => {
  const base = { p95Ms: 500, budgetMs: 2000, estimatedCriticalSectionMs: 2, budgetCriticalSectionMs: 5.26, auditPassed: true }

  it('is green within budgets', () => {
    expect(decideVerdict(base)).toEqual({ status: 'green', exitCode: 0, reasons: [] })
  })

  it('is performance red on p95 or critical section overrun', () => {
    expect(decideVerdict({ ...base, p95Ms: 2500 })).toMatchObject({ status: 'perf-red', exitCode: 1 })
    expect(decideVerdict({ ...base, estimatedCriticalSectionMs: 9 })).toMatchObject({ status: 'perf-red', exitCode: 1 })
  })

  it('is performance red when submits errored', () => {
    expect(decideVerdict({ ...base, errors: 3 })).toMatchObject({ status: 'perf-red', exitCode: 1 })
  })

  it('is integrity red when the audit fails, even if performance is also red', () => {
    expect(decideVerdict({ ...base, auditPassed: false })).toMatchObject({ status: 'integrity-red', exitCode: 2 })
    expect(decideVerdict({ ...base, p95Ms: 9999, auditPassed: false })).toMatchObject({ status: 'integrity-red', exitCode: 2 })
  })
})

describe('bench-submit variant options', () => {
  it('parses cohorts, catalog and replay variants with their profiles', () => {
    expect(parseBenchArgs(['--cohorts', '5'])).toMatchObject({ profile: 'shared', cohorts: 5 })
    expect(parseBenchArgs(['--cohorts', '1', '--profile', 'ample'])).toMatchObject({ cohorts: 1 })
    expect(parseBenchArgs(['--profile', 'distributed', '--catalog-sections', '300'])).toMatchObject({ catalogSections: 300 })
    expect(parseBenchArgs(['--profile', 'ample', '--replay-ratio', '0.5'])).toMatchObject({ replayRatio: 0.5 })
    expect(parseBenchArgs(['--profile', 'ample', '--replay-ratio', '1'])).toMatchObject({ replayRatio: 1 })
    expect(parseBenchArgs(['--replay-ratio', '0'])).toMatchObject({ replayRatio: 0 })
    expect(parseBenchArgs(['--pool-max', '6'])).toMatchObject({ poolMax: 6 })
  })
})

describe('bench-submit variant planning', () => {
  const fixture = createSyntheticFixture('SISTEMAS')
  const build = (actors: number, profile: 'shared' | 'ample' | 'distributed') => createSyntheticLoadProfile(actors, profile, fixture.actors, fixture.offer)
  const sectionIds = (load: ReturnType<typeof build>) => load.offer.map((course) => course.sections.map((section) => section.sectionId))

  it('keeps one cohort identical to the shared profile', () => {
    const load = build(100, 'shared')
    expect(planCohorts(load, 1)).toBe(load)
    expect(applyVariants(load, { cohorts: 1 })).toBe(load)
  })

  it('splits actors into disjoint cohorts and recomputes the expected accepted', () => {
    const load = build(100, 'shared')
    for (const cohorts of [5, 20]) {
      const plan = planCohorts(load, cohorts)
      expect(plan.offer.every((course) => course.sections.length === cohorts)).toBe(true)
      const bySection = new Map<string, number>()
      for (const actor of plan.actors) {
        const selection = plan.actorSelections.get(actor.actorId)!
        bySection.set(selection[0]!.sectionId, (bySection.get(selection[0]!.sectionId) ?? 0) + 1)
        selection.forEach((choice, index) => expect(plan.offer[index]!.sections.some((section) => section.sectionId === choice.sectionId)).toBe(true))
      }
      expect(bySection.size).toBe(cohorts)
      expect(Math.max(...bySection.values())).toBe(100 / cohorts)
      expect(plan.expectedAccepted).toBe(cohorts * Math.min(100 / cohorts, 10))
      expect(plan.expectedAccepted + plan.expectedRejected).toBe(100)
    }
    expect(load.offer[0]!.sections).toHaveLength(1)
    expect(() => planCohorts(build(100, 'ample'), 5)).toThrow()
    expect(() => planCohorts(load, 101)).toThrow()
  })

  it('builds a catalog of n sections with capacity for the whole demand', () => {
    const load = build(100, 'distributed')
    for (const catalog of [3, 15, 300]) {
      const plan = planCatalog(load, catalog)
      expect(sectionIds(plan).every((ids) => ids.length === catalog && new Set(ids).size === catalog)).toBe(true)
      const demand = new Map<string, number>()
      for (const selection of plan.actorSelections.values()) demand.set(selection[0]!.sectionId, (demand.get(selection[0]!.sectionId) ?? 0) + 1)
      expect(Math.max(...demand.values())).toBeLessThanOrEqual(plan.offer[0]!.sections[0]!.capacity)
      expect(plan.expectedAccepted).toBe(100)
    }
    expect(() => planCatalog(build(100, 'shared'), 3)).toThrow()
  })

  it('selects evenly spread replay indexes with exact counts', () => {
    expect(replayIndexes(100, 0).size).toBe(0)
    expect(replayIndexes(100, 1).size).toBe(100)
    expect(replayIndexes(100, 0.5).size).toBe(50)
    expect(replayIndexes(100, 0.29).size).toBe(29)
    expect([...replayIndexes(10, 0.5)]).toEqual([1, 3, 5, 7, 9])
  })
})

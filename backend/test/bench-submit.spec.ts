import { describe, expect, it } from 'vitest'
import { budgetCriticalSectionMs, decideVerdict, hotCohortSize, latencyStats, parseBenchArgs, percentile } from '../scripts/bench-submit.js'

const choice = (sectionId: string) => [{ courseId: 'C1', sectionId }, { courseId: 'C2', sectionId }]

describe('bench-submit options', () => {
  it('applies defaults and accepts valid values', () => {
    expect(parseBenchArgs([])).toEqual({ actors: 100, profile: 'shared', budgetMs: 2000, pools: 2, poolMax: 12 })
    expect(parseBenchArgs(['--actors', '400', '--profile', 'multi-uniform', '--budget-ms', '60000', '--pools', '4', '--pool-max', '8', '--out', 'r.json']))
      .toEqual({ actors: 400, profile: 'multi-uniform', budgetMs: 60000, pools: 4, poolMax: 8, out: 'r.json' })
  })

  it.each([
    [['--actors', '0']], [['--actors', '2001']], [['--actors', 'abc']], [['--pools', '5']], [['--pools', '0']],
    [['--budget-ms', '-1']], [['--pool-max', '1.5']], [['--profile', 'last-seat']], [['--profile', 'nope']],
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

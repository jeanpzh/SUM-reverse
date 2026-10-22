import { describe, expect, it } from 'vitest'
import { classifyStorageError, DURATION_BUCKETS_MS, StoreMetrics, SUBMIT_PHASES, SUBMIT_ROUTES } from '../src/persistence/store-metrics.js'

const timings = { preLock: 1.5, sectionLockFirst: 0.4, sectionLockWait: 3, critical: 7, commit: 600, total: 612, statements: 14 }

describe('StoreMetrics', () => {
  it('starts with a stable zeroed snapshot shape', () => {
    const snap = new StoreMetrics().snapshot()
    expect(Object.keys(snap.submitPhaseMs)).toEqual([...SUBMIT_PHASES])
    for (const phase of SUBMIT_PHASES) expect(Object.keys(snap.submitPhaseMs[phase])).toEqual([...SUBMIT_ROUTES])
    expect(snap.submitPhaseMs.total.accepted).toEqual({ count: 0, sum: 0, buckets: Array.from({ length: DURATION_BUCKETS_MS.length + 1 }, () => 0) })
    expect(snap.storageErrorsTotal).toEqual({ lock_timeout: 0, deadlock: 0, serialization: 0, statement_timeout: 0, pool_timeout: 0, other: 0 })
    expect(snap.submitRetriesTotal).toEqual({ '55P03': 0, '40P01': 0, '40001': 0, '57014': 0 })
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap)
  })

  it('places observations in fixed buckets per phase and route (upper bounds inclusive, +Inf last)', () => {
    const metrics = new StoreMetrics()
    metrics.recordSubmit('accepted', timings)
    metrics.recordSubmit('replay', { ...timings, commit: 99999 })
    const snap = metrics.snapshot()
    const idx = (ms: number) => DURATION_BUCKETS_MS.findIndex((bound) => ms <= bound)
    expect(snap.submitPhaseMs.pre_lock.accepted.buckets[idx(1.5)]).toBe(1)
    expect(snap.submitPhaseMs.commit.accepted.buckets[idx(600)]).toBe(1)
    expect(snap.submitPhaseMs.commit.replay.buckets.at(-1)).toBe(1)
    expect(snap.submitPhaseMs.total.accepted).toMatchObject({ count: 1, sum: 612 })
    expect(snap.submitPhaseMs.total.rejected.count).toBe(0)
    expect(snap.submitStatements.accepted).toMatchObject({ count: 1, sum: 14 })
    expect(snap.submitStatements.replay.count).toBe(1)
  })

  it('records pool acquisition separately from the route histograms', () => {
    const metrics = new StoreMetrics()
    metrics.recordPoolAcquire(3)
    expect(metrics.snapshot().poolAcquireMs).toMatchObject({ count: 1, sum: 3 })
  })

  it('counts storage errors by cause and retries by PG code', () => {
    const metrics = new StoreMetrics()
    metrics.recordStorageError('lock_timeout')
    metrics.recordStorageError('lock_timeout')
    metrics.recordStorageError('pool_timeout')
    metrics.recordRetry('55P03')
    metrics.recordRetry('40P01')
    const snap = metrics.snapshot()
    expect(snap.storageErrorsTotal).toMatchObject({ lock_timeout: 2, pool_timeout: 1, other: 0 })
    expect(snap.submitRetriesTotal).toMatchObject({ '55P03': 1, '40P01': 1, '40001': 0 })
  })

  it('classifies PG codes and pool connect timeouts', () => {
    expect(classifyStorageError({ code: '55P03' })).toBe('lock_timeout')
    expect(classifyStorageError({ code: '40P01' })).toBe('deadlock')
    expect(classifyStorageError({ code: '40001' })).toBe('serialization')
    expect(classifyStorageError({ code: '57014' })).toBe('statement_timeout')
    expect(classifyStorageError(new Error('timeout exceeded when trying to connect'))).toBe('pool_timeout')
    expect(classifyStorageError({ code: '23505', message: 'x' })).toBe('other')
    expect(classifyStorageError(new Error('boom'))).toBe('other')
    expect(classifyStorageError(undefined)).toBe('other')
  })

  it('cannot create labels from arbitrary values such as identifiers', () => {
    const metrics = new StoreMetrics()
    const before = JSON.stringify(metrics.snapshot())
    for (const id of ['SYN-0001', 'campaign-uuid', 'constructor', '__proto__', 'toString']) {
      metrics.recordRetry(id)
      metrics.recordStorageError(id as never)
      metrics.recordSubmit(id as never, timings)
    }
    expect(JSON.stringify(metrics.snapshot())).toBe(before)
    expect(({} as Record<string, unknown>)['n']).toBeUndefined()
  })

  it('keeps instances independent (no global state)', () => {
    const a = new StoreMetrics()
    const b = new StoreMetrics()
    a.recordStorageError('other')
    expect(b.snapshot().storageErrorsTotal.other).toBe(0)
  })
})

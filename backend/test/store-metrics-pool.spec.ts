import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { PostgresEnrollmentStore } from '../src/persistence/postgres-enrollment.store.js'
import { StoreMetrics } from '../src/persistence/store-metrics.js'

const runId = '00000000-0000-4000-8000-000000000002'
const principal = { campaignId: '00000000-0000-4000-8000-000000000001', runId, actorId: 'SYN-METRICS-POOL' }
const submission = { runId, actorId: principal.actorId, requestId: '00000000-0000-4000-8000-000000000003', selection: [] } as never

describe('store metrics with a mocked pool', () => {
  it('counts pool_timeout and keeps the 503 envelope when the pool cannot connect', async () => {
    const pool = { connect: vi.fn().mockRejectedValue(new Error('timeout exceeded when trying to connect')) }
    const metrics = new StoreMetrics()
    const store = new PostgresEnrollmentStore(pool as unknown as Pool, metrics)
    await expect(store.submit(principal, submission)).rejects.toMatchObject({ status: 503, code: 'STORAGE_UNAVAILABLE' })
    const snap = metrics.snapshot()
    expect(snap.storageErrorsTotal.pool_timeout).toBe(1)
    expect(snap.poolAcquireMs.count).toBe(1)
    expect(snap.submitPhaseMs.total.failed.count).toBe(1)
    expect(snap.submitPhaseMs.section_lock_wait.failed.count).toBe(0)
    expect(snap.submitStatements.failed.sum).toBe(0)
    expect(pool.connect).toHaveBeenCalledTimes(1)
  })

  it('classifies other failures as other and releases the client', async () => {
    const client = { query: vi.fn().mockRejectedValue(new Error('disconnected')), release: vi.fn() }
    const pool = { connect: vi.fn().mockResolvedValue(client) }
    const metrics = new StoreMetrics()
    const store = new PostgresEnrollmentStore(pool as unknown as Pool, metrics)
    await expect(store.submit(principal, submission)).rejects.toMatchObject({ status: 503, code: 'STORAGE_UNAVAILABLE' })
    expect(metrics.snapshot().storageErrorsTotal.other).toBe(1)
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('counts PG-coded errors per attempt and retries only between attempts', async () => {
    const error = Object.assign(new Error('deadlock'), { code: '40P01' })
    const client = { query: vi.fn().mockRejectedValue(error), release: vi.fn() }
    const pool = { connect: vi.fn().mockResolvedValue(client) }
    const metrics = new StoreMetrics()
    const store = new PostgresEnrollmentStore(pool as unknown as Pool, metrics)
    await expect(store.submit(principal, submission)).rejects.toMatchObject({ status: 503, code: 'STORAGE_UNAVAILABLE' })
    const snap = metrics.snapshot()
    expect(snap.storageErrorsTotal.deadlock).toBe(3)
    expect(snap.submitRetriesTotal['40P01']).toBe(2)
    expect(snap.submitPhaseMs.total.failed.count).toBe(3)
    expect(snap.submitStatements.failed.sum).toBe(3)
  })
})

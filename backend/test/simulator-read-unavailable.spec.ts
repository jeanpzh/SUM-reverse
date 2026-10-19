import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { PostgresEnrollmentStore } from '../src/persistence/postgres-enrollment.store.js'

const principal = { campaignId: '00000000-0000-4000-8000-000000000001', runId: '00000000-0000-4000-8000-000000000002', actorId: 'SYN-READ-UNAVAILABLE' }

describe('synthetic read storage failures', () => {
  it('maps pool acquisition failure to 503 for context and dashboard reads', async () => {
    const pool = { connect: vi.fn().mockRejectedValue(new Error('Cannot use a pool after calling end on the pool')) }
    const store = new PostgresEnrollmentStore(pool as unknown as Pool)
    await expect(store.readSnapshot(principal)).rejects.toMatchObject({ status: 503, code: 'STORAGE_UNAVAILABLE' })
    await expect(store.readDashboardSnapshot(principal, 'synthetic-session')).rejects.toMatchObject({ status: 503, code: 'STORAGE_UNAVAILABLE' })
  })

  it('keeps storage error mapping when rollback itself fails and releases connections', async () => {
    const client = { query: vi.fn().mockRejectedValue(new Error('Database disconnected')), release: vi.fn() }
    const pool = { connect: vi.fn().mockResolvedValue(client) }
    const store = new PostgresEnrollmentStore(pool as unknown as Pool)
    await expect(store.readSnapshot(principal)).rejects.toMatchObject({ status: 503, code: 'STORAGE_UNAVAILABLE' })
    await expect(store.readDashboardSnapshot(principal, 'synthetic-session')).rejects.toMatchObject({ status: 503, code: 'STORAGE_UNAVAILABLE' })
    expect(client.release).toHaveBeenCalledTimes(2)
  })
})

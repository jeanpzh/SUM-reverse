import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import type { INestApplication } from '@nestjs/common'
import { renderMetrics } from '../../infra/simulator/metrics-exporter.mjs'
import { PgWaitEventSampler } from '../src/auth/simulator-pg-stats.js'

const databaseUrl = process.env.SIMULATOR_TEST_DATABASE_URL
const campaignId = process.env.SIMULATOR_TEST_CAMPAIGN_ID
const manifestPath = process.env.SIMULATOR_TEST_MANIFEST
const enabled = Boolean(databaseUrl && campaignId && manifestPath)
const token = 'synthetic-e2e-metrics-token'
const base = 'http://127.0.0.1:3302'

type MetricsData = {
  requests: number
  enrollments: number
  activeSessions: number
  pool: { total: number }
  databaseWaitEvents: unknown[]
  process: { eventLoopWindow: { maxMs: number }; poolPeaks: { maxWaitingCount: number }; poolWaitHistogram: unknown[]; httpDurationHistogram: unknown[] }
  store: { submitPhaseMs: Record<string, Record<string, { buckets: number[]; count: number }>>; poolAcquireMs: { buckets: number[] }; storageErrorsTotal: Record<string, number>; submitRetriesTotal: Record<string, number> }
  database: {
    waitEventsMax: Array<{ wait_event_type: string; wait_event: string; count: number }>
    locksWaiting: Array<{ locktype: string; count: number }> | null
    stats: Record<string, number> | null
    wal: Record<string, number | null> | null
  }
}

describe.skipIf(!enabled)('protected metrics endpoint against PostgreSQL 18', () => {
  let app: INestApplication
  let pool: Pool
  const foreignCampaignId = randomUUID()

  async function metrics() {
    const response = await fetch(`${base}/simulator/metrics`, { headers: { Authorization: `Bearer ${token}` } })
    expect(response.status, await response.clone().text()).toBe(200)
    return (await response.json() as { data: MetricsData }).data
  }

  beforeAll(async () => {
    if (new URL(databaseUrl!).pathname !== '/sum_simulator_synthetic') throw new Error('Restricted to the named synthetic database')
    process.env.DATABASE_URL = databaseUrl
    process.env.SIMULATOR_DEPLOYMENT = 'public'
    process.env.SIMULATOR_STORAGE = 'postgres'
    process.env.SIMULATOR_CAMPAIGN_ID = campaignId
    process.env.SIMULATOR_PUBLIC_ORIGIN = 'http://127.0.0.1:5189'
    process.env.SIMULATOR_METRICS_TOKEN = token
    process.env.NODE_ENV = 'test'
    pool = new Pool({ connectionString: databaseUrl, application_name: 'sum-simulator-e2e-metrics-endpoint-admin' })
    // A second synthetic campaign with one request, to prove the endpoint counts only the active campaign.
    await pool.query("INSERT INTO simulator_campaigns(campaign_id,run_id,status,config) VALUES($1,$2,'open','{}')", [foreignCampaignId, randomUUID()])
    await pool.query("INSERT INTO simulator_actors(campaign_id,actor_id,profile) VALUES($1,'SYN-FOREIGN-0001','{}')", [foreignCampaignId])
    await pool.query("INSERT INTO simulator_requests(campaign_id,actor_id,request_id,payload,outcome) VALUES($1,'SYN-FOREIGN-0001',$2,'{}','{}')", [foreignCampaignId, randomUUID()])
    const { NestFactory } = await import('@nestjs/core')
    const { AppModule } = await import('../src/app.module.js')
    app = await NestFactory.create(AppModule, { logger: false })
    await app.listen(3302, '127.0.0.1')
  }, 30000)

  afterAll(async () => {
    await app?.close()
    await pool?.query('DELETE FROM simulator_campaigns WHERE campaign_id=$1', [foreignCampaignId])
    await pool?.end()
  }, 30000)

  it('rejects requests without the bearer token', async () => {
    expect((await fetch(`${base}/simulator/metrics`)).status).toBe(403)
    expect((await fetch(`${base}/simulator/metrics`, { headers: { Authorization: 'Bearer wrong' } })).status).toBe(403)
  })

  it('keeps the existing fields and adds store, process window and PostgreSQL data', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1600))
    const data = await metrics()
    expect(data.pool.total).toBeGreaterThan(0)
    expect(Array.isArray(data.databaseWaitEvents)).toBe(true)
    expect(data.process.eventLoopWindow).toHaveProperty('maxMs')
    expect(data.process.poolPeaks).toHaveProperty('maxWaitingCount')
    expect(data.process.poolWaitHistogram.length).toBeGreaterThan(0)
    expect(data.store.submitPhaseMs['total']!['accepted']!.buckets).toHaveLength(17)
    expect(data.store.poolAcquireMs.buckets).toHaveLength(17)
    expect(Object.keys(data.store.storageErrorsTotal)).toContain('pool_timeout')
    expect(Object.keys(data.store.submitRetriesTotal)).toContain('55P03')
    // PostgreSQL 18 queries answered (null would mean the read failed).
    expect(data.database.stats).not.toBeNull()
    for (const key of ['xactCommit', 'xactRollback', 'deadlocks', 'blksRead', 'blksHit', 'tempBytes']) expect(typeof data.database.stats![key]).toBe('number')
    expect(data.database.stats!['xactCommit']).toBeGreaterThan(0)
    expect(data.database.wal).not.toBeNull()
    expect(data.database.wal!['walRecords']).toBeGreaterThan(0)
    expect(data.database.wal!['walBytes']).toBeGreaterThan(0)
    expect(typeof data.database.wal!['writes']).toBe('number')
    expect(typeof data.database.wal!['fsyncs']).toBe('number')
    expect(Array.isArray(data.database.locksWaiting)).toBe(true)
    // The 1 s sampler observed the replica's own idle pool connections.
    expect(data.database.waitEventsMax.length).toBeGreaterThan(0)
    for (const row of data.database.waitEventsMax) {
      expect(row.wait_event_type).toMatch(/^[A-Za-z]{1,32}$/)
      expect(row.wait_event).toMatch(/^[A-Za-z0-9_]{1,64}$/)
      expect(row.count).toBeGreaterThan(0)
    }
    // Exporter accepts the real payload and emits series without identity.
    const output = renderMetrics({ 'api-a': { data } })
    expect(output).toMatch(/sum_simulator_db_xact_commit_total\{replica="api-a"\} \d+/)
    expect(output).toMatch(/sum_simulator_db_wal_bytes_total\{replica="api-a"\} \d+/)
    expect(output).toMatch(/sum_simulator_submit_phase_seconds_count\{replica="api-a",phase="total",route="accepted"\} 0/)
    expect(output).toMatch(/sum_simulator_http_request_seconds_count\{replica="api-a",method="GET",route="\/simulator\/metrics",status="403"\}/)
    expect(output).not.toMatch(/SYN-|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]{43}/)
  })

  it('counts only the active campaign', async () => {
    const data = await metrics()
    const own = await pool.query<{ requests: string; enrollments: string }>('SELECT (SELECT count(*) FROM simulator_requests WHERE campaign_id=$1)::text requests,(SELECT count(*) FROM simulator_enrollments WHERE campaign_id=$1)::text enrollments', [campaignId])
    const all = await pool.query<{ requests: string }>('SELECT count(*)::text requests FROM simulator_requests')
    expect(data.requests).toBe(Number(own.rows[0]!.requests))
    expect(data.enrollments).toBe(Number(own.rows[0]!.enrollments))
    expect(Number(all.rows[0]!.requests)).toBeGreaterThan(data.requests)
  })

  it('samples wait events on a separate connection, keeps the maximum and resets on read', async () => {
    const samplerConnections = async () => (await pool.query<{ count: number }>("SELECT count(*)::int count FROM pg_stat_activity WHERE application_name='sum-simulator-sampler'")).rows[0]!.count
    // The running app owns one sampler connection already.
    const baseline = await samplerConnections()
    const sampler = new PgWaitEventSampler(databaseUrl, 50)
    try {
      await sampler.sampleOnce()
      const first = sampler.readAndReset()
      expect(first.length).toBeGreaterThan(0)
      // Its own connection uses another application_name, so it is not part of the sampled set.
      expect(first.every((row) => row.count >= 1)).toBe(true)
      expect(sampler.readAndReset()).toEqual([])
      expect(await samplerConnections()).toBe(baseline + 1)
    } finally { await sampler.stop() }
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(await samplerConnections()).toBe(baseline)
  })

  it('never throws into callers when the database is unreachable', async () => {
    const sampler = new PgWaitEventSampler('postgres://simulator:none@127.0.0.1:1/sum_simulator_synthetic', 50)
    await expect(sampler.sampleOnce()).resolves.toBeUndefined()
    expect(sampler.readAndReset()).toEqual([])
    await sampler.stop()
  })
})

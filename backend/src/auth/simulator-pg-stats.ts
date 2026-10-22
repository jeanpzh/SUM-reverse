import { Client, type Pool } from 'pg'

// PostgreSQL-side operational statistics for the protected metrics endpoint.
// Every value is a bounded aggregate: wait-event pairs, lock types and database-wide counters.
// Nothing here carries actor, session, credential, campaign, run ids or URLs.

const WAIT_TYPE = /^[A-Za-z]{1,32}$/
const WAIT_EVENT = /^[A-Za-z0-9_]{1,64}$/
const LOCK_TYPE = /^[a-z_]{1,32}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_PAIRS = 64

export type WaitEventPeak = { wait_event_type: string; wait_event: string; count: number }
export type LockWaiting = { locktype: string; count: number }
export type DatabaseStats = { xactCommit: number; xactRollback: number; deadlocks: number; blksRead: number; blksHit: number; tempBytes: number }
export type WalStats = { walRecords: number; walBytes: number; walBuffersFull: number; writes: number | null; writeSeconds: number | null; fsyncs: number | null; fsyncSeconds: number | null }

export function activeCampaignId(): string | null {
  const value = process.env.SIMULATOR_CAMPAIGN_ID
  return value && UUID.test(value) ? value : null
}

/**
 * Samples pg_stat_activity once per second on its own connection (never the request pool, so it neither
 * competes with requests nor pollutes pool metrics). Keeps the maximum count per (wait_event_type, wait_event)
 * since the previous read. Memory is bounded by MAX_PAIRS; failures are swallowed and retried on the next tick.
 */
export class PgWaitEventSampler {
  private readonly peaks = new Map<string, WaitEventPeak>()
  private timer: NodeJS.Timeout | undefined
  private client: Client | undefined
  private sampling = false

  constructor(private readonly connectionString: string | undefined = process.env.DATABASE_URL, private readonly intervalMs = 1000) {}

  start() {
    if (this.timer || !this.connectionString) return
    this.timer = setInterval(() => { void this.sampleOnce() }, this.intervalMs)
    this.timer.unref()
  }

  async stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    const client = this.client
    this.client = undefined
    if (client) await client.end().catch(() => undefined)
  }

  /** Returns the per-pair maximum since the previous read and resets the window. */
  readAndReset(): WaitEventPeak[] {
    const rows = [...this.peaks.values()].sort((a, b) => a.wait_event_type.localeCompare(b.wait_event_type) || a.wait_event.localeCompare(b.wait_event))
    this.peaks.clear()
    return rows
  }

  async sampleOnce() {
    if (this.sampling || !this.connectionString) return
    this.sampling = true
    try {
      const client = await this.connection()
      const result = await client.query<{ wait_event_type: string; wait_event: string; count: number }>(
        "SELECT coalesce(wait_event_type,'active') wait_event_type,coalesce(wait_event,'none') wait_event,count(*)::int count FROM pg_stat_activity WHERE application_name='sum-simulator' GROUP BY 1,2")
      for (const row of result.rows) this.record(row.wait_event_type, row.wait_event, row.count)
    } catch {
      const stale = this.client
      this.client = undefined
      if (stale) void stale.end().catch(() => undefined)
    } finally { this.sampling = false }
  }

  private record(type: string, event: string, count: number) {
    if (!WAIT_TYPE.test(type) || !WAIT_EVENT.test(event) || !Number.isFinite(count)) return
    const key = `${type}|${event}`
    const current = this.peaks.get(key)
    if (current) { if (count > current.count) current.count = count; return }
    if (this.peaks.size < MAX_PAIRS) this.peaks.set(key, { wait_event_type: type, wait_event: event, count })
  }

  private async connection() {
    if (this.client) return this.client
    const client = new Client({ connectionString: this.connectionString, application_name: 'sum-simulator-sampler', connectionTimeoutMillis: 1000, statement_timeout: 500, query_timeout: 1000 })
    client.on('error', () => { if (this.client === client) this.client = undefined })
    await client.connect()
    this.client = client
    return client
  }
}

async function settled<T>(read: () => Promise<T>): Promise<T | null> {
  try { return await read() } catch { return null }
}

const number = (value: unknown) => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0 }
const optional = (value: unknown) => { if (value === null || value === undefined) return null; const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null }

export async function readLocksWaiting(pool: Pool): Promise<LockWaiting[] | null> {
  return settled(async () => {
    const result = await pool.query<{ locktype: string; count: number }>('SELECT locktype,count(*)::int count FROM pg_locks WHERE NOT granted GROUP BY locktype ORDER BY locktype')
    return result.rows.filter((row) => LOCK_TYPE.test(row.locktype)).map((row) => ({ locktype: row.locktype, count: number(row.count) }))
  })
}

export async function readDatabaseStats(pool: Pool): Promise<DatabaseStats | null> {
  return settled(async () => {
    const result = await pool.query('SELECT xact_commit,xact_rollback,deadlocks,blks_read,blks_hit,temp_bytes FROM pg_stat_database WHERE datname=current_database()')
    const row = result.rows[0]
    if (!row) return null
    return { xactCommit: number(row.xact_commit), xactRollback: number(row.xact_rollback), deadlocks: number(row.deadlocks), blksRead: number(row.blks_read), blksHit: number(row.blks_hit), tempBytes: number(row.temp_bytes) }
  })
}

/** PostgreSQL 18 moved WAL write/sync counters and times from pg_stat_wal to pg_stat_io (object='wal'); times need track_wal_io_timing. */
export async function readWalStats(pool: Pool): Promise<WalStats | null> {
  return settled(async () => {
    const wal = (await pool.query('SELECT wal_records,wal_bytes,wal_buffers_full FROM pg_stat_wal')).rows[0]
    if (!wal) return null
    const io = await settled(async () => (await pool.query("SELECT sum(writes) writes,sum(write_time) write_time,sum(fsyncs) fsyncs,sum(fsync_time) fsync_time FROM pg_stat_io WHERE object='wal'")).rows[0])
    return {
      walRecords: number(wal.wal_records), walBytes: number(wal.wal_bytes), walBuffersFull: number(wal.wal_buffers_full),
      writes: optional(io?.writes), writeSeconds: io?.write_time == null ? null : optional(Number(io.write_time) / 1000),
      fsyncs: optional(io?.fsyncs), fsyncSeconds: io?.fsync_time == null ? null : optional(Number(io.fsync_time) / 1000),
    }
  })
}

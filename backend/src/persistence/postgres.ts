import { AsyncLocalStorage } from 'node:async_hooks'
import { Pool } from 'pg'

/** Fixed bucket upper bounds in milliseconds shared by the pool-wait and HTTP histograms. */
export const DURATION_BUCKETS_MS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const
const MAX_SERIES = 64
const OVERFLOW_LABEL = 'other'
export const NO_ROUTE_GROUP = 'none'

export type HistogramSeries = { labels: Record<string, string>; buckets: number[]; count: number; sumMs: number; maxMs: number }

/**
 * Cumulative histogram with a bounded number of label sets. Labels must be low-cardinality
 * (route templates, methods, status codes); callers never pass identities or concrete URLs.
 * `buckets[i]` counts observations <= bounds[i]; the last slot is the +Inf overflow.
 */
export class LabeledHistogram {
  private readonly series = new Map<string, HistogramSeries>()

  constructor(private readonly labelNames: readonly string[], private readonly bounds: readonly number[] = DURATION_BUCKETS_MS) {}

  observe(values: readonly string[], ms: number) {
    const key = values.join('|')
    let item = this.series.get(key)
    if (!item) {
      if (this.series.size >= MAX_SERIES) return this.observeOverflow(ms)
      item = this.create(key, values)
    }
    this.add(item, ms)
  }

  snapshot(): HistogramSeries[] {
    return [...this.series.values()].map((item) => ({ labels: { ...item.labels }, buckets: [...item.buckets], count: item.count, sumMs: item.sumMs, maxMs: item.maxMs }))
  }

  private observeOverflow(ms: number) {
    const values = this.labelNames.map(() => OVERFLOW_LABEL)
    const key = values.join('|')
    this.add(this.series.get(key) ?? this.create(key, values), ms)
  }

  private create(key: string, values: readonly string[]): HistogramSeries {
    const labels: Record<string, string> = {}
    this.labelNames.forEach((name, index) => { labels[name] = values[index] ?? OVERFLOW_LABEL })
    const item: HistogramSeries = { labels, buckets: Array.from({ length: this.bounds.length + 1 }, () => 0), count: 0, sumMs: 0, maxMs: 0 }
    this.series.set(key, item)
    return item
  }

  private add(item: HistogramSeries, ms: number) {
    let index = 0
    while (index < this.bounds.length && ms > (this.bounds[index] as number)) index += 1
    item.buckets[index] = (item.buckets[index] as number) + 1
    item.count += 1
    item.sumMs += ms
    if (ms > item.maxMs) item.maxMs = ms
  }
}

export type PoolPeaks = { maxWaitingCount: number; maxInUse: number; maxTotalCount: number; maxWaitMs: number }

/** Pool checkout wait histogram by route group plus read-and-reset peaks. */
export class PoolMetricsCollector {
  readonly waitHistogram = new LabeledHistogram(['routeGroup'])
  private peaks: PoolPeaks = { maxWaitingCount: 0, maxInUse: 0, maxTotalCount: 0, maxWaitMs: 0 }

  recordWait(routeGroup: string, ms: number) {
    this.waitHistogram.observe([routeGroup], ms)
    if (ms > this.peaks.maxWaitMs) this.peaks.maxWaitMs = ms
  }

  sample(waitingCount: number, totalCount: number, idleCount: number) {
    const peaks = this.peaks
    if (waitingCount > peaks.maxWaitingCount) peaks.maxWaitingCount = waitingCount
    if (totalCount > peaks.maxTotalCount) peaks.maxTotalCount = totalCount
    const inUse = totalCount - idleCount
    if (inUse > peaks.maxInUse) peaks.maxInUse = inUse
  }

  /** Returns peaks since the previous read and resets them. */
  readPeaksAndReset(): PoolPeaks {
    const current = this.peaks
    this.peaks = { maxWaitingCount: 0, maxInUse: 0, maxTotalCount: 0, maxWaitMs: 0 }
    return current
  }
}

export const simulatorPoolMetrics = new PoolMetricsCollector()

const routeGroupStorage = new AsyncLocalStorage<string>()

/** Runs `fn` with the route template as the pool-wait label for all awaited work inside it. */
export function runWithRouteGroup<T>(routeGroup: string, fn: () => T): T {
  return routeGroupStorage.run(routeGroup, fn)
}

export function currentRouteGroup(): string {
  return routeGroupStorage.getStore() ?? NO_ROUTE_GROUP
}

/**
 * Wraps `pool.connect` so every checkout records its wait. `pool.query` calls `this.connect`
 * internally, so its implicit checkout is covered by the same wrapper (no double counting).
 * Clients, release callbacks and errors (including connect timeouts) pass through untouched.
 */
export function instrumentPool(pool: Pool, collector: PoolMetricsCollector = simulatorPoolMetrics): Pool {
  const original = pool.connect.bind(pool) as (cb?: unknown) => unknown
  const wrapped = (callback?: (error: Error | undefined, client?: unknown, release?: unknown) => void) => {
    const group = currentRouteGroup()
    const started = performance.now()
    const finish = () => {
      collector.recordWait(group, Math.max(0, performance.now() - started))
      collector.sample(pool.waitingCount, pool.totalCount, pool.idleCount)
    }
    let result: unknown
    if (typeof callback === 'function') {
      result = original((error: Error | undefined, client?: unknown, release?: unknown) => {
        finish()
        callback(error, client, release)
      })
    } else {
      result = (original() as Promise<unknown>).then(
        (client) => { finish(); return client },
        (error: unknown) => { finish(); throw error },
      )
    }
    collector.sample(pool.waitingCount, pool.totalCount, pool.idleCount)
    return result
  }
  pool.connect = wrapped as unknown as typeof pool.connect
  return pool
}

export function createSimulatorPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL simulator mode')
  const lockTimeoutMs = Number(process.env.SIMULATOR_DB_LOCK_TIMEOUT_MS ?? 5000)
  const statementTimeoutMs = Number(process.env.SIMULATOR_DB_STATEMENT_TIMEOUT_MS ?? 20000)
  return instrumentPool(new Pool({
    connectionString,
    max: Number(process.env.SIMULATOR_DB_POOL_MAX ?? 12),
    connectionTimeoutMillis: Number(process.env.SIMULATOR_DB_CONNECT_TIMEOUT_MS ?? 5000),
    idleTimeoutMillis: 30000,
    application_name: 'sum-simulator',
    options: `-c lock_timeout=${lockTimeoutMs} -c statement_timeout=${statementTimeoutMs}`,
  }))
}

export const SIMULATOR_POOL = Symbol('SIMULATOR_POOL')

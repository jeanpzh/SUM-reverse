import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { lastValueFrom, of } from 'rxjs'
import { Pool } from 'pg'
import { DURATION_BUCKETS_MS, instrumentPool, LabeledHistogram, PoolMetricsCollector, runWithRouteGroup } from '../src/persistence/postgres.js'
import { SimulatorMetricsInterceptor } from '../src/auth/simulator-metrics.interceptor.js'

// Synthetic client: no PostgreSQL involved. pg-pool only needs connect/query/end/on.
class FakeClient extends EventEmitter {
  connect(callback?: (error?: Error) => void) {
    if (callback) { setImmediate(() => callback()); return undefined }
    return Promise.resolve()
  }
  query(_text: string, _values: unknown, callback?: (error: Error | null, result: unknown) => void) {
    const done = typeof _values === 'function' ? (_values as typeof callback) : callback
    setImmediate(() => done?.(null, { rows: [] }))
  }
  end(callback?: () => void) { callback?.(); return Promise.resolve() }
}

const makePool = (max: number, connectionTimeoutMillis = 0) => {
  const collector = new PoolMetricsCollector()
  const pool = instrumentPool(new Pool({ Client: FakeClient as never, max, connectionTimeoutMillis }), collector)
  return { pool, collector }
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const totalOf = (collector: PoolMetricsCollector, group: string) => collector.waitHistogram.snapshot().find((item) => item.labels.routeGroup === group)

describe('instrumented simulator pool', () => {
  it('measures checkout wait with a pool of size 1, labelled by route group', async () => {
    const { pool, collector } = makePool(1)
    const first = await runWithRouteGroup('/holder/:id', () => pool.connect())
    const waiting = runWithRouteGroup('/waiter/:id', () => pool.connect())
    await sleep(120)
    first.release()
    const second = await waiting
    second.release()
    const holder = totalOf(collector, '/holder/:id')
    const waiter = totalOf(collector, '/waiter/:id')
    expect(holder?.count).toBe(1)
    expect(waiter?.count).toBe(1)
    expect(waiter?.sumMs).toBeGreaterThanOrEqual(100)
    expect(waiter?.sumMs).toBeLessThan(1000)
    expect(holder?.sumMs).toBeLessThan(waiter?.sumMs as number)
    await pool.end()
  })

  it('counts the implicit checkout of pool.query once and keeps results', async () => {
    const { pool, collector } = makePool(1)
    const result = await runWithRouteGroup('/q/:id', () => pool.query('SELECT 1'))
    expect(result.rows).toEqual([])
    expect(totalOf(collector, '/q/:id')?.count).toBe(1)
    await pool.end()
  })

  it('keeps the peak of a 200 ms burst until the next read, then resets it', async () => {
    const { pool, collector } = makePool(1)
    const held = await pool.connect()
    const waiters = [pool.connect(), pool.connect(), pool.connect()]
    await sleep(200)
    held.release()
    for (const waiter of waiters) (await waiter).release()
    await sleep(50) // the burst is over before the read, like a scrape that arrives later
    const peaks = collector.readPeaksAndReset()
    expect(peaks.maxWaitingCount).toBe(3)
    expect(peaks.maxInUse).toBe(1)
    expect(peaks.maxTotalCount).toBe(1)
    expect(peaks.maxWaitMs).toBeGreaterThanOrEqual(190)
    expect(collector.readPeaksAndReset()).toEqual({ maxWaitingCount: 0, maxInUse: 0, maxTotalCount: 0, maxWaitMs: 0 })
    await pool.end()
  })

  it('passes the connect timeout error through unchanged and still records the wait', async () => {
    const { pool, collector } = makePool(1, 50)
    const held = await pool.connect()
    await expect(runWithRouteGroup('/timeout/:id', () => pool.connect())).rejects.toThrow('timeout exceeded when trying to connect')
    expect(totalOf(collector, '/timeout/:id')?.count).toBe(1)
    held.release()
    await pool.end()
  })

  it('supports the callback form of connect', async () => {
    const { pool, collector } = makePool(1)
    const client = await new Promise<{ release: () => void }>((resolve, reject) => {
      runWithRouteGroup('/cb/:id', () => pool.connect((error, c) => (error ? reject(error) : resolve(c as never))))
    })
    client.release()
    expect(totalOf(collector, '/cb/:id')?.count).toBe(1)
    await pool.end()
  })

  it('uses "none" outside a request and bounds label cardinality', () => {
    const collector = new PoolMetricsCollector()
    collector.recordWait('none', 1)
    for (let i = 0; i < 100; i += 1) collector.recordWait(`/r${i}`, 1)
    const groups = collector.waitHistogram.snapshot().map((item) => item.labels.routeGroup)
    expect(groups).toContain('none')
    expect(groups.length).toBeLessThanOrEqual(65)
    expect(groups).toContain('other')
  })
})

describe('histogram buckets', () => {
  it('places observations in non-cumulative buckets with an overflow slot', () => {
    const histogram = new LabeledHistogram(['route'], [10, 100])
    histogram.observe(['/a'], 5)
    histogram.observe(['/a'], 10)
    histogram.observe(['/a'], 50)
    histogram.observe(['/a'], 5000)
    expect(histogram.snapshot()[0]).toMatchObject({ buckets: [2, 1, 1], count: 4, maxMs: 5000 })
  })

  it('uses the shared bounds so a 26 s duration lands in the 30000 bucket, not +Inf', () => {
    expect(DURATION_BUCKETS_MS).toEqual([0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 30000])
    const histogram = new LabeledHistogram(['route'])
    histogram.observe(['/slow'], 26000)
    const buckets = histogram.snapshot()[0]?.buckets as number[]
    expect(buckets).toHaveLength(DURATION_BUCKETS_MS.length + 1)
    expect(buckets[DURATION_BUCKETS_MS.indexOf(30000)]).toBe(1)
    expect(buckets[buckets.length - 1]).toBe(0)
  })
})

describe('SimulatorMetricsInterceptor', () => {
  const makeContext = (path: string, url: string, statusCode: number) => {
    const response = Object.assign(new EventEmitter(), { statusCode })
    const request = { method: 'POST', url, route: { path } }
    return { response, context: { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as never }
  }

  it('labels pool wait and HTTP duration with the route template, never the concrete URL', async () => {
    const pool = instrumentPool(new Pool({ Client: FakeClient as never, max: 2 }))
    const interceptor = new SimulatorMetricsInterceptor(pool)
    interceptor.snapshot() // start a clean window
    const concrete = '/local/matricula-regular/v1/contextos/SYN-ACTOR-0001?token=secret'
    const { response, context } = makeContext('/local/matricula-regular/v1/contextos/:actorId', concrete, 200)
    const result = await lastValueFrom(interceptor.intercept(context, { handle: () => of(null) } as never))
    expect(result).toBeNull()
    const handled = interceptor.intercept(context, { handle: () => ({ subscribe: (s: { next: (v: unknown) => void; complete: () => void }) => { void pool.query('SELECT 1').then(() => { s.next('ok'); s.complete() }) } }) } as never)
    await lastValueFrom(handled)
    response.emit('finish')

    const snapshot = interceptor.snapshot()
    const text = JSON.stringify([snapshot.poolWaitHistogram, snapshot.httpDurationHistogram])
    expect(text).toContain('/local/matricula-regular/v1/contextos/:actorId')
    expect(text).not.toContain('SYN-ACTOR-0001')
    expect(text).not.toContain('secret')
    const http = snapshot.httpDurationHistogram.find((item) => item.labels.route === '/local/matricula-regular/v1/contextos/:actorId')
    expect(http?.labels).toEqual({ method: 'POST', route: '/local/matricula-regular/v1/contextos/:actorId', status: '200' })
    expect(snapshot.poolWaitHistogram.some((item) => item.labels.routeGroup === '/local/matricula-regular/v1/contextos/:actorId')).toBe(true)
    await interceptor.onModuleDestroy()
  })

  it('resets the event-loop window on each read, with sub-5 ms resolution', async () => {
    const pool = { end: vi.fn() } as never
    const interceptor = new SimulatorMetricsInterceptor(pool)
    interceptor.snapshot()
    const blockUntil = performance.now() + 120
    await sleep(20)
    while (performance.now() < blockUntil) { /* block the loop */ }
    await sleep(30)
    const busy = interceptor.snapshot()
    expect(busy.eventLoopWindow.maxMs).toBeGreaterThan(50)
    expect(busy.eventLoopWindow.samples).toBeGreaterThan(0)
    await sleep(60)
    const quiet = interceptor.snapshot()
    expect(quiet.eventLoopWindow.maxMs).toBeLessThan(busy.eventLoopWindow.maxMs)
    expect(quiet.eventLoopWindow.maxMs).toBeLessThan(50)
    await interceptor.onModuleDestroy()
  })
})

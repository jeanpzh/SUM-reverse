import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { Request, Response } from 'express'
import { Observable } from 'rxjs'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import type { Pool } from 'pg'
import { LabeledHistogram, runWithRouteGroup, SIMULATOR_POOL, simulatorPoolMetrics } from '../persistence/postgres.js'

type MetricBucket = { method: string; route: string; status: number; count: number; durationTotal: number; durationMax: number }

@Injectable()
export class SimulatorMetricsInterceptor implements NestInterceptor, OnModuleInit, OnModuleDestroy {
  private readonly loop = monitorEventLoopDelay({ resolution: 5 })
  private readonly httpHistogram = new LabeledHistogram(['method', 'route', 'status'])
  private readonly pending = new Map<string, MetricBucket>()
  private dropped = 0
  private flushing = false
  private flushTimer: NodeJS.Timeout | undefined

  constructor(@Inject(SIMULATOR_POOL) private readonly pool: Pool) { this.loop.enable() }

  onModuleInit() { this.flushTimer = setInterval(() => { void this.flush() }, 1000); this.flushTimer.unref() }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()
    const method = request.method
    const route = typeof request.route?.path === 'string' ? request.route.path : 'unmatched'
    const started = performance.now()
    let recorded = false
    const record = () => {
      if (recorded) return
      recorded = true
      const elapsed = Math.max(0, performance.now() - started)
      this.httpHistogram.observe([method, route, String(response.statusCode)], elapsed)
      const key = `${method}|${route}|${response.statusCode}`
      const bucket = this.pending.get(key)
      if (bucket) {
        bucket.count += 1
        bucket.durationTotal += elapsed
        bucket.durationMax = Math.max(bucket.durationMax, elapsed)
      } else if (this.pending.size < 500) this.pending.set(key, { method, route, status: response.statusCode, count: 1, durationTotal: elapsed, durationMax: elapsed })
      else this.dropped += 1
    }
    response.once('finish', record)
    response.once('close', record)
    return new Observable((subscriber) => runWithRouteGroup(route, () => next.handle().subscribe(subscriber)))
  }

  /** Reads the event-loop window (resolution 5 ms) and pool peaks since the previous read, then resets both. */
  snapshot() {
    const cpu = process.cpuUsage()
    const loop = this.loop
    const eventLoop = { p50Ms: Number(loop.percentile(50)) / 1e6, p95Ms: Number(loop.percentile(95)) / 1e6, p99Ms: Number(loop.percentile(99)) / 1e6, maxMs: Number(loop.max) / 1e6, samples: loop.count }
    loop.reset()
    return {
      cpuUserMicros: cpu.user, cpuSystemMicros: cpu.system, rssBytes: process.memoryUsage().rss,
      eventLoopP95Ms: eventLoop.p95Ms, eventLoopMaxMs: eventLoop.maxMs, droppedMetricSamples: this.dropped,
      eventLoopWindow: eventLoop,
      poolPeaks: simulatorPoolMetrics.readPeaksAndReset(),
      poolWaitHistogram: simulatorPoolMetrics.waitHistogram.snapshot(),
      httpDurationHistogram: this.httpHistogram.snapshot(),
    }
  }

  async onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer)
    await this.flush()
    this.loop.disable()
    await this.pool.end()
  }

  private async flush() {
    if (this.flushing || this.pending.size === 0) return
    this.flushing = true
    const batch = [...this.pending.entries()]
    this.pending.clear()
    const values: unknown[] = []
    const tuples = batch.map(([, item], index) => {
      const offset = index * 6
      values.push(item.method, item.route, item.status, item.count, item.durationTotal, item.durationMax)
      return `(date_trunc('minute',now()),$${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6})`
    })
    try {
      await this.pool.query(`INSERT INTO simulator_http_metrics(bucket_start,method,route,status,count,duration_total_ms,duration_max_ms) VALUES ${tuples.join(',')}
        ON CONFLICT(bucket_start,method,route,status) DO UPDATE SET count=simulator_http_metrics.count+EXCLUDED.count,duration_total_ms=simulator_http_metrics.duration_total_ms+EXCLUDED.duration_total_ms,duration_max_ms=greatest(simulator_http_metrics.duration_max_ms,EXCLUDED.duration_max_ms)`, values)
    } catch {
      for (const [key, item] of batch) {
        const existing = this.pending.get(key)
        if (existing) {
          existing.count += item.count
          existing.durationTotal += item.durationTotal
          existing.durationMax = Math.max(existing.durationMax, item.durationMax)
        } else if (this.pending.size < 500) this.pending.set(key, item)
        else this.dropped += item.count
      }
    } finally { this.flushing = false }
  }
}

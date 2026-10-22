import { Injectable } from '@nestjs/common'

// In-memory collector with fixed buckets and closed label sets. Labels are typed
// unions and unknown values are ignored, so identifiers (actor, session,
// credential, campaign, run) can never become label values.

export const SUBMIT_PHASES = ['pre_lock', 'section_lock_first', 'section_lock_wait', 'critical', 'commit', 'total'] as const
export const SUBMIT_ROUTES = ['accepted', 'rejected', 'replay', 'failed'] as const
export const STORAGE_ERROR_CAUSES = ['lock_timeout', 'deadlock', 'serialization', 'statement_timeout', 'pool_timeout', 'other'] as const
export const SUBMIT_RETRY_CODES = ['55P03', '40P01', '40001', '57014'] as const

export type SubmitPhase = (typeof SUBMIT_PHASES)[number]
export type SubmitRoute = (typeof SUBMIT_ROUTES)[number]
export type StorageErrorCause = (typeof STORAGE_ERROR_CAUSES)[number]
export type SubmitRetryCode = (typeof SUBMIT_RETRY_CODES)[number]

export const DURATION_BUCKETS_MS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000, 20000, 30000] as const
export const STATEMENT_BUCKETS = [5, 8, 10, 12, 15, 20, 30, 50, 100] as const

export type HistogramSnapshot = { count: number; sum: number; buckets: number[] }
export type StoreMetricsSnapshot = {
  durationBucketsMs: number[]
  statementBuckets: number[]
  submitPhaseMs: Record<SubmitPhase, Record<SubmitRoute, HistogramSnapshot>>
  poolAcquireMs: HistogramSnapshot
  submitStatements: Record<SubmitRoute, HistogramSnapshot>
  storageErrorsTotal: Record<StorageErrorCause, number>
  submitRetriesTotal: Record<SubmitRetryCode, number>
}

class Histogram {
  private count = 0
  private sum = 0
  // Non-cumulative counts per bucket; the last slot is +Inf.
  private readonly counts: number[]
  constructor(private readonly bounds: readonly number[]) { this.counts = Array.from({ length: bounds.length + 1 }, () => 0) }

  observe(value: number) {
    let index = 0
    while (index < this.bounds.length && value > this.bounds[index]!) index += 1
    this.counts[index]! += 1
    this.count += 1
    this.sum += value
  }

  snapshot(): HistogramSnapshot { return { count: this.count, sum: this.sum, buckets: [...this.counts] } }
}

export type SubmitTimings = { preLock: number; sectionLockFirst: number; sectionLockWait: number; critical: number; commit: number; total: number; statements: number }

export function classifyStorageError(error: unknown): StorageErrorCause {
  const code = (error as { code?: string } | null)?.code
  if (code === '55P03') return 'lock_timeout'
  if (code === '40P01') return 'deadlock'
  if (code === '40001') return 'serialization'
  if (code === '57014') return 'statement_timeout'
  if (!code && /timeout exceeded when trying to connect/i.test((error as { message?: string } | null)?.message ?? '')) return 'pool_timeout'
  return 'other'
}

function record<K extends string, V>(keys: readonly K[], make: () => V): Record<K, V> {
  const out = Object.create(null) as Record<K, V>
  for (const key of keys) out[key] = make()
  return out
}

@Injectable()
export class StoreMetrics {
  private readonly phases = record(SUBMIT_PHASES, () => record(SUBMIT_ROUTES, () => new Histogram(DURATION_BUCKETS_MS)))
  private readonly poolAcquire = new Histogram(DURATION_BUCKETS_MS)
  private readonly statements = record(SUBMIT_ROUTES, () => new Histogram(STATEMENT_BUCKETS))
  private readonly storageErrors = record(STORAGE_ERROR_CAUSES, () => ({ n: 0 }))
  private readonly retries = record(SUBMIT_RETRY_CODES, () => ({ n: 0 }))

  recordSubmit(route: SubmitRoute, t: SubmitTimings) {
    const statements = this.statements[route]
    if (!statements) return
    this.phases.pre_lock[route].observe(t.preLock)
    this.phases.section_lock_first[route].observe(t.sectionLockFirst)
    this.phases.section_lock_wait[route].observe(t.sectionLockWait)
    this.phases.critical[route].observe(t.critical)
    this.phases.commit[route].observe(t.commit)
    this.phases.total[route].observe(t.total)
    statements.observe(t.statements)
  }

  // Failed storage attempt: only what was measured up to the failure. Phases not reached stay unobserved.
  recordFailed(totalMs: number, sectionLockWaitMs: number | undefined, statements: number) {
    this.phases.total.failed.observe(totalMs)
    if (sectionLockWaitMs !== undefined) this.phases.section_lock_wait.failed.observe(sectionLockWaitMs)
    this.statements.failed.observe(statements)
  }

  recordPoolAcquire(ms: number) { this.poolAcquire.observe(ms) }

  recordStorageError(cause: StorageErrorCause) { const slot = this.storageErrors[cause]; if (slot) slot.n += 1 }

  recordRetry(code: string) { const slot = this.retries[code as SubmitRetryCode]; if (slot) slot.n += 1 }

  snapshot(): StoreMetricsSnapshot {
    const submitPhaseMs = {} as StoreMetricsSnapshot['submitPhaseMs']
    for (const phase of SUBMIT_PHASES) {
      submitPhaseMs[phase] = {} as Record<SubmitRoute, HistogramSnapshot>
      for (const route of SUBMIT_ROUTES) submitPhaseMs[phase][route] = this.phases[phase][route].snapshot()
    }
    const submitStatements = {} as Record<SubmitRoute, HistogramSnapshot>
    for (const route of SUBMIT_ROUTES) submitStatements[route] = this.statements[route].snapshot()
    const storageErrorsTotal = {} as Record<StorageErrorCause, number>
    for (const cause of STORAGE_ERROR_CAUSES) storageErrorsTotal[cause] = this.storageErrors[cause].n
    const submitRetriesTotal = {} as Record<SubmitRetryCode, number>
    for (const code of SUBMIT_RETRY_CODES) submitRetriesTotal[code] = this.retries[code].n
    return { durationBucketsMs: [...DURATION_BUCKETS_MS], statementBuckets: [...STATEMENT_BUCKETS], submitPhaseMs, poolAcquireMs: this.poolAcquire.snapshot(), submitStatements, storageErrorsTotal, submitRetriesTotal }
  }
}

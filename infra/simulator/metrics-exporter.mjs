import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const label = (value) => JSON.stringify(String(value))

// Label allow-lists. A value outside them is dropped, never rewritten, so identities cannot leak into labels.
const PHASES = new Set(['pre_lock', 'section_lock_first', 'section_lock_wait', 'critical', 'commit', 'total'])
const SUBMIT_ROUTES = new Set(['accepted', 'rejected', 'replay', 'failed'])
const CAUSES = new Set(['lock_timeout', 'deadlock', 'serialization', 'statement_timeout', 'pool_timeout', 'other'])
const RETRY_CODES = new Set(['55P03', '40P01', '40001', '57014'])
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'other'])
const SPECIAL_ROUTES = new Set(['none', 'other', 'unmatched'])
const SEGMENT = /^(?:[a-z0-9][a-z0-9_-]{0,31}|:[A-Za-z][A-Za-z0-9]{0,31})$/
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const WAIT_TYPE = /^[A-Za-z]{1,32}$/
const WAIT_EVENT = /^[A-Za-z0-9_]{1,64}$/
const LOCK_TYPE = /^[a-z_]{1,32}$/

// A route template is a sequence of lowercase path segments or :param placeholders: no query string, no concrete ids.
export function isRouteTemplate(value) {
  if (typeof value !== 'string' || value.length > 120) return false
  if (SPECIAL_ROUTES.has(value) || value === '/') return true
  if (!value.startsWith('/') || UUID.test(value)) return false
  return value.slice(1).split('/').every((segment) => SEGMENT.test(segment))
}
const isStatus = (value) => value === 'other' || /^[1-5][0-9]{2}$/.test(String(value))

// Fixed bounds of the API's LabeledHistogram (backend/src/persistence/postgres.ts), in milliseconds.
const DURATION_BUCKETS_MS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 30000]
const toSeconds = (bounds) => Array.isArray(bounds) ? bounds.map((value) => value / 1000) : null

// Collectors keep non-cumulative counts per slot (last slot is +Inf). Prometheus wants cumulative buckets.
function histogramLines(name, tags, bounds, buckets, sum) {
  if (!Array.isArray(bounds) || !Array.isArray(buckets) || buckets.length !== bounds.length + 1) return null
  if (!bounds.every(finite) || !buckets.every(finite) || !finite(sum)) return null
  const lines = []
  let cumulative = 0
  for (let index = 0; index < bounds.length; index += 1) {
    cumulative += buckets[index]
    lines.push(`${name}_bucket{${tags},le=${label(bounds[index])}} ${cumulative}`)
  }
  cumulative += buckets[bounds.length]
  lines.push(`${name}_bucket{${tags},le="+Inf"} ${cumulative}`, `${name}_sum{${tags}} ${sum}`, `${name}_count{${tags}} ${cumulative}`)
  return lines
}

/** Merges per-window fields (reset on read by the API) over several polls so a slow scrape does not lose peaks. */
export function mergeWindow(previous, data) {
  const merged = { eventLoopWindow: {}, poolPeaks: {}, waitEventsMax: new Map() }
  const next = { eventLoopWindow: data?.process?.eventLoopWindow, poolPeaks: data?.process?.poolPeaks, waitEventsMax: data?.database?.waitEventsMax }
  for (const source of [previous, next]) {
    for (const group of ['eventLoopWindow', 'poolPeaks']) {
      for (const [key, value] of Object.entries(source?.[group] ?? {})) {
        if (finite(value)) merged[group][key] = Math.max(merged[group][key] ?? 0, value)
      }
    }
    const events = source?.waitEventsMax
    for (const row of events instanceof Map ? events.values() : events ?? []) {
      if (!WAIT_TYPE.test(row?.wait_event_type) || !WAIT_EVENT.test(row?.wait_event) || !finite(row?.count)) continue
      const key = `${row.wait_event_type}|${row.wait_event}`
      const existing = merged.waitEventsMax.get(key)
      merged.waitEventsMax.set(key, { wait_event_type: row.wait_event_type, wait_event: row.wait_event, count: Math.max(existing?.count ?? 0, row.count) })
    }
  }
  return merged
}

const definitions = {
  sum_simulator_api_up: ['gauge', 'Whether the protected synthetic API metrics snapshot is available'],
  sum_simulator_cpu_seconds_total: ['counter', 'Cumulative CPU seconds used by this API process'],
  sum_simulator_rss_bytes: ['gauge', 'Resident memory bytes of this API process'],
  sum_simulator_event_loop_p95_seconds: ['gauge', 'Process lifetime event loop delay p95 seconds'],
  sum_simulator_pool_connections: ['gauge', 'Database pool connections by state'],
  sum_simulator_pool_waiting: ['gauge', 'Requests waiting for a database pool connection'],
  sum_simulator_database_waits: ['gauge', 'Database backend wait categories observed by each replica; use max across observers'],
  sum_simulator_dropped_metric_samples_total: ['counter', 'API route metric samples dropped before persistence'],
  sum_simulator_submit_phase_seconds: ['histogram', 'Enrollment submit phase duration in seconds by phase and outcome route'],
  sum_simulator_submit_statements: ['histogram', 'SQL statements executed per submit attempt by outcome route'],
  sum_simulator_pool_acquire_seconds: ['histogram', 'Store-side database pool checkout wait in seconds'],
  sum_simulator_pool_wait_seconds: ['histogram', 'Database pool checkout wait in seconds by route group'],
  sum_simulator_http_request_seconds: ['histogram', 'Server-side HTTP request duration in seconds by route template and status'],
  sum_simulator_storage_errors_total: ['counter', 'Storage failures by classified cause'],
  sum_simulator_submit_retries_total: ['counter', 'Internal submit retries by PostgreSQL error code'],
  sum_simulator_pool_peak: ['gauge', 'Database pool peak since the previous scrape by statistic (waiting, in_use, total)'],
  sum_simulator_pool_peak_wait_seconds: ['gauge', 'Longest pool checkout wait since the previous scrape'],
  sum_simulator_event_loop_window_seconds: ['gauge', 'Event loop delay since the previous scrape (resolution 5 ms) by statistic'],
  sum_simulator_db_wait_events: ['gauge', 'Maximum backends per wait event within the scrape window, sampled every second; use max across replicas'],
  sum_simulator_db_locks_waiting: ['gauge', 'Ungranted PostgreSQL locks by lock type; use max across replicas'],
  sum_simulator_db_xact_commit_total: ['counter', 'Database transactions committed (pg_stat_database); same value from every replica'],
  sum_simulator_db_xact_rollback_total: ['counter', 'Database transactions rolled back (pg_stat_database)'],
  sum_simulator_db_deadlocks_total: ['counter', 'Database deadlocks detected (pg_stat_database)'],
  sum_simulator_db_blks_read_total: ['counter', 'Disk blocks read (pg_stat_database)'],
  sum_simulator_db_blks_hit_total: ['counter', 'Buffer cache hits (pg_stat_database)'],
  sum_simulator_db_temp_bytes_total: ['counter', 'Bytes written to temporary files (pg_stat_database)'],
  sum_simulator_db_wal_records_total: ['counter', 'WAL records generated (pg_stat_wal)'],
  sum_simulator_db_wal_bytes_total: ['counter', 'WAL bytes generated (pg_stat_wal)'],
  sum_simulator_db_wal_buffers_full_total: ['counter', 'Times WAL data was written because WAL buffers were full (pg_stat_wal)'],
  sum_simulator_db_wal_writes_total: ['counter', 'WAL write operations (pg_stat_io object wal, PostgreSQL 18)'],
  sum_simulator_db_wal_write_seconds_total: ['counter', 'Time spent writing WAL; needs track_wal_io_timing'],
  sum_simulator_db_wal_fsyncs_total: ['counter', 'WAL fsync operations (pg_stat_io object wal, PostgreSQL 18)'],
  sum_simulator_db_wal_fsync_seconds_total: ['counter', 'Time spent in WAL fsync; needs track_wal_io_timing']
}

export function renderMetrics(snapshots, windows = {}) {
  const families = new Map(Object.keys(definitions).map((name) => [name, []]))
  for (const [replica, snapshot] of Object.entries(snapshots)) {
    if (!['api-a', 'api-b'].includes(replica)) throw new Error('Unexpected metrics replica')
    const tags = `replica=${label(replica)}`
    const add = (name, value, extra = '') => { if (finite(value)) families.get(name).push(`${name}{${tags}${extra}} ${value}`) }
    const addHistogram = (name, extra, bounds, buckets, sum) => {
      const lines = histogramLines(name, `${tags}${extra}`, bounds, buckets, sum)
      if (lines) families.get(name).push(...lines)
    }
    const data = snapshot?.data
    const healthy = data && finite(data.process?.cpuUserMicros) && finite(data.process?.rssBytes) && finite(data.pool?.total)
    add('sum_simulator_api_up', healthy ? 1 : 0)
    if (!healthy) continue
    add('sum_simulator_cpu_seconds_total', (data.process.cpuUserMicros + data.process.cpuSystemMicros) / 1e6)
    add('sum_simulator_rss_bytes', data.process.rssBytes)
    add('sum_simulator_event_loop_p95_seconds', data.process.eventLoopP95Ms / 1000)
    add('sum_simulator_dropped_metric_samples_total', data.process.droppedMetricSamples)
    add('sum_simulator_pool_waiting', data.pool.waiting)
    for (const state of ['total', 'idle']) add('sum_simulator_pool_connections', data.pool[state], `,state=${label(state)}`)
    for (const row of data.databaseWaitEvents ?? []) {
      if (!/^[A-Za-z]{1,32}$/.test(row.wait_event_type)) continue
      add('sum_simulator_database_waits', row.count, `,wait_type=${label(row.wait_event_type)}`)
    }

    // Store: submit phases, pool acquire, statements, error causes and retries.
    const store = data.store
    if (store) {
      const bounds = toSeconds(store.durationBucketsMs)
      for (const [phase, routes] of Object.entries(store.submitPhaseMs ?? {})) {
        if (!PHASES.has(phase)) continue
        for (const [route, item] of Object.entries(routes ?? {})) {
          if (SUBMIT_ROUTES.has(route)) addHistogram('sum_simulator_submit_phase_seconds', `,phase=${label(phase)},route=${label(route)}`, bounds, item?.buckets, item?.sum / 1000)
        }
      }
      for (const [route, item] of Object.entries(store.submitStatements ?? {})) {
        if (SUBMIT_ROUTES.has(route)) addHistogram('sum_simulator_submit_statements', `,route=${label(route)}`, store.statementBuckets, item?.buckets, item?.sum)
      }
      addHistogram('sum_simulator_pool_acquire_seconds', '', bounds, store.poolAcquireMs?.buckets, store.poolAcquireMs?.sum / 1000)
      for (const [cause, value] of Object.entries(store.storageErrorsTotal ?? {})) if (CAUSES.has(cause)) add('sum_simulator_storage_errors_total', value, `,cause=${label(cause)}`)
      for (const [code, value] of Object.entries(store.submitRetriesTotal ?? {})) if (RETRY_CODES.has(code)) add('sum_simulator_submit_retries_total', value, `,code=${label(code)}`)
    }

    // Process: pool wait by route group and HTTP duration by route template.
    const seconds = toSeconds(DURATION_BUCKETS_MS)
    for (const item of data.process.poolWaitHistogram ?? []) {
      const group = item?.labels?.routeGroup
      if (isRouteTemplate(group)) addHistogram('sum_simulator_pool_wait_seconds', `,route_group=${label(group)}`, seconds, item.buckets, item.sumMs / 1000)
    }
    for (const item of data.process.httpDurationHistogram ?? []) {
      const { method, route, status } = item?.labels ?? {}
      if (METHODS.has(method) && isRouteTemplate(route) && isStatus(status)) addHistogram('sum_simulator_http_request_seconds', `,method=${label(method)},route=${label(route)},status=${label(status)}`, seconds, item.buckets, item.sumMs / 1000)
    }

    // Window gauges are reset on read by the API; windows merged across polls (when given) take precedence.
    const window = windows[replica]
    const loopWindow = window ? window.eventLoopWindow : data.process.eventLoopWindow ?? {}
    for (const [stat, key] of [['p50', 'p50Ms'], ['p95', 'p95Ms'], ['p99', 'p99Ms'], ['max', 'maxMs']]) add('sum_simulator_event_loop_window_seconds', loopWindow[key] / 1000, `,stat=${label(stat)}`)
    const peaks = window ? window.poolPeaks : data.process.poolPeaks ?? {}
    for (const [stat, key] of [['waiting', 'maxWaitingCount'], ['in_use', 'maxInUse'], ['total', 'maxTotalCount']]) add('sum_simulator_pool_peak', peaks[key], `,stat=${label(stat)}`)
    add('sum_simulator_pool_peak_wait_seconds', peaks.maxWaitMs / 1000)

    // PostgreSQL side.
    const database = data.database ?? {}
    const events = window ? [...window.waitEventsMax.values()] : database.waitEventsMax ?? []
    for (const row of events) {
      if (WAIT_TYPE.test(row?.wait_event_type) && WAIT_EVENT.test(row?.wait_event)) add('sum_simulator_db_wait_events', row.count, `,wait_type=${label(row.wait_event_type)},wait_event=${label(row.wait_event)}`)
    }
    for (const row of database.locksWaiting ?? []) if (LOCK_TYPE.test(row?.locktype)) add('sum_simulator_db_locks_waiting', row.count, `,locktype=${label(row.locktype)}`)
    const stats = database.stats ?? {}
    add('sum_simulator_db_xact_commit_total', stats.xactCommit)
    add('sum_simulator_db_xact_rollback_total', stats.xactRollback)
    add('sum_simulator_db_deadlocks_total', stats.deadlocks)
    add('sum_simulator_db_blks_read_total', stats.blksRead)
    add('sum_simulator_db_blks_hit_total', stats.blksHit)
    add('sum_simulator_db_temp_bytes_total', stats.tempBytes)
    const wal = database.wal ?? {}
    add('sum_simulator_db_wal_records_total', wal.walRecords)
    add('sum_simulator_db_wal_bytes_total', wal.walBytes)
    add('sum_simulator_db_wal_buffers_full_total', wal.walBuffersFull)
    add('sum_simulator_db_wal_writes_total', wal.writes)
    add('sum_simulator_db_wal_write_seconds_total', wal.writeSeconds)
    add('sum_simulator_db_wal_fsyncs_total', wal.fsyncs)
    add('sum_simulator_db_wal_fsync_seconds_total', wal.fsyncSeconds)
  }
  const lines = []
  for (const [name, [type, description]] of Object.entries(definitions)) {
    lines.push(`# HELP ${name} ${description}`, `# TYPE ${name} ${type}`, ...families.get(name))
  }
  return `${lines.join('\n')}\n`
}

export async function startExporter() {
  const contents = await readFile('/runtime/config.env', 'utf8')
  const secret = /^SIMULATOR_METRICS_TOKEN=([A-Za-z0-9_-]{32,128})$/m.exec(contents)?.[1]
  if (!secret) throw new Error('Synthetic metrics token missing')
  let snapshots = { 'api-a': null, 'api-b': null }
  // The API resets its window gauges on every read; polls (2 s) are merged until the next scrape consumes them.
  let windows = {}
  let updating = false
  const update = async () => {
    if (updating) return
    updating = true
    try {
      const entries = await Promise.all(Object.keys(snapshots).map(async replica => {
        try {
          const response = await fetch(`http://${replica}:3000/simulator/metrics`, {
            headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(3000)
          })
          return [replica, response.ok ? await response.json() : null]
        } catch { return [replica, null] }
      }))
      snapshots = Object.fromEntries(entries)
      for (const [replica, snapshot] of entries) if (snapshot?.data) windows[replica] = mergeWindow(windows[replica], snapshot.data)
    } finally { updating = false }
  }
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/metrics') { response.writeHead(404).end(); return }
    response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' })
    response.end(renderMetrics(snapshots, windows))
    windows = Object.fromEntries(Object.keys(snapshots).map((replica) => [replica, mergeWindow(undefined, undefined)]))
  })
  await update()
  const timer = setInterval(() => void update(), 2000)
  server.listen(9100, '0.0.0.0')
  const close = () => { clearInterval(timer); server.close(() => process.exit(0)) }
  process.once('SIGTERM', close)
  process.once('SIGINT', close)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startExporter().catch(() => { console.error('Synthetic metrics exporter could not start'); process.exitCode = 1 })
}

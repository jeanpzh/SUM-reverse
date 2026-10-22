// Server-side capture for one measured run: exact counter deltas between the measurement start and end (+settle),
// read from Prometheus instant queries (no increase() extrapolation), plus max_over_time of window gauges.
// Usage: node capture.mjs <startMs> <endMs> <out.json> [settleSeconds=20]
import { writeFileSync } from 'node:fs'

const [startMs, endMs, out, settleArg] = process.argv.slice(2)
const settle = Number(settleArg ?? 20)
const prom = process.env.PROM_URL ?? 'http://127.0.0.1:9090/api/v1'
const t0 = Number(startMs) / 1000
const t1 = Number(endMs) / 1000 + settle
const rangeSeconds = Math.ceil(t1 - t0)

async function query(expr, time) {
  const url = `${prom}/query?query=${encodeURIComponent(expr)}&time=${time}`
  const body = await (await fetch(url)).json()
  if (body.status !== 'success') throw new Error(`${expr}: ${body.error}`)
  return body.data.result
}
const key = (metric, drop = []) => Object.entries(metric).filter(([k]) => !['__name__', 'instance', 'job', 'replica', ...drop].includes(k)).sort().map(([k, v]) => `${k}=${v}`).join(',')

// Sum over replicas of (value at t1 - value at t0) per label set (excluding replica). Counters are reset only by API
// recreation, which happens before the warm-up, never inside the measured window; a negative delta is reported.
async function delta(name) {
  const [a, b] = await Promise.all([query(name, t0), query(name, t1)])
  const before = new Map()
  for (const s of a) before.set(`${s.metric.replica}|${key(s.metric)}`, Number(s.value[1]))
  const sums = new Map()
  let negative = 0
  for (const s of b) {
    const d = Number(s.value[1]) - (before.get(`${s.metric.replica}|${key(s.metric)}`) ?? 0)
    if (d < 0) negative += 1
    const k = key(s.metric)
    sums.set(k, (sums.get(k) ?? 0) + d)
  }
  return { sums, negative }
}

// Histogram from cumulative bucket deltas: count, sum, mean, and p50/p95/p99 as Prometheus-style linear interpolation
// together with the bucket interval that contains the quantile (the interpolation is only exact at bucket bounds).
async function histogram(family, groupBy) {
  const [buckets, sums, counts] = await Promise.all([delta(`${family}_bucket`), delta(`${family}_sum`), delta(`${family}_count`)])
  const groups = new Map()
  for (const [k, v] of buckets.sums) {
    const labels = Object.fromEntries(k.split(',').filter(Boolean).map((p) => p.split('=')))
    const g = groupBy.map((l) => labels[l] ?? '').join('|')
    if (!groups.has(g)) groups.set(g, new Map())
    const le = labels.le === '+Inf' ? Infinity : Number(labels.le)
    groups.get(g).set(le, (groups.get(g).get(le) ?? 0) + v)
  }
  const sumOf = (src, g) => { let t = 0; for (const [k, v] of src.sums) { const labels = Object.fromEntries(k.split(',').filter(Boolean).map((p) => p.split('='))); if (groupBy.map((l) => labels[l] ?? '').join('|') === g) t += v } return t }
  const result = {}
  for (const [g, map] of groups) {
    const les = [...map.keys()].sort((x, y) => x - y)
    const count = map.get(Infinity) ?? 0
    if (count <= 0) continue
    const quantile = (q) => {
      const rank = q * count
      let prevLe = 0, prevC = 0
      for (const le of les) {
        const c = map.get(le)
        if (c >= rank) {
          if (le === Infinity) return { value: prevLe, interval: [prevLe, null] }
          const value = prevLe + (le - prevLe) * ((rank - prevC) / Math.max(c - prevC, 1e-9))
          return { value, interval: [prevLe, le] }
        }
        prevLe = le; prevC = c
      }
      return null
    }
    const sum = sumOf(sums, g)
    result[g] = { count, sum, mean: sum / count, p50: quantile(0.5), p95: quantile(0.95), p99: quantile(0.99), buckets: Object.fromEntries(les.map((le) => [String(le), map.get(le)])) }
  }
  return { result, negative: buckets.negative + sums.negative + counts.negative }
}

async function counters(name) {
  const d = await delta(name)
  return Object.fromEntries([...d.sums].map(([k, v]) => [k || 'total', v]))
}
async function gaugeMax(name, by) {
  const r = await query(`max by (${by}) (max_over_time(${name}[${rangeSeconds}s]))`, t1)
  return Object.fromEntries(r.map((s) => [by.split(',').map((l) => s.metric[l.trim()] ?? '').join('|'), Number(s.value[1])]))
}

const capture = {
  window: { startMs: Number(startMs), endMs: Number(endMs), settleSeconds: settle },
  submitPhaseSeconds: await histogram('sum_simulator_submit_phase_seconds', ['phase', 'route']),
  submitStatements: await histogram('sum_simulator_submit_statements', ['route']),
  poolAcquireSeconds: await histogram('sum_simulator_pool_acquire_seconds', []),
  poolWaitSeconds: await histogram('sum_simulator_pool_wait_seconds', ['route_group']),
  httpRequestSeconds: await histogram('sum_simulator_http_request_seconds', ['method', 'route', 'status']),
  storageErrors: await counters('sum_simulator_storage_errors_total'),
  submitRetries: await counters('sum_simulator_submit_retries_total'),
  // Database-wide counters are reported identically by both replicas: take one replica (max) instead of summing.
  database: Object.fromEntries(await Promise.all(['xact_commit', 'xact_rollback', 'deadlocks', 'blks_read', 'blks_hit', 'temp_bytes', 'wal_records', 'wal_bytes', 'wal_buffers_full', 'wal_writes', 'wal_write_seconds', 'wal_fsyncs', 'wal_fsync_seconds'].map(async (n) => {
    const name = `max(sum_simulator_db_${n}_total)`
    const [a, b] = await Promise.all([query(name, t0), query(name, t1)])
    return [n, b.length && a.length ? Number(b[0].value[1]) - Number(a[0].value[1]) : null]
  }))),
  waitEventsMax: await gaugeMax('sum_simulator_db_wait_events', 'wait_type,wait_event'),
  locksWaitingMax: await gaugeMax('sum_simulator_db_locks_waiting', 'locktype'),
  poolPeak: await gaugeMax('sum_simulator_pool_peak', 'replica,stat'),
  poolPeakWaitSeconds: await gaugeMax('sum_simulator_pool_peak_wait_seconds', 'replica'),
  eventLoopWindowSeconds: await gaugeMax('sum_simulator_event_loop_window_seconds', 'replica,stat'),
}
writeFileSync(out, `${JSON.stringify(capture, null, 2)}\n`)
const total = capture.submitPhaseSeconds.result
console.log(JSON.stringify({ out, phaseGroups: Object.keys(total).length, negativeDeltas: capture.submitPhaseSeconds.negative }))

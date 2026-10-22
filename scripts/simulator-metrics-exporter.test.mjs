import assert from 'node:assert/strict'
import test from 'node:test'
import { isRouteTemplate, mergeWindow, renderMetrics } from '../infra/simulator/metrics-exporter.mjs'

test('exports bounded operational metrics without route or identity labels', () => {
  const output = renderMetrics({ 'api-a': { data: {
    process: { cpuUserMicros: 2e6, cpuSystemMicros: 1e6, rssBytes: 4096, eventLoopP95Ms: 20, droppedMetricSamples: 0 },
    pool: { total: 12, idle: 4, waiting: 3 }, databaseWaitEvents: [{ wait_event_type: 'Lock', count: 5 }],
    routes: [{ actorId: 'DO-NOT-EXPORT', credential: 'DO-NOT-EXPORT' }]
  } }, 'api-b': null })
  assert.match(output, /sum_simulator_cpu_seconds_total\{replica="api-a"\} 3\n/)
  assert.match(output, /sum_simulator_event_loop_p95_seconds\{replica="api-a"\} 0.02\n/)
  assert.match(output, /sum_simulator_pool_waiting\{replica="api-a"\} 3\n/)
  assert.match(output, /sum_simulator_api_up\{replica="api-b"\} 0\n/)
  assert.doesNotMatch(output, /DO-NOT-EXPORT|actorId|credential/)
})

test('rejects arbitrary replica labels and omits malformed metrics', () => {
  assert.throws(() => renderMetrics({ other: {} }), /Unexpected metrics replica/)
  assert.doesNotMatch(renderMetrics({ 'api-a': { data: { process: { rssBytes: NaN }, pool: {} } } }), /NaN|undefined/)
})

const bounds = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000, 20000, 30000]
const zeros = () => Array.from({ length: bounds.length + 1 }, () => 0)
const histogram = (counts, sum) => {
  const buckets = zeros()
  for (const [slot, n] of Object.entries(counts)) buckets[slot] = n
  return { count: buckets.reduce((a, b) => a + b, 0), sum, buckets }
}
const series = (labels, counts, sumMs) => ({ labels, ...histogram(counts, sumMs), sumMs, maxMs: 0 })
const UUID = '0f8fad5b-d9cb-469f-a165-2e9d3d5a8f3f'
const SECRET = 'A'.repeat(43)

function syntheticSnapshot() {
  const phases = {}
  for (const phase of ['pre_lock', 'section_lock_first', 'section_lock_wait', 'critical', 'commit', 'total']) {
    phases[phase] = {}
    for (const route of ['accepted', 'rejected', 'replay', 'failed']) phases[phase][route] = histogram({}, 0)
  }
  phases.commit.accepted = histogram({ 0: 1, 3: 2, [bounds.length]: 1 }, 40000)
  return { data: {
    process: {
      cpuUserMicros: 1e6, cpuSystemMicros: 0, rssBytes: 1, eventLoopP95Ms: 1, droppedMetricSamples: 0,
      eventLoopWindow: { p50Ms: 5, p95Ms: 10, p99Ms: 20, maxMs: 40, samples: 9 },
      poolPeaks: { maxWaitingCount: 7, maxInUse: 12, maxTotalCount: 12, maxWaitMs: 250 },
      poolWaitHistogram: [
        series({ routeGroup: '/local/matricula-regular/v1/solicitudes' }, { 1: 2, 2: 1 }, 4),
        series({ routeGroup: `/local/${UUID}` }, { 0: 1 }, 1),
        series({ routeGroup: '/local/x?actorId=SYN-0001' }, { 0: 1 }, 1),
        series({ routeGroup: 'SYN-0001' }, { 0: 1 }, 1)
      ],
      httpDurationHistogram: [
        series({ method: 'POST', route: '/local/matricula-regular/v1/solicitudes', status: '200' }, { 4: 3 }, 30),
        series({ method: 'POST', route: `/local/matricula-regular/v1/solicitudes/${SECRET}`, status: '200' }, { 4: 1 }, 10),
        series({ method: 'GET', route: '/local/:requestId', status: 'SYN-0001' }, { 4: 1 }, 10),
        series({ method: 'WEIRD', route: '/ok', status: '200' }, { 4: 1 }, 10)
      ]
    },
    pool: { total: 12, idle: 4, waiting: 3 }, databaseWaitEvents: [],
    store: {
      durationBucketsMs: bounds, statementBuckets: [5, 8, 10], submitPhaseMs: { ...phases, 'actor-SYN-0001': { accepted: histogram({}, 0) } },
      poolAcquireMs: histogram({ 0: 1 }, 0.4), submitStatements: { accepted: { count: 2, sum: 14, buckets: [0, 1, 1, 0] }, [UUID]: { count: 1, sum: 1, buckets: [1, 0, 0, 0] } },
      storageErrorsTotal: { lock_timeout: 3, pool_timeout: 1, 'SYN-0001': 9 }, submitRetriesTotal: { '55P03': 2, ZZZZZ: 5 }
    },
    database: {
      waitEventsMax: [
        { wait_event_type: 'Lock', wait_event: 'transactionid', count: 9 }, { wait_event_type: 'IO', wait_event: 'WALSync', count: 2 },
        { wait_event_type: 'Lock', wait_event: UUID, count: 1 }, { wait_event_type: 'SYN-0001', wait_event: 'x', count: 1 }
      ],
      locksWaiting: [{ locktype: 'transactionid', count: 4 }, { locktype: 'SYN-0001', count: 1 }],
      stats: { xactCommit: 10, xactRollback: 1, deadlocks: 0, blksRead: 5, blksHit: 50, tempBytes: 0 },
      wal: { walRecords: 100, walBytes: 2048, walBuffersFull: 0, writes: 12, writeSeconds: 0.5, fsyncs: 3, fsyncSeconds: 0.25 }
    }
  } }
}

test('renders cumulative Prometheus histograms in seconds with +Inf equal to _count', () => {
  const output = renderMetrics({ 'api-a': syntheticSnapshot(), 'api-b': null })
  const name = 'sum_simulator_submit_phase_seconds'
  const tags = 'replica="api-a",phase="commit",route="accepted"'
  // Non-cumulative slots: 0.5 ms = 1, 5 ms = 2, +Inf slot = 1 => cumulative 1, 1, 1, 3, ..., 3, 4.
  assert.match(output, new RegExp(`${name}_bucket\\{${tags},le="0.0005"\\} 1\\n`))
  assert.match(output, new RegExp(`${name}_bucket\\{${tags},le="0.002"\\} 1\\n`))
  assert.match(output, new RegExp(`${name}_bucket\\{${tags},le="0.005"\\} 3\\n`))
  assert.match(output, new RegExp(`${name}_bucket\\{${tags},le="30"\\} 3\\n`))
  assert.match(output, new RegExp(`${name}_bucket\\{${tags},le="\\+Inf"\\} 4\\n`))
  assert.match(output, new RegExp(`${name}_count\\{${tags}\\} 4\\n`))
  assert.match(output, new RegExp(`${name}_sum\\{${tags}\\} 40\\n`))
  // Every histogram series: monotonic buckets and +Inf === _count.
  const groups = new Map()
  for (const line of output.split('\n')) {
    const match = /^(\w+?)_(bucket|count)\{(.*?)(?:,le="([^"]+)")?\} (\S+)$/.exec(line)
    if (!match) continue
    const key = `${match[1]}|${match[3]}`
    const entry = groups.get(key) ?? { buckets: [], inf: undefined, count: undefined }
    if (match[2] === 'bucket') {
      entry.buckets.push(Number(match[5]))
      if (match[4] === '+Inf') entry.inf = Number(match[5])
    } else entry.count = Number(match[5])
    groups.set(key, entry)
  }
  assert.ok(groups.size >= 24)
  for (const [key, entry] of groups) {
    assert.deepEqual(entry.buckets, [...entry.buckets].sort((a, b) => a - b), `${key} must be cumulative`)
    assert.equal(entry.inf, entry.count, `${key} +Inf must equal _count`)
  }
  assert.match(output, /sum_simulator_pool_wait_seconds_bucket\{replica="api-a",route_group="\/local\/matricula-regular\/v1\/solicitudes",le="0.001"\} 2\n/)
  assert.match(output, /sum_simulator_pool_wait_seconds_bucket\{replica="api-a",route_group="\/local\/matricula-regular\/v1\/solicitudes",le="0.002"\} 3\n/)
  assert.match(output, /sum_simulator_http_request_seconds_count\{replica="api-a",method="POST",route="\/local\/matricula-regular\/v1\/solicitudes",status="200"\} 3\n/)
  assert.match(output, /sum_simulator_submit_statements_bucket\{replica="api-a",route="accepted",le="8"\} 1\n/)
  assert.match(output, /sum_simulator_pool_acquire_seconds_count\{replica="api-a"\} 1\n/)
})

test('renders counters, window gauges and PostgreSQL series with allow-listed labels', () => {
  const output = renderMetrics({ 'api-a': syntheticSnapshot() })
  assert.match(output, /sum_simulator_storage_errors_total\{replica="api-a",cause="lock_timeout"\} 3\n/)
  assert.match(output, /sum_simulator_submit_retries_total\{replica="api-a",code="55P03"\} 2\n/)
  assert.match(output, /sum_simulator_pool_peak\{replica="api-a",stat="waiting"\} 7\n/)
  assert.match(output, /sum_simulator_pool_peak_wait_seconds\{replica="api-a"\} 0.25\n/)
  assert.match(output, /sum_simulator_event_loop_window_seconds\{replica="api-a",stat="max"\} 0.04\n/)
  assert.match(output, /sum_simulator_db_wait_events\{replica="api-a",wait_type="Lock",wait_event="transactionid"\} 9\n/)
  assert.match(output, /sum_simulator_db_wait_events\{replica="api-a",wait_type="IO",wait_event="WALSync"\} 2\n/)
  assert.match(output, /sum_simulator_db_locks_waiting\{replica="api-a",locktype="transactionid"\} 4\n/)
  assert.match(output, /sum_simulator_db_xact_commit_total\{replica="api-a"\} 10\n/)
  assert.match(output, /sum_simulator_db_wal_fsync_seconds_total\{replica="api-a"\} 0.25\n/)
  assert.match(output, /sum_simulator_db_wal_bytes_total\{replica="api-a"\} 2048\n/)
})

test('drops labels outside the allow-lists and never lets identities reach the output', () => {
  const output = renderMetrics({ 'api-a': syntheticSnapshot() })
  assert.doesNotMatch(output, /SYN-|actorId|WEIRD|ZZZZZ|actor-/)
  assert.ok(!output.includes(UUID), 'UUID must not be rendered')
  assert.ok(!output.includes(SECRET), '43-char base64url must not be rendered')
  assert.doesNotMatch(output, /[A-Za-z0-9_-]{43}/)
  assert.doesNotMatch(output, /\?|=SYN/)
  assert.doesNotMatch(output, /route_group="none"/)
  assert.match(output, /route_group="\/local\/matricula-regular\/v1\/solicitudes"/)
})

test('route templates accept only path segments and :param placeholders', () => {
  for (const ok of ['/local/matricula-regular/v1/solicitudes/:requestId', '/simulator/metrics', '/', 'none', 'unmatched']) assert.equal(isRouteTemplate(ok), true, ok)
  for (const bad of ['/a?b=1', `/a/${UUID}`, `/a/${SECRET}`, '/A/B', 'http://x/y', '/a b', '/a//b', 7, undefined]) assert.equal(isRouteTemplate(bad), false, String(bad))
})

test('merges window gauges across polls so a scrape sees the peak of all polls', () => {
  const first = mergeWindow(undefined, { process: { eventLoopWindow: { maxMs: 10 }, poolPeaks: { maxWaitingCount: 9 } }, database: { waitEventsMax: [{ wait_event_type: 'Lock', wait_event: 'tuple', count: 2 }] } })
  const second = mergeWindow(first, { process: { eventLoopWindow: { maxMs: 4 }, poolPeaks: { maxWaitingCount: 1 } }, database: { waitEventsMax: [{ wait_event_type: 'Lock', wait_event: 'tuple', count: 5 }, { wait_event_type: 'IO', wait_event: 'WALSync', count: 1 }] } })
  assert.equal(second.eventLoopWindow.maxMs, 10)
  assert.equal(second.poolPeaks.maxWaitingCount, 9)
  assert.equal(second.waitEventsMax.get('Lock|tuple').count, 5)
  const output = renderMetrics({ 'api-a': syntheticSnapshot() }, { 'api-a': second })
  assert.match(output, /sum_simulator_pool_peak\{replica="api-a",stat="waiting"\} 9\n/)
  assert.match(output, /sum_simulator_db_wait_events\{replica="api-a",wait_type="Lock",wait_event="tuple"\} 5\n/)
  assert.doesNotMatch(output, /wait_event="transactionid"/)
  const consumed = renderMetrics({ 'api-a': syntheticSnapshot() }, { 'api-a': mergeWindow(undefined, undefined) })
  assert.doesNotMatch(consumed, /sum_simulator_pool_peak\{|sum_simulator_db_wait_events\{/)
})

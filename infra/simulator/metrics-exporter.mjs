import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const label = (value) => JSON.stringify(String(value))

export function renderMetrics(snapshots) {
  const lines = []
  const definitions = {
    sum_simulator_api_up: ['gauge', 'Whether the protected synthetic API metrics snapshot is available'],
    sum_simulator_cpu_seconds_total: ['counter', 'Cumulative CPU seconds used by this API process'],
    sum_simulator_rss_bytes: ['gauge', 'Resident memory bytes of this API process'],
    sum_simulator_event_loop_p95_seconds: ['gauge', 'Process lifetime event loop delay p95 seconds'],
    sum_simulator_pool_connections: ['gauge', 'Database pool connections by state'],
    sum_simulator_pool_waiting: ['gauge', 'Requests waiting for a database pool connection'],
    sum_simulator_database_waits: ['gauge', 'Database backend wait categories observed by each replica; use max across observers'],
    sum_simulator_dropped_metric_samples_total: ['counter', 'API route metric samples dropped before persistence']
  }
  for (const [name, [type, description]] of Object.entries(definitions)) {
    lines.push(`# HELP ${name} ${description}`, `# TYPE ${name} ${type}`)
  }
  for (const [replica, snapshot] of Object.entries(snapshots)) {
    if (!['api-a', 'api-b'].includes(replica)) throw new Error('Unexpected metrics replica')
    const tags = `replica=${label(replica)}`
    const add = (name, value, extra = '') => { if (finite(value)) lines.push(`${name}{${tags}${extra}} ${value}`) }
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
  }
  return `${lines.join('\n')}\n`
}

export async function startExporter() {
  const contents = await readFile('/runtime/config.env', 'utf8')
  const secret = /^SIMULATOR_METRICS_TOKEN=([A-Za-z0-9_-]{32,128})$/m.exec(contents)?.[1]
  if (!secret) throw new Error('Synthetic metrics token missing')
  let snapshots = { 'api-a': null, 'api-b': null }
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
    } finally { updating = false }
  }
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/metrics') { response.writeHead(404).end(); return }
    response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' })
    response.end(renderMetrics(snapshots))
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

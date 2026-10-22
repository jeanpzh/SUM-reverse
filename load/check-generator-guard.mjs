import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const defaults = { k6Pattern: '^sum-load-', k6Cpus: 1, cpuFraction: 0.85, maxConsecutive: 5, blockedP95Ms: 50, connectingP95Ms: 1, connectionModel: 'keepalive', blockedFraction: 0.1 }
const CONNECTION_MODELS = new Set(['keepalive', 'per-vu'])
const REMOTE_WRITE = 'Failed to send the time series data to the endpoint'

function parseResources(csv) {
  const rows = []
  for (const line of String(csv ?? '').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const [timestamp, container, cpu] = line.split(',')
    if (timestamp === 'timestamp_ms') continue
    const cpuPercent = Number(cpu)
    if (!container || cpu === '' || !Number.isFinite(cpuPercent)) continue
    rows.push({ timestamp: Number(timestamp), container, cpuPercent })
  }
  return rows
}

// Pure: no I/O. Returns { valid, reasons }. Reads only metric values, never `thresholds`
// (in the legacy summary-export JSON `thresholds: true` means FAILED).
export function evaluateGeneratorGuard({ resourcesCsv, summary, log, options = {} } = {}) {
  const opts = { ...defaults, ...options }
  if (!CONNECTION_MODELS.has(opts.connectionModel)) throw new Error(`Unknown connection model: ${opts.connectionModel}`)
  const reasons = []
  const k6Re = new RegExp(opts.k6Pattern)
  const limit = opts.cpuFraction * 100 * opts.k6Cpus

  const k6Rows = parseResources(resourcesCsv).filter((row) => k6Re.test(row.container))
  const byContainer = new Map()
  for (const row of k6Rows) {
    if (!byContainer.has(row.container)) byContainer.set(row.container, [])
    byContainer.get(row.container).push(row)
  }
  const maxSamples = Math.max(0, ...[...byContainer.values()].map((rows) => rows.length))
  if (maxSamples < 2) {
    reasons.push('RESOURCES_MISSING: faltan muestras de recursos del generador k6 (se requieren al menos 2); la corrida no es clasificable')
  }
  for (const [container, rows] of byContainer) {
    let run = 0
    let longest = 0
    for (const row of rows) {
      run = row.cpuPercent > limit ? run + 1 : 0
      longest = Math.max(longest, run)
    }
    if (longest > opts.maxConsecutive) {
      reasons.push(`GEN_CPU: ${container} superó ${limit}% de CPU (85% de ${opts.k6Cpus} CPU) durante ${longest} muestras consecutivas (máximo ${opts.maxConsecutive}); generador saturado`)
    }
  }

  const metrics = summary?.metrics ?? {}
  const p95 = (name) => metrics[name]?.['p(95)'] ?? metrics[name]?.values?.['p(95)']
  const blocked = p95('http_req_blocked')
  const connecting = p95('http_req_connecting')
  const duration = p95('http_req_duration')
  if (opts.connectionModel === 'per-vu') {
    // One iteration per VU: every VU opens its own connection, so connecting > 0 is inherent and not a fault.
    // http_req_duration excludes blocked time; blocked only delays arrivals, so it is bounded relative to the latency measured.
    const limit = Math.max(opts.blockedP95Ms, opts.blockedFraction * (duration ?? 0))
    if (typeof blocked === 'number' && blocked > limit) {
      reasons.push(`HTTP_BLOCKED: http_req_blocked p(95)=${blocked} ms supera ${limit} ms (máx. de ${opts.blockedP95Ms} ms y ${opts.blockedFraction * 100}% del p(95) de http_req_duration); el cliente retrasa las llegadas`)
    }
  } else {
    if (typeof blocked === 'number' && blocked > opts.blockedP95Ms) {
      reasons.push(`HTTP_BLOCKED: http_req_blocked p(95)=${blocked} ms supera ${opts.blockedP95Ms} ms; el cliente espera conexiones`)
    }
    // Approximation: with keepalive, a p(95) of connecting above 1 ms implies sustained new connections.
    if (typeof connecting === 'number' && connecting > opts.connectingP95Ms) {
      reasons.push(`HTTP_CONNECTING: http_req_connecting p(95)=${connecting} ms supera ${opts.connectingP95Ms} ms; se abren conexiones nuevas pese a keepalive`)
    }
  }
  const dropped = metrics.dropped_iterations?.count ?? metrics.dropped_iterations?.values?.count
  if (typeof dropped === 'number' && dropped > 0) {
    reasons.push(`DROPPED_ITERATIONS: ${dropped} iteraciones descartadas; cliente sin VUs suficientes, no es una falla del servidor`)
  }
  const unclassifiable = opts.connectionModel === 'per-vu'
    ? typeof blocked !== 'number' || typeof duration !== 'number'
    : typeof blocked !== 'number' || typeof connecting !== 'number'
  if (unclassifiable) {
    const needed = opts.connectionModel === 'per-vu' ? 'http_req_blocked o http_req_duration' : 'http_req_blocked o http_req_connecting'
    reasons.push(`SUMMARY_UNCLASSIFIABLE: el resumen de k6 no trae p(95) de ${needed}; no se puede validar al generador`)
  }
  if (typeof log === 'string' && log.includes(REMOTE_WRITE)) {
    reasons.push('REMOTE_WRITE: falló el envío de series a Prometheus (remote-write); la corrida no sirve para aceptación en Grafana')
  }
  return { valid: reasons.length === 0, reasons }
}

function usage(message) {
  if (message) process.stderr.write(`${message}\n`)
  process.stderr.write('Usage: node load/check-generator-guard.mjs --resources <csv> --summary <summary.json> [--log <k6.log>] [--k6-pattern <regex>] [--k6-cpus <number>] [--connection-model keepalive|per-vu]\n')
  process.exit(2)
}

function main(argv) {
  const args = {}
  const known = new Set(['--resources', '--summary', '--log', '--k6-pattern', '--k6-cpus', '--connection-model'])
  for (let i = 0; i < argv.length; i += 2) {
    if (!known.has(argv[i]) || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) usage(`Invalid argument or missing value: ${argv[i]}`)
    if (argv[i] in args) usage(`Duplicate argument: ${argv[i]}`)
    args[argv[i]] = argv[i + 1]
  }
  if (!args['--resources'] || !args['--summary']) usage('--resources and --summary are required.')
  const options = {}
  if (args['--k6-pattern']) {
    try { new RegExp(args['--k6-pattern']) } catch { usage('--k6-pattern is not a valid regex.') }
    options.k6Pattern = args['--k6-pattern']
  }
  if (args['--k6-cpus'] !== undefined) {
    const cpus = Number(args['--k6-cpus'])
    if (!Number.isFinite(cpus) || cpus <= 0) usage('--k6-cpus must be a positive number.')
    options.k6Cpus = cpus
  }
  if (args['--connection-model'] !== undefined) {
    if (!CONNECTION_MODELS.has(args['--connection-model'])) usage('--connection-model must be keepalive or per-vu.')
    options.connectionModel = args['--connection-model']
  }
  let summary
  try { summary = JSON.parse(readFileSync(args['--summary'], 'utf8')) } catch { usage('--summary is not readable JSON.') }
  const resourcesCsv = existsSync(args['--resources']) ? readFileSync(args['--resources'], 'utf8') : undefined
  if (args['--log'] && !existsSync(args['--log'])) usage('--log file does not exist.')
  const log = args['--log'] ? readFileSync(args['--log'], 'utf8') : undefined
  const result = evaluateGeneratorGuard({ resourcesCsv, summary, log, options })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exit(result.valid ? 0 : 3)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2))

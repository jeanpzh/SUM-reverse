// P1-06 aggregation: one sanitized record per run (no testids, campaign ids or UUIDs) and per-variant median [min, max].
// Usage: node aggregate.mjs <runs-dir> <out-dir>
//   writes <out-dir>/runs.json (per run) and <out-dir>/variants.json (label without -rN suffix -> stats)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [dir, outDir] = process.argv.slice(2)
const results = (process.env.RESULTS_DIR ?? 'infra/simulator/runtime/results')
const read = (f) => JSON.parse(readFileSync(f, 'utf8'))
const r1 = (v) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10) / 10)
const sMs = (s) => r1(s * 1000)
const done = new Set(readdirSync(join(dir, 'done')))

function interval(q) { return q ? q.interval.map((v) => (v === null ? null : v * 1000)) : null }
function routeHist(capture, family, prefix) {
  return Object.entries(capture[family].result).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => ({ k, ...v }))
}

function k6Run(label) {
  const result = read(join(dir, `${label}.result.json`))
  const summaryPath = join(results, `${result.scenario}-${result.testid}-summary.json`)
  const summary = existsSync(summaryPath) ? read(summaryPath) : null
  const metric = (name) => { const m = summary?.metrics[name]; return m?.values ?? m ?? null }
  const k6 = metric('http_req_duration{operation:submit}')
  const cap = existsSync(join(dir, `${label}.server.json`)) ? read(join(dir, `${label}.server.json`)) : null
  const out = {
    label, kind: 'k6', scenario: result.scenario, actors: result.actors, profile: result.profile,
    valid: result.runValid, passed: result.passed, guardReasons: result.generatorGuard?.reasons ?? [],
    failedThresholds: (result.failedThresholds ?? []).map((t) => `${t.metric} ${t.threshold}`),
    expected: result.expected, actual: result.actual,
    wallMs: result.endedAtMs - result.startedAtMs,
    k6Submit: k6 ? { avg: r1(k6.avg), p50: r1(k6.med), p95: r1(k6['p(95)']), p99: r1(k6['p(99)']), max: r1(k6.max) } : null,
    k6All: metric('http_req_duration') ? { p95: r1(metric('http_req_duration')['p(95)']), p99: r1(metric('http_req_duration')['p(99)']) } : null,
    httpFailed: metric('http_req_failed')?.passes ?? null,
    state: existsSync(join(dir, `${label}.state.json`)) ? read(join(dir, `${label}.state.json`)) : null,
    config: existsSync(join(dir, `${label}.config`)) ? readFileSync(join(dir, `${label}.config`), 'utf8').trim().split('\n') : null,
  }
  if (!cap) return out
  const http = routeHist(cap, 'httpRequestSeconds', 'POST|/local/matricula-regular/v1/solicitudes')
  const httpCount = http.reduce((t, h) => t + h.count, 0)
  const httpSum = http.reduce((t, h) => t + h.sum, 0)
  const main = [...http].sort((a, b) => b.count - a.count)[0]
  const phases = cap.submitPhaseSeconds.result
  const phaseSum = (p) => Object.entries(phases).filter(([k]) => k.startsWith(`${p}|`)).reduce((t, [, h]) => t + h.sum, 0)
  const pool = cap.poolWaitSeconds.result['/local/matricula-regular/v1/solicitudes']
  if (httpCount > 0 && k6) {
    const k6Mean = k6.avg / 1000
    const per = (s) => s / httpCount
    const comp = {
      clientNginxGap: k6Mean - httpSum / httpCount,
      poolWaitInRequest: per(pool?.sum ?? 0),
      preLock: per(phaseSum('pre_lock')),
      sectionLockWait: per(phaseSum('section_lock_wait')),
      critical: per(phaseSum('critical')),
      commit: per(phaseSum('commit')),
    }
    const named = Object.values(comp).reduce((a, b) => a + b, 0)
    out.attribution = {
      meanMs: Object.fromEntries([...Object.entries(comp), ['residual', k6Mean - named], ['server', httpSum / httpCount]].map(([k, v]) => [k, sMs(v)])),
      meanCoverage: r1((named / k6Mean) * 100),
      p95ServerIntervalMs: interval(main?.p95),
      p95CoverageInterval: main ? interval(main.p95).map((v) => (v === null ? null : r1((v / k6['p(95)']) * 100))) : null,
      p95PoolWaitIntervalMs: interval(pool?.p95),
    }
  }
  out.phasesByRoute = Object.fromEntries(Object.entries(phases).map(([k, h]) => [k, { count: h.count, meanMs: sMs(h.mean), p95IntervalMs: interval(h.p95) }]))
  out.poolWaitByGroup = Object.fromEntries(Object.entries(cap.poolWaitSeconds.result).map(([k, h]) => [k, { count: h.count, meanMs: sMs(h.mean), p95IntervalMs: interval(h.p95) }]))
  out.httpByRoute = Object.fromEntries(Object.entries(cap.httpRequestSeconds.result).filter(([, h]) => h.count > 0).map(([k, h]) => [k, { count: h.count, meanMs: sMs(h.mean), p95IntervalMs: interval(h.p95) }]))
  out.statements = Object.fromEntries(Object.entries(cap.submitStatements.result).map(([k, h]) => [k, r1(h.mean)]))
  out.storageErrors = cap.storageErrors
  out.submitRetries = cap.submitRetries
  out.database = cap.database
  out.waitEventsMax = Object.fromEntries(Object.entries(cap.waitEventsMax).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 10))
  out.locksWaitingMax = cap.locksWaitingMax
  out.poolPeak = cap.poolPeak
  out.poolPeakWaitMs = Object.fromEntries(Object.entries(cap.poolPeakWaitSeconds).map(([k, v]) => [k, sMs(v)]))
  out.eventLoopWindowMs = Object.fromEntries(Object.entries(cap.eventLoopWindowSeconds).map(([k, v]) => [k, sMs(v)]))
  out.negativeDeltas = cap.submitPhaseSeconds.negative
  return out
}

function benchRun(label) {
  const b = read(join(dir, `${label}.bench.json`))
  const p = b.phases
  const phaseMeans = {}
  for (const [phase, routes] of Object.entries(p?.submitPhaseMs ?? {})) {
    for (const [route, h] of Object.entries(routes)) if (h.count > 0) phaseMeans[`${phase}|${route}`] = { count: h.count, meanMs: r1(h.sum / h.count) }
  }
  return {
    label, kind: 'bench', profile: b.profile, actors: b.actors, poolMax: b.poolMax, cohorts: b.cohorts, catalogSections: b.catalogSections, replayRatio: b.replayRatio, replays: b.replays,
    latencyMs: b.latencyMs, drainMs: b.drainMs, submitsPerSecond: b.submitsPerSecond, accepted: b.accepted, rejected: b.rejected, errors: b.errors, errorCodes: b.errorCodes,
    expectedAccepted: b.expectedAccepted, auditPassed: b.audit?.passed, estimatedCriticalSectionMs: b.estimatedCriticalSectionMs,
    poolAcquireMeanMs: p?.poolAcquireMs?.count ? r1(p.poolAcquireMs.sum / p.poolAcquireMs.count) : null,
    phaseMeans, storageErrors: p?.storageErrorsTotal, retries: p?.submitRetriesTotal,
    state: existsSync(join(dir, `${label}.state.json`)) ? read(join(dir, `${label}.state.json`)) : null,
  }
}

function readsRun(label) {
  const r = read(join(dir, `${label}.result.json`))
  const s = read(join(dir, `${label}.summary.json`))
  const m = (n) => s.metrics[n]?.values ?? s.metrics[n] ?? null
  const cap = existsSync(join(dir, `${label}.server.json`)) ? read(join(dir, `${label}.server.json`)) : null
  const d = m('http_req_duration')
  return {
    label, kind: 'reads', rate: r.rate, k6Exit: r.k6Exit,
    k6: d ? { avg: r1(d.avg), p50: r1(d.med), p95: r1(d['p(95)']), p99: r1(d['p(99)']), max: r1(d.max) } : null,
    iterationsPerSecond: r1(m('iterations')?.rate), droppedIterations: m('dropped_iterations')?.count ?? 0, httpFailed: m('http_req_failed')?.passes ?? null,
    httpReqsPerSecond: r1(m('http_reqs')?.rate),
    poolWaitByGroup: cap ? Object.fromEntries(Object.entries(cap.poolWaitSeconds.result).map(([k, h]) => [k, { count: h.count, meanMs: sMs(h.mean), p95IntervalMs: interval(h.p95) }])) : null,
    poolPeak: cap?.poolPeak, eventLoopWindowMs: cap ? Object.fromEntries(Object.entries(cap.eventLoopWindowSeconds).map(([k, v]) => [k, sMs(v)])) : null,
    storageErrors: cap?.storageErrors,
  }
}

const labels = readdirSync(dir).filter((f) => f.endsWith('.state.json')).map((f) => f.slice(0, -'.state.json'.length)).filter((l) => done.has(l))
const runs = labels.map((l) => (existsSync(join(dir, `${l}.bench.json`)) ? benchRun(l) : existsSync(join(dir, `${l}.summary.json`)) ? readsRun(l) : k6Run(l)))

// Variant stats: median and range of the scalar paths that matter for the verdicts.
const pick = {
  k6: { p95: (r) => r.k6Submit?.p95, p99: (r) => r.k6Submit?.p99, avg: (r) => r.k6Submit?.avg, server: (r) => r.attribution?.meanMs.server, poolWait: (r) => r.attribution?.meanMs.poolWaitInRequest, lockWait: (r) => r.attribution?.meanMs.sectionLockWait, critical: (r) => r.attribution?.meanMs.critical, commit: (r) => r.attribution?.meanMs.commit, preLock: (r) => r.attribution?.meanMs.preLock, gap: (r) => r.attribution?.meanMs.clientNginxGap, residual: (r) => r.attribution?.meanMs.residual, coverage: (r) => r.attribution?.meanCoverage, poolTimeouts: (r) => r.storageErrors?.['cause=pool_timeout'] ?? 0, accepted: (r) => r.actual?.enrollments, httpFailed: (r) => r.httpFailed, campaigns: (r) => r.state?.campaigns },
  bench: { p50: (r) => r.latencyMs?.p50, p95: (r) => r.latencyMs?.p95, p99: (r) => r.latencyMs?.p99, drainMs: (r) => r.drainMs, sps: (r) => r.submitsPerSecond, accepted: (r) => r.accepted, errors: (r) => r.errors, poolAcquire: (r) => r.poolAcquireMeanMs, campaigns: (r) => r.state?.campaigns },
  reads: { p95: (r) => r.k6?.p95, p99: (r) => r.k6?.p99, avg: (r) => r.k6?.avg, itps: (r) => r.iterationsPerSecond, dropped: (r) => r.droppedIterations, failed: (r) => r.httpFailed },
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }
const variants = {}
for (const r of runs) {
  const v = r.label.replace(/-r\d+$/, '')
  ;(variants[v] ??= { kind: r.kind, labels: [], valid: [], runs: [] }).labels.push(r.label)
  variants[v].valid.push(r.kind !== 'k6' || r.valid)
  variants[v].runs.push(r)
}
const stats = {}
for (const [v, { kind, labels: ls, valid, runs: rs }] of Object.entries(variants)) {
  const used = rs.filter((r) => r.kind !== 'k6' || r.valid) // guard-invalid k6 runs are reported but excluded from the statistics
  const s = { kind, n: used.length, nTotal: rs.length, excluded: rs.filter((r) => !used.includes(r)).map((r) => r.label), labels: ls, allValid: valid.every(Boolean) }
  for (const [name, f] of Object.entries(pick[kind])) {
    const xs = used.map(f).filter((x) => typeof x === 'number')
    if (xs.length) s[name] = { median: r1(median(xs)), min: r1(Math.min(...xs)), max: r1(Math.max(...xs)) }
  }
  stats[v] = s
}
writeFileSync(join(outDir, 'runs.json'), `${JSON.stringify(runs, null, 2)}\n`)
writeFileSync(join(outDir, 'variants.json'), `${JSON.stringify(stats, null, 2)}\n`)
console.log(`${runs.length} runs, ${Object.keys(stats).length} variants`)

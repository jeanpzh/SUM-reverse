// Aggregates P0-06 baseline runs into sanitized per-run rows and per-scenario medians/ranges (no identities, no secrets).
// Usage: node aggregate.mjs <results-dir> <gitSha-prefix> <normal|quick> <out.json> [variants.json] [--no-bench]
// variants.json: [{ "scenario", "label", "fromIso", "toIso" }] labels runs started in that window (e.g. WAVE_FRONTLOAD, which run-meta does not record)
// and groups them apart. --no-bench leaves out the bench files, which carry no commit.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [dir, sha, mode = 'normal', out, ...extra] = process.argv.slice(2)
const noBench = extra.includes('--no-bench')
const variantsFile = extra.find(arg => arg !== '--no-bench')
const variants = variantsFile ? JSON.parse(readFileSync(variantsFile, 'utf8')) : []
const variantOf = (scenario, startedAtMs) => variants.find(v => v.scenario === scenario && startedAtMs >= Date.parse(v.fromIso) && startedAtMs < Date.parse(v.toIso))?.label ?? null
const read = file => { try { return JSON.parse(readFileSync(join(dir, file), 'utf8')) } catch { return null } }
const files = readdirSync(dir)
const metricValues = (summary, name) => {
  const metric = summary?.metrics?.[name]
  if (!metric) return null
  const v = metric.values ?? metric
  return { p95: v['p(95)'] ?? null, p99: v['p(99)'] ?? null, med: v.med ?? null, max: v.max ?? null, count: v.count ?? null, rate: v.rate ?? null }
}
// Mean and p90 CPU per container from the sampler CSV; the k6 container name carries the testid, so it is renamed to k6.
const resources = testid => {
  let text
  try { text = readFileSync(join(dir, `resources-${testid}.csv`), 'utf8') } catch { return null }
  const [head, ...rows] = text.trim().split('\n')
  const cols = head.split(',')
  const name = cols.indexOf('container'), cpu = cols.indexOf('cpu_percent')
  const by = {}
  for (const row of rows) {
    const cells = row.split(',')
    const key = cells[name].replace(/^sum-simulator-|-1$/g, '').replace(/^sum-load-.*/, 'k6')
    ;(by[key] ??= []).push(Number(cells[cpu]))
  }
  return Object.fromEntries(Object.entries(by).map(([key, values]) => {
    values.sort((a, b) => a - b)
    return [key, { mean: Math.round(values.reduce((a, b) => a + b, 0) / values.length), p90: Math.round(values[Math.floor(values.length * 0.9)]) }]
  }))
}
const runs = []
for (const file of files.filter(f => /-result\.json$/.test(f))) {
  const result = read(file)
  if (!result || result.mode !== mode) continue
  const meta = read(`run-meta-${result.testid}.json`)
  if (!meta || !String(meta.gitSha ?? '').startsWith(sha)) continue
  const summary = read(`${result.scenario}-${result.testid}-summary.json`)
  const durations = {}
  for (const name of Object.keys(summary?.metrics ?? {}).filter(n => n.startsWith('http_req_duration'))) durations[name] = metricValues(summary, name)
  runs.push({
    scenario: result.scenario, variant: variantOf(result.scenario, result.startedAtMs), rep: meta.rep ?? null, actors: result.actors, profile: result.profile,
    startedAtMs: result.startedAtMs, wallMs: result.endedAtMs - result.startedAtMs,
    k6Exit: result.k6Exit, integrity: result.integrity, correctnessPassed: result.correctnessPassed,
    performancePassed: result.performancePassed, runValid: result.runValid, guardReasons: result.generatorGuard?.reasons ?? [],
    failedThresholds: result.failedThresholds, expected: result.expected, actual: result.actual,
    httpReqs: metricValues(summary, 'http_reqs'), iterations: metricValues(summary, 'iterations'),
    httpReqBlocked: metricValues(summary, 'http_req_blocked'), httpReqFailed: metricValues(summary, 'http_req_failed'),
    unexpected: Object.entries(summary?.metrics ?? {}).filter(([n]) => n.endsWith('_unexpected')).reduce((sum, [, m]) => sum + ((m.values ?? m).count ?? 0), 0),
    cpu: resources(result.testid),
    durations, tableCounts: meta.tables ?? null, campaigns: meta.tables?.simulator_campaigns ?? null,
  })
}
runs.sort((a, b) => a.startedAtMs - b.startedAtMs)
const median = xs => { const s = xs.filter(x => typeof x === 'number').sort((a, b) => a - b); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const range = xs => { const s = xs.filter(x => typeof x === 'number'); return s.length ? [Math.min(...s), Math.max(...s)] : null }
const keyMetric = { login: 'http_req_duration{name:auth-login}', stress: 'http_req_duration{operation:read}' }
const scenarios = {}
for (const run of runs) {
  const key = `${run.scenario}${run.variant ? `[${run.variant}]` : ''}@${run.actors}`
  ;(scenarios[key] ??= []).push(run)
}
const aggregate = Object.fromEntries(Object.entries(scenarios).map(([key, list]) => {
  const names = [...new Set(list.flatMap(r => Object.keys(r.durations)))]
  const metrics = Object.fromEntries(names.map(name => [name, {
    p95Median: median(list.map(r => r.durations[name]?.p95)), p95Range: range(list.map(r => r.durations[name]?.p95)),
    p99Median: median(list.map(r => r.durations[name]?.p99)), p99Range: range(list.map(r => r.durations[name]?.p99)),
  }]))
  return [key, {
    n: list.length, valid: list.filter(r => r.runValid).length, correctness: list.filter(r => r.correctnessPassed).length,
    performance: list.filter(r => r.performancePassed === true).length,
    httpReqRateMedian: median(list.map(r => r.httpReqs?.rate)), wallMsMedian: median(list.map(r => r.wallMs)),
    keyMetric: keyMetric[list[0].scenario] ?? 'http_req_duration{operation:submit}',
    guardReasonCodes: [...new Set(list.flatMap(r => r.guardReasons.map(x => x.split(':')[0])))],
    metrics,
  }]
}))
const bench = noBench ? [] : files.filter(f => /^bench-shared-\d+-r\d+\.json$/.test(f)).map(f => ({ file: f, ...read(f) })).filter(b => b && b.actors)
const benchAgg = {}
for (const b of bench) (benchAgg[b.actors] ??= []).push(b)
const benchSummary = Object.fromEntries(Object.entries(benchAgg).map(([n, list]) => [n, {
  n: list.length,
  p95Median: median(list.map(b => b.latencyMs?.p95)), p95Range: range(list.map(b => b.latencyMs?.p95)),
  p99Median: median(list.map(b => b.latencyMs?.p99)), p99Range: range(list.map(b => b.latencyMs?.p99)),
  drainMsMedian: median(list.map(b => b.drainMs)), submitsPerSecondMedian: median(list.map(b => b.submitsPerSecond)),
  tcsEstMedian: median(list.map(b => b.estimatedCriticalSectionMs)), tcsEstRange: range(list.map(b => b.estimatedCriticalSectionMs)),
  tcsBudget: list[0].budgetCriticalSectionMs ?? null, accepted: [...new Set(list.map(b => b.accepted))], expectedAccepted: list[0].expectedAccepted,
  errors: list.reduce((sum, b) => sum + (b.errors ?? 0), 0), auditPassed: list.filter(b => b.audit?.passed).length,
  verdicts: list.map(b => b.verdict?.status),
}]))
const report = { generatedAt: new Date().toISOString(), gitShaPrefix: sha, mode, runs, aggregate, bench: benchSummary }
// Testids appear inside guard reasons (k6 container names); they are replaced so the output can be versioned.
writeFileSync(out, `${JSON.stringify(report, null, 2).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<testid>')}\n`)
console.log(JSON.stringify({ runs: runs.length, scenarios: Object.keys(aggregate), bench: Object.keys(benchSummary) }))

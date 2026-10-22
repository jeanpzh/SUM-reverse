// Attribution of the submit latency (strategy §5.4) for one k6 run, from its summary-export and server capture.
// Mean decomposition is exact (sums/counts); p95 is reported as the exact k6 value against bucket intervals.
// Usage: node attrib.mjs <runs-dir> <label>
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const [dir, label] = process.argv.slice(2)
const result = JSON.parse(readFileSync(join(dir, `${label}.result.json`), 'utf8'))
const server = JSON.parse(readFileSync(join(dir, `${label}.server.json`), 'utf8'))
const results = (process.env.RESULTS_DIR ?? 'infra/simulator/runtime/results')
const summaryFile = readdirSync(results).find((f) => f === `${result.scenario}-${result.testid}-summary.json`)
const summary = JSON.parse(readFileSync(join(results, summaryFile), 'utf8'))
const metric = (name) => { const m = summary.metrics[name]; return m?.values ?? m }
const k6 = metric('http_req_duration{operation:submit}')
const route = 'POST|/local/matricula-regular/v1/solicitudes'
const http = Object.entries(server.httpRequestSeconds.result).filter(([k]) => k.startsWith(route)).map(([, v]) => v)
const httpCount = http.reduce((t, h) => t + h.count, 0)
const httpSum = http.reduce((t, h) => t + h.sum, 0)
const httpMain = http.sort((a, b) => b.count - a.count)[0]
const pool = server.poolWaitSeconds.result['/local/matricula-regular/v1/solicitudes']
const phases = server.submitPhaseSeconds.result
const totals = Object.entries(phases).filter(([k]) => k.startsWith('total|'))
const storeCount = totals.reduce((t, [, h]) => t + h.count, 0)
const storeSum = totals.reduce((t, [, h]) => t + h.sum, 0)
const phaseSum = (phase) => Object.entries(phases).filter(([k]) => k.startsWith(`${phase}|`)).reduce((t, [, h]) => t + h.sum, 0)
const ms = (s) => Math.round(s * 1000 * 10) / 10
const k6Mean = k6.avg / 1000
const serverMean = httpSum / httpCount
const perReq = (sum) => sum / httpCount
const components = {
  clientNginxGap: k6Mean - serverMean,
  poolWaitInRequest: perReq(pool?.sum ?? 0),
  storePreLock: perReq(phaseSum('pre_lock')),
  storeSectionLockWait: perReq(phaseSum('section_lock_wait')),
  storeCritical: perReq(phaseSum('critical')),
  storeCommit: perReq(phaseSum('commit')),
}
const named = Object.values(components).reduce((a, b) => a + b, 0)
const residual = k6Mean - named
const out = {
  label, scenario: result.scenario, actors: result.actors, valid: result.runValid, passed: result.passed,
  counts: { k6Submits: metric('http_reqs{operation:submit}')?.count ?? null, serverRequests: httpCount, storeSubmits: storeCount },
  meanMs: { k6: ms(k6Mean), server: ms(serverMean), ...Object.fromEntries(Object.entries(components).map(([k, v]) => [k, ms(v)])), residualAuthSerializationLoop: ms(residual), storeTotal: ms(perReq(storeSum)) },
  meanCoverage: Math.round((named / k6Mean) * 1000) / 10,
  p95: {
    k6Ms: Math.round(k6['p(95)']),
    serverHttpIntervalMs: httpMain?.p95?.interval?.map((v) => (v === null ? null : v * 1000)),
    serverHttpInterpMs: httpMain ? Math.round(httpMain.p95.value * 1000) : null,
    storeTotalIntervalMs: Object.fromEntries(totals.map(([k, h]) => [k, h.p95.interval.map((v) => (v === null ? null : v * 1000))])),
    poolWaitIntervalMs: pool?.p95?.interval?.map((v) => (v === null ? null : v * 1000)),
  },
  serverP95CoverageInterval: httpMain ? httpMain.p95.interval.map((v) => (v === null ? null : Math.round((v * 1000 / k6['p(95)']) * 1000) / 10)) : null,
}
console.log(JSON.stringify(out, null, 2))

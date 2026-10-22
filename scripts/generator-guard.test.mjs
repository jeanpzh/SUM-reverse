import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { evaluateGeneratorGuard } from '../load/check-generator-guard.mjs'

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'load', 'check-generator-guard.mjs')
const header = 'timestamp_ms,container,cpu_percent,mem_bytes\n'
const csv = (cpus) => header + cpus.flatMap((cpu, i) => [
  `${1000 + i * 1000},sum-load-k6-1,${cpu},1000000`,
  `${1000 + i * 1000},sum-simulator-api-a-1,300,2000000`
]).join('\n') + '\n'
const okSummary = { metrics: { http_req_blocked: { 'p(95)': 0.01 }, http_req_connecting: { 'p(95)': 0 }, dropped_iterations: { count: 0 } }, thresholds: { x: true } }
const codes = (result) => result.reasons.map((reason) => reason.split(':')[0])

test('valid run: low k6 CPU, healthy metrics, clean log; thresholds are ignored', () => {
  const result = evaluateGeneratorGuard({ resourcesCsv: csv([40, 50, 60, 55]), summary: okSummary, log: 'ok' })
  assert.deepEqual(result, { valid: true, reasons: [] })
})

test('invalid when k6 exceeds 85% CPU for 6 consecutive samples', () => {
  const result = evaluateGeneratorGuard({ resourcesCsv: csv([90, 90, 90, 90, 90, 90]), summary: okSummary })
  assert.equal(result.valid, false)
  assert.deepEqual(codes(result), ['GEN_CPU'])
})

test('5 consecutive samples over 85% stay valid; a dip resets the run; k6Cpus scales the budget', () => {
  assert.equal(evaluateGeneratorGuard({ resourcesCsv: csv([90, 90, 90, 90, 90, 10]), summary: okSummary }).valid, true)
  assert.equal(evaluateGeneratorGuard({ resourcesCsv: csv([90, 90, 90, 10, 90, 90, 90]), summary: okSummary }).valid, true)
  assert.equal(evaluateGeneratorGuard({ resourcesCsv: csv([150, 150, 150, 150, 150, 150, 150]), summary: okSummary, options: { k6Cpus: 2 } }).valid, true)
})

test('non-k6 containers never trigger the CPU rule', () => {
  const rows = header + [1, 2, 3, 4, 5, 6, 7].map((i) => `${i},sum-simulator-api-a-1,400,1`).join('\n') + '\n1,sum-load-k6-1,10,1\n2,sum-load-k6-1,10,1\n'
  assert.equal(evaluateGeneratorGuard({ resourcesCsv: rows, summary: okSummary }).valid, true)
})

test('invalid by http_req_blocked and http_req_connecting', () => {
  const summary = { metrics: { ...okSummary.metrics, http_req_blocked: { 'p(95)': 51 }, http_req_connecting: { 'p(95)': 2 } } }
  assert.deepEqual(codes(evaluateGeneratorGuard({ resourcesCsv: csv([10, 10]), summary })), ['HTTP_BLOCKED', 'HTTP_CONNECTING'])
})

test('invalid by dropped_iterations, attributed to the client', () => {
  const summary = { metrics: { ...okSummary.metrics, dropped_iterations: { count: 3 } } }
  const result = evaluateGeneratorGuard({ resourcesCsv: csv([10, 10]), summary })
  assert.deepEqual(codes(result), ['DROPPED_ITERATIONS'])
  assert.match(result.reasons[0], /cliente sin VUs suficientes/)
})

test('invalid when resources are missing, without k6 rows, or with a single sample', () => {
  assert.deepEqual(codes(evaluateGeneratorGuard({ resourcesCsv: undefined, summary: okSummary })), ['RESOURCES_MISSING'])
  assert.deepEqual(codes(evaluateGeneratorGuard({ resourcesCsv: header + '1,__host_psi_cpu_some_avg10,0.5,\n', summary: okSummary })), ['RESOURCES_MISSING'])
  assert.deepEqual(codes(evaluateGeneratorGuard({ resourcesCsv: csv([10]), summary: okSummary })), ['RESOURCES_MISSING'])
})

test('summary without http_req_blocked/connecting is unclassifiable; the .values shape is read', () => {
  assert.deepEqual(codes(evaluateGeneratorGuard({ resourcesCsv: csv([10, 10]), summary: { metrics: {} } })), ['SUMMARY_UNCLASSIFIABLE'])
  const nested = { metrics: { http_req_blocked: { values: { 'p(95)': 80 } }, http_req_connecting: { values: { 'p(95)': 0 } } } }
  assert.deepEqual(codes(evaluateGeneratorGuard({ resourcesCsv: csv([10, 10]), summary: nested })), ['HTTP_BLOCKED'])
})

test('per-vu model ignores connecting and bounds blocked by max(50 ms, 10% of the duration p95)', () => {
  const perVu = (blocked, duration) => evaluateGeneratorGuard({
    resourcesCsv: csv([10, 10]),
    summary: { metrics: { ...okSummary.metrics, http_req_blocked: { 'p(95)': blocked }, http_req_connecting: { 'p(95)': 40 }, http_req_duration: { 'p(95)': duration } } },
    options: { connectionModel: 'per-vu' }
  })
  assert.equal(perVu(40, 100).valid, true)
  assert.equal(perVu(250, 2600).valid, true)
  assert.deepEqual(codes(perVu(270, 2600)), ['HTTP_BLOCKED'])
  assert.deepEqual(codes(perVu(51, 100)), ['HTTP_BLOCKED'])
})

test('per-vu model needs http_req_duration; an unknown model throws', () => {
  const summary = { metrics: { http_req_blocked: { 'p(95)': 1 }, http_req_connecting: { 'p(95)': 1 } } }
  assert.deepEqual(codes(evaluateGeneratorGuard({ resourcesCsv: csv([10, 10]), summary, options: { connectionModel: 'per-vu' } })), ['SUMMARY_UNCLASSIFIABLE'])
  assert.throws(() => evaluateGeneratorGuard({ resourcesCsv: csv([10, 10]), summary: okSummary, options: { connectionModel: 'pooled' } }))
})

test('invalid by the remote-write failure line', () => {
  const log = 'time="x" level=error msg="Failed to send the time series data to the endpoint"'
  assert.deepEqual(codes(evaluateGeneratorGuard({ resourcesCsv: csv([10, 10]), summary: okSummary, log })), ['REMOTE_WRITE'])
})

test('CLI exit codes: 0 valid, 3 invalid, 2 usage', () => {
  const dir = mkdtempSync(join(tmpdir(), 'generator-guard-'))
  const summary = join(dir, 'summary.json')
  const good = join(dir, 'good.csv')
  const bad = join(dir, 'bad.csv')
  writeFileSync(summary, JSON.stringify(okSummary))
  writeFileSync(good, csv([10, 20, 30]))
  writeFileSync(bad, csv([95, 95, 95, 95, 95, 95]))
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
  const valid = run('--resources', good, '--summary', summary)
  assert.equal(valid.status, 0)
  assert.equal(JSON.parse(valid.stdout).valid, true)
  const invalid = run('--resources', bad, '--summary', summary)
  assert.equal(invalid.status, 3)
  assert.match(JSON.parse(invalid.stdout).reasons[0], /^GEN_CPU:/)
  assert.equal(run('--resources', join(dir, 'absent.csv'), '--summary', summary).status, 3)
  assert.equal(run('--summary', summary).status, 2)
  assert.equal(run('--resources', good, '--summary', summary, '--log', join(dir, 'typo.log')).status, 2)
  assert.equal(run('--resources', good, '--summary', summary, '--connection-model', 'per-vu').status, 3)
  assert.equal(run('--resources', good, '--summary', summary, '--connection-model', 'pooled').status, 2)
})

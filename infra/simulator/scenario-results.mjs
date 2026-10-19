import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

const mode = process.argv[2]
const file = process.argv[3]
const validName = value => /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/.test(value ?? '')
const load = async name => { assert.ok(validName(name)); return JSON.parse(await readFile(`/runtime/results/${name}`, 'utf8')) }
if (mode === 'audit-counts') {
  const audit = await load(file)
  assert.equal(audit.passed, true, 'Current campaign must pass integrity audit before rotation')
  console.log(`${Number(audit.totals.enrollments)} ${Number(audit.totals.requests)}`)
} else if (mode === 'check') {
  const scenario = process.argv[4]
  const testid = process.argv[5]
  const status = Number(process.argv[6])
  const startedAtMs = Number(process.argv[8])
  const endedAtMs = Number(process.argv[9])
  assert.ok(validName(testid))
  const manifest = JSON.parse(await readFile('/runtime/manifest.json', 'utf8'))
  const audit = await load(file)
  const summary = await load(`${scenario}-${testid}-summary.json`)
  const count = name => Number(summary.metrics[name]?.count ?? summary.metrics[name]?.values?.count ?? 0)
  const initial = Number(manifest.initialEnrollments ?? 0)
  const initialRequests = Number(manifest.initialRequests ?? 0)
  let expectedEnrollments = initial, expectedRequests = initialRequests
  if (['race', 'ample', 'last-seat', 'multi-uniform', 'multi-hotspot'].includes(scenario)) {
    expectedEnrollments += manifest.expectedAccepted
    expectedRequests += manifest.actors.length
  } else if (scenario === 'retry') {
    expectedEnrollments += manifest.actors.length
    expectedRequests += manifest.actors.length * 2
  } else if (scenario === 'mixed') {
    expectedEnrollments += count('mixed_submissions_accepted')
    expectedRequests += count('mixed_submit_actions')
  }
  const actual = { enrollments: Number(audit.totals.enrollments), requests: Number(audit.totals.requests) }
  const integrity = audit.passed === true && actual.enrollments === expectedEnrollments && actual.requests === expectedRequests
  const failedThresholds = Object.entries(summary.metrics).flatMap(([metric, values]) =>
    Object.entries(values.thresholds ?? {}).filter(([, failed]) => failed === true).map(([threshold]) => ({ metric, threshold })))
  const performanceFailures = failedThresholds.filter(item => item.metric.startsWith('http_req_duration'))
  const correctnessFailures = failedThresholds.filter(item => !item.metric.startsWith('http_req_duration'))
  const errors = []
  if (!integrity) errors.push('SQL counts or invariants differ from the declared scenario')
  if (status !== 0) errors.push(`k6 exited ${status}; inspect threshold results`)
  const result = { scenario, testid, mode: process.argv[7] ?? 'normal', actors: manifest.actors.length, profile: manifest.scenarioProfile ?? manifest.contention,
    ...(Number.isSafeInteger(startedAtMs) && Number.isSafeInteger(endedAtMs) && endedAtMs >= startedAtMs ? { startedAtMs, endedAtMs } : {}),
    k6Exit: status, integrity, invariantsPassed: audit.passed === true,
    correctnessPassed: integrity && correctnessFailures.length === 0 && [0, 99].includes(status),
    performancePassed: Object.keys(summary.metrics).some(name => name.startsWith('http_req_duration') && summary.metrics[name].thresholds) ? performanceFailures.length === 0 : null,
    failedThresholds,
    expected: { enrollments: expectedEnrollments, requests: expectedRequests }, actual,
    passed: integrity && status === 0, errors, metrics: summary.metrics }
  await writeFile(`/runtime/results/${scenario}-${testid}-result.json`, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
  console.log(JSON.stringify({ ...result, metrics: undefined }))
  if (!result.passed) process.exitCode = 1
} else throw new Error('Unknown result operation')

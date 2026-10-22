import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const mode = process.argv[2]
const file = process.argv[3]
const validName = value => /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/.test(value ?? '')
const runtime = process.env.SCENARIO_RUNTIME_DIR ?? '/runtime'
const load = async name => { assert.ok(validName(name)); return JSON.parse(await readFile(`${runtime}/results/${name}`, 'utf8')) }
// Informative only: a missing/unreadable/malformed guard file is an invalid run, never a thrown error,
// so historical runs and runs whose guard could not execute stay readable.
const loadGuard = async name => {
  if (!name) return { valid: false, reasons: ['GUARD_MISSING: no se indico archivo de validez del generador'] }
  try {
    const guard = await load(name)
    const reasons = Array.isArray(guard.reasons) ? guard.reasons.slice(0, 20).map(String) : []
    if (typeof guard.valid !== 'boolean') return { valid: false, reasons: ['GUARD_MALFORMED: el archivo de validez no contiene "valid" booleano', ...reasons] }
    return { valid: guard.valid, reasons }
  } catch (error) {
    const code = error?.code === 'ENOENT' ? 'GUARD_MISSING: no existe el archivo de validez del generador' : 'GUARD_MALFORMED: el archivo de validez no es JSON legible'
    return { valid: false, reasons: [code] }
  }
}
if (mode === 'audit-counts') {
  const audit = await load(file)
  assert.equal(audit.passed, true, 'Current campaign must pass integrity audit before rotation')
  console.log(`${Number(audit.totals.enrollments)} ${Number(audit.totals.requests)}`)
} else if (mode === 'run-meta') {
  // run-meta <testid> <env> <rep> <gitSha> <cpuset lines: "container[ cpuset]" per line>
  // Writes counts and container cpusets only; never actor ids, credentials, sessions or connection strings.
  const [testid, env, rep, gitSha, cpusetText = ''] = process.argv.slice(3)
  assert.ok(validName(testid))
  assert.ok(['H', 'C'].includes(env), 'SCENARIO_ENV must be H or C')
  assert.ok(/^[1-9][0-9]{0,5}$/.test(rep ?? ''), 'SCENARIO_REP must be a positive integer')
  assert.ok(/^([0-9a-f]{40}|unknown)$/.test(gitSha ?? ''), 'gitSha must be a 40-hex SHA or unknown')
  const cpusets = Object.fromEntries(cpusetText.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const [name, cpuset = ''] = line.split(/\s+/)
    assert.ok(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name), 'invalid container name')
    assert.ok(/^[0-9,-]*$/.test(cpuset), 'invalid cpuset')
    return [name, cpuset]
  }))
  const connectionString = process.env.DATABASE_URL
  assert.ok(connectionString && new URL(connectionString).pathname === '/sum_simulator_synthetic', 'DATABASE_URL must target the synthetic simulator database')
  const { Pool } = createRequire(`${process.cwd()}/package.json`)('pg')
  const pool = new Pool({ connectionString, max: 1, application_name: 'sum-simulator-run-meta' })
  const tables = {}
  try {
    const found = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name LIKE 'simulator\\_%' ORDER BY table_name")
    for (const { table_name: name } of found.rows) {
      assert.ok(/^simulator_[a-z_]+$/.test(name), 'unexpected table name')
      tables[name] = Number((await pool.query(`SELECT count(*)::text AS n FROM "${name}"`)).rows[0].n)
    }
  } finally { await pool.end() }
  const meta = { testid, env, rep: Number(rep), gitSha, cpusets, tables, campaigns: tables.simulator_campaigns ?? 0 }
  await writeFile(`${runtime}/results/run-meta-${testid}.json`, `${JSON.stringify(meta, null, 2)}\n`, { mode: 0o600 })
  console.log(JSON.stringify({ testid, env, rep: meta.rep, tables: Object.keys(tables).length, campaigns: meta.campaigns }))
} else if (mode === 'check') {
  const scenario = process.argv[4]
  const testid = process.argv[5]
  const status = Number(process.argv[6])
  const startedAtMs = Number(process.argv[8])
  const endedAtMs = Number(process.argv[9])
  const generatorGuard = await loadGuard(process.argv[10])
  assert.ok(validName(testid))
  const manifest = JSON.parse(await readFile(`${runtime}/manifest.json`, 'utf8'))
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
    // runValid is informative: it never feeds correctnessPassed, performancePassed, passed or the exit status.
    generatorGuard, runValid: generatorGuard.valid === true,
    expected: { enrollments: expectedEnrollments, requests: expectedRequests }, actual,
    passed: integrity && status === 0, errors, metrics: summary.metrics }
  await writeFile(`${runtime}/results/${scenario}-${testid}-result.json`, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
  console.log(JSON.stringify({ ...result, metrics: undefined }))
  if (!result.passed) process.exitCode = 1
} else throw new Error('Unknown result operation')

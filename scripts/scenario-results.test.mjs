import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

const run = promisify(execFile)
const helper = new URL('../infra/simulator/scenario-results.mjs', import.meta.url).pathname
const runner = new URL('../load/scenarios.sh', import.meta.url).pathname
const testid = '11111111-1111-4111-8111-111111111111'

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'scenario-results-'))
  await mkdir(join(dir, 'results'))
  await writeFile(join(dir, 'manifest.json'), JSON.stringify({ actors: [], scenarioProfile: 'shared' }))
  await writeFile(join(dir, 'results', 'audit.json'), JSON.stringify({ passed: true, totals: { enrollments: 0, requests: 0 } }))
  await writeFile(join(dir, 'results', `login-${testid}-summary.json`), JSON.stringify({ metrics: {
    http_req_duration: { thresholds: { 'p(95)<800': true } },
    login_ok: { thresholds: { 'count>0': false } },
  } }))
  return dir
}

async function check(dir, guardName) {
  const args = [helper, 'check', 'audit.json', 'login', testid, '0', 'normal', '1000', '2000']
  if (guardName) args.push(guardName)
  const { stdout } = await run('node', args, { env: { ...process.env, SCENARIO_RUNTIME_DIR: dir } })
  const saved = JSON.parse(await readFile(join(dir, 'results', `login-${testid}-result.json`), 'utf8'))
  return { printed: JSON.parse(stdout), saved }
}

test('check reports a valid generator guard and leaves the verdicts untouched', async () => {
  const dir = await fixture()
  try {
    const baseline = (await check(dir)).saved
    await writeFile(join(dir, 'results', 'guard.json'), JSON.stringify({ valid: true, reasons: [] }))
    const { saved, printed } = await check(dir, 'guard.json')
    assert.deepEqual(saved.generatorGuard, { valid: true, reasons: [] })
    assert.equal(saved.runValid, true)
    assert.equal(printed.runValid, true)
    for (const key of ['performancePassed', 'correctnessPassed', 'passed', 'integrity', 'failedThresholds', 'errors']) assert.deepEqual(saved[key], baseline[key])
    assert.equal(saved.performancePassed, false)
    assert.equal(saved.correctnessPassed, true)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('an invalid guard propagates its reasons without changing performance or correctness', async () => {
  const dir = await fixture()
  try {
    const baseline = (await check(dir)).saved
    await writeFile(join(dir, 'results', 'guard.json'), JSON.stringify({ valid: false, reasons: ['K6_CPU_SATURATED: example'] }))
    const { saved } = await check(dir, 'guard.json')
    assert.deepEqual(saved.generatorGuard, { valid: false, reasons: ['K6_CPU_SATURATED: example'] })
    assert.equal(saved.runValid, false)
    assert.equal(saved.performancePassed, baseline.performancePassed)
    assert.equal(saved.correctnessPassed, baseline.correctnessPassed)
    assert.equal(saved.passed, baseline.passed)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('a missing or malformed guard file keeps check readable and marks the run invalid', async () => {
  const dir = await fixture()
  try {
    const baseline = (await check(dir)).saved
    assert.equal(baseline.runValid, false)
    assert.match(baseline.generatorGuard.reasons[0], /^GUARD_MISSING/)
    const missing = (await check(dir, 'absent.json')).saved
    assert.equal(missing.runValid, false)
    assert.match(missing.generatorGuard.reasons[0], /^GUARD_MISSING/)
    await writeFile(join(dir, 'results', 'bad.json'), '{not json')
    const malformed = (await check(dir, 'bad.json')).saved
    assert.equal(malformed.runValid, false)
    assert.match(malformed.generatorGuard.reasons[0], /^GUARD_MALFORMED/)
    await writeFile(join(dir, 'results', 'truthy.json'), JSON.stringify({ valid: 'yes', reasons: [] }))
    assert.equal((await check(dir, 'truthy.json')).saved.runValid, false)
    assert.equal(missing.performancePassed, baseline.performancePassed)
    assert.equal(missing.correctnessPassed, baseline.correctnessPassed)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

async function metaFixture() {
  const dir = await fixture()
  const pgDir = join(dir, 'node_modules', 'pg')
  await mkdir(pgDir, { recursive: true })
  await writeFile(join(pgDir, 'index.js'), `
class Pool {
  async query(sql) {
    if (/information_schema/.test(sql)) return { rows: [{ table_name: 'simulator_campaigns' }, { table_name: 'simulator_requests' }] }
    return { rows: [{ n: /simulator_campaigns/.test(sql) ? '3' : '42' }] }
  }
  async end() {}
}
module.exports = { Pool }
`)
  await writeFile(join(dir, 'package.json'), '{}')
  return dir
}

const sha = 'a'.repeat(40)
const metaEnv = dir => ({ ...process.env, SCENARIO_RUNTIME_DIR: dir, DATABASE_URL: 'postgres://simulator:topsecret@postgres:5432/sum_simulator_synthetic' })

test('run-meta stores counts, cpusets and the commit SHA without secrets', async () => {
  const dir = await metaFixture()
  try {
    const { stdout } = await run('node', [helper, 'run-meta', testid, 'C', '2', sha, 'sum-simulator-api-a-1 0-1\nsum-simulator-postgres-1 \n'], { cwd: dir, env: metaEnv(dir) })
    const file = join(dir, 'results', `run-meta-${testid}.json`)
    const text = await readFile(file, 'utf8')
    assert.deepEqual(JSON.parse(text), {
      testid, env: 'C', rep: 2, gitSha: sha,
      cpusets: { 'sum-simulator-api-a-1': '0-1', 'sum-simulator-postgres-1': '' },
      tables: { simulator_campaigns: 3, simulator_requests: 42 }, campaigns: 3,
    })
    assert.equal((await stat(file)).mode & 0o777, 0o600)
    assert.doesNotMatch(text + stdout, /topsecret|postgres:\/\//)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('run-meta rejects invalid env, rep, SHA, cpuset and non-synthetic databases', async () => {
  const dir = await metaFixture()
  try {
    const attempt = (args, env = metaEnv(dir)) => run('node', [helper, 'run-meta', ...args], { cwd: dir, env })
    await assert.rejects(attempt([testid, 'X', '1', sha, '']), /SCENARIO_ENV/)
    await assert.rejects(attempt([testid, 'H', '0', sha, '']), /SCENARIO_REP/)
    await assert.rejects(attempt([testid, 'H', '1', 'nothex', '']), /gitSha/)
    await assert.rejects(attempt([testid, 'H', '1', sha, 'api-a $(id)']), /cpuset/)
    await assert.rejects(attempt([testid, 'H', '1', sha, ''], { ...metaEnv(dir), DATABASE_URL: 'postgres://u:p@h:5432/other' }), /synthetic/)
    await attempt([testid, 'H', '1', 'unknown', ''])
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('runner validates SCENARIO_ENV and SCENARIO_REP before touching Docker and wires metadata, sampler, guard and tags', async () => {
  for (const env of [{ SCENARIO_ENV: 'X' }, { SCENARIO_ENV: 'h' }, { SCENARIO_REP: '0' }, { SCENARIO_REP: 'abc' }, { SCENARIO_REP: '1;ls' }]) {
    await assert.rejects(run('bash', [runner, 'login'], { env: { ...process.env, ...env } }), error => error.code === 2 && /SCENARIO_(ENV|REP)/.test(error.stderr))
  }
  const source = await readFile(runner, 'utf8')
  assert.match(source, /--tag "env=\$ENV_LABEL" --tag "rep=\$REP"/)
  assert.match(source, /helper run-meta /)
  assert.match(source, /load\/resource-sampler\.sh/)
  assert.match(source, /load\/check-generator-guard\.mjs/)
  assert.match(source, /enrollment\|login\|retry\|jornada\) connection_model=per-vu/)
  assert.match(source, /--connection-model "\$connection_model"/)
  assert.match(source, /"guard-\$testid\.json" \|\| check_status/)
  assert.match(source, /cleanup\(\) \{\n  stop_sampler/)
})

test('fisi-franja expects manifest.expectedAccepted enrollments and one request per actor', async () => {
  const dir = await fixture()
  try {
    const actors = Array.from({ length: 507 }, (_, index) => ({ actorId: `SYN-SIS-U${index}` }))
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({ actors, scenarioProfile: 'fisi-schools', expectedAccepted: 253, initialEnrollments: 0, initialRequests: 0 }))
    await writeFile(join(dir, 'results', 'audit.json'), JSON.stringify({ passed: true, totals: { enrollments: 253, requests: 507 } }))
    await writeFile(join(dir, 'results', `fisi-franja-${testid}-summary.json`), JSON.stringify({ metrics: {} }))
    const args = [helper, 'check', 'audit.json', 'fisi-franja', testid, '0', 'normal', '1000', '2000']
    const { stdout } = await run('node', args, { env: { ...process.env, SCENARIO_RUNTIME_DIR: dir } })
    const printed = JSON.parse(stdout)
    assert.equal(printed.profile, 'fisi-schools')
    assert.equal(printed.actors, 507)
    assert.deepEqual(printed.expected, { enrollments: 253, requests: 507 })
    assert.equal(printed.integrity, true)
    assert.equal(printed.passed, true)
    // A different SQL outcome is not an accepted FISI run.
    await writeFile(join(dir, 'results', 'audit.json'), JSON.stringify({ passed: true, totals: { enrollments: 507, requests: 507 } }))
    await assert.rejects(run('node', args, { env: { ...process.env, SCENARIO_RUNTIME_DIR: dir } }))
  } finally { await rm(dir, { recursive: true, force: true }) }
})

async function checkScenario(dir, scenario, audit, summary, manifest) {
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest))
  await writeFile(join(dir, 'results', 'audit.json'), JSON.stringify({ passed: true, totals: audit }))
  await writeFile(join(dir, 'results', `${scenario}-${testid}-summary.json`), JSON.stringify({ metrics: summary }))
  const { stdout } = await run('node', [helper, 'check', 'audit.json', scenario, testid, '0', 'normal', '1000', '2000'], { env: { ...process.env, SCENARIO_RUNTIME_DIR: dir } })
  return JSON.parse(stdout)
}

test('jornada expects manifest.expectedAccepted enrollments and one request per actor', async () => {
  const dir = await fixture()
  try {
    const actors = Array.from({ length: 1422 }, (_, index) => ({ actorId: `SYN-SIS-U${index}` }))
    const printed = await checkScenario(dir, 'jornada', { enrollments: 700, requests: 1422 }, {}, { actors, scenarioProfile: 'fisi-schools', expectedAccepted: 700, initialEnrollments: 0, initialRequests: 0 })
    assert.deepEqual(printed.expected, { enrollments: 700, requests: 1422 })
    assert.equal(printed.passed, true)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('enrollment-open expects the accepted and submitted counters', async () => {
  const dir = await fixture()
  try {
    const manifest = { actors: Array.from({ length: 400 }, (_, index) => ({ actorId: `SYN-SIS-U${index}` })), scenarioProfile: 'ample', expectedAccepted: 400, initialEnrollments: 0, initialRequests: 0 }
    const counters = { open_accepted: { count: 120 }, open_submits: { count: 120 } }
    const printed = await checkScenario(dir, 'enrollment-open', { enrollments: 120, requests: 120 }, counters, manifest)
    assert.deepEqual(printed.expected, { enrollments: 120, requests: 120 })
    assert.equal(printed.passed, true)
    await assert.rejects(checkScenario(dir, 'enrollment-open', { enrollments: 120, requests: 119 }, counters, manifest))
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('a login result with an auth-login duration threshold reports a non-null performance verdict', async () => {
  const dir = await fixture()
  try {
    const metrics = failed => ({ 'http_req_duration{name:auth-login}': { thresholds: { 'p(95)<2000': failed, 'p(99)<5000': false } } })
    const manifest = { actors: [], scenarioProfile: 'shared' }
    const ok = await checkScenario(dir, 'login', { enrollments: 0, requests: 0 }, metrics(false), manifest)
    assert.equal(ok.performancePassed, true)
    await writeFile(join(dir, 'results', `login-${testid}-summary.json`), JSON.stringify({ metrics: metrics(true) }))
    const failed = await run('node', [helper, 'check', 'audit.json', 'login', testid, '99', 'normal', '1000', '2000'], { env: { ...process.env, SCENARIO_RUNTIME_DIR: dir } }).catch(error => error)
    assert.equal(JSON.parse(failed.stdout).performancePassed, false)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

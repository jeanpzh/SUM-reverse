import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

const run = promisify(execFile)
const repo = new URL('..', import.meta.url).pathname
const campaign = '11111111-1111-4111-8111-111111111111'

// A throwaway copy of the script tree plus a fake `docker` (and no-op `sleep`) first in PATH.
// The fake logs its argv, emulates the few outputs the scripts consume and never touches a real engine.
async function tree() {
  const root = await mkdtemp(join(tmpdir(), 'scenario-orchestration-'))
  const runtime = join(root, 'infra/simulator/runtime')
  await mkdir(join(root, 'load'), { recursive: true })
  await mkdir(join(runtime, 'results'), { recursive: true })
  await mkdir(join(root, 'bin'))
  await copyFile(join(repo, 'load/scenarios.sh'), join(root, 'load/scenarios.sh'))
  await copyFile(join(repo, 'infra/simulator/rotate-campaign.sh'), join(root, 'infra/simulator/rotate-campaign.sh'))
  await writeFile(join(root, 'load/resource-sampler.sh'), 'exit 0\n')
  await writeFile(join(root, 'load/audit-load.sh'), 'exit 0\n')
  await writeFile(join(root, 'load/check-generator-guard.mjs'), 'console.log(JSON.stringify({ valid: true, reasons: [] }))\n')
  await writeFile(join(runtime, 'config.env'), `SIMULATOR_CAMPAIGN_ID=${campaign}\nSIMULATOR_RUN_ID=22222222-2222-4222-8222-222222222222\n`, { mode: 0o600 })
  await writeFile(join(runtime, 'manifest.json'), '{}', { mode: 0o600 })
  await chmod(runtime, 0o700)
  await writeFile(join(root, 'bin/sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  await writeFile(join(root, 'bin/docker'), `#!/usr/bin/env bash
printf '%s\\n' "$*" | sed "s#$FAKE_ROOT#<ROOT>#g" >> "$FAKE_LOG"
args="$*"
rt="$FAKE_ROOT/infra/simulator/runtime"
if [[ "$args" == *randomUUID* ]]; then
  n=$(( $(cat "$FAKE_ROOT/uuid-counter" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$FAKE_ROOT/uuid-counter"
  printf '00000000-0000-4000-8000-%012d' "$n"
elif [[ "$args" == *audit-counts* ]]; then echo '0 0'
elif [[ "$args" == *audit-simulator.js* ]]; then echo '{"passed":true}'
elif [[ "$args" == *" run-meta "* ]]; then
  set -- \${args#* run-meta }
  printf '{"testid":"%s","env":"%s","rep":%s}\\n' "$1" "$2" "$3" > "$rt/results/run-meta-$1.json"
elif [[ "$args" == *"k6 run"* ]]; then
  if [[ "$args" == *phase=warmup* ]]; then exit "\${FAKE_WARMUP_EXIT:-0}"; fi
elif [[ "$args" == "compose up "* || "$args" == *" run --rm --no-deps seed"* ]]; then
  [[ -f "$rt/manifest.json" ]] || { printf '{}' > "$rt/manifest.json"; chmod 600 "$rt/manifest.json"; }
fi
exit 0
`, { mode: 0o755 })
  return root
}

async function exec(root, script, args, env = {}) {
  const log = join(root, 'docker.log')
  const base = { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, FAKE_ROOT: root, FAKE_LOG: log }
  for (const key of Object.keys(base)) if (/^(SCENARIO_|SIMULATOR_)/.test(key)) delete base[key]
  let code = 0, stdout = '', stderr = ''
  try { ({ stdout, stderr } = await run('bash', [join(root, script), ...args], { cwd: root, env: { ...base, ...env } })) }
  catch (error) { code = error.code; stdout = error.stdout; stderr = error.stderr }
  const calls = (await readFile(log, 'utf8').catch(() => '')).split('\n').filter(Boolean)
  return { code, stdout, stderr, calls }
}

const withTree = fn => async () => { const root = await tree(); try { await fn(root) } finally { await rm(root, { recursive: true, force: true }) } }
const rotateArgs = ['0', '0', 'shared', '400', 'shared']

const normalize = calls => calls.map(call => call.replace(/ \d{13} \d{13} guard-/, ' <START> <END> guard-'))
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const uuidCall = '--project-directory <ROOT> run --rm --no-deps migrate node -e process.stdout.write(require(\'node:crypto\').randomUUID())'
const closeCall = `compose run --rm --no-deps -e SIMULATOR_CLOSE_CAMPAIGN_ID=${campaign} -e SIMULATOR_CONFIRM_CLOSE=${campaign} migrate node dist/scripts/close-simulator.js`

// Baseline captured from the P0-03 scripts (before P0-04) with this same fake docker.
const baselineRotateFull = [`compose ${uuidCall}`, `compose ${uuidCall}`, closeCall, 'compose up --build --force-recreate -d --wait']
const baselineRotateNoBuild = [`compose ${uuidCall}`, `compose ${uuidCall}`, closeCall, 'compose up --force-recreate -d --wait']
const baselineLogin = [
  'compose build migrate seed api-a api-b audit',
  "compose run --rm --no-deps migrate node -e process.stdout.write(require('node:crypto').randomUUID())",
  'compose run --rm --no-deps audit env -u EXPECTED_ENROLLMENTS -u EXPECTED_REQUESTS node dist/scripts/audit-simulator.js',
  `compose run --rm --no-deps migrate node /opt/simulator/scenario-results.mjs audit-counts preflight-${uuid(1)}.json`,
  `compose ${uuidCall}`,
  `compose ${uuidCall}`,
  closeCall,
  'compose up --force-recreate -d --wait',
  'compose ps -q',
  `compose run --rm --no-deps migrate node /opt/simulator/scenario-results.mjs run-meta ${uuid(1)} H 1 unknown `,
  `compose run --rm --no-deps --name sum-load-${uuid(1)} -e SCENARIO_NAME=login -e SCENARIO_RUN_MODE=normal -e LOAD_MODE=normal -e BARRIER_DELAY_MS=20000 -e STAGE_DURATION=30s k6 run --tag testid=${uuid(1)} --tag load_scenario=login --tag population=400 --tag run_mode=normal --tag env=H --tag rep=1 --out experimental-prometheus-rw --summary-export /results/login-${uuid(1)}-summary.json /load/login.js`,
  'compose run --rm --no-deps audit env -u EXPECTED_ENROLLMENTS -u EXPECTED_REQUESTS node dist/scripts/audit-simulator.js',
  `compose run --rm --no-deps migrate node /opt/simulator/scenario-results.mjs check audit-${uuid(1)}.json login ${uuid(1)} 0 normal <START> <END> guard-${uuid(1)}.json`,
]

const k6Calls = calls => calls.filter(call => call.includes(' k6 run '))
const checkCalls = calls => calls.filter(call => call.includes('scenario-results.mjs check '))
const tag = (call, name) => call.match(new RegExp(`--tag ${name}=(\\S+)`))?.[1]

test('default mode: docker invocations are identical to the P0-03 baseline', withTree(async root => {
  const full = await exec(root, 'infra/simulator/rotate-campaign.sh', rotateArgs)
  assert.equal(full.code, 0)
  assert.deepEqual(full.calls, baselineRotateFull)
  const other = await tree()
  try {
    const noBuild = await exec(other, 'infra/simulator/rotate-campaign.sh', rotateArgs, { SIMULATOR_REBUILD: '0' })
    assert.equal(noBuild.code, 0)
    assert.deepEqual(noBuild.calls, baselineRotateNoBuild)
    const explicitFull = await exec(await tree(), 'infra/simulator/rotate-campaign.sh', rotateArgs, { SIMULATOR_RECREATE: 'full' })
    assert.deepEqual(explicitFull.calls, baselineRotateFull)
  } finally { await rm(other, { recursive: true, force: true }) }
  const scenario = await exec(await tree(), 'load/scenarios.sh', ['login'])
  assert.equal(scenario.code, 0, scenario.stderr)
  assert.deepEqual(normalize(scenario.calls), baselineLogin)
}))

test('SIMULATOR_RECREATE=app runs migrate, seed and a --no-deps recreate of api-a, api-b and web, never touching postgres', withTree(async root => {
  const result = await exec(root, 'infra/simulator/rotate-campaign.sh', rotateArgs, { SIMULATOR_RECREATE: 'app' })
  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(result.calls, [
    `compose ${uuidCall}`, `compose ${uuidCall}`, closeCall,
    'compose run --rm --no-deps migrate',
    'compose run --rm --no-deps seed',
    'compose up -d --wait --no-deps --force-recreate api-a api-b web',
  ])
  assert.ok(result.calls.every(call => !/postgres/.test(call)))
  // The new campaign was written exactly as in the full path.
  const config = await readFile(join(root, 'infra/simulator/runtime/config.env'), 'utf8')
  assert.match(config, new RegExp(`SIMULATOR_CAMPAIGN_ID=${uuid(1)}`))
  // An explicit rebuild request is contradictory: app mode never builds images.
  const rebuild = await exec(await tree(), 'infra/simulator/rotate-campaign.sh', rotateArgs, { SIMULATOR_RECREATE: 'app', SIMULATOR_REBUILD: '1' })
  assert.equal(rebuild.code, 2)
  assert.deepEqual(rebuild.calls, [])
  const noBuild = await exec(await tree(), 'infra/simulator/rotate-campaign.sh', rotateArgs, { SIMULATOR_RECREATE: 'app', SIMULATOR_REBUILD: '0' })
  assert.equal(noBuild.code, 0)
  assert.equal(noBuild.calls.at(-1), 'compose up -d --wait --no-deps --force-recreate api-a api-b web')
}))

test('scenarios.sh forwards SIMULATOR_RECREATE=app to each campaign preparation', withTree(async root => {
  const result = await exec(root, 'load/scenarios.sh', ['login'], { SIMULATOR_RECREATE: 'app' })
  assert.equal(result.code, 0, result.stderr)
  assert.ok(result.calls.includes('compose run --rm --no-deps seed'))
  assert.ok(result.calls.includes('compose up -d --wait --no-deps --force-recreate api-a api-b web'))
  assert.ok(!result.calls.some(call => call.startsWith('compose up --force-recreate')))
  assert.ok(result.calls.every(call => !/postgres/.test(call)))
}))

test('SCENARIO_REPEATS=2 prepares a new campaign per repetition and tags rep=1 and rep=2', withTree(async root => {
  const result = await exec(root, 'load/scenarios.sh', ['login'], { SCENARIO_REPEATS: '2' })
  assert.equal(result.code, 0, result.stderr)
  const k6 = k6Calls(result.calls)
  assert.equal(k6.length, 2)
  assert.deepEqual(k6.map(call => tag(call, 'rep')), ['1', '2'])
  assert.equal(new Set(k6.map(call => tag(call, 'testid'))).size, 2)
  assert.equal(result.calls.filter(call => call === 'compose up --force-recreate -d --wait').length, 2)
  assert.equal(result.calls.filter(call => call.includes('close-simulator.js')).length, 2)
  assert.equal(checkCalls(result.calls).length, 2)
  const metas = await Promise.all(k6.map(async call => JSON.parse(await readFile(join(root, `infra/simulator/runtime/results/run-meta-${tag(call, 'testid')}.json`), 'utf8'))))
  assert.deepEqual(metas.map(meta => [meta.rep, meta.repeats]), [[1, 2], [2, 2]])
}))

test('SCENARIO_ORDER=shuffle with SCENARIO_SEED=42 is deterministic and records the seed', withTree(async root => {
  const env = { SCENARIO_ORDER: 'shuffle', SCENARIO_SEED: '42' }
  const first = await exec(root, 'load/scenarios.sh', ['all'], env)
  assert.equal(first.code, 0, first.stderr)
  const order = k6Calls(first.calls).map(call => tag(call, 'load_scenario'))
  assert.equal(order.length, 12)
  assert.deepEqual([...order].sort(), ['ample', 'last-seat', 'login', 'mixed', 'multi-hotspot', 'multi-uniform', 'race', 'reads', 'resilience', 'retry', 'soak', 'stress'])
  assert.notDeepEqual(order, ['login', 'race', 'last-seat', 'ample', 'mixed', 'multi-uniform', 'multi-hotspot', 'retry', 'resilience', 'stress', 'soak', 'reads'])
  assert.match(first.stdout, new RegExp(`Order=shuffle seed=42 rep=1: ${order.join(' ')}`))
  const ids = k6Calls(first.calls).map(call => tag(call, 'testid'))
  for (const id of ids) {
    const meta = JSON.parse(await readFile(join(root, `infra/simulator/runtime/results/run-meta-${id}.json`), 'utf8'))
    assert.equal(meta.orderSeed, 42)
    assert.equal(meta.order, 'shuffle')
  }
  const again = await exec(await tree(), 'load/scenarios.sh', ['all'], env)
  assert.deepEqual(k6Calls(again.calls).map(call => tag(call, 'load_scenario')), order)
  const other = await exec(await tree(), 'load/scenarios.sh', ['all'], { ...env, SCENARIO_SEED: '43' })
  assert.notDeepEqual(k6Calls(other.calls).map(call => tag(call, 'load_scenario')), order)
  const generated = await exec(await tree(), 'load/scenarios.sh', ['all'], { SCENARIO_ORDER: 'shuffle' })
  assert.match(generated.stdout, /Order=shuffle seed=\d+ rep=1:/)
}))

test('invalid orchestration variables exit 2 before any docker call', withTree(async root => {
  const cases = [
    { SCENARIO_REPEATS: '0' }, { SCENARIO_REPEATS: 'x' }, { SCENARIO_REPEATS: '2;ls' },
    { SCENARIO_REPEATS: '2', SCENARIO_REP: '1' }, { SCENARIO_WARMUP: '2' }, { SCENARIO_ORDER: 'random' },
    { SCENARIO_SEED: '-1' }, { SCENARIO_SEED: 'abc' }, { SIMULATOR_RECREATE: 'postgres' },
  ]
  for (const env of cases) {
    const result = await exec(root, 'load/scenarios.sh', ['login'], env)
    assert.equal(result.code, 2, JSON.stringify(env))
    assert.deepEqual(result.calls, [], JSON.stringify(env))
  }
  const rotate = await exec(root, 'infra/simulator/rotate-campaign.sh', rotateArgs, { SIMULATOR_RECREATE: 'bogus' })
  assert.equal(rotate.code, 2)
  assert.deepEqual(rotate.calls, [])
  // SCENARIO_REP alone (repeats=1) remains valid.
  const single = await exec(root, 'load/scenarios.sh', ['login'], { SCENARIO_REP: '3' })
  assert.equal(single.code, 0, single.stderr)
  assert.equal(tag(k6Calls(single.calls)[0], 'rep'), '3')
}))

test('SCENARIO_WARMUP=1 runs a separate phase=warmup k6 call that never reaches check', withTree(async root => {
  const result = await exec(root, 'load/scenarios.sh', ['login'], { SCENARIO_WARMUP: '1' })
  assert.equal(result.code, 0, result.stderr)
  const k6 = k6Calls(result.calls)
  assert.equal(k6.length, 2)
  const [warmup, measured] = k6
  assert.match(warmup, /--tag phase=warmup/)
  assert.match(warmup, /-e RATE=10 -e DURATION=30s/)
  assert.match(warmup, /\/load\/reads\.js$/)
  assert.doesNotMatch(measured, /phase=warmup/)
  assert.match(measured, new RegExp(`--name sum-load-${tag(measured, 'testid')} `))
  assert.ok(result.calls.indexOf(warmup) < result.calls.indexOf(measured))
  assert.equal(checkCalls(result.calls).length, 1)
  assert.ok(checkCalls(result.calls).every(call => !/warmup/.test(call)))
  const meta = JSON.parse(await readFile(join(root, `infra/simulator/runtime/results/run-meta-${tag(measured, 'testid')}.json`), 'utf8'))
  assert.equal(meta.warmup, true)
  assert.equal(meta.warmupExitCode, 0)
}))

test('warm-up tolerates the threshold exit code 99 but aborts the measured run on a hard failure', async () => {
  const soft = await tree()
  const hard = await tree()
  try {
    const threshold = await exec(soft, 'load/scenarios.sh', ['login'], { SCENARIO_WARMUP: '1', FAKE_WARMUP_EXIT: '99' })
    assert.equal(threshold.code, 0)
    assert.equal(k6Calls(threshold.calls).length, 2)
    const failed = await exec(hard, 'load/scenarios.sh', ['login'], { SCENARIO_WARMUP: '1', FAKE_WARMUP_EXIT: '107' })
    assert.equal(failed.code, 1)
    assert.equal(k6Calls(failed.calls).length, 1)
    assert.equal(checkCalls(failed.calls).length, 0)
  } finally { await rm(soft, { recursive: true, force: true }); await rm(hard, { recursive: true, force: true }) }
})

const configOf = root => readFile(join(root, 'infra/simulator/runtime/config.env'), 'utf8')

test('the 2000 actor limit: 1422 and 2000 are accepted, 2001 exits 2 before any docker call', withTree(async root => {
  const ok = await exec(root, 'infra/simulator/rotate-campaign.sh', ['0', '0', 'shared', '1422', 'shared'])
  assert.equal(ok.code, 0, ok.stderr)
  assert.match(await configOf(root), /SIMULATOR_ACTOR_COUNT=1422/)
  const max = await exec(await tree(), 'infra/simulator/rotate-campaign.sh', ['0', '0', 'shared', '2000', 'shared'])
  assert.equal(max.code, 0, max.stderr)
  const rejected = await exec(await tree(), 'infra/simulator/rotate-campaign.sh', ['0', '0', 'shared', '2001', 'shared'])
  assert.equal(rejected.code, 2)
  assert.deepEqual(rejected.calls, [])
  const scenario = await exec(await tree(), 'load/scenarios.sh', ['login'], { SCENARIO_ACTORS: '2001' })
  assert.equal(scenario.code, 2)
  assert.deepEqual(scenario.calls, [])
  const accepted = await exec(await tree(), 'load/scenarios.sh', ['login'], { SCENARIO_ACTORS: '1422' })
  assert.equal(accepted.code, 0, accepted.stderr)
  assert.equal(tag(k6Calls(accepted.calls)[0], 'population'), '1422')
}))

test('rotation with fisi-schools writes the SIMULATOR_FISI_* lines and the next shared rotation removes them', withTree(async root => {
  const fisi = await exec(root, 'infra/simulator/rotate-campaign.sh', ['0', '0', 'shared', '507', 'fisi-schools'], {
    SIMULATOR_FISI_FRANJA: '4', SIMULATOR_FISI_IA_ACTORS: '7', SIMULATOR_FISI_CAPACITY: 'scarce', SIMULATOR_FISI_SCARCE_RATIO: '0.5',
  })
  assert.equal(fisi.code, 0, fisi.stderr)
  const written = await configOf(root)
  assert.match(written, /^SIMULATOR_SCENARIO_PROFILE=fisi-schools$/m)
  assert.match(written, /^SIMULATOR_ACTOR_COUNT=507$/m)
  for (const line of ['SIMULATOR_FISI_FRANJA=4', 'SIMULATOR_FISI_IA_ACTORS=7', 'SIMULATOR_FISI_CAPACITY=scarce', 'SIMULATOR_FISI_SCARCE_RATIO=0.5']) {
    assert.equal(written.split('\n').filter(item => item === line).length, 1, line)
  }
  // The next rotation (even with the variables absent or a different value) never keeps stale FISI lines.
  const shared = await exec(root, 'infra/simulator/rotate-campaign.sh', ['0', '0', 'shared', '400', 'shared'])
  assert.equal(shared.code, 0, shared.stderr)
  const cleaned = await configOf(root)
  assert.doesNotMatch(cleaned, /SIMULATOR_FISI_/)
  assert.match(cleaned, /^SIMULATOR_SCENARIO_PROFILE=shared$/m)
  // A later fisi-schools rotation only writes what it is given: no carry-over from earlier values.
  const again = await exec(root, 'infra/simulator/rotate-campaign.sh', ['0', '0', 'shared', '507', 'fisi-schools'], { SIMULATOR_FISI_FRANJA: 'jornada' })
  assert.equal(again.code, 0, again.stderr)
  const last = await configOf(root)
  assert.match(last, /^SIMULATOR_FISI_FRANJA=jornada$/m)
  assert.doesNotMatch(last, /SIMULATOR_FISI_(IA_ACTORS|CAPACITY|SCARCE_RATIO)/)
}))

test('invalid or misplaced SIMULATOR_FISI_* values exit 2 before any docker call', async () => {
  const cases = [
    ['fisi-schools', { SIMULATOR_FISI_FRANJA: '10' }], ['fisi-schools', { SIMULATOR_FISI_FRANJA: '0' }], ['fisi-schools', { SIMULATOR_FISI_FRANJA: '' }],
    ['fisi-schools', { SIMULATOR_FISI_IA_ACTORS: '508' }], ['fisi-schools', { SIMULATOR_FISI_IA_ACTORS: '-1' }],
    ['fisi-schools', { SIMULATOR_FISI_CAPACITY: 'tight' }],
    ['fisi-schools', { SIMULATOR_FISI_SCARCE_RATIO: '0.5' }],
    ['fisi-schools', { SIMULATOR_FISI_CAPACITY: 'scarce', SIMULATOR_FISI_SCARCE_RATIO: '1' }],
    ['fisi-schools', { SIMULATOR_FISI_CAPACITY: 'scarce', SIMULATOR_FISI_SCARCE_RATIO: '0.0' }],
    ['fisi-schools', { SIMULATOR_FISI_CAPACITY: 'scarce', SIMULATOR_FISI_SCARCE_RATIO: '0.1234567' }],
    ['shared', { SIMULATOR_FISI_FRANJA: '4' }], ['ample', { SIMULATOR_FISI_CAPACITY: 'ample' }],
  ]
  for (const [profile, env] of cases) {
    const root = await tree()
    try {
      const result = await exec(root, 'infra/simulator/rotate-campaign.sh', ['0', '0', 'shared', '507', profile], env)
      assert.equal(result.code, 2, JSON.stringify([profile, env]))
      assert.deepEqual(result.calls, [], JSON.stringify([profile, env]))
    } finally { await rm(root, { recursive: true, force: true }) }
  }
})

test('fisi-franja defaults to franja 4 with 507 actors and prepares a fisi-schools campaign', withTree(async root => {
  const result = await exec(root, 'load/scenarios.sh', ['fisi-franja'])
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Scenario=fisi-franja actors=507 profile=fisi-schools /)
  const config = await configOf(root)
  assert.match(config, /^SIMULATOR_SCENARIO_PROFILE=fisi-schools$/m)
  assert.match(config, /^SIMULATOR_ACTOR_COUNT=507$/m)
  assert.match(config, /^SIMULATOR_FISI_FRANJA=4$/m)
  assert.doesNotMatch(config, /SIMULATOR_FISI_(IA_ACTORS|CAPACITY|SCARCE_RATIO)/)
  const k6 = k6Calls(result.calls)
  assert.equal(k6.length, 1)
  assert.equal(tag(k6[0], 'load_scenario'), 'fisi-franja')
  assert.equal(tag(k6[0], 'population'), '507')
  assert.match(k6[0], /\/load\/enrollment\.js$/)
  assert.match(k6[0], /-e SCENARIO_NAME=fisi-franja /)
  assert.match(checkCalls(result.calls)[0], / fisi-franja /)
  // Campaign preparation follows the same docker sequence as every other scenario.
  assert.ok(result.calls.includes('compose up --force-recreate -d --wait'))
  assert.equal(result.calls.filter(call => call.includes('close-simulator.js')).length, 1)
}))

test('fisi-franja honours SCENARIO_FISI_* and SCENARIO_ACTORS and rejects an invalid franja', async () => {
  const root = await tree()
  try {
    const result = await exec(root, 'load/scenarios.sh', ['fisi-franja'], {
      SCENARIO_FISI_FRANJA: '3', SCENARIO_ACTORS: '300', SCENARIO_FISI_CAPACITY: 'scarce', SCENARIO_FISI_SCARCE_RATIO: '0.25', SCENARIO_FISI_IA_ACTORS: '10',
    })
    assert.equal(result.code, 0, result.stderr)
    const config = await configOf(root)
    for (const line of ['SIMULATOR_ACTOR_COUNT=300', 'SIMULATOR_FISI_FRANJA=3', 'SIMULATOR_FISI_CAPACITY=scarce', 'SIMULATOR_FISI_SCARCE_RATIO=0.25', 'SIMULATOR_FISI_IA_ACTORS=10']) assert.ok(config.split('\n').includes(line), line)
    assert.equal(tag(k6Calls(result.calls)[0], 'population'), '300')
    const defaults = { 1: '24', 2: '113', 3: '293', 5: '313', 6: '117', 7: '31', 8: '13', 9: '11' }
    for (const [franja, total] of Object.entries(defaults)) {
      const other = await tree()
      try {
        const run = await exec(other, 'load/scenarios.sh', ['fisi-franja'], { SCENARIO_FISI_FRANJA: franja })
        assert.equal(tag(k6Calls(run.calls)[0], 'population'), total, `franja ${franja}`)
      } finally { await rm(other, { recursive: true, force: true }) }
    }
    for (const bad of ['0', '10', 'jornada', 'x']) {
      const invalid = await exec(await tree(), 'load/scenarios.sh', ['fisi-franja'], { SCENARIO_FISI_FRANJA: bad })
      assert.equal(invalid.code, 2, bad)
      assert.deepEqual(invalid.calls, [], bad)
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('all keeps its twelve scenarios in order, without fisi-franja, even with FISI variables set', withTree(async root => {
  const result = await exec(root, 'load/scenarios.sh', ['all'], { SCENARIO_FISI_FRANJA: '3', SIMULATOR_FISI_FRANJA: '3' })
  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(k6Calls(result.calls).map(call => tag(call, 'load_scenario')), ['login', 'race', 'last-seat', 'ample', 'mixed', 'multi-uniform', 'multi-hotspot', 'retry', 'resilience', 'stress', 'soak', 'reads'])
  assert.doesNotMatch(await configOf(root), /SIMULATOR_FISI_/)
}))

test('jornada defaults to 1422 actors on a fisi-schools jornada campaign and passes WAVE_* to k6', withTree(async root => {
  const result = await exec(root, 'load/scenarios.sh', ['jornada'], { WAVE_INTERVAL: '30', WAVE_FRONTLOAD: '0.5', START_DELAY_MS: '5000', SCENARIO_FISI_CAPACITY: 'scarce', SCENARIO_FISI_IA_ACTORS: '20' })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Scenario=jornada actors=1422 profile=fisi-schools /)
  const config = await configOf(root)
  assert.match(config, /^SIMULATOR_SCENARIO_PROFILE=fisi-schools$/m)
  assert.match(config, /^SIMULATOR_ACTOR_COUNT=1422$/m)
  assert.match(config, /^SIMULATOR_FISI_FRANJA=jornada$/m)
  assert.match(config, /^SIMULATOR_FISI_CAPACITY=scarce$/m)
  assert.match(config, /^SIMULATOR_FISI_IA_ACTORS=20$/m)
  const k6 = k6Calls(result.calls)
  assert.equal(k6.length, 1)
  assert.equal(tag(k6[0], 'load_scenario'), 'jornada')
  assert.equal(tag(k6[0], 'population'), '1422')
  assert.match(k6[0], /\/load\/jornada\.js$/)
  assert.match(k6[0], /-e WAVE_INTERVAL=30 -e WAVE_FRONTLOAD=0\.5 -e START_DELAY_MS=5000 /)
  assert.match(checkCalls(result.calls)[0], / jornada /)
}))

test('jornada uses a short WAVE_INTERVAL in quick mode unless set explicitly', async () => {
  for (const [env, expected] of [[{}, /-e WAVE_INTERVAL=10 /], [{ WAVE_INTERVAL: '20' }, /-e WAVE_INTERVAL=20 /]]) {
    const root = await tree()
    try {
      const result = await exec(root, 'load/scenarios.sh', ['jornada'], { SCENARIO_QUICK: '1', ...env })
      assert.equal(result.code, 0, result.stderr)
      assert.match(k6Calls(result.calls)[0], expected)
    } finally { await rm(root, { recursive: true, force: true }) }
  }
})

test('enrollment-open defaults to an ample campaign with 400 actors and passes RATE and DURATION', async () => {
  const root = await tree()
  try {
    const result = await exec(root, 'load/scenarios.sh', ['enrollment-open'], { RATE: '5', SCENARIO_DURATION: '40s' })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /Scenario=enrollment-open actors=400 profile=ample /)
    const config = await configOf(root)
    assert.match(config, /^SIMULATOR_SCENARIO_PROFILE=ample$/m)
    assert.match(config, /^SIMULATOR_ACTOR_COUNT=400$/m)
    assert.doesNotMatch(config, /SIMULATOR_FISI_/)
    const k6 = k6Calls(result.calls)
    assert.match(k6[0], /\/load\/enrollment-open\.js$/)
    assert.match(k6[0], /-e DURATION=40s /)
    assert.match(k6[0], /-e RATE=5 /)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('invalid WAVE_*, START_DELAY_MS and RATE values exit 2 before any docker call', async () => {
  const cases = [['jornada', { WAVE_FRONTLOAD: '1.5' }], ['jornada', { WAVE_FRONTLOAD: '-1' }], ['jornada', { WAVE_FRONTLOAD: 'x' }], ['jornada', { WAVE_INTERVAL: '0' }], ['jornada', { WAVE_INTERVAL: '3601' }], ['jornada', { WAVE_INTERVAL: '1;ls' }], ['jornada', { START_DELAY_MS: '-5' }],
    ['enrollment-open', { RATE: '0' }], ['enrollment-open', { RATE: '1001' }], ['enrollment-open', { RATE: 'abc' }], ['enrollment-open', { RATE: '10', SCENARIO_DURATION: '60s' }]]
  for (const [scenario, env] of cases) {
    const root = await tree()
    try {
      const result = await exec(root, 'load/scenarios.sh', [scenario], env)
      assert.equal(result.code, 2, JSON.stringify(env))
      assert.deepEqual(result.calls, [], JSON.stringify(env))
    } finally { await rm(root, { recursive: true, force: true }) }
  }
})

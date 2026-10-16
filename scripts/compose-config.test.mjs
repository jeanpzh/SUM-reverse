import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))

function config(file) {
  // Render configuration only: never start or read operator snapshots.
  const result = spawnSync('docker', ['compose', '--env-file', '/dev/null', '-f', file,
    'config', '--no-path-resolution', '--format', 'json'], {
    cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME }, encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test('exactly two independent Compose files isolate local simulation from operator deployment', () => {
  assert.deepEqual(readdirSync(root).filter((name) => /^(docker-)?compose.*\.ya?ml$/.test(name)).sort(),
    ['compose.local.yaml', 'compose.prod.yaml'])
  const local = config('compose.local.yaml')
  const prod = config('compose.prod.yaml')
  assert.equal(local.name, 'sum-local')
  assert.equal(prod.name, 'sum-prod')
  assert.equal(local.services.backend.environment.SUM_LOCAL_SCENARIOS, '1')
  assert.equal(local.services.frontend.build.args.SUM_DEVTOOLS, '1')
  assert.equal(local.services.backend.volumes, undefined)
  assert.equal(local.services.backend.environment.MATRICULA_SNAPSHOT_DIR, undefined)
  assert.equal(prod.services.backend.environment.SUM_LOCAL_SCENARIOS, '0')
  assert.equal(prod.services.frontend.build.args.SUM_DEVTOOLS, '0')
  assert.equal(prod.services.backend.environment.REPORTES_FIXTURE, undefined)
  assert.equal(prod.services.backend.environment.MATRICULA_SNAPSHOT_DIR, '/snapshots')
  assert.equal(prod.services.backend.volumes[0].read_only, true)
  assert.equal(prod.services.backend.volumes[0].bind.create_host_path, false)
  assert.equal(local.services.frontend.ports[0].published, '5180')
  assert.equal(prod.services.frontend.ports[0].published, '5181')
})

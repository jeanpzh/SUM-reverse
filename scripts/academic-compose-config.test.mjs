import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
function config(file) {
  const result = spawnSync('docker', ['compose', '--env-file', process.platform === 'win32' ? 'NUL' : '/dev/null',
    '-f', file, 'config', '--no-env-resolution', '--no-path-resolution', '--format', 'json'], {
    cwd: root, env: { ...process.env, SUM_PORT: '5180' }, encoding: 'utf8', windowsHide: true,
  })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test('local Compose enables the school module behind the same loopback frontend only', () => {
  const local = config('compose.local.yaml')
  assert.equal(local.services.backend.environment.SUM_ACADEMIC_SCHEDULING, '1')
  assert.equal(local.services.backend.environment.SUM_LOCAL_SCENARIOS, '1')
  assert.equal(local.services.frontend.build.args.SUM_DEVTOOLS, '1')
  assert.equal(local.services.backend.environment.SUM_ACADEMIC_PROXY_HOST, 'frontend')
  assert.equal(local.services.frontend.build.args.SUM_ACADEMIC_SCHEDULING, '1')
  assert.equal(local.services.frontend.ports[0].host_ip, '127.0.0.1')
  assert.equal(local.services.frontend.ports[0].published, '5180')
  assert.equal(local.services.backend.ports, undefined)
  assert.equal(local.services.backend.environment.SUM_ACADEMIC_DRAFT_DIR, '/app/backend/var/academic-drafts')
  assert.equal(local.services.backend.volumes.length, 1)
  assert.equal(local.services.backend.volumes[0].type, 'volume')
  assert.equal(local.services.backend.volumes[0].source, 'academic-drafts')
  assert.equal(local.services.backend.volumes[0].target, '/app/backend/var/academic-drafts')
  assert.equal(local.services.backend.volumes[0].read_only, undefined)
  assert.equal(local.services.backend.environment.MATRICULA_SNAPSHOT_DIR, undefined)
})

test('public simulator keeps the administrative feature disabled', () => {
  const publicConfig = config('compose.simulator.yaml')
  assert.equal(publicConfig.services.web.build.args.VITE_SUM_SIMULATOR, '1')
  assert.equal(publicConfig.services.web.build.args.VITE_SUM_ACADEMIC_SCHEDULING, undefined)
  for (const name of ['api-a', 'api-b']) {
    assert.equal(publicConfig.services[name].environment.SUM_ACADEMIC_SCHEDULING, undefined)
    assert.equal(publicConfig.services[name].environment.SUM_ACADEMIC_PROXY_HOST, undefined)
    assert.equal(publicConfig.services[name].environment.SUM_ACADEMIC_DRAFT_DIR, undefined)
  }
  const dockerfile = readFileSync(new URL('../client/Dockerfile', import.meta.url), 'utf8')
  assert.match(dockerfile, /ARG SUM_ACADEMIC_SCHEDULING=0/)
  const appModule = readFileSync(new URL('../backend/src/app.module.ts', import.meta.url), 'utf8')
  assert.match(appModule, /imports: publicDeployment \? \[PublicSimulatorPersistenceModule\]/)
  assert.match(appModule, /SUM_ACADEMIC_SCHEDULING === '1' && process\.env\.SUM_LOCAL_SCENARIOS === '1' \? \[PrematriculaModule\]/)
})

import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))

function config(...files) {
  // Render configuration only: never start or read operator snapshots.
  const result = spawnSync('docker', ['compose', '--env-file', '/dev/null', '--profile', '*',
    ...files.flatMap((file) => ['-f', file]), 'config', '--no-path-resolution', '--format', 'json'], {
    cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME }, encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test('Compose entrypoints isolate scenario, simulator, and operator deployment', () => {
  assert.deepEqual(readdirSync(root).filter((name) => /^(docker-)?compose.*\.ya?ml$/.test(name)).sort(),
    ['compose.local.yaml', 'compose.observability.yaml', 'compose.perf.yaml', 'compose.prod.yaml', 'compose.simulator.yaml', 'compose.yaml'])
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
  assert.equal(prod.services.backend.volumes[0].bind?.create_host_path ?? false, false)
  assert.equal(local.services.frontend.ports[0].published, '5180')
  assert.equal(prod.services.frontend.ports[0].published, '5181')
})


test('default Compose starts the complete synthetic stack without environment bootstrap', () => {
  const simulator = config('compose.yaml')
  assert.equal(simulator.name, 'sum-simulator')
  for (const name of ['simulator-init', 'postgres', 'migrate', 'seed', 'api-a', 'api-b', 'web', 'prometheus', 'grafana', 'k6']) {
    assert.ok(simulator.services[name], `missing ${name}`)
  }
  assert.equal(simulator.services.web.ports[0].published, '5189')
  assert.equal(simulator.services.grafana.ports[0].published, '5190')
  assert.equal(simulator.services.web.environment.SIMULATOR_HTTP_PORT, '5189')
  assert.equal(simulator.services.k6.environment.SIMULATOR_HTTP_PORT, '5189')
  assert.equal(simulator.services.postgres.ports, undefined)
  assert.deepEqual(simulator.services.postgres.command, ['postgres'])
  assert.equal(simulator.services.prometheus.ports[0].host_ip, '127.0.0.1')
  assert.equal(simulator.services.prometheus.ports[0].published, '9090')
  assert.equal(simulator.services.postgres.depends_on['simulator-init'].condition, 'service_completed_successfully')
  assert.equal(simulator.services['api-a'].depends_on.seed.condition, 'service_completed_successfully')
  for (const service of Object.values(simulator.services)) {
    assert.equal(service.environment?.MATRICULA_SNAPSHOT_DIR, undefined)
    assert.equal(service.environment?.SIMULATOR_DB_PASSWORD, undefined)
    assert.equal(service.environment?.GRAFANA_ADMIN_PASSWORD, undefined)
    for (const mount of service.volumes ?? []) {
      assert.doesNotMatch(mount.source, /datos-reales|snapshots/)
    }
  }
  assert.ok(simulator.services.k6.profiles.includes('load'))
  const exporter = simulator.services['metrics-exporter']
  assert.ok(exporter)
  assert.equal(exporter.ports, undefined)
  assert.equal(exporter.user, '1000:1000')
  assert.equal(exporter.volumes.every(mount => mount.read_only), true)
  assert.equal(exporter.depends_on['api-a'].condition, 'service_healthy')
  assert.equal(exporter.depends_on['api-b'].condition, 'service_healthy')
})

test('performance override pins CPUs and enables diagnostics only when applied', () => {
  const base = config('compose.simulator.yaml')
  const perf = config('compose.simulator.yaml', 'compose.perf.yaml')
  for (const service of Object.values(base.services)) assert.equal(service.cpuset, undefined)
  assert.deepEqual(base.services.postgres.command, ['postgres'])
  assert.equal(perf.services.k6.cpuset, '0')
  for (const name of ['postgres', 'api-a', 'api-b', 'web']) assert.equal(perf.services[name].cpuset, '1')
  for (const name of ['api-a', 'api-b']) assert.equal(perf.services[name].environment.SIMULATOR_DB_POOL_MAX, '12')
  const command = perf.services.postgres.command.join(' ')
  for (const flag of ['shared_preload_libraries=pg_stat_statements', 'track_io_timing=on', 'track_wal_io_timing=on']) {
    assert.ok(command.includes(`-c ${flag}`), `missing ${flag}`)
  }
  for (const service of Object.values(perf.services)) {
    assert.equal(service.environment?.MATRICULA_SNAPSHOT_DIR, undefined)
    for (const mount of service.volumes ?? []) assert.doesNotMatch(mount.source, /datos-reales|snapshots/)
  }
})

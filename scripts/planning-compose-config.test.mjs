import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

test('planning distribution isolates credentials, engine and persistent synthetic data', () => {
  const result = spawnSync('docker', ['compose', '--env-file', '/dev/null', '-f', 'compose.planning.yaml', 'config', '--format', 'json'], {
    encoding: 'utf8', env: { PATH: process.env.PATH, AWS_BEARER_TOKEN_BEDROCK: 'synthetic-config-only', SUM_PORT: '5180' },
  })
  assert.equal(result.status, 0, result.stderr)
  const { services, secrets, volumes } = JSON.parse(result.stdout)
  assert.equal(services.engine.network_mode, 'service:backend')
  assert.equal(services.engine.environment.AWS_BEARER_TOKEN_BEDROCK_FILE, '/run/secrets/bedrock_api_key')
  assert.equal(services.engine.environment.SUM_RAG_SOURCE, 'local')
  assert.equal(secrets.bedrock_api_key.environment, 'AWS_BEARER_TOKEN_BEDROCK')
  assert.equal(services.engine.ports, undefined)
  assert.equal(services.backend.ports, undefined)
  assert.equal(services.frontend.ports[0].host_ip, '127.0.0.1')
  assert.equal(services.frontend.ports[0].published, '5180')
  assert.equal(services.frontend.depends_on.engine.condition, 'service_healthy')
  assert.equal(services.backend.environment.SUM_PLANNING_ENGINE_URL, 'http://127.0.0.1:3220')
  assert.ok(volumes['academic-drafts'])
  for (const [name, service] of Object.entries(services)) {
    assert.equal(service.environment?.AWS_BEARER_TOKEN_BEDROCK, undefined, name)
    assert.equal(service.environment?.MATRICULA_SNAPSHOT_DIR, undefined, name)
    assert.ok(!(service.volumes ?? []).some(volume => volume.type === 'bind'), name)
  }
  assert.equal(services.backend.secrets, undefined)
  assert.equal(services.frontend.secrets, undefined)
})

import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const script = join(root, 'load/pg-diagnostics.sh')

// A stub "docker" answers the few statements the script sends; it never reaches a real database.
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'pg-diag-'))
  const stub = join(dir, 'docker-stub.sh')
  writeFileSync(stub, `#!/bin/sh
case "$*" in
  *"SHOW shared_preload"*) echo "$STUB_LIBS" ;;
  *"SELECT run_id"*) echo "" ;;
  *COPY*) echo "$STUB_TOP" ;;
  *) cat >/dev/null; echo "stub output" ;;
esac
`)
  chmodSync(stub, 0o755)
  const manifest = join(dir, 'manifest.json')
  writeFileSync(manifest, JSON.stringify({ campaignId: '11111111-2222-4333-8444-555555555555', actors: [{ actorId: 'SYN-SIS-U0001', credential: 'unused' }] }))
  return { dir, stub, manifest }
}

function run(args, env = {}) {
  return spawnSync('bash', [script, ...args], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env } })
}

test('help exits 0 and usage errors exit 2', () => {
  assert.equal(run(['--help']).status, 0)
  assert.equal(run([]).status, 2)
  assert.equal(run(['bogus']).status, 2)
  assert.equal(run(['dump']).status, 2)
  assert.equal(run(['dump', '--testid', 'a/b']).status, 2)
  assert.equal(run(['dump', '--testid', 'x', '--top', '0']).status, 2)
})

test('fails clearly when pg_stat_statements is not preloaded', () => {
  const { dir, stub, manifest } = setup()
  const result = run(['dump', '--testid', 't1', '--container', 'stub'], { PG_DIAG_DOCKER: stub, RESULTS: dir, SIMULATOR_MANIFEST: manifest, STUB_LIBS: '' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /compose\.perf\.yaml/)
})

test('a credential-like string in an artifact fails the dump and deletes the artifact', () => {
  const { dir, stub, manifest } = setup()
  const leak = 'A'.repeat(43)
  const result = run(['dump', '--testid', 't2', '--container', 'stub'], { PG_DIAG_DOCKER: stub, RESULTS: dir, SIMULATOR_MANIFEST: manifest, STUB_LIBS: 'pg_stat_statements', STUB_TOP: `1,2,3,4,5,6,7,8,${leak}` })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Sanitization failed/)
  assert.equal(existsSync(join(dir, 'pg-top-t2.csv')), false)
  assert.deepEqual(readdirSync(dir).filter((name) => name.startsWith('pg-')), [])
})

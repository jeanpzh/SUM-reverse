import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('retired scenario flags explain the unified entry before starting any containers', () => {
  const launcher = fileURLToPath(new URL('./start-local-profile-dashboard.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [launcher, '--scenario=regular'], {
    env: { PATH: '' }, encoding: 'utf8',
  })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /docker compose -f compose\.local\.yaml up --build/)
  assert.match(result.stderr, /MODE = SIM/)
})

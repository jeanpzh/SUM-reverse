import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'

const source = (await readFile(new URL('../load/common.js', import.meta.url), 'utf8'))
  .replace(/^import .*\n/gm, '').replace(/^export /gm, '')

function harness(status = 200) {
  const now = 1_800_000_000_000
  const calls = []
  const metrics = new Map()
  class Clock extends Date { static now() { return now } }
  class Counter { constructor(name) { this.name = name } add(value) { metrics.set(this.name, (metrics.get(this.name) ?? 0) + value) } }
  const config = { base: 'http://web', origin: 'http://127.0.0.1:5189', manifest: { campaignId: 'campaign', runId: 'run', actorCount: 400, scenarioProfile: 'shared' } }
  const actor = { actorId: 'SYN-MAINTENANCE', credential: 'independently-synthetic-test-value' }
  const context = vm.createContext({ Date: Clock, Counter, Gauge: Counter, __ENV: {}, check: (value, checks) => Object.values(checks).every(check => check(value)),
    http: { post: (url, body) => {
      calls.push({ operation: url.endsWith('/login') ? 'auth' : 'academic' })
      const data = url.endsWith('/login')
        ? { actorId: actor.actorId, campaignId: 'campaign', runId: 'run', expiresAt: new Date(now + 900000).toISOString() }
        : { actorId: actor.actorId, runId: 'run', sessionId: 'session', expiresAt: new Date(now + 900000).toISOString() }
      return { status, json: () => ({ data }) }
    } }
  })
  vm.runInContext(`${source}\nglobalThis.maintain = maintainSession; globalThis.parseJson = safeJson`, context)
  return { maintain: context.maintain, config, actor, now, calls, metrics }
}

test('long scenarios renew access and academic sessions before actual expiry', () => {
  const h = harness()
  const identity = { sessionId: 'session', accessExpiresAt: h.now + 89000, sessionExpiresAt: h.now + 89000 }
  assert.equal(h.maintain(h.config, h.actor, identity, 'sessions'), true)
  assert.deepEqual(h.calls, [{ operation: 'auth' }, { operation: 'academic' }])
  assert.equal(identity.accessExpiresAt, h.now + 900000)
  assert.equal(identity.sessionExpiresAt, h.now + 900000)
  assert.equal(h.metrics.get('session_access_refreshes'), 1)
  assert.equal(h.metrics.get('session_academic_renewals'), 1)
  h.maintain(h.config, h.actor, identity, 'sessions')
  assert.equal(h.calls.length, 2, 'No repeated authentication while the renewed session is still valid')
})

test('valid sessions avoid refresh traffic and authentication errors fail maintenance', () => {
  const h = harness()
  assert.equal(h.maintain(h.config, h.actor, { sessionId: 'session', accessExpiresAt: h.now + 900000, sessionExpiresAt: h.now + 900000 }), true)
  assert.equal(h.calls.length, 0)
  const failed = harness(401)
  assert.equal(failed.maintain(failed.config, failed.actor, { sessionId: 'session', accessExpiresAt: failed.now + 1, sessionExpiresAt: failed.now + 1 }), false)
  assert.equal(failed.calls.length, 1)
  assert.equal(failed.metrics.size, 0)
})

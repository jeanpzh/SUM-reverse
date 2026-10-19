// Root integration acceptance: kill an owned API during an uncommitted synthetic enrollment.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { openSync, closeSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import pg from '../backend/node_modules/pg/lib/index.js'

assert.equal(process.env.SIMULATOR_CRASH_TEST, 'independently-synthetic', 'Explicit synthetic crash-test acknowledgement required')
const suiteLock = openSync('infra/simulator/runtime/scenarios.lock', 'a', 0o600)
const lockResult = spawnSync('flock', ['-n', '3'], { stdio: ['ignore', 'pipe', 'pipe', suiteLock] })
assert.equal(lockResult.status, 0, 'Another scenario suite owns the campaign; do not inject faults concurrently')
const compose = ['compose']
const docker = (args) => execFileSync('sudo', ['-n', 'docker', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
function serviceIp(service) {
  const id = docker([...compose, 'ps', '-q', service])
  assert.match(id, /^[0-9a-f]+$/)
  const ip = docker(['inspect', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', id])
  assert.match(ip, /^172\.\d+\.\d+\.\d+$/)
  return ip
}
const values = Object.fromEntries((await readFile('infra/simulator/runtime/config.env', 'utf8')).split('\n').filter((line) => line.includes('=')).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]))
const manifest = JSON.parse(await readFile('infra/simulator/runtime/manifest.json', 'utf8'))
assert.equal(manifest.contention, 'shared')
const actor = manifest.actors[0]
const apiA = serviceIp('api-a')
const apiB = serviceIp('api-b')
const pool = new pg.Pool({ host: serviceIp('postgres'), port: 5432, user: 'simulator', password: values.SIMULATOR_DB_PASSWORD, database: 'sum_simulator_synthetic', connectionTimeoutMillis: 3000, max: 3, application_name: 'sum-simulator-crash-acceptance' })
const authority = `127.0.0.1:${process.env.SIMULATOR_HTTP_PORT ?? '5189'}`
const origin = `http://${authority}`
const headers = { Origin: origin, Host: authority, 'Content-Type': 'application/json' }
const requestId = randomUUID()
let locker
let blockerOpen = false
let interrupted = null
let apiKilled = false
async function call(ip, path, cookie, body) {
  return fetch(`http://${ip}:3000${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) })
}
async function ready(ip) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await call(ip, '/simulator/health')).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Owned API did not become ready')
}
try {
  const health = await call(apiA, '/simulator/health')
  assert.equal((await health.json()).dataSource, 'independently-synthetic')
  const login = await call(apiA, '/simulator/auth/v1/login', null, { credential: actor.credential })
  assert.equal(login.status, 200)
  const cookie = login.headers.getSetCookie()[0].split(';')[0]
  const session = await call(apiA, '/local/matricula-regular/v1/sesiones', cookie, { runId: manifest.runId, actorId: actor.actorId })
  assert.equal(session.status, 200)
  const sessionId = (await session.json()).data.sessionId
  const context = await call(apiA, `/local/matricula-regular/v1/contextos/${actor.actorId}`, cookie)
  const profileRevision = (await context.json()).data.profileRevision
  const submission = { runId: manifest.runId, actorId: actor.actorId, requestId, sessionId, profileRevision, selection: manifest.selection }
  const before = await pool.query('SELECT coalesce(sum(occupied),0)::integer occupied FROM simulator_sections WHERE campaign_id=$1', [manifest.campaignId])
  locker = await pool.connect()
  await locker.query('BEGIN')
  await locker.query('LOCK TABLE simulator_enrollment_items IN EXCLUSIVE MODE')
  blockerOpen = true
  interrupted = call(apiA, '/local/matricula-regular/v1/solicitudes', cookie, submission).then((response) => ({ status: response.status })).catch(() => ({ disconnected: true }))
  let observedMidWrite = false
  for (let attempt = 0; attempt < 80; attempt++) {
    const waiting = await pool.query("SELECT count(*)::integer count FROM pg_stat_activity WHERE application_name='sum-simulator' AND client_addr=$1::inet AND wait_event_type='Lock' AND query ILIKE 'INSERT INTO simulator_enrollment_items%'", [apiA])
    if (waiting.rows[0].count > 0) { observedMidWrite = true; break }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.equal(observedMidWrite, true, 'Must observe a blocked detail INSERT after request/enrollment writes')
  docker([...compose, 'kill', '-s', 'SIGKILL', 'api-a'])
  apiKilled = true
  await interrupted
  await locker.query('ROLLBACK')
  blockerOpen = false
  const after = await pool.query(`SELECT
    (SELECT count(*)::integer FROM simulator_requests WHERE campaign_id=$1 AND actor_id=$2 AND request_id=$3) requests,
    (SELECT count(*)::integer FROM simulator_enrollments WHERE campaign_id=$1 AND actor_id=$2) enrollments,
    (SELECT coalesce(sum(occupied),0)::integer FROM simulator_sections WHERE campaign_id=$1) occupied`, [manifest.campaignId, actor.actorId, requestId])
  assert.equal(after.rows[0].requests, 0)
  assert.equal(after.rows[0].enrollments, 0)
  assert.equal(after.rows[0].occupied, before.rows[0].occupied)
  docker([...compose, 'start', 'api-a'])
  docker([...compose, 'restart', 'api-b'])
  await Promise.all([ready(apiA), ready(apiB)])
  apiKilled = false
  const recovered = await call(apiB, `/local/matricula-regular/v1/solicitudes/${requestId}?runId=${manifest.runId}&actorId=${actor.actorId}`, cookie)
  assert.equal((await recovered.json()).data.state, 'unknown')
  const retry = await call(apiB, '/local/matricula-regular/v1/solicitudes', cookie, submission)
  assert.equal(retry.status, 200)
  // Discard the response body: recovery must obtain the confirmed result from storage.
  await retry.body.cancel()
  docker([...compose, 'restart', 'api-a', 'api-b'])
  await Promise.all([ready(apiA), ready(apiB)])
  const confirmed = await call(apiA, `/local/matricula-regular/v1/solicitudes/${requestId}?runId=${manifest.runId}&actorId=${actor.actorId}`, cookie)
  assert.equal(confirmed.status, 200)
  const outcome = (await confirmed.json()).data.outcome
  assert.equal(outcome.state, 'accepted')
  const replay = await call(apiA, '/local/matricula-regular/v1/solicitudes', cookie, submission)
  assert.deepEqual((await replay.json()).data, outcome)
  const duplicates = await Promise.all(Array.from({ length: 20 }, async (_, index) => {
    const response = await call(index % 2 ? apiA : apiB, '/local/matricula-regular/v1/solicitudes', cookie, { ...submission, requestId: randomUUID() })
    assert.equal(response.status, 200)
    const duplicate = (await response.json()).data
    assert.equal(duplicate.state, 'rejected')
    assert.ok(duplicate.causes.some((cause) => cause.code === 'ALREADY_ENROLLED'))
    return true
  }))
  assert.equal(duplicates.length, 20)
  const final = await pool.query('SELECT count(*)::integer count FROM simulator_enrollments WHERE campaign_id=$1 AND actor_id=$2', [manifest.campaignId, actor.actorId])
  assert.equal(final.rows[0].count, 1)
  const output = resolve(process.env.SIMULATOR_CRASH_RESULT ?? 'evidence/local/simulador-produccion/crash-result.json')
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify({ passed: true, observedUncommittedDetailInsert: true, forcedApiProcessCrash: true, rolledBackRequests: true, countersUnchanged: true, bothApisRestarted: true, discardedResponseRecoveredFromDatabase: true, sameRequestRecoveredExactlyOnce: true, distinctConcurrentDuplicateRequestsRejected: 20 }, null, 2))
  console.log('PASS: API killed mid-transaction, PostgreSQL rollback, both APIs restart, same request accepted exactly once')
} finally {
  if (blockerOpen && locker) await locker.query('ROLLBACK').catch(() => undefined)
  if (locker) locker.release()
  if (apiKilled) docker([...compose, 'start', 'api-a'])
  await pool.end()
  closeSync(suiteLock)
}

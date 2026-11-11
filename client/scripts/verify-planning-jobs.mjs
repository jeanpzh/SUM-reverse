// Independently constructed synthetic resources. Own services only; environment allowlist.
import { createPlanningSession, defaultPlanningSessionClient } from '../src/data/planningSession.ts'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createServer as httpServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { startAcademicSearch, pollAcademicSearch, cancelAcademicSearch, fetchAcademicCatalog } from '../src/data/academicScheduling.ts'
const root = fileURLToPath(new URL('../../', import.meta.url))
const runtime = await mkdtemp(join(tmpdir(), 't4b-synthetic-'))
const children = []
const basic = { PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: runtime }
const port = () => new Promise(resolve => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)) }) })
const enginePort = await port(), apiPort = await port()
const wireFetch = globalThis.fetch
let loseEngineResponse = false
const engineProxy = httpServer(async (req, res) => {
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const response = await wireFetch(`http://127.0.0.1:${enginePort}${req.url}`, { method: req.method,
      headers: { 'Content-Type': 'application/json', ...(req.headers['x-job-id'] ? { 'X-Job-Id': req.headers['x-job-id'] } : {}) },
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) })
    const body = await response.text()
    if (loseEngineResponse && req.method === 'POST' && req.url === '/v1/solve-jobs') { loseEngineResponse = false; res.destroy(); return }
    res.writeHead(response.status, { 'Content-Type': 'application/json' }); res.end(body)
  } catch { res.destroy() }
})
await new Promise(resolve => engineProxy.listen(0, '127.0.0.1', resolve))
const proxyPort = engineProxy.address().port
function start(command, args, cwd, env) { const child = spawn(command, args, { cwd, env, stdio: 'ignore' }); children.push(child) }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function ready(url) {
  for (let i = 0; i < 150; i++) { try { if ((await fetch(url)).ok) return } catch { /* own startup */ } await delay(100) }
  throw new Error('Own stack startup timeout')
}
const base = `http://127.0.0.1:${apiPort}`
const transport = (url, options) => fetch(`${base}${String(url).replace(/^\/api/, '')}`, options)
async function terminal(job) { for (let i = 0; i < 300; i++) { if (job.state !== 'running') return job; await delay(50); job = await pollAcademicSearch(job.jobId, transport) } throw new Error('Terminal timeout') }
try {
  start(join(root, 'planning-engine/.venv/bin/python'), ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(enginePort)], join(root, 'planning-engine'), basic)
  await ready(`http://127.0.0.1:${enginePort}/health`)
  start(process.execPath, ['dist/programacion-academica/local-main.js'], join(root, 'backend'), { ...basic,
    SUM_ACADEMIC_SCHEDULING: '1', SIMULATOR_DEPLOYMENT: 'local', SUM_LOCAL_SCENARIOS: '0', SUM_ACADEMIC_DRAFT_DIR: runtime,
    SUM_PLANNING_ENGINE_URL: `http://127.0.0.1:${proxyPort}`, PORT: String(apiPort) })
  await ready(`${base}/local/programacion-academica/v1/catalogo`)
  const catalog = await fetchAcademicCatalog(transport)
  const course = catalog.courses.find(c => c.weeklySessions.reduce((n, s) => n + s.durationMinutes, 0) === 240)
  const availability = [1, 2, 3, 4, 5].map(day => ({ day, startMinute: 480, endMinute: 1320 }))
  const request = { revision: catalog.revision, academicPeriod: '2027-I', lectiveHourMinutes: 60,
    demands: [{ courseId: course.courseId, estimatedDemand: 40, targetCapacity: 1 }], resources: {
      teachers: Array.from({ length: 20 }, (_, i) => ({ id: `SYN-T${i}`, name: `Synthetic teacher ${i}`, courseIds: [course.courseId], maxWeeklyMinutes: 2400, availability, appointment: 'contract' })),
      rooms: Array.from({ length: 20 }, (_, i) => ({ id: `SYN-R${i}`, name: `Synthetic room ${i}`, capacity: 45, availability })),
    } }
  const time = Date.now()
  const first = await startAcademicSearch(request, 30, transport)
  assert.equal(first.state, 'running'); assert.ok(Date.now() - time < 5000)
  let live = first
  for (let i = 0; i < 300 && !live.proposal && live.state === 'running'; i++) { await delay(50); live = await pollAcademicSearch(first.jobId, transport) }
  assert.equal(live.state, 'running', 'witness before terminal')
  assert.ok(live.proposal)
  assert.equal(live.proposal.assignments.length, live.progress.scheduledSessions)
  const proposalId = live.proposal.proposalId
  assert.equal((await pollAcademicSearch(first.jobId, transport)).proposal.proposalId, proposalId)
  const workspace = { schoolId: 'SISTEMAS', academicPeriod: '2027-I', lectiveHourMinutes: 60, demandSourceId: 'independent-120-v1', demandBaseRequest: null, request }
  const save = { id: null, expectedVersion: null, title: 'Synthetic job draft', state: 'draft', configuration: workspace, proposalId, proposalEditVersion: 0 }
  const saving = await transport('/api/local/programacion-academica/v1/borradores/guardar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(save) })
  assert.equal(saving.status, 409, await saving.text())
  const cancelled = await cancelAcademicSearch(first.jobId, transport)
  assert.equal(cancelled.state, 'cancelled'); assert.equal(cancelled.proposal.proposalId, proposalId)
  assert.deepEqual(await cancelAcademicSearch(first.jobId, transport), cancelled)
  const small = { ...request, demands: [{ courseId: course.courseId, estimatedDemand: 1, targetCapacity: 1 }] }
  const done = await terminal(await startAcademicSearch(small, 2, transport))
  assert.equal(done.state, 'completed'); assert.equal(done.proposal.status, 'complete'); assert.equal(done.proposal.coverageProof, 'complete')
  const missing = await terminal(await startAcademicSearch({ ...small, resources: { ...small.resources, rooms: [] } }, 1, transport))
  assert.equal(missing.state, 'completed'); assert.equal(missing.proposal.coverageComplete, false)
  const pending = await startAcademicSearch(request, 30, transport)
  const replacement = await startAcademicSearch(small, 1, transport)
  assert.equal((await pollAcademicSearch(pending.jobId, transport)).state, 'cancelled')
  await cancelAcademicSearch(replacement.jobId, transport)
  await assert.rejects(() => pollAcademicSearch('unknown', transport))
  await assert.rejects(() => startAcademicSearch(small, 121, transport))
  const endpoint = '/api/local/programacion-academica/v1/busquedas'
  const crossSite = await transport(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' }, body: JSON.stringify({ request: small, budgetSeconds: 1 }) })
  assert.equal(crossSite.status, 403)
  assert.equal((await transport(`${endpoint}/${first.jobId}?unexpected=1`)).status, 400)
  const badCancel = await transport(`${endpoint}/${first.jobId}/cancelar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' })
  assert.equal(badCancel.status, 400)
  // Exercise the actual default application path; synchronous proposal endpoint must never run.
  const originalFetch = globalThis.fetch
  const urls = []
  globalThis.fetch = (url, options) => { urls.push(String(url)); return originalFetch(`${base}${String(url).replace(/^\/api/, '')}`, options) }
  const session = createPlanningSession(defaultPlanningSessionClient)
  try {
    await session.commands.loadCatalog()
    session.commands.edit({ type: 'selectCourses', courseIds: [course.courseId] })
    session.commands.edit({ type: 'updateResources', value: request.resources })
    session.commands.edit({ type: 'updateDemand', courseId: course.courseId, value: '40' })
    session.commands.edit({ type: 'updateCapacity', courseId: course.courseId, value: '1' })
    const running = session.commands.generate()
    for (let i = 0; i < 300 && !session.getState().proposal && !session.getState().errors.proposal; i++) await delay(50)
    assert.ok(session.getState().proposal, session.getState().errors.proposal)
    assert.equal(session.getState().busy.generate, true)
    await session.commands.cancelSearch()
    await running
    assert.equal(session.getState().search.state, 'cancelled')
    assert.ok(urls.some(url => url.endsWith('/busquedas')))
    assert.ok(!urls.some(url => url.endsWith('/propuestas')))
    assert.ok(!urls.some(url => url.includes('/guardar')))
  } finally { session.dispose(); globalThis.fetch = originalFetch }
  // Both POST response-loss seams use real accepted HTTP requests on this own stack.
  for (const seam of ['client', 'engine']) {
    let lost = false
    if (seam === 'engine') loseEngineResponse = true
    globalThis.fetch = async (url, options) => {
      const response = await originalFetch(`${base}${String(url).replace(/^\/api/, '')}`, options)
      if (seam === 'client' && !lost && options?.method === 'POST' && String(url).endsWith('/busquedas')) { lost = true; throw new Error('Synthetic lost accepted response') }
      return response
    }
    const faulted = createPlanningSession(defaultPlanningSessionClient)
    try {
      await faulted.commands.loadCatalog()
      faulted.commands.edit({ type: 'selectCourses', courseIds: [course.courseId] })
      faulted.commands.edit({ type: 'updateResources', value: request.resources })
      await faulted.commands.generate()
      assert.equal(faulted.getState().busy.generate, false, seam)
      assert.ok(['cancelled', 'failed'].includes(faulted.getState().search?.state), seam)
    } finally { faulted.dispose(); globalThis.fetch = originalFetch }
  }
  const correlated = randomUUID()
  const accepted = await startAcademicSearch(small, 2, transport, correlated)
  assert.equal(accepted.jobId, correlated)
  assert.equal((await startAcademicSearch(small, 2, transport, correlated)).jobId, correlated)
  await assert.rejects(() => startAcademicSearch(small, 3, transport, correlated))
  await cancelAcademicSearch(correlated, transport)
  const fenced = randomUUID()
  assert.equal((await cancelAcademicSearch(fenced, transport)).state, 'cancelled')
  await assert.rejects(() => startAcademicSearch(small, 2, transport, fenced))
  console.log('PASS both accepted POST response-loss seams, default session reconciliation, duplicate/conflict and delayed-start fence')
  console.log('PASS default application session uses jobs, no synchronous fallback or autosave')
  console.log('PASS adapter → NestJS → Python: nonblocking/live witness, identity/progress, save gate, cancellation/idempotence, complete/shortfall, replacement/unknown/budget')
} finally {
  await new Promise(resolve => engineProxy.close(resolve))
  for (const child of children.reverse()) if (child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM')
    await Promise.race([exited, delay(5000)])
    if (child.exitCode === null) { child.kill('SIGKILL'); await exited }
  }
  await rm(runtime, { recursive: true, force: true })
  console.log('Own services stopped; synthetic temp state removed')
}

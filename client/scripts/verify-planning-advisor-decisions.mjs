// Independently constructed synthetic resources. Own services only; environment allowlist.
import { createPlanningSession, defaultPlanningSessionClient } from '../src/data/planningSession.ts'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createServer as httpServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { fetchAcademicProposalAdvice } from '../src/data/academicScheduling.ts'
const root = fileURLToPath(new URL('../../', import.meta.url))
const runtime = await mkdtemp(join(tmpdir(), 't6b-synthetic-'))
const children = []
const basic = { PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: runtime }
const port = () => new Promise(resolve => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)) }) })
const enginePort = await port(), apiPort = await port()
const wireFetch = globalThis.fetch
const enginePaths = []
const engineProxy = httpServer(async (req, res) => {
  try {
    enginePaths.push(req.url)
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const response = await wireFetch(`http://127.0.0.1:${enginePort}${req.url}`, { method: req.method,
      headers: { 'Content-Type': 'application/json', ...(req.headers['x-job-id'] ? { 'X-Job-Id': req.headers['x-job-id'] } : {}) },
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) })
    const body = await response.text()
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

try {
  start(join(root, 'planning-engine/.venv/bin/python'), ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(enginePort)], join(root, 'planning-engine'), basic)
  await ready(`http://127.0.0.1:${enginePort}/health`)
  start(process.execPath, ['dist/programacion-academica/local-main.js'], join(root, 'backend'), { ...basic,
    SUM_ACADEMIC_SCHEDULING: '1', SIMULATOR_DEPLOYMENT: 'local', SUM_LOCAL_SCENARIOS: '0', SUM_ACADEMIC_DRAFT_DIR: runtime,
    SUM_PLANNING_ENGINE_URL: `http://127.0.0.1:${proxyPort}`, PORT: String(apiPort) })
  await ready(`${base}/local/programacion-academica/v1/catalogo`)
  const originalFetch = globalThis.fetch
  const urls = []
  globalThis.fetch = (url, options) => { urls.push(String(url)); return originalFetch(`${base}${String(url).replace(/^\/api/, '')}`, options) }
  const session = createPlanningSession(defaultPlanningSessionClient)
  try {
    await session.commands.loadCatalog()
    const catalog = session.getState().catalog
    const reference = catalog.referenceTeachers.find(t => t.courseIds.length)
    const courseId = reference.courseIds[0]
    session.commands.edit({ type: 'selectCourses', courseIds: [courseId] })
    session.commands.edit({ type: 'updateResources', value: { teachers: [], rooms: [] } })
    session.commands.edit({ type: 'updateDemand', courseId, value: '1' })
    assert.equal(await session.commands.generate(), true)
    const before = session.getState().proposal
    const advice = await fetchAcademicProposalAdvice(before.proposalId, before.editVersion ?? 0)
    assert.equal(advice.source.mode, 'engine-decisions')
    assert.equal(advice.verifiedImpact, undefined)
    const rec = advice.recommendations.find(r => r.patch.kind === 'incorporate_reference_resource')
    assert.ok(rec, advice.summary)
    assert.ok(rec.decisionIds.every(id => before.decisions.some(d => d.id === id)))
    assert.equal(session.getState().proposal.proposalId, before.proposalId)
    await assert.rejects(() => fetchAcademicProposalAdvice(before.proposalId, 99))
    assert.equal(await session.commands.applyAdvisorPatchesAndRegenerate([rec.patch], { proposalId: before.proposalId, editVersion: before.editVersion ?? 0 }), true)
    const after = session.getState()
    assert.notEqual(after.proposal.proposalId, before.proposalId)
    assert.equal(after.advisorOutcome.proposalId, after.proposal.proposalId)
    for (const id of rec.patch.teacherIds) {
      const teacher = after.resources.teachers.find(t => t.id === id)
      assert.equal(teacher.maxWeeklyMinutes, 0)
      assert.deepEqual(teacher.availability, [])
      assert.equal(teacher.category, undefined)
    }
    assert.equal(after.proposal.coverageComplete, false)
    assert.ok(!urls.some(url => url.includes('/guardar') || url.endsWith('/propuestas')))
    assert.ok(!enginePaths.some(path => path.includes('advisor') || path.includes('normativa')))
    session.commands.edit({ type: 'updateDemand', courseId, value: '2' })
    await assert.rejects(() => session.commands.applyAdvisorPatchesAndRegenerate([rec.patch], { proposalId: before.proposalId, editVersion: 0 }))
    console.log('PASS default session → adapter → NestJS → Python: explicit apply, T4b regeneration/outcome, incomplete references, CAS/stale configuration, no autosave/advisor/normative simulation')
    console.log(`Own ports engine=${enginePort}, proxy=${proxyPort}, api=${apiPort}`)
  } finally { session.dispose(); globalThis.fetch = originalFetch }
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

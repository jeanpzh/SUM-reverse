// Focused React DOM → own NestJS → own Python acceptance. Independent synthetic data only.
// No inherited service URLs, snapshot directories, credentials or operator processes.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { createServer as httpServer } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { nav, closeChat, resume, response, json, save } from './planning-audit/helpers.mjs'
const root = fileURLToPath(new URL('../../', import.meta.url))
const evidence = join(root, 'evidence/local/planning-integrated-2026-11-11')
const runtime = await mkdtemp(join(tmpdir(), 'planning-integrated-independent-'))
const basic = { PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: runtime }
const engineEnv = { ...basic, SUM_LLM_PROVIDER: 'disabled', SUM_RAG_GENERATION_MODE: 'extractive', AWS_EC2_METADATA_DISABLED: 'true', HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1' }
const children = [], results = [], engineRequests = []
const report = { startedAt: new Date().toISOString(), provenance: 'Pure demo catalog plus independently constructed SYN teachers/rooms; no exports or snapshots. Fresh owned store and services only.', runtime, results, engineRequests, env: {} }
let browser, proxy
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const port = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)) }) })
function start(command, args, folder, env) {
  const child = spawn(command, args, { cwd: join(root, folder), env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.output = ''; child.on('error', e => { child.launchError = e.message })
  for (const stream of [child.stdout, child.stderr]) stream.on('data', c => { child.output = (child.output + c).slice(-3000) })
  children.push(child); return child
}
async function ready(url, child) {
  for (let i = 0; i < 225; i++) {
    if (child.launchError || child.exitCode !== null) throw new Error(`Setup: ${child.launchError || child.output}`)
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return } catch { /* owned startup */ }
    await delay(200)
  }
  throw new Error(`Setup timeout ${url}: ${child.output}`)
}
await mkdir(evidence, { recursive: true })
async function persist() { await writeFile(join(evidence, 'acceptance.json'), JSON.stringify(report, null, 2)) }
try {
  report.source = {}
  for (const name of ['client/src/data/planningSession.ts', 'client/src/components/ai-elements/SuggestionCard.tsx', 'client/src/screens/PlanningStatusBar.tsx', 'backend/dist/programacion-academica/demo-proposal.service.js', 'planning-engine/solver.py']) {
    report.source[name] = createHash('sha256').update(await readFile(join(root, name))).digest('hex')
  }
  const enginePort = await port(), apiPort = await port(), webPort = await port()
  const engineBase = `http://127.0.0.1:${enginePort}`
  proxy = httpServer(async (req, res) => {
    engineRequests.push({ method: req.method, path: req.url })
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk)
      const r = await fetch(`${engineBase}${req.url}`, { method: req.method, headers: { 'Content-Type': 'application/json', ...(req.headers['x-job-id'] ? { 'X-Job-Id': req.headers['x-job-id'] } : {}) }, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) })
      res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(await r.text())
    } catch { res.destroy() }
  })
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve))
  const apiBase = `http://127.0.0.1:${apiPort}`, base = `http://127.0.0.1:${webPort}`
  const api = '/api/local/programacion-academica/v1'
  const backendEnv = { ...basic, PORT: String(apiPort), SUM_ACADEMIC_SCHEDULING: '1', SIMULATOR_DEPLOYMENT: 'local', SUM_LOCAL_SCENARIOS: '0', SUM_ACADEMIC_DRAFT_DIR: runtime, SUM_PLANNING_ENGINE_URL: `http://127.0.0.1:${proxy.address().port}` }
  const webEnv = { ...basic, VITE_SUM_DATA_MODE: 'local', VITE_SUM_API_BASE_URL: '/api', VITE_SUM_API_PROXY_TARGET: apiBase, VITE_SUM_PLANNING_API_PROXY_TARGET: apiBase, VITE_SUM_ACADEMIC_SCHEDULING: '1', VITE_SUM_SIMULATOR: '0', VITE_SUM_LOCAL_PROFILE: 'synthetic-actors' }
  report.env = { engine: engineEnv, backend: backendEnv, web: webEnv }; report.ports = { enginePort, apiPort, webPort, proxyPort: proxy.address().port }
  const engine = start(join(root, 'planning-engine/.venv/bin/python'), ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(enginePort)], 'planning-engine', engineEnv)
  await ready(`${engineBase}/health`, engine)
  const backend = start(process.execPath, ['dist/programacion-academica/local-main.js'], 'backend', backendEnv)
  await ready(`${apiBase}/local/programacion-academica/v1/catalogo`, backend)
  const web = start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], 'client', webEnv)
  await ready(`${base}/local/programacion-academica`, web)
  browser = await chromium.launch({ headless: true, env: basic })
  const catalogResponse = await fetch(`${apiBase}/local/programacion-academica/v1/catalogo`)
  const catalog = await catalogResponse.json()
  const reference = catalog.referenceTeachers.find(t => t.courseIds.length)
  const course = catalog.courses.find(c => c.courseId === reference.courseIds[0])
  const availability = [1, 2, 3, 4, 5].map(day => ({ day, startMinute: 480, endMinute: 1320 }))
  const resources = { teachers: ['A', 'B'].map((letter, i) => ({ id: `SYN-${letter}`, name: `Synthetic ${letter}`, courseIds: [course.courseId], maxWeeklyMinutes: 2400, availability, regime: 'tiempo-parcial', weeklyServiceHours: 10 + i * 10, appointment: 'contract' })), rooms: [{ id: 'SYN-ROOM', name: 'Synthetic room', capacity: 45, availability }] }
  async function fixture(name, { demand = 1, capacity = 1, resource = resources, duration = 60 } = {}) {
    const configuration = { schoolId: 'SISTEMAS', academicPeriod: '2027-I', ...(duration ? { lectiveHourMinutes: duration } : {}), demandSourceId: 'independent-120-v1', demandBaseRequest: null, request: { revision: catalog.revision, demands: [{ courseId: course.courseId, estimatedDemand: demand, targetCapacity: capacity }], resources: resource } }
    const r = await fetch(`${apiBase}/local/programacion-academica/v1/borradores/guardar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: null, expectedVersion: null, title: `SYN ${name}`, state: 'draft', configuration, proposalId: null, proposalEditVersion: null }) })
    assert.equal(r.status, 200, await r.clone().text()); return r.json()
  }
  async function scenario(name, run) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage(); page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(45000)
    const item = { name, startedAt: new Date().toISOString(), errors: [], consoleErrors: [], requestFailures: [], requests: [], httpErrors: [], details: [], screenshots: [] }
    const capture = async label => { const file = `${name}-${label}.png`; await page.screenshot({ path: join(evidence, file) }); item.screenshots.push(file) }
    page.on('pageerror', e => item.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') item.consoleErrors.push(m.text()) })
    page.on('requestfailed', r => item.requestFailures.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText }))
    page.on('response', r => { if (r.status() >= 400) item.httpErrors.push({ path: new URL(r.url()).pathname, status: r.status() }) })
    await context.route('**/*', async route => {
      const r = route.request(), u = new URL(r.url())
      if (u.origin !== base && !['data:', 'blob:'].includes(u.protocol)) { item.errors.push(`External request blocked: ${u.origin}`); return route.abort() }
      if (u.pathname.startsWith('/api/')) item.requests.push({ method: r.method(), path: u.pathname, ...(r.method() === 'POST' ? { body: r.postDataJSON() } : {}) })
      return route.continue()
    })
    try {
      await page.goto(`${base}/local/programacion-academica`, { waitUntil: 'networkidle' })
      await page.locator('#planning-page-title').waitFor()
      await run({ page, capture, item })
      assert.deepEqual(item.errors, [], 'runtime/external errors')
      item.status = 'passed'; console.log(`PASS ${name}`)
    } catch (e) {
      item.status = 'failed'; item.error = e.message; item.stack = e.stack
      item.dom = (await page.locator('body').innerText().catch(() => '')).slice(0, 24000)
      await capture('failure').catch(() => {}); console.log(`FAIL ${name}: ${e.message.slice(0, 500)}`)
    } finally { item.finishedAt = new Date().toISOString(); results.push(item); await context.close(); await persist() }
  }
  async function load(page, draft) { await closeChat(page); await resume(page, draft); await nav(page, 'preparacion', 'resumen') }
  async function generate(page) {
    const started = response(page, '/busquedas')
    await page.locator('#planning-tour-primary').click()
    let job = await json(await started)
    for (let i = 0; i < 250 && job.state === 'running'; i++) { await delay(100); job = await json(await page.request.get(`${base}${api}/busquedas/${job.jobId}`)) }
    assert.notEqual(job.state, 'running', 'terminal by deadline')
    await page.getByRole('button', { name: 'Cancelar', exact: true }).waitFor({ state: 'hidden' })
    return job
  }
  await scenario('jobs-cancel', async ({ page, capture, item }) => {
    const large = { teachers: Array.from({ length: 20 }, (_, i) => ({ ...resources.teachers[0], id: `SYN-L${i}`, name: `Synthetic large ${i}` })), rooms: Array.from({ length: 20 }, (_, i) => ({ ...resources.rooms[0], id: `SYN-R${i}` })) }
    const draft = await fixture('long job', { demand: 40, resource: large })
    await load(page, draft)
    const started = response(page, '/busquedas'); await page.locator('#planning-tour-primary').click()
    let job = await json(await started); assert.equal(job.state, 'running')
    for (let i = 0; i < 150 && !job.proposal && job.state === 'running'; i++) { await delay(100); job = await json(await page.request.get(`${base}${api}/busquedas/${job.jobId}`)) }
    assert.equal(job.state, 'running'); assert.ok(job.proposal, 'live witness')
    await page.getByRole('status').filter({ hasText: /Búsqueda ·/ }).waitFor()
    await page.locator('.planning-status-bar').waitFor()
    assert.equal(await page.locator('#planning-tour-save').isDisabled(), true)
    item.details.push({ liveJob: job.state, progress: job.progress, proposalId: job.proposal.proposalId, saveDisabled: true })
    await capture('running')
    const cancel = page.getByRole('button', { name: 'Cancelar', exact: true })
    await cancel.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
    assert.equal(await cancel.evaluate(el => el === document.activeElement), true)
    item.details.push({ cancelFocus: await cancel.evaluate(el => ({ focusVisible: el.matches(':focus-visible'), outline: getComputedStyle(el).outline, boxShadow: getComputedStyle(el).boxShadow })) })
    const cancelled = response(page, `/busquedas/${job.jobId}/cancelar`); await page.keyboard.press('Enter')
    const terminal = await json(await cancelled); assert.equal(terminal.state, 'cancelled'); assert.equal(terminal.proposal.proposalId, job.proposal.proposalId)
    await page.getByRole('status').filter({ hasText: /Búsqueda cancelada/ }).waitFor()
    assert.equal(item.requests.some(r => r.method === 'POST' && r.path.endsWith('/propuestas')), false)
    assert.equal(item.requests.some(r => r.method === 'POST' && r.path.endsWith('/guardar')), false)
    await capture('cancelled')
    await page.getByRole('button', { name: /Editar horario/ }).first().waitFor().catch(e => item.details.push({ editControlGap: e.message.slice(0, 200) }))
  })
  await scenario('teacher-isolation', async ({ page, capture, item }) => {
    await load(page, await fixture('teachers'))
    await nav(page, 'preparacion', 'recursos')
    await page.getByRole('button', { name: 'Abrir ficha de Synthetic A', exact: true }).click()
    await page.locator('#teacher-load-reference').fill('SYN-A-PARTIAL')
    await page.getByLabel('Tipo de autorización', { exact: true }).selectOption('vrap-authorization')
    await page.getByLabel('Horas lectivas máximas', { exact: true }).fill('18')
    await page.getByLabel('Horas semanales de servicio (tiempo parcial)', { exact: true }).fill('11')
    assert.equal(await page.locator('#teacher-load-reference').inputValue(), 'SYN-A-PARTIAL')
    await capture('A-draft')
    // The teacher sheet is modal: the list is inert until it is closed.
    await page.getByRole('button', { name: 'Cerrar ficha', exact: true }).click()
    await page.getByRole('button', { name: 'Abrir ficha de Synthetic B', exact: true }).click()
    assert.equal(await page.locator('#teacher-load-reference').inputValue(), '')
    assert.equal(await page.getByLabel('Horas semanales de servicio (tiempo parcial)', { exact: true }).inputValue(), '20')
    await page.getByLabel('Tipo de autorización', { exact: true }).selectOption('vrap-authorization')
    assert.equal(await page.getByLabel('Horas lectivas máximas', { exact: true }).inputValue(), '')
    item.details.push({ sameTeacherTypingPreserved: true, BReference: '', BHours: '', BServiceHours: '20' })
    await capture('B-clean')
  })
  await scenario('advisor-explicit-regenerate', async ({ page, capture, item }) => {
    await load(page, await fixture('advisor', { resource: { teachers: [], rooms: [] } }))
    const first = await generate(page); assert.ok(first.proposal)
    await nav(page, 'horario')
    const adviceResponse = response(page, `/propuestas/${first.proposal.proposalId}/consejero`)
    await page.getByRole('button', { name: 'Consultar consejero', exact: true }).click()
    const advice = await json(await adviceResponse)
    assert.equal(advice.source.mode, 'engine-decisions'); assert.equal(advice.verifiedImpact, undefined)
    item.details.push({ advice })
    await capture('advice')
    const rec = advice.recommendations.find(r => r.patch.kind === 'incorporate_reference_resource')
    assert.ok(rec, 'actual retained decision with executable reference patch')
    const checkboxes = page.getByRole('dialog').getByRole('checkbox')
    item.details.push({ checkboxCount: await checkboxes.count(), dialog: await page.getByRole('dialog').innerText() })
    await checkboxes.first().check()
    const regenerate = response(page, '/busquedas')
    await page.getByRole('button', { name: 'Aplicar seleccionadas y regenerar', exact: true }).click()
    const job = await json(await regenerate); assert.notEqual(job.proposal?.proposalId, first.proposal.proposalId)
    await page.getByRole('button', { name: 'Cancelar', exact: true }).waitFor({ state: 'hidden', timeout: 45000 })
    assert.equal(item.requests.some(r => r.path.endsWith('/guardar')), false)
    assert.equal(engineRequests.some(r => r.path.includes('/v1/advisor')), false)
    await capture('regenerated')
  })
  for (const duration of [60, null]) await scenario(duration ? 'lifecycle-success' : 'normative-blocker', async ({ page, capture, item }) => {
    await load(page, await fixture(duration ? 'publishable' : 'missing duration', { duration }))
    const job = await generate(page); assert.equal(job.proposal.status, 'complete')
    await page.getByLabel('Nombre de la propuesta', { exact: true }).fill(duration ? 'SYN DOM publication' : 'SYN DOM normative blocker')
    const { draft } = await save(page, duration ? 'SYN DOM publication' : 'SYN DOM normative blocker')
    await page.reload({ waitUntil: 'networkidle' }); await closeChat(page); const restored = await resume(page, draft)
    assert.deepEqual(restored.proposal.assignments, job.proposal.assignments)
    item.details.push({ saveReload: true, draftId: draft.id })
    await nav(page, 'revision')
    let pending = response(page, `/borradores/${draft.id}/revision/enviar`)
    await page.getByRole('button', { name: /^Enviar a revisión(?: docente)?$/ }).click()
    let state = (await json(await pending)).draft
    for (const teacher of state.review.teachers) {
      await page.getByLabel('Rol simulado de revisión', { exact: true }).selectOption('teacher')
      await page.getByLabel('Docente de revisión', { exact: true }).selectOption(teacher.teacherId)
      pending = response(page, `/borradores/${draft.id}/revision/responder`)
      await page.getByRole('button', { name: 'Dar conformidad', exact: true }).click(); state = (await json(await pending)).draft
    }
    await page.getByLabel('Rol simulado de revisión', { exact: true }).selectOption('school')
    await nav(page, 'aprobacion')
    await page.locator('.academic-publication__preview').waitFor()
    await page.getByRole('button', { name: 'Aprobar (simulada)', exact: true }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Aprobar (simulada)', exact: true }).click()
    pending = response(page, `/borradores/${draft.id}/aprobar`)
    await page.getByRole('alertdialog').getByRole('button', { name: 'Aprobar', exact: true }).click()
    state = (await json(await pending)).draft; assert.equal(state.state, 'approved')
    await page.getByRole('button', { name: 'Publicar (simulada)', exact: true }).click()
    pending = response(page, `/borradores/${draft.id}/publicar`)
    await page.getByRole('alertdialog').getByRole('button', { name: 'Publicar', exact: true }).click()
    const published = await pending
    if (duration) { state = (await json(published)).draft; assert.equal(state.state, 'published'); item.details.push({ states: ['draft', 'in-review', 'ready-for-approval', 'approved', 'published'] }) }
    else { assert.equal(published.status(), 409); item.details.push({ normativeRejection: await published.json() }); await page.getByText(/No se publicó la propuesta.*hora lectiva/).filter({ visible: true }).first().waitFor() }
    await capture('publication')
  })
  await scenario('responsive-keyboard', async ({ page, capture, item }) => {
    await load(page, await fixture('responsive'))
    for (const width of [360, 390, 720, 800, 1100, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
      item.details.push({ viewport: width, ...dimensions }); assert.ok(dimensions.scroll <= dimensions.width + 1, `overflow ${width}`)
      if (width === 390) await capture('390')
    }
    await page.keyboard.press('Tab')
    item.details.push({ tabFocus: await page.evaluate(() => ({ tag: document.activeElement.tagName, text: document.activeElement.textContent, focusVisible: document.activeElement.matches(':focus-visible') })) })
    // CSS zoom explicitly simulates enlargement; this is not browser UI zoom.
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    const enlarged = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
    item.details.push({ cssZoomSimulation: '200%', actualBrowserZoom: 'not supported by this headless platform', ...enlarged })
    assert.ok(enlarged.scroll <= enlarged.width + 1, 'CSS zoom simulation overflow')
    await capture('css-zoom-200')
  })
} catch (e) { report.setupError = e.message; console.error(e.stack); process.exitCode = 1 }
finally {
  await browser?.close()
  for (const child of children.reverse()) if (child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM')
    await Promise.race([stopped, delay(5000)])
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await stopped }
  }
  if (proxy) await new Promise(resolve => proxy.close(resolve))
  await rm(runtime, { recursive: true, force: true })
  report.cleanup = { browserClosed: true, services: children.map(c => ({ pid: c.pid, code: c.exitCode, signal: c.signalCode })), ownTemporaryStateRemoved: true }
  report.finishedAt = new Date().toISOString(); await persist()
}
console.log(JSON.stringify({ passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, setupError: report.setupError, cleanup: report.cleanup }))
if (results.some(r => r.status === 'failed')) process.exitCode = 1

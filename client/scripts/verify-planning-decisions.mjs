// Real local scenario for the coverage state, decision queue and teacher regulatory data (React → NestJS → Python engine).
// It starts its own synthetic stack on free loopback ports with a fresh temporary draft directory and stops it afterwards.
// Never attach it to an operator server or to a server that reads a snapshot directory: the environment passed to the children is
// built from scratch and contains no *_SNAPSHOT_DIR variable.
//
//   node scripts/verify-planning-decisions.mjs
//   SUM_PLANNING_ENGINE_PYTHON=/path/to/python  (interpreter with the engine dependencies; default planning-engine/.venv/bin/python)
//   SUM_DECISIONS_EVIDENCE=/path/to/dir          (default evidence/local/planning-decisions-2026-11-11)
//   prerequisite: `pnpm --dir backend build` (the backend runs from backend/dist)
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer as createViteServer } from 'vite'

const root = fileURLToPath(new URL('../../', import.meta.url))
const evidence = resolve(process.env.SUM_DECISIONS_EVIDENCE || resolve(root, 'evidence/local/planning-decisions-2026-11-11'))
const python = resolve(process.env.SUM_PLANNING_ENGINE_PYTHON || resolve(root, 'planning-engine/.venv/bin/python'))
const backendEntry = resolve(root, 'backend/dist/programacion-academica/local-main.js')
if (!existsSync(python)) throw new Error(`Engine interpreter not found: ${python}. Set SUM_PLANNING_ENGINE_PYTHON.`)
if (!existsSync(backendEntry)) throw new Error('backend/dist is missing: run `pnpm --dir backend build` first.')

const freePort = () => new Promise((accept, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => accept(port)) })
})
const ports = { engine: await freePort(), api: await freePort(), web: await freePort() }
const draftDir = await mkdtemp(join(tmpdir(), 'sum-decisions-synthetic-'))
// No inherited environment: nothing private can reach the children, and no *_SNAPSHOT_DIR variable exists in it.
const env = { PATH: process.env.PATH, LANG: 'C.UTF-8' }
const children = []
const start = (command, args, folder, variables) => {
  const child = spawn(command, args, { cwd: resolve(root, folder), env: { ...env, ...variables }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.output = ''
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { child.output = (child.output + chunk.toString()).slice(-2500) })
  child.on('error', (error) => { child.launchError = error })
  children.push(child)
  return child
}
const ready = async (url, child) => {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    if (child.launchError) throw child.launchError
    if (child.exitCode !== null) throw new Error(`Synthetic service exited ${child.exitCode}: ${child.output}`)
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return } catch { /* starting */ }
    await new Promise((accept) => setTimeout(accept, 250))
  }
  throw new Error(`Synthetic service startup timeout: ${url}: ${child.output}`)
}

const results = []
const measured = {}
let browser
let page
try {
  const engine = start(python, ['main.py'], 'planning-engine', {
    PORT: String(ports.engine), SUM_LLM_PROVIDER: 'disabled', SUM_RAG_GENERATION_MODE: 'extractive',
    AWS_EC2_METADATA_DISABLED: 'true', HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1',
  })
  await ready(`http://127.0.0.1:${ports.engine}/health`, engine)
  const backend = start(process.execPath, [backendEntry], 'backend', {
    PORT: String(ports.api), SUM_ACADEMIC_SCHEDULING: '1', SIMULATOR_DEPLOYMENT: 'local', SUM_LOCAL_SCENARIOS: '0',
    SUM_ACADEMIC_DRAFT_DIR: draftDir, SUM_PLANNING_ENGINE_URL: `http://127.0.0.1:${ports.engine}`,
  })
  await ready(`http://127.0.0.1:${ports.api}/local/programacion-academica/v1/catalogo`, backend)
  const frontend = start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(ports.web), '--strictPort'], 'client', {
    VITE_SUM_DATA_MODE: 'local', VITE_SUM_API_BASE_URL: '/api', VITE_SUM_API_PROXY_TARGET: `http://127.0.0.1:${ports.api}`,
    VITE_SUM_PLANNING_API_PROXY_TARGET: `http://127.0.0.1:${ports.api}`, VITE_SUM_ACADEMIC_SCHEDULING: '1',
    VITE_SUM_SIMULATOR: '0', VITE_SUM_LOCAL_PROFILE: 'synthetic-actors',
  })
  const route = '/local/programacion-academica'
  const origin = `http://127.0.0.1:${ports.web}`
  await ready(`${origin}${route}`, frontend)
  console.log(`Own synthetic stack ready (engine ${ports.engine}, api ${ports.api}, web ${ports.web}); fresh draft store; LLM disabled`)

  const check = async (id, run) => {
    try { await run(); results.push({ id, passed: true }); console.log(`PASS ${id}`) }
    catch (error) {
      results.push({ id, passed: false, error: error.message })
      await page?.screenshot({ path: resolve(evidence, `failure-${id}.png`) }).catch(() => {})
      throw error
    }
  }
  // Component rendering with synthetic fixtures (transform and render only; no listening server, no browser).
  await check('components-render-states-queue-teacher-limits-and-blockers', async () => {
    const vite = await createViteServer({ configFile: false, envDir: false, root: resolve(root, 'client'), logLevel: 'error', cacheDir: join(draftDir, 'vite-ssr-cache'), optimizeDeps: { noDiscovery: true, include: [] },
      ssr: { external: true }, server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' })
    try {
      const { PlanningStatusBar } = await vite.ssrLoadModule('/src/screens/PlanningStatusBar.tsx')
      const { PlanningDecisions } = await vite.ssrLoadModule('/src/screens/PlanningDecisions.tsx')
      const { AcademicPublicationPanel } = await vite.ssrLoadModule('/src/screens/AcademicPublicationPanel.tsx')
      const { TeacherLoadFields } = await vite.ssrLoadModule('/src/screens/PlanningTeacherLoad.tsx')
      const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))
      const proposal = { proposalId: 'synthetic', status: 'search-limit', sections: [], assignments: [], pending: [], diagnostics: [], coverageComplete: false,
        counts: { sections: 10, requiredSessions: 10, scheduledSessions: 6 }, stats: { exploredCandidates: 1, candidateVisits: 1, backtracks: 0, limitReason: null } }
      const bar = (extra) => render(PlanningStatusBar, { proposal: { ...proposal, ...extra }, academicPeriod: '2027-I' })
      const states = ['complete', 'shortfall-proven', 'inconclusive'].map((coverageProof) => bar({ coverageProof }))
      for (const [html, text] of [[states[0], 'Cobertura completa'], [states[1], 'Faltante comprobado'], [states[2], 'Búsqueda inconclusa']]) assert.ok(html.includes(text), text)
      assert.ok(!states[1].includes('Búsqueda inconclusa') && !states[2].includes('Faltante comprobado'))
      assert.ok(bar({ capacityCertificate: { proven: true, requiredSectionsTotal: 10, coverableSectionsTotal: 8, courses: [] } }).includes('Carga autorizada cubre 8 de 10'))
      const legacy = bar({})
      assert.ok(!legacy.includes('planning-status-bar__coverage') && !legacy.includes('Carga autorizada cubre'), 'Proposal without the fields renders as before')
      assert.ok(legacy.includes('La búsqueda se detuvo antes de completar la programación'))

      const decisions = [
        { id: 'D1', kind: 'teacher-load-exception', teacherId: 'T1', courseIds: [], exceptionKind: 'voluntary-declaration', additionalMinutes: 480, sectionsUnlocked: 3, basis: 'capacity-relaxation', requires: ['Paso formal sintético'], sourceIds: ['OF-02'] },
        { id: 'D2', kind: 'additional-teacher', teacherId: null, courseIds: ['C1'], exceptionKind: null, additionalMinutes: 360, sectionsUnlocked: 2, basis: 'capacity-relaxation' },
        { id: 'D3', kind: 'planning-window', teacherId: null, courseIds: [], exceptionKind: null, additionalMinutes: 0, sectionsUnlocked: 5, basis: 'window-precheck', policyChange: { allowAfternoon: true } },
        { id: 'D4', kind: 'delivery-mode-split', teacherId: null, courseIds: ['C2', 'C3'], exceptionKind: null, additionalMinutes: 0, sectionsUnlocked: 5, basis: 'window-precheck' },
      ]
      const queue = render(PlanningDecisions, { proposal: { ...proposal, decisions, coverageProof: 'inconclusive',
        normative: { profileRevision: 'UNMSM-AAD-2026-04', lectiveHourMinutes: 60, blockers: [], gaps: [{ code: 'REGIME_MISSING', message: 'No se registró el régimen.', teacherIds: ['T1'] }] },
        prelation: { levels: [{ id: 'contract-sections', value: 1, proven: false }] } },
      period: '2027-I', teacherNames: { T1: 'Docente Uno' }, courseNames: { C1: 'Curso Uno', C2: 'Curso Dos', C3: 'Curso Tres' },
      resources: { teachers: [], rooms: [] }, policy: null, deliveryModes: {}, isLocked: false, busy: false,
      onApplyPatches() {}, onRecordAuthorization() {}, onAddTeacher() {}, onRegenerate() {} })
      // Only the first group (most sections unlocked) is expanded; the others show their label, count and unlocked sections.
      for (const text of ['2 decisiones cubren 5 secciones', '2 cursos', 'Curso Dos', 'condición necesaria', 'Excepciones de carga docente', 'Docentes adicionales', 'Ampliación de franjas', 'Dictado partido', 'alternativas, no se suman']) assert.ok(queue.toLowerCase().includes(text.toLowerCase()), text)
      assert.ok(queue.includes('Base normativa y vacíos (1)'))
      const exceptionQueue = render(PlanningDecisions, { proposal: { ...proposal, decisions: decisions.slice(0, 1) }, period: '2027-I', teacherNames: { T1: 'Docente Uno' }, courseNames: {},
        resources: { teachers: [], rooms: [] }, policy: null, deliveryModes: {}, isLocked: false, busy: false, onApplyPatches() {}, onRecordAuthorization() {}, onAddTeacher() {}, onRegenerate() {} })
      for (const text of ['Docente Uno', '+480 min semanales', 'Paso formal sintético', 'OF-02', 'Registrar autorización', 'no cambia por sí sola la carga semanal']) assert.ok(exceptionQueue.includes(text), text)

      const panelProps = { primaryActionId: 'approve', draftId: 'draft', draftVersion: 3, draftTitle: 'Propuesta sintética', draftState: 'approved', dirty: false, busy: false,
        onApprove: async () => {}, onPublish: async () => {}, onFork: async () => {}, onError() {}, onMessage() {}, teacherNames: { T1: 'Docente Uno' }, period: '2027-I' }
      const blocked = render(AcademicPublicationPanel, { ...panelProps, loadBlockers: [{ teacherId: 'T1', assignedMinutes: 960, authorizedMaxMinutes: 720,
        reason: 'over-authorized-load', requiredAuthorization: 'voluntary-declaration', sourceIds: ['OF-02'] }] })
      for (const text of ['Bloqueos de publicación (1)', 'Docente Uno', '960 min asignados', '720 min autorizados', 'declaración jurada', 'No se puede publicar mientras existan bloqueos', 'aprobar no resuelve un bloqueo']) assert.ok(blocked.includes(text), text)
      assert.ok(!render(AcademicPublicationPanel, panelProps).includes('Bloqueos de publicación'), 'No blockers, no section')

      const limits = render(TeacherLoadFields, { teacher: { id: 'T1', name: 'Docente Uno', courseIds: [], maxWeeklyMinutes: 720, availability: [], regime: 'tiempo-completo', appointment: 'faculty-ordinary' },
        period: '2027-I', lectiveHourMinutes: 60, disabled: false, onChange() {} })
      for (const text of ['Máximo autorizado', '720 min (12 h lectivas)', 'OF-02', 'Registrar autorización']) assert.ok(limits.includes(text), text)
    } finally { await vite.close() }
  })

  await mkdir(evidence, { recursive: true })
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
  page = await context.newPage()
  page.setDefaultTimeout(20000)
  page.setDefaultNavigationTimeout(45000)
  const pageErrors = []
  const external = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('request', (request) => { if (!request.url().startsWith(origin) && !/^(data:|blob:)/.test(request.url())) external.push(request.url()) })

  const capture = (name) => page.screenshot({ path: resolve(evidence, `${name}.png`), fullPage: false })
  const setTheme = async (item) => {
    await page.getByRole('button', { name: /^Cambiar tema de interfaz/ }).first().click()
    await page.getByRole('menuitem', { name: item, exact: true }).click()
  }
  const overflow = async () => {
    const width = await page.evaluate(() => document.documentElement.clientWidth)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(scrollWidth <= width + 1, `Document overflow at ${width}px: scrollWidth ${scrollWidth}`)
  }
  const facts = async () => {
    const text = await page.locator('.planning-status-bar__facts').innerText()
    const complete = Number(/(\d+) de (\d+) secciones completas/.exec(text)?.[1])
    const total = Number(/(\d+) de (\d+) secciones completas/.exec(text)?.[2])
    return { text, complete, total }
  }
  const generated = async () => {
    await page.locator('.planning-status-bar').waitFor({ timeout: 90000 })
  }

  await check('generate-default-56-course-proposal', async () => {
    await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' })
    await page.locator('#planning-page-title').waitFor({ timeout: 45000 })
    const selectAll = page.getByRole('button', { name: /Seleccionar los .* cursos del catálogo/ })
    await selectAll.waitFor({ timeout: 45000 })
    const selectLabel = await selectAll.innerText()
    await selectAll.click()
    await page.locator('#planning-tour-primary', { hasText: 'Generar propuesta' }).click()
    await page.waitForURL((url) => url.searchParams.get('etapa') === 'horario', { timeout: 90000 })
    await generated()
    measured.selectAllLabel = selectLabel
    measured.before = await facts()
    assert.ok(measured.before.total >= 150, `Default proposal has the full catalog: ${measured.before.total} sections`)
  })

  await check('coverage-state-capacity-and-queue-visible', async () => {
    const coverage = page.locator('.planning-status-bar__coverage')
    await coverage.waitFor()
    measured.coverageLabel = (await coverage.innerText()).trim()
    assert.match(measured.coverageLabel, /Faltante comprobado|Búsqueda inconclusa|Cobertura completa/)
    const capacity = page.locator('.planning-status-bar__fact', { hasText: 'Carga autorizada cubre' })
    assert.equal(await capacity.count(), 1)
    measured.capacityFact = (await capacity.innerText()).trim()
    const queue = page.locator('.planning-decisions__queue')
    await queue.waitFor()
    measured.summary = (await page.locator('.planning-decisions__summary').innerText()).trim()
    assert.match(measured.summary, /decisiones? cubre?n? \d+ secciones?/)
    const groups = await page.locator('.planning-decisions__group-trigger').allInnerTexts()
    measured.groups = groups.map((text) => text.replace(/\s+/g, ' ').trim())
    assert.ok(groups.length >= 2, `Several decision groups: ${JSON.stringify(groups)}`)
    assert.ok(measured.groups.some((text) => /Ampliación de franjas|Dictado partido/.test(text)), 'Window or split decisions listed')
    assert.match(await queue.innerText(), /condición necesaria/i)
    // Status is never color alone: the coverage state is text.
    assert.ok((await coverage.innerText()).trim().length > 5)
    await page.locator('.planning-decisions').scrollIntoViewIfNeeded()
    await capture('coverage-and-queue-light-desktop')
  })

  await check('layout-light-and-dark-narrow-and-zoomed', async () => {
    await setTheme('Oscuro (Dark)')
    assert.equal(await page.locator('.planning-root').getAttribute('data-theme'), 'dark')
    await page.locator('.planning-decisions').scrollIntoViewIfNeeded()
    await capture('coverage-and-queue-dark-desktop')
    await overflow()
    await page.setViewportSize({ width: 390, height: 844 })
    await overflow()
    await page.locator('.planning-status-bar').scrollIntoViewIfNeeded()
    await capture('coverage-dark-narrow')
    await page.locator('.planning-decisions').scrollIntoViewIfNeeded()
    await capture('queue-dark-narrow')
    await page.setViewportSize({ width: 1440, height: 1024 })
    await setTheme('Claro (Light)')
    assert.equal(await page.locator('.planning-root').getAttribute('data-theme'), 'light')
    await page.setViewportSize({ width: 390, height: 844 })
    await overflow()
    await page.locator('.planning-status-bar').scrollIntoViewIfNeeded()
    await capture('coverage-light-narrow')
    await page.locator('.planning-decisions').scrollIntoViewIfNeeded()
    await capture('queue-light-narrow')
    await page.setViewportSize({ width: 720, height: 512 }) // 1440 px at 200 % zoom
    await overflow()
    await page.setViewportSize({ width: 1440, height: 1024 })
  })

  await check('keyboard-reaches-decision-actions-with-visible-focus', async () => {
    // Keyboard modality: Tab from the collapse control reaches the first group trigger and :focus-visible draws a ring.
    await page.locator('.planning-decisions__header button').first().focus()
    await page.keyboard.press('Tab')
    const focused = page.locator('.planning-decisions__group-trigger').first()
    assert.equal(await focused.evaluate((element) => element === document.activeElement), true, 'Tab reaches the first decision group')
    const outline = await focused.evaluate((element) => { const style = getComputedStyle(element); return `${style.outlineStyle}|${style.boxShadow}` })
    assert.doesNotMatch(outline, /^none\|none$/, `Visible focus indicator on the group trigger: ${outline}`)
    const reachable = await page.locator('.planning-decisions__item button:not([disabled])').count()
    measured.reachableActions = reachable
    assert.ok(reachable > 0, 'At least one enabled queue action')
  })

  await check('enable-afternoon-through-queue-action-and-regenerate', async () => {
    const group = page.locator('.planning-decisions__group', { hasText: 'Ampliación de franjas' })
    assert.equal(await group.count(), 1, 'planning-window group present')
    if (await group.locator('.planning-decisions__list').count() === 0) await group.locator('.planning-decisions__group-trigger').click()
    const item = group.locator('.planning-decisions__item', { hasText: /Habilitar tardes \(lunes a viernes\)/ }).first()
    const target = (await item.count()) ? item : group.locator('.planning-decisions__item').first()
    assert.match(await target.innerText(), /testimonio/i)
    measured.windowActionItem = (await target.locator('strong').first().innerText()).trim()
    await target.getByRole('button', { name: /Habilitar y regenerar/ }).click()
    await page.locator('[data-advisor-outcome]').waitFor({ timeout: 120000 })
    await generated()
    measured.after = await facts()
    measured.afterCoverage = (await page.locator('.planning-status-bar__coverage').innerText()).trim()
    measured.afterSummary = await page.locator('.planning-decisions__summary').count() ? (await page.locator('.planning-decisions__summary').innerText()).trim() : null
    assert.ok(measured.after.complete > measured.before.complete, `Sections complete ${measured.before.complete} → ${measured.after.complete}`)
    await page.locator('[data-advisor-outcome]').scrollIntoViewIfNeeded()
    await capture('after-afternoon-regeneration')
  })

  await check('record-authorization-on-teacher-then-regenerate', async () => {
    const exceptions = page.locator('.planning-decisions__group', { hasText: 'Excepciones de carga docente' })
    assert.equal(await exceptions.count(), 1, 'load-exception group present after the afternoon regeneration')
    if (await exceptions.locator('.planning-decisions__list').count() === 0) await exceptions.locator('.planning-decisions__group-trigger').click()
    const item = exceptions.locator('.planning-decisions__item', { hasText: 'Declaración jurada del docente' }).first()
    // Item text carries a teacher name from the synthetic catalog; keep only the kind and the effect.
    measured.exceptionItem = `${(await item.locator('.planning-decisions__item-heading .inline-flex').first().innerText()).trim()} · ${(await item.locator('.planning-decisions__effect').innerText()).trim()}`
    await item.locator('details > summary').first().click()
    assert.match(await item.innerText(), /Declaración jurada/)
    assert.match(await item.innerText(), /OF-02/)
    await item.getByRole('button', { name: 'Registrar autorización' }).click()
    await page.waitForURL((url) => url.searchParams.get('vista') === 'recursos')
    await page.locator('#teacher-load-reference').waitFor()
    await page.waitForFunction(() => document.activeElement?.id === 'teacher-load-reference', null, { timeout: 5000 })
    const limits = page.locator('.planning-teacher-load__limit-list')
    const authorizedBefore = (await limits.locator('div', { hasText: 'Máximo autorizado' }).innerText()).replace(/\s+/g, ' ')
    measured.authorizedBefore = authorizedBefore
    // Invalid input is refused with a readable message before anything is stored.
    await page.getByRole('button', { name: 'Registrar autorización' }).click()
    assert.match(await page.getByRole('alert').filter({ hasText: 'referencia' }).innerText(), /Indica la referencia/)
    await page.locator('#teacher-load-reference').fill('SYN-DECLARACION-001')
    await page.getByRole('button', { name: 'Registrar autorización' }).click()
    await page.locator('.planning-teacher-load__authorization-list li', { hasText: 'SYN-DECLARACION-001' }).waitFor()
    const authorizedAfter = (await limits.locator('div', { hasText: 'Máximo autorizado' }).innerText()).replace(/\s+/g, ' ')
    measured.authorizedAfter = authorizedAfter
    assert.notEqual(authorizedAfter, authorizedBefore, 'Displayed authorized maximum changes after recording the declaration')
    await page.locator('#teacher-load-fieldset').scrollIntoViewIfNeeded()
    await capture('teacher-load-editor-light')
    await page.getByRole('button', { name: 'Igualar la carga semanal al máximo autorizado' }).click()
    await page.getByRole('button', { name: 'Cerrar ficha' }).click()
    await page.locator('#planning-tour-nav a[href*="etapa=horario"]:visible').first().click()
    await page.waitForURL((url) => url.searchParams.get('etapa') === 'horario')
    const outdated = page.locator('.planning-decisions__content [role="status"]', { hasText: 'propuesta anterior' })
    await outdated.waitFor()
    assert.ok(await page.locator('.planning-decisions__item', { hasText: 'Autorización registrada' }).count() >= 1, 'Recorded authorization marked on its decision')
    await page.locator('.planning-decisions').scrollIntoViewIfNeeded()
    await capture('queue-outdated-after-authorization')
    const before = measured.after.complete
    await outdated.getByRole('button', { name: 'Generar propuesta' }).click()
    await page.locator('.planning-status-bar').waitFor({ timeout: 120000 })
    await page.locator('.planning-decisions__content [role="status"]', { hasText: 'propuesta anterior' }).waitFor({ state: 'detached', timeout: 120000 })
    measured.afterAuthorization = await facts()
    measured.afterAuthorizationCoverage = (await page.locator('.planning-status-bar__coverage').innerText()).trim()
    assert.ok(measured.afterAuthorization.complete >= before, `Complete sections ${before} → ${measured.afterAuthorization.complete}`)
    await capture('after-authorization-regeneration')
  })

  await check('no-external-requests-and-no-page-errors', async () => {
    assert.deepEqual(external, [], `External requests: ${external.join(', ')}`)
    assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join(' | ')}`)
  })
  console.log(JSON.stringify(measured, null, 2))
} finally {
  await browser?.close().catch(() => {})
  for (const child of children.reverse()) if (child.exitCode === null) child.kill('SIGTERM')
  await Promise.all(children.filter((child) => child.exitCode === null && child.signalCode === null).map((child) => new Promise((accept) => child.once('exit', accept))))
  await mkdir(evidence, { recursive: true })
  await writeFile(resolve(evidence, 'results.json'), `${JSON.stringify({ date: new Date().toISOString().slice(0, 10), results, measured }, null, 2)}\n`)
  console.log(`Own synthetic stack stopped: ${JSON.stringify(children.map((child) => ({ pid: child.pid, code: child.exitCode, signal: child.signalCode })))}`)
  if (results.some((entry) => !entry.passed) || results.length === 0) process.exitCode = 1
}

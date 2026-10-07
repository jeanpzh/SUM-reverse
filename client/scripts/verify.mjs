import { chromium } from 'playwright'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { mockResponses } from '../src/data/mocks/responses.ts'
import { endpoints } from '../src/data/endpoints.ts'

const apiMode = process.argv.includes('--api')
const port = apiMode ? 5182 : 5181
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '')
const clientDir = resolve(root, 'client')
const evidenceRoot = resolve(root, apiMode ? 'evidence/local-api' : 'evidence/local')
const base = `http://127.0.0.1:${port}`
const responses = structuredClone(mockResponses)
if (apiMode) {
  responses.formulario.data.alumno.nomAlumno = 'DEMOSTRACIÓN API'
  responses.formulario.data.alumno.codAlumno = 'API-001'
  responses.perfil.data.numDocumento = 'DOC-API'
  const courseLists = [responses.plan.data, responses.programacion.data.programacion,
    responses.prematricula.data, responses.matricula.data.matricula,
    responses.horarios.data, responses.asistencias.data]
  for (const rows of courseLists) rows[0].desAsignatura = 'Asignatura desde API'
}
const expectedCourse = apiMode ? 'Asignatura desde API' : 'Matemática I'
const expectedName = [responses.formulario.data.alumno.apePaterno,
  responses.formulario.data.alumno.apeMaterno, responses.formulario.data.alumno.nomAlumno].join(' ')
const server = spawn(process.execPath, [resolve(clientDir, 'node_modules/vite/bin/vite.js'),
  '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: clientDir, stdio: 'pipe',
  env: { ...process.env, VITE_SUM_DATA_MODE: apiMode ? 'api' : 'mock', VITE_SUM_API_BASE_URL: '/api-proxy' },
})
process.on('exit', () => server.kill())
let serverError = ''
server.stderr.on('data', (data) => { serverError += data.toString() })
await new Promise((accept, reject) => {
  server.stdout.on('data', (data) => { if (data.toString().includes('Local:')) accept() })
  server.on('error', reject)
  server.on('exit', (code) => reject(new Error(`Verification server exited: ${code}\n${serverError}`)))
})
const source = await readFile(`${clientDir}/src/data/routes.ts`, 'utf8')
const routes = [...source.matchAll(/\{\s*id:\s*'([^']+)',\s*path:\s*'([^']+)',\s*title:\s*'([^']+)',?\s*\}/g)]
  .map(([, id, path, title]) => ({ id, path, title }))
assert.equal(routes.length, 16)
let browser
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined),
    headless: true, args: ['--no-sandbox'],
  })
  const context = await browser.newContext({ viewport: { width: 1536, height: 735 }, deviceScaleFactor: 1 })
  const errors = []
  const remote = []
  const consoleErrors = []
  const apiCalls = []
  const forbiddenMockCalls = []
  let failure = null
  let opaqueLists = false
  let emptyAttendance = false
  let expectedErrors = false
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      remote.push(url.href)
      return route.abort()
    }
    if (url.pathname.startsWith('/api-proxy/')) {
      if (!apiMode) { forbiddenMockCalls.push(url.href); return route.abort() }
      const entry = Object.entries(endpoints).find(([, endpoint]) => endpoint.action === url.searchParams.get('accion'))
      assert.ok(entry, `Unknown API action ${url.href}`)
      const [key, endpoint] = entry
      assert.equal(url.pathname, `/api-proxy/alumnoWebSum/v2/${endpoint.path}`)
      assert.equal(request.method(), 'POST')
      apiCalls.push(key)
      if (key === 'formulario' && failure === 'http') return route.fulfill({ status: 500, body: 'Local error scenario' })
      if (key === 'formulario' && failure === 'html') return route.fulfill({ contentType: 'text/html', body: '<html>Login</html>' })
      let response = responses[key]
      if (opaqueLists && ['evaluaciones', 'tutoria'].includes(key)) response = { message: null, codError: null, data: [{ unobserved: true }] }
      if (emptyAttendance && key === 'asistencias') response = { message: null, codError: null, data: [] }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) })
    }
    // API mode requests must target the configured proxy only. Mock must make
    // no data requests, even to the local SUM-shaped paths.
    if (url.searchParams.has('accion')) {
      forbiddenMockCalls.push(url.href)
      return route.abort()
    }
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (!expectedErrors && message.type() === 'error') consoleErrors.push(message.text())
  })
  const visit = async (path) => {
    await page.goto(`${base}${path}`)
    await page.locator('main').waitFor()
    await page.locator('.route-status').waitFor({ state: 'hidden' })
    await page.waitForFunction(() => document.title.includes('Sistema Único de Matrícula'))
    await page.evaluate(() => document.fonts.ready)
  }
  const measurements = []
  for (const route of routes) {
    await visit(route.path)
    assert.equal(await page.title(), `Sistema Único de Matrícula - ${route.title}`)
    assert.equal(await page.getByText('Página no encontrada').count(), 0)
    const dir = `${evidenceRoot}/${route.id}`
    await mkdir(dir, { recursive: true })
    const geometry = await page.evaluate(() => {
      const box = (selector) => {
        const e = document.querySelector(selector)
        if (!e) return null
        const r = e.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      }
      return { viewport: [innerWidth, innerHeight], sidebar: box('.sidebar'), header: box('.topbar'),
        main: box('main'), title: box('.page-title'), summary: box('.student-summary'), table: box('table'),
        tableHeaders: [...document.querySelectorAll('table:first-of-type th')].map((e) => e.innerText),
        resource: box('.tutorial-card'), forms: document.querySelectorAll('form').length }
    })
    assert.equal(geometry.sidebar.width, 280)
    assert.equal(geometry.header.height, 64)
    assert.equal(geometry.main.x, 280)
    assert.equal(geometry.main.y, 70)
    if (route.id === 'manuales') assert.equal(geometry.resource.height, 79)
    if (route.id === 'perfil') assert.ok(await page.getByText(responses.perfil.data.numDocumento, { exact: true }).count())
    if (route.id === 'asistencia') assert.equal(await page.locator('tbody tr').count(), 3)
    if (route.id === 'reportes-horarios') assert.equal(await page.locator('.calendar-event').count(), responses.horarios.data.length)
    if (route.id === 'programacion-asignaturas') assert.equal(await page.locator('tbody tr').count(), responses.programacion.data.programacion.length)
    if (route.id === 'programacion-asignaturas') {
      const buttons = page.getByRole('button', { name: /Horarios de/ })
      assert.equal(await buttons.count(), responses.programacion.data.programacion.length)
      const priorOverflow = await page.evaluate(() => document.documentElement.style.overflow)
      await buttons.first().click()
      const dialog = page.getByRole('dialog', { name: 'Horarios' })
      await dialog.waitFor()
      assert.equal(await page.evaluate(() => document.documentElement.style.overflow), 'hidden')
      const scrollBefore = await page.evaluate(() => scrollY)
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(80)
      assert.equal(await page.evaluate(() => scrollY), scrollBefore)
      assert.deepEqual(await dialog.locator('thead th').allTextContents(), ['Horario', 'Día', 'Horas de clase', 'Aula', 'Tipo'])
      assert.equal(await dialog.locator('tbody tr').count(), responses.programacion.data.programacion[0].horarios.length)
      assert.ok((await dialog.innerText()).includes('Práctica'))
      await dialog.getByRole('button', { name: 'Cerrar horarios' }).click()
      await dialog.waitFor({ state: 'hidden' })
      assert.equal(await page.evaluate(() => document.documentElement.style.overflow), priorOverflow)
    }
    if (route.id === 'plan-estudios') assert.equal(await page.locator('tbody tr').count(), responses.plan.data.length)
    if (['asistencia', 'programacion-asignaturas', 'plan-estudios', 'reportes-matricula', 'reportes-prematricula'].includes(route.id)) {
      assert.ok((await page.locator('tbody').innerText()).includes(expectedCourse))
    }
    if (route.id === 'reportes-evaluaciones') assert.ok(await page.getByText('No hay evaluaciones registradas.').count())
    if (route.id === 'reportes-deudas') assert.ok(await page.getByText('No se dispone de datos de deuda verificables.').count())
    measurements.push({ id: route.id, ...geometry })
    await page.screenshot({ path: `${dir}/candidate.png` })
    if (['tutoria', 'manuales'].includes(route.id)) await page.locator('main').screenshot({ path: `${dir}/main-candidate.png` })
  }
  await page.goto(`${base}/`)
  await page.waitForURL('**/alumnoWebSum/v2/inicio')
  await page.getByRole('button', { name: 'Mi Información', exact: true }).click()
  await page.locator('.subnav').getByRole('link', { name: 'Mi Perfil', exact: true }).click()
  await page.waitForURL('**/informacion/perfil')
  await page.getByRole('tab', { name: 'Información Personal' }).waitFor()
  assert.equal(await page.getByRole('tab', { name: 'Información Personal' }).getAttribute('aria-selected'), 'true')
  assert.equal(await page.getByRole('tab', { name: 'Cambio de Contraseña' }).isDisabled(), true)
  await page.goBack()
  await page.waitForURL('**/inicio')
  await page.goForward()
  await page.waitForURL('**/perfil')
  await page.getByRole('button', { name: 'Reportes', exact: true }).click()
  assert.equal(await page.locator('.subnav a').count(), 5)
  await page.getByRole('link', { name: 'Reporte de Deudas', exact: true }).click()
  await page.waitForURL('**/reportes/deudas')
  assert.equal(await page.locator('.subnav').count(), 0)
  await page.getByRole('button', { name: 'Ocultar menú' }).click()
  assert.equal(await page.locator('.student-app').evaluate((e) => e.classList.contains('sidebar-collapsed')), true)
  await page.getByRole('button', { name: 'Mostrar menú' }).click()
  await visit('/alumnoWebSum/v2/informacion/formularioDatos')
  assert.equal(await page.locator('input[id="field-0-4"]').inputValue(), responses.perfil.data.numDocumento)
  await page.getByRole('link', { name: 'Salud', exact: true }).click()
  assert.ok((await page.evaluate(() => scrollY)) > 1000)
  assert.equal(await page.locator('form').count(), 8)
  assert.equal(await page.locator('form input:not(:disabled),form select:not(:disabled)').count(), 0)
  await visit('/alumnoWebSum/v2/reportes/prematricula')
  const visibleCells = await page.locator('tbody tr').evaluateAll((rows) => rows.map((row) => [...row.cells].map((cell) => cell.innerText)))
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar', exact: true }).click()
  const download = await downloadPromise
  assert.equal(download.suggestedFilename(), `reportes-prematricula${apiMode ? '' : '-demo'}.csv`)
  const csv = await readFile(await download.path(), 'utf8')
  for (const row of visibleCells) assert.ok(csv.includes(row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')))
  assert.ok(csv.includes(expectedCourse))
  assert.equal(errors.length, 0, errors.join('\n'))
  assert.equal(consoleErrors.length, 0, consoleErrors.join('\n'))
  if (apiMode) {
    assert.equal(new Set(apiCalls).size, 12)
    opaqueLists = true
    await visit('/alumnoWebSum/v2/tutoria')
    assert.ok(await page.getByText('Los registros no se pueden mostrar con la información disponible.').count())
    await visit('/alumnoWebSum/v2/reportes/evaluaciones')
    assert.ok(await page.getByText('Los registros no se pueden mostrar con la información disponible.').count())
    emptyAttendance = true
    await visit('/alumnoWebSum/v2/asistencia')
    assert.ok(await page.getByText('No hay registros de asistencia.').count())
    expectedErrors = true
    for (const scenario of ['http', 'html']) {
      failure = scenario
      await page.goto(`${base}/alumnoWebSum/v2/inicio`)
      await page.getByRole('alert').waitFor()
      assert.ok((await page.getByRole('alert').innerText()).includes(scenario === 'http' ? 'HTTP 500' : 'no devolvió JSON'))
      assert.equal(await page.locator('.home-student').count(), 0)
      failure = null
      await page.getByRole('button', { name: 'Intentar de nuevo' }).click()
      await page.locator('.home-student').waitFor()
      assert.ok((await page.locator('.home-student').innerText()).includes(expectedName))
    }
    expectedErrors = false
  }
  await page.setViewportSize({ width: 1038, height: 711 })
  await visit('/alumnoWebSum/v2/inicio')
  assert.ok((await page.locator('.home-student').innerText()).includes(expectedName))
  assert.equal(await page.locator('.shortcut-card').count(), 8)
  const grid = await page.locator('.shortcut-grid').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)
  assert.equal(grid, 2)
  const homeCard = await page.locator('.shortcut-card').first().boundingBox()
  assert.ok(homeCard.y < 400, 'Overview must stay compact')
  await page.screenshot({ path: `${evidenceRoot}/home/candidate-reference-viewport.png` })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Ocultar menú' }).click()
  assert.equal(await page.locator('.shortcut-grid').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length), 1)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Home must not overflow horizontally')
  await page.screenshot({ path: `${evidenceRoot}/home/candidate-mobile.png`, fullPage: true })
  assert.equal(remote.length, 0, remote.join('\n'))
  assert.equal(forbiddenMockCalls.length, 0, forbiddenMockCalls.join('\n'))
  assert.equal(errors.length, 0, errors.join('\n'))
  const results = { mode: apiMode ? 'api-local' : 'mock', routes: routes.length,
    pageErrors: errors, consoleErrors, remoteRequests: remote, apiCalls,
    checks: ['16 direct routes', 'loaded identity', 'typed tables', 'form profile fields', 'SPA and history navigation',
      'read-only forms', 'CSV matches table', 'responsive bento', ...(apiMode ? ['12 intercepted API queries', 'unknown records', 'empty attendance', 'HTTP/HTML error and retry'] : ['no data requests'])] }
  await writeFile(`${evidenceRoot}/measurements.json`, JSON.stringify(measurements, null, 2))
  await writeFile(`${evidenceRoot}/check-results.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ mode: results.mode, routes: routes.length, checks: 'passed', apiQueries: new Set(apiCalls).size }, null, 2))
} finally {
  if (browser) await browser.close()
  server.kill()
}

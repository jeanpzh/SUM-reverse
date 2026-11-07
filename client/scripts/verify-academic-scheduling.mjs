// Synthetic local integration only. Starts dedicated processes, never attaches to existing servers.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../../', import.meta.url))
const apiPort = 3210
const webPort = 5176
const api = `http://127.0.0.1:${apiPort}`
const web = `http://127.0.0.1:${webPort}`
const route = '/local/programacion-academica'
const evidence = resolve(root, 'evidence/local/programacion-academica-demo')
const environment = { ...process.env }
for (const key of Object.keys(environment)) {
  if (key.endsWith('_SNAPSHOT_DIR') || key === 'DATABASE_URL') delete environment[key]
}
const children = []
let browser
const failures = []
async function waitFor(url, child) {
  const deadline = Date.now() + 45000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`El proceso local terminó: ${child.exitCode}`)
    try { if ((await fetch(url)).ok) return } catch { /* Startup in progress. */ }
    await new Promise((accept) => setTimeout(accept, 200))
  }
  throw new Error(`No arrancó el servicio sintético ${url}`)
}
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  child.on('error', (error) => failures.push(error.message))
  // Bounded output for diagnosis; no private environment or bodies are logged.
  child.stderr.on('data', (chunk) => { if (failures.length < 10) failures.push(chunk.toString().slice(0, 1000)) })
  child.stdout.on('data', () => {})
  children.push(child)
  return child
}
async function assertPortFree(port) {
  const { createServer } = await import('node:net')
  await new Promise((accept, reject) => {
    const server = createServer()
    server.once('error', () => reject(new Error(`Puerto ${port} ocupado: no se inspeccionará el servicio existente`)))
    server.listen(port, '127.0.0.1', () => server.close(accept))
  })
}

try {
  await assertPortFree(apiPort)
  await assertPortFree(webPort)
  const backend = start([resolve(root, 'backend/dist/programacion-academica/local-main.js')], resolve(root, 'backend'), {
    ...environment, SUM_ACADEMIC_SCHEDULING: '1', SUM_LOCAL_SCENARIOS: '0', SIMULATOR_DEPLOYMENT: 'local', PORT: String(apiPort),
  })
  await waitFor(`${api}/local/programacion-academica/v1/catalogo`, backend)
  const frontend = start([resolve(root, 'client/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], resolve(root, 'client'), {
    ...environment, VITE_SUM_DATA_MODE: 'local', VITE_SUM_API_BASE_URL: '/api', VITE_SUM_API_PROXY_TARGET: api,
    VITE_SUM_ACADEMIC_SCHEDULING: '1', VITE_SUM_SIMULATOR: '0', VITE_SUM_LOCAL_PROFILE: 'synthetic-actors',
  })
  await waitFor(`${web}${route}`, frontend)
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined), headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const jsErrors = []
  const externalRequests = []
  const apiRequests = []
  page.on('pageerror', (error) => jsErrors.push(error.message))
  page.on('request', (request) => {
    if (!request.url().startsWith(web) && !request.url().startsWith('data:')) externalRequests.push(request.url())
    if (request.url().includes('/api/')) apiRequests.push(new URL(request.url()).pathname)
  })
  await page.goto(`${web}${route}`)
  await page.getByRole('heading', { name: 'Programación académica asistida', exact: true }).waitFor()
  const catalogResponse = await fetch(`${api}/local/programacion-academica/v1/catalogo`)
  assert.equal(catalogResponse.status, 200)
  const catalog = await catalogResponse.json()
  assert.ok(catalog.courses.length > 32, 'el catálogo debe permitir comprobar el límite de selección')
  for (const course of catalog.courses.slice(0, 32)) await page.getByLabel(`Seleccionar ${course.courseId}`, { exact: true }).check()
  assert.equal(await page.locator('.academic-scheduling__selection input:checked').count(), 32)
  assert.equal(await page.getByLabel(`Seleccionar ${catalog.courses[32].courseId}`).isDisabled(), true)
  for (const course of catalog.courses.slice(0, 32)) await page.getByLabel(`Seleccionar ${course.courseId}`, { exact: true }).uncheck()
  const firstCycleCourse = catalog.courses.find((course) => course.cycle !== undefined) ?? catalog.courses[0]
  const chosen = [firstCycleCourse, catalog.courses.find((course) => course.cycle !== undefined && course.cycle !== firstCycleCourse.cycle)
    ?? catalog.courses.find((course) => course.courseId !== firstCycleCourse.courseId)]
  assert.equal(chosen.length, 2, 'el catálogo sintético debe incluir dos cursos')
  if (chosen[0].cycle !== undefined && chosen[1].cycle !== undefined) assert.notEqual(chosen[0].cycle, chosen[1].cycle)
  if (chosen[0].cycle !== undefined) await page.getByLabel('Filtrar cursos por ciclo').selectOption(String(chosen[0].cycle))
  for (const course of chosen.slice(0, 1)) {
    await page.getByLabel(`Seleccionar ${course.courseId}`, { exact: true }).check()
  }
  if (chosen[1].cycle !== undefined) await page.getByLabel('Filtrar cursos por ciclo').selectOption(String(chosen[1].cycle))
  assert.equal(await page.locator('.academic-scheduling__selection input:checked').count(), 0, 'el curso seleccionado de otro ciclo está oculto')
  for (const course of chosen.slice(1)) await page.getByLabel(`Seleccionar ${course.courseId}`, { exact: true }).check()
  await page.getByLabel('Filtrar cursos por ciclo').selectOption('all')
  assert.equal(await page.locator('.academic-scheduling__selection input:checked').count(), 2)
  for (const course of chosen) {
    await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).fill(course === chosen[0] ? '31' : '20')
    await page.getByLabel(`Capacidad ${course.courseId}`, { exact: true }).fill('30')
    if (course.planningPatterns?.length) {
      const pattern = page.getByLabel(`Patrón ${course.courseId}`)
      assert.equal(await pattern.inputValue(), course.planningPatterns[0].id)
      if (course.planningPatterns.length > 1) {
        await pattern.selectOption(course.planningPatterns[1].id)
        assert.equal(await pattern.inputValue(), course.planningPatterns[1].id)
        await pattern.selectOption(course.planningPatterns[0].id)
      }
    }
    if (course.history?.sections.length) {
      const details = page.locator('.academic-scheduling__course').filter({ hasText: course.courseId }).locator('details')
      await details.locator('summary').click()
      assert.equal(await details.locator('ul li').count(), course.history.sections.reduce((sum, section) => sum + section.sessions.length, 0))
    }
  }
  // Keep one named reference teacher qualified for selected courses and preserve the authorized synthetic name.
  for (const teacher of catalog.teachers) await page.getByLabel(`Quitar docente ${teacher.name}`, { exact: true }).click()
  const reference = catalog.referenceTeachers?.[0]
  assert.ok(reference, 'el catálogo incluye docentes de referencia sintéticos con nombre')
  await page.getByLabel('Seleccionar o agregar docente').selectOption(reference.id)
  assert.equal(await page.locator('.academic-scheduling__resource-card--teacher').count(), 1, 'se muestra un solo formulario docente activo')
  await page.getByLabel('Identificación docente').fill('DOC-LOCAL-COMPARTIDO')
  await page.getByLabel('Carga semanal docente').fill('1800')
  await page.getByLabel('Disponibilidad docente fin 1', { exact: true }).fill('18:00')
  for (const course of catalog.courses) {
    const eligibility = page.getByLabel(`${reference.name} habilitado para ${course.courseId}`, { exact: true })
    if (!(await eligibility.isChecked())) await eligibility.check()
  }
  await page.getByLabel('Buscar asignatura habilitada').fill(catalog.courses[0].courseId)
  assert.equal(await page.locator('.academic-scheduling__course-options label').count(), 1, 'la búsqueda filtra por código')
  await page.getByLabel('Buscar asignatura habilitada').fill('')
  await page.getByLabel(`Máximo de secciones ${catalog.courses[0].courseId}`).fill('4')
  const preferences = page.locator('fieldset').filter({ has: page.locator('legend', { hasText: 'Preferencias semanales' }) })
  await preferences.getByRole('button', { name: 'Agregar intervalo' }).click()
  await page.getByLabel('Preferencias semanales · prioridad blanda inicio 1', { exact: true }).fill('08:00')
  await page.getByLabel('Preferencias semanales · prioridad blanda fin 1', { exact: true }).fill('12:00')
  await page.getByLabel('Criterio de asignación').selectOption('balanced')
  for (const room of catalog.rooms) await page.getByLabel(`Quitar ambiente ${room.name}`, { exact: true }).click()
  await page.getByRole('button', { name: 'Agregar laboratorio', exact: true }).click()
  await page.getByLabel('Identificación ambiente').fill('LAB-DEMO-1')
  await page.getByLabel('Nombre ambiente').fill('Laboratorio sintético')
  await page.getByLabel('Capacidad ambiente').fill('40')
  await page.getByLabel('Disponibilidad del ambiente fin 1', { exact: true }).fill('18:00')
  await page.getByRole('button', { name: 'Agregar aula', exact: true }).click()
  await page.getByLabel('Capacidad ambiente').fill('40')
  await page.getByLabel('Disponibilidad del ambiente fin 1', { exact: true }).fill('18:00')
  const patternCourse = catalog.courses.find((course) => course.planningPatterns?.length > 1)
  const plannedCourses = patternCourse && !chosen.some((course) => course.courseId === patternCourse.courseId)
    ? [...chosen, patternCourse] : chosen
  if (patternCourse && !chosen.some((course) => course.courseId === patternCourse.courseId)) {
    await page.getByLabel(`Seleccionar ${patternCourse.courseId}`, { exact: true }).check()
    await page.getByLabel(`Demanda ${patternCourse.courseId}`, { exact: true }).fill('1')
    await page.getByLabel(`Capacidad ${patternCourse.courseId}`, { exact: true }).fill('30')
  }
  assert.equal(new URL(page.url()).pathname, route)
  const stage = async (name, etapa) => {
    await page.getByRole('navigation', { name: 'Etapas de programación', exact: true }).getByRole('link', { name, exact: true }).click()
    await page.waitForURL(new RegExp(`etapa=${etapa}$`))
  }
  let lastRequest
  const generate = async () => {
    await stage('Preparación', 'preparacion')
    const response = page.waitForResponse((res) => res.url().endsWith('/propuestas') && res.request().method() === 'POST')
    await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
    const received = await response
    assert.equal(received.status(), 200)
    lastRequest = received.request().postDataJSON()
    await stage('Horario', 'horario')
    return received.json()
  }
  const first = await generate()
  assert.equal(lastRequest.resources.teachers[0].name, reference.name)
  assert.ok(first.assignments.some((assignment) => assignment.teacherId === 'DOC-LOCAL-COMPARTIDO' && assignment.teacherName === reference.name))
  assert.equal(lastRequest.resources.teachers[0].courseIds.includes(chosen[0].courseId), true)
  assert.equal(lastRequest.resources.rooms.some((room) => room.kind === 'laboratory' && room.name === 'Laboratorio sintético'), true)
  assert.equal(first.status, 'complete')
  assert.equal(first.counts.sections, plannedCourses.length + 1)
  assert.equal(first.counts.scheduledSessions, first.counts.requiredSessions)
  assert.ok(first.counts.requiredSessions > first.counts.sections)
  const sharedTeacherAssignments = first.assignments.filter((assignment) => assignment.teacherId === 'DOC-LOCAL-COMPARTIDO')
  for (let index = 0; index < sharedTeacherAssignments.length; index += 1) for (let other = index + 1; other < sharedTeacherAssignments.length; other += 1) {
    const left = sharedTeacherAssignments[index]
    const right = sharedTeacherAssignments[other]
    if (left.day === right.day) assert.ok(left.endMinute <= right.startMinute || right.endMinute <= left.startMinute, 'el docente compartido no tiene cruces')
  }
  assert.ok(sharedTeacherAssignments.length > 0, 'la propuesta asigna al docente compartido por nombre')
  await page.getByRole('status').filter({ hasText: 'complete' }).waitFor()
  const calendar = page.getByRole('region', { name: 'Calendario semanal con horas; desplázate horizontalmente para ver todos los días' })
  await calendar.waitFor()
  assert.ok((await page.getByRole('table').allTextContents()).join(' ').includes(reference.name))
  assert.ok((await calendar.innerText()).includes(reference.name))
  await mkdir(evidence, { recursive: true })
  await page.locator('.academic-scheduling__result').scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(evidence, 'complete.png') })
  const variableCourse = chosen.find((course) => course.planningPatterns?.length > 1)
  const changeablePatternCourse = variableCourse ?? patternCourse
  if (changeablePatternCourse) {
    await stage('Preparación', 'preparacion')
    const pattern = page.getByLabel(`Patrón ${changeablePatternCourse.courseId}`)
    await pattern.selectOption(changeablePatternCourse.planningPatterns[1].id)
    assert.equal(await page.locator('.academic-scheduling__result').count(), 0, 'cambiar patrón invalida la propuesta visible')
    const patterned = await generate()
    assert.equal(patterned.status, 'complete')
    assert.notEqual(patterned.proposalId, first.proposalId)
  }
  const retained = await (await fetch(`${api}/local/programacion-academica/v1/propuestas/${first.proposalId}`)).json()
  assert.deepEqual(retained, first)

  await stage('Preparación', 'preparacion')
  for (const course of plannedCourses) await page.getByLabel(`Seleccionar ${course.courseId}`, { exact: true }).uncheck()
  const empty = await generate()
  assert.equal(empty.status, 'complete')
  assert.equal(empty.counts.requiredSessions, 0)
  assert.equal(empty.assignments.length, 0)

  await stage('Preparación', 'preparacion')
  for (const course of plannedCourses) await page.getByLabel(`Seleccionar ${course.courseId}`, { exact: true }).check()
  await page.getByLabel(`Demanda ${chosen[0].courseId}`, { exact: true }).fill('1')
  await page.getByLabel(`Capacidad ${chosen[0].courseId}`, { exact: true }).fill('41')
  await page.getByLabel(`Demanda ${chosen[1].courseId}`, { exact: true }).fill('20')
  const impossible = await generate()
  assert.equal(impossible.status, 'impossible')
  assert.ok(impossible.pending.length > 0)
  await page.getByRole('status').filter({ hasText: 'impossible' }).waitFor()
  await page.getByRole('heading', { name: 'Componentes pendientes', exact: true }).waitFor()
  await page.locator('.academic-scheduling__result').scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(evidence, 'impossible.png') })

  await stage('Preparación', 'preparacion')
  await page.getByLabel(`Demanda ${chosen[0].courseId}`, { exact: true }).fill('100000')
  const invalid = await generate()
  assert.equal(invalid.status, 'invalid-input')
  await page.getByRole('status').filter({ hasText: 'invalid-input' }).waitFor()
  assert.ok(invalid.diagnostics.length)
  await page.locator('.academic-scheduling__result').scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(evidence, 'invalid-input.png') })

  await stage('Preparación', 'preparacion')
  await page.getByLabel(`Demanda ${chosen[0].courseId}`, { exact: true }).fill('31')
  await page.getByLabel(`Demanda ${chosen[1].courseId}`, { exact: true }).fill('20')
  await page.getByLabel(`Capacidad ${chosen[0].courseId}`, { exact: true }).fill('31')
  const restored = await generate()
  assert.equal(restored.status, 'complete')
  assert.notEqual(restored.proposalId, first.proposalId)
  assert.deepEqual(await (await fetch(`${api}/local/programacion-academica/v1/propuestas/${first.proposalId}`)).json(), first)

  // API error and UI recovery, without mocking generator responses.
  await stage('Preparación', 'preparacion')
  await page.route('**/api/local/programacion-academica/v1/propuestas', (request) => request.abort())
  await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
  await page.getByRole('alert').waitFor()
  await page.unroute('**/api/local/programacion-academica/v1/propuestas')
  assert.equal((await generate()).status, 'complete')
  assert.deepEqual(jsErrors, [])
  assert.deepEqual(externalRequests, [])
  assert.ok(apiRequests.every((path) => path.startsWith('/api/local/programacion-academica/v1/')))

  // Exact local route exception must not bypass the student's session guard.
  await page.goto(`${web}/alumnoWebSum/v2/inicio`)
  await page.waitForURL('**/local/login')
  await writeFile(resolve(evidence, 'result.json'), JSON.stringify({ source: 'local-only independently constructed synthetic data',
    route, viewport: { width: 1440, height: 1000 }, first: { status: first.status, counts: first.counts },
    empty: { status: empty.status, counts: empty.counts }, invalid: { status: invalid.status },
    impossible: { status: impossible.status, counts: impossible.counts },
    recovery: 'passed', originalAuthorityRetained: true, studentGuardPreserved: true, jsErrors, externalRequests,
    apiRequests, date: new Date().toISOString() }, null, 2))
  console.log('PASS: React → API → generator; edit/regenerate, zero demand, invalid-input, authority retention, network recovery and student guard')
} finally {
  await browser?.close()
  for (const child of children.reverse()) child.kill()
  if (failures.length) console.log('Local process diagnostics:', failures.join('\n').slice(0, 2000))
}

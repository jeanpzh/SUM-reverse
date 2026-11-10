// Run only against our freshly built, independently synthetic Compose acceptance project.
import assert from 'node:assert/strict'
import { setPlanningCheckbox } from './planning-checkboxes.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

if (process.env.SUM_ACADEMIC_COMPOSE_SYNTHETIC !== '1') throw new Error('Se requiere una instancia propia explícitamente sintética')
const url = new URL(process.env.SUM_ACADEMIC_COMPOSE_BASE || 'http://127.0.0.1:5280')
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Base local sin rutas ni credenciales requerida')
const base = url.origin
const output = resolve(fileURLToPath(new URL('../../', import.meta.url)), 'evidence/local/programacion-academica-erp')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) })
const errors = [], external = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { if (!request.url().startsWith(`${base}/`) && !request.url().startsWith('data:')) external.push(request.url()) })
  const read = async (path) => {
    const response = await page.request.get(`${base}/api${path}`)
    assert.equal(response.status(), 200)
    return response.json()
  }
  const beforeOffer = (await read('/local/matricula-regular/v1/contextos/SYN-SIS-A')).data.offer
  const catalog = await read('/local/programacion-academica/v1/catalogo')
  const course = catalog.courses.find((row) => row.courseId === '20118104')
  assert.ok(course)
  const pattern = course.planningPatterns.find((row) => row.weeklySessions.length === 2 && row.weeklySessions.every((session) => session.durationMinutes === 120))
  assert.ok(pattern)
  const teachers = catalog.referenceTeachers.slice(0, 2)
  const teacherForm = page.locator('.academic-scheduling__resource-card--teacher')
  const roomForm = page.locator('.academic-scheduling__resource-card--room')
  const preferenceLabel = 'Preferencias semanales · prioridad blanda'
  const setIntervals = async (label, days) => {
    const group = page.getByRole('group', { name: new RegExp(`^${label}`) })
    while (await group.getByRole('button', { name: new RegExp(`^Quitar ${label} intervalo`) }).count()) {
      await group.getByRole('button', { name: new RegExp(`^Quitar ${label} intervalo`) }).first().click()
    }
    for (const [index, day] of days.entries()) {
      await group.getByRole('button', { name: 'Agregar intervalo', exact: true }).click()
      await page.getByLabel(`${label} día ${index + 1}`, { exact: true }).selectOption(String(day))
      await page.getByLabel(`${label} inicio ${index + 1}`, { exact: true }).fill('18:00')
      await page.getByLabel(`${label} fin ${index + 1}`, { exact: true }).fill('22:00')
    }
  }
  const generate = async () => {
    const pending = page.waitForResponse((response) => response.url().endsWith('/propuestas') && response.request().method() === 'POST')
    await page.locator('#planning-tour-primary').click()
    const response = await pending
    assert.equal(response.status(), 200, await response.text())
    const value = await response.json()
    await page.locator(`.planning-status-bar[data-status="${value.status}"]`).waitFor()
    return value
  }
  await page.goto(`${base}/local/programacion-academica`)
  await page.getByLabel('Filtrar cursos por ciclo').selectOption('10')
  await setPlanningCheckbox(page.getByRole('checkbox', { name: `Seleccionar ${course.courseId}`, exact: true }))
  await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).fill('180')
  await page.getByLabel(`Capacidad ${course.courseId}`, { exact: true }).fill('45')
  await page.getByLabel(`Patrón ${course.courseId}`).selectOption(pattern.id)
  assert.equal(await page.getByLabel(`Modalidad de sesiones ${course.courseId}`).inputValue(), 'continuous')
  while (await teacherForm.count()) await teacherForm.getByRole('button', { name: /^Quitar docente / }).click()
  while (await roomForm.count()) await roomForm.getByRole('button', { name: /^Quitar ambiente / }).click()
  for (const [index, teacher] of teachers.entries()) {
    await page.getByLabel('Seleccionar o agregar docente').selectOption(teacher.id)
    assert.equal(await teacherForm.count(), 1)
    assert.equal(await page.getByLabel('Nombre docente', { exact: true }).inputValue(), teacher.name)
    await page.getByLabel('Carga semanal docente', { exact: true }).fill('480')
    await page.getByLabel('Buscar asignatura habilitada').fill(course.courseId)
    await setPlanningCheckbox(page.getByRole('checkbox', { name: `${teacher.name} habilitado para ${course.courseId}`, exact: true }))
    await page.getByLabel(`Máximo de secciones ${course.courseId}`, { exact: true }).fill('2')
    await setIntervals('Disponibilidad docente', [1, 2, 3, 4])
    await setIntervals(preferenceLabel, index === 0 ? [1, 2] : [3, 4])
  }
  await page.getByLabel('Seleccionar o agregar docente').selectOption(teachers[0].id)
  assert.equal(await page.getByLabel('Carga semanal docente', { exact: true }).inputValue(), '480')
  assert.equal(await page.getByLabel(`Máximo de secciones ${course.courseId}`, { exact: true }).inputValue(), '2')
  assert.equal(await page.getByRole('group', { name: new RegExp(`^${preferenceLabel}`) }).getByRole('combobox').count(), 2)
  assert.equal(await page.locator('[aria-label="Docentes incorporados"]').getByRole('button').count(), 2)
  await page.getByLabel('Identificación docente', { exact: true }).fill(teachers[1].id)
  assert.equal(await page.getByLabel('Identificación docente', { exact: true }).inputValue(), teachers[0].id)
  await teacherForm.getByRole('alert').waitFor()
  await page.getByLabel('Identificación docente', { exact: true }).fill(teachers[0].id)
  for (const roomId of ['101AP', 'LAB01NP']) {
    await page.getByLabel('Seleccionar o agregar ambiente').selectOption(roomId)
    assert.equal(await roomForm.count(), 1)
    assert.equal(await page.getByLabel('Capacidad ambiente', { exact: true }).inputValue(), '45')
    await setIntervals('Disponibilidad del ambiente', [1, 2, 3, 4])
  }
  await page.getByLabel('Seleccionar o agregar ambiente').selectOption('101AP')
  assert.equal(await page.getByLabel('Disponibilidad del ambiente fin 4', { exact: true }).inputValue(), '22:00')
  await page.getByLabel('Identificación ambiente', { exact: true }).fill('LAB01NP')
  assert.equal(await page.getByLabel('Identificación ambiente', { exact: true }).inputValue(), '101AP')
  await roomForm.getByRole('alert').waitFor()
  await page.getByLabel('Identificación ambiente', { exact: true }).fill('101AP')
  const complete = await generate()
  assert.equal(complete.status, 'complete')
  assert.deepEqual(complete.counts, { sections: 4, requiredSessions: 8, scheduledSessions: 8 })
  assert.equal(complete.preferenceReport.withinPreferenceSections, 4)
  for (const teacher of teachers) assert.equal(new Set(complete.assignments.filter((row) => row.teacherId === teacher.id).map((row) => row.sectionId)).size, 2)
  const table = page.getByRole('region', { name: 'Programación generada', exact: true })
  assert.equal(await table.locator('tbody tr').count(), 4)
  assert.ok((await table.innerText()).includes('120 min'))
  assert.ok((await table.innerText()).includes('18:00–22:00'))
  assert.ok(complete.assignments.every((assignment) => assignment.endMinute - assignment.startMinute === 120))
  const calendar = page.getByRole('region', { name: 'Calendario semanal con horas; desplázate horizontalmente para ver todos los días', exact: true })
  assert.equal(await calendar.locator('.weekly-schedule__event').count(), 4)
  await calendar.scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, 'erp-complete-calendar.png') })
  await page.getByLabel('Seleccionar o agregar docente').selectOption(teachers[1].id)
  await teacherForm.getByRole('button', { name: /^Quitar docente / }).click()
  assert.equal(await page.locator('.planning-status-bar').count(), 0)
  const insufficient = await generate()
  assert.equal(insufficient.status, 'impossible')
  assert.equal(insufficient.coverageComplete, false)
  assert.equal(insufficient.counts.sections, 4)
  assert.ok(insufficient.counts.scheduledSessions < 8)
  assert.ok(insufficient.diagnostics.every((row) => row.code !== 'SEARCH_LIMIT'))
  assert.equal(await calendar.locator('.weekly-schedule__event').count(), insufficient.counts.scheduledSessions / 2)
  await page.locator('.planning-status-bar').scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, 'erp-insufficient.png') })
  await page.getByLabel('Carga semanal docente', { exact: true }).fill('960')
  await page.getByLabel(`Máximo de secciones ${course.courseId}`, { exact: true }).fill('4')
  const oneTeacher = await generate()
  assert.equal(oneTeacher.status, 'complete')
  assert.equal(new Set(oneTeacher.assignments.map((row) => row.teacherId)).size, 1)
  assert.equal(oneTeacher.preferenceReport.outsidePreferenceSections, 2)
  assert.ok(oneTeacher.diagnostics.some((row) => row.code === 'PREFERENCES_NOT_MET'))
  assert.equal(await calendar.locator('.weekly-schedule__event').count(), 4)
  assert.deepEqual(await read(`/local/programacion-academica/v1/propuestas/${complete.proposalId}`), complete)
  assert.deepEqual((await read('/local/matricula-regular/v1/contextos/SYN-SIS-A')).data.offer, beforeOffer)
  assert.deepEqual(errors, [])
  assert.deepEqual(external, [])
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ date: new Date().toISOString(), base, source: 'own synthetic Compose project',
    courseId: course.courseId, demand: 180, capacity: 45, complete: complete.counts,
    insufficient: { status: insufficient.status, counts: insufficient.counts, diagnostics: insufficient.diagnostics.map((row) => row.code) },
    oneTeacher: { counts: oneTeacher.counts, preferences: oneTeacher.preferenceReport }, compactEditors: true, retainedConfiguration: true,
    duplicatePrevention: true, blocksInCalendar: 4, unchangedEnrollmentOffer: true, errors, external }, null, 2))
  console.log('PASS ERP180: compact editors, retained state, limits, preferred two-teacher solution, insufficient resources, one-teacher fallback, 4 blocks/8 components and unchanged enrollment offer')
} finally {
  await browser.close()
}

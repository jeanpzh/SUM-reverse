// Browser verification for the independently synthetic Compose project only.
import assert from 'node:assert/strict'
import { setPlanningCheckbox } from './planning-checkboxes.mjs'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

if (process.env.SUM_ACADEMIC_COMPOSE_SYNTHETIC !== '1') throw new Error('Se requiere la confirmación SUM_ACADEMIC_COMPOSE_SYNTHETIC=1 para la instancia propia sintética')
const url = new URL(process.env.SUM_ACADEMIC_COMPOSE_BASE || 'http://127.0.0.1:5280')
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Solo se admite la instancia sintética loopback en la raíz')
const base = url.origin
const root = fileURLToPath(new URL('../../', import.meta.url))
const output = resolve(root, 'evidence/local/programacion-academica-demand')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) })
const errors = []
const external = []

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (!request.url().startsWith(`${base}/`) && !request.url().startsWith('data:')) external.push(request.url())
  })
  const read = async (path) => {
    const response = await page.request.get(`${base}/api${path}`)
    assert.equal(response.status(), 200, `GET ${path}`)
    return response.json()
  }
  const beforeOffer = (await read('/local/matricula-regular/v1/contextos/SYN-SIS-A')).data.offer
  const catalog = await read('/local/programacion-academica/v1/catalogo')
  const course = catalog.courses.find((row) => row.courseId === '20118104')
  assert.ok(course, 'el catálogo sintético incluye ERP 20118104')
  const pattern = course.planningPatterns?.find((row) => row.weeklySessions.length === 2
    && row.weeklySessions.every((session) => session.durationMinutes === 120))
  assert.ok(pattern, 'ERP tiene el patrón sintético configurado de dos sesiones de 120 min')
  const teachers = catalog.referenceTeachers.slice(0, 2)
  assert.equal(teachers.length, 2)
  await page.goto(`${base}/local/modulos`)
  await page.getByRole('link', { name: /^Escuela · Programación académica/ }).click()
  await page.getByRole('heading', { name: 'Seleccionar cursos', exact: true }).waitFor()
  await page.getByLabel('Filtrar cursos por ciclo').selectOption(String(course.cycle ?? 'all'))
  await setPlanningCheckbox(page.getByRole('checkbox', { name: `Seleccionar ${course.courseId}`, exact: true }))
  await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).fill('180')
  await page.getByLabel(`Capacidad ${course.courseId}`, { exact: true }).fill('45')
  await page.getByLabel(`Patrón ${course.courseId}`).selectOption(pattern.id)
  assert.equal(await page.getByText('Secciones finales sugeridas').count(), 1)
  assert.equal(await page.locator('.academic-demand__course').getByText('4', { exact: true }).count(), 1)
  assert.equal(await page.locator('.academic-demand').getByText(/SYN-SIS-[AB]/).count(), 0, 'el panel no expone identidades')

  const estimate = async (sourceId) => {
    await page.getByLabel('Fuente de demanda potencial').selectOption(sourceId)
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/demanda/estimar')
      && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Estimar demanda potencial', exact: true }).click()
    const response = await responsePromise
    assert.equal(response.status(), 200, await response.text())
    return { body: response.request().postDataJSON(), result: await response.json() }
  }
  const regular = await estimate('existing-regular-v1')
  assert.deepEqual(Object.keys(regular.body).sort(), ['courses', 'revision', 'sourceId', 'targetPeriod'])
  assert.deepEqual(regular.body.courses, [{ courseId: course.courseId, targetCapacity: 45 }])
  assert.equal(regular.result.source.id, 'existing-regular-v1')
  assert.equal(regular.result.source.populationSize, 2)
  assert.equal(regular.result.source.recordCount, 2)
  assert.equal(regular.result.source.duplicateRecords, 0)
  assert.equal(JSON.stringify(regular.result).toLowerCase().includes('student'), false)
  const regularRow = regular.result.rows[0]
  assert.equal(regularRow.eligible, 0)
  assert.equal(regularRow.baseDemand, 0)
  assert.equal(regularRow.insufficient, 0)
  assert.equal(await page.getByLabel(`Demanda ${course.courseId}`).inputValue(), '180', 'la estimación conserva el valor final manual')
  assert.equal(await page.locator('.academic-demand__course').getByRole('button', { name: 'Usar base para este curso' }).isEnabled(), true)
  await page.locator('.academic-demand__course').getByRole('button', { name: 'Usar base para este curso' }).click()
  assert.equal(await page.getByLabel(`Demanda ${course.courseId}`).inputValue(), '0', 'la base solo se aplica por acción explícita')
  await page.getByLabel(`Demanda ${course.courseId}`).fill('180')
  assert.equal(await page.locator('.academic-demand__source').count(), 1, 'editar el valor final manual conserva la base')

  const independent = await estimate('independent-120-v1')
  assert.equal(independent.result.source.id, 'independent-120-v1')
  assert.equal(independent.result.source.populationSize, 120)
  assert.equal(independent.result.source.recordCount, 132)
  assert.equal(independent.result.source.duplicateRecords, 12)
  assert.equal(JSON.stringify(independent.result).toLowerCase().includes('student'), false)
  const independentRow = independent.result.rows[0]
  assert.deepEqual([independentRow.eligible, independentRow.retakeEligible, independentRow.nonEligible, independentRow.insufficient], [60, 24, 36, 24])
  assert.equal(await page.getByLabel(`Demanda ${course.courseId}`).inputValue(), '180', 'reestimar con otra fuente no pisa la demanda manual')
  assert.equal(await page.locator('.academic-demand__course').getByRole('button', { name: 'Usar base para este curso' }).isDisabled(), true,
    'datos insuficientes deshabilitan adoptar la base')
  assert.match(await page.locator('.academic-demand__course').innerText(), /No se interpretan como cero/)

  // A real request is held briefly while the input changes; the now-obsolete
  // result must not return after the capacity change clears the estimate.
  let delayedOnce = false
  await page.route('**/api/local/programacion-academica/v1/demanda/estimar', async (route) => {
    if (!delayedOnce) { delayedOnce = true; await new Promise((resolveDelay) => setTimeout(resolveDelay, 500)) }
    await route.continue()
  })
  await page.getByRole('button', { name: 'Estimar demanda potencial', exact: true }).click()
  await page.getByLabel(`Capacidad ${course.courseId}`, { exact: true }).fill('30')
  await page.waitForTimeout(650)
  assert.equal(await page.locator('.academic-demand__source').count(), 0, 'una respuesta anterior no restaura una estimación obsoleta')
  assert.equal(await page.getByLabel(`Demanda ${course.courseId}`).inputValue(), '180')
  assert.equal(await page.locator('.academic-demand__course').getByText('6', { exact: true }).count(), 1, 'la previsualización final actualiza ceil(180/30)')
  await page.unroute('**/api/local/programacion-academica/v1/demanda/estimar')
  await page.getByLabel(`Capacidad ${course.courseId}`, { exact: true }).fill('45')
  assert.equal(await page.locator('.academic-demand__course').getByText('4', { exact: true }).count(), 1)
  const refreshed = await estimate('independent-120-v1')
  assert.equal(refreshed.result.rows[0].targetCapacity, 45)

  while (await page.locator('.academic-scheduling__resource-card--teacher').count()) {
    await page.locator('.academic-scheduling__resource-card--teacher').getByRole('button', { name: /^Quitar docente/ }).click()
  }
  while (await page.locator('.academic-scheduling__resource-card--room').count()) {
    await page.locator('.academic-scheduling__resource-card--room').getByRole('button', { name: /^Quitar ambiente/ }).click()
  }
  for (const teacher of teachers) {
    await page.getByLabel('Seleccionar o agregar docente').selectOption(teacher.id)
    await page.getByLabel('Carga semanal docente', { exact: true }).fill('480')
    await page.getByLabel('Buscar asignatura habilitada').fill(course.courseId)
    const enabled = page.getByRole('checkbox', { name: `${teacher.name} habilitado para ${course.courseId}`, exact: true })
    await setPlanningCheckbox(enabled)
    await page.getByLabel(`Máximo de secciones ${course.courseId}`).fill('2')
    const availability = page.getByRole('group', { name: /^Disponibilidad docente/ })
    while (await availability.getByRole('button', { name: /^Quitar Disponibilidad docente intervalo/ }).count()) {
      await availability.getByRole('button', { name: /^Quitar Disponibilidad docente intervalo/ }).first().click()
    }
    for (const [interval, day] of [1, 2, 3, 4].entries()) {
      await availability.getByRole('button', { name: 'Agregar intervalo', exact: true }).click()
      await page.getByLabel(`Disponibilidad docente día ${interval + 1}`).selectOption(String(day))
      await page.getByLabel(`Disponibilidad docente inicio ${interval + 1}`).fill('18:00')
      await page.getByLabel(`Disponibilidad docente fin ${interval + 1}`).fill('22:00')
    }
  }
  for (const roomId of ['101AP', 'LAB01NP']) {
    await page.getByLabel('Seleccionar o agregar ambiente').selectOption(roomId)
    const availability = page.getByRole('group', { name: /^Disponibilidad del ambiente/ })
    while (await availability.getByRole('button', { name: /^Quitar Disponibilidad del ambiente intervalo/ }).count()) {
      await availability.getByRole('button', { name: /^Quitar Disponibilidad del ambiente intervalo/ }).first().click()
    }
    for (const [interval, day] of [1, 2, 3, 4].entries()) {
      await availability.getByRole('button', { name: 'Agregar intervalo', exact: true }).click()
      await page.getByLabel(`Disponibilidad del ambiente día ${interval + 1}`).selectOption(String(day))
      await page.getByLabel(`Disponibilidad del ambiente inicio ${interval + 1}`).fill('18:00')
      await page.getByLabel(`Disponibilidad del ambiente fin ${interval + 1}`).fill('22:00')
    }
  }
  const proposalResponse = page.waitForResponse((response) => response.url().endsWith('/propuestas')
    && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
  const generated = await proposalResponse
  assert.equal(generated.status(), 200, await generated.text())
  const generatedBody = generated.request().postDataJSON()
  assert.deepEqual(generatedBody.demands.map(({ courseId, estimatedDemand, targetCapacity }) => ({ courseId, estimatedDemand, targetCapacity })),
    [{ courseId: course.courseId, estimatedDemand: 180, targetCapacity: 45 }])
  const proposal = await generated.json()
  assert.equal(proposal.status, 'complete', 'los recursos sintéticos declarados deben completar las cuatro secciones')
  assert.equal(proposal.counts.scheduledSessions, 8)
  assert.equal(proposal.sections.filter((section) => section.courseId === course.courseId).length, 4,
    'el generador usa la demanda final manual 180 con capacidad 45')
  assert.deepEqual((await read('/local/matricula-regular/v1/contextos/SYN-SIS-A')).data.offer, beforeOffer,
    'estimar y generar no altera la oferta de matrícula')
  assert.deepEqual(await page.locator('.academic-demand').getByText(/SYN-SIS-[AB]/).count(), 0)
  await page.locator('.academic-demand').screenshot({ path: resolve(output, 'academic-demand-panel.png') })
  assert.deepEqual(errors, [])
  assert.deepEqual(external, [])
  await writeFile(resolve(output, 'result.json'), JSON.stringify({
    date: new Date().toISOString(), source: 'own independently synthetic Docker Compose acceptance project',
    regular: regular.result, independent: independent.result,
    manualDemandPreserved: true, staleEstimateDiscarded: true, adoptionWithUnknownDisabled: true,
    generated: { status: proposal.status, counts: proposal.counts, finalDemand: 180, targetCapacity: 45 },
    unchangedEnrollmentOffer: true, errors, external,
  }, null, 2))
  console.log('PASS demanda potencial: agregados, deduplicación, base separada de demanda manual, respuesta obsoleta descartada, generador completo y oferta intacta')
  await context.close()
} finally {
  await browser.close()
}

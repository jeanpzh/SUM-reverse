// Two-phase browser acceptance against the dedicated, explicitly synthetic 5280 service only.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

if (process.env.SUM_ACADEMIC_TEACHER_REVIEW_SYNTHETIC !== '1') throw new Error('Se requiere una instancia propia explícitamente sintética')
const url = new URL(process.env.SUM_ACADEMIC_TEACHER_REVIEW_BASE || 'http://127.0.0.1:5280')
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== '5280' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
  throw new Error('El verificador solo acepta la instancia sintética propia en 127.0.0.1:5280')
}
const phase = process.argv.find((arg) => arg.startsWith('--phase='))?.split('=')[1]
if (!['save', 'resume'].includes(phase)) throw new Error('Uso: node scripts/verify-academic-teacher-review.mjs --phase=save|resume')
const base = url.origin
const root = fileURLToPath(new URL('../../', import.meta.url))
const evidenceDir = resolve(root, 'evidence/local/programacion-academica-teacher-review')
const statePath = resolve(evidenceDir, 'synthetic-review.json')
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) })
const errors = []
const json = async (response) => {
  assert.equal(response.status(), 200, await response.text())
  return response.json()
}
try {
  await mkdir(evidenceDir, { recursive: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => assert.ok(request.url().startsWith(`${base}/`) || request.url().startsWith('data:'), `Solicitud externa inesperada: ${request.url()}`))
  await page.goto(`${base}/local/programacion-academica`)
  await page.getByRole('heading', { name: 'Programación académica asistida', exact: true }).waitFor()
  const api = `${base}/api/local/programacion-academica/v1`
  const readOffer = async () => {
    const response = await page.request.get(`${base}/api/local/matricula-regular/v1/contextos/SYN-SIS-A`)
    assert.equal(response.status(), 200, await response.text())
    return (await response.json()).data.offer
  }
  const offerBefore = await readOffer()

  if (phase === 'save') {
    const catalog = await (await page.request.get(`${api}/catalogo`)).json()
    const course = catalog.courses.find((item) => item.planningPatterns?.[0]?.weeklySessions.length
      && catalog.teachers.some((teacher) => teacher.courseIds.includes(item.courseId))
      && catalog.rooms.some((room) => room.capacity >= item.targetCapacity))
    assert.ok(course, 'El catálogo debe ofrecer un curso sintético programable')
    await page.getByLabel(`Seleccionar ${course.courseId}`, { exact: true }).check()
    await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).fill('1')
    const generation = page.waitForResponse((response) => response.url().endsWith('/propuestas') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
    const proposal = await json(await generation)
    assert.equal(proposal.status, 'complete')
    assert.ok(proposal.assignments.length)
    const title = `Revisión docente E1 sintética ${Date.now()}`
    await page.getByLabel('Nombre de la propuesta', { exact: true }).fill(title)
    const save = page.waitForResponse((response) => response.url().endsWith('/borradores/guardar') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Guardar propuesta', exact: true }).click()
    const saveResponse = await save
    const saved = await json(saveResponse)
    assert.equal(saved.state, 'draft')
    assert.equal(Object.hasOwn(saveResponse.request().postDataJSON(), 'review'), false)

    await page.locator('.academic-teacher-review > summary').click()
    const submit = page.waitForResponse((response) => response.url().endsWith(`/borradores/${saved.id}/revision/enviar`))
    await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click()
    const submitted = (await json(await submit)).draft
    assert.equal(submitted.state, 'in-review')
    assert.ok(submitted.review.teachers.length)

    await page.getByLabel('Rol simulado de revisión', { exact: true }).selectOption('teacher')
    const teacher = submitted.review.teachers[0]
    await page.getByLabel('Docente de revisión', { exact: true }).selectOption(teacher.teacherId)
    await page.getByLabel('Observación docente', { exact: true }).fill('Mover el bloque para atender la observación sintética.')
    const observation = page.waitForResponse((response) => response.url().endsWith(`/borradores/${saved.id}/revision/responder`))
    await page.getByRole('button', { name: 'Solicitar cambios', exact: true }).click()
    const observed = (await json(await observation)).draft
    assert.equal(observed.state, 'in-review')
    assert.equal(observed.review.teachers.find((item) => item.teacherId === teacher.teacherId).status, 'changes-requested')

    await page.getByLabel('Rol simulado de revisión', { exact: true }).selectOption('school')
    await page.locator('.academic-teacher-review__observation-readonly').filter({ hasText: 'Mover el bloque para atender la observación sintética.' }).waitFor()
    const sectionId = proposal.assignments[0].sectionId
    const original = proposal.assignments.find((item) => item.sectionId === sectionId)
    const nextStart = original.startMinute + 60
    const selectedTeacher = catalog.teachers.find((item) => item.id === original.teacherId)
    const selectedRoom = catalog.rooms.find((item) => item.id === original.roomId)
    const duration = original.endMinute - original.startMinute
    assert.ok(catalog.windows.some((item) => item.day === original.day && item.startMinute <= nextStart && item.endMinute >= nextStart + duration))
    assert.ok(selectedTeacher?.availability.some((item) => item.day === original.day && item.startMinute <= nextStart && item.endMinute >= nextStart + duration))
    assert.ok(selectedRoom?.availability.some((item) => item.day === original.day && item.startMinute <= nextStart && item.endMinute >= nextStart + duration))
    await page.locator('.academic-scheduling__sections-table').getByRole('button', { name: 'Editar horario', exact: true }).first().click()
    await page.getByLabel(`Inicio revisión ${sectionId}`, { exact: true }).fill(`${String(Math.floor(nextStart / 60)).padStart(2, '0')}:${String(nextStart % 60).padStart(2, '0')}`)
    const adjustment = page.waitForResponse((response) => response.url().endsWith('/ajustes') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Aplicar ajuste', exact: true }).click()
    const adjusted = await json(await adjustment)
    assert.equal(adjusted.editVersion, 1)
    assert.equal(await page.getByRole('status').filter({ hasText: 'Revisión guardada, cambios locales pendientes' }).count(), 1)

    const saveAdjustment = page.waitForResponse((response) => response.url().endsWith('/borradores/guardar') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Guardar propuesta', exact: true }).click()
    const adjustedDraft = await json(await saveAdjustment)
    assert.equal(adjustedDraft.version, observed.version + 1)
    assert.equal(adjustedDraft.review.teachers[0].status, 'outdated')
    const resubmit = page.waitForResponse((response) => response.url().endsWith(`/borradores/${saved.id}/revision/enviar`))
    await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click()
    const resubmitted = (await json(await resubmit)).draft
    assert.equal(resubmitted.review.round, submitted.review.round + 1)
    await page.getByLabel('Rol simulado de revisión', { exact: true }).selectOption('teacher')
    await page.getByLabel('Docente de revisión', { exact: true }).selectOption(teacher.teacherId)
    const conformity = page.waitForResponse((response) => response.url().endsWith(`/borradores/${saved.id}/revision/responder`))
    await page.getByRole('button', { name: 'Dar conformidad', exact: true }).click()
    const approved = (await json(await conformity)).draft
    assert.equal(approved.state, 'ready-for-approval')
    assert.ok(approved.review.history.some((event) => event.type === 'decision' && event.decision === 'changes-requested'))
    assert.ok(approved.review.history.some((event) => event.type === 'decision' && event.decision === 'conformity'))
    assert.deepEqual(await readOffer(), offerBefore, 'La revisión no debe modificar la oferta de matrícula sintética')
    await page.locator('.academic-teacher-review').screenshot({ path: resolve(evidenceDir, 'review-approved.png') })
    await writeFile(statePath, `${JSON.stringify({ id: approved.id, version: approved.version, title: approved.title,
      courseId: course.courseId, state: approved.state, round: approved.review.round, historyLength: approved.review.history.length }, null, 2)}\n`)
  } else {
    const saved = JSON.parse(await readFile(statePath, 'utf8'))
    const list = page.waitForResponse((response) => response.url().endsWith('/borradores') && response.request().method() === 'GET')
    await page.getByRole('button', { name: 'Mis propuestas', exact: true }).click()
    await json(await list)
    const row = page.locator('.academic-scheduling__saved-row').filter({ hasText: saved.title })
    await row.locator('summary').click()
    const resume = page.waitForResponse((response) => response.url().endsWith(`/borradores/${saved.id}/continuar`))
    await row.getByRole('button', { name: 'Continuar edición', exact: true }).click()
    const recovered = (await json(await resume)).draft
    assert.equal(recovered.id, saved.id)
    assert.equal(recovered.version, saved.version)
    assert.equal(recovered.state, 'ready-for-approval')
    assert.equal(recovered.review.round, saved.round)
    assert.equal(recovered.review.history.length, saved.historyLength)
    await page.locator('.academic-teacher-review__state').filter({ hasText: 'Lista para aprobación' }).waitFor()
    await page.locator('.academic-teacher-review').screenshot({ path: resolve(evidenceDir, 'review-recovered.png') })
    assert.deepEqual(await readOffer(), offerBefore, 'La recuperación no debe modificar la oferta de matrícula sintética')
  }
  assert.deepEqual(errors, [], 'No se esperan errores en la consola del navegador')
  await context.close()
  console.log(`PASS: revisión docente ${phase} en la instancia sintética 5280`)
} finally {
  await browser.close()
}

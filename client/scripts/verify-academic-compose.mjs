// Run only against a freshly created, explicitly synthetic Compose acceptance project.
import assert from 'node:assert/strict'
import { setPlanningCheckbox } from './planning-checkboxes.mjs'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

if (process.env.SUM_ACADEMIC_COMPOSE_SYNTHETIC !== '1') throw new Error('Confirma SUM_ACADEMIC_COMPOSE_SYNTHETIC=1 para el proyecto de pruebas propio')
const url = new URL(process.env.SUM_ACADEMIC_COMPOSE_BASE || 'http://127.0.0.1:5280')
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Base loopback HTTP sin rutas ni credenciales requerida')
const base = url.origin
const root = fileURLToPath(new URL('../../', import.meta.url))
const evidence = resolve(root, 'evidence/local/programacion-academica-docker')
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined), headless: true })
const errors = []
const remote = []
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (!request.url().startsWith(`${base}/`) && !request.url().startsWith('data:')) remote.push(request.url())
  })
  const read = async (path) => {
    const response = await page.request.get(`${base}/api${path}`)
    assert.equal(response.status(), 200, `GET ${path}`)
    return response.json()
  }
  const post = async (path, data) => {
    const response = await page.request.post(`${base}/api${path}`, { data })
    assert.equal(response.status(), 200, `POST ${path}: ${await response.text()}`)
    return response.json()
  }
  await page.goto(`${base}/`)
  await page.getByRole('heading', { name: 'Módulos locales', exact: true }).waitFor()
  assert.equal(new URL(page.url()).pathname, '/local/modulos')
  await page.screenshot({ path: resolve(evidence, 'modulos.png'), fullPage: true })
  await page.getByRole('link', { name: /^Estudiante/ }).click()
  await page.waitForURL('**/local/login')
  await page.locator('input[type=radio][value="SYN-SIS-A"]').check()
  await page.getByRole('button', { name: 'Iniciar prueba', exact: true }).click()
  await page.waitForURL('**/alumnoWebSum/v2/inicio')
  await page.locator('.sidebar').waitFor()
  assert.equal(await page.locator('.sidebar').getByRole('link', { name: /Programación académica/ }).count(), 0)

  const studentContext = await read('/local/matricula-regular/v1/contextos/SYN-SIS-A')
  const beforeOffer = studentContext.data.offer
  const scenarios = await read('/local/perfiles/v1/escenarios')
  const recommended = scenarios.data.scenarios.find((scenario) => scenario.scenarioId === 'regular')
    .profiles.find((profile) => profile.actorId === 'SYN-SIS-A').recommendedCourseIds
  await page.goto(`${base}/alumnoWebSum/v2/matricula/programacion`)
  await page.getByRole('table').first().waitFor()
  assert.ok(await page.getByRole('table').first().locator('tbody tr').count() > 1)
  await page.screenshot({ path: resolve(evidence, 'estudiante-programacion.png'), fullPage: true })
  await page.goto(`${base}/alumnoWebSum/v2/matricula/informacion`)
  await page.locator('.sidebar').waitFor()
  await page.getByText('Información de Matrícula', { exact: true }).first().waitFor()

  await page.goto(`${base}/local/modulos`)
  await page.getByRole('link', { name: /^Escuela · Programación académica/ }).click()
  const academicCatalog = await read('/local/programacion-academica/v1/catalogo')
  assert.equal(academicCatalog.referenceRooms.length, 49, 'el roster de ambientes de referencia tiene 49 elementos')
  assert.equal(new Set(academicCatalog.referenceRooms.map((room) => room.id)).size, 49, 'los IDs de referencia son únicos')
  assert.equal(academicCatalog.referenceRooms.filter((room) => room.pavilion === 'AP').length, 28)
  assert.equal(academicCatalog.referenceRooms.filter((room) => room.pavilion === 'NP').length, 21)
  const firstCycleCourse = academicCatalog.courses.find((course) => course.cycle !== undefined) ?? academicCatalog.courses[0]
  const chosen = [firstCycleCourse, academicCatalog.courses.find((course) => course.cycle !== undefined && course.cycle !== firstCycleCourse.cycle)
    ?? academicCatalog.courses.find((course) => course.courseId !== firstCycleCourse.courseId)]
  assert.equal(chosen.length, 2, 'el catálogo sintético debe exponer al menos dos cursos')
  if (chosen[0].cycle !== undefined && chosen[1].cycle !== undefined) assert.notEqual(chosen[0].cycle, chosen[1].cycle)
  if (chosen[0].cycle !== undefined) await page.getByLabel('Filtrar cursos por ciclo').selectOption(String(chosen[0].cycle))
  await setPlanningCheckbox(page.getByRole('checkbox', { name: `Seleccionar ${chosen[0].courseId}`, exact: true }))
  if (chosen[1].cycle !== undefined) await page.getByLabel('Filtrar cursos por ciclo').selectOption(String(chosen[1].cycle))
  assert.equal(await page.locator('.academic-scheduling__selection [role=checkbox][aria-checked=true]').count(), 0, 'el curso seleccionado de otro ciclo está oculto')
  await setPlanningCheckbox(page.getByRole('checkbox', { name: `Seleccionar ${chosen[1].courseId}`, exact: true }))
  await page.getByLabel('Filtrar cursos por ciclo').selectOption('all')
  assert.equal(await page.locator('.academic-scheduling__selection [role=checkbox][aria-checked=true]').count(), 2)
  for (const course of chosen) {
    await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).fill(course === chosen[0] ? '31' : '20')
    await page.getByLabel(`Capacidad ${course.courseId}`, { exact: true }).fill('30')
    await page.getByLabel(`Inspeccionar ${course.courseId}`).click()
    if (course.planningPatterns?.length) assert.equal(await page.getByLabel(`Patrón ${course.courseId}`).inputValue(), course.planningPatterns[0].id)
    assert.equal(await page.getByLabel(`Modalidad de sesiones ${course.courseId}`).inputValue(), 'continuous')
    if (course.history?.sections.length) {
      const details = page.locator('.academic-preparation__inspector .academic-scheduling__history')
      await details.locator('summary').click()
      assert.equal(await details.locator('ul li').count(), course.history.sections.reduce((sum, section) => sum + section.sessions.length, 0))
    }
  }
  for (const teacher of academicCatalog.teachers) await page.getByLabel(`Quitar docente ${teacher.name}`, { exact: true }).click()
  const referenceTeacher = academicCatalog.referenceTeachers?.[0]
  assert.ok(referenceTeacher, 'el catálogo expone nombres de referencia sintéticos')
  await page.getByLabel('Seleccionar o agregar docente').selectOption(referenceTeacher.id)
  assert.equal(await page.locator('.academic-scheduling__resource-card--teacher').count(), 1, 'se muestra un solo formulario docente activo')
  await page.getByLabel('Identificación docente').fill('DOC-LOCAL-COMPARTIDO')
  await page.getByLabel('Carga semanal docente').fill('1800')
  await page.getByLabel('Disponibilidad docente fin 1', { exact: true }).fill('18:00')
  for (const course of chosen) {
    const eligibility = page.getByRole('checkbox', { name: `${referenceTeacher.name} habilitado para ${course.courseId}`, exact: true })
    await setPlanningCheckbox(eligibility)
  }
  await page.getByLabel('Máximo de secciones ' + chosen[0].courseId).fill('3')
  await page.getByLabel('Seleccionar o agregar docente').selectOption(referenceTeacher.id)
  assert.equal(await page.locator('[aria-label="Docentes incorporados"] .academic-scheduling__roster-item').count(), 1, 'seleccionar una referencia incorporada no duplica docente')
  await page.getByRole('button', { name: 'Agregar demostración', exact: true }).click()
  const secondTeacherId = await page.getByLabel('Identificación docente').inputValue()
  await page.getByLabel('Identificación docente').fill('DOC-LOCAL-COMPARTIDO')
  await page.getByRole('alert').filter({ hasText: 'Esa identificación ya está asignada' }).waitFor()
  assert.equal(await page.getByLabel('Identificación docente').inputValue(), secondTeacherId, 'un ID duplicado no altera el recurso activo')
  await page.getByLabel('Seleccionar o agregar docente').selectOption(referenceTeacher.id)
  assert.equal(await page.getByLabel('Identificación docente').inputValue(), 'DOC-LOCAL-COMPARTIDO', 'al volver al docente se conserva su configuración')
  assert.equal(await page.locator('[aria-label="Docentes incorporados"] .academic-scheduling__roster-item').count(), 2)
  await page.getByRole('button', { name: 'Opciones avanzadas', exact: true }).click()
  await page.getByLabel('Criterio de asignación').selectOption('balanced')
  for (const room of academicCatalog.rooms) await page.getByLabel(`Quitar ambiente ${room.name}`, { exact: true }).click()
  const referenceClassroom = academicCatalog.referenceRooms.find((room) => room.kind === 'classroom')
  const referenceLaboratory = academicCatalog.referenceRooms.find((room) => room.kind === 'laboratory')
  assert.ok(referenceClassroom && referenceLaboratory)
  await page.getByLabel('Seleccionar o agregar ambiente').selectOption(referenceClassroom.id)
  assert.equal(await page.getByLabel('Identificación ambiente').inputValue(), referenceClassroom.id)
  assert.equal(await page.getByLabel('Capacidad ambiente').inputValue(), '45')
  await page.getByLabel('Disponibilidad del ambiente fin 1', { exact: true }).fill('18:00')
  await page.getByLabel('Seleccionar o agregar ambiente').selectOption(referenceLaboratory.id)
  assert.equal(await page.getByLabel('Identificación ambiente').inputValue(), referenceLaboratory.id)
  assert.equal(await page.getByLabel('Capacidad ambiente').inputValue(), '45')
  await page.getByLabel('Disponibilidad del ambiente fin 1', { exact: true }).fill('18:00')
  assert.equal(await page.locator('[aria-label="Ambientes incorporados"] .academic-scheduling__roster-item').count(), 2)
  await page.screenshot({ path: resolve(evidence, 'escuela-cursos.png') })
  const generatedResponse = page.waitForResponse((response) => response.url().endsWith('/propuestas') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
  const response = await generatedResponse
  assert.equal(response.status(), 200)
  const proposal = await response.json()
  const proposalRequest = response.request().postDataJSON()
  assert.equal(proposalRequest.resources.teachers[0].name, referenceTeacher.name)
  assert.deepEqual(proposalRequest.demands.map((demand) => demand.deliveryMode), ['continuous', 'continuous'])
  assert.ok(proposalRequest.resources.rooms.some((room) => room.id === referenceClassroom.id && room.capacity === 45))
  assert.ok(proposalRequest.resources.rooms.some((room) => room.id === referenceLaboratory.id && room.capacity === 45))
  assert.ok(proposal.assignments.some((assignment) => assignment.teacherId === 'DOC-LOCAL-COMPARTIDO'
    && assignment.teacherName === referenceTeacher.name))
  assert.equal(proposal.status, 'complete')
  assert.equal(proposal.counts.sections, 3)
  assert.equal(proposal.status, 'complete')
  assert.equal(proposal.coverageComplete, true)
  assert.ok(proposal.counts.requiredSessions > proposal.counts.sections)
  for (const section of proposal.sections) {
    const sessions = proposal.assignments.filter((assignment) => assignment.sectionId === section.sectionId)
      .sort((left, right) => left.startMinute - right.startMinute)
    assert.ok(sessions.length > 0)
    assert.ok(sessions.every((session) => session.teacherId === sessions[0].teacherId), 'docente único por sección')
    assert.ok(sessions.every((session) => session.day === sessions[0].day), 'componentes del bloque en un mismo día')
    for (let index = 1; index < sessions.length; index += 1) assert.equal(sessions[index - 1].endMinute, sessions[index].startMinute, 'componentes consecutivos')
    assert.equal(section.deliveryMode, 'continuous')
  }
  await page.locator('.academic-scheduling__result--complete').waitFor()
  await page.locator('.academic-scheduling__result').scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(evidence, 'escuela.png') })
  const calendar = page.getByRole('region', { name: 'Calendario semanal con horas; desplázate horizontalmente para ver todos los días' })
  await calendar.scrollIntoViewIfNeeded()
  assert.ok((await page.getByRole('table').allTextContents()).join(' ').includes(referenceTeacher.name))
  assert.ok((await calendar.innerText()).includes(referenceTeacher.name))
  await page.screenshot({ path: resolve(evidence, 'escuela-calendario.png') })
  const priorProposal = proposal
  await page.getByLabel('Carga semanal docente').fill('1799')
  assert.equal(await page.locator('.academic-scheduling__result').count(), 0, 'cambiar recursos invalida el resultado visible')
  const resourceChangedResponse = page.waitForResponse((response) => response.url().endsWith('/propuestas') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
  const resourceChanged = await resourceChangedResponse
  assert.equal(resourceChanged.status(), 200)
  assert.equal((await resourceChanged.json()).status, 'complete')
  assert.deepEqual(await read(`/local/programacion-academica/v1/propuestas/${priorProposal.proposalId}`), priorProposal)
  await page.getByLabel(`Capacidad ${chosen[0].courseId}`, { exact: true }).fill('31')
  await page.locator('.academic-scheduling__result--complete').waitFor({ state: 'detached' })
  const regeneratedResponse = page.waitForResponse((response) => response.url().endsWith('/propuestas') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
  const regenerated = await regeneratedResponse
  assert.equal(regenerated.status(), 200)
  const updatedProposal = await regenerated.json()
  assert.equal(updatedProposal.status, 'complete')
  assert.notEqual(updatedProposal.counts.sections, priorProposal.counts.sections, 'cambiar capacidad debe alterar la propuesta')
  assert.equal(updatedProposal.sections.filter((section) => section.courseId === chosen[0].courseId).length, 1)
  assert.deepEqual(await read(`/local/programacion-academica/v1/propuestas/${priorProposal.proposalId}`), priorProposal)
  const variableCourse = chosen.find((course) => course.planningPatterns?.length > 1)
  if (variableCourse) {
    await page.getByLabel(`Inspeccionar ${variableCourse.courseId}`).click()
    await page.getByLabel(`Patrón ${variableCourse.courseId}`).selectOption(variableCourse.planningPatterns[1].id)
    assert.equal(await page.locator('.academic-scheduling__result').count(), 0, 'cambiar patrón invalida resultado anterior')
  }
  assert.deepEqual((await read('/local/matricula-regular/v1/contextos/SYN-SIS-A')).data.offer, beforeOffer)
  assert.deepEqual(await read(`/local/programacion-academica/v1/propuestas/${proposal.proposalId}`), proposal)
  await page.getByLabel(`Inspeccionar ${chosen[1].courseId}`).click()
  await page.getByLabel(`Modalidad de sesiones ${chosen[1].courseId}`).selectOption('split')
  assert.equal(await page.locator('.academic-scheduling__result').count(), 0, 'cambiar modalidad invalida la propuesta visible')
  const splitResponse = page.waitForResponse((response) => response.url().endsWith('/propuestas') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
  const splitProposal = await (await splitResponse).json()
  assert.equal(splitProposal.status, 'complete')
  assert.equal((await read(`/local/programacion-academica/v1/propuestas/${proposal.proposalId}`)).proposalId, proposal.proposalId)
  for (const section of splitProposal.sections.filter((item) => item.courseId === chosen[1].courseId)) {
    const sessions = splitProposal.assignments.filter((assignment) => assignment.sectionId === section.sectionId)
    assert.equal(section.deliveryMode, 'split')
    assert.ok(sessions.every((session) => session.teacherId === sessions[0].teacherId), 'split conserva docente único por sección')
  }
  await page.getByLabel(`Modalidad de sesiones ${chosen[1].courseId}`).selectOption('continuous')
  assert.equal(await page.locator('.academic-scheduling__result').count(), 0)

  // Exercise existing enrollment on this acceptance project's synthetic student only.
  const session = await post('/local/matricula-regular/v1/sesiones', { runId: studentContext.runId, actorId: 'SYN-SIS-A' })
  const submission = { runId: studentContext.runId, actorId: 'SYN-SIS-A', sessionId: session.data.sessionId,
    requestId: randomUUID(), profileRevision: studentContext.data.profileRevision,
    selection: recommended.map((courseId) => {
      const course = beforeOffer.find((item) => item.courseId === courseId)
      assert.ok(course, 'Recomendación sintética debe existir en la oferta')
      return { courseId, sectionId: course.sections[0].sectionId }
    }),
  }
  const enrollment = await post('/local/matricula-regular/v1/solicitudes', submission)
  assert.equal(enrollment.data.state, 'accepted', JSON.stringify(enrollment.data))
  assert.deepEqual(await post('/local/matricula-regular/v1/solicitudes', submission), enrollment)
  const afterOffer = (await read('/local/matricula-regular/v1/contextos/SYN-SIS-A')).data.offer
  for (const course of afterOffer) for (const section of course.sections) {
    const prior = beforeOffer.find((item) => item.courseId === course.courseId).sections.find((item) => item.sectionId === section.sectionId)
    const selected = submission.selection.some((item) => item.courseId === course.courseId && item.sectionId === section.sectionId)
    assert.equal(section.occupied, prior.occupied + (selected ? 1 : 0))
    assert.equal(section.capacity, prior.capacity)
  }
  await page.getByRole('link', { name: /Módulos locales/ }).click()
  await page.getByRole('link', { name: /^Estudiante/ }).click()
  await page.locator('.sidebar').waitFor()
  assert.equal(new URL(page.url()).pathname, '/alumnoWebSum/v2/inicio')
  assert.deepEqual(errors, [])
  assert.deepEqual(remote, [])
  await writeFile(resolve(evidence, 'result.json'), JSON.stringify({ date: new Date().toISOString(), base,
    source: 'fresh isolated compose.local.yaml with independently synthetic built-in fixtures',
    selector: 'passed', studentLoginAndScreens: 'passed', sameOriginProxy: 'passed', proposal: { status: proposal.status, sections: proposal.counts.sections },
    enrollmentOfferUnaffectedByAcademicGeneration: true, enrollmentAccepted: true, replayIdempotent: true,
    occupiedCountersChangedOnlyByEnrollment: true, studentMenuUnchanged: true, errors, remote }, null, 2))
  console.log(`PASS ${base}: selector, student, school, Docker proxy, unchanged offer and accepted idempotent enrollment`)
} finally {
  await browser.close()
}

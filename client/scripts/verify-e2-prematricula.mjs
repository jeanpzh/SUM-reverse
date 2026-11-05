// Browser-only E2 acceptance stages. The caller owns the isolated synthetic SUM test stack on loopback:5280.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

if (process.env.SUM_E2_BROWSER_VERIFY !== '1') throw new Error('Requiere confirmación explícita SUM_E2_BROWSER_VERIFY=1 para el escenario local sintético propio.')
const phase = process.env.SUM_E2_PHASE
if (!['save', 'resume'].includes(phase)) throw new Error('Define SUM_E2_PHASE=save o resume; la fase resume se ejecuta después de reiniciar el API local.')
const baseUrl = new URL(process.env.SUM_E2_BASE_URL || 'http://127.0.0.1:5280/')
if (baseUrl.protocol !== 'http:' || baseUrl.hostname !== '127.0.0.1' || baseUrl.port !== '5280'
  || baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash || baseUrl.username || baseUrl.password) {
  throw new Error('La verificación solo admite el stack sintético aislado en http://127.0.0.1:5280/.')
}

const root = fileURLToPath(new URL('../../', import.meta.url))
const evidence = resolve(root, 'evidence/local/prematricula-e2-draft')
const statePath = resolve(evidence, 'browser-state.json')
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined), headless: true })
const errors = []
const outsideRequests = []
const academicApi = '/api/local/programacion-academica/v1'
const e2Api = '/api/local/prematricula/v1'
async function json(page, path, data) {
  const response = await page.request.fetch(new URL(path, baseUrl).href, data === undefined ? {} : { method: 'POST', data })
  assert.equal(response.status(), 200, `${path}: ${await response.text()}`)
  return response.json()
}
async function publishForE2(page) {
  const catalog = await json(page, `${academicApi}/catalogo`)
  const courses = ['20118091', '20118094'].map((id) => catalog.courses.find((course) => course.courseId === id))
  assert.ok(courses.every(Boolean), 'catálogo sintético autorizado con cursos elegibles para ambos perfiles')
  const availability = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1080 }))
  const resources = {
    teachers: courses.map((course, index) => ({ id: `E2-DEMO-${index}`, name: catalog.referenceTeachers[index].name,
      courseIds: [course.courseId], maxWeeklyMinutes: 2400, availability })),
    rooms: catalog.referenceRooms.filter((room) => room.kind === 'classroom').slice(0, 2).map((room) => ({
      id: room.id, name: room.name, kind: room.kind, capacity: room.capacity, availability })),
  }
  const request = { revision: catalog.revision, demands: courses.map((course, index) => ({
    courseId: course.courseId, estimatedDemand: index === 0 ? 46 : 1, targetCapacity: 45,
    deliveryMode: 'continuous', patternId: course.planningPatterns[0].id })), resources }
  const proposal = await json(page, `${academicApi}/propuestas`, request)
  assert.equal(proposal.status, 'complete')
  const configuration = { schoolId: 'SISTEMAS', academicPeriod: '2027-I', demandSourceId: 'existing-regular-v1', demandBaseRequest: null, request }
  let draft = await json(page, `${academicApi}/borradores/guardar`, { id: null, expectedVersion: null,
    title: `Prueba E2 sintética ${Date.now()}`, state: 'draft', configuration,
    proposalId: proposal.proposalId, proposalEditVersion: proposal.editVersion })
  draft = (await json(page, `${academicApi}/borradores/${draft.id}/revision/enviar`, { expectedVersion: draft.version })).draft
  for (const teacher of draft.review.teachers) {
    draft = (await json(page, `${academicApi}/borradores/${draft.id}/revision/responder`, {
      expectedVersion: draft.version, round: draft.review.round, teacherId: teacher.teacherId, decision: 'conformity', observation: '' })).draft
  }
  draft = (await json(page, `${academicApi}/borradores/${draft.id}/aprobar`, { expectedVersion: draft.version })).draft
  const history = await json(page, `${academicApi}/publicaciones`)
  draft = (await json(page, `${academicApi}/borradores/${draft.id}/publicar`, {
    expectedVersion: draft.version, expectedCurrentId: history.currentId })).draft
  return json(page, `${academicApi}/publicaciones/${draft.id}`)
}
async function enrollmentState(page, identity) {
  const context = await json(page, `/api/local/matricula-regular/v1/contextos/${identity.actorId}`)
  const report = await json(page, `/api/local/perfiles/v1/consultas/matricula?${new URLSearchParams(identity)}`)
  return { offer: context.data.offer, report: report.data.payload }
}
async function chooseAndValidate(page, courseId, index = 0) {
  const row = page.locator('.student-premat table tbody tr').filter({ hasText: courseId }).first()
  await row.getByRole('button', { name: 'Elegir', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Secciones disponibles' })
  const radio = dialog.locator('input[type="radio"]').nth(index)
  const sectionId = await radio.getAttribute('value')
  await radio.check()
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname === `${e2Api}/validar`
    && response.request().postDataJSON().selection.some((choice) => choice.courseId === courseId && choice.sectionId === sectionId))
  await dialog.getByRole('button', { name: '✓ Aceptar', exact: true }).click()
  const response = await pending
  assert.equal(response.status(), 200)
  return response.json()
}
async function saveVisible(page) {
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname === `${e2Api}/guardar`)
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
  const response = await pending
  assert.equal(response.status(), 200)
  const saved = await response.json()
  await page.getByRole('status').filter({ hasText: `Borrador guardado · versión ${saved.draft.version}.` }).waitFor()
  return saved
}

async function enter(page, actorId) {
  await page.goto(new URL('/local/modulos', baseUrl).href)
  await page.getByRole('heading', { name: 'Módulos locales', exact: true }).waitFor()
  await page.getByRole('link', { name: /^Estudiante/ }).click()
  await page.waitForURL('**/local/login')
  await page.locator('input[name="scenario"][value="regular"]').check()
  await page.locator(`input[name="profile"][value="${actorId}"]`).check()
  await page.getByRole('button', { name: 'Iniciar prueba', exact: true }).click()
  await page.waitForURL('**/alumnoWebSum/v2/inicio')
  const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === `${e2Api}/contexto`)
  await page.goto(new URL('/alumnoWebSum/v2/reportes/prematricula', baseUrl).href)
  await page.getByText('Prematrícula', { exact: true }).first().waitFor()
  await page.getByText('Mi propuesta de prematrícula', { exact: true }).click()
  await page.locator('.student-premat__body').waitFor()
  const response = await responsePromise
  assert.equal(response.status(), 200)
  return { context: await response.json(), identity: response.request().postDataJSON().identity }
}

async function saveOne(page, actorId) {
  const publicationSelect = page.locator('.student-premat select')
  const publicationId = await publicationSelect.inputValue()
  assert.ok(publicationId, 'la publicación debe provenir del contexto local')
  await page.getByRole('button', { name: 'Consultar', exact: true }).click()
  const rows = page.locator('.student-premat table tbody tr')
  await rows.first().waitFor()
  const eligible = rows.filter({ hasText: 'Disponible para propuesta' }).first()
  assert.ok(await eligible.count(), 'se requiere una asignatura elegible de la publicación E1 preparada por el principal')
  const courseLabel = (await eligible.locator('td').nth(0).innerText()).trim()
  await eligible.getByRole('button', { name: 'Elegir', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Secciones disponibles' })
  await dialog.locator('input[type="radio"]').first().check()
  const sectionId = await dialog.locator('input[type="radio"]').first().getAttribute('value')
  await dialog.getByRole('button', { name: '✓ Aceptar', exact: true }).click()
  const saveResponsePromise = page.waitForResponse((response) => response.url().includes('/api/local/prematricula/v1/guardar')
    && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
  const saveResponse = await saveResponsePromise
  assert.equal(saveResponse.status(), 200)
  const saved = await saveResponse.json()
  assert.equal(saved.draft.actorId, actorId, 'la respuesta JSON debe corresponder al actor actual')
  assert.equal(saved.validation.actorId, actorId)
  await page.getByRole('status').filter({ hasText: 'Borrador guardado · versión' }).waitFor()
  const notice = await page.getByRole('status').filter({ hasText: 'Borrador guardado · versión' }).innerText()
  const version = Number(notice.match(/versión (\d+)/)?.[1])
  assert.ok(Number.isInteger(version) && version > 0)
  const courseCode = courseLabel.split(' - ')[0]
  const savedRow = page.locator('.student-premat table tbody tr').filter({ hasText: courseCode }).first()
  const sectionLabel = (await savedRow.locator('td').nth(3).innerText()).trim()
  assert.ok(sectionId)
  assert.equal(saved.draft.version, version)
  assert.equal(saved.draft.publicationId, publicationId)
  assert.deepEqual(saved.draft.selection, [{ courseId: courseCode, sectionId }])
  assert.equal(saved.validation.status, 'valid')
  assert.ok(saved.validation.credits > 0)
  assert.ok(await page.locator('.student-premat .weekly-schedule__event').count() > 0)
  return { actorId, id: saved.draft.id, publicationId: saved.draft.publicationId, courseCode, courseLabel, sectionId, sectionLabel, version }
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('dialog', (dialog) => void dialog.accept())
  page.on('request', (request) => {
    if (!request.url().startsWith(baseUrl.origin) && !request.url().startsWith('data:')) outsideRequests.push(request.url())
  })
  if (phase === 'save') {
    const published = await publishForE2(page)
    const a = await enter(page, 'SYN-SIS-A')
    assert.equal(a.context.draft, null, 'la fase save requiere un namespace E2 vacío; con borradores existentes utiliza resume')
    const beforeA = await enrollmentState(page, a.identity)
    const actorA = await saveOne(page, 'SYN-SIS-A')
    const contextA = await json(page, `${e2Api}/contexto`, { identity: a.identity })
    const stale = await page.request.post(new URL(`${e2Api}/guardar`, baseUrl).href, { data: {
      identity: a.identity, publicationId: contextA.draft.publicationId, publicationVersion: contextA.draft.publicationVersion,
      selection: [], id: contextA.draft.id, expectedVersion: contextA.draft.version + 1, expectedAcademicRevision: contextA.academicRevision } })
    assert.equal(stale.status(), 409, 'CAS impide sobrescritura obsoleta')
    assert.deepEqual(await enrollmentState(page, a.identity), beforeA, 'guardar E2 no cambia oferta, ocupaciones ni matrícula confirmada')
    assert.deepEqual(await json(page, `${academicApi}/publicaciones/${published.id}`), published)
    await page.getByRole('button', { name: 'Salir', exact: true }).click()
    await page.waitForURL('**/local/login')
    const b = await enter(page, 'SYN-SIS-B')
    assert.equal(b.context.draft, null)
    const beforeB = await enrollmentState(page, b.identity)
    assert.equal(await page.getByRole('button', { name: /Recuperar borrador/ }).count(), 0, 'SIS-B no debe ver ni recuperar el borrador de SIS-A')
    const actorB = await saveOne(page, 'SYN-SIS-B')
    assert.notEqual(actorA.id, actorB.id, 'cada actor debe guardar un documento distinto')
    const bContext = await json(page, `${e2Api}/contexto`, { identity: b.identity })
    const forbidden = await page.request.post(new URL(`${e2Api}/guardar`, baseUrl).href, { data: {
      identity: b.identity, publicationId: published.id, publicationVersion: published.publicationVersion, selection: [],
      id: actorA.id, expectedVersion: actorA.version, expectedAcademicRevision: bContext.academicRevision } })
    assert.equal(forbidden.status(), 403)
    assert.deepEqual(await enrollmentState(page, b.identity), beforeB)
    assert.deepEqual(await json(page, `${academicApi}/publicaciones/${published.id}`), published)
    const newer = await publishForE2(page)
    assert.ok(newer.publicationVersion > published.publicationVersion)
    await writeFile(statePath, JSON.stringify({ phase: 'save', source: 'isolated synthetic local browser run', actorA, actorB,
      publication: published, newerPublication: newer, errors, outsideRequests,
      note: 'Restart only this test API, then run the resume phase with a fresh browser context.' }, null, 2))
    await page.locator('.student-premat').screenshot({ path: resolve(evidence, 'propuesta-sintetica.png') })
  } else {
    const state = JSON.parse(await readFile(statePath, 'utf8'))
    assert.ok(['save', 'resume'].includes(state.phase), 'primero ejecuta la fase save sobre el stack sintético propio')
    const active = await enter(page, 'SYN-SIS-A')
    const before = await enrollmentState(page, active.identity)
    const reportText = await page.locator('.screen-prematricula').innerText()
    assert.ok(await page.locator('.screen-prematricula table tbody tr').count() > 0, 'el reporte anterior permanece')
    await page.locator('.student-premat table tbody tr').first().waitFor()
    await page.waitForTimeout(150)
    assert.ok(await page.getByRole('button', { name: /Recuperar borrador v/ }).count(), 'el borrador persistido de SIS-A debe sobrevivir al reinicio del API')
    const contextResponsePromise = page.waitForResponse((response) => response.url().includes('/api/local/prematricula/v1/contexto')
      && response.request().method() === 'POST')
    await page.getByRole('button', { name: /Recuperar borrador v/ }).click()
    const contextResponse = await contextResponsePromise
    assert.equal(contextResponse.status(), 200)
    const refreshedContext = await contextResponse.json()
    assert.equal(refreshedContext.actorId, 'SYN-SIS-A')
    assert.equal(refreshedContext.draft.actorId, 'SYN-SIS-A')
    assert.equal(refreshedContext.draft.id, state.actorA.id)
    assert.equal(refreshedContext.draft.version, state.actorA.version)
    assert.equal(refreshedContext.draft.publicationId, state.actorA.publicationId)
    assert.equal(refreshedContext.draft.publicationVersion, state.publication.publicationVersion)
    assert.deepEqual(await json(page, `${academicApi}/publicaciones/${state.publication.id}`), state.publication)
    assert.deepEqual(await json(page, `${academicApi}/publicaciones/${state.newerPublication.id}`), state.newerPublication)
    await page.getByRole('status').filter({ hasText: /Borrador versión .* recuperado/ }).waitFor()
    const recoveredRow = page.locator('.student-premat table tbody tr').filter({ hasText: state.actorA.courseCode }).first()
    await recoveredRow.waitFor()
    assert.equal((await recoveredRow.locator('td').nth(3).innerText()).trim(), state.actorA.sectionLabel, 'la sección personal se recupera sin cambiar de publicación')
    const currentOption = page.locator('.student-premat select option').filter({ hasText: 'Vigente' }).first()
    const currentId = await currentOption.getAttribute('value')
    if (currentId && currentId !== state.actorA.publicationId) {
      await page.getByText(/publicación vigente más reciente/, { exact: false }).waitFor()
      assert.equal(await page.locator('.student-premat select').inputValue(), state.actorA.publicationId)
    }
    assert.equal(currentId, state.newerPublication.id)
    await page.locator('.student-premat').screenshot({ path: resolve(evidence, 'recuperado-tras-reinicio.png') })
    const replaced = await chooseAndValidate(page, state.actorA.courseCode, 1)
    assert.equal(replaced.courseCount, 1, 'reemplazar no duplica la asignatura')
    assert.equal(replaced.status, 'valid')
    assert.equal((await recoveredRow.locator('td').nth(3).innerText()).trim(), '2')
    assert.equal(await page.locator('.student-premat .weekly-schedule__event').count(), 1, 'componentes continuos se agrupan')
    await page.getByRole('button', { name: 'Consultar', exact: true }).click()
    assert.equal((await recoveredRow.locator('td').nth(3).innerText()).trim(), '2', 'refrescar la misma publicación no pierde la edición')
    const emptyValidation = page.waitForResponse((response) => new URL(response.url()).pathname === `${e2Api}/validar`
      && response.request().postDataJSON().selection.length === 0)
    await recoveredRow.getByRole('button', { name: 'Quitar', exact: true }).click()
    assert.equal((await (await emptyValidation).json()).status, 'incomplete')
    assert.equal(await page.locator('.student-premat .weekly-schedule__event').count(), 0)
    const empty = await saveVisible(page)
    assert.deepEqual(empty.draft.selection, [])
    assert.equal(empty.validation.status, 'incomplete', 'se permite guardar borrador parcial vacío')
    const restored = await chooseAndValidate(page, state.actorA.courseCode)
    assert.equal(restored.status, 'valid')
    const saved = await saveVisible(page)
    assert.equal(saved.draft.id, state.actorA.id)
    state.actorA.version = saved.draft.version
    const crossed = await chooseAndValidate(page, '20118094')
    assert.equal(crossed.status, 'unmet')
    assert.ok(crossed.issues.some((issue) => issue.code === 'SCHEDULE_CONFLICT'))
    await page.locator('.student-premat__warning').filter({ hasText: 'Las secciones seleccionadas tienen horarios superpuestos.' }).waitFor()
    await page.locator('.student-premat').screenshot({ path: resolve(evidence, 'cruce-detectado.png') })
    await page.locator('.student-premat select').selectOption(state.newerPublication.id)
    await page.getByRole('button', { name: 'Consultar', exact: true }).click()
    await page.locator('.student-premat table tbody tr').first().waitFor()
    assert.equal(await page.locator('.student-premat .weekly-schedule__event').count(), 0)
    const stillPinned = await json(page, `${e2Api}/contexto`, { identity: active.identity })
    assert.equal(stillPinned.draft.publicationId, state.publication.id, 'consultar otra publicación no cambia el archivo guardado')
    await page.getByRole('button', { name: /Recuperar borrador v/ }).click()
    await page.getByRole('status').filter({ hasText: /Borrador versión .* recuperado/ }).waitFor()
    assert.equal(await page.locator('.student-premat select').inputValue(), state.publication.id)
    assert.deepEqual(await enrollmentState(page, active.identity), before)
    assert.equal(await page.locator('.screen-prematricula').innerText(), reportText, 'editar E2 conserva el reporte original')
    assert.deepEqual(await json(page, `${academicApi}/publicaciones/${state.publication.id}`), state.publication)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: resolve(evidence, 'reporte-y-propuesta.png'), fullPage: true })
    await page.getByRole('button', { name: 'Salir', exact: true }).click()
    const b = await enter(page, 'SYN-SIS-B')
    assert.equal(b.context.draft.id, state.actorB.id)
    assert.equal(b.context.draft.version, state.actorB.version)
    assert.equal(b.context.draft.publicationId, state.publication.id)
    await writeFile(statePath, JSON.stringify({ ...state, phase: 'resume', resumedAfterApiRestart: true,
      uiEditingVerified: true, conflictVerified: true, unchangedEnrollmentAndE1: true,
      recoveredAt: new Date().toISOString(), errors, outsideRequests }, null, 2))
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(outsideRequests, [])
  console.log(`PASS E2 ${phase}: local synthetic actor isolation and publication draft persistence`)
} finally {
  await browser.close()
}

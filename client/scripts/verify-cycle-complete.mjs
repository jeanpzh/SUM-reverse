import assert from 'node:assert/strict'
import { setPlanningCheckbox } from './planning-checkboxes.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

// Only use the principal's independently started synthetic Compose project.
if (process.env.SUM_CYCLE_SYNTHETIC !== '1') throw new Error('Requires SUM_CYCLE_SYNTHETIC=1 and an owned synthetic Compose project on port 5280')
const base = 'http://127.0.0.1:5280'
const phase = process.argv[2] ?? 'prepare'
if (!['prepare', 'confirm', 'capture', 'resume'].includes(phase)) throw new Error('Use prepare, confirm, capture or resume')
const statePath = '/tmp/sum-fase3-cycle-state.json'
const evidence = resolve('evidence/local/ciclo-completo-fase3')
const e1 = '/api/local/programacion-academica/v1'
const e2 = '/api/local/prematricula/v1'
const e3 = '/api/local/matricula-regular/v1'
const coursesA = ['20118091', '20118094', '20118095', '20118097']
const coursesB = ['20118084', '20118087']
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = [], outside = []
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => { if (!request.url().startsWith(`${base}/`) && !request.url().startsWith('data:')) outside.push(request.url()) })
page.on('dialog', dialog => void dialog.accept())
const responseFor = path => page.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === 'POST')
async function json(path, data, status = 200) {
  const response = await page.request.fetch(`${base}${path}`, data === undefined ? {} : { method: 'POST', data })
  assert.equal(response.status(), status, `${path}: ${await response.text()}`)
  return response.json()
}
const occupancy = offer => offer.flatMap(course => course.sections.map(section => [course.courseId, section.sectionId, section.occupied]))
const readContext = (actorId, runId) => json(`${e3}/contextos/${actorId}${runId ? `?runId=${runId}` : ''}`)
async function enter(actorId, runId) {
  // A fresh browser tab identity avoids resetting a prior scenario through a stale login.
  await page.goto(`${base}/local/modulos`)
  await page.evaluate(() => sessionStorage.removeItem('lp:session'))
  await page.goto(`${base}/local/login${runId ? `?runId=${runId}` : ''}`)
  if (!runId) await page.locator('input[name="scenario"][value="regular"]').check()
  await page.locator(`input[name="profile"][value="${actorId}"]`).check()
  await page.getByRole('button', { name: runId ? 'Ingresar' : 'Iniciar prueba', exact: true }).click()
  await page.waitForURL('**/alumnoWebSum/v2/inicio')
}
async function publish() {
  const catalog = await json(`${e1}/catalogo`)
  const codes = [...new Set([...coursesA, ...coursesB])]
  const courses = codes.map(code => catalog.courses.find(course => course.courseId === code))
  assert.ok(courses.every(Boolean))
  const availability = [1, 2, 3, 4, 5].map(day => ({ day, startMinute: 480, endMinute: 1320 }))
  const request = { revision: catalog.revision,
    planningPolicy: { revision: 'FISI-PLANNING-1', period: '2027-I', allowAfternoon: false, allowSaturday: false },
    demands: courses.map(course => ({ courseId: course.courseId, estimatedDemand: 46, targetCapacity: 45,
      deliveryMode: course.planningPatterns[0].weeklySessions.reduce((sum, session) => sum + session.durationMinutes, 0) > 240 ? 'split' : 'continuous', patternId: course.planningPatterns[0].id })),
    resources: {
      teachers: courses.map((course, index) => ({ id: `CYCLE-T${index}`, name: `Docente sintético ${index + 1}`, courseIds: [course.courseId], maxWeeklyMinutes: 2400, availability,
        facultyId: 'FISI', category: 'principal', qualificationSource: 'synthetic' })),
      rooms: Array.from({ length: 8 }, (_, index) => ({ id: `CYCLE-R${index}`, name: `Ambiente sintético ${index + 1}`, kind: index % 2 ? 'laboratory' : 'classroom', capacity: 45, availability })),
    } }
  const proposal = await json(`${e1}/propuestas`, request)
  assert.equal(proposal.status, 'complete', JSON.stringify(proposal.diagnostics))
  assert.equal(proposal.coverageComplete, true)
  const configuration = { schoolId: 'SISTEMAS', academicPeriod: '2027-I', demandSourceId: 'existing-regular-v1', demandBaseRequest: null, request }
  let draft = await json(`${e1}/borradores/guardar`, { id: null, expectedVersion: null, title: 'Ciclo integral sintético 2027-I', state: 'draft', configuration,
    proposalId: proposal.proposalId, proposalEditVersion: proposal.editVersion })
  draft = (await json(`${e1}/borradores/${draft.id}/revision/enviar`, { expectedVersion: draft.version })).draft
  for (const teacher of draft.review.teachers) draft = (await json(`${e1}/borradores/${draft.id}/revision/responder`, {
    expectedVersion: draft.version, round: draft.review.round, teacherId: teacher.teacherId, decision: 'conformity', observation: '' })).draft
  draft = (await json(`${e1}/borradores/${draft.id}/aprobar`, { expectedVersion: draft.version })).draft
  const history = await json(`${e1}/publicaciones`)
  draft = (await json(`${e1}/borradores/${draft.id}/publicar`, { expectedVersion: draft.version, expectedCurrentId: history.currentId })).draft
  return json(`${e1}/publicaciones/${draft.id}`)
}
async function planningControls() {
  const catalog = await json(`${e1}/catalogo`)
  await page.goto(`${base}/local/programacion-academica`)
  await page.locator('#planning-page-title').waitFor()
  for (const course of catalog.courses) {
    assert.equal(await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).inputValue(), String(course.cycle % 2 ? 180 : 90))
    assert.equal(await page.getByLabel(`Capacidad ${course.courseId}`, { exact: true }).inputValue(), '45')
  }
  // Roster markup is a labelled region, so query its explicit aria-label regardless of role.
  const roster = page.locator('[aria-label="Docentes incorporados"]')
  assert.equal(await roster.getByRole('button').count(), catalog.referenceTeachers.length)
  assert.equal(await page.locator('[aria-label="Ambientes incorporados"]').getByRole('button').count(), catalog.referenceRooms.length)
  const teacher = catalog.referenceTeachers[0]
  await page.getByLabel('Buscar docentes por nombre o código', { exact: true }).fill(teacher.id)
  assert.equal(await roster.getByRole('button').count(), 1)
  await page.getByLabel('Buscar docentes por nombre o código', { exact: true }).fill('sin-coincidencia-sintetica')
  assert.equal(await roster.getByRole('button').count(), 0)
  await page.getByLabel('Buscar docentes por nombre o código', { exact: true }).fill('')
  assert.equal(await roster.getByRole('button').count(), catalog.referenceTeachers.length)
  await page.getByLabel('Periodo de planificación', { exact: true }).selectOption('2026-II')
  for (const course of catalog.courses) assert.equal(await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).inputValue(), String(course.cycle % 2 ? 90 : 180))
  await page.getByLabel('Periodo de planificación', { exact: true }).selectOption('2027-I')
  const course = catalog.courses[0]
  await setPlanningCheckbox(page.getByRole('checkbox', { name: `Seleccionar ${course.courseId}`, exact: true }))
  await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).fill('123')
  await page.getByLabel('Buscar docentes por nombre o código', { exact: true }).fill(teacher.id)
  assert.equal(await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).inputValue(), '123')
  await page.screenshot({ path: resolve(evidence, 'parametros-planificacion.png'), fullPage: true })
}
async function registerIntention(actorId, publication, codes) {
  await enter(actorId)
  const pending = responseFor(`${e2}/contexto`)
  await page.goto(`${base}/alumnoWebSum/v2/reportes/prematricula`)
  const response = await pending
  assert.equal(response.status(), 200)
  const identity = response.request().postDataJSON().identity
  await page.locator('.student-premat > summary').click()
  const select = page.locator('.student-premat__controls select')
  await select.selectOption(publication.id)
  const consulted = responseFor(`${e2}/publicacion`)
  await page.getByRole('button', { name: 'Consultar', exact: true }).click()
  await consulted
  for (const code of codes) {
    const row = page.locator('.student-premat table tbody tr').filter({ hasText: code }).first()
    await row.getByRole('button', { name: 'Elegir', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Secciones disponibles' })
    await dialog.locator('input[type="radio"]').first().check()
    const validated = responseFor(`${e2}/validar`)
    await dialog.getByRole('button', { name: '✓ Aceptar', exact: true }).click()
    assert.equal((await (await validated).json()).status, 'valid')
  }
  const saved = responseFor(`${e2}/guardar`)
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
  assert.equal((await saved).status(), 200)
  const registered = responseFor(`${e2}/intencion/registrar`)
  await page.getByRole('button', { name: /^(Registrar intención|Actualizar intención)$/ }).click()
  const result = await (await registered).json()
  assert.equal(result.validation.status, 'valid')
  await page.screenshot({ path: resolve(evidence, `intencion-${actorId}.png`), fullPage: true })
  return { identity, intention: result.intention }
}
try {
  await mkdir(evidence, { recursive: true })
  if (phase === 'prepare') {
    await planningControls()
    const publication = await publish()
    const a = await registerIntention('SYN-SIS-A', publication, coursesA)
    const b = await registerIntention('SYN-SIS-B', publication, coursesB)
    const demand = await json(`${e2}/demanda`, { publicationId: publication.id, publicationVersion: publication.publicationVersion })
    assert.equal(demand.countedStudents, 2)
    const legacy = await readContext('SYN-SIS-A')
    const catalog = await json(`${e3}/ofertas`)
    await page.goto(`${base}/local/programacion-academica`)
    await page.locator('.academic-publication').waitFor()
    await page.getByRole('button', { name: 'Actualizar publicaciones', exact: true }).click()
    await page.getByLabel('Consultar publicación', { exact: true }).selectOption(publication.id)
    await page.getByRole('button', { name: 'Actualizar vista previa', exact: true }).click()
    const activated = responseFor(`${e3}/ofertas/activar`)
    await page.getByRole('button', { name: 'Activar publicación seleccionada', exact: true }).click()
    const confirmDialog = page.getByRole('alertdialog')
    await Promise.race([activated, confirmDialog.waitFor().then(() =>
      confirmDialog.getByRole('button', { name: 'Activar publicación seleccionada', exact: true }).click()).catch(() => {})])
    const activationResponse = await activated
    assert.equal(activationResponse.status(), 200, await activationResponse.text())
    assert.deepEqual(activationResponse.request().postDataJSON(), { publicationId: publication.id,
      publicationVersion: publication.publicationVersion, expectedActiveRunId: catalog.activeRunId })
    const activation = await activationResponse.json()
    assert.equal(activation.reused, false)
    const entry = page.getByRole('link', { name: 'Abrir matrícula 2027-I', exact: true })
    await entry.waitFor()
    assert.equal(await entry.getAttribute('href'), `/local/login?runId=${activation.offer.runId}`)
    await page.locator('.academic-publication').screenshot({ path: resolve(evidence, 'oferta-activada.png') })
    const duplicate = await json(`${e3}/ofertas/activar`, { publicationId: publication.id, publicationVersion: publication.publicationVersion, expectedActiveRunId: null })
    assert.equal(duplicate.reused, true)
    assert.deepEqual(duplicate.offer, activation.offer)
    const operational = await readContext('SYN-SIS-A', activation.offer.runId)
    assert.equal(operational.data.scope.period, '2027-I')
    assert.ok(occupancy(operational.data.offer).every(row => row[2] === 0))
    assert.deepEqual((await readContext('SYN-SIS-A')).data.offer, legacy.data.offer)
    await writeFile(statePath, JSON.stringify({ publication, a, b, demand, offer: activation.offer, legacyOccupancy: occupancy(legacy.data.offer) }, null, 2))
    console.log('PASS prepare: real E1 engine/review/publication, two E2 browser intentions, demand, activation/duplicate/zero occupancy and legacy isolation')
  } else {
    const state = JSON.parse(await readFile(statePath, 'utf8'))
    const { runId } = state.offer
    if (phase === 'resume') {
      assert.ok(state.browserIdentity, 'Confirm must save the prior browser session before restarting')
      await page.addInitScript(value => {
        if (sessionStorage.getItem('cycle:restored') !== '1') {
          sessionStorage.setItem('lp:session', value)
          sessionStorage.setItem('cycle:restored', '1')
        }
      }, state.browserIdentity)
      await page.goto(`${base}/local/matricula-regular`)
      await page.waitForURL(url => url.pathname === '/local/login' && url.searchParams.get('runId') === runId)
      await page.locator('input[name="profile"][value="SYN-SIS-A"]').waitFor()
      assert.equal(await page.locator('input[name="scenario"]').count(), 0)
      assert.equal(await page.locator('input[name="profile"]').count(), 2)
      await page.locator('input[name="profile"][value="SYN-SIS-A"]').check()
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
      await page.waitForURL('**/alumnoWebSum/v2/inicio')
    } else await enter('SYN-SIS-A', runId)
    assert.ok((await page.locator('.student-summary').innerText()).includes('2027-1'))
    if (phase === 'confirm') {
      await page.goto(`${base}/local/matricula-regular`)
      const imported = responseFor(`${e2}/intencion/traslado`)
      await page.getByRole('button', { name: 'Cargar mi intención', exact: true }).click()
      const importedResponse = await imported
      assert.equal(importedResponse.status(), 200, await importedResponse.text())
      const transfer = await importedResponse.json()
      const identity = importedResponse.request().postDataJSON().identity
      assert.equal(transfer.selection.length, 4, JSON.stringify(transfer.issues))
      assert.deepEqual(transfer.issues, [])
      assert.equal(await page.locator('.sum-enrollment__section-badge').count(), 4)
      const before = await readContext('SYN-SIS-A', runId)
      const intentionBefore = await json(`${e2}/intencion/contexto`, { identity })
      // Move the entire itinerary to its second sections, keeping the generated cohort compatible.
      for (const choice of transfer.selection) {
        const target = page.locator('.sum-enrollment__table tbody tr').filter({ hasText: choice.courseId }).first()
        await target.getByRole('button', { name: /Elegir sección|Cambiar sección/ }).click()
        const picker = page.getByRole('dialog', { name: 'Secciones disponibles' })
        await picker.locator('input[type="radio"]').nth(1).check()
        await picker.getByRole('button', { name: '✓ Aceptar', exact: true }).click()
      }
      assert.deepEqual(occupancy((await readContext('SYN-SIS-A', runId)).data.offer), occupancy(before.data.offer))
      await page.screenshot({ path: resolve(evidence, 'matricula-2027-editable.png'), fullPage: true })
      await page.getByRole('button', { name: 'Ejecutar Matrícula', exact: true }).click()
      const submitted = responseFor(`${e3}/solicitudes`)
      await page.getByRole('button', { name: 'EJECUTAR', exact: true }).click()
      const submission = await submitted
      assert.equal(submission.status(), 200, await submission.text())
      const outcome = await submission.json()
      assert.equal(outcome.data.state, 'accepted', JSON.stringify(outcome.data))
      const payload = submission.request().postDataJSON()
      const after = await readContext('SYN-SIS-A', runId)
      assert.equal(occupancy(after.data.offer).reduce((sum, row) => sum + row[2], 0), 4)
      assert.deepEqual(await json(`${e3}/solicitudes`, payload), outcome)
      assert.deepEqual(occupancy((await readContext('SYN-SIS-A', runId)).data.offer), occupancy(after.data.offer))
      assert.deepEqual(await json(`${e2}/intencion/contexto`, { identity }), intentionBefore)
      await page.waitForURL(url => url.pathname === `/local/matricula-regular/reporte/${outcome.data.enrollmentId}`)
      await page.getByRole('heading', { name: 'ASIGNATURAS MATRICULADAS', exact: true }).waitFor()
      assert.equal(await page.locator('.regular-enrollment-report__card tbody tr').count(), 4)
      assert.ok((await page.locator('.student-summary').innerText()).includes('2027-1'))
      assert.deepEqual(await page.locator('.regular-enrollment-report__card tbody tr td:nth-child(4)').allTextContents(), ['2', '2', '2', '2'])
      await page.screenshot({ path: resolve(evidence, 'matricula-2027-confirmada.png'), fullPage: true })
      const report = await json(`/api/local/perfiles/v1/consultas/matricula?${new URLSearchParams(identity)}`)
      assert.ok(report.data.payload)
      assert.equal(report.data.payload.totalCredits, 12)
      const browserIdentity = await page.evaluate(() => sessionStorage.getItem('lp:session'))
      assert.ok(browserIdentity)
      await writeFile(statePath, JSON.stringify({ ...state, payload, outcome, finalOccupancy: occupancy(after.data.offer), report: report.data.payload, intentionBefore, browserIdentity }, null, 2))
      console.log('PASS confirm: browser operational login, real import, editable section, existing engine confirmation, report, idempotency and immutable E2')
    } else if (phase === 'capture') {
      // Read-only recovery of an already confirmed run if the verifier lost its local report step.
      const session = await json(`${e3}/sesiones`, { runId, actorId: 'SYN-SIS-A' })
      const identity = { runId, actorId: 'SYN-SIS-A', sessionId: session.data.sessionId }
      const report = (await json(`/api/local/perfiles/v1/consultas/matricula?${new URLSearchParams(identity)}`)).data.payload
      assert.ok(report)
      assert.equal(report.totalCredits, 12)
      const outcome = { runId, data: (await json(`${e3}/solicitudes/${report.requestId}?${new URLSearchParams({ runId, actorId: 'SYN-SIS-A' })}`)).data.outcome }
      assert.equal(outcome.data.state, 'accepted')
      const payload = { ...identity, requestId: report.requestId, profileRevision: report.profileRevision, selection: outcome.data.selection }
      const after = await readContext('SYN-SIS-A', runId)
      assert.equal(occupancy(after.data.offer).reduce((sum, row) => sum + row[2], 0), 4)
      assert.deepEqual(await json(`${e3}/solicitudes`, payload), outcome)
      const intentionBefore = await json(`${e2}/intencion/contexto`, { identity })
      assert.deepEqual(intentionBefore.intention, state.a.intention)
      await page.goto(`${base}/local/matricula-regular/reporte/${report.enrollmentId}?${new URLSearchParams({ runId, actorId: 'SYN-SIS-A' })}`)
      await page.getByRole('heading', { name: 'ASIGNATURAS MATRICULADAS', exact: true }).waitFor()
      assert.equal(await page.locator('.regular-enrollment-report__card tbody tr').count(), 4)
      await page.screenshot({ path: resolve(evidence, 'matricula-2027-confirmada.png'), fullPage: true })
      const browserIdentity = await page.evaluate(() => sessionStorage.getItem('lp:session'))
      assert.ok(browserIdentity)
      await writeFile(statePath, JSON.stringify({ ...state, payload, outcome, finalOccupancy: occupancy(after.data.offer), report, intentionBefore, browserIdentity }, null, 2))
      console.log('PASS capture: recovered confirmed outcome, idempotency, real report UI and unchanged registered E2 intention without another enrollment')
    } else {
      const session = await json(`${e3}/sesiones`, { runId, actorId: 'SYN-SIS-A' })
      const identity = { runId, actorId: 'SYN-SIS-A', sessionId: session.data.sessionId }
      assert.deepEqual(occupancy((await readContext('SYN-SIS-A', runId)).data.offer), state.finalOccupancy)
      const lookup = await json(`${e3}/solicitudes/${state.payload.requestId}?${new URLSearchParams({ runId, actorId: 'SYN-SIS-A' })}`)
      assert.equal(lookup.data.state, 'known')
      assert.deepEqual(lookup.data.outcome, state.outcome.data)
      assert.deepEqual((await json(`/api/local/perfiles/v1/consultas/matricula?${new URLSearchParams(identity)}`)).data.payload, state.report)
      assert.deepEqual((await json(`${e2}/intencion/contexto`, { identity })).intention, state.intentionBefore.intention)
      const sessionB = await json(`${e3}/sesiones`, { runId, actorId: 'SYN-SIS-B' })
      const identityB = { runId, actorId: 'SYN-SIS-B', sessionId: sessionB.data.sessionId }
      assert.deepEqual((await json(`${e2}/intencion/contexto`, { identity: identityB })).intention, state.b.intention)
      assert.deepEqual((await json(`${e3}/ofertas`)).items.find(offer => offer.runId === runId), state.offer)
      assert.deepEqual(await json(`${e1}/publicaciones/${state.publication.id}`), state.publication)
      assert.deepEqual(occupancy((await readContext('SYN-SIS-A')).data.offer), state.legacyOccupancy)
      await page.goto(`${base}/local/matricula-regular/reporte/${state.report.enrollmentId}?${new URLSearchParams({ runId, actorId: 'SYN-SIS-A' })}`)
      await page.getByRole('heading', { name: 'ASIGNATURAS MATRICULADAS', exact: true }).waitFor()
      assert.equal(await page.locator('.regular-enrollment-report__card tbody tr').count(), 4)
      await page.screenshot({ path: resolve(evidence, 'matricula-2027-reinicio.png'), fullPage: true })
      console.log('PASS resume: stable context, request lookup, report, occupations and immutable E1 after backend restart')
    }
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(outside, [])
} finally {
  await context.close()
  await browser.close()
}

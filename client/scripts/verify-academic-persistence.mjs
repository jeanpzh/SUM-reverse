// Split-process local acceptance helper. Each phase launches a fresh browser context.
import assert from 'node:assert/strict'
import { isPlanningCheckboxChecked, setPlanningCheckbox } from './planning-checkboxes.mjs'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

if (process.env.SUM_ACADEMIC_PERSISTENCE_SYNTHETIC !== '1') throw new Error('Se requiere una instancia propia explícitamente sintética')
const url = new URL(process.env.SUM_ACADEMIC_PERSISTENCE_BASE || 'http://127.0.0.1:5280')
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== '5280' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
  throw new Error('El verificador solo acepta la instancia sintética propia en 127.0.0.1:5280')
}
const phase = process.argv.find((arg) => arg.startsWith('--phase='))?.split('=')[1]
if (!['save', 'resume'].includes(phase)) throw new Error('Uso: node scripts/verify-academic-persistence.mjs --phase=save|resume')
const base = url.origin
const api = `${base}/api/local/programacion-academica/v1`
const root = fileURLToPath(new URL('../../', import.meta.url))
const evidenceDir = resolve(root, 'evidence/local/programacion-academica-persistence')
const statePath = resolve(evidenceDir, 'synthetic-draft.json')
const outputPath = resolve(evidenceDir, `phase-${phase}.png`)
await mkdir(evidenceDir, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) })
const errors = []
const read = async (page, path) => {
  const response = await page.request.get(`${base}/api${path}`)
  assert.equal(response.status(), 200, `${path}: ${await response.text()}`)
  return response.json()
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => assert.ok(request.url().startsWith(`${base}/`) || request.url().startsWith('data:'), `Solicitud externa inesperada: ${request.url()}`))
  const offerBefore = (await read(page, '/local/matricula-regular/v1/contextos/SYN-SIS-A')).data.offer
  await page.goto(`${base}/local/programacion-academica`)
  await page.getByRole('heading', { name: 'Programación académica asistida', exact: true }).waitFor()

  if (phase === 'save') {
    const catalog = await read(page, '/local/programacion-academica/v1/catalogo')
    const course = catalog.courses.find((item) => item.planningPatterns?.[0]?.weeklySessions.length > 0
      && catalog.teachers.some((teacher) => teacher.courseIds.includes(item.courseId))
      && catalog.rooms.some((room) => room.capacity >= item.targetCapacity))
    assert.ok(course, 'El catálogo sintético requiere un patrón completo con docente y ambiente compatibles')
    await setPlanningCheckbox(page.getByRole('checkbox', { name: `Seleccionar ${course.courseId}`, exact: true }))
    const estimatePending = page.waitForResponse((response) => response.url().endsWith('/demanda/estimar') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Estimar demanda potencial', exact: true }).click()
    const estimateResponse = await estimatePending
    assert.equal(estimateResponse.status(), 200, await estimateResponse.text())
    const estimate = await estimateResponse.json()
    const baseDemand = estimate.rows.find((row) => row.courseId === course.courseId)?.baseDemand
    assert.ok(Number.isSafeInteger(baseDemand) && baseDemand >= 0)
    const finalDemand = baseDemand === 1 ? 2 : 1
    await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).fill(String(finalDemand))
    const generationPending = page.waitForResponse((response) => response.url().endsWith('/propuestas') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
    const generationResponse = await generationPending
    assert.equal(generationResponse.status(), 200, await generationResponse.text())
    const proposal = await generationResponse.json()
    assert.equal(proposal.status, 'complete', `La preparación sintética requiere horario completo; recibió ${proposal.status}`)
    assert.ok(proposal.assignments.length > 0)
    const sectionId = proposal.assignments[0].sectionId
    const originalAssignment = proposal.assignments.find((item) => item.sectionId === sectionId)
    const nextStart = originalAssignment.startMinute + 60
    const teacher = catalog.teachers.find((item) => item.id === originalAssignment.teacherId)
    const room = catalog.rooms.find((item) => item.id === originalAssignment.roomId)
    const duration = originalAssignment.endMinute - originalAssignment.startMinute
    assert.ok(catalog.windows.some((item) => item.day === originalAssignment.day && item.startMinute <= nextStart && item.endMinute >= nextStart + duration))
    assert.ok(teacher?.availability.some((item) => item.day === originalAssignment.day && item.startMinute <= nextStart && item.endMinute >= nextStart + duration))
    assert.ok(room?.availability.some((item) => item.day === originalAssignment.day && item.startMinute <= nextStart && item.endMinute >= nextStart + duration))
    await page.locator('.academic-scheduling__sections-table').getByRole('button', { name: 'Editar horario', exact: true }).first().click()
    await page.getByLabel(`Inicio revisión ${sectionId}`, { exact: true }).fill(`${String(Math.floor(nextStart / 60)).padStart(2, '0')}:${String(nextStart % 60).padStart(2, '0')}`)
    const adjustmentPending = page.waitForResponse((response) => response.url().endsWith('/ajustes') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Aplicar ajuste', exact: true }).click()
    const adjustmentResponse = await adjustmentPending
    assert.equal(adjustmentResponse.status(), 200, await adjustmentResponse.text())
    const adjusted = await adjustmentResponse.json()
    assert.equal(adjusted.editVersion, 1)
    assert.ok(adjusted.manuallyAdjustedSectionIds.includes(sectionId))
    const movedAssignment = adjusted.assignments.find((item) => item.sessionId === originalAssignment.sessionId)
    assert.equal(movedAssignment.startMinute, nextStart)

    await page.getByLabel('Nombre de la propuesta', { exact: true }).fill('Persistencia E1 sintética')
    await page.getByLabel('Estado de la propuesta', { exact: true }).selectOption('ready-for-review')
    const savePending = page.waitForResponse((response) => response.url().endsWith('/borradores/guardar') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Guardar propuesta', exact: true }).click()
    const saveResponse = await savePending
    assert.equal(saveResponse.status(), 200, await saveResponse.text())
    const saved = await saveResponse.json()
    const saveBody = saveResponse.request().postDataJSON()
    assert.equal(saved.state, 'ready-for-review')
    assert.deepEqual(Object.keys(saveBody).sort(), ['configuration', 'expectedVersion', 'id', 'proposalEditVersion', 'proposalId', 'state', 'title'])
    assert.equal(saveBody.id, null)
    assert.equal(saveBody.expectedVersion, null)
    assert.equal(saveBody.configuration.schoolId, 'SISTEMAS')
    assert.equal(saveBody.configuration.academicPeriod, '2027-I')
    assert.equal(saveBody.configuration.demandBaseRequest.courses[0].courseId, course.courseId)
    assert.notEqual(saveBody.configuration.request.demands[0].estimatedDemand, saved.demandBase.rows[0].baseDemand)
    assert.ok(saved.proposal.manuallyAdjustedSectionIds.includes(sectionId))

    // Advance the saved version through a second independent writer, then prove the UI's stale write is rejected.
    const concurrentBody = { id: saved.id, expectedVersion: saved.version, title: saved.title, state: 'draft',
      configuration: saved.configuration, proposalId: saved.proposal.proposalId, proposalEditVersion: saved.proposal.editVersion }
    concurrentBody.state = 'ready-for-review'
    const concurrent = await page.request.post(`${api}/borradores/guardar`, { data: concurrentBody })
    assert.equal(concurrent.status(), 200, await concurrent.text())
    const advanced = await concurrent.json()
    await page.getByLabel('Nombre de la propuesta', { exact: true }).fill('Edición local desactualizada')
    const stalePending = page.waitForResponse((response) => response.url().endsWith('/borradores/guardar') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Guardar propuesta', exact: true }).click()
    const staleResponse = await stalePending
    assert.equal(staleResponse.status(), 409)
    await page.getByRole('alert').filter({ hasText: 'No se guardaron los cambios' }).waitFor()
    assert.equal(await page.getByLabel('Nombre de la propuesta', { exact: true }).inputValue(), 'Edición local desactualizada')
    await page.locator('.planning-scope-header__draft-state').filter({ hasText: 'Cambios sin guardar' }).waitFor()
    await page.locator('.academic-scheduling__draft-bar').screenshot({ path: outputPath })
    await page.locator('.academic-scheduling__result').screenshot({ path: resolve(evidenceDir, 'phase-save-result.png') })
    const runtimeProposalId = saved.proposal.proposalId
    await writeFile(statePath, `${JSON.stringify({ id: advanced.id, version: advanced.version, title: advanced.title,
      courseId: course.courseId, finalDemand, baseDemand, proposalStatus: advanced.proposal.status,
      editVersion: advanced.proposal.editVersion, runtimeProposalId,
      manuallyAdjustedSectionIds: advanced.proposal.manuallyAdjustedSectionIds }, null, 2)}\n`)
  } else {
    const saved = JSON.parse(await readFile(statePath, 'utf8'))
    const course = (await read(page, '/local/programacion-academica/v1/catalogo')).courses.find((item) => item.courseId === saved.courseId)
    assert.ok(course, 'El curso sintético guardado debe existir en el mismo catálogo')
    const listPending = page.waitForResponse((response) => response.url().endsWith('/borradores') && response.request().method() === 'GET')
    await page.getByRole('button', { name: 'Mis propuestas', exact: true }).click()
    const listResponse = await listPending
    assert.equal(listResponse.status(), 200, await listResponse.text())
    const list = await listResponse.json()
    const row = list.items.find((item) => item.id === saved.id)
    assert.ok(row)
    assert.equal(row.version, saved.version)
    assert.equal(row.schoolId, 'SISTEMAS')
    assert.equal(row.academicPeriod, '2027-I')
    const resumePending = page.waitForResponse((response) => response.url().endsWith(`/borradores/${saved.id}/continuar`) && response.request().method() === 'POST')
    const savedRow = page.locator('.academic-scheduling__saved-row').filter({ hasText: saved.title })
    await savedRow.getByRole('button', { name: 'Continuar edición', exact: true }).click()
    const resumedResponse = await resumePending
    assert.equal(resumedResponse.status(), 200, await resumedResponse.text())
    const resumed = await resumedResponse.json()
    assert.equal(resumed.draft.id, saved.id)
    assert.equal(resumed.draft.version, saved.version)
    assert.notEqual(resumed.draft.proposal.proposalId, saved.runtimeProposalId)
    assert.equal(await isPlanningCheckboxChecked(page.getByRole('checkbox', { name: `Seleccionar ${saved.courseId}`, exact: true })), true)
    assert.equal(await page.getByLabel(`Demanda ${saved.courseId}`, { exact: true }).inputValue(), String(saved.finalDemand))
    assert.deepEqual(resumed.draft.proposal.manuallyAdjustedSectionIds, saved.manuallyAdjustedSectionIds)
    assert.equal(await page.getByLabel('Estado de la propuesta', { exact: true }).inputValue(), 'ready-for-review')
    await page.locator('.academic-scheduling__result').getByText('Componentes asignados', { exact: true }).waitFor()
    await page.locator('.academic-scheduling__draft-bar').screenshot({ path: outputPath })

    // A demand edit invalidates the recovered result and downgrades its state before saving config only.
    const changedDemand = saved.finalDemand + 1
    await page.getByLabel(`Demanda ${saved.courseId}`, { exact: true }).fill(String(changedDemand))
    assert.equal(await page.locator('.academic-scheduling__result').count(), 0)
    assert.equal(await page.getByLabel('Estado de la propuesta', { exact: true }).inputValue(), 'draft')
    const configSavePending = page.waitForResponse((response) => response.url().endsWith('/borradores/guardar') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Guardar propuesta', exact: true }).click()
    const configSaveResponse = await configSavePending
    assert.equal(configSaveResponse.status(), 200, await configSaveResponse.text())
    const configSaved = await configSaveResponse.json()
    assert.equal(configSaveResponse.request().postDataJSON().id, saved.id)
    assert.equal(configSaveResponse.request().postDataJSON().expectedVersion, saved.version)
    assert.equal(configSaveResponse.request().postDataJSON().proposalId, null)
    assert.equal(configSaved.version, saved.version + 1)
    assert.equal(configSaved.state, 'draft')
    assert.equal(configSaved.proposal, null)

    // A separate context recovers the changed configuration and confirms no old schedule reappears.
    const freshContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const freshPage = await freshContext.newPage()
    freshPage.on('pageerror', (error) => errors.push(error.message))
    await freshPage.goto(`${base}/local/programacion-academica`)
    const freshListPending = freshPage.waitForResponse((response) => response.url().endsWith('/borradores') && response.request().method() === 'GET')
    await freshPage.getByRole('button', { name: 'Mis propuestas', exact: true }).click()
    await freshListPending
    const freshRow = freshPage.locator('.academic-scheduling__saved-row').filter({ hasText: saved.title })
    const freshResumePending = freshPage.waitForResponse((response) => response.url().endsWith(`/borradores/${saved.id}/continuar`))
    await freshRow.getByRole('button', { name: 'Continuar edición', exact: true }).click()
    const freshResume = await freshResumePending
    assert.equal(freshResume.status(), 200)
    const freshDraft = (await freshResume.json()).draft
    assert.equal(freshDraft.version, configSaved.version)
    assert.equal(freshDraft.proposal, null)
    assert.equal(await freshPage.getByLabel(`Demanda ${saved.courseId}`, { exact: true }).inputValue(), String(changedDemand))
    assert.equal(await freshPage.locator('.academic-scheduling__result').count(), 0)
    await freshContext.close()
  }

  const offerAfter = (await read(page, '/local/matricula-regular/v1/contextos/SYN-SIS-A')).data.offer
  assert.deepEqual(offerAfter, offerBefore, 'La persistencia local no debe modificar la oferta académica sintética')
  assert.deepEqual(errors, [], 'No se esperan errores del navegador')
  console.log(`Fase ${phase} correcta: ${outputPath}`)
} finally {
  await browser.close()
}

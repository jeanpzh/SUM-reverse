// Two-phase browser acceptance against the dedicated, explicitly synthetic 5280 service only.
import assert from 'node:assert/strict'
import { setPlanningCheckbox } from './planning-checkboxes.mjs'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

if (process.env.SUM_ACADEMIC_PUBLICATION_SYNTHETIC !== '1') throw new Error('Se requiere una instancia propia explícitamente sintética')
const url = new URL(process.env.SUM_ACADEMIC_PUBLICATION_BASE || 'http://127.0.0.1:5280')
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== '5280' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
  throw new Error('El verificador solo acepta la instancia sintética propia en 127.0.0.1:5280')
}
const phase = process.argv.find((arg) => arg.startsWith('--phase='))?.split('=')[1]
if (!['save', 'resume'].includes(phase)) throw new Error('Uso: node scripts/verify-academic-publication.mjs --phase=save|resume')
const base = url.origin
const api = `${base}/api/local/programacion-academica/v1`
const root = fileURLToPath(new URL('../../', import.meta.url))
const evidenceDir = resolve(root, 'evidence/local/programacion-academica-publication')
const statePath = resolve(evidenceDir, 'synthetic-publications.json')
await mkdir(evidenceDir, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) })
const errors = []
const requestJson = async (page, path, init) => {
  const response = await page.request.fetch(path.startsWith('http') ? path : `${api}${path}`, init)
  assert.equal(response.status(), 200, `${path}: ${await response.text()}`)
  return response.json()
}
const apiResponse = (response, suffix, method = 'GET') => new URL(response.url()).pathname.endsWith(suffix)
  && response.request().method() === method

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => assert.ok(request.url().startsWith(`${base}/`) || request.url().startsWith('data:'), `Solicitud externa inesperada: ${request.url()}`))
  await page.goto(`${base}/local/programacion-academica`)
  await page.getByRole('heading', { name: 'Programación académica asistida', exact: true }).waitFor()
  const readOffer = async () => {
    const response = await page.request.get(`${base}/api/local/matricula-regular/v1/contextos/SYN-SIS-A`)
    assert.equal(response.status(), 200, await response.text())
    return (await response.json()).data.offer
  }
  const offerBefore = await readOffer()
  const stage = async (name, etapa) => {
    await page.getByRole('navigation', { name: 'Etapas de programación', exact: true }).getByRole('link', { name, exact: true }).click()
    await page.waitForURL(new RegExp(`etapa=${etapa}$`))
  }
  const openPanel = async () => {
    const summary = page.locator('.academic-publication > summary')
    await summary.waitFor()
    if (await summary.evaluate((element) => !(element.parentElement instanceof HTMLDetailsElement) || !element.parentElement.open)) await summary.click()
  }
  await stage('Aprobación', 'aprobacion')
  await openPanel()
  const refreshPublicationList = async () => {
    const response = page.waitForResponse((value) => apiResponse(value, '/publicaciones'))
    await page.getByRole('button', { name: 'Actualizar publicaciones', exact: true }).click()
    return (await response).json()
  }
  const previewCurrent = async (draftId) => {
    const response = page.waitForResponse((value) => apiResponse(value, `/borradores/${draftId}/vista-previa`))
    await page.getByRole('button', { name: 'Actualizar vista previa', exact: true }).click()
    return response
  }
  const submitAndConform = async (id) => {
    await stage('Revisión docente', 'revision')
    if (await page.locator('.academic-teacher-review > summary').evaluate((element) => !(element.parentElement instanceof HTMLDetailsElement) || !element.parentElement.open)) {
      await page.locator('.academic-teacher-review > summary').click()
    }
    const submitResponse = page.waitForResponse((value) => apiResponse(value, `/borradores/${id}/revision/enviar`, 'POST'))
    await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click()
    let state = (await (await submitResponse).json()).draft
    for (const teacher of state.review.teachers) {
      await page.getByLabel('Rol simulado de revisión', { exact: true }).selectOption('teacher')
      await page.getByLabel('Docente de revisión', { exact: true }).selectOption(teacher.teacherId)
      const response = page.waitForResponse((value) => apiResponse(value, `/borradores/${id}/revision/responder`, 'POST'))
      await page.getByRole('button', { name: 'Dar conformidad', exact: true }).click()
      state = (await (await response).json()).draft
    }
    assert.equal(state.state, 'ready-for-approval')
    await page.getByLabel('Rol simulado de revisión', { exact: true }).selectOption('school')
    return state
  }
  const approveAndPublish = async (saved) => {
    await stage('Aprobación', 'aprobacion')
    await openPanel()
    const previewResponse = await previewCurrent(saved.id)
    const preview = await previewResponse.json()
    assert.equal(preview.version, saved.version)
    assert.equal(preview.state, 'ready-for-approval')
    const approvalResponse = page.waitForResponse((value) => apiResponse(value, `/borradores/${saved.id}/aprobar`, 'POST'))
    await page.getByRole('button', { name: 'Aprobar (simulada)', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Aprobar', exact: true }).click()
    const approved = (await (await approvalResponse).json()).draft
    assert.equal(approved.state, 'approved')
    assert.equal(approved.version, saved.version + 1)
    const approvedPreviewResponse = await previewCurrent(saved.id)
    const approvedPreview = await approvedPreviewResponse.json()
    assert.equal(approvedPreview.version, approved.version)
    assert.equal(approvedPreview.state, 'approved')
    const list = await refreshPublicationList()
    const publishResponse = page.waitForResponse((value) => apiResponse(value, `/borradores/${saved.id}/publicar`, 'POST'))
    await page.getByRole('button', { name: 'Publicar (simulada)', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Publicar', exact: true }).click()
    const publishedResponse = await publishResponse
    const published = (await publishedResponse.json()).draft
    assert.equal(published.state, 'published')
    assert.deepEqual(publishedResponse.request().postDataJSON(), { expectedVersion: approved.version, expectedCurrentId: list.currentId })
    const persisted = await requestJson(page, `/publicaciones/${saved.id}`)
    assert.equal(persisted.publicationVersion, published.publication.publicationVersion)
    assert.deepEqual(persisted.schedule, approvedPreview.schedule)
    return { draft: published, publication: persisted }
  }

  if (phase === 'save') {
    const catalog = await requestJson(page, '/catalogo')
    await stage('Preparación', 'preparacion')
    const course = catalog.courses.find((item) => item.planningPatterns?.some((pattern) => pattern.weeklySessions.length > 0)
      && catalog.teachers.some((teacher) => teacher.courseIds.includes(item.courseId))
      && catalog.rooms.some((room) => room.capacity >= item.targetCapacity))
    assert.ok(course, 'El catálogo debe ofrecer al menos un patrón sintético programable')
    const pattern = course.planningPatterns.find((item) => item.weeklySessions.length > 0)
    await setPlanningCheckbox(page.getByRole('checkbox', { name: `Seleccionar ${course.courseId}`, exact: true }))
    await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).fill('1')
    await page.getByLabel(`Patrón ${course.courseId}`, { exact: true }).selectOption(pattern.id)
    const generate = page.waitForResponse((response) => apiResponse(response, '/propuestas', 'POST'))
    await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
    const proposal = await (await generate).json()
    assert.equal(proposal.status, 'complete')
    assert.ok(proposal.assignments.length)
    const title1 = `Publicación sintética ${Date.now()}`
    await page.getByLabel('Nombre de la propuesta', { exact: true }).fill(title1)
    const save1Response = page.waitForResponse((response) => apiResponse(response, '/borradores/guardar', 'POST'))
    await page.getByRole('button', { name: 'Guardar propuesta', exact: true }).click()
    const saved1 = await save1Response.then((response) => response.json())
    assert.equal(saved1.state, 'draft')
    const ready1 = await submitAndConform(saved1.id)
    const first = await approveAndPublish(ready1)

    await openPanel()
    await refreshPublicationList()
    await page.getByLabel('Consultar publicación', { exact: true }).selectOption(first.publication.id)
    const forkResponse = page.waitForResponse((response) => apiResponse(response, `/borradores/${first.draft.id}/nuevo-borrador`, 'POST'))
    await page.getByRole('button', { name: 'Crear nuevo borrador', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Crear borrador', exact: true }).click()
    const forkedResponse = await forkResponse
    const forked = (await forkedResponse.json()).draft
    assert.notEqual(forked.id, first.draft.id)
    assert.equal(forked.version, 1)
    assert.equal(forkedResponse.request().postDataJSON().expectedVersion, first.draft.version)
    const forkTitle = `${title1} · revisión 2`
    await stage('Preparación', 'preparacion')
    await page.getByLabel('Nombre de la propuesta', { exact: true }).fill(forkTitle)
    const save2Response = page.waitForResponse((response) => apiResponse(response, '/borradores/guardar', 'POST'))
    await page.getByRole('button', { name: 'Guardar propuesta', exact: true }).click()
    const saved2 = await save2Response.then((response) => response.json())
    assert.equal(saved2.id, forked.id)
    assert.equal(saved2.origin.draftId, first.draft.id)
    assert.deepEqual(await requestJson(page, `/publicaciones/${first.draft.id}`), first.publication)
    const ready2 = await submitAndConform(saved2.id)
    const second = await approveAndPublish(ready2)
    assert.equal(second.publication.publicationVersion, first.publication.publicationVersion + 1)
    const history = await requestJson(page, '/publicaciones')
    assert.equal(history.currentId, second.draft.id)
    assert.ok(history.items.some((item) => item.id === first.draft.id))
    assert.ok(history.items.some((item) => item.id === second.draft.id))
    assert.deepEqual(await requestJson(page, `/publicaciones/${first.draft.id}`), first.publication)
    assert.deepEqual(await readOffer(), offerBefore, 'La aprobación y publicación no modifican la oferta sintética')
    await openPanel()
    await page.locator('.academic-publication').screenshot({ path: resolve(evidenceDir, 'phase-save-publication-panel.png') })
    await writeFile(statePath, `${JSON.stringify({ first: { id: first.draft.id, version: first.draft.version, publicationVersion: first.publication.publicationVersion },
      second: { id: second.draft.id, version: second.draft.version, publicationVersion: second.publication.publicationVersion },
      title: second.draft.title, currentId: history.currentId, itemIds: history.items.map((item) => item.id) }, null, 2)}\n`)
  } else {
    const saved = JSON.parse(await readFile(statePath, 'utf8'))
    await stage('Aprobación', 'aprobacion')
    const history = await refreshPublicationList()
    assert.deepEqual(history.items.map((item) => item.id).sort(), [...saved.itemIds].sort())
    assert.equal(history.currentId, saved.currentId)
    for (const item of [saved.first, saved.second]) {
      const publication = await requestJson(page, `/publicaciones/${item.id}`)
      assert.equal(publication.publicationVersion, item.publicationVersion)
      const summary = history.items.find((entry) => entry.id === item.id)
      assert.ok(summary)
      await page.getByLabel('Consultar publicación', { exact: true }).selectOption(item.id)
      const response = page.waitForResponse((value) => apiResponse(value, item.id === history.currentId
        ? '/publicaciones/vigente' : `/publicaciones/${item.id}`))
      await page.getByRole('button', { name: 'Actualizar vista previa', exact: true }).click()
      const previewResponse = await response
      assert.equal(previewResponse.status(), 200)
      assert.equal((await previewResponse.json()).id, item.id)
      await page.locator('.academic-publication__table').waitFor()
      await page.locator('.academic-publication').screenshot({ path: resolve(evidenceDir, `phase-resume-publication-${item.publicationVersion}.png`) })
    }
    const oldPublicationBefore = await requestJson(page, `/publicaciones/${saved.second.id}`)
    await stage('Preparación', 'preparacion')
    await page.getByRole('button', { name: 'Mis propuestas', exact: true }).click()
    const row = page.locator('.academic-scheduling__saved-row').filter({ hasText: saved.title })
    const resumeResponse = page.waitForResponse((response) => apiResponse(response, `/borradores/${saved.second.id}/continuar`, 'POST'))
    await row.getByRole('button', { name: 'Consultar', exact: true }).click()
    const recovered = (await (await resumeResponse).json()).draft
    assert.equal(recovered.state, 'published')
    assert.equal(recovered.version, saved.second.version)
    await stage('Aprobación', 'aprobacion')
    const forkResponse = page.waitForResponse((response) => apiResponse(response, `/borradores/${saved.second.id}/nuevo-borrador`, 'POST'))
    await page.getByRole('button', { name: 'Crear nuevo borrador', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Crear borrador', exact: true }).click()
    const forked = (await (await forkResponse).json()).draft
    assert.notEqual(forked.id, saved.second.id)
    assert.equal(forked.origin.draftId, saved.second.id)
    assert.deepEqual(await requestJson(page, `/publicaciones/${saved.second.id}`), oldPublicationBefore)
    assert.deepEqual(await readOffer(), offerBefore, 'La recuperación del historial no modifica la oferta sintética')
  }
  assert.deepEqual(errors, [], 'No se esperan errores en la consola del navegador')
  await context.close()
  console.log(`PASS: aprobación/publicación ${phase} en la instancia sintética 5280`)
} finally {
  await browser.close()
}

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

if (process.env.SUM_E3_SYNTHETIC !== '1') throw new Error('Confirma SUM_E3_SYNTHETIC=1 para el Compose sintético propio')
const base = 'http://127.0.0.1:5280'
const e2 = '/api/local/prematricula/v1/intencion'
const e3 = '/api/local/matricula-regular/v1'
const transfer = `${e2}/traslado`
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) })

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  const submissions = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === `${e3}/solicitudes`) submissions.push(request.url())
  })
  const actorId = 'SYN-SIS-A'
  await page.goto(`${base}/local/login`)
  await page.locator('input[name="scenario"][value="regular"]').check()
  await page.locator(`input[name="profile"][value="${actorId}"]`).check()
  await page.getByRole('button', { name: 'Iniciar prueba', exact: true }).click()
  await page.waitForURL('**/alumnoWebSum/v2/inicio')
  await page.goto(`${base}/local/matricula-regular`)
  const load = page.getByRole('button', { name: 'Cargar mi intención', exact: true })
  const badges = page.locator('.sum-enrollment__section-badge')
  const firstRow = page.locator('.sum-enrollment__table tbody tr').first()
  const secondRow = page.locator('.sum-enrollment__table tbody tr').nth(1)
  async function json(path, data) {
    const response = await page.request.fetch(`${base}${path}`, data === undefined ? {} : { method: 'POST', data })
    assert.equal(response.status(), 200, await response.text())
    return response.json()
  }
  const context = await json(`${e3}/contextos/${actorId}`)
  const offer = context.data.offer
  assert.equal(context.data.scope.period, '2026-II')
  await firstRow.getByRole('button', { name: /Elegir sección/ }).click()
  const picker = page.getByRole('dialog', { name: 'Secciones disponibles' })
  await picker.locator('input[type="radio"]').first().check()
  await picker.getByRole('button', { name: '✓ Aceptar', exact: true }).click()
  assert.equal(await badges.count(), 1)
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === transfer)
  await load.click()
  const response = await pending
  assert.equal(response.status(), 200, await response.text())
  const rejected = await response.json()
  const identity = response.request().postDataJSON().identity
  assert.equal(rejected.intention?.academicPeriod, '2027-I', 'Preparar previamente una intención E2 sintética')
  assert.deepEqual(rejected.selection, [])
  assert.ok(rejected.issues.length && rejected.issues.every(issue => issue.code === 'SCOPE_MISMATCH'))
  await page.getByText(/La intención pertenece a otro periodo/).first().waitFor()
  assert.equal(await badges.count(), 1)
  const intention = await json(`${e2}/contexto`, { identity })
  const publicationPath = `/api/local/programacion-academica/v1/publicaciones/${rejected.intention.publicationId}`
  const publication = await json(publicationPath)
  const reportPath = `/api/local/perfiles/v1/consultas/matricula?${new URLSearchParams(identity)}`
  const report = await json(reportPath)
  assert.equal(report.data.payload, null)

  // Exercise only client behavior with a controlled compatible response. The isolated backend
  // fixture covers the positive 2027-I mapping without installing an operational offer.
  const selectable = context.data.preEnrollment.map(item => offer.find(course => course.courseId === item.courseId)).filter(Boolean)
  const firstCode = (await firstRow.locator('td').nth(2).innerText()).split(' - ')[0]
  const secondCode = (await secondRow.locator('td').nth(2).innerText()).split(' - ')[0]
  const prior = selectable.find(course => course.courseId === firstCode)
  const next = selectable.find(course => course.courseId === secondCode)
  assert.ok(prior?.sections.length && next?.sections.length)
  const selection = [{ courseId: next.courseId, sectionId: next.sections[0].sectionId }]
  const compatible = {
    ...rejected, intention: { ...rejected.intention, academicPeriod: context.data.scope.period }, selection, issues: [],
  }
  await page.route(`**${transfer}`, route => route.fulfill({ json: compatible }))
  let dialog = page.waitForEvent('dialog')
  await Promise.all([load.click(), dialog.then(item => item.dismiss())])
  assert.equal(await firstRow.locator('.sum-enrollment__section-badge').count(), 1)
  dialog = page.waitForEvent('dialog')
  await Promise.all([load.click(), dialog.then(item => item.accept())])
  await secondRow.locator('.sum-enrollment__section-badge').waitFor()
  assert.equal(await firstRow.locator('.sum-enrollment__section-badge').count(), 0)
  await page.unroute(`**${transfer}`)
  const reached = Promise.withResolvers()
  const release = Promise.withResolvers()
  const settled = Promise.withResolvers()
  const lateDialogs = []
  page.on('dialog', item => { lateDialogs.push(item.message()); void item.dismiss() })
  await page.route(`**${transfer}`, async route => {
    reached.resolve()
    await release.promise
    try {
      await route.fulfill({ json: { ...compatible, selection: [{ courseId: prior.courseId, sectionId: prior.sections[0].sectionId }] } })
    } catch {
      // Chromium may cancel the request when the confirmation opens.
    } finally {
      settled.resolve()
    }
  })
  await load.click()
  await reached.promise
  await page.getByRole('button', { name: 'Ejecutar Matrícula', exact: true }).click()
  await page.getByText(/¿Está seguro de ejecutar la matrícula/).waitFor()
  release.resolve()
  await settled.promise
  await page.getByRole('button', { name: 'CANCELAR', exact: true }).click()
  assert.equal(await secondRow.locator('.sum-enrollment__section-badge').count(), 1)
  assert.deepEqual(lateDialogs, [])
  await secondRow.getByRole('button', { name: /Quitar sección/ }).click()
  assert.equal(await badges.count(), 0)
  const uncertain = { runId: context.runId, actorId, requestId: randomUUID(), profileRevision: context.data.profileRevision, selection }
  await page.evaluate(intent => sessionStorage.setItem(`mr:intent:${intent.runId}:${intent.actorId}`, JSON.stringify(intent)), uncertain)
  await page.reload()
  await page.getByRole('button', { name: 'Consultar resultado', exact: true }).waitFor()
  assert.equal(await load.isEnabled(), false)
  assert.deepEqual((await json(`${e3}/contextos/${actorId}`)).data.offer, offer)
  assert.deepEqual((await json(reportPath)).data.payload, report.data.payload)
  assert.deepEqual(await json(`${e2}/contexto`, { identity }), intention)
  assert.deepEqual(await json(publicationPath), publication)
  assert.deepEqual(submissions, [])
  assert.deepEqual(errors, [])
  console.log('PASS E3 import: real period mismatch and unchanged data, compatible UI fixture, overwrite protection, edit and uncertain lock')
} finally {
  await browser.close()
}

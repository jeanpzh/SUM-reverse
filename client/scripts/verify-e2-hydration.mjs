// Requires a caller-owned synthetic stack and publications from verify-e2-prematricula save.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

if (process.env.SUM_E2_BROWSER_VERIFY !== '1') throw new Error('Requires explicitly synthetic SUM_E2_BROWSER_VERIFY=1')
const base = 'http://127.0.0.1:5280'
const state = JSON.parse(await readFile(new URL('../../evidence/local/prematricula-e2-draft/browser-state.json', import.meta.url), 'utf8'))
assert.match(state.source, /synthetic/)
const target = state.newerPublication
const browser = await chromium.launch({ headless: true })
let release
const gate = new Promise((resolve) => { release = resolve })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('dialog', (dialog) => void dialog.accept())
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return url.origin === base || url.protocol === 'data:' ? route.continue() : route.abort()
  })
  await page.goto(`${base}/local/login`)
  await page.locator('input[name="scenario"][value="regular"]').check()
  await page.locator('input[name="profile"][value="SYN-SIS-A"]').check()
  await page.getByRole('button', { name: 'Iniciar prueba', exact: true }).click()
  await page.waitForURL('**/alumnoWebSum/v2/inicio')
  let delayed = false
  let ready
  const initialReady = new Promise((resolve) => { ready = resolve })
  let drained
  const initialDrained = new Promise((resolve) => { drained = resolve })
  await page.route('**/api/local/prematricula/v1/publicacion', async (route) => {
    if (delayed) return route.continue()
    delayed = true
    const response = await route.fetch()
    assert.equal(response.status(), 200)
    const body = await response.json()
    assert.notEqual(body.publication.id, target.id)
    ready()
    await gate
    try { await route.fulfill({ response }) } finally { drained() }
  })
  await page.goto(`${base}/alumnoWebSum/v2/reportes/prematricula`)
  await initialReady
  await page.locator('.student-premat > summary').click()
  await page.locator('.student-premat__controls select').selectOption(target.id)
  const queried = page.waitForResponse((response) => response.url().endsWith('/prematricula/v1/publicacion')
    && response.request().postDataJSON().publicationId === target.id)
  await page.getByRole('button', { name: 'Consultar', exact: true }).click()
  assert.equal((await queried).status(), 200)
  const row = page.locator('.student-premat table tbody tr').filter({ hasText: '20118091' }).first()
  await row.getByRole('button', { name: 'Elegir', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Secciones disponibles' })
  const radio = dialog.locator('input[type="radio"]').nth(1)
  await radio.check()
  const sectionId = await radio.getAttribute('value')
  const validated = page.waitForResponse((response) => response.url().endsWith('/prematricula/v1/validar')
    && response.request().postDataJSON().selection.some((item) => item.sectionId === sectionId))
  await dialog.getByRole('button', { name: '✓ Aceptar', exact: true }).click()
  assert.equal((await (await validated).json()).status, 'valid')
  release()
  await initialDrained
  await page.evaluate(async () => {
    for (let i = 0; i < 3; i += 1) await new Promise(requestAnimationFrame)
  })
  assert.equal(await page.locator('.student-premat__controls select').inputValue(), target.id)
  assert.equal((await row.locator('td').nth(3).innerText()).trim(), '2')
  assert.ok((await page.locator('.student-premat__body').innerText()).includes(target.title))
  const saved = page.waitForResponse((response) => response.url().endsWith('/prematricula/v1/guardar'))
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
  const response = await saved
  assert.equal(response.status(), 200)
  const result = await response.json()
  assert.equal(result.draft.publicationId, target.id)
  assert.deepEqual(result.draft.selection, [{ courseId: '20118091', sectionId }])
  assert.deepEqual(errors, [])
  console.log('PASS E2 hydration: delayed saved A cannot replace queried/edited B; real API saves B')
} finally {
  release()
  await browser.close()
}

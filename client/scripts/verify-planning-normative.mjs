// Root owns a fresh synthetic stack; never attach this to operator snapshots.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
if (process.env.SUM_REDESIGN_SYNTHETIC !== '1') throw new Error('Own synthetic stack required')
const base = new URL(process.env.SUM_REDESIGN_BASE || 'http://127.0.0.1:5746')
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('Dedicated loopback origin required')
const evidence = resolve(process.env.SUM_REDESIGN_EVIDENCE || '../evidence/local/planning-normative-2026-11-10')
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(20000)
page.setDefaultNavigationTimeout(45000)
const errors = []
const calls = []
const results = []
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => { if (request.url().includes('/normativa/consultas')) calls.push(request.url()) })
const check = async (id, action) => { await action(); results.push(id); console.log(`PASS ${id}`) }
const ask = async question => {
  await page.getByLabel('Pregunta normativa', { exact: true }).fill(question)
  const pending = page.waitForResponse(response => response.url().includes('/normativa/consultas'))
  await page.getByRole('button', { name: 'Enviar consulta', exact: true }).click()
  const response = await pending
  assert.equal(response.status(), 200)
  await page.getByRole('region', { name: 'Respuesta normativa', exact: true }).last().waitFor()
  return response.json()
}
const lastAnswer = () => page.getByRole('region', { name: 'Respuesta normativa', exact: true }).last()
try {
  await page.goto(`${base.origin}/local/programacion-academica`, { waitUntil: 'networkidle' })
  await page.locator('#planning-page-title').waitFor()
  await check('no-query-on-mount-or-open', async () => {
    assert.equal(calls.length, 0)
    if (await page.locator('#planning-toggle-chat').getAttribute('aria-expanded') !== 'true') await page.locator('#planning-toggle-chat').click()
    await page.getByLabel('Pregunta normativa', { exact: true }).waitFor()
    assert.equal(calls.length, 0)
  })
  await check('empty-evidence-has-one-visible-conclusion', async () => {
    const result = await ask('¿Cuál es la carga lectiva máxima?')
    assert.equal(result.context.teacherType, 'unknown')
    assert.equal(result.status, 'not-determined')
    const answer = lastAnswer()
    assert.equal(await answer.locator('.normative-advice__conclusion-title').count(), 1)
    const text = await answer.innerText()
    assert.ok(text.includes('Sin evidencia suficiente'))
    assert.ok(!text.includes('Respuesta extractiva determinista'))
    assert.ok(!text.includes('Sin fuentes normativas aplicables recuperadas'))
    assert.equal(await answer.getByRole('button', { name: /^Fuentes localizadas/ }).count(), 0)
    // The concise answer replaced the hidden full-answer toggle: the next step is visible at once.
    assert.equal(await answer.getByRole('button', { name: 'Ver respuesta completa', exact: true }).count(), 0)
    assert.ok(text.includes('Siguiente paso:'))
  })
  await check('partial-evidence-keyboard-disclosure-and-metadata', async () => {
    await page.locator('.planning-chat__context-summary').click()
    await page.getByLabel('Régimen docente').selectOption('ordinario')
    const result = await ask('¿Cuál es la carga lectiva máxima?')
    assert.equal(result.status, 'not-determined')
    assert.ok(result.citations.length > 0)
    const answer = lastAnswer()
    assert.ok((await answer.innerText()).includes('Aplicación sin confirmar'))
    const sources = answer.getByRole('button', { name: /^Fuentes localizadas/ })
    await sources.focus()
    await page.keyboard.press('Enter')
    assert.equal(await sources.getAttribute('aria-expanded'), 'true')
    assert.ok((await answer.innerText()).includes('página PDF'))
    assert.ok((await answer.innerText()).includes('Entrada en vigencia sin confirmar'))
    assert.equal(await answer.getByRole('link').count(), result.citations.length)
    await page.screenshot({ path: resolve(evidence, 'chat-partial-sources-1440.png') })
    await sources.focus()
    await page.keyboard.press('Enter')
    await answer.getByRole('button', { name: 'Detalles técnicos de la consulta', exact: true }).click()
    assert.ok((await answer.innerText()).includes('Solo léxica'))
    await answer.getByRole('button', { name: /^Alcance y verificaciones pendientes/ }).click()
    assert.ok((await answer.innerText()).includes('Repositorio vectorial no configurado'))
  })
  await check('transport-error-retry-and-cancel-remain-explicit', async () => {
    await page.route('**/normativa/consultas', route => route.abort())
    await page.getByLabel('Pregunta normativa', { exact: true }).fill('Consulta sintética de error')
    await page.getByRole('button', { name: 'Enviar consulta', exact: true }).click()
    await page.getByRole('button', { name: 'Reintentar consulta normativa', exact: true }).click()
    await page.getByRole('button', { name: 'Reintentar consulta normativa', exact: true }).waitFor()
    assert.equal(await page.getByLabel('Pregunta normativa', { exact: true }).inputValue(), '')
    await page.unroute('**/normativa/consultas')
    let held
    await page.route('**/normativa/consultas', route => { held = route })
    await page.getByLabel('Pregunta normativa', { exact: true }).fill('Consulta sintética para cancelar')
    await page.getByRole('button', { name: 'Enviar consulta', exact: true }).click()
    await page.getByRole('button', { name: 'Cancelar consulta', exact: true }).click()
    await page.getByText('Consulta cancelada.', { exact: true }).waitFor()
    if (held) await held.abort().catch(() => {})
    await page.unroute('**/normativa/consultas')
  })
  await check('history-preserved-and-mobile-reflows', async () => {
    await page.locator('#planning-toggle-chat').click()
    await page.locator('#planning-toggle-chat').click()
    assert.equal(await page.getByRole('region', { name: 'Respuesta normativa', exact: true }).count(), 1)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(() => document.querySelector('#planning-toggle-chat')?.getAttribute('aria-expanded') === 'false')
    await page.locator('#planning-toggle-chat').click()
    assert.equal(await page.getByRole('region', {name:'Respuesta normativa',exact:true}).count(),1)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: resolve(evidence, 'chat-partial-mobile-390.png') })
    await page.setViewportSize({ width: 720, height: 500 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.waitForFunction(() => document.querySelector('#planning-toggle-chat')?.getAttribute('aria-expanded') === 'false')
  })
  await check('advisor-shows-measured-impact-and-keeps-mutation-explicit', async () => {
    await page.getByRole('button', { name: /Seleccionar los .* cursos del catálogo/ }).click()
    const pending = page.waitForResponse(response => /\/propuestas$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
    await page.locator('#planning-tour-primary').click()
    assert.equal((await pending).status(), 200)
    await page.getByRole('button', { name: 'Consultar consejero', exact: true }).click()
    await page.locator('[data-advisor-impact="verified"]').waitFor({ timeout: 45000 })
    const impact = page.getByRole('status', { name: 'Impacto de la selección', exact: true })
    assert.ok((await impact.innerText()).includes('Actual'))
    assert.ok((await impact.innerText()).includes('Simulada'))
    assert.equal(await impact.getByRole('rowheader').count(), 2)
    const dialog = page.getByRole('dialog', { name: 'Consejero de planificación', exact: true })
    assert.ok((await dialog.innerText()).includes('Recomendaciones'))
    await page.screenshot({ path: resolve(evidence, 'advisor-impact-1440.png') })
  })
  assert.deepEqual(errors, [])
} finally {
  await writeFile(resolve(evidence, 'acceptance.json'), JSON.stringify({
    source: 'Own built-in synthetic stack; disabled LLM; public reviewed corpus; no snapshots or live AWS',
    base: base.origin, results, errors,
  }, null, 2))
  await browser.close()
}

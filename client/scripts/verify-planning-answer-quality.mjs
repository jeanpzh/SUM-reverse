// Actual UI + HTTP answers, with fixed sample-specific quality regressions.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { qualityCases } from './planning-quality/cases.mjs'
import { assertQualityObservation } from './planning-quality/assertions.mjs'
if (process.env.SUM_REDESIGN_SYNTHETIC !== '1') throw new Error('Own synthetic stack required')
const base = new URL(process.env.SUM_REDESIGN_BASE || 'http://127.0.0.1:5846')
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('Own loopback origin required')
const evidence = resolve(process.env.SUM_REDESIGN_EVIDENCE || '../evidence/local/planning-answer-quality-2026-11-10')
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(30000)
page.setDefaultNavigationTimeout(45000)
const errors = []
const observations = []
const qualityFailures = []
page.on('pageerror', error => errors.push(error.message))
const ask = async question => {
  const before = await page.locator('[data-normative-status]').count()
  await page.getByLabel('Pregunta normativa', { exact: true }).fill(question)
  const pending = page.waitForResponse(response => response.url().includes('/normativa/consultas'))
  const start = performance.now()
  await page.getByRole('button', { name: 'Enviar consulta', exact: true }).click()
  const response = await pending
  const body = await response.json()
  assert.equal(response.status(), 200)
  const answer = page.locator('[data-normative-status]').nth(before)
  await answer.waitFor()
  return { answer, body, latencyMs: Math.round(performance.now() - start), requestKeys: Object.keys(response.request().postDataJSON()) }
}
try {
  await page.goto(`${base.origin}/local/programacion-academica`, { waitUntil: 'networkidle' })
  await page.locator('#planning-page-title').waitFor()
  if (await page.locator('#planning-toggle-chat').getAttribute('aria-expanded') !== 'true') await page.locator('#planning-toggle-chat').click()
  await page.locator('.planning-chat__context-summary').click()
  await page.getByLabel('Fecha de consulta', { exact: true }).fill('2026-11-10')
  for (const item of qualityCases) {
    const regime = page.getByLabel('Régimen docente')
    if (await regime.inputValue() !== item.teacherType) await regime.selectOption(item.teacherType)
    if (item.follows) await ask(qualityCases.find(parent => parent.id === item.follows).question)
    const { answer, body, latencyMs, requestKeys } = await ask(item.question)
    const initialText = await answer.innerText()
    if (item.id === 'tc-paraphrase' || item.id === 'academic-hour') {
      await answer.scrollIntoViewIfNeeded()
      await page.screenshot({ path: resolve(evidence, `${item.id}.png`) })
    }
    const original = answer.getByRole('button', { name: 'Ver respuesta completa', exact: true })
    if (await original.count()) await original.click()
    const sources = answer.getByRole('button', { name: /^Fuentes localizadas/ })
    if (await sources.count()) await sources.click()
    const gaps = answer.getByRole('button', { name: /^Alcance y verificaciones pendientes/ })
    if (await gaps.count()) await gaps.click()
    observations.push({
      ...item, initialText, expandedText: await answer.innerText(), response: body, latencyMs,
      expectedSourceRetrieved: item.expectedIds.length ? body.citations.some(citation => item.expectedIds.includes(citation.id)) : null,
      requestKeys, visibleTurns: await page.locator('[data-slot="message-scroller-item"]').count(),
    })
    try { assertQualityObservation(observations.at(-1)) } catch (error) { qualityFailures.push(error.message) }
    console.log(`COLLECT ${item.id}: ${body.retrievalMode}, ${body.generation?.mode}, expected-source=${observations.at(-1).expectedSourceRetrieved}`)
  }
  await page.locator('#planning-toggle-chat').click()
  await page.getByRole('button', { name: /Seleccionar los .* cursos del catálogo/ }).click()
  await page.locator('#planning-tour-primary').click()
  const pending = page.waitForResponse(response => /\/consejero$/.test(new URL(response.url()).pathname))
  await page.getByRole('button', { name: 'Consultar consejero', exact: true }).click()
  const response = await pending
  const body = await response.json()
  const sheet = page.getByRole('dialog', { name: 'Consejero de planificación', exact: true })
  await sheet.locator('[data-advisor-impact]').waitFor()
  observations.push({ id: 'advisor', response: body, initialText: await sheet.innerText() })
  await page.screenshot({ path: resolve(evidence, 'advisor.png') })
} finally {
  await writeFile(resolve(evidence, 'responses.json'), JSON.stringify({
    source: 'Own entirely synthetic React/NestJS/Python stack; reviewed public normative corpus; actual modes recorded per response',
    rubric: ['Question answered directly', 'Relevant documentary evidence', 'Specific uncertainty', 'Actionable next step', 'No unsupported authorization'],
    observations, errors, qualityFailures,
  }, null, 2))
  await browser.close()
}
assert.deepEqual(errors, [])
assert.deepEqual(qualityFailures, [], 'Sample-specific answer quality regressions')

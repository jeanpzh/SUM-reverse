import assert from 'node:assert/strict'
import { chromium } from 'playwright'
if (process.env.SUM_CHAT_SYNTHETIC !== '1') throw new Error('Root-owned synthetic stack required')
const browser = await chromium.launch()
const page = await browser.newPage({reducedMotion:'reduce'})
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
try {
  let release
  const held = new Promise((resolve) => {release=resolve})
  await page.route('**/catalogo', async (route) => {await held; await route.continue()})
  await page.goto('http://127.0.0.1:5436/local/programacion-academica?etapa=preparacion&vista=cursos')
  const loader = page.locator('.planning-fetch-loading').first()
  await loader.waitFor()
  await page.waitForFunction(() => document.querySelector('.shimmer-measure-container')?.getBoundingClientRect().height > 100)
  assert.equal(await loader.getAttribute('aria-busy'),'true')
  assert.equal(await loader.locator('[inert]').count(),1)
  assert.equal(await loader.locator('span.sr-only').innerText(),'Consultando catálogo local…')
  const animations = await loader.locator('[style*=animation]').evaluateAll((items) => items.map((el) => getComputedStyle(el).animationName))
  assert.ok(animations.every((value) => value==='none'))
  release()
  await loader.waitFor({state:'hidden'})
  console.log('PASS catalog: measured skeleton, accessible status, inert content, reduced motion, loading completes')
  await page.route('**/normativa/consultas', async (route) => {await new Promise((resolve) => setTimeout(resolve,1200)); await route.abort()})
  if (await page.locator('#planning-toggle-chat').getAttribute('aria-expanded') !== 'true') await page.locator('#planning-toggle-chat').click()
  await page.getByLabel('Pregunta normativa',{exact:true}).fill('¿Qué carga lectiva corresponde?')
  await page.getByRole('button',{name:'Enviar consulta',exact:true}).click()
  await page.locator('.planning-chat .planning-fetch-loading').waitFor()
  await page.getByRole('button',{name:'Reintentar consulta normativa'}).waitFor()
  assert.equal(await page.locator('.planning-chat .planning-fetch-loading').count(),0)
  assert.deepEqual(errors,[])
  console.log('PASS chat: result-shaped skeleton transitions to recoverable fetch error, no browser exceptions')
} finally { await browser.close() }

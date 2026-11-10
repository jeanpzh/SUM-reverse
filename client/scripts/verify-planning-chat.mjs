// Own synthetic stack only (SUM_REDESIGN_BASE); never an operator or snapshot server.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
if (process.env.SUM_REDESIGN_SYNTHETIC !== '1') throw new Error('Own synthetic stack required')
const base = new URL(process.env.SUM_REDESIGN_BASE || 'http://127.0.0.1:5746')
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.pathname !== '/' || base.username || base.password || base.search || base.hash) throw new Error('Dedicated loopback origin required')
const browser = await chromium.launch()
const page = await browser.newPage({viewport:{width:1440,height:900}})
const errors = []
const calls = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('request', (request) => {if (request.url().includes('/normativa/consultas')) calls.push(request.url())})
const evidence = resolve(process.env.SUM_REDESIGN_EVIDENCE || '../evidence/local/planning-chat-2026-11-09')
await mkdir(evidence,{recursive:true})
const results = []
const check = async (id, run) => {await run(); results.push(id); console.log(`PASS ${id}`)}
try {
  await page.goto(`${base.origin}/local/programacion-academica`, {waitUntil:'networkidle'})
  const panel = page.getByRole('region',{name:'Asistente normativo',exact:true})
  await check('no-query-on-mount',async () => {await panel.waitFor(); assert.equal(calls.length,0)})
  await check('real-api-response-and-history',async () => {
    await page.getByLabel('Pregunta normativa',{exact:true}).fill('¿Cuál es la carga docente máxima?')
    const response = page.waitForResponse((r) => r.url().includes('/normativa/consultas'))
    await page.getByRole('button',{name:'Enviar consulta',exact:true}).click()
    assert.equal((await response).status(),200)
    await page.getByRole('region',{name:'Respuesta normativa'}).waitFor({timeout:30000})
    assert.equal(await page.locator('[data-slot=message-scroller-item]').count(),1)
  })
  await check('close-reopen-fullwidth-preserve-conversation',async () => {
    await page.getByRole('button',{name:'Cerrar asistente',exact:true}).click()
    await panel.waitFor({state:'hidden'})
    await page.locator('#planning-toggle-chat').click()
    await page.getByRole('button',{name:'Expandir al ancho completo'}).click()
    assert.ok((await panel.boundingBox()).width > 1300)
    assert.equal(await page.locator('[data-slot=message-scroller-item]').count(),1)
    await page.screenshot({path:`${evidence}/chat-full.png`})
  })
  await check('mobile-sidebar-and-context-reset',async () => {
    await page.getByRole('button',{name:'Restaurar tamaño'}).click()
    await page.setViewportSize({width:390,height:844})
    await panel.waitFor({state:'hidden'})
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'planning-toggle-chat')
    await page.keyboard.press('Enter')
    await panel.waitFor()
    assert.equal(await page.locator('[data-slot=message-scroller-item]').count(),1)
    assert.ok((await panel.boundingBox()).width<=390)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false)
    await page.getByText('Contexto · FISI',{exact:false}).click()
    await page.getByLabel('Régimen docente').selectOption('ordinario')
    assert.equal(await page.locator('[data-slot=message-scroller-item]').count(),0)
    await page.screenshot({path:`${evidence}/chat-mobile.png`})
  })
  await check('transport-error-and-retry',async () => {
    await page.route('**/normativa/consultas',route => route.abort())
    await page.getByLabel('Pregunta normativa',{exact:true}).fill('¿Qué norma aplica a la carga lectiva?')
    await page.getByRole('button',{name:'Enviar consulta',exact:true}).click()
    await page.getByRole('button',{name:'Reintentar consulta normativa'}).waitFor()
    const before = calls.length
    await page.getByRole('button',{name:'Reintentar consulta normativa'}).click()
    // Retry resends the same failed turn; it does not copy the question back into the draft.
    await page.waitForFunction(() => document.querySelectorAll('[data-slot=message-scroller-item]').length >= 1)
    await page.getByRole('button',{name:'Reintentar consulta normativa'}).waitFor()
    assert.equal(calls.length, before + 1)
    assert.equal(await page.getByLabel('Pregunta normativa',{exact:true}).inputValue(),'')
    await page.unroute('**/normativa/consultas')
  })
  await check('cancel-pending-query',async () => {
    let held
    await page.route('**/normativa/consultas',route => {held=route})
    await page.getByLabel('Pregunta normativa',{exact:true}).fill('¿Qué carga lectiva corresponde?')
    await page.getByRole('button',{name:'Enviar consulta',exact:true}).click()
    await page.getByRole('button',{name:'Cancelar consulta',exact:true}).waitFor()
    await page.getByRole('button',{name:'Cancelar consulta',exact:true}).click()
    await page.getByText('Consulta cancelada.',{exact:true}).waitFor()
    if (held) await held.abort().catch(() => {})
    await page.unroute('**/normativa/consultas')
  })
  assert.deepEqual(errors,[])
} finally {
  await writeFile(`${evidence}/acceptance.json`,JSON.stringify({source:`Own local synthetic stack at ${base.origin}; injected transport error`,results,errors},null,2))
  await browser.close()
}

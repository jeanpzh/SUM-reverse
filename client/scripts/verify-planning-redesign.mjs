const setTheme = async (page, item) => {
  await page.getByRole('button', { name: /^Cambiar tema de interfaz/ }).first().click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}
// Acceptance for the 2026-11-10 internal redesign. Run against a fresh, operator-confirmed
// synthetic stack only. Never attach to a snapshot-backed server or production.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

if (process.env.SUM_REDESIGN_SYNTHETIC !== '1') throw new Error('Fresh explicitly synthetic stack required: SUM_REDESIGN_SYNTHETIC=1')
const base = new URL(process.env.SUM_REDESIGN_BASE || 'http://127.0.0.1:5436')
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('Dedicated loopback origin required')
const evidence = resolve(process.env.SUM_REDESIGN_EVIDENCE || '../evidence/local/planning-redesign-2026-11-10')
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
const page = await context.newPage()
page.setDefaultTimeout(15000)
page.setDefaultNavigationTimeout(45000)
const errors = []
const external = []
const requests = []
const responses = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('response',(response)=>{if(response.url().includes('/api/')) responses.push({path:new URL(response.url()).pathname,status:response.status()})})
page.on('request', (request) => {
  if (!request.url().startsWith(base.origin) && !/^(data:|blob:)/.test(request.url())) external.push(request.url())
  if (request.url().includes('/api/')) requests.push({ method: request.method(), path: new URL(request.url()).pathname })
})
const results = []
const check = async (id, run) => {
  if (process.env.SUM_REDESIGN_CHECKS && !process.env.SUM_REDESIGN_CHECKS.split(',').includes(id)) return
  try { await run(); results.push({ id, passed: true }); console.log(`PASS ${id}`) }
  catch (error) { results.push({ id, passed: false, error: error.message }); throw error }
}
const capture = (name) => page.screenshot({ path: resolve(evidence, `${name}.png`), fullPage: false })
const route = '/local/programacion-academica'
const go = async (search = '') => {
  await page.goto(`${base.origin}${route}${search}`, { waitUntil: 'networkidle' })
  // Lazy route readiness is not catalog readiness. Await actual loaded configuration,
  // including when its preparation stage is hidden by the current stage.
  await page.locator('#planning-page-title').waitFor({timeout:45000})
  await page.evaluate(() => document.fonts.load('400 14px "Open Sans"', 'Programación académica: áéíóú ü ñ ¿¡'))
}
const navTo = async (stage, view) => {
  // Click the actual router link; use its search contract, not its visual position.
  const hrefs = await page.locator('#planning-tour-nav a[href]').evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  const href = hrefs.find((value) => {
    const url = new URL(value, 'http://local')
    return url.pathname === '/local/programacion-academica' && url.searchParams.get('etapa') === stage
      && (!view || url.searchParams.get('vista') === view)
  })
  assert.ok(href, `Missing actual navigation destination: ${stage}/${view || ''}`)
  await page.locator(`#planning-tour-nav a[href="${href}"]:visible`).first().click()
  await page.waitForURL((url) => url.searchParams.get('etapa') === stage && (!view || url.searchParams.get('vista') === view))
}
const overflow = async () => {
  const excess = await page.evaluate(() => {
    const width = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth <= width + 1) return []
    const offenders = [...document.querySelectorAll('.planning-root *')].filter((element) => {
      const box = element.getBoundingClientRect()
      return box.width > 0 && box.right > width + 1 && getComputedStyle(element).position !== 'fixed'
    }).slice(0, 8).map((element) => ({tag:element.tagName,className:element.className,right:element.getBoundingClientRect().right,width}))
    return [{tag:'DOCUMENT',scrollWidth:document.documentElement.scrollWidth,width}, ...offenders]
  })
  assert.deepEqual(excess, [], `Document overflow: ${JSON.stringify(excess)}`)
}
let proposal
let saved
try {
  await check('light-default-catalog-checklist-and-header', async () => {
    await go()
    await page.getByRole('button', {name: /Seleccionar los .* cursos del catálogo/}).waitFor({timeout:45000})
    assert.equal(await page.locator('.planning-root').getAttribute('data-theme'), 'light')
    assert.equal(await page.locator('#planning-tour-proposal').isVisible(), true)
    assert.equal(await page.locator('#planning-tour-primary').isVisible(), true)
    assert.equal(await page.getByRole('heading', {name:'Lista de preparación'}).isVisible(), true)
    assert.equal(await page.getByRole('link', {name:'Revisar recursos',exact:true}).count(), 1)
    assert.equal(await page.getByRole('link', {name:'Corregir',exact:true}).count(), 0)
    assert.equal(requests.filter(({path}) => /normativa|consejero/.test(path)).length, 0)
    await capture('resumen-light-1440')
  })
  await check('theme-dark-and-light-persist', async () => {
    for (const [item,theme] of [['Oscuro (Dark)','dark'],['Claro (Light)','light']]) {
      await setTheme(page,item)
      assert.equal(await page.locator('.planning-root').getAttribute('data-theme'),theme)
      await page.reload({waitUntil:'networkidle'})
      assert.equal(await page.evaluate(()=>localStorage.getItem('planning-theme')),theme)
      assert.equal(await page.locator('.planning-root').getAttribute('data-theme'),theme)
      await capture(`theme-${theme}-1440`)
    }
  })
  await check('select-all-courses-and-preparation-table-layout', async () => {
    await page.getByRole('button', {name:/Seleccionar los .* cursos del catálogo/}).click()
    const catalog = await (await context.request.get(`${base.origin}/api/local/programacion-academica/v1/catalogo`)).json()
    await navTo('preparacion', 'cursos')
    assert.equal(Number(await page.getByTestId('count-included').innerText()), catalog.courses.length)
    const table = page.getByRole('region', {name:'Tabla de cursos para planificación'})
    const box = await table.boundingBox()
    const content = await page.locator('.planning-workspace__content').boundingBox()
    assert.ok(box.height > content.height * 0.55, `Course table fills available height: ${box.height}/${content.height}`)
    assert.equal(await table.getByRole('columnheader',{name:'Inspector',exact:true}).count(),0)
    assert.equal(await table.evaluate(el => {
      const oldWidth = el.style.width
      el.style.width = '620px'
      const fits = el.scrollWidth <= el.clientWidth + 1
      el.style.width = oldWidth
      return fits
    }),true,'Course columns fit at 620px with assistant open')
    await table.getByRole('button',{name:/^Inspeccionar /}).first().focus()
    await page.keyboard.press('Enter')
    await page.locator('.academic-preparation__inspector').waitFor()
    assert.equal(await table.locator('tr[aria-selected="true"]').count(),1)
    await page.getByRole('button',{name:'Cerrar inspector',exact:true}).click()
    await capture('cursos-light-1440')
  })
  await check('row-a-generation-and-result-facts', async () => {
    await navTo('preparacion', 'resumen')
    assert.equal(await page.locator('#planning-tour-primary').innerText(), 'Generar propuesta')
    const response = page.waitForResponse(res => /\/propuestas$/.test(new URL(res.url()).pathname) && res.request().method() === 'POST', {timeout:120000})
    await page.locator('#planning-tour-primary').click()
    const generated = await response
    assert.equal(generated.status(),200)
    proposal = await generated.json()
    assert.ok(proposal.sections.length > 0)
    await page.waitForURL(url => url.searchParams.get('etapa') === 'horario')
    await page.locator('.planning-status-bar').waitFor()
    assert.equal(await page.locator('.planning-status-bar').getAttribute('data-status'),proposal.status)
    const facts = await page.locator('.planning-status-bar__facts').innerText()
    assert.match(facts,/\d+ de \d+ secciones completas/)
    assert.match(facts,/\d+ por completar/)
    assert.match(facts,/\d+ cruces en lo asignado/)
    assert.equal(await page.locator('.planning-view-pane--tabla').isVisible(),true)
    const before = requests.filter(({method,path}) => method === 'POST' && /\/propuestas$/.test(path)).length
    await page.getByRole('button',{name:'Reintentar búsqueda',exact:true}).click()
    await page.getByRole('alertdialog').getByRole('button',{name:'Cancelar',exact:true}).click()
    assert.equal(requests.filter(({method,path}) => method === 'POST' && /\/propuestas$/.test(path)).length,before)
    await capture('horario-tabla-light-1440')
  })
  await check('table-week-filters-selection-and-section-detail', async () => {
    const search = page.getByRole('searchbox',{name:'Buscar secciones',exact:true})
    const teacher = page.getByRole('combobox',{name:'Filtrar por docente',exact:true})
    const row = page.locator('.planning-sections__row').first()
    const sectionId = await row.getAttribute('data-section-id')
    const selected = proposal.sections.find(section => section.sectionId === sectionId)
    await row.getByRole('button',{name:/^Inspeccionar sección/}).click()
    const detail = page.locator('#planning-section-detail')
    await detail.waitFor()
    await search.fill(selected.courseName)
    await teacher.selectOption(proposal.assignments.find(item => item.sectionId === sectionId)?.teacherId || '__unassigned__')
    const teacherValue = await teacher.inputValue()
    await page.getByRole('button',{name:'Semana',exact:true}).click()
    assert.equal(await search.inputValue(),selected.courseName)
    assert.equal(await teacher.inputValue(),teacherValue)
    assert.equal(await detail.isVisible(),true)
    await page.getByRole('button',{name:'Tabla',exact:true}).click()
    assert.equal(await page.locator(`tr[data-section-id=${JSON.stringify(sectionId)}]`).getAttribute('aria-selected'),'true')
    await page.getByRole('button',{name:'Cerrar inspector',exact:true}).click()
    await detail.waitFor({state:'hidden'})
    await search.fill('')
    await teacher.selectOption('all')
    await page.getByRole('button',{name:'Semana',exact:true}).click()
    await capture('horario-semana-light-1440')
    await page.getByRole('button',{name:'Tabla',exact:true}).click()
  })
  await check('assistant-minimum-close-returns-width-and-sheet', async () => {
    const toggle = page.locator('#planning-toggle-chat')
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
    const rail = page.locator('#planning-rail')
    assert.ok((await rail.boundingBox()).width >= 280)
    const workspace = page.locator('.planning-workspace__content')
    const before = (await workspace.boundingBox()).width
    await page.getByRole('button',{name:'Cerrar asistente',exact:true}).click()
    await rail.waitFor({state:'hidden'})
    assert.ok((await workspace.boundingBox()).width > before + 200)
    await toggle.focus()
    await page.keyboard.press('Enter')
    await rail.waitFor()
    await page.setViewportSize({width:1100,height:1024})
    await page.getByRole('dialog').waitFor()
    assert.equal(await rail.count(),0,'Assistant uses Sheet below 1280px')
    await page.getByRole('button',{name:'Cerrar asistente',exact:true}).click()
    await page.setViewportSize({width:1440,height:1024})
  })
  await check('sidebar-collapse-and-mobile-keyboard-menu', async () => {
    const menu = page.locator('[data-slot=sidebar-trigger]')
    const sidebar = page.locator('[data-slot="sidebar"][data-state]')
    await menu.click()
    assert.equal(await sidebar.getAttribute('data-state'),'collapsed')
    await menu.click()
    assert.equal(await sidebar.getAttribute('data-state'),'expanded')
    await page.setViewportSize({width:390,height:844})
    await menu.focus()
    await page.keyboard.press('Enter')
    const mobile = page.getByRole('dialog')
    await mobile.waitFor()
    await capture('navigation-sheet-390')
    await page.keyboard.press('Escape')
    await mobile.waitFor({state:'hidden'})
    assert.equal(await menu.evaluate(el => el === document.activeElement),true)
    await menu.click()
    await mobile.getByRole('link',{name:'Cursos',exact:true}).click()
    await mobile.waitFor({state:'hidden'})
    assert.equal(new URL(page.url()).searchParams.get('vista'),'cursos')
    await page.setViewportSize({width:1440,height:1024})
  })
  await check('all-six-views-no-document-overflow', async () => {
    for (const width of [1440,1100,800,390]) {
      await page.setViewportSize({width,height:1024})
      for (const [stage,view] of [['preparacion','resumen'],['preparacion','cursos'],['preparacion','recursos'],['horario'],['revision'],['aprobacion']]) {
        if (width < 1024) await page.locator('[data-slot=sidebar-trigger]').click()
        await navTo(stage,view)
        await overflow()
        if (view === 'recursos') {
          await page.getByRole('tab',{name:/Aulas y laboratorios/}).click()
          await overflow()
          await page.getByRole('tab',{name:/Docentes/}).click()
        }
        await capture(`${view || stage}-${width}`)
      }
    }
  })
  await check('no-browser-exceptions-or-external-requests', async () => {
    assert.deepEqual(errors,[])
    assert.deepEqual(external,[])
  })
} catch (error) {
  await capture('failed-state').catch(() => {})
  console.error(error.stack)
  console.error(JSON.stringify({url:page.url(),alerts:await page.locator('[role=alert]').allTextContents(),responses:responses.slice(-12)}))
  process.exitCode = 1
} finally {
  await writeFile(resolve(evidence,'acceptance.json'), JSON.stringify({source:'Dedicated stack: built-in entirely synthetic academic seed, fresh /tmp draft store, extractive local normative corpus, disabled LLM',base:base.origin,results,errors,external,requests,responses,savedDraftId:saved?.draft?.id || saved?.id || null},null,2))
  await browser.close()
  console.log(`${results.filter((row)=>row.passed).length}/${results.length} passed; evidence: ${evidence}`)
}

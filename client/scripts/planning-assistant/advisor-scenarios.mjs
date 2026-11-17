import assert from 'node:assert/strict'
import { resolve } from 'node:path'
const routePattern = '**/propuestas/*/consejero'
const open = async page => {
  await page.getByRole('button', { name: /Seleccionar los .* cursos del catálogo/ }).click()
  const generated = page.waitForResponse(response => /\/propuestas$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
  await page.locator('#planning-tour-primary').click()
  const proposal = await (await generated).json()
  await page.getByRole('button', { name: 'Consultar consejero', exact: true }).click()
  await page.locator('[data-advisor-impact="pending"]').waitFor({ timeout: 45000 })
  await sheet(page).getByRole('button', { name: 'Simular selección actual', exact: true }).click()
  await page.locator('[data-advisor-impact="verified"]').waitFor({ timeout: 45000 })
  return proposal
}
// v2: the advisor is the "Consejero" tab of the assistance rail (≥1280px) or Sheet; "Consultar consejero" opens it.
// The tab panel exists in both containers, so it is the stable scope.
const sheet = page => page.getByRole('tabpanel', { name: 'Consejero', exact: true })
// The commit button carries the selected count: "Aplicar N seleccionada(s) y regenerar".
const applyName = /^Aplicar \d+ seleccionad[ao]s? y regenerar$/

export const advisorScenarios = [
  ['advisor-direction-a-initial-chat-and-simulation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 952 })
    const requests = []
    page.on('request', request => { if (request.url().endsWith('/consejero')) requests.push(request.postDataJSON()) })
    await page.getByRole('button', { name: /Seleccionar los .* cursos del catálogo/ }).click()
    const generated = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/propuestas'))
    await page.locator('#planning-tour-primary').click()
    await generated
    await page.locator('#planning-toggle-chat').click()
    const panel = sheet(page)
    await panel.locator('[data-advisor-state=idle]').waitFor()
    assert.equal(requests.length, 0, 'Mounting the rail must not send a query')
    await panel.getByText('¿Qué está bloqueando esta propuesta?', { exact: true }).waitFor()
    await page.screenshot({ path: resolve(process.env.SUM_REDESIGN_EVIDENCE, 'advisor-rail-initial-light.png') })
    await page.getByRole('button', { name: /^Cambiar tema de interfaz/ }).click()
    await page.getByRole('menuitem', { name: 'Oscuro (Dark)', exact: true }).click()
    await page.locator('.planning-assist:visible').screenshot({ path: resolve(process.env.SUM_REDESIGN_EVIDENCE, 'advisor-rail-initial.png') })
    await panel.getByRole('button', { name: 'Consultar consejero', exact: true }).click()
    await panel.locator('[data-advisor-impact=pending]').waitFor({ timeout: 45000 })
    assert.equal(requests.length, 1)
    assert.equal(requests[0].selectedRecommendationIds, undefined, 'Initial query only diagnoses')
    assert.equal(await panel.locator('[data-advisor-impact=verified]').count(), 0)
    const apply = panel.getByRole('button', { name: applyName })
    assert.equal(await apply.isDisabled(), true)
    await panel.getByText('Sin redacción del modelo', { exact: true }).waitFor()
    assert.ok(await panel.getByRole('region', { name: 'Diagnóstico de la propuesta' }).evaluate(el => {
      const viewport = el.closest('[data-slot=message-scroller-viewport]').getBoundingClientRect()
      return el.getBoundingClientRect().top >= viewport.top && el.getBoundingClientRect().top < viewport.bottom
    }), 'A new diagnosis starts at the top of the thread')
    await page.screenshot({ path: resolve(process.env.SUM_REDESIGN_EVIDENCE, 'advisor-rail-analyzed.png') })
    // A single, persistent normative thread is shared by rail, expanded mode and the Normativa tab.
    const question = '¿Qué dice la norma sobre carga lectiva de contratados?'
    await panel.getByRole('textbox', { name: 'Pregunta normativa', exact: true }).fill(question)
    await panel.getByRole('button', { name: 'Enviar consulta', exact: true }).click()
    await panel.getByRole('region', { name: 'Respuesta normativa', exact: true }).waitFor({ timeout: 45000 })
    await page.getByRole('button', { name: 'Expandir al ancho completo', exact: true }).click()
    const expanded = sheet(page)
    await expanded.getByText(question, { exact: true }).waitFor()
    const cols = await expanded.locator('.planning-chat__messages').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    assert.equal(cols, 2, 'Expanded mode uses conversation and decision columns')
    await page.screenshot({ path: resolve(process.env.SUM_REDESIGN_EVIDENCE, 'advisor-expanded-analyzed.png') })
    await page.getByRole('button', { name: 'Restaurar tamaño', exact: true }).click()
    const current = sheet(page)
    const selected = await current.getByRole('checkbox', { checked: true }).count()
    assert.ok(selected > 0)
    await current.getByRole('button', { name: 'Simular selección actual', exact: true }).click()
    await current.locator('[data-advisor-impact=verified]').waitFor({ timeout: 45000 })
    assert.ok(requests[1].selectedRecommendationIds.length > 0)
    assert.equal(await current.getByRole('button', { name: applyName }).isEnabled(), true)
    await page.screenshot({ path: resolve(process.env.SUM_REDESIGN_EVIDENCE, 'advisor-rail-simulated.png') })
    const first = current.getByRole('checkbox').first()
    await first.click()
    await first.click()
    await current.locator('[data-advisor-impact=stale]').waitFor()
    assert.equal(await current.getByRole('button', { name: applyName }).isDisabled(), true, 'Returning to an old selection still needs a new simulation')
    // Focus and narrow reflow, both themes, and 200% layout equivalent.
    for (const width of [360, 720]) {
      await page.setViewportSize({ width, height: 900 })
      if (await page.locator('#planning-toggle-chat').getAttribute('aria-pressed') !== 'true') await page.locator('#planning-toggle-chat').click()
      if (await page.getByRole('button', { name: 'Expandir al ancho completo', exact: true }).isVisible()) await page.getByRole('button', { name: 'Expandir al ancho completo', exact: true }).click()
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
      const button = sheet(page).getByRole('button', { name: 'Simular selección actual', exact: true })
      await button.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)
      assert.notEqual(focused, 'none')
      await page.screenshot({ path: resolve(process.env.SUM_REDESIGN_EVIDENCE, `advisor-stale-${width}.png`) })
    }
  }],
  ['advisor-direction-a-cancel-simulation', async ({ page }) => {
    await open(page)
    const panel = sheet(page)
    const check = panel.getByRole('checkbox').first()
    await check.click()
    let release
    const gate = new Promise(resolve => { release = resolve })
    await page.route(routePattern, async route => { await gate; await route.continue().catch(() => {}) })
    await panel.getByRole('button', { name: 'Simular selección actual', exact: true }).click()
    await panel.locator('[data-advisor-state=simulating]').waitFor()
    const checks = panel.getByRole('checkbox')
    for (const item of await checks.all()) assert.equal(await item.isDisabled(), true)
    await page.screenshot({ path: resolve(process.env.SUM_REDESIGN_EVIDENCE, 'advisor-simulating.png') })
    await panel.getByRole('button', { name: 'Cancelar simulación', exact: true }).click()
    release()
    await page.unroute(routePattern)
    await panel.getByRole('button', { name: 'Simular selección actual', exact: true }).waitFor()
    assert.equal(await panel.locator('[data-advisor-impact=verified]').count(), 0)
    assert.equal(await panel.getByRole('button', { name: applyName }).isDisabled(), true)
    for (const item of await checks.all()) if (await item.getAttribute('aria-checked') === 'true') await item.click()
    assert.equal(await panel.getByRole('button', { name: 'Simular selección actual', exact: true }).isDisabled(), true)
    await panel.getByText('Marca al menos una recomendación para continuar.', { exact: true }).waitFor()
  }],
  ['advisor-selection-invalidates-impact', async ({ page }) => {
    await open(page)
    const apply = sheet(page).getByRole('button', { name: applyName })
    const check = sheet(page).getByRole('checkbox').first()
    await check.click()
    await check.click()
    assert.equal(await apply.isDisabled(), true)
    assert.equal(await page.locator('[data-advisor-impact="verified"]').count(), 0)
    await sheet(page).getByRole('button', { name: 'Simular selección actual', exact: true }).click()
    await page.locator('[data-advisor-impact="verified"]').waitFor({ timeout: 45000 })
  }],
  ['advisor-applies-only-on-command-and-regenerates', async ({ page, base }) => {
    const generations = []
    page.on('request', request => {
      if (request.method() === 'POST' && /\/propuestas$/.test(new URL(request.url()).pathname)) generations.push(request.postDataJSON())
    })
    const original = await open(page)
    assert.equal(generations.length, 1, 'Consulting advice does not regenerate')
    const pending = page.waitForResponse(response => /\/propuestas$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
    await sheet(page).getByRole('button', { name: applyName }).click()
    const response = await pending
    assert.equal(response.status(), 200)
    const regenerated = await response.json()
    assert.notEqual(regenerated.proposalId, original.proposalId)
    await page.locator('#planning-chat-body').waitFor({ state: 'hidden' })
    assert.equal(generations.length, 2)
    const drafts = await page.request.get(`${base}/api/local/programacion-academica/v1/borradores`)
    assert.equal(drafts.status(), 200)
    assert.equal((await drafts.json()).items.length, 0, 'Applying advice does not implicitly save/publish')
  }],
  ['advisor-retry-preserves-requested-selection', retrySelection],

]

async function retrySelection({ page }) {
  await open(page)
  const checks = sheet(page).getByRole('checkbox')
  await checks.first().click()
  const attempted = []
  await page.route(routePattern, async route => {
    attempted.push(route.request().postDataJSON())
    if (attempted.length === 1) await route.abort()
    else await route.continue()
  })
  await sheet(page).getByRole('button', { name: 'Simular selección actual', exact: true }).click()
  await sheet(page).getByRole('button', { name: 'Reintentar consejero', exact: true }).click()
  await page.locator('[data-advisor-impact="verified"]').waitFor({ timeout: 45000 })
  assert.deepEqual(attempted[1], attempted[0], 'Retry must preserve selectedRecommendationIds')
}

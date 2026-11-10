import assert from 'node:assert/strict'
const routePattern = '**/propuestas/*/consejero'
const open = async page => {
  if (await page.locator('#planning-toggle-chat').getAttribute('aria-expanded') === 'true') await page.locator('#planning-toggle-chat').click()
  await page.getByRole('button', { name: /Seleccionar los .* cursos del catálogo/ }).click()
  const generated = page.waitForResponse(response => /\/propuestas$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
  await page.locator('#planning-tour-primary').click()
  const proposal = await (await generated).json()
  await page.getByRole('button', { name: 'Consultar consejero', exact: true }).click()
  await page.locator('[data-advisor-impact="verified"]').waitFor({ timeout: 45000 })
  return proposal
}
const sheet = page => page.getByRole('dialog', { name: 'Consejero de planificación', exact: true })

export const advisorScenarios = [
  ['advisor-selection-invalidates-impact', async ({ page }) => {
    await open(page)
    const apply = sheet(page).getByRole('button', { name: 'Aplicar seleccionadas y regenerar', exact: true })
    const check = sheet(page).getByRole('checkbox').first()
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
    await sheet(page).getByRole('button', { name: 'Aplicar seleccionadas y regenerar', exact: true }).click()
    const response = await pending
    assert.equal(response.status(), 200)
    const regenerated = await response.json()
    assert.notEqual(regenerated.proposalId, original.proposalId)
    await sheet(page).waitFor({ state: 'hidden' })
    assert.equal(generations.length, 2)
    const drafts = await page.request.get(`${base}/api/local/programacion-academica/v1/borradores`)
    assert.equal(drafts.status(), 200)
    assert.equal((await drafts.json()).items.length, 0, 'Applying advice does not implicitly save/publish')
  }],
  ['advisor-retry-preserves-requested-selection', context => retrySelection(context, false)],
  ['advisor-retry-preserves-empty-selection', context => retrySelection(context, true)],
]

async function retrySelection({ page }, empty) {
  await open(page)
  const checks = sheet(page).getByRole('checkbox')
  if (empty) {
    for (const check of await checks.all()) if (await check.getAttribute('aria-checked') === 'true') await check.click()
  } else await checks.first().click()
  const attempted = []
  await page.route(routePattern, async route => {
    attempted.push(route.request().postDataJSON())
    if (attempted.length === 1) await route.abort()
    else await route.continue()
  })
  await sheet(page).getByRole('button', { name: 'Simular selección actual', exact: true }).click()
  await sheet(page).getByRole('button', { name: 'Reintentar consejero', exact: true }).click()
  await page.locator('[data-advisor-impact="verified"]').waitFor({ timeout: 45000 })
  if (empty) assert.deepEqual(attempted[0].selectedRecommendationIds, [])
  assert.deepEqual(attempted[1], attempted[0], 'Retry must preserve selectedRecommendationIds, including []')
}

import assert from 'node:assert/strict'
const input = page => page.getByLabel('Pregunta normativa', { exact: true })
const send = page => page.getByRole('button', { name: 'Enviar consulta', exact: true })
const answers = page => page.locator('[data-normative-status]')
const endpoint = '**/normativa/consultas'

export const chatScenarios = [
  ['chat-real-response-and-scope', async ({ page }) => {
    let count = 0
    page.on('request', request => { if (request.url().includes('/normativa/consultas')) count++ })
    assert.equal(count, 0)
    await input(page).fill('¿Cuál es la carga lectiva máxima?')
    const response = page.waitForResponse(response => response.url().includes('/normativa/consultas'))
    await send(page).click()
    const result = await (await response).json()
    await answers(page).waitFor()
    assert.equal(result.context.teacherType, 'unknown')
    assert.equal(result.status, 'not-determined')
    await page.locator('.planning-chat__context-summary').click()
    await page.getByLabel('Régimen docente').selectOption('ordinario')
    assert.equal(await answers(page).count(), 0)
    await input(page).fill('¿Cuál es la carga lectiva máxima?')
    await send(page).click()
    await answers(page).waitFor()
    await page.getByRole('button', { name: /^Fuentes localizadas/ }).click()
    assert.ok(await answers(page).getByRole('link').count() > 0)
    assert.equal(count, 2)
  }],
  ['chat-retry-resends-failed-turn', async ({ page }) => {
    let count = 0
    await page.route(endpoint, async route => {
      count++
      if (count === 1) await route.abort()
      else await route.continue()
    })
    await input(page).fill('Pregunta sintética que fallará una vez')
    await send(page).click()
    const retry = page.getByRole('button', { name: 'Reintentar consulta normativa', exact: true })
    await retry.waitFor()
    await input(page).fill('Borrador nuevo sin enviar')
    await retry.click()
    await answers(page).waitFor({ timeout: 4000 })
    assert.equal(count, 2, 'Retry must send the request without another Enviar click')
    assert.equal(await input(page).inputValue(), 'Borrador nuevo sin enviar', 'Retry must not overwrite an unrelated composer draft')
    assert.equal(await page.locator('[data-slot="message-scroller-item"]').count(), 1, 'Retry updates its failed turn')
  }],
  ['chat-double-submit-keeps-one-pending-request', async ({ page }) => {
    let count = 0
    let held
    await page.route(endpoint, route => { count++; held = route })
    await input(page).fill('Consulta sintética doble clic')
    await send(page).dblclick()
    assert.equal(await page.getByText('Consulta cancelada.', { exact: true }).count(), 0, 'Second click on Enviar must not activate the replacement Cancelar button')
    await page.getByRole('button', { name: 'Cancelar consulta', exact: true }).waitFor()
    assert.equal(count, 1)
    assert.equal(await page.locator('[data-slot="message-scroller-item"]').count(), 1)
    await page.getByRole('button', { name: 'Cancelar consulta', exact: true }).click()
    if (held) await held.abort().catch(() => {})
  }],
  ['chat-http-error-recovers-on-retry', async ({ page }) => {
    let count = 0
    await page.route(endpoint, async route => {
      count++
      if (count === 1) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NORMATIVE_UPSTREAM_ERROR', message: 'Motor sintético no disponible' } }) })
      else await route.continue()
    })
    await input(page).fill('Consulta sintética con error HTTP')
    await send(page).click()
    await page.getByRole('button', { name: 'Reintentar consulta normativa', exact: true }).click()
    await answers(page).waitFor()
    assert.equal(count, 2)
  }],
  ['chat-cancel-allows-a-new-query', async ({ page }) => {
    let held
    let arrived
    const captured = new Promise(resolve => { arrived = resolve })
    await page.route(endpoint, route => { held = route; arrived() })
    await input(page).fill('Consulta sintética cancelada')
    await send(page).click()
    await captured
    await page.getByRole('button', { name: 'Cancelar consulta', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.getByText('Consulta cancelada.', { exact: true }).waitFor()
    await held.abort().catch(() => {})
    await page.unroute(endpoint)
    await input(page).fill('Nueva pregunta después de cancelar')
    await send(page).click()
    await answers(page).waitFor()
    assert.equal(await page.getByText('Consulta cancelada.', { exact: true }).count(), 1)
  }],
  ['chat-rejects-mismatched-response', async ({ page }) => {
    await page.route(endpoint, async route => {
      const response = await route.fetch()
      const body = await response.json()
      await route.fulfill({ response, json: { ...body, question: 'Pregunta sintética distinta' } })
    })
    await input(page).fill('Pregunta sintética original')
    await send(page).click()
    await page.getByRole('button', { name: 'Reintentar consulta normativa', exact: true }).waitFor()
    assert.equal(await answers(page).count(), 0)
  }],
  ['chat-invalid-date-and-mobile-history', async ({ page }) => {
    await page.locator('.planning-chat__context-summary').click()
    await page.getByLabel('Fecha de consulta', { exact: true }).fill('')
    assert.equal(await send(page).isDisabled(), true)
    await page.getByLabel('Fecha de consulta', { exact: true }).fill('2026-11-10')
    await input(page).fill('Pregunta sintética desde móvil')
    await send(page).click()
    await answers(page).waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(() => document.querySelector('#planning-toggle-chat')?.getAttribute('aria-expanded') === 'false')
    await page.locator('#planning-toggle-chat').click()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.getByRole('button', { name: 'Cerrar asistente', exact: true }).click()
    await page.locator('#planning-toggle-chat').click()
    assert.equal(await answers(page).count(), 1)
  }],
]

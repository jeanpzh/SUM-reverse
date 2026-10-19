import { browser } from 'k6/browser'
import { check } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { runtimeConfig } from './common.js'

const config = runtimeConfig()
const browserVus = Number(__ENV.BROWSER_VUS || 2)
const browserCompleted = new Counter('browser_iterations_completed')
const browserFailed = new Counter('browser_iterations_failed')
export const options = {
  systemTags: ['status', 'method', 'scenario', 'group', 'check', 'expected_response'],
  scenarios: { ui_smoke: { executor: 'per-vu-iterations', vus: browserVus, iterations: 1, maxDuration: '2m', options: { browser: { type: 'chromium' } } } },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    browser_ready_ms: ['p(95)<10000'],
    browser_iterations_completed: [`count==${browserVus}`],
    browser_iterations_failed: ['count==0'],
  },
}

const ready = new Trend('browser_ready_ms')

export default async function () {
  const actor = config.manifest.actors[(__VU - 1) % config.manifest.actors.length]
  let page
  try {
    page = await browser.newPage()
    const started = Date.now()
    await page.goto(config.base)
    await page.getByLabel('Código de acceso').fill(actor.credential)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await page.locator('.sidebar').waitFor({ state: 'visible', timeout: 30000 })
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 30000 })
    const expectedName = `Estudiante sintético ${String(__VU).padStart(4, '0')}`
    await page.locator('.account-button').waitFor({ state: 'visible', timeout: 30000 })
    ready.add(Date.now() - started)
    const sidebarVisible = await page.locator('.sidebar').isVisible()
    const topbarVisible = await page.locator('.topbar').isVisible()
    const actualName = await page.locator('.account-button').textContent()
    const passed = check(page, { 'synthetic login reaches dashboard shell and own name': () => sidebarVisible && topbarVisible && actualName.includes(expectedName) })
    if (!passed) throw new Error('Synthetic login did not reach its dashboard identity')
    browserCompleted.add(1)
  } catch (error) {
    browserFailed.add(1)
    throw error
  } finally {
    if (page) await page.close()
  }
}

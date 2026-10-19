// Root-owned integration acceptance. Uses only an independently constructed synthetic campaign.
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '../client/node_modules/playwright/index.mjs'

const base = process.env.SIMULATOR_TEST_URL ?? 'http://127.0.0.1:5189'
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Verification requires an explicit loopback simulator')
const manifestFile = process.env.SIMULATOR_MANIFEST
assert.ok(manifestFile, 'SIMULATOR_MANIFEST must identify the independently synthetic seed manifest')
const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
assert.ok(Array.isArray(manifest.actors) && manifest.actors.length > 0)
const actor = manifest.actors.at(-1)
assert.match(actor.actorId, /^SYN-/)
const output = resolve(process.env.SIMULATOR_TEST_OUTPUT ?? 'evidence/local/simulador-produccion/browser')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1536, height: 735 } })
const unexpected = []
const pageErrors = []
const responses = []
const contextOrigins = new Set([new URL(base).origin])
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (['http:', 'https:'].includes(url.protocol) && !contextOrigins.has(url.origin)) {
    unexpected.push(url.origin)
    await route.abort()
  } else await route.continue()
})
const page = await context.newPage()
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('response', (response) => {
  if (response.url().includes('/api/')) responses.push({ path: new URL(response.url()).pathname.replace(/SYN-[A-Z0-9-]+|[0-9a-f]{8}-[0-9a-f-]{27,}/g, ':id'), status: response.status() })
})
let outcome
try {
  const health = await context.request.get(`${base}/api/simulator/health`)
  assert.equal(health.status(), 200)
  assert.equal((await health.json()).dataSource, 'independently-synthetic')
  await page.goto(`${base}/local/login`)
  await page.getByLabel('Código de acceso').fill(actor.credential)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL('**/alumnoWebSum/v2/inicio', { timeout: 30_000 })
  await page.locator('.sidebar').waitFor()
  assert.equal(await page.locator('.sidebar').evaluate((element) => element.getBoundingClientRect().width), 280)
  assert.equal(await page.locator('.topbar').evaluate((element) => element.getBoundingClientRect().height), 64)
  assert.equal(await page.getByText('Elegir perfil sintético', { exact: true }).count(), 0)
  await page.screenshot({ path: resolve(output, 'home.png') })
  const session = await context.request.get(`${base}/api/simulator/auth/v1/session`)
  assert.equal((await session.json()).data.actorId, actor.actorId)
  await page.reload()
  await page.locator('.sidebar').waitFor()
  assert.ok(!new URL(page.url()).pathname.endsWith('/login'))
  await page.goto(`${base}/local/matricula-regular`)
  await page.locator('.sum-enrollment__pick').first().waitFor({ timeout: 30_000 })
  assert.equal(await page.locator('.sum-enrollment__pick').count(), manifest.selection.length)
  await page.screenshot({ path: resolve(output, 'enrollment-before.png') })
  for (const button of await page.locator('.sum-enrollment__pick').all()) {
    await button.click()
    await page.getByRole('dialog').getByRole('radio').first().check()
    await page.getByRole('dialog').getByRole('button', { name: '✓ Aceptar', exact: true }).click()
  }
  const committed = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/local/matricula-regular/v1/solicitudes'))
  await page.getByRole('button', { name: 'Ejecutar Matrícula', exact: true }).click()
  await page.getByRole('button', { name: 'EJECUTAR', exact: true }).click()
  const commitResponse = await committed
  assert.equal(commitResponse.status(), 200)
  outcome = (await commitResponse.json()).data
  assert.equal(outcome.state, 'accepted', 'Fresh campaign must permit the browser actor')
  await page.waitForURL((url) => url.pathname.startsWith('/local/matricula-regular/reporte/'), { timeout: 30_000 })
  await page.locator('.topbar').waitFor()
  await page.screenshot({ path: resolve(output, 'report.png') })
  const revocation = page.waitForResponse((response) => response.url().endsWith('/simulator/auth/v1/logout') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  assert.equal((await revocation).status(), 204)
  await page.waitForURL('**/local/login')
  const loggedOut = await context.request.get(`${base}/api/simulator/auth/v1/session`)
  assert.equal(loggedOut.status(), 401)
  await page.getByLabel('Código de acceso').fill(actor.credential)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL('**/alumnoWebSum/v2/inicio')
  const reauthenticated = await context.request.get(`${base}/api/simulator/auth/v1/session`)
  assert.equal((await reauthenticated.json()).data.actorId, actor.actorId)
  const replay = await context.request.get(`${base}/api/local/matricula-regular/v1/solicitudes/${outcome.requestId}?runId=${manifest.runId}&actorId=${actor.actorId}`)
  assert.equal(replay.status(), 200)
  assert.deepEqual((await replay.json()).data.outcome, outcome)
  assert.deepEqual(unexpected, [])
  assert.deepEqual(pageErrors, [])
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: true, cases: ['login', 'dashboard geometry', 'reload', 'selection', 'commit', 'report', 'logout revocation', 'stable relogin', 'durable result'], responses, externalRequests: unexpected.length, pageErrors }, null, 2))
  console.log('PASS: React → own NestJS → PostgreSQL, stable login, enrollment/report/recovery, local geometry')
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => undefined)
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: false, error: error.message, responses, externalRequests: unexpected.length, pageErrors }, null, 2))
  throw error
} finally {
  await context.close()
  await browser.close()
}

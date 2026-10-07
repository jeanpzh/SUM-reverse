import { chromium } from 'playwright'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '')
const clientDir = resolve(root, 'client')
const server = spawn(
  process.execPath,
  [
    resolve(clientDir, 'node_modules/vite/bin/vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    '5181',
    '--strictPort',
  ],
  { cwd: clientDir, stdio: 'pipe' },
)
process.on('exit', () => server.kill())
await new Promise((accept, reject) => {
  server.stdout.on('data', (data) => {
    if (data.toString().includes('Local:')) accept()
  })
  server.on('error', reject)
  server.on('exit', (code) => reject(new Error(`Verification server exited: ${code}`)))
})
const source = await readFile(`${root}/client/src/data/routes.ts`, 'utf8')
const routes = [
  ...source.matchAll(/\{\s*id:\s*'([^']+)',\s*path:\s*'([^']+)',\s*title:\s*'([^']+)',?\s*\}/g),
].map(([, id, path, title]) => ({ id, path, title }))
assert.equal(routes.length, 16, 'Expected all 16 observed routes in the verification inventory')
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined),
  headless: true,
  args: ['--no-sandbox'],
})
const context = await browser.newContext({
  viewport: { width: 1536, height: 735 },
  deviceScaleFactor: 1,
})
try {
  const errors = []
  const remote = []
  const consoleErrors = []
  await context.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname
    if (host === '127.0.0.1' || host === 'localhost') return route.continue()
    remote.push(route.request().url())
    return route.abort()
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  const measurements = []
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:5181${route.path}`)
    await page.locator('main').waitFor()
    await page.waitForFunction(() => document.title.includes('Sistema Único de Matrícula'))
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.title(), `Sistema Único de Matrícula - ${route.title}`)
    assert.equal(await page.getByText('Página no encontrada').count(), 0)
    const dir = `${root}/evidence/local/${route.id}`
    await mkdir(dir, { recursive: true })
    const geometry = await page.evaluate(() => {
      const box = (e) => {
        const r = e.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      }
      return {
        viewport: { width: innerWidth, height: innerHeight },
        sidebar: box(document.querySelector('.sidebar')),
        header: box(document.querySelector('.topbar')),
        main: box(document.querySelector('main')),
        title: document.querySelector('.page-title')
          ? box(document.querySelector('.page-title'))
          : null,
        summary: document.querySelector('.student-summary')
          ? box(document.querySelector('.student-summary'))
          : null,
        table: document.querySelector('table') ? box(document.querySelector('table')) : null,
        tableHeaders: [...document.querySelectorAll('table:first-of-type th')].map(
          (e) => e.innerText,
        ),
        resource: document.querySelector('.tutorial-card')
          ? box(document.querySelector('.tutorial-card'))
          : null,
        forms: document.querySelectorAll('form').length,
        textboxes: document.querySelectorAll('input').length,
        comboboxes: document.querySelectorAll('select').length,
      }
    })
    assert.equal(geometry.sidebar.width, 280)
    assert.equal(geometry.header.height, 64)
    assert.equal(geometry.main.x, 280)
    assert.equal(geometry.main.y, 70)
    if (route.id === 'manuales') assert.equal(geometry.resource.height, 79)
    measurements.push({ id: route.id, ...geometry })
    await page.screenshot({ path: `${dir}/candidate.png` })
    if (['tutoria', 'manuales'].includes(route.id))
      await page.locator('main').screenshot({ path: `${dir}/main-candidate.png` })
  }
  // Exercise SPA navigation, accordion behavior, direct routes and history.
  await page.goto('http://127.0.0.1:5181/')
  await page.waitForURL('**/alumnoWebSum/v2/inicio')
  await page.getByRole('button', { name: 'Mi Información', exact: true }).click()
  await page.getByRole('link', { name: 'Mi Perfil', exact: true }).click()
  await page.waitForURL('**/informacion/perfil')
  assert.equal(
    await page.getByRole('tab', { name: 'Información Personal' }).getAttribute('aria-selected'),
    'true',
  )
  assert.equal(await page.getByRole('tab', { name: 'Cambio de Contraseña' }).isDisabled(), true)
  await page.goBack()
  await page.waitForURL('**/inicio')
  await page.goForward()
  await page.waitForURL('**/perfil')
  await page.getByRole('button', { name: 'Reportes', exact: true }).click()
  assert.equal(await page.locator('.subnav a').count(), 5)
  await page.getByRole('link', { name: 'Reporte de Deudas', exact: true }).click()
  await page.waitForURL('**/reportes/deudas')
  assert.equal(await page.locator('.subnav').count(), 0)
  await page.getByRole('button', { name: 'Ocultar menú' }).click()
  assert.equal(
    await page.locator('.student-app').evaluate((e) => e.classList.contains('sidebar-collapsed')),
    true,
  )
  await page.getByRole('button', { name: 'Mostrar menú' }).click()
  await page.goto('http://127.0.0.1:5181/alumnoWebSum/v2/informacion/formularioDatos')
  await page.getByRole('link', { name: 'Salud', exact: true }).click()
  assert.ok((await page.evaluate(() => scrollY)) > 1000)
  assert.equal(await page.locator('form').count(), 8)
  assert.equal(
    await page.locator('form input:not(:disabled),form select:not(:disabled)').count(),
    0,
  )
  await page.goto('http://127.0.0.1:5181/alumnoWebSum/v2/reportes/prematricula')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar', exact: true }).click()
  const download = await downloadPromise
  assert.equal(download.suggestedFilename(), 'reportes-prematricula-demo.csv')
  assert.equal(errors.length, 0, errors.join('\n'))
  assert.equal(remote.length, 0, remote.join('\n'))
  assert.equal(consoleErrors.length, 0, consoleErrors.join('\n'))
  await page.setViewportSize({ width: 1038, height: 711 })
  await page.goto('http://127.0.0.1:5181/alumnoWebSum/v2/inicio')
  await page.evaluate(() => document.fonts.ready)
  const homeCard = await page.locator('.shortcut-card').first().boundingBox()
  assert.ok(Math.abs(homeCard.x - 301) < 1)
  assert.ok(Math.abs(homeCard.y - 691) < 1)
  assert.ok(Math.abs(homeCard.width - 464) < 1)
  await page.screenshot({ path: `${root}/evidence/local/home/candidate-reference-viewport.png` })
  await writeFile(`${root}/evidence/local/measurements.json`, JSON.stringify(measurements, null, 2))
  await writeFile(
    `${root}/evidence/local/check-results.json`,
    JSON.stringify(
      {
        routes: routes.length,
        viewport: [1536, 735],
        pageErrors: errors,
        consoleErrors,
        remoteRequests: remote,
        checks: [
          '16 direct routes',
          'index redirect',
          'typed SPA links',
          'submenu reset',
          'browser back/forward',
          'sidebar toggle',
          'profile initial state',
          'read-only form fields',
          'section anchors',
          'local fixture download',
        ],
      },
      null,
      2,
    ),
  )
  console.log(
    JSON.stringify(
      {
        routes: routes.length,
        pageErrors: errors.length,
        consoleErrors: consoleErrors.length,
        remoteRequests: remote.length,
        checks: 'passed',
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
  server.kill()
}

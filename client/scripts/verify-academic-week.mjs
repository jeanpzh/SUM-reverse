// Synthetic local acceptance script for Planning Week View (Semana) V3 correction cycle.
// Starts dedicated processes on ports 3291/5291 with provenance env -i and synthetic fixtures.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { verifyWeekScenarios } from './verify-academic-week-scenarios.mjs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../../', import.meta.url))
const apiPort = 3291
const webPort = 5291
const api = `http://127.0.0.1:${apiPort}`
const web = `http://127.0.0.1:${webPort}`
const route = '/local/programacion-academica'
const fixtureDir = await mkdtemp(resolve(tmpdir(), 'sum-week-synthetic-'))

// Allowlist: never inherit operator data sources, database or draft storage.
const environment = { PATH: process.env.PATH }

const children = []
let browser

async function assertPortFree(port) {
  await new Promise((accept, reject) => {
    const server = createServer()
    server.once('error', () => reject(new Error(`Puerto ${port} ocupado: no se utilizará`)))
    server.listen(port, '127.0.0.1', () => server.close(accept))
  })
}

function start(args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stderr.on('data', () => {})
  child.stdout.on('data', () => {})
  children.push(child)
  return child
}

async function waitFor(url, child) {
  const deadline = Date.now() + 45000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`El proceso local terminó con código: ${child.exitCode}`)
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // Waiting for server startup
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`No arrancó el servicio en ${url}`)
}

async function cleanup() {
  if (browser) {
    try {
      await browser.close()
    } catch {
      // ignore
    }
  }
  for (const child of children) {
    try {
      child.kill('SIGTERM')
    } catch {
      // ignore
    }
  }
}

process.on('SIGINT', async () => {
  await cleanup()
  process.exit(1)
})

process.on('SIGTERM', async () => {
  await cleanup()
  process.exit(1)
})

try {
  await assertPortFree(apiPort)
  await assertPortFree(webPort)

  // 1. Start dedicated backend
  const backend = start(
    [resolve(root, 'backend/dist/programacion-academica/local-main.js')],
    resolve(root, 'backend'),
    {
      ...environment,
      SUM_ACADEMIC_SCHEDULING: '1',
      SUM_LOCAL_SCENARIOS: '0',
      SIMULATOR_DEPLOYMENT: 'local',
      PORT: String(apiPort),
      SUM_ACADEMIC_DRAFT_DIR: fixtureDir,
    }
  )
  await waitFor(`${api}/local/programacion-academica/v1/catalogo`, backend)

  // 2. Start dedicated frontend
  const frontend = start(
    [
      resolve(root, 'client/node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(webPort),
      '--strictPort',
    ],
    resolve(root, 'client'),
    {
      ...environment,
      VITE_SUM_DATA_MODE: 'local',
      VITE_SUM_API_BASE_URL: '/api',
      VITE_SUM_API_PROXY_TARGET: api,
      VITE_SUM_ACADEMIC_SCHEDULING: '1',
      VITE_SUM_SIMULATOR: '0',
      VITE_SUM_LOCAL_PROFILE: 'synthetic-actors',
    }
  )
  await waitFor(`${web}${route}`, frontend)

  // 3. Launch isolated Playwright browser
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
        ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
        : undefined),
  })

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()

  const jsErrors = []
  page.on('pageerror', (err) => jsErrors.push(err.message))

  await page.goto(`${web}${route}`)
  await page.getByRole('heading', { name: 'Programación académica asistida', exact: true }).waitFor()

  console.log('✓ Stage 0: Synthetic server and app launched successfully')

  // Helper to switch stages
  const goToStage = async (name, etapa) => {
    await page.getByRole('navigation', { name: 'Etapas de programación', exact: true }).getByRole('link', { name, exact: true }).click()
    await page.waitForURL(new RegExp(`etapa=${etapa}$`))
  }

  // --- PREPARATION & GENERATION ---
  await goToStage('Preparación', 'preparacion')

  const catalogRes = await fetch(`${api}/local/programacion-academica/v1/catalogo`)
  const catalog = await catalogRes.json()
  const course1 = catalog.courses[0]
  const course2 = catalog.courses[1]

  await page.getByLabel(`Seleccionar ${course1.courseId}`, { exact: true }).check()
  await page.getByLabel(`Demanda ${course1.courseId}`, { exact: true }).fill('90')
  await page.getByLabel(`Capacidad ${course1.courseId}`, { exact: true }).fill('45')

  if (course2) {
    await page.getByLabel(`Seleccionar ${course2.courseId}`, { exact: true }).check()
    await page.getByLabel(`Demanda ${course2.courseId}`, { exact: true }).fill('90')
    await page.getByLabel(`Capacidad ${course2.courseId}`, { exact: true }).fill('45')
  }

  // Generate proposal
  const genPending = page.waitForResponse((res) => res.url().endsWith('/propuestas') && res.request().method() === 'POST')
  await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
  const genResponse = await genPending
  assert.equal(genResponse.status(), 200)
  const proposalData = await genResponse.json()

  await goToStage('Horario', 'horario')
  await page.locator(`.academic-scheduling__result--${proposalData.status}`).waitFor()

  console.log('✓ Stage 1: Proposal generated successfully')

  // --- ACCEPTANCE CRITERION 2: View switching & scroll offsets & 720px ---
  // In Tabla view:
  const searchInput = page.getByRole('searchbox', { name: 'Buscar secciones' })
  const queryPrefix = course1.name.slice(0, 5)
  await searchInput.fill(queryPrefix)

  // Select a section
  const firstRow = page.locator('tr[data-section-id]').first()
  await firstRow.click()
  const selectedId = await firstRow.getAttribute('data-section-id')
  assert.ok(selectedId)

  // Scroll tabla down
  await page.evaluate(() => window.scrollTo(0, 240))
  const tablaScrollY = await page.evaluate(() => window.scrollY)
  assert.equal(tablaScrollY, 240, 'Tabla scroll offset should be 240px')

  // Switch to Semana view
  await page.getByRole('button', { name: 'Semana', exact: true }).click()
  await page.locator('.planning-week').waitFor()

  // Verify search query and selected section are preserved
  const semanaSearch = await searchInput.inputValue()
  assert.equal(semanaSearch, queryPrefix, 'Search query preserved across view switch')

  assert.equal(await page.locator('.planning-week__block--selected').first().getAttribute('data-week-grid-section-id'), selectedId)

  // Scroll semana view down to different offset
  await page.evaluate(() => window.scrollTo(0, 160))
  const semanaScrollY = await page.evaluate(() => window.scrollY)
  assert.equal(semanaScrollY, 160, 'Semana scroll offset should be 160px')

  // Switch back to Tabla view
  await page.getByRole('button', { name: 'Tabla', exact: true }).click()
  await page.locator('.planning-sections__table').waitFor()

  // Verify tabla scroll offset is restored!
  const restoredTablaScroll = await page.evaluate(() => window.scrollY)
  assert.equal(restoredTablaScroll, 240, 'Tabla scroll offset restored on return to Tabla')

  // Switch to Semana view again
  await page.getByRole('button', { name: 'Semana', exact: true }).click()
  await page.locator('.planning-week').waitFor()

  // Verify semana scroll offset is restored!
  const restoredSemanaScroll = await page.evaluate(() => window.scrollY)
  assert.equal(restoredSemanaScroll, 160, 'Semana scroll offset restored on return to Semana')

  // Check 720px viewport: visible agenda refs and no page overflow
  await page.setViewportSize({ width: 720, height: 700 })
  await page.waitForTimeout(100)

  // At 720px: grid is hidden, agenda is visible
  const gridVisible = await page.locator('.planning-week__grid-wrapper').isVisible()
  const agendaVisible = await page.locator('.planning-week__agenda').isVisible()
  assert.equal(gridVisible, false, 'Desktop grid is hidden at 720px')
  assert.equal(agendaVisible, true, 'Day agenda is visible at 720px')

  // Verify no page horizontal overflow at 720px
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
  assert.ok(noOverflow, 'Document must not overflow horizontally at 720px')

  // Restore 1440px desktop viewport
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.waitForTimeout(100)

  console.log('✓ Criterion 2 passed: Selection, search, and actual scroll offsets preserved each way; at 720px agenda visible with no page overflow')

  await verifyWeekScenarios({ page, api, catalog, goToStage })
  assert.deepEqual(jsErrors, [], 'No browser runtime errors')
  console.log('PASS: Semana acceptance scenarios completed against synthetic NestJS API')

} finally {
  await cleanup()
  try {
    await rm(fixtureDir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

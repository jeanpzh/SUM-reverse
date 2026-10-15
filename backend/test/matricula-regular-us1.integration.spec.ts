import { afterAll, beforeAll, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { chromium } from '../../client/node_modules/playwright/index.mjs'
import { createServer, type ViteDevServer } from '../../client/node_modules/vite/dist/node/index.js'
import { createMatriculaRegularTestApp, type MatriculaRegularTestApp } from './matricula-regular-test-app.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'

// Root owns browser. Both servers are created here with independent synthetic factories.
// Bind must succeed before any HTTP/browser interaction; occupied ports abort.
let app: MatriculaRegularTestApp | undefined
let client: ViteDevServer | undefined
const root = resolve(process.cwd(), '..')
const origin = 'http://127.0.0.1:5741'

beforeAll(async () => {
  app = await createMatriculaRegularTestApp()
  await app.listen()
  process.env.VITE_SUM_DATA_MODE = 'local'
  process.env.VITE_SUM_API_BASE_URL = '/api'
  client = await createServer({
    root: resolve(root, 'client'),
    configFile: resolve(root, 'client/vite.matricula-test.config.ts'),
    server: { watch: null },
  })
  await client.listen()
}, 60000)

afterAll(async () => {
  await client?.close()
  await app?.close()
})

it('T017: both schools, real React→own MR-CTX, CSV, empty/incomplete/flags and no writes', async () => {
  expect(app).toBeDefined()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true })
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin === origin ? route.continue() : route.abort()
  })
  const page = await context.newPage()
  page.on('requestfailed', request => console.log('OWN request failed:', new URL(request.url()).origin, new URL(request.url()).pathname, request.failure()?.errorText))
  page.on('pageerror', error => console.log('OWN synthetic page error:', error.message))
  page.on('response', response => { if (response.status() >= 400) console.log('OWN response:', response.status(), new URL(response.url()).pathname) })
  const ownMethods: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/local/matricula-regular/v1/')) ownMethods.push(request.method())
  })
  try {
    for (const school of ['SISTEMAS', 'SOFTWARE'] as const) {
      for (const scenario of ['enabled', 'disabled', 'unknown', 'empty', 'incomplete', 'document-only']) {
        const fixtures = [createSyntheticFixture('SISTEMAS'), createSyntheticFixture('SOFTWARE')]
        const fixture = fixtures.find(item => item.profile.scope.schoolId === school)!
        const actor = fixture.actors[0]!
        if (scenario === 'disabled') actor.preEnrollmentEnabled = false
        if (scenario === 'unknown') actor.preEnrollmentEnabled = null
        if (scenario === 'empty') actor.preEnrollment = []
        if (scenario === 'incomplete') actor.preEnrollmentComplete = false
        if (scenario === 'document-only') actor.preEnrollment.push({ ...actor.preEnrollment[0]!, courseId: school === 'SISTEMAS' ? 'SYN-SIS-DOCUMENT-ONLY' : 'SYN-SOFT-DOCUMENT-ONLY', name: 'Asignatura documental sintética no ofertada' })
        const runId = app!.repository.resetForTests(fixtures)
        const before = app!.repository.readSnapshot()
        if (scenario === 'document-only') expect(before.offer.some(course => course.courseId === actor.preEnrollment.at(-1)!.courseId)).toBe(false)
        await page.goto(`${origin}/local/matricula-regular`)
        if (school === 'SOFTWARE') {
          await page.locator('.regular-enrollment select').selectOption(actor.actorId)
        }
        const panel = page.locator('.pre-enrollment-panel')
        try { await panel.waitFor({ timeout: 10000 }) } catch (error) { console.log('OWN synthetic DOM:', await page.locator('body').innerText()); throw error }
        // Wait for exact scope; no response mocks or borrowed operator process.
        await page.waitForFunction(planId => document.querySelector('.student-summary')?.textContent?.includes(planId), actor.scope.planId)
        await page.waitForFunction(label => document.querySelector('.pre-enrollment-panel__status-badge')?.textContent?.trim() === label,
          scenario === 'disabled' ? 'No habilitada' : scenario === 'unknown' ? 'Desconocida (gap)' : 'Habilitada')
        const text = await panel.textContent()
        expect(text).toContain('La descarga no tiene efectos')
        expect(text).not.toContain('(US1)')
        if (scenario === 'empty') {
          expect(text).toContain('Documento vacío')
          expect(await panel.locator('button.download-button').count()).toBe(0)
        } else {
          for (const course of actor.preEnrollment) expect(text).toContain(course.courseId)
          const downloadPromise = page.waitForEvent('download')
          await panel.getByRole('button', { name: 'Descargar', exact: true }).click()
          const download = await downloadPromise
          expect(download.suggestedFilename()).toBe(`prematricula_${actor.actorId}.csv`)
          const path = await download.path()
          expect(path).not.toBeNull()
          const csv = await readFile(path!, 'utf8')
          for (const course of actor.preEnrollment) expect(csv).toContain(course.courseId)
          expect(csv).toContain('Código de Asignatura')
          if (scenario === 'incomplete') {
            expect(text).toContain('PLAN_OR_OFFER_UNKNOWN')
            expect(await panel.locator('[role="status"]').count()).toBeGreaterThan(0)
          }
        }
        await page.getByRole('button', { name: 'Actualizar contexto', exact: true }).click()
        await page.getByRole('button', { name: 'Actualizar contexto', exact: true }).waitFor()
        expect(app!.repository.runId).toBe(runId)
        expect(app!.repository.readSnapshot()).toEqual(before)
      }
    }
    expect(ownMethods.length).toBeGreaterThanOrEqual(20)
    expect(ownMethods.every(method => method === 'GET')).toBe(true)
    // Real 404 remains an error, without mock fallback or document fabrication.
    const fixture = createSyntheticFixture('SOFTWARE')
    app!.repository.resetForTests([fixture])
    await page.goto(`${origin}/local/matricula-regular`)
    await page.getByRole('heading', { name: 'No se pudo cargar la información' }).waitFor()
    expect(await page.locator('.pre-enrollment-panel').count()).toBe(0)
  } finally {
    await context.close()
    await browser.close()
  }
}, 120000)

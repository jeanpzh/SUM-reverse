import { afterAll, beforeAll, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer, type ViteDevServer } from '../../client/node_modules/vite/dist/node/index.js'
import { createLocalProfileDashboardTestApp, type LocalProfileDashboardTestApp } from './local-profile-dashboard-test-app.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'

// This assigned integration spec owns its browser. Both servers are local synthetic fixtures.
// Bind must succeed before any HTTP/browser interaction; occupied ports abort.
let app: LocalProfileDashboardTestApp | undefined
let client: ViteDevServer | undefined
let syntheticDraftDir: string | undefined
const root = resolve(process.cwd(), '..')
const origin = 'http://127.0.0.1:5741'

async function loginAs(page: import('playwright').Page, runId: string, actorId: string) {
  await page.goto(`${origin}/local/login?runId=${runId}`)
  await page.locator(`input[name="profile"][value="${actorId}"]`).check()
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL(/\/alumnoWebSum\/v2\/inicio$/)
  await page.goto(`${origin}/local/matricula-regular`)
  await page.locator('.regular-enrollment__local-details > summary').click()
}

beforeAll(async () => {
  syntheticDraftDir = await mkdtemp(resolve(tmpdir(), 'sum-matricula-us1-'))
  process.env.SUM_ACADEMIC_DRAFT_DIR = syntheticDraftDir
  app = await createLocalProfileDashboardTestApp({ clock: { now: () => new Date('2026-08-11T14:00:00.000Z') } })
  await app.listen(5742)
  process.env.VITE_SUM_DATA_MODE = 'local'
  process.env.VITE_SUM_API_BASE_URL = '/api'
  process.env.VITE_SUM_LOCAL_PROFILE = 'synthetic-actors'
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
  if (syntheticDraftDir) await rm(syntheticDraftDir, { recursive: true, force: true })
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
  const ownMethods: Array<{ method: string; path: string }> = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/local/matricula-regular/v1/') || path.startsWith('/api/local/perfiles/v1/consultas/')) ownMethods.push({ method: request.method(), path })
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
        const beforeDocument = app!.repository.readSnapshot()
        if (scenario === 'document-only') expect(beforeDocument.offer.some(course => course.courseId === actor.preEnrollment.at(-1)!.courseId)).toBe(false)
        await loginAs(page, runId, actor.actorId)
        const before = app!.repository.readSnapshot()
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
        await page.reload()
        await page.locator('.regular-enrollment__local-details > summary').click()
        await page.locator('.pre-enrollment-panel').waitFor()
        expect(app!.repository.runId).toBe(runId)
        expect(app!.repository.readSnapshot()).toEqual(before)
      }
    }
    const reads = ownMethods.filter(({ path }) => path.startsWith('/api/local/perfiles/v1/consultas/'))
    expect(reads.length).toBeGreaterThanOrEqual(20)
    expect(reads.every(({ method }) => method === 'GET')).toBe(true)
    expect(ownMethods.filter(({ method }) => method !== 'GET').every(({ method, path }) => method === 'POST' && /^\/api\/local\/matricula-regular\/v1\/sesiones(?:\/[0-9a-f-]+\/renovar)?$/.test(path))).toBe(true)
    expect(ownMethods.some(({ path }) => path.endsWith('/solicitudes'))).toBe(false)
    // Real 404 remains an error, without mock fallback or document fabrication.
    const fixture = createSyntheticFixture('SOFTWARE')
    app!.repository.resetForTests([fixture])
    const missing = await page.request.get(`${origin}/api/local/matricula-regular/v1/contextos/SYN-SIS-A`)
    expect(missing.status()).toBe(404)
    expect((await missing.json()).error.code).toBe('ACTOR_NOT_FOUND')
    await page.goto(`${origin}/local/matricula-regular`)
    await page.waitForURL('**/local/login')
    expect(await page.locator('.pre-enrollment-panel').count()).toBe(0)
  } finally {
    await context.close()
    await browser.close()
  }
}, 120000)

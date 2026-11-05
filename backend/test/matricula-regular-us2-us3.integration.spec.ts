import { beforeAll, afterAll, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'
import { createServer, type ViteDevServer } from '../../client/node_modules/vite/dist/node/index.js'
import { createLocalProfileDashboardTestApp, type LocalProfileDashboardTestApp } from './local-profile-dashboard-test-app.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { createDocumentaryProfile } from '../src/matricula-regular/profiles.js'

let now = new Date('2026-08-11T15:00:00.000Z')
let app: LocalProfileDashboardTestApp | undefined
let client: ViteDevServer | undefined
let syntheticDraftDir: string | undefined
const origin = 'http://127.0.0.1:5741'

async function loginAs(page: import('playwright').Page, runId: string, actorId: string) {
  await page.goto(`${origin}/local/login?runId=${runId}`)
  await page.locator(`input[name="profile"][value="${actorId}"]`).check()
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL(/\/alumnoWebSum\/v2\/inicio$/)
  await page.goto(`${origin}/local/matricula-regular`)
  await page.locator('.regular-enrollment__local-details > summary').click()
}

async function chooseSection(page: import('playwright').Page, courseId: string, sectionId: string) {
  const row = page.locator('.sum-enrollment__table tbody tr').filter({ hasText: courseId })
  await row.getByRole('button', { name: /^Elegir sección de / }).click()
  const dialog = page.getByRole('dialog', { name: 'Secciones disponibles', exact: true })
  await dialog.locator(`input[name="sum-section"][value="${sectionId}"]`).check()
  await dialog.getByRole('button', { name: '✓ Aceptar', exact: true }).click()
}

beforeAll(async () => {
  syntheticDraftDir = await mkdtemp(resolve(tmpdir(), 'sum-matricula-us2-'))
  process.env.SUM_ACADEMIC_DRAFT_DIR = syntheticDraftDir
  app = await createLocalProfileDashboardTestApp({ clock: { now: () => new Date(now) } })
  await app.listen(5742)
  process.env.VITE_SUM_DATA_MODE = 'local'
  process.env.VITE_SUM_API_BASE_URL = '/api'
  process.env.VITE_SUM_LOCAL_PROFILE = 'synthetic-actors'
  const root = resolve(process.cwd(), '..')
  client = await createServer({ root: resolve(root, 'client'), configFile: resolve(root, 'client/vite.matricula-test.config.ts'), server: { watch: null } })
  await client.listen()
}, 60000)
afterAll(async () => {
  await client?.close()
  await app?.close()
  if (syntheticDraftDir) await rm(syntheticDraftDir, { recursive: true, force: true })
})

it('T019/T022/T027: real session, renewal/expiry, selection without writes and documentary gaps in both schools', async () => {
  const browser = await chromium.launch({ headless: true })
  const browserContext = await browser.newContext()
  await browserContext.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  const page = await browserContext.newPage()
  const methods: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/local/matricula-regular/v1')) methods.push(request.method()) })
  const open = async (actorId: string, runId: string) => {
    await loginAs(page, runId, actorId)
    await page.locator('.enrollment-calendar-panel').waitFor()
    await page.waitForFunction(id => document.querySelector('.student-summary')?.textContent?.includes(id), actorId.includes('SOFT') ? 'SYN-SOFT-PLAN' : 'SYN-SIS-PLAN')
  }
  try {
    for (const school of ['SISTEMAS', 'SOFTWARE'] as const) {
      now = new Date('2026-08-11T15:00:00.000Z')
      const fixtures = [createSyntheticFixture('SISTEMAS'), createSyntheticFixture('SOFTWARE')]
      const fixture = fixtures.find(item => item.profile.scope.schoolId === school)!
      const actor = fixture.actors[0]!
      const course = fixture.offer[0]!
      const alternative = { ...structuredClone(course.sections[0]!), sectionId: `${course.sections[0]!.sectionId}-B` }
      course.sections.push(alternative)
      fixture.offer[1]!.sections[0]!.schedule = structuredClone(course.sections[0]!.schedule)
      fixture.offer[1]!.sections[0]!.occupied = fixture.offer[1]!.sections[0]!.capacity
      const runId = app!.repository.resetForTests(fixtures)
      await open(actor.actorId, runId)
      expect(await page.locator('.enrollment-calendar-panel table').first().locator('tbody tr').count()).toBe(9)
      expect(await page.locator('.enrollment-calendar-panel').textContent()).toContain('synthetic')
      expect(app!.repository.readSnapshot().sessions).toHaveLength(1)
      const initialSession = app!.repository.readSnapshot().sessions[0]!
      expect(initialSession.actorId).toBe(actor.actorId)
      expect(initialSession.expiresAt).toBe('2026-08-11T15:15:00.000Z')
      const beforeChoice = app!.repository.readSnapshot()
      const count = methods.length
      await chooseSection(page, course.courseId, course.sections[0]!.sectionId)
      await chooseSection(page, course.courseId, alternative.sectionId)
      expect(await page.locator('.sum-enrollment__table .sum-enrollment__section-badge').count()).toBe(1)
      expect(await page.locator('.sum-enrollment__totals').textContent()).toContain(`Créditos matriculados:${course.credits}`)
      const full = fixture.offer[1]!.sections[0]!
      const fullRow = page.locator('.sum-enrollment__table tbody tr').filter({ hasText: fixture.offer[1]!.courseId })
      await fullRow.getByRole('button', { name: /^Elegir sección de / }).click()
      const fullDialog = page.getByRole('dialog', { name: 'Secciones disponibles', exact: true })
      const fullRadio = fullDialog.locator(`input[name="sum-section"][value="${full.sectionId}"]`)
      expect(await fullRadio.isDisabled()).toBe(false)
      await fullRadio.focus()
      await page.keyboard.press('Space')
      await fullDialog.getByRole('button', { name: '✓ Aceptar', exact: true }).press('Enter')
      await page.waitForFunction(() => document.querySelectorAll('.sum-enrollment__table .sum-enrollment__section-badge').length === 2)
      expect(methods.length).toBe(count)
      expect(app!.repository.readSnapshot()).toEqual(beforeChoice)
      now = new Date('2026-08-11T15:05:00.000Z')
      const read = await page.request.get(`${origin}/api/local/perfiles/v1/consultas/matriculaInfo?${new URLSearchParams({
        runId, actorId: actor.actorId, sessionId: initialSession.sessionId,
      })}`)
      expect(read.status()).toBe(200)
      expect((await read.json()).data.payload.serverNow).toBe('2026-08-11T15:05:00.000Z')
      expect(app!.repository.readSnapshot().sessions[0]!.expiresAt).toBe(initialSession.expiresAt)
      const renewal = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/sesiones/${initialSession.sessionId}/renovar`)
        && response.request().method() === 'POST')
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      expect((await renewal).status()).toBe(200)
      expect(app!.repository.readSnapshot().sessions[0]!.sessionId).toBe(initialSession.sessionId)
      expect(app!.repository.readSnapshot().sessions[0]!.expiresAt).toBe('2026-08-11T15:20:00.000Z')
      now = new Date('2026-08-11T15:20:00.000Z')
      await page.reload()
      await page.waitForURL(/\/local\/login$/)
      expect(app!.repository.readSnapshot().sessions).toHaveLength(1)
      await loginAs(page, runId, actor.actorId)
      expect(app!.repository.readSnapshot().sessions).toHaveLength(2)
      expect(app!.repository.readSnapshot().requests).toEqual([])
      expect(app!.repository.readSnapshot().enrollments).toEqual([])
      expect(app!.repository.readSnapshot().reports).toEqual([])
      const documentary = createDocumentaryProfile(school)
      fixture.profile = documentary
      fixture.actors.forEach(item => { item.profileRevision = documentary.profileRevision })
      const documentaryRunId = app!.repository.resetForTests(fixtures)
      await open(actor.actorId, documentaryRunId)
      await page.waitForFunction(() => document.querySelector('.regular-enrollment__local-details')?.textContent?.includes('WINDOW_UNSPECIFIED'))
      expect(app!.repository.readSnapshot().sessions).toHaveLength(1)
      expect(app!.repository.readSnapshot().sessions[0]!.actorId).toBe(actor.actorId)
      expect(await page.locator('.sum-enrollment__pick').first().isDisabled()).toBe(true)
      expect(app!.repository.readSnapshot().sessions[0]!.actorId).toBe(actor.actorId)
    }
  } finally { await browserContext.close(); await browser.close() }
}, 120000)

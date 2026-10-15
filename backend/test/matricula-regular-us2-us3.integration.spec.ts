import { beforeAll, afterAll, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { chromium } from '../../client/node_modules/playwright/index.mjs'
import { createServer, type ViteDevServer } from '../../client/node_modules/vite/dist/node/index.js'
import { createMatriculaRegularTestApp, type MatriculaRegularTestApp } from './matricula-regular-test-app.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { createDocumentaryProfile } from '../src/matricula-regular/profiles.js'

let now = new Date('2026-08-11T15:00:00.000Z')
let app: MatriculaRegularTestApp | undefined
let client: ViteDevServer | undefined
const origin = 'http://127.0.0.1:5741'
beforeAll(async () => {
  app = await createMatriculaRegularTestApp({ now: () => new Date(now) })
  await app.listen()
  process.env.VITE_SUM_DATA_MODE = 'local'
  process.env.VITE_SUM_API_BASE_URL = '/api'
  const root = resolve(process.cwd(), '..')
  client = await createServer({ root: resolve(root, 'client'), configFile: resolve(root, 'client/vite.matricula-test.config.ts'), server: { watch: null } })
  await client.listen()
}, 60000)
afterAll(async () => { await client?.close(); await app?.close() })

it('T019/T022/T027: real session, renewal/expiry, selection without writes and documentary gaps in both schools', async () => {
  const browser = await chromium.launch({ headless: true })
  const browserContext = await browser.newContext()
  await browserContext.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  const page = await browserContext.newPage()
  const methods: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/local/matricula-regular/v1')) methods.push(request.method()) })
  const open = async (actorId: string) => {
    await page.goto(`${origin}/local/matricula-regular`)
    if (actorId !== 'SYN-SIS-A') await page.locator('.regular-enrollment select').selectOption(actorId)
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
      app!.repository.resetForTests(fixtures)
      await open(actor.actorId)
      expect(await page.locator('.enrollment-calendar-panel table').first().locator('tbody tr').count()).toBe(9)
      expect(await page.locator('.enrollment-calendar-panel').textContent()).toContain('synthetic')
      expect(await page.locator('.section-button').first().isDisabled()).toBe(true)
      await page.getByRole('button', { name: 'Iniciar sesión local', exact: true }).click()
      await page.getByText('Sesión local iniciada. Elegir asignaturas no registra matrícula.', { exact: true }).waitFor()
      const initialSession = app!.repository.readSnapshot().sessions[0]!
      expect(initialSession.actorId).toBe(actor.actorId)
      expect(initialSession.expiresAt).toBe('2026-08-11T15:15:00.000Z')
      const beforeChoice = app!.repository.readSnapshot()
      const count = methods.length
      const option = page.locator('.section-button').filter({ has: page.getByText(course.sections[0]!.sectionId, { exact: true }) })
      await option.click()
      await page.locator('.section-button').filter({ has: page.getByText(alternative.sectionId, { exact: true }) }).click()
      await page.waitForFunction(() => document.querySelectorAll('.section-button[aria-pressed="true"]').length === 1)
      expect(await page.locator('.course-selection-panel__total-credits strong').textContent()).toBe(String(course.credits))
      const full = fixture.offer[1]!.sections[0]!
      const fullButton = page.locator('.section-button').filter({ has: page.getByText(full.sectionId, { exact: true }) })
      expect(await fullButton.isDisabled()).toBe(false)
      await fullButton.press('Enter')
      await page.waitForFunction(() => document.querySelectorAll('.section-button[aria-pressed="true"]').length === 2)
      expect(methods.length).toBe(count)
      expect(app!.repository.readSnapshot()).toEqual(beforeChoice)
      now = new Date('2026-08-11T15:05:00.000Z')
      await page.getByRole('button', { name: 'Actualizar contexto', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.enrollment-calendar-panel')?.textContent?.includes('2026-08-11T15:05:00.000Z'))
      expect(app!.repository.readSnapshot().sessions[0]!.expiresAt).toBe(initialSession.expiresAt)
      await page.getByRole('button', { name: 'Renovar sesión local', exact: true }).click()
      await page.getByText('Sesión local renovada explícitamente.', { exact: true }).waitFor()
      expect(app!.repository.readSnapshot().sessions[0]!.sessionId).toBe(initialSession.sessionId)
      expect(app!.repository.readSnapshot().sessions[0]!.expiresAt).toBe('2026-08-11T15:20:00.000Z')
      now = new Date('2026-08-11T15:20:00.000Z')
      await page.getByRole('button', { name: 'Actualizar contexto', exact: true }).click()
      await page.getByText('La sesión local terminó o cambió el entorno. Ingrese de nuevo.', { exact: true }).waitFor()
      expect(await page.locator('.section-button[aria-pressed="true"]').count()).toBe(0)
      await page.getByRole('button', { name: 'Iniciar sesión local', exact: true }).click()
      await page.getByText('Sesión local iniciada. Elegir asignaturas no registra matrícula.', { exact: true }).waitFor()
      expect(app!.repository.readSnapshot().sessions).toHaveLength(2)
      expect(app!.repository.readSnapshot().requests).toEqual([])
      expect(app!.repository.readSnapshot().enrollments).toEqual([])
      expect(app!.repository.readSnapshot().reports).toEqual([])
      const documentary = createDocumentaryProfile(school)
      fixture.profile = documentary
      fixture.actors.forEach(item => { item.profileRevision = documentary.profileRevision })
      app!.repository.resetForTests(fixtures)
      await open(actor.actorId)
      await page.waitForFunction(() => document.querySelector('.regular-enrollment')?.textContent?.includes('WINDOW_UNSPECIFIED'))
      expect(await page.getByRole('button', { name: 'Iniciar sesión local', exact: true }).isDisabled()).toBe(true)
      expect(await page.locator('.section-button').first().isDisabled()).toBe(true)
      expect(app!.repository.readSnapshot().sessions).toEqual([])
    }
  } finally { await browserContext.close(); await browser.close() }
}, 120000)

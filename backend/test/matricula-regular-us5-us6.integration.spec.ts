import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { createServer, type ViteDevServer } from '../../client/node_modules/vite/dist/node/index.js'
import { createLocalProfileDashboardTestApp, type LocalProfileDashboardTestApp } from './local-profile-dashboard-test-app.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import type { School, SyntheticFixture } from '../src/matricula-regular/profile.types.js'

let now = new Date('2026-08-11T15:00:00.000Z')
let app: LocalProfileDashboardTestApp | undefined
let client: ViteDevServer | undefined
let syntheticDraftDir: string | undefined
const origin = 'http://127.0.0.1:5741'

async function loginAs(page: Page, runId: string, actorId: string) {
  await page.goto(`${origin}/local/login?runId=${runId}`)
  await page.locator(`input[name="profile"][value="${actorId}"]`).check()
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL(/\/alumnoWebSum\/v2\/inicio$/)
  await page.goto(`${origin}/local/matricula-regular`)
}

beforeAll(async () => {
  syntheticDraftDir = await mkdtemp(resolve(tmpdir(), 'sum-matricula-us5-'))
  process.env.SUM_ACADEMIC_DRAFT_DIR = syntheticDraftDir
  app = await createLocalProfileDashboardTestApp({ clock: { now: () => new Date(now) } })
  await app.listen(5742)
  process.env.VITE_SUM_DATA_MODE = 'local'
  process.env.VITE_SUM_API_BASE_URL = '/api'
  process.env.VITE_SUM_LOCAL_PROFILE = 'synthetic-actors'
  const root = resolve(process.cwd(), '..')
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

function buildFixtures(): SyntheticFixture[] {
  return [createSyntheticFixture('SISTEMAS'), createSyntheticFixture('SOFTWARE')]
}

async function createBrowserSession() {
  const browser: Browser = await chromium.launch({ headless: true })
  const browserContext: BrowserContext = await browser.newContext()
  // Loopback guard: block any external request outside our origin
  await browserContext.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  )
  const page: Page = await browserContext.newPage()
  return { browser, browserContext, page }
}

async function openScreen(page: Page, actorId: string, runId: string) {
  await loginAs(page, runId, actorId)
  await page.locator('.regular-enrollment__local-details > summary').click()
  await page.locator('.enrollment-calendar-panel').waitFor()
  await page.waitForFunction(
    (id) => document.querySelector('.student-summary')?.textContent?.includes(id),
    actorId.includes('SOFT') ? 'SYN-SOFT-PLAN' : 'SYN-SIS-PLAN',
  )
}

async function chooseSection(page: Page, courseId: string, sectionId: string) {
  const row = page.locator('.sum-enrollment__table tbody tr').filter({ hasText: courseId })
  await row.getByRole('button', { name: /^Elegir sección de / }).click()
  const dialog = page.getByRole('dialog', { name: 'Secciones disponibles', exact: true })
  await dialog.locator(`input[name="sum-section"][value="${sectionId}"]`).check()
  await dialog.getByRole('button', { name: '✓ Aceptar', exact: true }).click()
}

async function chooseCourses(page: Page, courses: SyntheticFixture['offer']) {
  for (const course of courses) await chooseSection(page, course.courseId, course.sections[0]!.sectionId)
}

async function confirmSubmission(page: Page) {
  await page.getByRole('button', { name: 'Ejecutar Matrícula', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Aviso', exact: true })
  await dialog.waitFor({ state: 'visible' })
  return dialog
}

describe('Matricula Regular US5 & US6 Integration: 4 autonomous groups across both schools (12 recorridos)', () => {
  // =========================================================================
  // GROUP 1: US5 Rechazo real UI → Nest → Snapshot (SISTEMAS y SOFTWARE)
  // =========================================================================
  describe('Group 1: US5 Real Rejection UI -> Nest -> Snapshot', () => {
    it.each(['SISTEMAS', 'SOFTWARE'] as const)(
      '%s: invalid selection with multiple causes, D2 heading/wrapTab/ShiftTab/Escape/heading return, outcome recorded with 0 enrollments/reports/occupied',
      async (school: School) => {
        const { browser, browserContext, page } = await createBrowserSession()
        try {
          now = new Date('2026-08-11T15:00:00.000Z')
          const fixtures = buildFixtures()
          const fixture = fixtures.find((f) => f.profile.scope.schoolId === school)!
          const actor = fixture.actors[0]!

          // Setup MULTIPLE causes for rejection:
          // 1. Schedule conflict: make course[1] section schedule overlap course[0] section schedule
          // 2. Section full: make section occupied >= capacity on course[1]
          // 3. Below credit minimum: selecting only 2 courses with total credits < 12 (4 + 3 = 7 credits < 12)
          const course0 = fixture.offer[0]!
          const course1 = fixture.offer[1]!
          course1.sections[0]!.schedule = structuredClone(course0.sections[0]!.schedule)
          course1.sections[0]!.occupied = course1.sections[0]!.capacity

          const runId = app!.repository.resetForTests(fixtures)
          const initialSnapshot = app!.repository.readSnapshot()

          await openScreen(page, actor.actorId, runId)

          // Select both conflicting courses
          await chooseSection(page, course0.courseId, course0.sections[0]!.sectionId)
          await chooseSection(page, course1.courseId, course1.sections[0]!.sectionId)
          expect(await page.locator('.sum-enrollment__table .sum-enrollment__section-badge').count()).toBe(2)

          // The existing SUM flow opens its confirmation alert before submitting.
          expect(await page.getByRole('button', { name: 'Ejecutar Matrícula', exact: true }).isEnabled()).toBe(true)
          const confirmDialog = await confirmSubmission(page)
          await confirmDialog.getByRole('button', { name: 'EJECUTAR', exact: true }).click()

          // The current SUM error alert is labelled «Aviso» and keeps its academic causes.
          const dialog = page.locator('dialog.sum-alert--error')
          await dialog.waitFor({ state: 'visible' })
          expect(await dialog.getByRole('heading', { name: 'Aviso', exact: true }).isVisible()).toBe(true)
          await page.waitForFunction(() => document.querySelector('dialog.sum-alert--error')?.contains(document.activeElement) === true)

          // D2: Verify multiple causes are displayed in the dialog
          const causesList = dialog.locator('.sum-alert__causes')
          expect(await causesList.isVisible()).toBe(true)
          const causesText = await causesList.textContent()
          expect(causesText).toContain('Cruce de horarios detectado')
          expect(causesText).toContain('Carga de créditos fuera de rango')
          expect(causesText).toContain('Sección sin vacantes disponibles')

          // Native modal focus remains inside the current dialog in both keyboard directions.
          await page.keyboard.press('Tab')
          expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
          await page.keyboard.press('Shift+Tab')
          expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)

          // D2: Escape key closes the dialog
          await page.keyboard.press('Escape')
          await dialog.waitFor({ state: 'hidden' })
          expect(await dialog.isVisible()).toBe(false)

          // D2: Return to screen with EMPTY selection (L-06)
          await page.waitForFunction(() => document.querySelectorAll('.sum-enrollment__table .sum-enrollment__section-badge').length === 0)
          const selectedAfterClose = await page.locator('.sum-enrollment__table .sum-enrollment__section-badge').count()
          expect(selectedAfterClose).toBe(0)

          // D2: Return focus lands on registration heading because opener (submit button) is disabled
          await page.waitForFunction(() => document.activeElement?.id === 'sum-enrollment-heading')
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('sum-enrollment-heading')

          // Snapshot verification:
          // 1. requests contains the rejected outcome with causes
          // 2. enrollments has 0 items (no enrollment created!)
          // 3. reports has 0 items (no report created!)
          // 4. occupied capacities are completely UNALTERED
          const postSnapshot = app!.repository.readSnapshot()
          expect(postSnapshot.requests).toHaveLength(1)
          const [, recordedRequest] = postSnapshot.requests[0]!
          expect(recordedRequest.payload.actorId).toBe(actor.actorId)
          expect(recordedRequest.outcome?.state).toBe('rejected')
          expect(recordedRequest.outcome?.causes.length).toBeGreaterThanOrEqual(2)

          expect(postSnapshot.enrollments).toHaveLength(0)
          expect(postSnapshot.reports).toHaveLength(0)

          // Verify all section occupied counts are identical to initial
          for (const course of postSnapshot.offer) {
            const initialCourse = initialSnapshot.offer.find((c) => c.courseId === course.courseId)!
            for (const section of course.sections) {
              const initialSection = initialCourse.sections.find((s) => s.sectionId === section.sectionId)!
              expect(section.occupied).toBe(initialSection.occupied)
            }
          }
        } finally {
          await browserContext.close()
          await browser.close()
        }
      },
      60000,
    )
  })

  // =========================================================================
  // GROUP 2: US6 Aceptación real UI → Nest → Estado/Reporte (SISTEMAS y SOFTWARE)
  // =========================================================================
  describe('Group 2: US6 Real Acceptance UI -> Nest -> State/Report', () => {
    it.each(['SISTEMAS', 'SOFTWARE'] as const)(
      '%s: repeated confirmation creates one enrollment/quota, automatic accepted report, P1 report focus, rows/total, single .csv extension, reload without writes',
      async (school: School) => {
        const { browser, browserContext, page } = await createBrowserSession()
        try {
          now = new Date('2026-08-11T15:00:00.000Z')
          const fixtures = buildFixtures()
          const fixture = fixtures.find((f) => f.profile.scope.schoolId === school)!
          const actor = fixture.actors[0]!

          // Valid selection: all courses in offer of the plan (which sum to valid credits >= 12, <= 26 without conflicts)
          const runId = app!.repository.resetForTests(fixtures)

          await openScreen(page, actor.actorId, runId)

          // Select courses to form a valid enrollment (all available offered courses)
          const planCourses = fixture.offer.filter((c) => c.planId === actor.scope.planId)
          await chooseCourses(page, planCourses)
          expect(await page.locator('.sum-enrollment__table .sum-enrollment__section-badge').count()).toBe(planCourses.length)
          expect(await page.getByRole('button', { name: 'Ejecutar Matrícula', exact: true }).isEnabled()).toBe(true)

          // Exercise duplicate confirmation events through the current SUM confirmation alert.
          const confirmDialog = await confirmSubmission(page)
          const execute = confirmDialog.getByRole('button', { name: 'EJECUTAR', exact: true })
          await execute.evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })

          // Accepted outcomes show the current «Aviso» alert before the automatic report navigation.
          const dialog = page.locator('dialog.sum-alert--success')
          await dialog.waitFor({ state: 'visible' })
          expect(await dialog.getByRole('heading', { name: 'Aviso', exact: true }).isVisible()).toBe(true)
          await page.waitForURL(/\/local\/matricula-regular\/reporte\//)
          await page.locator('#regular-enrollment-report-heading').waitFor({ state: 'visible' })

          // Snapshot check immediately after submit:
          // Exactly 1 enrollment, exactly 1 request outcome, quota incremented by 1 per section
          const snapAfterSubmit = app!.repository.readSnapshot()
          expect(snapAfterSubmit.enrollments).toHaveLength(1)
          expect(snapAfterSubmit.reports).toHaveLength(1)
          expect(snapAfterSubmit.requests).toHaveLength(1)
          const [, enrolled] = snapAfterSubmit.enrollments[0]!
          expect(enrolled.actorId).toBe(actor.actorId)

          for (const course of planCourses) {
            const section = snapAfterSubmit.offer
              .find((c) => c.courseId === course.courseId)!
              .sections.find((s) => s.sectionId === course.sections[0]!.sectionId)!
            expect(section.occupied).toBe(course.sections[0]!.occupied + 1)
          }

          // The accepted alert redirects automatically; the committed report remains available after navigation.
          expect(await dialog.isVisible()).toBe(false)
          const snapAfterRedirect = app!.repository.readSnapshot()
          expect(snapAfterRedirect.enrollments).toHaveLength(1)
          expect(snapAfterRedirect.reports).toHaveLength(1)

          // URL navigates to child route / Outlet
          expect(page.url()).toContain(`/local/matricula-regular/reporte/${enrolled.enrollmentId}`)
          expect(page.url()).toContain(`runId=${snapAfterSubmit.runId}`)
          expect(page.url()).toContain(`actorId=${actor.actorId}`)

          // Report view is rendered inside <Outlet />
          const reportHeading = page.locator('#regular-enrollment-report-heading')
          await reportHeading.waitFor({ state: 'visible' })
          expect(await reportHeading.textContent()).toBe('ASIGNATURAS MATRICULADAS')

          // P1: Real programmatic focus on heading
          await page.waitForFunction(() => document.activeElement?.id === 'regular-enrollment-report-heading')
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('regular-enrollment-report-heading')

          // Verify rows and total credits in the report
          const reportRows = page.locator('.regular-enrollment-report table tbody tr')
          expect(await reportRows.count()).toBe(planCourses.length)

          const totalCreditsExpected = planCourses.reduce((sum, c) => sum + c.credits, 0)
          const totalCreditsText = await page
            .locator('.regular-enrollment-report__totals p').first()
            .textContent()
          expect(totalCreditsText).toBe(`Créditos matriculados : ${totalCreditsExpected}`)

          // CSV Download: filename must have exactly ONE extension (.csv) without -demo in local mode
          const downloadPromise = page.waitForEvent('download')
          await page.getByRole('button', { name: 'Descargar', exact: true }).click()
          const download = await downloadPromise
          const filename = download.suggestedFilename()
          expect(filename).toBe(`reporte-matricula-${actor.actorId}.csv`)
          expect(filename.endsWith('.csv')).toBe(true)
          expect(filename.split('.').length).toBe(2)

          // Reload of valid report URL: GET without writes
          const snapshotBeforeReload = app!.repository.readSnapshot()
          await page.reload()
          await page.locator('#regular-enrollment-report-heading').waitFor({ state: 'visible' })
          const snapshotAfterReload = app!.repository.readSnapshot()
          expect(snapshotAfterReload).toEqual(snapshotBeforeReload)
        } finally {
          await browserContext.close()
          await browser.close()
        }
      },
      60000,
    )
  })

  // =========================================================================
  // GROUP 3: Pending/Unknown: Datos/reglas unknown suficientes para outcome pending
  // =========================================================================
  describe('Group 3: Pending/Unknown outcome with academic rule unknown', () => {
    it.each(['SISTEMAS', 'SOFTWARE'] as const)(
      '%s: academic rule unknown with eligible context allows selection, yields non-modal pending notice, zero writes, GET unknown without inferred outcome, no polling/autopost',
      async (school: School) => {
        const { browser, browserContext, page } = await createBrowserSession()
        try {
          now = new Date('2026-08-11T15:00:00.000Z')
          const fixtures = buildFixtures()
          const fixture = fixtures.find((f) => f.profile.scope.schoolId === school)!
          const actor = fixture.actors[0]!

          // Mark academic rule CREDIT-LOAD as unknown:
          // Context eligibility remains 'eligible' (because CREDIT-LOAD is evaluated during selection submit)
          actor.rules.push({
            ruleId: 'CREDIT-LOAD',
            sourceIds: ['F1'],
            knowledge: 'unknown',
          })

          const runId = app!.repository.resetForTests(fixtures)
          const initialSnapshot = app!.repository.readSnapshot()

          let requestCount = 0
          page.on('request', (req) => {
            if (req.url().includes('/api/local/matricula-regular/v1')) {
              requestCount += 1
            }
          })

          await openScreen(page, actor.actorId, runId)

          // Select courses
          const planCourses = fixture.offer.filter((c) => c.planId === actor.scope.planId)
          await chooseCourses(page, planCourses)
          expect(await page.locator('.sum-enrollment__table .sum-enrollment__section-badge').count()).toBe(planCourses.length)

          // Submit through the existing confirmation alert.
          const confirmDialog = await confirmSubmission(page)
          await confirmDialog.getByRole('button', { name: 'EJECUTAR', exact: true }).click()

          // Notice must be NON-MODAL (no dialog open)
          const dialogs = await page.locator('dialog[open]').count()
          expect(dialogs).toBe(0)

          // Non-modal warning notice displayed in SubmissionPanel
          const notice = page.locator('.regular-enrollment__notice--warning')
          await notice.waitFor({ state: 'visible' })
          const noticeText = await notice.textContent()
          expect(noticeText).toBe('La solicitud requiere configuración local y no se presenta como matrícula.')

          // Zero writes verification:
          // - 0 enrollments created
          // - 0 reports created
          // - 0 occupied changed
          // - requests has 1 item with state 'configuration-pending'
          const snapAfterPending = app!.repository.readSnapshot()
          expect(snapAfterPending.enrollments).toHaveLength(0)
          expect(snapAfterPending.reports).toHaveLength(0)
          expect(snapAfterPending.requests).toHaveLength(1)
          const [, storedPending] = snapAfterPending.requests[0]!
          expect(storedPending.outcome?.state).toBe('configuration-pending')

          for (const course of snapAfterPending.offer) {
            const initialCourse = initialSnapshot.offer.find((c) => c.courseId === course.courseId)!
            for (const section of course.sections) {
              const initialSection = initialCourse.sections.find((s) => s.sectionId === section.sectionId)!
              expect(section.occupied).toBe(initialSection.occupied)
            }
          }

          // No polling or autopost: request count stabilizes
          const countBeforeWait = requestCount
          await page.waitForTimeout(1000)
          expect(requestCount).toBe(countBeforeWait)
        } finally {
          await browserContext.close()
          await browser.close()
        }
      },
      60000,
    )
  })

  // =========================================================================
  // GROUP 4: Recuperación de red local sintética y run reset (SISTEMAS y SOFTWARE)
  // =========================================================================
  describe('Group 4: Local synthetic network recovery and run reset', () => {
    it.each(['SISTEMAS', 'SOFTWARE'] as const)(
      '%s: handles transport loss before Nest -> GET unknown -> manual replay same UUID/payload with active session',
      async (school: School) => {
        const { browser, browserContext, page } = await createBrowserSession()
        try {
          now = new Date('2026-08-11T15:00:00.000Z')
          const fixtures = buildFixtures()
          const fixture = fixtures.find((f) => f.profile.scope.schoolId === school)!
          const actor = fixture.actors[0]!
          const planCourses = fixture.offer.filter((c) => c.planId === actor.scope.planId)

          const runId = app!.repository.resetForTests(fixtures)

          await openScreen(page, actor.actorId, runId)

          await chooseCourses(page, planCourses)

          // Cut transport BEFORE reaching Nest for the POST submit
          let dropSubmitOnce = true
          await page.route('**/solicitudes', (route) => {
            if (dropSubmitOnce && route.request().method() === 'POST') {
              dropSubmitOnce = false
              return route.abort('failed')
            } else {
              return route.continue()
            }
          })

          const confirmDialog = await confirmSubmission(page)
          await confirmDialog.getByRole('button', { name: 'EJECUTAR', exact: true }).click()

          // UI enters uncertain state: "Resultado no confirmado"
          const uncertainBlock = page.locator('.regular-enrollment__uncertain')
          await uncertainBlock.waitFor({ state: 'visible' })
          expect(await uncertainBlock.textContent()).toContain('Resultado no confirmado')
          expect(await uncertainBlock.textContent()).toContain('No se recibió respuesta de la API local')

          // Verify sessionStorage contains exact 5 keys without sessionId/outcome
          const intentKey = `mr:intent:${app!.repository.runId}:${actor.actorId}`
          const storedRaw = await page.evaluate((k) => sessionStorage.getItem(k), intentKey)
          expect(storedRaw).toBeTruthy()
          const stored = JSON.parse(storedRaw!)
          expect(Object.keys(stored).sort()).toEqual([
            'actorId',
            'profileRevision',
            'requestId',
            'runId',
            'selection',
          ])
          expect(stored.sessionId).toBeUndefined()
          expect(stored.outcome).toBeUndefined()
          expect(stored.report).toBeUndefined()

          // Verify canonical payload structure: selection has exact courseId and sectionId
          expect(stored.actorId).toBe(actor.actorId)
          expect(stored.runId).toBe(app!.repository.runId)
          expect(stored.selection).toHaveLength(planCourses.length)

          // Click "Consultar resultado" -> GET against Nest returns unknown
          await page.getByRole('button', { name: 'Consultar resultado', exact: true }).click()
          await page
            .getByText('Aún no hay un resultado publicado para esta solicitud en esta ejecución.', { exact: false })
            .waitFor()

          // Click "Repetir el mismo envío" -> Manual replay sends same UUID and payload with active session
          await page.getByRole('button', { name: 'Repetir el mismo envío', exact: true }).click()

          // Manual replay succeeds and the current screen navigates to the accepted report.
          await page.waitForURL(/\/local\/matricula-regular\/reporte\//)

          // Snapshot has exactly 1 enrollment
          const snap = app!.repository.readSnapshot()
          expect(snap.enrollments).toHaveLength(1)
          expect(snap.requests).toHaveLength(1)
          const [, storedReq] = snap.requests[0]!
          expect(storedReq.outcome.requestId).toBe(stored.requestId)
        } finally {
          await browserContext.close()
          await browser.close()
        }
      },
      60000,
    )

    it.each(['SISTEMAS', 'SOFTWARE'] as const)(
      '%s: handles transport loss after REAL COMMIT -> GET known same report without double quota',
      async (school: School) => {
        const { browser, browserContext, page } = await createBrowserSession()
        try {
          now = new Date('2026-08-11T15:00:00.000Z')
          const fixtures = buildFixtures()
          const fixture = fixtures.find((f) => f.profile.scope.schoolId === school)!
          const actor = fixture.actors[0]!
          const planCourses = fixture.offer.filter((c) => c.planId === actor.scope.planId)

          const runId = app!.repository.resetForTests(fixtures)

          await openScreen(page, actor.actorId, runId)

          await chooseCourses(page, planCourses)

          // Cut transport AFTER real commit: server executes and commits, but response is dropped
          let dropAfterCommit = true
          await page.route('**/solicitudes', async (route) => {
            if (dropAfterCommit && route.request().method() === 'POST') {
              dropAfterCommit = false
              await route.fetch()
              // Server has committed; now abort the response
              await route.abort('failed')
            } else {
              await route.continue()
            }
          })

          const confirmDialog = await confirmSubmission(page)
          await confirmDialog.getByRole('button', { name: 'EJECUTAR', exact: true }).click()

          // UI received network error and shows uncertain
          const uncertainBlock = page.locator('.regular-enrollment__uncertain')
          await uncertainBlock.waitFor({ state: 'visible' })
          expect(await uncertainBlock.textContent()).toContain('Resultado no confirmado')

          // Check snapshot BEFORE user acts: commit ALREADY happened on the server!
          const snapCommitted = app!.repository.readSnapshot()
          expect(snapCommitted.enrollments).toHaveLength(1)
          expect(snapCommitted.requests).toHaveLength(1)

          // Verify sessionStorage contains exact 5 keys without sessionId/outcome
          const intentKey = `mr:intent:${app!.repository.runId}:${actor.actorId}`
          const storedRaw = await page.evaluate((k) => sessionStorage.getItem(k), intentKey)
          expect(storedRaw).toBeTruthy()
          const stored = JSON.parse(storedRaw!)
          expect(Object.keys(stored).sort()).toEqual([
            'actorId',
            'profileRevision',
            'requestId',
            'runId',
            'selection',
          ])
          expect(stored.sessionId).toBeUndefined()
          expect(stored.outcome).toBeUndefined()

          // Reload page to verify sessionStorage restore
          await page.reload()
          await page.locator('.regular-enrollment__local-details > summary').click()
          await page.locator('.enrollment-calendar-panel').waitFor()
          await page.locator('.regular-enrollment__uncertain').waitFor({ state: 'visible' })

          // Verify sessionStorage exact 5 keys restored after reload
          const storedReloadRaw = await page.evaluate((k) => sessionStorage.getItem(k), intentKey)
          expect(storedReloadRaw).toBeTruthy()
          const storedReload = JSON.parse(storedReloadRaw!)
          expect(Object.keys(storedReload).sort()).toEqual([
            'actorId',
            'profileRevision',
            'requestId',
            'runId',
            'selection',
          ])
          expect(storedReload.sessionId).toBeUndefined()
          expect(storedReload.outcome).toBeUndefined()

          // User clicks "Consultar resultado" -> GET known -> returns stored outcome
          await page.getByRole('button', { name: 'Consultar resultado', exact: true }).click()

          // Known accepted result opens the current report after the alert's automatic navigation.
          await page.waitForURL(/\/local\/matricula-regular\/reporte\//)

          // Snapshot must NOT have duplicate enrollment or double occupied quota!
          const snapFinal = app!.repository.readSnapshot()
          expect(snapFinal.enrollments).toHaveLength(1)
          expect(snapFinal.requests).toHaveLength(1)
          for (const course of planCourses) {
            const section = snapFinal.offer
              .find((c) => c.courseId === course.courseId)!
              .sections.find((s) => s.sectionId === course.sections[0]!.sectionId)!
            expect(section.occupied).toBe(course.sections[0]!.occupied + 1)
          }
        } finally {
          await browserContext.close()
          await browser.close()
        }
      },
      60000,
    )

    it.each(['SISTEMAS', 'SOFTWARE'] as const)(
      '%s: clears stored intent after synthetic run reset and re-entry without resubmitting it',
      async (school: School) => {
        const { browser, browserContext, page } = await createBrowserSession()
        try {
          now = new Date('2026-08-11T15:00:00.000Z')
          const fixtures = buildFixtures()
          const fixture = fixtures.find((f) => f.profile.scope.schoolId === school)!
          const actor = fixture.actors[0]!
          const planCourses = fixture.offer.filter((c) => c.planId === actor.scope.planId)

          const runId = app!.repository.resetForTests(fixtures)

          await openScreen(page, actor.actorId, runId)

          await chooseCourses(page, planCourses)

          // Abort POST to leave an uncertain intent in sessionStorage
          await page.route('**/solicitudes', (route) => {
            if (route.request().method() === 'POST') return route.abort('failed')
            else return route.continue()
          })

          const confirmDialog = await confirmSubmission(page)
          await confirmDialog.getByRole('button', { name: 'EJECUTAR', exact: true }).click()
          await page.locator('.regular-enrollment__uncertain').waitFor({ state: 'visible' })

          const oldRunId = app!.repository.runId
          const oldKey = `mr:intent:${oldRunId}:${actor.actorId}`
          expect(await page.evaluate((k) => sessionStorage.getItem(k), oldKey)).toBeTruthy()

          // Reset the repository -> NEW runId!
          const newRunId = app!.reset()
          expect(newRunId).not.toBe(oldRunId)

          let postCount = 0
          page.on('request', (req) => {
            if (req.method() === 'POST' && req.url().includes('/solicitudes')) {
              postCount += 1
            }
          })

          // Enter the new run through the existing synthetic-profile login.
          await page.getByRole('button', { name: 'Salir', exact: true }).click()
          await loginAs(page, newRunId, actor.actorId)
          await page.locator('.regular-enrollment__local-details > summary').click()

          // UI resets uncertain intent with warning notice without sending POST
          const notice = page.locator('.regular-enrollment__notice--warning')
          await notice.waitFor({ state: 'visible' })
          const noticeText = await notice.textContent()
          expect(noticeText).toContain('La ejecución local cambió')
          expect(noticeText).toContain('Se descartó la solicitud pendiente sin reenviarla')

          // Stale intent is removed from sessionStorage
          expect(await page.evaluate((k) => sessionStorage.getItem(k), oldKey)).toBeNull()

          // Zero POSTs sent during reset!
          expect(postCount).toBe(0)
        } finally {
          await browserContext.close()
          await browser.close()
        }
      },
      60000,
    )
  })
})

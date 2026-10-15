import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from '../../client/node_modules/playwright/index.mjs'
import { createServer, type ViteDevServer } from '../../client/node_modules/vite/dist/node/index.js'
import { createMatriculaRegularTestApp, type MatriculaRegularTestApp } from './matricula-regular-test-app.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import type { School, SyntheticFixture } from '../src/matricula-regular/profile.types.js'

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

async function openScreen(page: Page, actorId: string) {
  await page.goto(`${origin}/local/matricula-regular`)
  if (actorId !== 'SYN-SIS-A') {
    await page.locator('.regular-enrollment select').selectOption(actorId)
  }
  await page.locator('.enrollment-calendar-panel').waitFor()
  await page.waitForFunction(
    (id) => document.querySelector('.student-summary')?.textContent?.includes(id),
    actorId.includes('SOFT') ? 'SYN-SOFT-PLAN' : 'SYN-SIS-PLAN',
  )
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

          app!.repository.resetForTests(fixtures)
          const initialSnapshot = app!.repository.readSnapshot()

          await openScreen(page, actor.actorId)

          // Start local session
          await page.getByRole('button', { name: 'Iniciar sesión local', exact: true }).click()
          await page
            .getByText('Sesión local iniciada. Elegir asignaturas no registra matrícula.', { exact: true })
            .waitFor()

          // Select both conflicting courses
          const sec0 = page
            .locator('.section-button')
            .filter({ has: page.getByText(course0.sections[0]!.sectionId, { exact: true }) })
          await sec0.click()

          const sec1 = page
            .locator('.section-button')
            .filter({ has: page.getByText(course1.sections[0]!.sectionId, { exact: true }) })
          await sec1.click()

          await page.waitForFunction(
            () => document.querySelectorAll('.section-button[aria-pressed="true"]').length === 2,
          )

          // Submit button should be enabled
          const submitBtn = page.getByRole('button', { name: 'Enviar solicitud de matrícula', exact: true })
          expect(await submitBtn.isEnabled()).toBe(true)

          // Submit the invalid selection
          await submitBtn.click()

          // Dialog D2 appears
          const dialog = page.locator('dialog.enrollment-result-dialog')
          await dialog.waitFor({ state: 'visible' })

          // D2: Heading check & real focus
          const dialogTitle = page.locator('#result-dialog-title')
          expect(await dialogTitle.isVisible()).toBe(true)
          expect(await dialogTitle.textContent()).toBe('Solicitud de Matrícula Rechazada')

          await page.waitForFunction(() => document.activeElement?.id === 'result-dialog-title')
          const focusedId = await page.evaluate(() => document.activeElement?.id)
          expect(focusedId).toBe('result-dialog-title')

          // D2: Verify multiple causes are displayed in the dialog
          const causesList = dialog.locator('.enrollment-result-dialog__causes-list')
          expect(await causesList.isVisible()).toBe(true)
          const causesText = await causesList.textContent()
          expect(causesText).toContain('Cruce de horarios detectado')
          expect(causesText).toContain('Carga de créditos fuera de rango')
          expect(causesText).toContain('Sección sin vacantes disponibles')

          // D2: Focus trap verification - circular Tab and Shift+Tab wrapping at dialog boundaries
          // 1. Shift+Tab from heading/firstElement wraps to the last focusable element in dialog
          await page.keyboard.press('Shift+Tab')
          const focusedOnLast = await page.evaluate(() =>
            document.activeElement?.classList.contains('enrollment-result-dialog__btn--danger'),
          )
          expect(focusedOnLast).toBe(true)

          // 2. Tab from last element wraps forward to the first focusable element (close button '×')
          await page.keyboard.press('Tab')
          const focusedOnFirst = await page.evaluate(() =>
            document.activeElement?.classList.contains('enrollment-result-dialog__close-btn'),
          )
          expect(focusedOnFirst).toBe(true)

          // 3. Shift+Tab from first element wraps backward to the last element again
          await page.keyboard.press('Shift+Tab')
          const focusedOnLastAgain = await page.evaluate(() =>
            document.activeElement?.classList.contains('enrollment-result-dialog__btn--danger'),
          )
          expect(focusedOnLastAgain).toBe(true)

          // 4. Tab from last element wraps forward to first element again
          await page.keyboard.press('Tab')
          const focusedOnFirstAgain = await page.evaluate(() =>
            document.activeElement?.classList.contains('enrollment-result-dialog__close-btn'),
          )
          expect(focusedOnFirstAgain).toBe(true)

          // D2: Escape key closes the dialog
          await page.keyboard.press('Escape')
          await dialog.waitFor({ state: 'hidden' })
          expect(await dialog.isVisible()).toBe(false)

          // D2: Return to screen with EMPTY selection (L-06)
          await page.waitForFunction(
            () => document.querySelectorAll('.section-button[aria-pressed="true"]').length === 0,
          )
          const selectedAfterClose = await page.locator('.section-button[aria-pressed="true"]').count()
          expect(selectedAfterClose).toBe(0)

          // D2: Return focus lands on registration heading because opener (submit button) is disabled
          await page.waitForFunction(() => document.activeElement?.id === 'registration-heading')
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('registration-heading')

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
      '%s: double click & same identity creates single enrollment/quota, D1 close/opener without canceling commit, P1 heading focus, rows/total, single .csv extension, reload without writes',
      async (school: School) => {
        const { browser, browserContext, page } = await createBrowserSession()
        try {
          now = new Date('2026-08-11T15:00:00.000Z')
          const fixtures = buildFixtures()
          const fixture = fixtures.find((f) => f.profile.scope.schoolId === school)!
          const actor = fixture.actors[0]!

          // Valid selection: all courses in offer of the plan (which sum to valid credits >= 12, <= 26 without conflicts)
          app!.repository.resetForTests(fixtures)

          await openScreen(page, actor.actorId)

          // Start local session
          await page.getByRole('button', { name: 'Iniciar sesión local', exact: true }).click()
          await page
            .getByText('Sesión local iniciada. Elegir asignaturas no registra matrícula.', { exact: true })
            .waitFor()

          // Select courses to form a valid enrollment (all available offered courses)
          const planCourses = fixture.offer.filter((c) => c.planId === actor.scope.planId)
          for (const course of planCourses) {
            const sec = page
              .locator('.section-button')
              .filter({ has: page.getByText(course.sections[0]!.sectionId, { exact: true }) })
            await sec.click()
          }

          await page.waitForFunction(
            (count) => document.querySelectorAll('.section-button[aria-pressed="true"]').length === count,
            planCourses.length,
          )

          const submitBtn = page.getByRole('button', { name: 'Enviar solicitud de matrícula', exact: true })
          expect(await submitBtn.isEnabled()).toBe(true)

          // DOUBLE CLICK / simultaneous click simulation:
          // Single-flight and idempotent queue ensure exactly one submission POST
          await Promise.all([submitBtn.click(), submitBtn.click()])

          // Wait for acceptance outcome: dialog D1 appears with "Matrícula Regular Aceptada"
          const dialog = page.locator('dialog.enrollment-result-dialog')
          await dialog.waitFor({ state: 'visible' })
          expect(await page.locator('#result-dialog-title').textContent()).toBe('Matrícula Regular Aceptada')

          // Focus lands on heading #result-dialog-title
          await page.waitForFunction(() => document.activeElement?.id === 'result-dialog-title')
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('result-dialog-title')

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

          // D1 close without canceling commit:
          // Close D1 using the "Cerrar" secondary button
          const closeBtn = dialog.getByRole('button', { name: 'Cerrar', exact: true })
          await closeBtn.click()
          await dialog.waitFor({ state: 'hidden' })
          expect(await dialog.isVisible()).toBe(false)

          // Closing D1 must NOT cancel the committed enrollment or alter quotas
          const snapAfterD1Close = app!.repository.readSnapshot()
          expect(snapAfterD1Close.enrollments).toHaveLength(1)
          expect(snapAfterD1Close.reports).toHaveLength(1)

          // Return of focus: focus lands on accepted section heading in SubmissionPanel
          await page.waitForFunction(() => document.activeElement?.id === 'accepted-result-heading')
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('accepted-result-heading')

          // On screen opener: user clicks "Ver reporte local" in the accepted section
          const viewReportOnScreen = page.locator('.regular-enrollment__accepted button:has-text("Ver reporte local")')
          await viewReportOnScreen.click()

          // URL navigates to child route / Outlet
          expect(page.url()).toContain(`/local/matricula-regular/reporte/${enrolled.enrollmentId}`)
          expect(page.url()).toContain(`runId=${snapAfterSubmit.runId}`)
          expect(page.url()).toContain(`actorId=${actor.actorId}`)

          // Report view is rendered inside <Outlet />
          const reportHeading = page.locator('#regular-enrollment-report-heading')
          await reportHeading.waitFor({ state: 'visible' })
          expect(await reportHeading.textContent()).toBe('Reporte local de matrícula regular')

          // P1: Real programmatic focus on heading
          await page.waitForFunction(() => document.activeElement?.id === 'regular-enrollment-report-heading')
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('regular-enrollment-report-heading')

          // Verify rows and total credits in the report
          const reportRows = page.locator('.regular-enrollment-report table tbody tr')
          expect(await reportRows.count()).toBe(planCourses.length)

          const totalCreditsExpected = planCourses.reduce((sum, c) => sum + c.credits, 0)
          const totalCreditsText = await page
            .locator('.regular-enrollment-report__facts dt:has-text("Total de créditos") + dd')
            .textContent()
          expect(totalCreditsText).toBe(String(totalCreditsExpected))

          // CSV Download: filename must have exactly ONE extension (.csv) without -demo in local mode
          const downloadPromise = page.waitForEvent('download')
          await page.getByRole('button', { name: 'Descargar', exact: true }).click()
          const download = await downloadPromise
          const filename = download.suggestedFilename()
          expect(filename).toBe(`reporte-matricula-regular-local-${actor.actorId}.csv`)
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

          app!.repository.resetForTests(fixtures)
          const initialSnapshot = app!.repository.readSnapshot()

          let requestCount = 0
          page.on('request', (req) => {
            if (req.url().includes('/api/local/matricula-regular/v1')) {
              requestCount += 1
            }
          })

          await openScreen(page, actor.actorId)

          // Verify context access is eligible
          await page.getByRole('button', { name: 'Iniciar sesión local', exact: true }).click()
          await page
            .getByText('Sesión local iniciada. Elegir asignaturas no registra matrícula.', { exact: true })
            .waitFor()

          // Select courses
          const planCourses = fixture.offer.filter((c) => c.planId === actor.scope.planId)
          for (const course of planCourses) {
            const sec = page
              .locator('.section-button')
              .filter({ has: page.getByText(course.sections[0]!.sectionId, { exact: true }) })
            await sec.click()
          }

          await page.waitForFunction(
            (count) => document.querySelectorAll('.section-button[aria-pressed="true"]').length === count,
            planCourses.length,
          )

          // Submit
          await page.getByRole('button', { name: 'Enviar solicitud de matrícula', exact: true }).click()

          // Notice must be NON-MODAL (no dialog open)
          const dialogs = await page.locator('dialog[open]').count()
          expect(dialogs).toBe(0)

          // Non-modal warning notice displayed in SubmissionPanel
          const notice = page.locator('.regular-enrollment__notice--warning')
          await notice.waitFor({ state: 'visible' })
          const noticeText = await notice.textContent()
          expect(noticeText).toContain('Solicitud pendiente de configuración')
          expect(noticeText).toContain('no se registró matrícula')

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

          app!.repository.resetForTests(fixtures)

          await openScreen(page, actor.actorId)
          await page.getByRole('button', { name: 'Iniciar sesión local', exact: true }).click()
          await page.getByText('Sesión local iniciada.', { exact: false }).waitFor()

          // Select courses
          for (const course of planCourses) {
            await page
              .locator('.section-button')
              .filter({ has: page.getByText(course.sections[0]!.sectionId, { exact: true }) })
              .click()
          }

          // Cut transport BEFORE reaching Nest for the POST submit
          let dropSubmitOnce = true
          await page.route('**/solicitudes', (route) => {
            if (dropSubmitOnce && route.request().method() === 'POST') {
              dropSubmitOnce = false
              route.abort('failed')
            } else {
              route.continue()
            }
          })

          // Submit
          await page.getByRole('button', { name: 'Enviar solicitud de matrícula', exact: true }).click()

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

          // Accepted dialog appears
          await page.locator('dialog.enrollment-result-dialog').waitFor({ state: 'visible' })
          expect(await page.locator('#result-dialog-title').textContent()).toBe('Matrícula Regular Aceptada')

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

          app!.repository.resetForTests(fixtures)

          await openScreen(page, actor.actorId)
          await page.getByRole('button', { name: 'Iniciar sesión local', exact: true }).click()
          await page.getByText('Sesión local iniciada.', { exact: false }).waitFor()

          for (const course of planCourses) {
            await page
              .locator('.section-button')
              .filter({ has: page.getByText(course.sections[0]!.sectionId, { exact: true }) })
              .click()
          }

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

          await page.getByRole('button', { name: 'Enviar solicitud de matrícula', exact: true }).click()

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
          if (actor.actorId !== 'SYN-SIS-A') {
            await page.locator('.regular-enrollment select').selectOption(actor.actorId)
          }
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

          // Dialog opens with accepted result
          await page.locator('dialog.enrollment-result-dialog').waitFor({ state: 'visible' })
          expect(await page.locator('#result-dialog-title').textContent()).toBe('Matrícula Regular Aceptada')

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
      '%s: clears stored intent and shows warning without POST when environment run changes (app.reset)',
      async (school: School) => {
        const { browser, browserContext, page } = await createBrowserSession()
        try {
          now = new Date('2026-08-11T15:00:00.000Z')
          const fixtures = buildFixtures()
          const fixture = fixtures.find((f) => f.profile.scope.schoolId === school)!
          const actor = fixture.actors[0]!
          const planCourses = fixture.offer.filter((c) => c.planId === actor.scope.planId)

          app!.repository.resetForTests(fixtures)

          await openScreen(page, actor.actorId)
          await page.getByRole('button', { name: 'Iniciar sesión local', exact: true }).click()
          await page.getByText('Sesión local iniciada.', { exact: false }).waitFor()

          for (const course of planCourses) {
            await page
              .locator('.section-button')
              .filter({ has: page.getByText(course.sections[0]!.sectionId, { exact: true }) })
              .click()
          }

          // Abort POST to leave an uncertain intent in sessionStorage
          await page.route('**/solicitudes', (route) => {
            if (route.request().method() === 'POST') route.abort('failed')
            else route.continue()
          })

          await page.getByRole('button', { name: 'Enviar solicitud de matrícula', exact: true }).click()
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

          // Click "Actualizar contexto" to fetch new context with new runId
          await page.getByRole('button', { name: 'Actualizar contexto', exact: true }).click()

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

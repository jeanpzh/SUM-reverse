import { chromium } from 'playwright'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '')
const clientDir = resolve(root, 'client')

console.log('[VERIFY-DIALOG] Iniciando verificación de componente EnrollmentResultDialog (T037-D1, T037-D2, T037-pending)...')

let viteServer = null
let browser = null

try {
  // 1. Iniciar servidor Vite aislado con puerto efímero (port: 0) y middleware para fixture
  console.log('[VERIFY-DIALOG] Iniciando servidor Vite efímero...')
  viteServer = await createServer({
    configFile: false,
    root: clientDir,
    plugins: [
      react(),
      {
        name: 'dialog-test-fixture-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/' || req.url === '/test-dialog-fixture') {
              try {
                const rawHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dialog Test Harness</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/tests/fixtures/matricula-regular-dialog.tsx"></script>
</body>
</html>`
                const html = await server.transformIndexHtml(req.url, rawHtml)
                res.setHeader('Content-Type', 'text/html; charset=utf-8')
                res.end(html)
                return
              } catch (err) {
                next(err)
                return
              }
            }
            next()
          })
        },
      },
    ],
    server: {
      port: 0,
      strictPort: true,
      host: '127.0.0.1',
    },
  })

  await viteServer.listen()
  const port = viteServer.httpServer.address().port
  const fixtureUrl = `http://127.0.0.1:${port}/`
  console.log(`[VERIFY-DIALOG] Servidor Vite efímero activo en: ${fixtureUrl} (puerto estricto: ${port})`)

  // 2. Adquirir lease exclusivo de navegador Chromium
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined)

  console.log('[VERIFY-DIALOG] Lanzando instancia Chromium aislada...')
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  const consoleLogs = []
  page.on('console', (msg) => consoleLogs.push(msg.text()))

  // 3. Cargar la página del harness
  await page.goto(fixtureUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('#screen-heading')

  const titleText = await page.textContent('#screen-heading')
  assert.ok(titleText?.includes('Matrícula Regular FISI - Harness de Prueba'))
  console.log('✔ Harness consumidor montado correctamente en el navegador.')

  // =========================================================================
  // Tarea 1: T037-D1: Verificación de D1 (Matrícula Regular Aceptada)
  // =========================================================================
  console.log('[T037-D1] Probando modal de aceptación D1...')

  // Abrir D1
  await page.click('#btn-trigger-d1')
  await page.waitForSelector('dialog.enrollment-result-dialog[open]')

  // A. Heading foco al abrir
  const activeIdAfterOpenD1 = await page.evaluate(() => document.activeElement?.id)
  assert.equal(activeIdAfterOpenD1, 'result-dialog-title', 'Al abrir D1 el foco debe moverse al heading')
  const d1HeadingText = await page.textContent('#result-dialog-title')
  assert.equal(d1HeadingText?.trim(), 'Matrícula Regular Aceptada')
  console.log('  ✔ Heading foco al abrir verificado (foco en #result-dialog-title).')

  // B. Sin timer de redirección ni debug UUID
  const dialogHtml = await page.innerHTML('dialog.enrollment-result-dialog')
  assert.ok(dialogHtml.includes('Asignaturas matriculadas: <strong>2</strong>'))
  assert.ok(!dialogHtml.includes('11111111-1111-4111-8111-111111111111'), 'No debe exponer requestId')
  assert.ok(!dialogHtml.includes('sessionId'), 'No debe exponer sessionId')
  assert.ok(!dialogHtml.includes('runId'), 'No debe exponer runId')

  // Esperar 1.2 segundos sin interacción para comprobar que NO hay redirect automático
  await page.waitForTimeout(1200)
  const harnessStatusWaiting = await page.textContent('#harness-status')
  assert.equal(harnessStatusWaiting, 'dialog-open-d1', 'No debe redirigir por temporizador mientras espera acción')
  console.log('  ✔ Sin redirección por temporizador ni UUIDs de depuración expuestos.')

  // C. Tab / Shift+Tab confinados a acciones
  // Active element es el heading (#result-dialog-title). Al presionar Tab, pasa a primer botón (cerrar '×')
  await page.keyboard.press('Tab')
  const focused1 = await page.evaluate(() => document.activeElement?.className)
  assert.ok(focused1?.includes('enrollment-result-dialog__close-btn'), `Esperaba botón cerrar, enfocado: ${focused1}`)

  // Tab -> 'Ver reporte local'
  await page.keyboard.press('Tab')
  const focused2 = await page.evaluate(() => document.activeElement?.textContent?.trim())
  assert.equal(focused2, 'Ver reporte local')

  // Tab -> 'Cerrar'
  await page.keyboard.press('Tab')
  const focused3 = await page.evaluate(() => document.activeElement?.textContent?.trim())
  assert.equal(focused3, 'Cerrar')

  // Tab desde último botón -> cicla a primer botón (cerrar '×')
  await page.keyboard.press('Tab')
  const focusedWrap = await page.evaluate(() => document.activeElement?.className)
  assert.ok(focusedWrap?.includes('enrollment-result-dialog__close-btn'), 'Tab desde última acción debe ciclar a la primera')

  // Shift+Tab desde primer botón -> cicla al último botón ('Cerrar')
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  const focusedShiftWrap = await page.evaluate(() => document.activeElement?.textContent?.trim())
  assert.equal(focusedShiftWrap, 'Cerrar', 'Shift+Tab desde primera acción debe ciclar a la última')
  console.log('  ✔ Tab/Shift+Tab estrictamente confinados a acciones del modal.')

  // D. Escape / cerrar onClose
  const initialCloseCount = Number(await page.textContent('#close-count'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  const isD1OpenAfterEscape = await page.evaluate(() => {
    const d = document.querySelector('dialog.enrollment-result-dialog')
    return d !== null && d.open
  })
  assert.equal(isD1OpenAfterEscape, false, 'Escape debe cerrar el modal D1')
  const closeCountAfterEscape = Number(await page.textContent('#close-count'))
  assert.equal(closeCountAfterEscape, initialCloseCount + 1, 'onClose debe haberse ejecutado al presionar Escape')
  console.log('  ✔ Escape invoca onClose y cierra el diálogo.')

  // E. onViewReport acción manual
  await page.click('#btn-trigger-d1')
  await page.waitForSelector('dialog.enrollment-result-dialog[open]')
  await page.click('.enrollment-result-dialog__btn--primary')
  await page.waitForTimeout(100)

  const harnessStatusAfterReport = await page.textContent('#harness-status')
  assert.equal(harnessStatusAfterReport, 'navigated-report')
  const reportHeadingFocus = await page.evaluate(() => document.activeElement?.id)
  assert.equal(reportHeadingFocus, 'report-heading', 'Acción manual debe navegar a reporte y enfocar heading P1')
  const reportPathVal = await page.textContent('#report-path')
  assert.ok(reportPathVal?.includes('/local/matricula-regular/v1/reportes/22222222-2222-4222-8222-222222222222'))
  console.log('  ✔ Acción manual «Ver reporte local» navega a reporte y enfoca heading P1 (C-T037).')

  // =========================================================================
  // Tarea 2: T037-D2: Verificación de D2 (Solicitud Rechazada Multicausas)
  // =========================================================================
  console.log('[T037-D2] Probando modal de rechazo multicausas D2...')

  // Abrir D2
  await page.click('#btn-trigger-d2')
  await page.waitForSelector('dialog.enrollment-result-dialog[open]')

  // A. Heading foco al abrir
  const activeIdD2 = await page.evaluate(() => document.activeElement?.id)
  assert.equal(activeIdD2, 'result-dialog-title', 'Al abrir D2 el foco debe moverse al heading')
  const d2Title = await page.textContent('#result-dialog-title')
  assert.equal(d2Title?.trim(), 'Solicitud de Matrícula Rechazada')

  // B. Multicausas y aviso de reinicio
  const causesCount = await page.$$eval('.enrollment-result-dialog__cause-item', (items) => items.length)
  assert.equal(causesCount, 2, 'D2 debe renderizar exactamente las 2 causas de rechazo')
  const causesText = await page.textContent('.enrollment-result-dialog__causes-list')
  assert.ok(causesText?.includes('Cruce de horarios detectado'))
  assert.ok(causesText?.includes('SYN-SIS-C1, SYN-SIS-C2'))
  assert.ok(causesText?.includes('Sección sin vacantes disponibles'))

  const resetNotice = await page.textContent('.enrollment-result-dialog__reset-notice')
  assert.ok(resetNotice?.includes('principio de todo-o-nada'))
  assert.ok(resetNotice?.includes('retorna a la pantalla de registro con la selección reiniciada'))
  console.log('  ✔ Multicausas y aviso de reinicio mostrados correctamente.')

  // C. Retorno de foco: Caso A (Opener disponible y habilitado)
  // Botón 'Aceptar y volver al registro' (.enrollment-result-dialog__btn--danger)
  await page.click('.enrollment-result-dialog__btn--danger')
  await page.waitForTimeout(100)
  const activeAfterD2Normal = await page.evaluate(() => document.activeElement?.id)
  assert.equal(activeAfterD2Normal, 'btn-open-submit', 'Foco debe volver al opener disponible (#btn-open-submit)')
  const statusD2Normal = await page.textContent('#harness-status')
  assert.equal(statusD2Normal, 'closed-return-opener')
  console.log('  ✔ Retorno de foco al opener disponible verificado conforme C-T037.')

  // D. Retorno de foco: Caso B (Opener inhabilitado/no elegible -> Fallback a heading)
  await page.click('#btn-toggle-opener-disable') // Deshabilitar opener
  await page.click('#btn-trigger-d2') // Abrir D2
  await page.waitForSelector('dialog.enrollment-result-dialog[open]')
  await page.keyboard.press('Escape') // Cerrar D2
  await page.waitForTimeout(100)

  const activeAfterD2Disabled = await page.evaluate(() => document.activeElement?.id)
  assert.equal(activeAfterD2Disabled, 'screen-heading', 'Si opener no es elegible, foco debe hacer fallback a screen heading')
  const statusD2Fallback = await page.textContent('#harness-status')
  assert.equal(statusD2Fallback, 'closed-return-heading')
  console.log('  ✔ Retorno de foco fallback al screen heading verificado conforme C-T037.')

  // Re-habilitar opener para el resto
  await page.click('#btn-toggle-opener-disable')

  // =========================================================================
  // Tarea 3: T037-pending: Pending / Null / Incierto
  // =========================================================================
  console.log('[T037-pending] Probando estado pending / null / incierto...')

  // Focus en el botón trigger pending
  await page.focus('#btn-trigger-pending')
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'btn-trigger-pending')

  // Click en pending
  await page.click('#btn-trigger-pending')
  await page.waitForTimeout(200)

  // A. No debe abrir modal dialog
  const isDialogOpenForPending = await page.evaluate(() => {
    const d = document.querySelector('dialog.enrollment-result-dialog')
    return d !== null && d.open
  })
  assert.equal(isDialogOpenForPending, false, 'Pending no debe renderizar ni abrir modal dialog (C-T037)')

  // B. Foco no se mueve inesperadamente
  const activeAfterPending = await page.evaluate(() => document.activeElement?.id)
  assert.equal(activeAfterPending, 'btn-trigger-pending', 'Foco no debe moverse cuando outcome es pending')

  // C. Preservación de identidad de draft
  const draftIdPending = await page.textContent('#draft-identity')
  assert.equal(draftIdPending, 'SYN-SIS-A:SYN-SIS-C1,SYN-SIS-C2', 'Identidad de draft se preserva intacta')

  // D. Null outcome
  await page.focus('#btn-trigger-null')
  await page.click('#btn-trigger-null')
  await page.waitForTimeout(200)

  const isDialogOpenForNull = await page.evaluate(() => {
    const d = document.querySelector('dialog.enrollment-result-dialog')
    return d !== null && d.open
  })
  assert.equal(isDialogOpenForNull, false, 'Null outcome no debe abrir modal')
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'btn-trigger-null')

  // E. Efectos de UI sin requests
  const requestCount = Number(await page.textContent('#fetch-request-count'))
  assert.equal(requestCount, 0, 'El componente del diálogo no genera requests de red por sí mismo')
  console.log('  ✔ Pending/null no abre modal, foco no se desvía, identidad preservada y 0 requests.')

  console.log('================================================================')
  console.log('TODAS LAS COMPROBACIONES EN NAVEGADOR PASARON EXITOSAMENTE (6/6).')
  console.log('================================================================')
} finally {
  if (browser) {
    console.log('[VERIFY-DIALOG] Cerrando sesión Chromium...')
    await browser.close()
    browser = null
  }
  if (viteServer) {
    console.log('[VERIFY-DIALOG] Cerrando servidor Vite efímero...')
    await viteServer.close()
    viteServer = null
  }
  console.log('[BROWSER LEASE] Browser y servidor efímeros liberados. BROWSER LIBRE.')
}

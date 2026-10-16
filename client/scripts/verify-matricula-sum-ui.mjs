import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Root acceptance for plan matricula-regular-sum-ui (Task 9). Target: the isolated synthetic dashboard started by
// `node scripts/start-local-profile-dashboard.mjs`. Only loopback origins are accepted; no production SUM,
// private snapshot or CDP browser is ever used.
const origin = process.env.SUM_LOCAL_PROFILE_ORIGIN ?? 'http://127.0.0.1:5743'
if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(origin)) throw new Error('SUM_LOCAL_PROFILE_ORIGIN debe ser http://127.0.0.1:<puerto>')
const outDir = fileURLToPath(new URL('../../evidence/local/matricula-regular-sum-ui/', import.meta.url))

async function login(page, actorId) {
  await page.goto(`${origin}/local/login`)
  await page.locator(`input[value="${actorId}"]`).check()
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(/\/alumnoWebSum\/v2\/inicio/)
}

async function chooseFirstSection(page, index) {
  await page.getByRole('button', { name: /^Elegir sección de / }).nth(index).click()
  const dialog = page.getByRole('dialog', { name: 'Secciones disponibles' })
  await dialog.getByRole('radio').first().check()
  return dialog
}

const browser = await chromium.launch({ headless: true })
try {
  await mkdir(outDir, { recursive: true })
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const page = await context.newPage()

  // AC-SUM-10 (L-07): a reload keeps the tab session and renews it to 15 minutes.
  await login(page, 'SYN-SIS-A')
  await page.reload()
  await page.waitForURL(/\/alumnoWebSum\/v2\/inicio/)
  const clock = await page.locator('.session-clock').first().textContent()
  assert.match(clock ?? '', /^00:1[45]:\d\d$/, `reloj tras recarga: ${clock}`)
  assert.equal(await page.getByRole('button', { name: 'Renovar sesión' }).count(), 0)

  // AC-SUM-01 (V-01): enabled information screen.
  await page.goto(`${origin}/alumnoWebSum/v2/matricula/informacion`)
  await page.getByText('MATRICULA INTERNET HABILITADA').waitFor()
  await page.screenshot({ path: `${outDir}01-informacion-habilitada.png`, fullPage: true })
  await page.getByRole('link', { name: 'Iniciar Matrícula' }).click()
  await page.waitForURL(/\/local\/matricula-regular$/)

  // AC-SUM-03..05 (V-02, V-04, V-05): choose a section of every course.
  await page.getByRole('button', { name: /^Elegir sección de / }).first().waitFor()
  const count = await page.getByRole('button', { name: /^Elegir sección de / }).count()
  assert.ok(count >= 3, `asignaturas visibles: ${count}`)
  await page.screenshot({ path: `${outDir}02-registro.png`, fullPage: true })
  for (let index = 0; index < count; index += 1) {
    const dialog = await chooseFirstSection(page, index)
    if (index === 0) await page.screenshot({ path: `${outDir}03-secciones.png` })
    await dialog.getByRole('button', { name: /Aceptar/ }).click()
    await dialog.waitFor({ state: 'detached' })
  }
  assert.equal(await page.getByRole('button', { name: /^Quitar sección de / }).count(), count)
  await page.screenshot({ path: `${outDir}04-seleccion.png`, fullPage: true })

  // AC-SUM-06/07/09 (V-06, V-07, V-08): confirm, success alert and automatic redirect to the report.
  await page.getByRole('button', { name: 'Ejecutar Matrícula' }).click()
  await page.getByText('¿Está seguro de ejecutar la matrícula?').waitFor()
  await page.screenshot({ path: `${outDir}05-confirmacion.png` })
  await page.getByRole('button', { name: 'EJECUTAR', exact: true }).click()
  await page.getByText('La Matrícula se registró exitosamente.', { exact: false }).waitFor()
  await page.screenshot({ path: `${outDir}06-exito.png` })
  await page.waitForURL(/\/local\/matricula-regular\/reporte\//, { timeout: 10_000 })
  await page.getByRole('heading', { name: 'ASIGNATURAS MATRICULADAS' }).waitFor()
  assert.equal((await page.locator('.regular-enrollment-report__range').textContent())?.trim(), `Mostrando 1 - ${count} de ${count} registros`)
  await page.screenshot({ path: `${outDir}07-reporte.png`, fullPage: true })

  // AC-SUM-02 (O-UI-01): after enrolling, the information screen shows the registered-enrollment message.
  await page.goto(`${origin}/alumnoWebSum/v2/matricula/informacion`)
  await page.getByText('Usted registra matrícula en el presente semestre').waitFor()
  assert.equal(await page.getByRole('link', { name: 'Iniciar Matrícula' }).count(), 0)
  await page.screenshot({ path: `${outDir}08-informacion-registrada.png`, fullPage: true })

  // AC-SUM-08 (T-01, L-06, L-08): a rejected request lists its causes and returns to an empty selection.
  const second = await context.newPage()
  await login(second, 'SYN-SIS-B')
  await second.goto(`${origin}/local/matricula-regular`)
  const dialogB = await chooseFirstSection(second, 0)
  await dialogB.getByRole('button', { name: /Aceptar/ }).click()
  await second.getByRole('button', { name: 'Ejecutar Matrícula' }).click()
  await second.getByRole('button', { name: 'EJECUTAR', exact: true }).click()
  await second.getByRole('dialog').getByText('Carga de créditos fuera de rango').waitFor()
  await second.screenshot({ path: `${outDir}09-rechazo.png` })
  await second.getByRole('button', { name: 'ACEPTAR', exact: true }).click()
  await second.getByText('Asignaturas matriculadas:').waitFor()
  assert.equal(await second.getByRole('button', { name: /^Quitar sección de / }).count(), 0)

  console.log(`OK: escenarios sintéticos verificados; capturas en ${outDir}`)
} finally {
  await browser.close()
}

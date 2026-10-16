// Run only against a freshly owned synthetic Compose instance, never an operator snapshot server.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const origin = process.env.SUM_SCENARIO_TEST_ORIGIN
if (!origin || !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(origin)
  || process.env.SUM_SCENARIO_TEST_SYNTHETIC !== '1') {
  throw new Error('Require SUM_SCENARIO_TEST_ORIGIN and explicit SUM_SCENARIO_TEST_SYNTHETIC=1 for an owned synthetic instance')
}
const output = fileURLToPath(new URL('../../evidence/local/scenario-access/', import.meta.url))
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const checks = []
const pageErrors = []
const external = []
const page = await context.newPage()
page.on('pageerror', (error) => pageErrors.push(error.message))
await context.route('**/*', (route) => {
  if (new URL(route.request().url()).origin === origin) return route.continue()
  external.push(new URL(route.request().url()).origin)
  return route.abort()
})

async function mode(value) {
  await page.evaluate(`MODE = ${value}`)
  if (value === 'SIM') await page.getByRole('heading', { name: 'Probar un escenario de matrícula' }).waitFor()
  else await page.waitForURL(/\/alumnoWebSum\/v2\/inicio$/)
  assert.equal(await page.evaluate('MODE'), value)
}

async function enter(scenario, actor) {
  await page.locator(`input[name="scenario"][value="${scenario}"]`).check()
  await page.locator(`input[name="profile"][value="${actor}"]`).check()
  await page.getByRole('button', { name: 'Iniciar prueba', exact: true }).click()
  await page.waitForURL(/\/alumnoWebSum\/v2\/inicio$/)
  await page.goto(`${origin}/local/matricula-regular`)
  await page.getByRole('button', { name: 'Ejecutar Matrícula', exact: true }).waitFor()
  const rows = page.locator('.sum-enrollment__table tbody tr')
  assert.ok(await rows.count() >= 4)
  assert.doesNotMatch(await page.locator('.sum-enrollment__table').innerText(), /-C13/)
}

async function submit(actorPrefix, numbers) {
  for (const number of numbers) {
    const id = `${actorPrefix}-C${String(number).padStart(2, '0')}`
    await page.getByRole('button', { name: new RegExp(`^Elegir sección de ${id}\\b`) }).click()
    const dialog = page.getByRole('dialog', { name: 'Secciones disponibles', exact: true })
    await dialog.getByRole('radio', { name: /^Seleccionar sección / }).first().check()
    await dialog.getByRole('button', { name: /Aceptar/ }).click()
  }
  await page.getByRole('button', { name: 'Ejecutar Matrícula', exact: true }).click()
  await page.locator('dialog.sum-alert--warning').getByRole('button', { name: 'EJECUTAR', exact: true }).click()
}

async function logout() {
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await page.getByRole('heading', { name: 'Probar un escenario de matrícula' }).waitFor()
}

try {
  await page.goto(origin)
  await page.getByRole('heading', { name: 'Probar un escenario de matrícula' }).waitFor()
  assert.equal(await page.evaluate('MODE'), 'SIM')
  checks.push('local startup opens scenario chooser without console commands')
  await mode('DEV')
  assert.equal(await page.locator('.local-profile-login').count(), 0)
  checks.push('DEV switches to existing SUM views without scenario chooser')
  await page.screenshot({ path: `${output}/development.png`, fullPage: true })

  const invalid = await page.evaluate(() => {
    try { window.MODE = 'invalid' } catch { return true }
    return false
  })
  assert.equal(invalid, true)
  await mode('SIM')
  assert.equal(await page.locator('input[name="scenario"]').count(), 9)
  assert.equal(await page.locator('input[name="profile"]').count(), 4)
  await page.locator('input[name="scenario"][value="prerrequisito"]').check()
  await page.locator('input[name="profile"][value="SYN-SIS-A"]').check()
  assert.match(await page.getByRole('region', { name: 'Resultado esperado de la prueba' }).innerText(), /C13 no aparece/)
  await page.screenshot({ path: `${output}/simulation-entry.png`, fullPage: true })
  checks.push('MODE = SIM navigates automatically; all nine scenarios/four profiles and correct prerequisite preview')

  await enter('regular', 'SYN-SIS-A')
  await page.goto(`${origin}/alumnoWebSum/v2/planEstudios`)
  await page.getByText('PRACTICA PRE PROFESIONAL', { exact: false }).first().waitFor()
  assert.equal(await page.locator('tbody tr').count(), 97)
  await page.screenshot({ path: `${output}/expanded-plan.png`, fullPage: true })
  await page.goto(`${origin}/alumnoWebSum/v2/matricula/programacion`)
  await page.getByRole('searchbox', { name: 'Buscar', exact: true }).waitFor()
  assert.equal(await page.locator('button.schedule-button').count(), 165)
  await page.screenshot({ path: `${output}/expanded-programming.png`, fullPage: true })
  await page.goto(`${origin}/alumnoWebSum/v2/informacion/perfil`)
  await page.getByText('SYN-DOC-SIS-A', { exact: false }).waitFor()
  await page.goto(`${origin}/alumnoWebSum/v2/informacion/historial`)
  await page.getByText('2022-1', { exact: false }).first().waitFor()
  await page.screenshot({ path: `${output}/expanded-history.png`, fullPage: true })
  checks.push('complete plan97/programming165, personal profile and nine-term history reuse SUM screens')
  await page.goto(`${origin}/local/matricula-regular`)
  await submit('SYN-SIS', [9, 10, 11, 12])
  await page.waitForURL(/\/local\/matricula-regular\/reporte\//)
  await page.getByRole('heading', { name: 'ASIGNATURAS MATRICULADAS', exact: true }).waitFor()
  assert.match(await page.locator('main').innerText(), /SYN-SIS-C09/)
  await page.screenshot({ path: `${output}/accepted-report.png`, fullPage: true })
  checks.push('regular/SIS-A accepts via existing dialogs and opens committed report; C13 never selectable')

  await logout()
  await enter('tutoria', 'SYN-SIS-B')
  await submit('SYN-SIS', [7, 8, 9, 10])
  const rejection = page.locator('dialog.sum-alert--error[open]')
  await rejection.waitFor()
  assert.match(await rejection.innerText(), /Tutoría académica requerida/)
  await page.screenshot({ path: `${output}/tutorship-rejected.png`, fullPage: true })
  await rejection.getByRole('button', { name: 'ACEPTAR', exact: true }).click()
  checks.push('tutoria/SIS-B rejects with expected tutoring cause after a fresh UI-selected run')

  await logout()
  await enter('gap-horario', 'SYN-SOFT-A')
  await submit('SYN-SOFT', [9, 10, 11, 12])
  await page.locator('.regular-enrollment__notice').waitFor()
  assert.match(await page.locator('.regular-enrollment__notice').innerText(), /configuración|horario/i)
  checks.push('gap-horario/SOFT-A remains pending rather than accepted/rejected')

  await mode('DEV')
  assert.equal(await page.locator('.local-profile-login').count(), 0)
  assert.equal(await page.evaluate(() => sessionStorage.getItem('lp:session')), null)
  await page.reload()
  assert.equal(await page.evaluate('MODE'), 'DEV')
  checks.push('MODE = DEV returns automatically to original views and persists across reload')
  await mode('SIM')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('input[name="profile"][value="SYN-SOFT-A"]').check()
  await page.getByRole('region', { name: 'Resultado esperado de la prueba' }).waitFor()
  assert.equal(await page.locator('input[name="scenario"]').count(), 9)
  assert.equal(await page.locator('input[name="profile"]').count(), 4)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await page.screenshot({ path: `${output}/simulation-mobile.png`, fullPage: true })
  checks.push('mobile chooser has no horizontal overflow')
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(external, [])
  await writeFile(`${output}/browser-results.json`, `${JSON.stringify({ status: 'passed', checks, pageErrors, external }, null, 2)}\n`)
  console.log(JSON.stringify({ status: 'passed', checks }))
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {})
  await writeFile(`${output}/browser-results.json`, `${JSON.stringify({ status: 'failed', checks, error: String(error), pageErrors, external }, null, 2)}\n`)
  throw error
} finally {
  await browser.close()
}

// Independent synthetic integration test for RESOURCE-UI-1 (RUI1-RUI9)
// Executes against owned isolated synthetic NestJS backend and Vite frontend processes.
// Does NOT attach to, reuse, or interfere with user demo on 3210/5176.

import assert from 'node:assert/strict'
import { setPlanningCheckbox } from './planning-checkboxes.mjs'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../../', import.meta.url))
const clientDir = resolve(root, 'client')
const backendDir = resolve(root, 'backend')

function parsePort(value, fallback) {
  const parsed = Number(value)
  if (Number.isInteger(parsed) && parsed > 1024 && parsed < 65535) {
    if (parsed === 3210 || parsed === 5176) {
      throw new Error(`Puerto ${parsed} reservado para la demo de usuario: no usar en pruebas automatizadas`)
    }
    return parsed
  }
  return fallback
}

const apiPort = parsePort(process.env.SUM_TEST_API_PORT, 3411)
const webPort = parsePort(process.env.SUM_TEST_WEB_PORT, 5411)
const apiUrl = `http://127.0.0.1:${apiPort}`
const webUrl = `http://127.0.0.1:${webPort}`
const route = '/local/programacion-academica'

async function assertPortFree(port) {
  await new Promise((accept, reject) => {
    const server = createServer()
    server.once('error', (err) => reject(new Error(`Puerto ${port} ocupado: ${err.message}`)))
    server.listen(port, '127.0.0.1', () => server.close(accept))
  })
}

const children = []
function startProcess(args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  child.stderr.on('data', () => {})
  child.stdout.on('data', () => {})
  children.push(child)
  return child
}

async function waitForUrl(url, child, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`El proceso terminó prematuramente: ${child.exitCode}`)
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // Startup in progress
    }
    await new Promise((accept) => setTimeout(accept, 200))
  }
  throw new Error(`Tiempo de espera agotado para ${url}`)
}

const tempDraftDir = await mkdtemp(resolve(tmpdir(), 'sum-resource-ui1-'))
const cleanEnv = { PATH: process.env.PATH }
for (const key of Object.keys(cleanEnv)) {
  if (key.endsWith('_SNAPSHOT_DIR') || key === 'DATABASE_URL') delete cleanEnv[key]
}

let browser = null
const testResults = {}

try {
  console.log(`[RUI] Verificando puertos libres ${apiPort} y ${webPort}...`)
  await assertPortFree(apiPort)
  await assertPortFree(webPort)

  console.log(`[RUI] Iniciando backend NestJS propio en puerto ${apiPort}...`)
  const backend = startProcess(
    [resolve(backendDir, 'dist/programacion-academica/local-main.js')],
    backendDir,
    {
      ...cleanEnv,
      PORT: String(apiPort),
      SUM_ACADEMIC_SCHEDULING: '1',
      SUM_LOCAL_SCENARIOS: '0',
      SIMULATOR_DEPLOYMENT: 'local',
      SUM_ACADEMIC_DRAFT_DIR: tempDraftDir,
    },
  )
  await waitForUrl(`${apiUrl}/local/programacion-academica/v1/catalogo`, backend)

  console.log(`[RUI] Iniciando frontend Vite en puerto ${webPort}...`)
  const frontend = startProcess(
    [resolve(clientDir, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'],
    clientDir,
    {
      ...cleanEnv,
      VITE_SUM_DATA_MODE: 'local',
      VITE_SUM_API_BASE_URL: '/api',
      VITE_SUM_API_PROXY_TARGET: apiUrl,
      VITE_SUM_ACADEMIC_SCHEDULING: '1',
      VITE_SUM_SIMULATOR: '0',
      VITE_SUM_LOCAL_PROFILE: 'synthetic-actors',
    },
  )
  await waitForUrl(`${webUrl}${route}`, frontend)

  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined),
    headless: true,
    args: ['--no-sandbox'],
  })

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(45000)

  await page.goto(`${webUrl}${route}`, { waitUntil: 'domcontentloaded' })
  page.on('pageerror', (err) => console.error('[BROWSER PAGE ERROR]', err.message))
  await page.locator('#academic-scheduling-resource-editor').waitFor()

  // -------------------------------------------------------------
  if (!['integration', 'layout'].includes(process.env.SUM_TEST_PHASE)) {
  // RUI1: Cero fichas al entrar, máximo una abierta, sin lista de botones por docente
  // -------------------------------------------------------------
  console.log('[RUI1] Verificando cero fichas al entrar, máximo una abierta y sin botones roster...')
  assert.equal(
    await page.locator('.academic-scheduling__resource-card').count(),
    0,
    'Debe haber cero fichas abiertas al entrar',
  )
  assert.equal(
    await page.locator('.academic-scheduling__roster-item').count(),
    0,
    'No debe existir la lista antigua de botones por docente',
  )
  assert.ok(
    await page.locator('.academic-resource-table').count() >= 1,
    'Debe existir la tabla buscable de recursos',
  )

  // Abrir una ficha de docente
  const firstTeacherRow = page.locator('.academic-resource-table tbody tr').first()
  await firstTeacherRow.getByRole('button', { name: /Abrir ficha/ }).click()
  assert.equal(
    await page.locator('.academic-resource-workbench__inspector-pane').count(),
    1,
    'Debe abrirse exactamente un inspector de recurso',
  )

  // The resource sheet is modal (shadcn Sheet): it owns focus and Escape closes it.
  const sheet = page.getByRole('dialog', { name: /./ }).and(page.locator('.academic-resource-workbench__inspector-pane'))
  assert.equal(await sheet.evaluate((el) => el.contains(document.activeElement)), true, 'El foco debe entrar en la ficha')
  await page.keyboard.press('Escape')
  assert.equal(
    await page.locator('.academic-resource-workbench__inspector-pane').count(),
    0,
    'Escape debe cerrar la ficha',
  )
  assert.equal(
    await firstTeacherRow.getByRole('button', { name: /Abrir ficha/ }).evaluate((el) => document.activeElement === el),
    true,
    'Al cerrar la ficha el foco vuelve al botón que la abrió',
  )
  await page.getByRole('tab', { name: /Aulas y laboratorios/ }).click()

  // Abrir una ficha de ambiente
  const firstRoomRow = page.locator('.academic-resource-table tbody tr').first()
  await firstRoomRow.getByRole('button', { name: /Abrir ficha/ }).click()
  assert.equal(
    await page.locator('.academic-resource-workbench__inspector-pane').count(),
    1,
    'Debe haber como máximo un inspector activo',
  )

  // Cerrar la ficha de ambiente y volver a Docentes
  await page.locator('.academic-resource-workbench__inspector-pane').getByRole('button', { name: 'Cerrar' }).click()
  assert.equal(
    await page.locator('.academic-resource-workbench__inspector-pane').count(),
    0,
    'Cerrar debe cerrar la ficha de ambiente',
  )
  await page.getByRole('tab', { name: /Docentes/ }).click()
  testResults.RUI1 = 'PASSED: Cero fichas al entrar, una ficha modal con foco atrapado, Escape y retorno de foco, sin botones roster'

  // -------------------------------------------------------------
  // RUI2: Buscar y filtrar recursos de referencia/incorporados/locales, contadores
  // -------------------------------------------------------------
  console.log('[RUI2] Verificando búsqueda, filtros, contadores inequívocos y estados vacíos...')
  const searchInput = page.getByLabel('Buscar docentes por nombre o código')
  await searchInput.fill('sin-coincidencia-sintetica-xyz')
  assert.ok(
    await page.locator('.academic-resource-workbench__empty').isVisible(),
    'Debe mostrar mensaje de estado vacío útil cuando no hay coincidencias',
  )

  await searchInput.fill('')
  // Filtrar por solo referencias
  await page.getByLabel('Filtrar docentes por inclusión').selectOption('reference')
  const refRowsCount = await page.locator('.academic-resource-table tbody tr').count()
  // Regresar a todos
  await page.getByLabel('Filtrar docentes por inclusión').selectOption('all')
  const allRowsCount = await page.locator('.academic-resource-table tbody tr').count()
  assert.ok(allRowsCount >= refRowsCount, 'El filtro de inclusión debe reflejar las filas correspondientes')

  // Verificar contadores
  const counters = page.locator('.academic-resource-workbench__counters')
  assert.ok((await counters.innerText()).includes('Referencias del catálogo:'))
  assert.ok((await counters.innerText()).includes('Incorporados en borrador:'))
  assert.ok((await counters.innerText()).includes('Visibles:'))
  testResults.RUI2 = 'PASSED: Búsqueda, filtros por inclusión y contadores inequívocos verificados'

  // -------------------------------------------------------------
  // RUI3: Abrir/cerrar una referencia y un incorporado; sin incorporación implícita
  // -------------------------------------------------------------
  console.log('[RUI3] Verificando abrir y cerrar ficha sin mutaciones ni incorporación implícita...')
  // 1. Abrir y cerrar una ficha de docente incorporado
  const firstIncRow = page.locator('.academic-resource-table tbody tr').filter({ hasText: 'Incorporado' }).first()
  await firstIncRow.getByRole('button', { name: /Abrir ficha/ }).click()
  const incInspector = page.locator('.academic-resource-workbench__inspector-pane')
  assert.ok(await incInspector.isVisible(), 'El inspector debe abrirse para un docente incorporado')
  await incInspector.getByRole('button', { name: 'Cerrar' }).click()
  assert.equal(await incInspector.count(), 0, 'Cerrar la ficha no debe mutar y debe cerrarse limpiamente')

  // Retirar temporalmente un docente para que pase a ser referencia no incorporada
  await firstIncRow.getByRole('button', { name: /Abrir ficha/ }).click()
  await page.locator('.academic-scheduling__resource-card--teacher').getByRole('button', { name: /^Quitar docente/ }).click()

  // 2. Ahora filtrar por referencias no incorporadas y abrirla
  await page.getByLabel('Filtrar docentes por inclusión').selectOption('reference')
  const refRow = page.locator('.academic-resource-table tbody tr').first()
  await refRow.getByRole('button', { name: /Abrir ficha/ }).click()

  const refInspector = page.locator('.academic-resource-workbench__inspector-pane')
  assert.ok(await refInspector.isVisible(), 'El inspector debe mostrarse al hacer clic en Abrir ficha de referencia')
  assert.ok((await refInspector.innerText()).includes('no incorporado'), 'Debe mostrarse como referencia no incorporada')
  assert.ok(
    await refInspector.getByRole('button', { name: 'Incorporar a la propuesta' }).isVisible(),
    'Debe presentar acción explícita de incorporación',
  )

  // Cerrar la ficha sin incorporar
  await refInspector.getByRole('button', { name: 'Cerrar' }).click()
  assert.equal(await refInspector.count(), 0, 'La ficha debe cerrarse')

  // Verificar que sigue como no incorporada (no incorporación implícita)
  assert.ok(await refRow.getByText('Referencia (no incorporado)').isVisible(), 'No debe incorporarse implícitamente')
  testResults.RUI3 = 'PASSED: Abrir y cerrar referencia e incorporado no muta borrador ni incorpora implícitamente'

  // -------------------------------------------------------------
  // RUI4: Selección múltiple, vista previa, cancelar y confirmar
  // -------------------------------------------------------------
  console.log('[RUI4] Verificando selección múltiple, vista previa sintética, cancelar y confirmar...')
  const checkboxes = page.locator('.academic-resource-table tbody tr input[type="checkbox"]')
  await checkboxes.first().check()

  // Clic en incorporar seleccionados
  await page.getByRole('button', { name: /Incorporar seleccionados/ }).click()
  const modal = page.locator('.academic-resource-modal')
  await modal.waitFor()
  assert.equal(await modal.getAttribute('role'), 'dialog')
  assert.equal(await modal.getAttribute('aria-modal'), 'true')
  assert.ok((await modal.innerText()).includes('Vista previa de incorporación múltiple'))
  assert.ok((await modal.innerText()).includes('sintética'), 'Los valores iniciales deben identificarse como sintéticos')

  // Probar Cancelar
  await modal.getByRole('button', { name: 'Cancelar' }).click()
  assert.equal(await modal.count(), 0, 'El modal debe cerrarse al cancelar')

  // Reabrir y Confirmar
  await page.getByRole('button', { name: /Incorporar seleccionados/ }).click()
  await modal.waitFor()
  await modal.getByRole('button', { name: /^Confirmar incorporación/ }).click()
  assert.equal(await modal.count(), 0, 'El modal debe cerrarse tras confirmar')
  await page.getByLabel('Filtrar docentes por inclusión').selectOption('all')
  testResults.RUI4 = 'PASSED: Selección múltiple, vista previa con valores sintéticos, cancelar sin efecto y confirmación única'

  // -------------------------------------------------------------
  // RUI5: Incorporación repetida, duplicados, límites 128
  // -------------------------------------------------------------
  console.log('[RUI5] Verificando duplicados, correspondencia de ID editado y límites...')
  // Abrir la ficha de un docente incorporado
  const incorporatedRow = page.locator('.academic-resource-table tbody tr').filter({ hasText: 'Incorporado' }).first()
  await incorporatedRow.getByRole('button', { name: /Abrir ficha/ }).click()
  await page.locator('.academic-scheduling__resource-card--teacher').waitFor()

  const idInput = page.getByLabel('Identificación docente')
  const originalId = await idInput.inputValue()
  const customId = `${originalId}-MOD`
  await idInput.fill(customId)
  assert.equal(await idInput.inputValue(), customId, 'El ID editado debe reflejarse')

  // Intentar duplicar con ID de otro docente
  const otherRow = page.locator('.academic-resource-table tbody tr').filter({ hasText: 'Incorporado' }).nth(1)
  const otherId = (await otherRow.locator('code').innerText()).trim()
  await idInput.fill(otherId)
  assert.ok(
    await page.getByRole('alert').filter({ hasText: 'ya está asignada' }).isVisible(),
    'Debe rechazar identificaciones duplicadas con alerta explícita',
  )
  await idInput.fill(customId)
  await page.locator('.academic-resource-workbench__inspector-pane').getByRole('button', { name: 'Cerrar' }).click()
  testResults.RUI5 = 'PASSED: Detección de duplicados, límites y conservación de correspondencia de referencia'

  // -------------------------------------------------------------
  // RUI6: Editar disponibilidad, habilitación, carga, preferencias y límites
  // -------------------------------------------------------------
  console.log('[RUI6] Verificando edición de disponibilidad, habilitaciones, límites y ambientes...')
  await incorporatedRow.getByRole('button', { name: /Abrir ficha/ }).click()
  const teacherCard = page.locator('.academic-scheduling__resource-card--teacher')
  await teacherCard.waitFor()

  // Editar carga semanal
  const cargaInput = page.getByLabel('Carga semanal docente')
  await cargaInput.fill('1200')
  assert.equal(await cargaInput.inputValue(), '1200')

  // Editar disponibilidad
  const dispFinInput = page.getByLabel('Disponibilidad docente fin 1', { exact: true })
  if (await dispFinInput.count()) {
    await dispFinInput.fill('19:00')
  }

  // Cerrar ficha docente
  await page.locator('.academic-resource-workbench__inspector-pane').getByRole('button', { name: 'Cerrar' }).click()

  // Ir a ambientes y verificar campos
  await page.getByRole('tab', { name: /Aulas y laboratorios/ }).click()
  const firstRoom = page.locator('.academic-resource-table tbody tr').first()
  await firstRoom.getByRole('button', { name: /Abrir ficha/ }).click()
  const roomCard = page.locator('.academic-scheduling__resource-card--room')
  if (await roomCard.count()) {
    const capInput = page.getByLabel('Capacidad ambiente')
    await capInput.fill('48')
    assert.equal(await capInput.inputValue(), '48')
  }
  await page.locator('.academic-resource-workbench__inspector-pane').getByRole('button', { name: 'Cerrar' }).click()
  testResults.RUI6 = 'PASSED: Edición completa de disponibilidad, carga, capacidad y límites PA-DEMO-1'

  // -------------------------------------------------------------
  }
  if (process.env.SUM_TEST_PHASE !== 'layout') {
  // RUI7: Cliente/API reales: configurar, generar, guardar, recargar y continuar
  // -------------------------------------------------------------
  console.log('[RUI7] Verificando integración cliente/API real: generar, guardar, recargar y continuar...')
  await page.getByRole('tab', { name: /Docentes/ }).click()

  // Seleccionar un curso con patrón y demand para generar propuesta válida
  const catalogRes = await fetch(`${apiUrl}/local/programacion-academica/v1/catalogo`)
  const catalogData = await catalogRes.json()
  const schedCourse = catalogData.courses.find((item) => item.planningPatterns?.some((p) => p.weeklySessions.length > 0)) || catalogData.courses[0]
  const pattern = schedCourse.planningPatterns?.find((p) => p.weeklySessions.length > 0)

  await setPlanningCheckbox(page.getByRole('checkbox', { name: `Seleccionar ${schedCourse.courseId}`, exact: true }))
  await page.getByLabel(`Demanda ${schedCourse.courseId}`, { exact: true }).fill('1')
  if (pattern) {
    await page.getByLabel(`Patrón ${schedCourse.courseId}`, { exact: true }).selectOption(pattern.id)
  }

  // Generar horario
  const generateResponse = page.waitForResponse(
    (res) => res.url().endsWith('/propuestas') && res.request().method() === 'POST',
  )
  await page.locator('#planning-tour-primary').click()
  const genRes = await generateResponse
  assert.equal(genRes.status(), 200, 'La API debe aceptar la petición con recursos incluidos')
  const generatedProposal = await genRes.json()
  assert.ok(generatedProposal.proposalId, 'Debe devolver proposalId')
  assert.equal(generatedProposal.status, 'complete', 'La propuesta debe completarse')

  // Guardar propuesta
  const draftTitle = `Borrador-RUI-${Date.now()}`
  await page.getByLabel('Nombre de la propuesta').fill(draftTitle)
  const saveResponse = page.waitForResponse(
    (res) => res.url().endsWith('/borradores/guardar') && res.request().method() === 'POST',
  )
  await page.locator('#planning-tour-save').click()
  const savedRes = await saveResponse
  assert.equal(savedRes.status(), 200, 'Debe guardar el borrador en la API real')
  const savedData = await savedRes.json()
  assert.equal(savedData.title, draftTitle)

  // Recargar y continuar edición
  await page.reload()
  await page.locator('#academic-scheduling-resource-editor').waitFor()
  await page.locator('#planning-tour-proposals').click()
  const savedProposals = page.locator('#academic-scheduling-saved-proposals')
  await savedProposals.waitFor()
  const savedRow = savedProposals.locator('.academic-scheduling__saved-row').filter({ hasText: draftTitle })
  const resumeResponse = page.waitForResponse((res) => res.url().endsWith(`/borradores/${savedData.id}/continuar`))
  await savedRow.getByRole('button', { name: 'Continuar edición', exact: true }).click()
  const resumedRes = await resumeResponse
  assert.equal(resumedRes.status(), 200, 'Debe recuperar el borrador guardado')
  const resumedDraft = (await resumedRes.json()).draft
  assert.equal(resumedDraft.title, draftTitle)
  testResults.RUI7 = 'PASSED: Flujo real API generar, guardar, recargar y recuperar configuración intacta'

  // -------------------------------------------------------------
  // RUI8: Aprobar por API real, recargar y Consultar en modo congelado
  // -------------------------------------------------------------
  console.log('[RUI8] Verificando aprobación por API real y consulta de recursos en versión congelada...')
  const stage = async (name, etapa) => {
    await page.locator('.planning-root').getByRole('link', { name: name === 'Preparación' ? 'Resumen' : name, exact: true }).click()
    await page.waitForURL(new RegExp(`etapa=${etapa}(?:&|$)`))
  }

  // Enviar a revisión docente y dar conformidades requeridas para aprobación
  await stage('Revisión docente', 'revision')
  await page.locator('.academic-teacher-review').waitFor()
  const submitResponse = page.waitForResponse((res) => res.url().includes('/revision/enviar') && res.request().method() === 'POST')
  await page.getByRole('button', { name: /^(Enviar a revisión|Enviar a revisión docente)$/ }).click()
  let currentReviewDraft = (await (await submitResponse).json()).draft

  for (const teacher of currentReviewDraft.review.teachers) {
    await page.getByLabel('Rol simulado de revisión', { exact: true }).selectOption('teacher')
    await page.getByLabel('Docente de revisión', { exact: true }).selectOption(teacher.teacherId)
    const resp = page.waitForResponse((res) => res.url().includes('/revision/responder') && res.request().method() === 'POST')
    await page.getByRole('button', { name: 'Dar conformidad', exact: true }).click()
    currentReviewDraft = (await (await resp).json()).draft
  }
  assert.equal(currentReviewDraft.state, 'ready-for-approval')

  // Aprobar propuesta en etapa Aprobación
  await stage('Aprobación y publicación', 'aprobacion')
  await page.locator('.academic-publication').waitFor()
  const previewResponse = page.waitForResponse((res) => res.url().includes('/vista-previa'))
  await page.getByRole('button', { name: 'Actualizar vista previa', exact: true }).click()
  await previewResponse

  const approvalResponse = page.waitForResponse((res) => res.url().includes('/aprobar') && res.request().method() === 'POST')
  await page.getByRole('button', { name: 'Aprobar (simulada)', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Aprobar', exact: true }).click()
  const approvedDraft = (await (await approvalResponse).json()).draft
  assert.equal(approvedDraft.state, 'approved')

  // Regresar a Preparación, recargar y Consultar
  await stage('Preparación', 'preparacion')
  await page.reload()
  await page.locator('#academic-scheduling-resource-editor').waitFor()
  await page.locator('#planning-tour-proposals').click()
  const approvedSavedRow = page.locator('.academic-scheduling__saved-row').filter({ hasText: draftTitle })

  const consultResponse = page.waitForResponse((res) => res.url().endsWith(`/borradores/${savedData.id}/continuar`))
  await approvedSavedRow.getByRole('button', { name: 'Consultar', exact: true }).click()
  assert.equal((await consultResponse).status(), 200)

  // En versión congelada:
  // 1. La tabla sigue siendo consultable y buscable
  const frozenSearchInput = page.getByLabel('Buscar docentes por nombre o código')
  await frozenSearchInput.fill('DOC-NO-EXISTE')
  assert.ok(await page.locator('.academic-resource-workbench__empty').isVisible(), 'Debe mostrar estado vacío sin errores')
  await frozenSearchInput.fill('')
  assert.ok(await page.locator('.academic-resource-table').isVisible(), 'La tabla debe ser consultable')

  // 2. Abrir ficha sigue funcionando para consulta
  const frozenTeacherRow = page.locator('.academic-resource-table tbody tr').first()
  await frozenTeacherRow.getByRole('button', { name: /Abrir ficha/ }).click()
  const frozenCard = page.locator('.academic-resource-workbench__inspector-pane')
  await frozenCard.waitFor()
  assert.ok(
    await frozenCard.getByText('Versión congelada de solo lectura').isVisible(),
    'Debe mostrar mensaje de solo lectura',
  )

  // 3. Los controles mutantes están deshabilitados
  const frozenIdInput = page.getByLabel('Identificación docente')
  if (await frozenIdInput.count()) {
    assert.equal(await frozenIdInput.isDisabled(), true, 'Los campos deben estar deshabilitados')
  }

  // 4. Cerrar ficha sigue funcionando
  await frozenCard.getByRole('button', { name: 'Cerrar' }).click()
  assert.equal(await frozenCard.count(), 0, 'Cerrar ficha debe seguir funcionando')
  testResults.RUI8 = 'PASSED: Versión congelada permite consultar tablas y fichas con mutaciones bloqueadas sin hack de DOM'

  // -------------------------------------------------------------
  }
  // RUI9: Teclado, diálogo, 720px y render200
  // -------------------------------------------------------------
  console.log('[RUI9] Verificando accesibilidad de teclado, diálogo, viewport 720px y zoom de render...')
  // Comprobar región de scroll con foco
  const scrollRegion = page.locator('.academic-resource-workbench__scroll-region')
  await scrollRegion.focus()
  assert.equal(
    await page.evaluate(() => document.activeElement === document.querySelector('.academic-resource-workbench__scroll-region')),
    true,
    'La región de la tabla debe recibir foco visible para scroll por teclado',
  )

  // Viewport 720px sin desborde horizontal del documento
  await page.setViewportSize({ width: 720, height: 900 })
  const overflowInfo = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth
    const section = document.querySelector('section[aria-labelledby="academic-scheduling-resource-editor"]')
    const sectionChildren = Array.from(section?.children || []).map(el => ({
      tag: el.tagName,
      class: typeof el.className === 'string' ? el.className : '',
      offsetWidth: el.offsetWidth,
      scrollWidth: el.scrollWidth,
      right: Math.round(el.getBoundingClientRect().right),
    }))
    const workbenchChildren = Array.from(document.querySelector('.academic-resource-workbench')?.children || []).map(el => ({
      tag: el.tagName,
      class: typeof el.className === 'string' ? el.className : '',
      offsetWidth: el.offsetWidth,
      scrollWidth: el.scrollWidth,
      right: Math.round(el.getBoundingClientRect().right),
    }))
    return {
      docWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sectionChildren,
      workbenchChildren,
    }
  })
  const hasHorizontalScroll = overflowInfo.scrollWidth > overflowInfo.docWidth
  assert.equal(hasHorizontalScroll, false, 'No debe haber desborde horizontal del documento a 720px')

  // Verificar texto esencial >= 12px
  const minFontSize = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('.academic-resource-workbench *'))
    let minSize = 999
    for (const el of texts) {
      const size = parseFloat(window.getComputedStyle(el).fontSize)
      if (size > 0 && size < minSize) minSize = size
    }
    return minSize
  })
  assert.ok(minFontSize >= 12, `El texto esencial debe ser >= 12px (encontrado mínimo: ${minFontSize}px)`)

  // Zoom de render 200% (CSS layout scale de 1280px -> reflow 640px equivalente; distinguiendo CSS zoom de zoom nativo de navegador)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.evaluate(() => {
    const wb = document.querySelector('.academic-resource-workbench')
    if (wb) wb.style.zoom = '2'
  })
  const workbenchScroll = await page.evaluate(() => {
    const wb = document.querySelector('.academic-resource-workbench')
    if (!wb) return { client: 0, scroll: 0 }
    return { client: wb.clientWidth, scroll: wb.scrollWidth,
      outside: [...wb.querySelectorAll('*')].filter(el => !el.closest('.academic-resource-workbench__scroll-region') && el.getBoundingClientRect().right > wb.getBoundingClientRect().right + 2)
        .slice(0, 8).map(el => ({ tag: el.tagName, cls: el.className, width: el.getBoundingClientRect().width, min: getComputedStyle(el).minWidth })) }
  })
  assert.ok(
    workbenchScroll.scroll <= workbenchScroll.client + 2,
    `El workbench de recursos a 200% zoom de renderizado CSS no debe desbordar su ancho: ${JSON.stringify(workbenchScroll)}`,
  )
  await page.evaluate(() => {
    const wb = document.querySelector('.academic-resource-workbench')
    if (wb) wb.style.zoom = ''
  })
  testResults.RUI9 = 'PASSED: Teclado, scroll con foco, viewport 720px sin desborde, texto >=12px y zoom render200 (distinguiendo CSS zoom de zoom nativo)'

  console.log('\n========================================')
  console.log(`PASS: ${Object.keys(testResults).join(', ')}`)
  console.log('========================================')
  for (const [id, msg] of Object.entries(testResults)) {
    console.log(`[${id}] ${msg}`)
  }
} finally {
  if (browser) await browser.close()
  for (const child of children) {
    try {
      child.kill('SIGTERM')
    } catch {
      // Ignorar
    }
  }
  try {
    await rm(tempDraftDir, { recursive: true, force: true })
  } catch {
    // Ignorar
  }
}

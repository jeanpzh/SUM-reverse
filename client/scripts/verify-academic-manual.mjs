// Run only against our freshly built, independently synthetic Compose acceptance project.
import assert from 'node:assert/strict'
import { setPlanningCheckbox } from './planning-checkboxes.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Resource details open in a modal shadcn Sheet; close it before using controls behind it.
const closeResourceSheet = async (target) => {
  const sheet = target.locator('.academic-resource-workbench__inspector-pane')
  if (!(await sheet.count())) return
  await target.keyboard.press('Escape')
  await sheet.waitFor({ state: 'detached' })
}

if (process.env.SUM_ACADEMIC_COMPOSE_SYNTHETIC !== '1') throw new Error('Se requiere una instancia propia explícitamente sintética')
const url = new URL(process.env.SUM_ACADEMIC_COMPOSE_BASE || 'http://127.0.0.1:5280')
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Base local sin rutas ni credenciales requerida')
const base = url.origin
const output = resolve(fileURLToPath(new URL('../../', import.meta.url)), 'evidence/local/programacion-academica-manual')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) })
const errors = [], external = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { if (!request.url().startsWith(`${base}/`) && !request.url().startsWith('data:')) external.push(request.url()) })
  const read = async (path) => {
    const response = await page.request.get(`${base}/api${path}`)
    assert.equal(response.status(), 200)
    return response.json()
  }
  const beforeOffer = (await read('/local/matricula-regular/v1/contextos/SYN-SIS-A')).data.offer
  const catalog = await read('/local/programacion-academica/v1/catalogo')
  const course = catalog.courses.find((row) => row.courseId === '20118104')
  assert.ok(course)
  const classroomRoomIds = catalog.referenceRooms.filter((room) => room.kind === 'classroom' && room.capacity >= 45).slice(0, 2).map((room) => room.id)
  assert.equal(classroomRoomIds.length, 2, 'El catálogo sintético debe ofrecer dos aulas de capacidad suficiente')
  const pattern = course.planningPatterns.find((row) => row.weeklySessions.length === 2 && row.weeklySessions.every((session) => session.durationMinutes === 120))
  assert.ok(pattern)
  const teachers = catalog.referenceTeachers.slice(0, 2)
  const teacherForm = page.locator('.academic-scheduling__resource-card--teacher')
  const roomForm = page.locator('.academic-scheduling__resource-card--room')
  const preferenceLabel = 'Preferencias semanales · prioridad blanda'
  const stage = async (name, etapa) => {
    await closeResourceSheet(page)
    await page.getByRole('navigation', { name: 'Etapas de programación', exact: true }).getByRole('link', { name, exact: true }).click()
    await page.waitForURL(new RegExp(`etapa=${etapa}$`))
  }
  const setIntervals = async (label, days, start = '18:00', end = '22:00') => {
    const group = page.getByRole('group', { name: new RegExp(`^${label}`) })
    while (await group.getByRole('button', { name: new RegExp(`^Quitar ${label} intervalo`) }).count()) {
      await group.getByRole('button', { name: new RegExp(`^Quitar ${label} intervalo`) }).first().click()
    }
    for (const [index, day] of days.entries()) {
      await group.getByRole('button', { name: 'Agregar intervalo', exact: true }).click()
      await page.getByLabel(`${label} día ${index + 1}`, { exact: true }).selectOption(String(day))
      await page.getByLabel(`${label} inicio ${index + 1}`, { exact: true }).fill(start)
      await page.getByLabel(`${label} fin ${index + 1}`, { exact: true }).fill(end)
    }
  }
  const generate = async () => {
    await stage('Preparación', 'preparacion')
    const pending = page.waitForResponse((response) => response.url().endsWith('/propuestas') && response.request().method() === 'POST')
    await closeResourceSheet(page)
    await page.getByRole('button', { name: 'Generar horarios', exact: true }).click()
    const response = await pending
    assert.equal(response.status(), 200, await response.text())
    const value = await response.json()
    await stage('Horario', 'horario')
    await page.locator(`.academic-scheduling__result--${value.status}`).waitFor()
    return value
  }
  await page.goto(`${base}/local/programacion-academica`)
  await page.getByLabel('Filtrar cursos por ciclo').selectOption('10')
  await setPlanningCheckbox(page.getByRole('checkbox', { name: `Seleccionar ${course.courseId}`, exact: true }))
  await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).fill('180')
  await page.getByLabel(`Capacidad ${course.courseId}`, { exact: true }).fill('45')
  await page.getByLabel(`Patrón ${course.courseId}`).selectOption(pattern.id)
  assert.equal(await page.getByLabel(`Modalidad de sesiones ${course.courseId}`).inputValue(), 'continuous')
  // Start from zero incorporated resources (same bulk retire flow as verify-academic-scheduling.mjs).
  await closeResourceSheet(page)
  const resourceTab = (kind) => page.getByRole('tab', { name: kind === 'teachers' ? /^Docentes \(/ : /^Aulas y laboratorios \(/ })
  const openResourceTab = async (kind) => {
    await closeResourceSheet(page)
    await resourceTab(kind).click()
  }
  const clearIncluded = async (kind) => {
    await openResourceTab(kind)
    const workbench = page.locator('.academic-resource-workbench')
    const filter = page.getByLabel(kind === 'teachers' ? 'Filtrar docentes por inclusión' : 'Filtrar ambientes por inclusión')
    await filter.selectOption('included')
    if (await workbench.locator('tbody tr input[type="checkbox"]').count()) {
      await workbench.getByRole('button', { name: 'Seleccionar visibles', exact: true }).click()
      await workbench.getByRole('button', { name: /Retirar seleccionados/ }).click()
      await page.getByRole('dialog').getByRole('button', { name: /^Confirmar retiro/ }).click()
    }
    await filter.selectOption('all')
  }
  await clearIncluded('rooms')
  await clearIncluded('teachers')
  for (const [index, teacher] of teachers.entries()) {
    await closeResourceSheet(page)
    await page.getByLabel('Seleccionar o agregar docente').selectOption(teacher.id)
    assert.equal(await teacherForm.count(), 1)
    assert.equal(await page.getByLabel('Nombre docente', { exact: true }).inputValue(), teacher.name)
    await page.getByLabel('Carga semanal docente', { exact: true }).fill('960')
    await page.getByLabel('Buscar asignatura habilitada').fill(course.courseId)
    await setPlanningCheckbox(page.getByRole('checkbox', { name: `${teacher.name} habilitado para ${course.courseId}`, exact: true }))
    await page.getByLabel(`Máximo de secciones ${course.courseId}`, { exact: true }).fill('4')
    await setIntervals('Disponibilidad docente', [1, 2, 3, 4, 5], '16:00', '22:00')
    await setIntervals(preferenceLabel, index === 0 ? [1, 2] : [3, 4])
  }
  await closeResourceSheet(page)
  await page.getByLabel('Seleccionar o agregar docente').selectOption(teachers[0].id)
  assert.equal(await page.getByLabel('Carga semanal docente', { exact: true }).inputValue(), '960')
  assert.equal(await page.getByLabel(`Máximo de secciones ${course.courseId}`, { exact: true }).inputValue(), '4')
  assert.equal(await page.getByRole('group', { name: new RegExp(`^${preferenceLabel}`) }).getByRole('combobox').count(), 2)
  assert.equal(await page.locator('table[aria-label="Docentes"] .academic-resource-badge--included').count(), 2)
  await page.getByLabel('Identificación docente', { exact: true }).fill(teachers[1].id)
  assert.equal(await page.getByLabel('Identificación docente', { exact: true }).inputValue(), teachers[0].id)
  await teacherForm.getByRole('alert').waitFor()
  await page.getByLabel('Identificación docente', { exact: true }).fill(teachers[0].id)
  await openResourceTab('rooms')
  for (const roomId of [...classroomRoomIds, 'LAB01NP']) {
    await closeResourceSheet(page)
    await page.getByLabel('Seleccionar o agregar ambiente').selectOption(roomId)
    assert.equal(await roomForm.count(), 1)
    assert.equal(await page.getByLabel('Capacidad ambiente', { exact: true }).inputValue(), '45')
    await setIntervals('Disponibilidad del ambiente', [1, 2, 3, 4, 5], '16:00', '22:00')
  }
  await closeResourceSheet(page)
  await page.getByLabel('Seleccionar o agregar ambiente').selectOption(classroomRoomIds[0])
  assert.equal(await page.getByLabel('Disponibilidad del ambiente fin 5', { exact: true }).inputValue(), '22:00')
  await page.getByLabel('Identificación ambiente', { exact: true }).fill('LAB01NP')
  assert.equal(await page.getByLabel('Identificación ambiente', { exact: true }).inputValue(), classroomRoomIds[0])
  await roomForm.getByRole('alert').waitFor()
  await page.getByLabel('Identificación ambiente', { exact: true }).fill(classroomRoomIds[0])
  const complete = await generate()
  assert.equal(complete.status, 'complete')
  assert.deepEqual(complete.counts, { sections: 4, requiredSessions: 8, scheduledSessions: 8 })
  assert.equal(complete.preferenceReport.withinPreferenceSections, 4)
  for (const teacher of teachers) assert.equal(new Set(complete.assignments.filter((row) => row.teacherId === teacher.id).map((row) => row.sectionId)).size, 2)
  const sectionsTable = page.locator('.academic-scheduling__sections-table')
  const sectionRow = (index) => sectionsTable.locator(`tr[data-section-id=${JSON.stringify(complete.sections[index].sectionId)}]`)
  // Horario keeps one result table (grouped sections) and the Semana grid; the legacy assignments table and calendar were removed.
  assert.equal(await page.getByRole('region', { name: 'Programación generada', exact: true }).count(), 0, 'The duplicated assignments table is gone')
  assert.equal(await page.locator('.planning-stage-panel--horario .weekly-schedule').count(), 0, 'The duplicated legacy calendar is gone')
  const weekBlocks = page.locator('.planning-week__grid-wrapper article[data-week-grid-section-id]')
  assert.equal(await sectionsTable.locator('tr[data-section-id]').count(), 4)
  assert.equal(await page.locator('.academic-scheduling__manual-review').count(), 0, 'No editor appears before a section is selected')
  assert.equal(await sectionsTable.getByRole('columnheader', { name: 'Acciones', exact: true }).count(), 1)
  assert.equal(await sectionsTable.getByRole('button', { name: 'Editar horario', exact: true }).count(), 4)
  for (const cell of await sectionsTable.locator('tr[data-section-id] .planning-sections__cell-section').all()) assert.match((await cell.innerText()).trim(), /^\d+$/, 'The section cell contains only its number')
  assert.equal(await sectionsTable.getByRole('columnheader', { name: 'Modalidad', exact: true }).count(), 0)
  await page.locator('.academic-scheduling__sections-table').screenshot({ path: resolve(output, 'sections-table.png') })
  // Component types and durations now live in the section inspector.
  const componentTags = []
  for (let index = 0; index < complete.sections.length; index += 1) {
    await sectionRow(index).getByRole('button', { name: /^Inspeccionar sección/ }).click()
    componentTags.push(...(await page.locator('.planning-inspector__component-tag').allInnerTexts()).map((text) => text.trim()))
  }
  assert.ok(componentTags.includes('T · 2 h (120 min)'), componentTags.join(' | '))
  assert.ok(componentTags.includes('L · 2 h (120 min)'), componentTags.join(' | '))
  assert.equal(await weekBlocks.count(), 4)
  const firstSectionId = complete.assignments[0].sectionId
  const firstSectionRowIndex = complete.sections.findIndex((section) => section.sectionId === firstSectionId)
  await sectionRow(firstSectionRowIndex).getByRole('button', { name: 'Editar horario', exact: true }).click()
  assert.equal(await page.locator('.academic-scheduling__manual-review').count(), 1)
  assert.match(await page.locator('.academic-scheduling__manual-review h4').innerText(), new RegExp(`Sección ${firstSectionRowIndex + 1}`))
  const otherSectionRowIndex = (firstSectionRowIndex + 1) % complete.sections.length
  await sectionRow(otherSectionRowIndex).getByRole('button', { name: 'Editar horario', exact: true }).click()
  assert.equal(await page.locator('.academic-scheduling__manual-review').count(), 1, 'Switching sections retains one editor')
  assert.match(await page.locator('.academic-scheduling__manual-review h4').innerText(), new RegExp(`Sección ${otherSectionRowIndex + 1}`))
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  assert.equal(await page.locator('.academic-scheduling__manual-review').count(), 0, 'Cancel closes the editor')
  const targetAssignments = complete.assignments.filter((row) => row.sectionId === firstSectionId).sort((a, b) => a.startMinute - b.startMinute)
  const targetIds = targetAssignments.map((row) => row.sessionId)
  const toTime = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
  const blockMinutes = targetAssignments.reduce((total, row) => total + row.endMinute - row.startMinute, 0)
  const targetTeacherIds = new Set(targetAssignments.map((row) => row.teacherId))
  const targetRoomIds = new Set(targetAssignments.map((row) => row.roomId))
  // Cycle ≥ 7 courses pass FISI-PLANNING-1 without exceptions only on weekdays 18:00–22:00
  // (backend/src/programacion-academica/demo-proposal.service.ts:556-562 isAllowedPlanningInterval;
  // mirrored in schedule-generator.ts:309-322). The two 2-hour sessions run back to back, so only 18:00 fits.
  // The day must differ from the current placement so the adjustment really moves the block.
  const slot = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 18 * 60 })).find((candidate) => {
    if (candidate.day === targetAssignments[0].day) return false
    const blockEnd = candidate.startMinute + blockMinutes
    return !complete.assignments.some((row) => row.sectionId !== firstSectionId && row.day === candidate.day
      && row.startMinute < blockEnd && row.endMinute > candidate.startMinute
      && (targetTeacherIds.has(row.teacherId) || targetRoomIds.has(row.roomId)))
  })
  assert.ok(slot, 'Se requiere un día distinto con bloque libre de 18:00 a 22:00 sin colisión docente o de ambiente')
  // Friday 16:00 is an afternoon slot for a senior course: rejected by default, accepted only with allowAfternoon.
  const afternoonSlot = { day: 5, startMinute: 16 * 60 }
  await sectionRow(firstSectionRowIndex).getByRole('button', { name: 'Editar horario', exact: true }).click()
  const firstTargetDay = page.getByLabel(`Día revisión ${firstSectionId}`, { exact: true })
  const firstTargetStart = page.getByLabel(`Inicio revisión ${firstSectionId}`, { exact: true })
  const tableBeforePolicyRejection = await sectionsTable.innerText()
  const proposalBeforePolicyRejection = await read(`/local/programacion-academica/v1/propuestas/${complete.proposalId}`)
  await firstTargetDay.selectOption(String(afternoonSlot.day))
  await firstTargetStart.fill(toTime(afternoonSlot.startMinute))
  const policyRejectedPending = page.waitForResponse((response) => response.url().endsWith('/ajustes') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Aplicar ajuste', exact: true }).click()
  const policyRejected = await policyRejectedPending
  assert.equal(policyRejected.status(), 422, await policyRejected.text())
  assert.match((await policyRejected.json()).error.message, /PLANNING_POLICY_WINDOW/)
  await page.getByRole('alert').filter({ hasText: 'No se aplicó el ajuste' }).waitFor()
  assert.equal(await sectionsTable.innerText(), tableBeforePolicyRejection)
  assert.deepEqual(await read(`/local/programacion-academica/v1/propuestas/${complete.proposalId}`), proposalBeforePolicyRejection)

  await firstTargetDay.selectOption(String(slot.day))
  await firstTargetStart.fill(toTime(slot.startMinute))
  const validAdjustmentPending = page.waitForResponse((response) => response.url().endsWith('/ajustes') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Aplicar ajuste', exact: true }).click()
  const validAdjustmentResponse = await validAdjustmentPending
  assert.equal(validAdjustmentResponse.status(), 200, await validAdjustmentResponse.text())
  const adjustedProposal = await validAdjustmentResponse.json()
  assert.equal(adjustedProposal.editVersion, 1)
  assert.deepEqual(adjustedProposal.manuallyAdjustedSectionIds, [firstSectionId])
  assert.deepEqual(adjustedProposal.assignments.filter((row) => targetIds.includes(row.sessionId)).map((row) => row.day), targetAssignments.map(() => slot.day))
  assert.equal(await sectionsTable.locator('tr[data-section-id]').count(), 4)
  assert.equal(await sectionsTable.locator('tr[data-section-id] .planning-sections__cell-status').filter({ hasText: 'Ajustada' }).count(), 1)
  assert.match(await sectionRow(firstSectionRowIndex).locator('.planning-sections__cell-status').innerText(), /Ajustada/)
  assert.equal(await weekBlocks.count(), 4)

  // Interval of the chronological component `index` when the block starts at `startMinute` (same rule as the backend's precedingDuration).
  const componentInterval = (startMinute, index) => {
    const offset = targetAssignments.slice(0, index).reduce((total, row) => total + row.endMinute - row.startMinute, 0)
    return { start: startMinute + offset, end: startMinute + offset + targetAssignments[index].endMinute - targetAssignments[index].startMinute }
  }
  const optionValues = (select) => select.locator('option').evaluateAll((options) => options.map((option) => option.value))
  // Configured rooms (availability set above) are preferred; a room is free when no session outside `ignoredSessionIds` uses it on that day during the interval.
  const preferredRoomIds = [...classroomRoomIds, 'LAB01NP']
  const chooseRoom = (optionIds, interval, day, ignoredSessionIds) => [...optionIds.filter((id) => preferredRoomIds.includes(id)), ...optionIds.filter((id) => !preferredRoomIds.includes(id))]
    .find((roomId) => !liveAssignments.some((row) => row.roomId === roomId && !ignoredSessionIds.includes(row.sessionId)
      && row.day === day && row.startMinute < interval.end && row.endMinute > interval.start))
  // The teacher-collision edit sends only the block start, so the candidate must start at 18:00 to keep the moved block inside the default policy window.
  const collisionAssignment = complete.assignments.find((row) => row.sectionId !== firstSectionId
    && row.startMinute === 18 * 60
    && row.teacherId !== targetAssignments[0].teacherId
    && !complete.assignments.some((other) => other.sectionId !== firstSectionId && other.sectionId !== row.sectionId
      && other.teacherId === row.teacherId && other.day === row.day && other.startMinute < row.endMinute && other.endMinute > row.startMinute))
  assert.ok(collisionAssignment, 'Se requiere un bloque de otra sección para colisión sintética de docente')
  // The room-collision edit below keeps the target's original teacher at the collision time, so that teacher must be free there too;
  // otherwise TEACHER_CONFLICT would be reported before the expected ROOM_CONFLICT (validator order: pair loop emits TEACHER before ROOM).
  assert.ok(!complete.assignments.some((other) => other.sectionId !== firstSectionId && other.teacherId === targetAssignments[0].teacherId
    && other.day === collisionAssignment.day && other.startMinute < collisionAssignment.startMinute + blockMinutes && other.endMinute > collisionAssignment.startMinute),
  'El docente original del bloque debe estar libre en el horario de colisión')
  const otherSection = complete.sections.find((section) => section.sectionId === collisionAssignment.sectionId)
  const tableBeforeRejectedEdit = await sectionsTable.innerText()
  await sectionRow(firstSectionRowIndex).getByRole('button', { name: 'Editar horario', exact: true }).click()
  await page.getByLabel(`Docente revisión ${firstSectionId}`, { exact: true }).selectOption(collisionAssignment.teacherId)
  await page.getByLabel(`Día revisión ${firstSectionId}`, { exact: true }).selectOption(String(collisionAssignment.day))
  await page.getByLabel(`Inicio revisión ${firstSectionId}`, { exact: true }).fill(`${String(Math.floor(collisionAssignment.startMinute / 60)).padStart(2, '0')}:${String(collisionAssignment.startMinute % 60).padStart(2, '0')}`)
  // Rooms: each select offers only rooms of its component's kind (T → classroom, L → laboratory), so a fixed classroom id cannot be chosen for an L select.
  // Choose from each select's real options a room that no other session occupies during its interval, so TEACHER_CONFLICT is the only collision.
  // Selects follow the block's chronological order (activeAssignments sort in the client), which is the order of targetAssignments.
  const liveAssignments = adjustedProposal.assignments
  const componentSelects = page.locator('.academic-scheduling__manual-components select')
  assert.equal(await componentSelects.count(), targetAssignments.length)
  for (const [index, select] of (await componentSelects.all()).entries()) {
    // With a single configured room of a kind, it may be busy only with the colliding section itself. The validator checks each
    // pair for TEACHER_CONFLICT before ROOM_CONFLICT, so sharing a room with that same section still reports the teacher conflict first.
    const options = await optionValues(select)
    const interval = componentInterval(collisionAssignment.startMinute, index)
    const collidingSessionIds = complete.assignments.filter((row) => row.sectionId === collisionAssignment.sectionId).map((row) => row.sessionId)
    const roomId = chooseRoom(options, interval, collisionAssignment.day, targetIds)
      ?? chooseRoom(options, interval, collisionAssignment.day, [...targetIds, ...collidingSessionIds])
    assert.ok(roomId, `Sin ambiente libre de tipo ${targetAssignments[index].sessionType} para la colisión docente`)
    await select.selectOption(roomId)
  }
  const teacherCollisionPending = page.waitForResponse((response) => response.url().endsWith('/ajustes') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Aplicar ajuste', exact: true }).click()
  const teacherCollision = await teacherCollisionPending
  assert.equal(teacherCollision.status(), 422)
  assert.match((await teacherCollision.json()).error.message, /TEACHER_CONFLICT/)
  await page.getByRole('alert').filter({ hasText: 'No se aplicó el ajuste' }).waitFor()
  assert.equal(await sectionsTable.innerText(), tableBeforeRejectedEdit)
  assert.equal((await read(`/local/programacion-academica/v1/propuestas/${complete.proposalId}`)).editVersion, 1)

  await page.getByLabel(`Docente revisión ${firstSectionId}`, { exact: true }).selectOption(targetAssignments[0].teacherId)
  const targetRoomSelects = page.locator('.academic-scheduling__manual-components select')
  // Map by kind and time, not by index: a T select can only offer classrooms, so the colliding room must be the colliding session of the same sessionType
  // that overlaps the select's component interval. Other selects take a free option, so ROOM_CONFLICT is the room collision reported.
  let roomCollisionSelects = 0
  for (const [index, select] of (await targetRoomSelects.all()).entries()) {
    const interval = componentInterval(collisionAssignment.startMinute, index)
    const clash = liveAssignments.find((row) => row.sectionId === collisionAssignment.sectionId && row.sessionType === targetAssignments[index].sessionType
      && row.day === collisionAssignment.day && row.startMinute < interval.end && row.endMinute > interval.start)
    const options = await optionValues(select)
    const roomId = clash && options.includes(clash.roomId) ? clash.roomId : chooseRoom(options, interval, collisionAssignment.day, targetIds)
    assert.ok(roomId, `Sin ambiente para el componente ${targetAssignments[index].sessionType}`)
    if (clash && roomId === clash.roomId) roomCollisionSelects++
    await select.selectOption(roomId)
  }
  assert.ok(roomCollisionSelects > 0, 'Se requiere un componente del mismo tipo y horario en la sección de colisión para ROOM_CONFLICT')
  const roomCollisionPending = page.waitForResponse((response) => response.url().endsWith('/ajustes') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Aplicar ajuste', exact: true }).click()
  const roomCollision = await roomCollisionPending
  assert.equal(roomCollision.status(), 422)
  assert.match((await roomCollision.json()).error.message, /ROOM_CONFLICT/)
  await page.getByRole('alert').filter({ hasText: 'No se aplicó el ajuste' }).waitFor()
  assert.equal(await sectionsTable.innerText(), tableBeforeRejectedEdit)
  assert.equal((await read(`/local/programacion-academica/v1/propuestas/${complete.proposalId}`)).editVersion, 1)
  await page.getByRole('group', { name: 'Vista', exact: true }).getByRole('button', { name: 'Semana', exact: true }).click()
  await page.locator('.planning-week__grid-wrapper').screenshot({ path: resolve(output, 'erp-complete-calendar.png') })
  await page.getByRole('group', { name: 'Vista', exact: true }).getByRole('button', { name: 'Tabla', exact: true }).click()
  await stage('Preparación', 'preparacion')
  await openResourceTab('teachers')
  await closeResourceSheet(page)
  await page.getByLabel('Seleccionar o agregar docente').selectOption(teachers[1].id)
  await teacherForm.getByRole('button', { name: /^Quitar docente / }).click()
  assert.equal(await page.locator('.academic-scheduling__result').count(), 0)
  // The resource workbench keeps no card open after removal; reopen the remaining teacher explicitly.
  await closeResourceSheet(page)
  await page.getByLabel('Seleccionar o agregar docente').selectOption(teachers[0].id)
  await page.getByLabel('Carga semanal docente', { exact: true }).fill('480')
  await page.getByLabel(`Máximo de secciones ${course.courseId}`, { exact: true }).fill('2')
  const insufficient = await generate()
  // Broad editable resources may exhaust the bounded search before proving the
  // shortage. A computational limit must retain its own status, never impossible.
  assert.ok(['impossible', 'search-limit'].includes(insufficient.status))
  assert.equal(insufficient.coverageComplete, false)
  assert.equal(insufficient.counts.sections, 4)
  assert.ok(insufficient.counts.scheduledSessions < 8)
  for (const row of await sectionsTable.locator('tr[data-section-id]').all()) {
    if ((await row.locator('.planning-sections__cell-status').innerText()).includes('Pendiente')) assert.equal(await row.getByRole('button', { name: 'Editar horario', exact: true }).count(), 0, 'Sections without assignments are not editable')
  }
  if (insufficient.status === 'search-limit') {
    assert.ok(insufficient.diagnostics.some((row) => row.code === 'SEARCH_LIMIT'))
    assert.ok(insufficient.stats.limitReason)
    assert.match(await page.locator('.academic-scheduling__result').innerText(), /Búsqueda inconclusa por límite computacional/)
  } else {
    assert.ok(insufficient.diagnostics.every((row) => row.code !== 'SEARCH_LIMIT'))
    assert.match(await page.locator('.academic-scheduling__result').innerText(), /Sin solución completa en el dominio configurado/)
  }
  assert.equal(await weekBlocks.count(), insufficient.counts.scheduledSessions / 2)
  await page.locator('.academic-scheduling__result').scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, 'erp-insufficient.png') })
  await stage('Preparación', 'preparacion')
  // The teacher sheet closed when the stage changed; reopen it to edit the same teacher.
  await page.getByLabel('Seleccionar o agregar docente').selectOption(teachers[0].id)
  await page.getByLabel('Carga semanal docente', { exact: true }).fill('960')
  await page.getByLabel(`Máximo de secciones ${course.courseId}`, { exact: true }).fill('4')
  const oneTeacher = await generate()
  assert.equal(oneTeacher.status, 'complete')
  assert.equal(new Set(oneTeacher.assignments.map((row) => row.teacherId)).size, 1)
  assert.equal(oneTeacher.preferenceReport.outsidePreferenceSections, 2)
  assert.ok(oneTeacher.diagnostics.some((row) => row.code === 'PREFERENCES_NOT_MET'))
  assert.equal(await weekBlocks.count(), 4)
  await stage('Preparación', 'preparacion')
  await closeResourceSheet(page)
  await page.getByLabel('Seleccionar o agregar docente').selectOption(teachers[0].id)
  // 16:00–18:00 is outside the default policy for cycle ≥ 7 (only 18:00–22:00 weekdays), so the generator could not place these sessions.
  // Each 2-hour session gets one 18:00–20:00 window on a different day.
  await setIntervals('Disponibilidad docente', [1, 2], '18:00', '20:00')
  await openResourceTab('rooms')
  for (const roomId of [...classroomRoomIds, 'LAB01NP']) {
    await closeResourceSheet(page)
    await page.getByLabel('Seleccionar o agregar ambiente').selectOption(roomId)
    await setIntervals('Disponibilidad del ambiente', [1, 2], '18:00', '20:00')
  }
  await closeResourceSheet(page)
  await page.getByLabel(`Demanda ${course.courseId}`, { exact: true }).fill('45')
  await page.getByLabel(`Modalidad de sesiones ${course.courseId}`, { exact: true }).selectOption('split')
  const splitProposal = await generate()
  assert.equal(splitProposal.status, 'complete')
  assert.equal(splitProposal.sections.length, 1)
  assert.equal(splitProposal.sections[0].deliveryMode, 'split')
  assert.equal(splitProposal.assignments.length, 2)
  assert.equal(new Set(splitProposal.assignments.map((assignment) => assignment.day)).size, 2, 'Two 2-hour sessions must use the two 2-hour availability windows on different days')
  const splitSectionRow = sectionsTable.locator('tr[data-section-id]').first()
  await splitSectionRow.getByRole('button', { name: 'Editar horario', exact: true }).click()
  assert.equal(await page.locator('.academic-scheduling__manual-review').count(), 1)
  const splitBlockSelect = page.locator('.academic-scheduling__block-select select')
  assert.equal(await splitBlockSelect.count(), 1, 'Two split days expose the compact block selector')
  assert.equal(await splitBlockSelect.locator('option').count(), 2)
  const originalValue = await splitBlockSelect.inputValue()
  const nextValue = await splitBlockSelect.locator('option').evaluateAll((options, value) => options.map((option) => option.value).find((item) => item !== value), originalValue)
  assert.ok(nextValue)
  await splitBlockSelect.selectOption(nextValue)
  assert.equal(await page.locator('.academic-scheduling__manual-review').count(), 1, 'Changing split block retains one editor')
  assert.notEqual(await splitBlockSelect.inputValue(), originalValue)
  const splitChoiceCount = await splitBlockSelect.locator('option').count()
  await page.locator('.academic-scheduling__manual-review').screenshot({ path: resolve(output, 'split-editor.png') })
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  assert.equal(await page.locator('.academic-scheduling__manual-review').count(), 0)
  assert.deepEqual(await read(`/local/programacion-academica/v1/propuestas/${complete.proposalId}`), adjustedProposal)
  assert.deepEqual((await read('/local/matricula-regular/v1/contextos/SYN-SIS-A')).data.offer, beforeOffer)
  assert.deepEqual(errors, [])
  assert.deepEqual(external, [])
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ date: new Date().toISOString(), base, source: 'own synthetic Compose project',
    courseId: course.courseId, demand: 180, capacity: 45, complete: complete.counts,
    insufficient: { status: insufficient.status, counts: insufficient.counts, diagnostics: insufficient.diagnostics.map((row) => row.code) },
    oneTeacher: { counts: oneTeacher.counts, preferences: oneTeacher.preferenceReport },
    splitEditor: { sectionId: splitProposal.sections[0].sectionId, assignedSessions: splitProposal.assignments.length,
      availableBlockChoices: splitChoiceCount }, compactEditors: true, retainedConfiguration: true,
    manualAdjustment: { sectionId: firstSectionId, sessionIds: targetIds, version: adjustedProposal.editVersion, day: slot.day, startMinute: slot.startMinute },
    afternoonPolicyRejection: { status: policyRejected.status(), day: afternoonSlot.day, startMinute: afternoonSlot.startMinute },
    teacherCollisionStatus: teacherCollision.status(), roomCollisionStatus: roomCollision.status(), rejectedEditsPreserveView: true,
    duplicatePrevention: true, blocksInCalendar: 4, unchangedEnrollmentOffer: true, errors, external }, null, 2))
  console.log('PASS ERP180: manual block review, single sections table plus Semana grid (no duplicated assignments table/calendar), collision rejection with prior view retained, compact editors, preferences, resource limits, unchanged enrollment offer')
} finally {
  await browser.close()
}

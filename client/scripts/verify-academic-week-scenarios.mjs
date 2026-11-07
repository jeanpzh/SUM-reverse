// Independent synthetic inputs only. All responses come from the owned NestJS process.
import assert from 'node:assert/strict'

export async function verifyWeekScenarios({ page, api, catalog, goToStage }) {
  const endpoint = `${api}/local/programacion-academica/v1`
  const post = async (path, body) => {
    const response = await fetch(`${endpoint}/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const value = await response.json()
    assert.equal(response.status, 200, JSON.stringify(value))
    return value
  }
  const read = async (id) => {
    const response = await fetch(`${endpoint}/propuestas/${id}`)
    assert.equal(response.status, 200)
    return response.json()
  }
  // Separate cycles permit real concurrency without a cohort conflict. Each course has
  // its own teacher and rooms, so the simultaneous assignments are valid.
  const splitCourse = catalog.courses.find((course) => course.cycle < 7 && course.weeklySessions.length >= 2)
  assert.ok(splitCourse, 'Synthetic catalog needs a multi-component course')
  const otherCourse = catalog.courses.find((course) => course.cycle < 7 && course.cycle !== splitCourse.cycle)
  assert.ok(otherCourse, 'Synthetic catalog needs another cycle')
  const courses = [splitCourse, otherCourse]
  const availability = Array.from({ length: 6 }, (_, index) => ({ day: index + 1, startMinute: 480, endMinute: index === 5 ? 780 : 1320 }))
  const resources = {
    teachers: courses.map((course, index) => ({ id: `SYN-WEEK-T${index}`, name: `Docente sintético ${index}`,
      courseIds: [course.courseId], maxWeeklyMinutes: 2400,
      availability: availability.map((interval) => ({ ...interval,
        endMinute: interval.startMinute + Math.max(...course.weeklySessions.map((session) => session.durationMinutes)) })) })),
    rooms: courses.flatMap((course, index) => [
      { id: `SYN-WEEK-A${index}`, name: `Aula exclusiva ${index}`, kind: 'classroom', capacity: 45, availability },
      { id: `SYN-WEEK-L${index}`, name: `Laboratorio exclusivo ${index}`, kind: 'laboratory', capacity: 45, availability },
    ]),
  }
  resources.rooms.push({ id: 'SYN-WEEK-UNIQUE', name: 'Ambiente exclusivo del primer componente', kind: 'classroom', capacity: 45, availability })
  const request = { revision: catalog.revision, demands: courses.map((course) => ({ courseId: course.courseId,
    estimatedDemand: 1, targetCapacity: 30, deliveryMode: 'split' })), resources,
    planningPolicy: { revision: 'FISI-PLANNING-1', period: '2027-I', allowAfternoon: true, allowSaturday: true } }
  let proposal = await post('propuestas', request)
  assert.equal(proposal.status, 'complete')
  assert.equal(proposal.pending.length, 0)
  const sectionFor = (course) => proposal.sections.find((section) => section.courseId === course.courseId).sectionId
  const firstSection = sectionFor(splitCourse)
  const otherSection = sectionFor(otherCourse)
  const splitAssignments = proposal.assignments.filter((assignment) => assignment.sectionId === firstSection)
  const firstSession = splitAssignments[0].sessionId
  const otherSession = proposal.assignments.find((assignment) => assignment.sectionId === otherSection).sessionId
  const roomFor = (assignment, index, unique = false) => {
    const type = String(assignment.sessionType).toLowerCase()
    if (unique) return 'SYN-WEEK-UNIQUE'
    return `SYN-WEEK-${type === 'l' || type.includes('laboratorio') ? 'L' : 'A'}${index}`
  }
  const adjust = async (sessionId, day, startMinute, roomId) => {
    const current = proposal.assignments.find((assignment) => assignment.sessionId === sessionId)
    proposal = await post(`propuestas/${proposal.proposalId}/ajustes`, {
      expectedVersion: proposal.editVersion ?? 0, sectionId: current.sectionId, sessionIds: [sessionId],
      teacherId: current.teacherId, roomIds: [roomId ?? current.roomId], day, startMinute,
    })
  }
  // Put each component on a distinct day first, then deliberately overlap two courses.
  for (const [index, assignment] of splitAssignments.entries()) {
    await adjust(assignment.sessionId, index + 1, 480, roomFor(assignment, 0, index === 0))
  }
  const otherAssignments = proposal.assignments.filter((assignment) => assignment.sectionId === otherSection)
  for (const [index, assignment] of otherAssignments.entries()) {
    await adjust(assignment.sessionId, index + 1, 480, roomFor(assignment, 1))
  }
  const overlapping = [firstSession, otherSession].map((id) => proposal.assignments.find((assignment) => assignment.sessionId === id))
  assert.equal(overlapping[0].day, overlapping[1].day)
  assert.equal(overlapping[0].startMinute, overlapping[1].startMinute)
  assert.notEqual(overlapping[0].teacherId, overlapping[1].teacherId)
  assert.notEqual(overlapping[0].roomId, overlapping[1].roomId)

  let saved = await post('borradores/guardar', { id: null, expectedVersion: null, title: 'SYN Semana aceptación', state: 'draft',
    configuration: { schoolId: 'SISTEMAS', academicPeriod: '2027-I', request, demandSourceId: 'independent-120-v1', demandBaseRequest: null },
    proposalId: proposal.proposalId, proposalEditVersion: proposal.editVersion ?? 0 })
  const resume = async (locked = false) => {
    await page.reload()
    await goToStage('Preparación', 'preparacion')
    await page.getByRole('button', { name: 'Mis propuestas', exact: true }).click()
    const row = page.locator('.academic-scheduling__saved-row').filter({ hasText: saved.title })
    await row.locator('summary').click()
    const response = page.waitForResponse((res) => res.url().endsWith(`/borradores/${saved.id}/continuar`))
    await row.getByRole('button', { name: locked ? 'Consultar' : 'Continuar edición', exact: true }).click()
    const received = await response
    assert.equal(received.status(), 200)
    proposal = (await received.json()).draft.proposal
    await goToStage('Horario', 'horario')
    await page.getByRole('button', { name: 'Semana', exact: true }).click()
  }
  await resume()
  // Use the day column's accessible name to distinguish split components.
  const dayBlock = (sectionId, dayName) => page.locator('.planning-week__day-col')
    .and(page.getByLabel(`Horarios del ${dayName}`, { exact: true }))
    .locator(`[data-week-grid-section-id=${JSON.stringify(sectionId)}]`)
  const close = async () => {
    if (await page.getByRole('button', { name: 'Cerrar inspector' }).isVisible()) await page.getByRole('button', { name: 'Cerrar inspector' }).click()
  }
  const firstBlock = dayBlock(firstSection, 'Lunes')
  const secondBlock = dayBlock(otherSection, 'Lunes')
  const boxes = await Promise.all([firstBlock.boundingBox(), secondBlock.boundingBox()])
  assert.ok(boxes.every((box) => box && box.width > 20 && box.height > 20))
  const [a, b] = boxes
  assert.ok(a.y < b.y + b.height && b.y < a.y + a.height, 'Actual assignments overlap in time')
  assert.ok(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1, 'Actual assignments occupy separate lanes')
  for (const [locator, sectionId] of [[firstBlock, firstSection], [secondBlock, otherSection]]) {
    await locator.focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.locator('.planning-week__block--selected').first().getAttribute('data-week-grid-section-id'), sectionId)
    assert.ok(await page.locator('.planning-inspector').isVisible())
    await close()
  }
  console.log('PASS WV-1: two valid concurrent assignments have disjoint lanes and independent keyboard selection')

  // The first split component uses a room unique to it; the remaining components use
  // another room. A resource search must retain all of this section's components.
  const uniqueRoom = resources.rooms.find((room) => room.id === overlapping[0].roomId).name
  assert.equal(proposal.assignments.filter((assignment) => assignment.roomName === uniqueRoom).length, 1)
  await page.getByRole('searchbox', { name: 'Buscar secciones' }).fill(uniqueRoom)
  const rendered = page.locator('.planning-week__block:not(.planning-week__block--proposed-preview)')
  assert.equal(await rendered.count(), splitAssignments.length)
  assert.deepEqual(new Set(await rendered.evaluateAll((nodes) => nodes.map((node) => node.dataset.weekGridSectionId))), new Set([firstSection]))
  await page.getByRole('button', { name: 'Tabla', exact: true }).click()
  assert.equal(await page.locator('tr[data-section-id]').count(), 1)
  assert.equal(await page.locator('tr[data-section-id]').getAttribute('data-section-id'), firstSection)
  await page.getByRole('button', { name: 'Semana', exact: true }).click()
  assert.equal(await rendered.count(), splitAssignments.length)
  await page.getByRole('searchbox', { name: 'Buscar secciones' }).fill('')
  console.log('PASS WV-4: unique resource search keeps every split component in both views')

  // Valid adjustment: actual Saturday availability, server acceptance and read-back.
  await firstBlock.click()
  const before = await read(proposal.proposalId)
  await page.getByLabel(/Día revisión/).selectOption('6')
  await page.getByLabel(/Inicio revisión/).fill('08:00')
  const accepted = page.waitForResponse((res) => res.url().endsWith('/ajustes') && res.request().method() === 'POST')
  await page.getByRole('button', { name: 'Aplicar ajuste', exact: true }).click()
  const acceptedResponse = await accepted
  assert.equal(acceptedResponse.status(), 200)
  proposal = await acceptedResponse.json()
  const weekend = proposal.assignments.find((assignment) => assignment.sessionId === firstSession)
  assert.equal(weekend.day, 6)
  assert.equal(weekend.endMinute - weekend.startMinute, overlapping[0].endMinute - overlapping[0].startMinute)
  assert.notDeepEqual(proposal.assignments, before.assignments)
  assert.deepEqual((await read(proposal.proposalId)).assignments, proposal.assignments)
  await close()
  const saturday = dayBlock(firstSection, 'Sábado')
  await saturday.scrollIntoViewIfNeeded()
  assert.ok(await saturday.isVisible())
  await saturday.click()
  // An invalid Sunday has no configured planning window, so rejection is deterministic.
  const committedBefore = await read(proposal.proposalId)
  const visibleBefore = await rendered.allInnerTexts()
  await page.getByLabel(/Día revisión/).selectOption('7')
  const rejected = page.waitForResponse((res) => res.url().endsWith('/ajustes') && res.request().method() === 'POST')
  await page.getByRole('button', { name: 'Aplicar ajuste', exact: true }).click()
  assert.equal((await rejected).status(), 422)
  await page.getByRole('alert').filter({ hasText: 'No se aplicó el ajuste' }).waitFor()
  assert.deepEqual(await read(proposal.proposalId), committedBefore, 'Rejected adjustment preserves the complete server proposal')
  assert.deepEqual(await rendered.allInnerTexts(), visibleBefore, 'Rejected adjustment preserves committed UI placements')
  assert.ok(await page.locator('.planning-week__grid-wrapper .planning-week__placement-tag--proposed').isVisible())
  const sizes = await page.locator('.planning-week__block-section, .planning-week__block-time, .planning-week__block-details, .planning-week__placement-tag, .planning-inspector__placement-badge')
    .evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)))
  assert.ok(sizes.length > 0 && sizes.every((size) => size >= 12))
  await close()
  await page.setViewportSize({ width: 720, height: 700 })
  const agendaDay = page.getByLabel('Filtrar agenda por día', { exact: true })
  await agendaDay.selectOption('6')
  const agenda = page.locator(`[data-week-agenda-section-id=${JSON.stringify(firstSection)}]`)
  assert.ok(await agenda.isVisible())
  assert.match(await agenda.innerText(), /08:00/)
  const agendaButton = agenda.getByRole('button')
  await agendaButton.focus()
  await page.keyboard.press('Enter')
  assert.ok(await page.locator('.planning-inspector').isVisible())
  assert.equal(await page.locator('.planning-week__agenda-card[role="button"] button').count(), 0)
  await close()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true)
  console.log('PASS: Saturday block in grid/720px agenda; valid API edit; strict 422 preserves server and visible assignments; essential type >=12px')

  // Freeze through the real review and approval lifecycle, then resume through the UI.
  saved = await post('borradores/guardar', { id: saved.id, expectedVersion: saved.version, title: saved.title, state: 'ready-for-review',
    configuration: saved.configuration, proposalId: proposal.proposalId, proposalEditVersion: proposal.editVersion })
  saved = (await post(`borradores/${saved.id}/revision/enviar`, { expectedVersion: saved.version })).draft
  for (const teacher of saved.review.teachers) {
    saved = (await post(`borradores/${saved.id}/revision/responder`, { expectedVersion: saved.version,
      round: saved.review.round, teacherId: teacher.teacherId, decision: 'conformity', observation: '' })).draft
  }
  saved = (await post(`borradores/${saved.id}/aprobar`, { expectedVersion: saved.version })).draft
  assert.equal(saved.state, 'approved')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await resume(true)
  let writes = 0
  page.on('request', (req) => { if (req.method() === 'POST' && req.url().endsWith('/ajustes')) writes++ })
  await dayBlock(firstSection, 'Sábado').focus()
  await page.keyboard.press('Enter')
  assert.ok(await page.locator('.planning-inspector').isVisible())
  assert.equal(await page.getByRole('button', { name: 'Editar horario', exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Aplicar ajuste', exact: true }).count(), 0)
  assert.equal(await page.locator('.planning-week__slot-target').count(), 0)
  await close()
  await page.setViewportSize({ width: 720, height: 700 })
  await page.getByLabel('Filtrar agenda por día', { exact: true }).selectOption('6')
  assert.ok(await page.locator('.planning-week__agenda-card button').count() > 0)
  assert.ok((await page.locator('.planning-week__agenda-card button').evaluateAll((buttons) => buttons.map((button) => button.disabled))).every(Boolean))
  assert.equal(writes, 0)
  console.log('PASS: actual approved version remains inspectable and cannot open mutable controls in grid or agenda')
}

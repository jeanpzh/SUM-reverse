import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACADEMIC_API, ACADEMIC_REVISION } from '../../../shared/programacion-academica-api.mjs'
import { adjustAcademicProposal, calculatePresentedSections, createAcademicProposal, estimateAcademicDemand, fetchAcademicCatalog, fetchAcademicDrafts, saveAcademicDraft, resumeAcademicDraft, submitAcademicTeacherReview, respondAcademicTeacherReview, formatAcademicInterval, isAcademicSchedulingEnabled, isAcademicSchedulingRoute, isLocalAcademicArea, academicSectionLabel, toAcademicScheduleEvents, aggregateAcademicBlocks, academicSectionCoverage, fetchAcademicReleasePreview, approveAcademicDraft, publishAcademicDraft, forkAcademicDraft, fetchAcademicPublications, fetchAcademicPublication, fetchCurrentAcademicPublication } from './academicScheduling.ts'

const catalog = {
  revision: ACADEMIC_REVISION,
  courses: [{ courseId: 'CS101', name: 'Curso sintético', estimatedDemand: 18, targetCapacity: 20,
    weeklySessions: [{ id: 'CS101-L1', durationMinutes: 90 }] }],
  teachers: [{ id: 'T1', name: 'Docente sintético', courseIds: ['CS101'], maxWeeklyMinutes: 180,
    availability: [{ day: 1, startMinute: 480, endMinute: 660 }] }],
  rooms: [{ id: 'R1', name: 'Aula sintética', capacity: 20,
    availability: [{ day: 1, startMinute: 480, endMinute: 660 }] }],
  windows: [{ day: 1, startMinute: 480, endMinute: 660 }], startStepMinutes: 30, maxExplorations: 100,
}

const proposal = {
  proposalId: 'proposal-synthetic', createdAt: '2026-10-29T12:00:00.000Z', expiresAt: '2026-10-29T12:15:00.000Z',
  status: 'complete' as const,
  sections: [{ sectionId: 'A', courseId: 'CS101', courseName: 'Curso sintético', capacity: 20, deliveryMode: 'continuous' as const }],
  assignments: [{ sessionId: 'CS101-L1', sectionId: 'A', courseId: 'CS101', courseName: 'Curso sintético',
    teacherId: 'T1', teacherName: 'Docente sintético', roomId: 'R1', roomName: 'Aula sintética',
    day: 1, startMinute: 480, endMinute: 570, sessionType: 'Teoría' }],
  pending: [], diagnostics: [], coverageComplete: true,
  counts: { sections: 1, requiredSessions: 1, scheduledSessions: 1 },
  stats: { exploredCandidates: 1, candidateVisits: 1, backtracks: 0, limitReason: null },
}

const draftId = '123e4567-e89b-42d3-a456-426614174000'
const emptyWorkspace = { schoolId: 'SISTEMAS' as const, academicPeriod: '2027-I' as const,
  request: { revision: ACADEMIC_REVISION, demands: [], resources: { teachers: [], rooms: [] }, allocationPolicy: 'preferences' as const },
  demandSourceId: 'existing-regular-v1' as const, demandBaseRequest: null }
const savedDraft = { id: draftId, version: 1, title: 'Propuesta sintética', state: 'draft' as const,
  createdAt: '2026-11-04T10:00:00.000Z', updatedAt: '2026-11-04T10:00:00.000Z', configuration: emptyWorkspace,
  demandBase: null, proposal: null }

test('feature gate requires its flag and excludes simulator mode; path matching is exact except trailing slash', () => {
  assert.equal(isAcademicSchedulingEnabled({}), false)
  assert.equal(isAcademicSchedulingEnabled({ VITE_SUM_ACADEMIC_SCHEDULING: '1' }), true)
  assert.equal(isAcademicSchedulingEnabled({ VITE_SUM_ACADEMIC_SCHEDULING: '1', VITE_SUM_SIMULATOR: '1' }), false)
  assert.equal(isAcademicSchedulingRoute('/local/programacion-academica'), false)
  assert.equal(isAcademicSchedulingRoute('/local/programacion-academica/'), false)
  assert.equal(isAcademicSchedulingRoute('/local/programacion-academica/extra'), false)
  const enabled = { VITE_SUM_ACADEMIC_SCHEDULING: '1' }
  assert.equal(isAcademicSchedulingRoute('/local/programacion-academica', enabled), true)
  assert.equal(isAcademicSchedulingRoute('/local/programacion-academica/', enabled), true)
  assert.equal(isAcademicSchedulingRoute('/local/programacion-academica/extra', enabled), false)
})

test('local academic area is feature-gated and limited to cold root, module selector and academic screen', () => {
  const enabled = { VITE_SUM_ACADEMIC_SCHEDULING: '1' }
  for (const path of ['/', '/local/modulos', '/local/modulos/', '/local/programacion-academica', '/local/programacion-academica/']) {
    assert.equal(isLocalAcademicArea(path, enabled), true, path)
  }
  for (const path of ['/local/login', '/alumnoWebSum/v2/inicio', '/local/modulos/extra', '/local/programacion-academica/extra']) {
    assert.equal(isLocalAcademicArea(path, enabled), false, path)
  }
  assert.equal(isLocalAcademicArea('/', {}), false)
  assert.equal(isLocalAcademicArea('/local/modulos', { ...enabled, VITE_SUM_SIMULATOR: '1' }), false)
})

test('saved proposal endpoints use same-origin API and validate list, saved response and trusted resume identity', async () => {
  const list = { items: [{ id: draftId, version: 1, title: 'Propuesta sintética', state: 'draft', schoolId: 'SISTEMAS',
    academicPeriod: '2027-I', createdAt: savedDraft.createdAt, updatedAt: savedDraft.updatedAt, hasSchedule: false }], unavailableCount: 0 }
  let requestedUrl = ''
  const listFetch: typeof fetch = async (input) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify(list), { status: 200 })
  }
  assert.deepEqual(await fetchAcademicDrafts(listFetch), list)
  assert.equal(requestedUrl, `${ACADEMIC_API}/borradores`)
  await assert.rejects(fetchAcademicDrafts(async () => new Response(JSON.stringify({ ...list, items: [{ ...list.items[0], id: 'bad' }] }), { status: 200 })), /Identificador de propuesta guardada inválido/)

  const request = { id: null, expectedVersion: null, title: 'Propuesta sintética', state: 'draft' as const,
    configuration: emptyWorkspace, proposalId: null, proposalEditVersion: null }
  const saveFetch: typeof fetch = async (input, init) => {
    requestedUrl = String(input)
    assert.equal(init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(init?.body)), request)
    return new Response(JSON.stringify(savedDraft), { status: 200 })
  }
  assert.deepEqual(await saveAcademicDraft(request, saveFetch), savedDraft)
  assert.equal(requestedUrl, `${ACADEMIC_API}/borradores/guardar`)

  const resumeFetch: typeof fetch = async (input, init) => {
    requestedUrl = String(input)
    const body = JSON.parse(String(init?.body))
    assert.ok(body.expectedVersion >= 1)
    return new Response(JSON.stringify({ draft: savedDraft }), { status: 200 })
  }
  assert.deepEqual(await resumeAcademicDraft(draftId, 1, resumeFetch), { draft: savedDraft })
  assert.equal(requestedUrl, `${ACADEMIC_API}/borradores/${draftId}/continuar`)
  await assert.rejects(resumeAcademicDraft(draftId, 2, resumeFetch), /no corresponde a la versión solicitada/)
})

test('teacher review endpoints use the two fixed same-origin routes and validate the saved-draft envelope', async () => {
  const submission = { expectedVersion: 3 }
  const decision = { expectedVersion: 4, round: 2, teacherId: 'TEACHER-SYN', decision: 'changes-requested' as const,
    observation: 'Ajustar la franja de la sesión.' }
  let url = ''
  let sent: unknown
  const fetchMock: typeof fetch = async (input, init) => {
    url = String(input)
    sent = JSON.parse(String(init?.body))
    const version = (sent as { expectedVersion: number }).expectedVersion + 1
    const at = '2026-11-04T10:00:00.000Z'
    const event = { type: 'submitted', version, round: 2, at, teacherId: null, decision: null, observation: '', fingerprint: null }
    const teacher = { teacherId: 'TEACHER-SYN', teacherName: 'Docente sintético', fingerprint: '0'.repeat(64), status: 'pending',
      observation: '', decisionVersion: null, decidedAt: null }
    const review = url.endsWith('/revision/enviar')
      ? { round: 2, submittedVersion: version, submittedAt: at, teachers: [teacher], history: [event] }
      : { round: 2, submittedVersion: 2, submittedAt: at,
        teachers: [{ ...teacher, status: 'changes-requested', observation: 'Ajustar la franja de la sesión.', decisionVersion: version, decidedAt: at }],
        history: [event, { ...event, type: 'decision', teacherId: 'TEACHER-SYN', decision: 'changes-requested',
          observation: 'Ajustar la franja de la sesión.', fingerprint: '0'.repeat(64) }] }
    return new Response(JSON.stringify({ draft: { ...savedDraft, version, state: 'in-review', proposal, review } }), { status: 200 })
  }
  assert.equal((await submitAcademicTeacherReview(draftId, submission, fetchMock)).version, 4)
  assert.equal(url, `${ACADEMIC_API}/borradores/${draftId}/revision/enviar`)
  assert.deepEqual(sent, submission)
  assert.equal((await respondAcademicTeacherReview(draftId, decision, fetchMock)).version, 5)
  assert.equal(url, `${ACADEMIC_API}/borradores/${draftId}/revision/responder`)
  assert.deepEqual(sent, decision)
  await assert.rejects(submitAcademicTeacherReview(draftId, submission, async () => new Response(JSON.stringify({ draft: { ...savedDraft, state: 'ready-for-approval' } }), { status: 200 })), /Estado de revisión sin revisión/)
  await assert.rejects(respondAcademicTeacherReview(draftId, decision, async () => new Response(JSON.stringify({ unexpected: savedDraft }), { status: 200 })), /formato inválido/)
})

test('catalog reads same-origin local endpoint and validates its response', async () => {
  let requestedUrl = ''
  const fetchMock: typeof fetch = async (input) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify(catalog), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  assert.deepEqual(await fetchAcademicCatalog(fetchMock), catalog)
  assert.equal(requestedUrl, `${ACADEMIC_API}/catalogo`)

  const malformedFetch: typeof fetch = async () => new Response(JSON.stringify({ ...catalog, revision: 'wrong' }), { status: 200 })
  await assert.rejects(fetchAcademicCatalog(malformedFetch), /Revisión de catálogo incompatible/)

  const errorFetch: typeof fetch = async () => new Response(JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Servicio local no disponible.' } }), { status: 503 })
  await assert.rejects(fetchAcademicCatalog(errorFetch), /Servicio local no disponible/)
  const malformedErrorFetch: typeof fetch = async () => new Response(JSON.stringify({ error: { code: 17, message: 'error' } }), { status: 503 })
  await assert.rejects(fetchAcademicCatalog(malformedErrorFetch), /error con formato inválido/)
})

test('demand estimate sends only selected synthetic-source inputs and checks response identity/capacity', async () => {
  const estimate = {
    revision: ACADEMIC_REVISION,
    source: { id: 'independent-120-v1', label: 'Población independiente', revision: 'fixture-v1', kind: 'synthetic',
      targetPeriod: '2027-I', cutoffPeriod: '2026-1', schoolId: 'SISTEMAS', planId: 'SYN-SIS-PLAN',
      populationSize: 120, recordCount: 120, duplicateRecords: 0, reference: 'fixture independiente v1',
      limitations: ['Muestra construida por fórmula; no es representativa.'] },
    rows: [{ courseId: 'ERP-COURSE', eligible: 60, retakeEligible: 24, nonEligible: 36, insufficient: 24,
      baseDemand: 60, targetCapacity: 45, suggestedSections: 2,
      reasons: [{ category: 'non-eligible', code: 'passed', message: 'Curso aprobado al corte', count: 36 },
        { category: 'insufficient', code: 'unknown', message: 'Antecedentes insuficientes', count: 24 }] }],
  }
  const request = { sourceId: 'independent-120-v1' as const, targetPeriod: '2027-I' as const,
    courses: [{ courseId: 'ERP-COURSE', targetCapacity: 45 }] }
  let requestUrl = ''
  let sentBody: unknown
  const fetchMock: typeof fetch = async (input, init) => {
    requestUrl = String(input)
    sentBody = JSON.parse(String(init?.body))
    return new Response(JSON.stringify(estimate), { status: 200 })
  }
  assert.deepEqual(await estimateAcademicDemand(request, fetchMock), estimate)
  assert.equal(requestUrl, `${ACADEMIC_API}/demanda/estimar`)
  assert.deepEqual(sentBody, { revision: ACADEMIC_REVISION, ...request })
  assert.deepEqual(Object.keys(sentBody as object).sort(), ['courses', 'revision', 'sourceId', 'targetPeriod'])
  assert.equal(JSON.stringify(sentBody).includes('student'), false)

  const wrongCourse = { ...estimate, rows: [{ ...estimate.rows[0], courseId: 'OTHER' }] }
  await assert.rejects(estimateAcademicDemand(request, async () => new Response(JSON.stringify(wrongCourse), { status: 200 })), /no corresponde/)
  const wrongCapacity = { ...estimate, rows: [{ ...estimate.rows[0], targetCapacity: 30, suggestedSections: 2 }] }
  await assert.rejects(estimateAcademicDemand(request, async () => new Response(JSON.stringify(wrongCapacity), { status: 200 })), /no corresponde/)
  await assert.rejects(estimateAcademicDemand(request, async () => new Response('{', { status: 200 })), /JSON válido/)
  await assert.rejects(estimateAcademicDemand(request, async () => new Response(JSON.stringify({ ...estimate, rows: [] }), { status: 200 })), /no corresponde/)
  await assert.rejects(estimateAcademicDemand(request, async () => new Response(
    JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Servicio local no disponible.' } }), { status: 503 })), /Servicio local no disponible/)
})

test('final section preview validates integer input and rounds up without changing manual demand', () => {
  assert.equal(calculatePresentedSections('180', '45'), 4)
  assert.equal(calculatePresentedSections('46', '45'), 2)
  assert.equal(calculatePresentedSections('42.0', '45'), 1)
  assert.equal(calculatePresentedSections('1e2', '45'), 3)
  assert.equal(calculatePresentedSections('0', '45'), 0)
  assert.equal(calculatePresentedSections('', '45'), null)
  assert.equal(calculatePresentedSections('1.5', '45'), null)
  assert.equal(calculatePresentedSections('10', '0'), null)
  const manualFinalDemand = '180'
  const baseDemand = 60
  assert.equal(calculatePresentedSections(manualFinalDemand, '45'), 4)
  assert.equal(manualFinalDemand, '180')
  assert.equal(baseDemand, 60)
})

test('catalog accepts optional synthetic reference identities while rejecting malformed optional planning data', async () => {
  const extended = { ...catalog, source: { kind: 'synthetic', reference: 'local-fixture', sourcePeriod: 'unknown',
    planningPeriod: 'local prototype', assumptions: 'Synthetic planning resources only.' },
    referenceTeachers: [{ id: 'DOC-REF-1', name: 'Docente de referencia sintético', courseIds: ['CS101'] }],
    courses: [{ ...catalog.courses[0], cycle: 2, credits: 4,
      history: { sections: [{ sectionId: 'H1', capacity: 24, sessions: [{ day: 1, startMinute: 0, endMinute: 90,
        room: 'Aula histórica', teacherId: 'DOC-REF-1', teacherName: 'Docente de referencia sintético', type: 'Teoría' }] }] },
      planningPatterns: [{ id: 'weekly-90', label: '1 sesión de 90 min', weeklySessions: [{ id: 'CS101-L1', durationMinutes: 90 }] }],
    }] }
  const fetchMock: typeof fetch = async () => new Response(JSON.stringify(extended), { status: 200 })
  assert.deepEqual(await fetchAcademicCatalog(fetchMock), extended)

  const invalid = { ...extended, courses: [{ ...extended.courses[0], planningPatterns: [{ id: 'weekly-90',
    label: 'Patrón', weeklySessions: [{ id: 'CS101-L1', durationMinutes: 0 }] }] }] }
  await assert.rejects(fetchAcademicCatalog(async () => new Response(JSON.stringify(invalid), { status: 200 }),), /durationMinutes: entero inválido/)
})

test('proposal includes deep-cloned editable resources and validates resource names, ids, limits and intervals', async () => {
  const resources = {
    teachers: [{ id: 'REF-1', name: 'Docente de referencia sintético', courseIds: ['CS101', 'CS202'], maxWeeklyMinutes: 600,
      availability: [{ day: 1, startMinute: 480, endMinute: 1020 }], preferences: [{ day: 1, startMinute: 480, endMinute: 840 }],
      sectionLimits: [{ courseId: 'CS101', maxSections: 3 }] }],
    rooms: [{ id: 'LAB-1', name: 'Laboratorio sintético', kind: 'laboratory' as const, capacity: 24,
      availability: [{ day: 2, startMinute: 540, endMinute: 720 }] }],
  }
  const request = { revision: ACADEMIC_REVISION, demands: [{ courseId: 'CS101', estimatedDemand: 18 }], resources, allocationPolicy: 'balanced' as const }
  let sentBody: unknown
  const fetchMock: typeof fetch = async (_input, init) => {
    sentBody = JSON.parse(String(init?.body))
    return new Response(JSON.stringify(proposal), { status: 200 })
  }
  await createAcademicProposal(request, fetchMock)
  assert.deepEqual(sentBody, request)
  assert.notEqual((sentBody as typeof request).resources, resources)
  assert.notEqual((sentBody as typeof request).resources.teachers[0], resources.teachers[0])
  assert.notEqual((sentBody as typeof request).resources.teachers[0].preferences?.[0], resources.teachers[0].preferences[0])
  assert.notEqual((sentBody as typeof request).resources.teachers[0].sectionLimits?.[0], resources.teachers[0].sectionLimits[0])

  const invalidRequests = [
    { ...request, resources: { ...resources, teachers: [{ ...resources.teachers[0], name: '  ' }] } },
    { ...request, resources: { ...resources, teachers: [{ ...resources.teachers[0], id: ' ' }] } },
    { ...request, resources: { ...resources, teachers: [resources.teachers[0], { ...resources.teachers[0] }] } },
    { ...request, resources: { ...resources, teachers: [{ ...resources.teachers[0], maxWeeklyMinutes: 10081 }] } },
    { ...request, resources: { ...resources, teachers: [{ ...resources.teachers[0], availability: [{ day: 8, startMinute: 480, endMinute: 600 }] }] } },
  ]
  for (const invalid of invalidRequests) await assert.rejects(createAcademicProposal(invalid, fetchMock))
  await createAcademicProposal({ ...request, resources: { teachers: [], rooms: [] } }, fetchMock)
  assert.deepEqual(sentBody, { ...request, resources: { teachers: [], rooms: [] } })
})

test('proposal POST sends only revision and selected demand inputs and validates its response', async () => {
  let sentBody: unknown
  let requestUrl = ''
  const fetchMock: typeof fetch = async (input, init) => {
    requestUrl = String(input)
    sentBody = JSON.parse(String(init?.body))
    return new Response(JSON.stringify(proposal), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const request = { revision: ACADEMIC_REVISION, demands: [{ courseId: 'CS101', estimatedDemand: 18 }] }
  assert.deepEqual(await createAcademicProposal(request, fetchMock), proposal)
  assert.equal(requestUrl, `${ACADEMIC_API}/propuestas`)
  assert.deepEqual(sentBody, request)
  const selectedRequest = { revision: ACADEMIC_REVISION, demands: [
    { courseId: 'CS101', estimatedDemand: 31, targetCapacity: 30, patternId: 'weekly-90' },
  ] }
  await createAcademicProposal(selectedRequest, fetchMock)
  assert.deepEqual(sentBody, selectedRequest)
  await assert.rejects(createAcademicProposal({ ...request, demands: [request.demands[0], request.demands[0]] }, fetchMock), /courseId: repetido/)
  await assert.rejects(createAcademicProposal({ ...selectedRequest, demands: [{ ...selectedRequest.demands[0], targetCapacity: 0 }] }, fetchMock), /targetCapacity: entero inválido/)
  await createAcademicProposal({ revision: ACADEMIC_REVISION, demands: [] }, fetchMock)
  assert.deepEqual(sentBody, { revision: ACADEMIC_REVISION, demands: [] })

  const malformedFetch: typeof fetch = async () => new Response('{"status":"unknown"}', { status: 200 })
  await assert.rejects(createAcademicProposal(request, malformedFetch), /campos inválidos/)
})

test('manual adjustment POST validates and sends the exact local adjustment contract', async () => {
  let requestUrl = ''
  let sentBody: unknown
  const adjusted = { ...proposal, editVersion: 1, manuallyAdjustedSectionIds: ['A'] }
  const fetchMock: typeof fetch = async (input, init) => {
    requestUrl = String(input)
    sentBody = JSON.parse(String(init?.body))
    return new Response(JSON.stringify(adjusted), { status: 200 })
  }
  const adjustment = { expectedVersion: 0, sectionId: 'A', sessionIds: ['CS101-L1'], teacherId: 'T1', day: 2, startMinute: 600, roomIds: ['R1'] }
  assert.deepEqual(await adjustAcademicProposal('proposal/synthetic', adjustment, fetchMock), adjusted)
  assert.equal(requestUrl, `${ACADEMIC_API}/propuestas/proposal%2Fsynthetic/ajustes`)
  assert.deepEqual(sentBody, adjustment)
  await assert.rejects(adjustAcademicProposal('proposal-synthetic', { ...adjustment, roomIds: [] }, fetchMock), /Componentes o ambientes/)
  await assert.rejects(adjustAcademicProposal(' ', adjustment, fetchMock), /Identificación de propuesta/)
  await assert.rejects(adjustAcademicProposal('proposal-synthetic', adjustment, async () => new Response(
    JSON.stringify({ ...adjusted, manuallyAdjustedSectionIds: ['UNKNOWN'] }), { status: 200 })), /Secciones ajustadas inválidas/)
  await assert.rejects(adjustAcademicProposal('proposal-synthetic', adjustment, async () => new Response(
    JSON.stringify({ error: { code: 'CAPACITY', message: 'Capacidad insuficiente.' } }), { status: 422 })), /Capacidad insuficiente/)
})

test('catalog intervals render as readable local day and time labels', () => {
  assert.equal(formatAcademicInterval({ day: 1, startMinute: 480, endMinute: 570 }), 'Lunes 08:00–09:30')
})

test('section presentation uses readable labels without exposing internal identifiers', () => {
  assert.equal(academicSectionLabel(proposal, 'A'), '1')
  assert.equal(toAcademicScheduleEvents(proposal)[0].section, '1')
  assert.match(toAcademicScheduleEvents(proposal)[0].kind, /Teoría 1 h 30 min \(90 min\).*Bloque continuo/)
  assert.match(toAcademicScheduleEvents(proposal)[0].kind, /Automática$/)
  assert.match(toAcademicScheduleEvents({ ...proposal, editVersion: 1, manuallyAdjustedSectionIds: ['A'] })[0].kind, /Ajustada manualmente$/)
  assert.match(toAcademicScheduleEvents({ ...proposal, sections: [{ ...proposal.sections[0], deliveryMode: 'split' }] })[0].kind,
    /Teoría 1 h 30 min \(90 min\).*Sesiones divididas/)
  assert.equal(proposal.assignments[0].endMinute - proposal.assignments[0].startMinute, 90)
})

test('contiguous components aggregate into complete blocks without joining gaps or days', () => {
  const assignments = [
    { ...proposal.assignments[0], sessionId: 'A1', startMinute: 480, endMinute: 720, sessionType: 'Teoría' },
    { ...proposal.assignments[0], sessionId: 'A2', startMinute: 720, endMinute: 840, sessionType: 'Práctica', roomName: 'Aula anexa' },
    { ...proposal.assignments[0], sessionId: 'A3', startMinute: 870, endMinute: 930, sessionType: 'Laboratorio' },
    { ...proposal.assignments[0], sessionId: 'A4', day: 2, startMinute: 480, endMinute: 600, sessionType: 'Teoría' },
  ]
  const value = { ...proposal, assignments, pending: [], counts: { sections: 1, requiredSessions: 4, scheduledSessions: 4 } }
  const blocks = aggregateAcademicBlocks(value)
  assert.equal(blocks.length, 3)
  assert.deepEqual(blocks[0], { sectionId: 'A', courseId: 'CS101', courseName: 'Curso sintético', teacherId: 'T1', teacherName: 'Docente sintético',
    day: 1, startMinute: 480, endMinute: 840, durationMinutes: 360, componentTypes: ['Teoría', 'Práctica'],
    componentDetails: [{ type: 'Teoría', durationMinutes: 240 }, { type: 'Práctica', durationMinutes: 120 }],
    roomNames: ['Aula sintética', 'Aula anexa'], sessionIds: ['A1', 'A2'], capacity: 20 })
  assert.equal(blocks[2].day, 2)
  assert.equal(toAcademicScheduleEvents(value).length, 3)
})

test('section coverage separates complete, partial and pending sections without changing proposal status', () => {
  const sections = [
    proposal.sections[0],
    { ...proposal.sections[0], sectionId: 'B' },
    { ...proposal.sections[0], sectionId: 'C' },
  ]
  const value = { ...proposal, sections, assignments: [{ ...proposal.assignments[0] }, { ...proposal.assignments[0], sessionId: 'C1', sectionId: 'C' }],
    pending: [
      { sessionId: 'A2', sectionId: 'A', courseId: 'CS101', durationMinutes: 60 },
      { sessionId: 'B1', sectionId: 'B', courseId: 'CS101', durationMinutes: 60 },
    ], counts: { sections: 3, requiredSessions: 4, scheduledSessions: 2 } }
  assert.deepEqual(academicSectionCoverage(value), { complete: 1, partial: 1, pending: 1 })
  assert.equal(value.status, 'complete')
})

test('approval, publication preview and history adapters validate local envelopes and CAS requests', async () => {
  const at = '2026-11-04T10:00:00.000Z'
  const review = { round: 1, submittedVersion: 1, submittedAt: at,
    teachers: [{ teacherId: 'T1', teacherName: 'Docente sintético', fingerprint: 'a'.repeat(64), status: 'conformity' as const,
      observation: '', decisionVersion: 1, decidedAt: at }],
    history: [
      { type: 'submitted' as const, version: 1, round: 1, at, teacherId: null, decision: null, observation: '', fingerprint: null },
      { type: 'decision' as const, version: 1, round: 1, at, teacherId: 'T1', decision: 'conformity' as const, observation: '', fingerprint: 'a'.repeat(64) },
    ] }
  const ready = { ...savedDraft, version: 1, state: 'ready-for-approval' as const, proposal, review }
  const approved = { ...ready, version: 2, state: 'approved' as const,
    approval: { sourceVersion: 1, approvedVersion: 2, approvedAt: at, fingerprint: 'b'.repeat(64) } }
  const published = { ...approved, version: 3, state: 'published' as const,
    publication: { publicationVersion: 7, publishedAt: at } }
  const schedule = { schoolId: 'SISTEMAS' as const, academicPeriod: '2027-I' as const,
    courses: [{ courseId: 'CS101', name: 'Curso sintético', cycle: 1, credits: 3 }],
    sections: proposal.sections, assignments: proposal.assignments }
  const publication = { revision: 'PA-PUBLICATION-1' as const, id: draftId, publicationVersion: 7, title: savedDraft.title,
    sourceProposalVersion: 1, approvedVersion: 2, approvedAt: at, publishedAt: at, schedule }
  const list = { currentId: draftId, items: [{ id: draftId, publicationVersion: 7, title: savedDraft.title,
    sourceProposalVersion: 1, approvedVersion: 2, approvedAt: at, publishedAt: at }] }
  const requests: Array<{ url: string; method: string; body: unknown }> = []
  const respond = (value: unknown, status = 200): typeof fetch => async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null })
    return new Response(JSON.stringify(value), { status })
  }

  const preview = { id: draftId, version: 1, title: savedDraft.title, state: 'ready-for-approval' as const, schedule }
  assert.deepEqual(await fetchAcademicReleasePreview(draftId, respond(preview)), preview)
  assert.equal(requests.at(-1)?.url, `${ACADEMIC_API}/borradores/${draftId}/vista-previa`)

  assert.deepEqual(await approveAcademicDraft(draftId, 1, respond({ draft: approved })), approved)
  assert.equal(requests.at(-1)?.url, `${ACADEMIC_API}/borradores/${draftId}/aprobar`)
  assert.deepEqual(requests.at(-1)?.body, { expectedVersion: 1 })
  await assert.rejects(approveAcademicDraft(draftId, 1, respond({ draft: { ...approved, version: 3 } })), /inválida|no corresponde/)

  assert.deepEqual(await publishAcademicDraft(draftId, { expectedVersion: 2, expectedCurrentId: null }, respond({ draft: published })), published)
  assert.equal(requests.at(-1)?.url, `${ACADEMIC_API}/borradores/${draftId}/publicar`)
  assert.deepEqual(requests.at(-1)?.body, { expectedVersion: 2, expectedCurrentId: null })
  await assert.rejects(publishAcademicDraft(draftId, { expectedVersion: 2, expectedCurrentId: null }, respond({ draft: approved })), /no corresponde/)

  const forked = { ...savedDraft, id: '123e4567-e89b-42d3-a456-426614174001',
    origin: { draftId, version: 3, publicationVersion: 7 } }
  assert.deepEqual(await forkAcademicDraft(draftId, 3, respond({ draft: forked })), forked)
  assert.deepEqual(requests.at(-1)?.body, { expectedVersion: 3 })
  await assert.rejects(forkAcademicDraft(draftId, 3, respond({ draft: { ...forked, id: draftId } })), /Origen circular|no corresponde/)

  assert.deepEqual(await fetchAcademicPublications(respond(list)), list)
  assert.deepEqual(await fetchAcademicPublication(draftId, respond(publication)), publication)
  assert.deepEqual(await fetchCurrentAcademicPublication(respond(publication)), publication)
  await assert.rejects(fetchAcademicPublication(draftId, respond({ ...publication, id: forked.id })), /no corresponde/)
  await assert.rejects(fetchAcademicPublications(respond({ ...list, currentId: null })), /Versión vigente/)
})

test('incomplete and invalid-input proposal states cross the data boundary without becoming complete', async () => {
  const request = { revision: ACADEMIC_REVISION, demands: [{ courseId: 'CS101', estimatedDemand: 18 }] }
  for (const status of ['impossible', 'search-limit'] as const) {
    const value = { ...proposal, status, coverageComplete: false, assignments: [],
      pending: [{ sessionId: 'CS101-L1', sectionId: 'A', courseId: 'CS101', durationMinutes: 90 }],
      counts: { sections: 1, requiredSessions: 1, scheduledSessions: 0 },
      stats: { ...proposal.stats, limitReason: status === 'search-limit' ? 'explorations' : null },
    }
    const fetchMock: typeof fetch = async () => new Response(JSON.stringify(value), { status: 200 })
    assert.equal((await createAcademicProposal(request, fetchMock)).status, status)
  }
  const invalid = { ...proposal, status: 'invalid-input', coverageComplete: false,
    sections: [], assignments: [], pending: [], counts: { sections: 0, requiredSessions: 0, scheduledSessions: 0 },
  }
  const fetchMock: typeof fetch = async () => new Response(JSON.stringify(invalid), { status: 200 })
  assert.equal((await createAcademicProposal(request, fetchMock)).status, 'invalid-input')
})

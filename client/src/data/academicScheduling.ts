import { ACADEMIC_API, ACADEMIC_REVISION, ACADEMIC_ROUTE, validateAcademicAdjustment, validateAcademicCatalog, validateAcademicDemandEstimate, validateAcademicDemandRequest, validateAcademicProposal, validateAcademicRequest, validateAcademicDraftList, validateAcademicDraftResume, validateAcademicDraftSaveRequest, validateAcademicSavedDraft, validateAcademicReviewSubmission, validateAcademicReviewDecision, validateAcademicPublicationRequest, validateAcademicReleasePreview, validateAcademicPublication, validateAcademicPublicationList } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicAdjustment, AcademicCatalog, AcademicDemandEstimate, AcademicDemandRequest, AcademicProposal, AcademicRequest, AcademicInterval, AcademicDraftList, AcademicDraftResume, AcademicDraftSaveRequest, AcademicSavedDraft, AcademicReviewSubmission, AcademicReviewDecision, AcademicReleasePreview, AcademicPublication, AcademicPublicationList, AcademicPublicationRequest } from '../../../shared/programacion-academica-api.mjs'
import { planningDefaults as getPlanningDefaults, PLANNING_LIMITS, syntheticTeachingMetadata, validatePlanningPolicy } from '../../../shared/academic-planning-policy.mjs'
import type { PlanningPeriod, PlanningPolicy } from '../../../shared/academic-planning-policy.mjs'

export type { AcademicCatalog, AcademicDemandEstimate, AcademicDemandRequest, AcademicProposal, AcademicRequest } from '../../../shared/programacion-academica-api.mjs'
export { PLANNING_LIMITS, syntheticTeachingMetadata }
export type { PlanningPeriod, PlanningPolicy }

export function normalizeAcademicSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
}

export function filterAcademicResources<T extends { id: string; name: string }>(resources: T[], query: string) {
  const normalized = normalizeAcademicSearch(query)
  if (!normalized) return resources
  return resources.filter((resource) => normalizeAcademicSearch(`${resource.name} ${resource.id}`).includes(normalized))
}

export function createAcademicPlanningDefaults(catalog: AcademicCatalog, period: PlanningPeriod) {
  const demands = Object.fromEntries(catalog.courses.map((course) => [course.courseId,
    String(course.cycle === undefined ? course.estimatedDemand : getPlanningDefaults(course.cycle, period).estimatedDemand)]))
  const capacities = Object.fromEntries(catalog.courses.map((course) => [course.courseId, '45']))
  const resources = {
    teachers: (catalog.referenceTeachers ?? []).map((teacher, index) => ({ ...teacher,
      maxWeeklyMinutes: 600, ...syntheticTeachingMetadata(index),
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })) })),
    rooms: (catalog.referenceRooms ?? []).map((room) => ({ id: room.id, name: room.name,
      capacity: room.capacity, kind: room.kind,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })) })),
  }
  return { demands, capacities, resources, planningPolicy: {
    revision: 'FISI-PLANNING-1' as const, period, allowAfternoon: false, allowSaturday: false,
  } }
}

export function buildAcademicPlanningRequest<T extends Omit<AcademicRequest, 'planningPolicy'>>(request: T,
  planningPolicy: PlanningPolicy): T & { planningPolicy: PlanningPolicy } {
  validatePlanningPolicy(planningPolicy)
  return { ...request, planningPolicy: { ...planningPolicy } }
}

type AcademicSchedulingFlags = { VITE_SUM_ACADEMIC_SCHEDULING?: string; VITE_SUM_SIMULATOR?: string }

export function isAcademicSchedulingEnabled(flags: AcademicSchedulingFlags = (import.meta as ImportMeta & { env?: AcademicSchedulingFlags }).env ?? {}) {
  return flags.VITE_SUM_ACADEMIC_SCHEDULING === '1'
    && flags.VITE_SUM_SIMULATOR !== '1'
}

export function isAcademicSchedulingRoute(pathname: string,
  flags: AcademicSchedulingFlags = (import.meta as ImportMeta & { env?: AcademicSchedulingFlags }).env ?? {}) {
  return (pathname === ACADEMIC_ROUTE || pathname === `${ACADEMIC_ROUTE}/`)
    && isAcademicSchedulingEnabled(flags)
}

export function isLocalAcademicArea(pathname: string,
  flags: AcademicSchedulingFlags = (import.meta as ImportMeta & { env?: AcademicSchedulingFlags }).env ?? {}) {
  if (!isAcademicSchedulingEnabled(flags)) return false
  return pathname === '/'
    || pathname === '/local/modulos'
    || pathname === '/local/modulos/'
    || pathname === ACADEMIC_ROUTE
    || pathname === `${ACADEMIC_ROUTE}/`
}

async function readJson(response: Response) {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (!response.ok) throw new Error(`El servicio local no está disponible (HTTP ${response.status}). Reintenta en unos segundos.`)
    throw new Error('La API local devolvió una respuesta que no es JSON válido.')
  }
  if (!response.ok) {
    const envelope = body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown> : null
    const error = envelope?.error && typeof envelope.error === 'object' && !Array.isArray(envelope.error)
      ? envelope.error as Record<string, unknown> : null
    if (!envelope || Object.keys(envelope).length !== 1 || !error || Object.keys(error).length !== 2
      || typeof error.code !== 'string' || !error.code || typeof error.message !== 'string' || !error.message) {
      throw new Error('La API local devolvió un error con formato inválido.')
    }
    throw new Error(error.message)
  }
  return body
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export async function fetchAcademicCatalog(fetchImpl: typeof fetch = globalThis.fetch, signal?: AbortSignal): Promise<AcademicCatalog> {
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/catalogo`, {
    headers: { Accept: 'application/json' }, credentials: 'omit', signal,
  }))
  validateAcademicCatalog(body)
  return body
}

export async function estimateAcademicDemand(request: Omit<AcademicDemandRequest, 'revision'>,
  fetchImpl: typeof fetch = globalThis.fetch, signal?: AbortSignal): Promise<AcademicDemandEstimate> {
  const body: AcademicDemandRequest = { revision: ACADEMIC_REVISION, ...request }
  validateAcademicDemandRequest(body)
  const estimate = await readJson(await fetchImpl(`${ACADEMIC_API}/demanda/estimar`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit', signal, body: JSON.stringify(body),
  }))
  validateAcademicDemandEstimate(estimate)
  if (estimate.source.id !== body.sourceId || estimate.source.targetPeriod !== body.targetPeriod
    || estimate.rows.length !== body.courses.length
    || body.courses.some((course) => !estimate.rows.some((row) => row.courseId === course.courseId
      && row.targetCapacity === course.targetCapacity))) {
    throw new Error('La estimación no corresponde a los cursos, la fuente o las capacidades solicitadas.')
  }
  return estimate
}

export function calculatePresentedSections(demand: string, capacity: string) {
  if (demand.trim() === '' || capacity.trim() === '') return null
  const demandValue = Number(demand)
  const capacityValue = Number(capacity)
  if (!Number.isSafeInteger(demandValue) || demandValue < 0 || !Number.isSafeInteger(capacityValue) || capacityValue < 1) return null
  return Math.ceil(demandValue / capacityValue)
}

export async function createAcademicProposal(request: AcademicRequest, fetchImpl: typeof fetch = globalThis.fetch,
  signal?: AbortSignal): Promise<AcademicProposal> {
  validateAcademicRequest(request)
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/propuestas`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit', signal, body: JSON.stringify(request),
  }))
  validateAcademicProposal(body)
  return body
}

export async function adjustAcademicProposal(proposalId: string, adjustment: AcademicAdjustment,
  fetchImpl: typeof fetch = globalThis.fetch, signal?: AbortSignal): Promise<AcademicProposal> {
  if (typeof proposalId !== 'string' || !proposalId || proposalId.trim() !== proposalId) throw new TypeError('Identificación de propuesta inválida.')
  validateAcademicAdjustment(adjustment)
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/propuestas/${encodeURIComponent(proposalId)}/ajustes`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit', signal, body: JSON.stringify(adjustment),
  }))
  validateAcademicProposal(body)
  return body
}

export async function fetchAcademicDrafts(fetchImpl: typeof fetch = globalThis.fetch, signal?: AbortSignal): Promise<AcademicDraftList> {
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/borradores`, {
    headers: { Accept: 'application/json' }, credentials: 'omit', signal,
  }))
  validateAcademicDraftList(body)
  return body
}

export async function saveAcademicDraft(request: AcademicDraftSaveRequest,
  fetchImpl: typeof fetch = globalThis.fetch, signal?: AbortSignal): Promise<AcademicSavedDraft> {
  validateAcademicDraftSaveRequest(request)
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/borradores/guardar`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit', signal, body: JSON.stringify(request),
  }))
  validateAcademicSavedDraft(body)
  if ((request.id !== null && (body.id !== request.id || body.version !== request.expectedVersion! + 1))
    || (request.id === null && body.version !== 1)
    || body.title !== request.title || (body.state !== request.state
      && !(body.review && ['in-review', 'ready-for-approval'].includes(body.state)))
    || canonicalJson(body.configuration) !== canonicalJson(request.configuration)
    || (request.proposalId === null ? body.proposal !== null
      : body.proposal?.proposalId !== request.proposalId || (body.proposal.editVersion ?? 0) !== request.proposalEditVersion)) {
    throw new Error('La propuesta guardada no corresponde a la versión solicitada.')
  }
  return body
}

function validateReviewDraftId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new TypeError('Identificación de propuesta inválida.')
}

async function postAcademicReview(path: string, request: AcademicReviewSubmission | AcademicReviewDecision,
  fetchImpl: typeof fetch, signal?: AbortSignal): Promise<AcademicSavedDraft> {
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}${path}`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit', signal, body: JSON.stringify(request),
  }))
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1
    || !('draft' in body)) throw new Error('La respuesta de revisión local tiene un formato inválido.')
  const draft = (body as { draft: unknown }).draft
  validateAcademicSavedDraft(draft)
  if (draft.id !== decodeURIComponent(path.split('/')[2] ?? '') || draft.version !== request.expectedVersion + 1) {
    throw new Error('La respuesta de revisión no corresponde a la versión solicitada.')
  }
  return draft
}

export function submitAcademicTeacherReview(id: string, request: AcademicReviewSubmission,
  fetchImpl: typeof fetch = globalThis.fetch, signal?: AbortSignal) {
  validateReviewDraftId(id)
  validateAcademicReviewSubmission(request)
  return postAcademicReview(`/borradores/${encodeURIComponent(id)}/revision/enviar`, request, fetchImpl, signal).then((draft) => {
    if (!draft.review || draft.review.submittedVersion !== draft.version) throw new Error('La revisión enviada no corresponde a la versión guardada.')
    return draft
  })
}

export function respondAcademicTeacherReview(id: string, request: AcademicReviewDecision,
  fetchImpl: typeof fetch = globalThis.fetch, signal?: AbortSignal) {
  validateReviewDraftId(id)
  validateAcademicReviewDecision(request)
  return postAcademicReview(`/borradores/${encodeURIComponent(id)}/revision/responder`, request, fetchImpl, signal).then((draft) => {
    const teacher = draft.review?.teachers.find((item) => item.teacherId === request.teacherId)
    const expectedStatus = request.decision === 'conformity' ? 'conformity' : 'changes-requested'
    if (draft.review?.round !== request.round || teacher?.status !== expectedStatus || teacher.decisionVersion !== draft.version) {
      throw new Error('La respuesta docente no corresponde a la ronda y versión solicitadas.')
    }
    return draft
  })
}

export async function resumeAcademicDraft(id: string, expectedVersion: number,
  fetchImpl: typeof fetch = globalThis.fetch, signal?: AbortSignal): Promise<AcademicDraftResume> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new TypeError('Identificación o versión de propuesta inválida.')
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/borradores/${encodeURIComponent(id)}/continuar`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit', signal, body: JSON.stringify({ expectedVersion }),
  }))
  validateAcademicDraftResume(body)
  if (body.draft.id !== id || body.draft.version !== expectedVersion) {
    throw new Error('La respuesta de recuperación no corresponde a la versión solicitada.')
  }
  return body
}

function validateSavedDraftEnvelope(body: unknown, id: string, version: number, state: AcademicSavedDraft['state']) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1
    || !('draft' in body)) throw new Error('La respuesta de publicación local tiene un formato inválido.')
  const draft = (body as { draft: unknown }).draft
  validateAcademicSavedDraft(draft)
  if (draft.id !== id || draft.version !== version || draft.state !== state) {
    throw new Error('La respuesta de publicación no corresponde a la versión solicitada.')
  }
  return draft
}

export async function fetchAcademicReleasePreview(id: string, fetchImpl: typeof fetch = globalThis.fetch,
  signal?: AbortSignal): Promise<AcademicReleasePreview> {
  validateReviewDraftId(id)
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/borradores/${encodeURIComponent(id)}/vista-previa`, {
    headers: { Accept: 'application/json' }, credentials: 'omit', signal,
  }))
  validateAcademicReleasePreview(body)
  if (body.id !== id) throw new Error('La vista previa no corresponde a la propuesta solicitada.')
  return body
}

export async function approveAcademicDraft(id: string, expectedVersion: number,
  fetchImpl: typeof fetch = globalThis.fetch, signal?: AbortSignal): Promise<AcademicSavedDraft> {
  validateReviewDraftId(id)
  const request = { expectedVersion }
  validateAcademicReviewSubmission(request)
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/borradores/${encodeURIComponent(id)}/aprobar`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit', signal, body: JSON.stringify(request),
  }))
  const draft = validateSavedDraftEnvelope(body, id, expectedVersion + 1, 'approved')
  if (!draft.approval || draft.approval.sourceVersion !== expectedVersion || draft.approval.approvedVersion !== draft.version) {
    throw new Error('La aprobación local no corresponde a la versión solicitada.')
  }
  return draft
}

export async function publishAcademicDraft(id: string, request: AcademicPublicationRequest,
  fetchImpl: typeof fetch = globalThis.fetch, signal?: AbortSignal): Promise<AcademicSavedDraft> {
  validateReviewDraftId(id)
  validateAcademicPublicationRequest(request)
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/borradores/${encodeURIComponent(id)}/publicar`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit', signal, body: JSON.stringify(request),
  }))
  const draft = validateSavedDraftEnvelope(body, id, request.expectedVersion + 1, 'published')
  if (!draft.approval || !draft.publication || draft.approval.approvedVersion !== request.expectedVersion
    || draft.publication.publicationVersion < 1) throw new Error('La publicación local no corresponde a la versión solicitada.')
  return draft
}

export async function forkAcademicDraft(id: string, expectedVersion: number,
  fetchImpl: typeof fetch = globalThis.fetch, signal?: AbortSignal): Promise<AcademicSavedDraft> {
  validateReviewDraftId(id)
  const request = { expectedVersion }
  validateAcademicReviewSubmission(request)
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/borradores/${encodeURIComponent(id)}/nuevo-borrador`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit', signal, body: JSON.stringify(request),
  }))
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1
    || !('draft' in body)) throw new Error('La respuesta del nuevo borrador local tiene un formato inválido.')
  const draft = (body as { draft: unknown }).draft
  validateAcademicSavedDraft(draft)
  if (draft.id === id || draft.version !== 1 || draft.state !== 'draft' || draft.origin?.draftId !== id) {
    throw new Error('El nuevo borrador local no corresponde al origen solicitado.')
  }
  return draft
}

export async function fetchAcademicPublications(fetchImpl: typeof fetch = globalThis.fetch,
  signal?: AbortSignal): Promise<AcademicPublicationList> {
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/publicaciones`, {
    headers: { Accept: 'application/json' }, credentials: 'omit', signal,
  }))
  validateAcademicPublicationList(body)
  return body
}

export async function fetchAcademicPublication(id: string, fetchImpl: typeof fetch = globalThis.fetch,
  signal?: AbortSignal): Promise<AcademicPublication> {
  validateReviewDraftId(id)
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/publicaciones/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' }, credentials: 'omit', signal,
  }))
  validateAcademicPublication(body)
  if (body.id !== id) throw new Error('La publicación local no corresponde a la versión solicitada.')
  return body
}

export async function fetchCurrentAcademicPublication(fetchImpl: typeof fetch = globalThis.fetch,
  signal?: AbortSignal): Promise<AcademicPublication> {
  const body = await readJson(await fetchImpl(`${ACADEMIC_API}/publicaciones/vigente`, {
    headers: { Accept: 'application/json' }, credentials: 'omit', signal,
  }))
  validateAcademicPublication(body)
  return body
}

const dayNames = ['—', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function formatAcademicMinute(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function formatAcademicDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  const human = hours ? `${hours} h${remainder ? ` ${remainder} min` : ''}` : `${remainder} min`
  return `${human} (${minutes} min)`
}

export function formatAcademicInterval(interval: AcademicInterval) {
  return `${dayNames[interval.day]} ${formatAcademicMinute(interval.startMinute)}–${formatAcademicMinute(interval.endMinute)}`
}

export function academicSectionLabel(proposal: Pick<AcademicProposal, 'sections'>, sectionId: string) {
  const section = proposal.sections.find((item) => item.sectionId === sectionId)
  if (!section) return 'No determinada'
  return String(proposal.sections.filter((item) => item.courseId === section.courseId)
    .findIndex((item) => item.sectionId === sectionId) + 1)
}

export function academicSessionLabel(proposal: AcademicProposal, sessionId: string) {
  const session = [...proposal.assignments, ...proposal.pending].find((item) => item.sessionId === sessionId)
  if (!session) return 'Sesión no determinada'
  const name = proposal.sections.find((item) => item.sectionId === session.sectionId)?.courseName ?? session.courseId
  return `${name}, sección ${academicSectionLabel(proposal, session.sectionId)}`
}

export function toAcademicScheduleEvents(proposal: AcademicProposal) {
  const sections = new Map(proposal.sections.map((section) => [section.sectionId, section]))
  return aggregateAcademicBlocks(proposal).map((block) => ({
    day: block.day,
    start: block.startMinute,
    end: block.endMinute,
    course: block.courseName,
    section: academicSectionLabel(proposal, block.sectionId),
    kind: `${block.teacherName} · ${block.roomNames.join(', ')} · ${formatAcademicDuration(block.durationMinutes)} · ${block.componentDetails.map((component) => `${component.type} ${formatAcademicDuration(component.durationMinutes)}`).join(' + ')} · ${sections.get(block.sectionId)?.deliveryMode === 'split' ? 'Sesiones divididas' : 'Bloque continuo'} · ${proposal.manuallyAdjustedSectionIds?.includes(block.sectionId) ? 'Ajustada manualmente' : 'Automática'}`,
    time: `${formatAcademicMinute(block.startMinute)}-${formatAcademicMinute(block.endMinute)}`,
    capacity: block.capacity,
  }))
}

export function aggregateAcademicBlocks(proposal: Pick<AcademicProposal, 'sections' | 'assignments'>) {
  const sections = new Map(proposal.sections.map((section) => [section.sectionId, section]))
  const sorted = [...proposal.assignments].sort((left, right) => left.sectionId.localeCompare(right.sectionId)
    || left.teacherId.localeCompare(right.teacherId) || left.day - right.day || left.startMinute - right.startMinute
    || left.endMinute - right.endMinute || left.sessionId.localeCompare(right.sessionId))
  const blocks: Array<{ sectionId: string; courseId: string; courseName: string; teacherId: string; teacherName: string; day: number;
    startMinute: number; endMinute: number; durationMinutes: number; componentTypes: string[]; componentDetails: Array<{ type: string; durationMinutes: number }>;
    roomNames: string[]; sessionIds: string[]; capacity: number | null }> = []
  for (const assignment of sorted) {
    const previous = blocks[blocks.length - 1]
    if (previous && previous.sectionId === assignment.sectionId && previous.teacherId === assignment.teacherId
      && previous.day === assignment.day && previous.endMinute === assignment.startMinute) {
      previous.endMinute = assignment.endMinute
      previous.durationMinutes += assignment.endMinute - assignment.startMinute
      previous.componentTypes.push(assignment.sessionType ?? 'Sesión')
      previous.componentDetails.push({ type: assignment.sessionType ?? 'Sesión', durationMinutes: assignment.endMinute - assignment.startMinute })
      if (!previous.roomNames.includes(assignment.roomName)) previous.roomNames.push(assignment.roomName)
      previous.sessionIds.push(assignment.sessionId)
    } else {
      blocks.push({ sectionId: assignment.sectionId, courseId: assignment.courseId, courseName: assignment.courseName,
        teacherId: assignment.teacherId, teacherName: assignment.teacherName, day: assignment.day,
        startMinute: assignment.startMinute, endMinute: assignment.endMinute,
        durationMinutes: assignment.endMinute - assignment.startMinute, componentTypes: [assignment.sessionType ?? 'Sesión'],
        componentDetails: [{ type: assignment.sessionType ?? 'Sesión', durationMinutes: assignment.endMinute - assignment.startMinute }],
        roomNames: [assignment.roomName], sessionIds: [assignment.sessionId], capacity: sections.get(assignment.sectionId)?.capacity ?? null })
    }
  }
  return blocks
}

export function academicSectionCoverage(proposal: AcademicProposal) {
  return proposal.sections.reduce((counts, section) => {
    const assigned = proposal.assignments.filter((assignment) => assignment.sectionId === section.sectionId).length
    const pending = proposal.pending.filter((assignment) => assignment.sectionId === section.sectionId).length
    if (!pending && assigned) counts.complete += 1
    else if (assigned) counts.partial += 1
    else counts.pending += 1
    return counts
  }, { complete: 0, partial: 0, pending: 0 })
}


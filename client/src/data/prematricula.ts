import { E2_API, validateE2Context, validateE2ContextRequest, validateE2PublicationRequest, validateE2PublicationResponse, validateE2SaveRequest, validateE2SaveResponse, validateE2ValidateRequest, validateE2Validation } from '../../../shared/prematricula-api.mjs'
import type { E2Context, E2Identity, E2PublicationResponse, E2SaveResponse, E2ValidateRequest, E2Validation, E2Choice } from '../../../shared/prematricula-api.mjs'
import { academicSectionLabel, aggregateAcademicBlocks } from './academicScheduling.ts'

async function post<T>(path: string, body: unknown, validate: (value: unknown) => asserts value is T,
  fetchImpl: typeof fetch, signal?: AbortSignal): Promise<T> {
  const response = await fetchImpl(`${E2_API}${path}`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit', body: JSON.stringify(body), signal })
  let value: unknown
  try { value = await response.json() } catch { throw new Error('La API local de prematrícula devolvió una respuesta inválida.') }
  if (!response.ok) {
    const envelope = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
    const problem = envelope?.error && typeof envelope.error === 'object' && !Array.isArray(envelope.error)
      ? envelope.error as Record<string, unknown> : null
    if (!envelope || Object.keys(envelope).length !== 1 || !problem || Object.keys(problem).length !== 2
      || typeof problem.code !== 'string' || typeof problem.message !== 'string') {
      throw new Error('La API local de prematrícula devolvió un error con formato inválido.')
    }
    throw Object.assign(new Error(problem.message), { code: problem.code, status: response.status })
  }
  validate(value)
  return value
}

export function fetchPreEnrollmentContext(identity: E2Identity, fetchImpl: typeof fetch = fetch, signal?: AbortSignal) {
  const request = { identity }
  validateE2ContextRequest(request)
  return post<E2Context>('/contexto', request, validateE2Context, fetchImpl, signal).then((value) => {
    if (value.actorId !== identity.actorId) throw new Error('El contexto pertenece a otro perfil local.')
    return value
  })
}

export async function fetchPreEnrollmentPublication(identity: E2Identity, publicationId: string,
  academicRevision: string, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<E2PublicationResponse> {
  const request = { identity, publicationId }
  validateE2PublicationRequest(request)
  const response = await post<E2PublicationResponse>('/publicacion', request, validateE2PublicationResponse, fetchImpl, signal)
  if (response.actorId !== identity.actorId || response.academicRevision !== academicRevision || response.publication.id !== publicationId) throw new Error('La publicación no corresponde al perfil, identidad de publicación y revisión académica actuales.')
  return response
}

export function validatePreEnrollment(identity: E2Identity, request: Omit<E2ValidateRequest, 'identity'>,
  expectedAcademicRevision: string, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<E2Validation> {
  const body = { identity, ...request }
  validateE2ValidateRequest(body)
  return post<E2Validation>('/validar', body, validateE2Validation, fetchImpl, signal).then((value) => {
    if (value.actorId !== identity.actorId || value.publicationId !== request.publicationId
      || value.publicationVersion !== request.publicationVersion
      || value.academicRevision !== expectedAcademicRevision
      || canonicalSelection(value.selection) !== canonicalSelection(request.selection)) throw new Error('La validación no corresponde al perfil y selección actuales.')
    return value
  })
}

export async function savePreEnrollment(identity: E2Identity, request: Omit<E2ValidateRequest, 'identity'> & {
  id: string | null; expectedVersion: number | null; expectedAcademicRevision: string
}, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<E2SaveResponse> {
  const body = { identity, ...request }
  validateE2SaveRequest(body)
  const value = await post<E2SaveResponse>('/guardar', body, validateE2SaveResponse, fetchImpl, signal)
  if (value.draft.actorId !== identity.actorId || value.draft.publicationId !== request.publicationId
    || value.draft.publicationVersion !== request.publicationVersion
    || value.draft.academicRevision !== request.expectedAcademicRevision
    || (request.id !== null && value.draft.id !== request.id)
    || value.draft.version !== (request.expectedVersion === null ? 1 : request.expectedVersion + 1)
    || canonicalSelection(value.draft.selection) !== canonicalSelection(request.selection)
    || value.validation.academicRevision !== request.expectedAcademicRevision) throw new Error('El borrador guardado no corresponde al perfil, revisión y selección actuales.')
  return value
}

function canonicalSelection(selection: readonly E2Choice[]) {
  return JSON.stringify(selection.map(({ courseId, sectionId }) => ({ courseId, sectionId }))
    .sort((left, right) => left.courseId.localeCompare(right.courseId) || left.sectionId.localeCompare(right.sectionId)))
}

export function buildPreEnrollmentSchedule(publication: E2PublicationResponse, selection: readonly E2Choice[]) {
  const chosen = new Map(selection.map((choice) => [choice.courseId, choice.sectionId]))
  const courseNames = new Map(publication.publication.schedule.courses.map((course) => [course.courseId, course.name]))
  const blocks = aggregateAcademicBlocks({ sections: publication.publication.schedule.sections.filter((section) => chosen.get(section.courseId) === section.sectionId),
    assignments: publication.publication.schedule.assignments.filter((assignment) => chosen.get(assignment.courseId) === assignment.sectionId) })
  return blocks.map((block) => ({ day: block.day, start: block.startMinute, end: block.endMinute,
    course: courseNames.get(block.courseId) ?? block.courseName,
    section: academicSectionLabel({ sections: publication.publication.schedule.sections }, block.sectionId),
    kind: `${block.teacherName} · ${block.roomNames.join(', ')}`, time: `${String(Math.floor(block.startMinute / 60)).padStart(2, '0')}:${String(block.startMinute % 60).padStart(2, '0')}-${String(Math.floor(block.endMinute / 60)).padStart(2, '0')}:${String(block.endMinute % 60).padStart(2, '0')}` }))
}

export type { E2Choice, E2Context, E2Identity, E2PublicationResponse, E2SaveResponse, E2Validation }

import { E2_API, validateE2ContextRequest } from '../../../shared/prematricula-api.mjs'
import type { E2Identity } from '../../../shared/prematricula-api.mjs'
import { validateE2IntentionContext, validateE2Demand, validateE2RegisterIntentionRequest, validateE2DemandRequest } from '../../../shared/prematricula-intention.mjs'
import type { E2Demand, E2DemandRequest, E2IntentionContext, E2RegisterIntentionRequest } from '../../../shared/prematricula-intention.mjs'
import { validateE3IntentionImport } from '../../../shared/matricula-intention-import.mjs'
import type { E3IntentionImport } from '../../../shared/matricula-intention-import.mjs'

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
      || typeof problem.code !== 'string' || typeof problem.message !== 'string') throw new Error('La API local de prematrícula devolvió un error con formato inválido.')
    throw Object.assign(new Error(problem.message), { code: problem.code, status: response.status })
  }
  validate(value)
  return value
}

export async function fetchIntentionContext(identity: E2Identity, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<E2IntentionContext> {
  const request = { identity }
  validateE2ContextRequest(request)
  const value = await post<E2IntentionContext>('/intencion/contexto', request, validateE2IntentionContext, fetchImpl, signal)
  if (value.actorId !== identity.actorId) throw new Error('El contexto de intención pertenece a otro perfil local.')
  return value
}

export async function registerIntention(identity: E2Identity, request: Omit<E2RegisterIntentionRequest, 'identity'>,
  fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<E2IntentionContext> {
  const body: E2RegisterIntentionRequest = { identity, ...request }
  validateE2RegisterIntentionRequest(body)
  const value = await post<E2IntentionContext>('/intencion/registrar', body, validateE2IntentionContext, fetchImpl, signal)
  const latest = value.intention?.history.at(-1)
  if (value.actorId !== identity.actorId || value.draftId !== request.draftId || value.draftVersion !== request.expectedDraftVersion
    || value.academicRevision !== request.expectedAcademicRevision || value.intention?.draftId !== request.draftId
    || value.intention.version !== (request.expectedIntentionVersion === null ? 1 : request.expectedIntentionVersion + 1)
    || latest?.draftVersion !== request.expectedDraftVersion || latest.academicRevision !== request.expectedAcademicRevision
    || value.validation?.status !== 'valid') {
    throw new Error('La intención registrada no corresponde al perfil y borrador guardado actuales.')
  }
  return value
}

export async function fetchIntentionDemand(request: E2DemandRequest, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<E2Demand> {
  validateE2DemandRequest(request)
  const value = await post<E2Demand>('/demanda', request, validateE2Demand, fetchImpl, signal)
  if (value.publicationId !== request.publicationId || value.publicationVersion !== request.publicationVersion) {
    throw new Error('La demanda agregada no corresponde a la publicación seleccionada.')
  }
  return value
}

export async function fetchIntentionImport(identity: E2Identity, fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal): Promise<E3IntentionImport> {
  const request = { identity }
  validateE2ContextRequest(request)
  const value = await post<E3IntentionImport>('/intencion/traslado', request, validateE3IntentionImport, fetchImpl, signal)
  if (value.runId !== identity.runId || value.actorId !== identity.actorId) {
    throw new Error('La intención trasladada no corresponde al perfil local activo.')
  }
  return value
}

export type { E2Demand, E2DemandRequest, E2IntentionContext, E2RegisterIntentionRequest, E3IntentionImport }

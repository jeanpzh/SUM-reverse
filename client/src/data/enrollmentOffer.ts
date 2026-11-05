import { OFFER_API, validateOfferActivationRequest, validateOfferActivationResponse, validateOperationalOfferCatalog } from '../../../shared/enrollment-offer.mjs'
import { validateSessionId } from '../../../shared/matricula-regular.mjs'
import type { OfferActivationRequest, OfferActivationResponse, OperationalOfferCatalog } from '../../../shared/enrollment-offer.mjs'

export class EnrollmentOfferApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'EnrollmentOfferApiError'
    this.status = status
    this.code = code
  }
}

export function parseOperationalRunId(value: unknown) {
  if (value === undefined) return { runId: null, invalid: false }
  try {
    validateSessionId(value)
    return { runId: value, invalid: false }
  } catch {
    return { runId: null, invalid: true }
  }
}

async function readJson(response: Response): Promise<unknown> {
  if (!/application\/(?:[\w.-]+\+)?json/i.test(response.headers.get('content-type') ?? '')) {
    throw new Error('La API local de ofertas no devolvió JSON.')
  }
  try {
    return await response.json() as unknown
  } catch {
    throw new Error('La API local de ofertas devolvió JSON inválido.')
  }
}

function throwApiError(value: unknown, status: number): never {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1
    || !('error' in value) || !value.error || typeof value.error !== 'object' || Array.isArray(value.error)) {
    throw new Error('La API local de ofertas devolvió un error con formato inválido.')
  }
  const error = value.error as Record<string, unknown>
  if (Object.keys(error).length !== 2 || typeof error.code !== 'string' || !error.code
    || typeof error.message !== 'string' || !error.message) {
    throw new Error('La API local de ofertas devolvió un error con formato inválido.')
  }
  throw new EnrollmentOfferApiError(status, error.code, error.message)
}

export async function fetchOperationalOffers(fetchImpl: typeof fetch = globalThis.fetch): Promise<OperationalOfferCatalog> {
  const response = await fetchImpl(OFFER_API, { headers: { Accept: 'application/json' }, credentials: 'omit' })
  const body = await readJson(response)
  if (!response.ok) throwApiError(body, response.status)
  validateOperationalOfferCatalog(body)
  return body
}

export async function activateEnrollmentOffer(request: OfferActivationRequest,
  fetchImpl: typeof fetch = globalThis.fetch): Promise<OfferActivationResponse> {
  validateOfferActivationRequest(request)
  const response = await fetchImpl(`${OFFER_API}/activar`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit', body: JSON.stringify(request),
  })
  const body = await readJson(response)
  if (!response.ok) throwApiError(body, response.status)
  validateOfferActivationResponse(body)
  if (body.offer.publicationId !== request.publicationId || body.offer.publicationVersion !== request.publicationVersion) {
    throw new Error('La oferta activada no corresponde a la publicación y versión solicitadas.')
  }
  return body
}

export type { OfferActivationRequest, OfferActivationResponse, OperationalOffer, OperationalOfferCatalog } from '../../../shared/enrollment-offer.mjs'

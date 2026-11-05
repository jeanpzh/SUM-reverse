// Local synthetic publication-to-enrollment bridge. Reuses MR identities and envelopes.
import { validateSessionId } from './matricula-regular.mjs'
export const OFFER_API = '/api/local/matricula-regular/v1/ofertas'
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || keys.some((key) => !Object.hasOwn(value, key)) || Object.keys(value).some((key) => !keys.includes(key))) throw new TypeError('Oferta: campos inválidos')
}
function positive(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Oferta: entero positivo requerido')
}
function date(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new TypeError('Oferta: fecha UTC inválida')
}
export function validateOfferActivationRequest(value) {
  object(value, ['publicationId', 'publicationVersion', 'expectedActiveRunId'])
  validateSessionId(value.publicationId)
  positive(value.publicationVersion)
  if (value.expectedActiveRunId !== null) validateSessionId(value.expectedActiveRunId)
}
export function validateOperationalOffer(value) {
  object(value, ['runId', 'publicationId', 'publicationVersion', 'offerVersion', 'academicPeriod', 'schoolId', 'planId', 'activatedAt', 'clockBase', 'courseCount', 'sectionCount'])
  validateSessionId(value.runId)
  validateSessionId(value.publicationId)
  for (const key of ['publicationVersion', 'offerVersion', 'courseCount', 'sectionCount']) positive(value[key])
  if (value.academicPeriod !== '2027-I' || value.schoolId !== 'SISTEMAS' || value.planId !== 'SYN-SIS-PLAN') throw new TypeError('Ámbito operativo no admitido')
  date(value.activatedAt)
  date(value.clockBase)
}
export function validateOfferActivationResponse(value) {
  object(value, ['offer', 'reused'])
  validateOperationalOffer(value.offer)
  if (typeof value.reused !== 'boolean') throw new TypeError('Resultado de activación inválido')
}
export function validateOperationalOfferCatalog(value) {
  object(value, ['activeRunId', 'items'])
  if (!Array.isArray(value.items) || value.items.length > 50) throw new TypeError('Catálogo operativo inválido')
  const ids = new Set()
  const origins = new Set()
  const versions = new Set()
  for (const item of value.items) {
    validateOperationalOffer(item)
    const origin = `${item.publicationId}:${item.publicationVersion}`
    if (ids.has(item.runId) || origins.has(origin) || versions.has(item.offerVersion)) throw new TypeError('Oferta operativa duplicada')
    ids.add(item.runId); origins.add(origin); versions.add(item.offerVersion)
  }
  if (value.activeRunId !== null) validateSessionId(value.activeRunId)
  if ((value.items.length === 0) !== (value.activeRunId === null)
    || (value.activeRunId !== null && !ids.has(value.activeRunId))) throw new TypeError('Oferta activa no corresponde al catálogo')
}

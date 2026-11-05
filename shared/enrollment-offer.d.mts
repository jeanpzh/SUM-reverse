export const OFFER_API: '/api/local/matricula-regular/v1/ofertas'
export type OfferActivationRequest = { publicationId: string; publicationVersion: number; expectedActiveRunId: string | null }
export type OperationalOffer = { runId: string; publicationId: string; publicationVersion: number; offerVersion: number; academicPeriod: '2027-I'; schoolId: 'SISTEMAS'; planId: 'SYN-SIS-PLAN'; activatedAt: string; clockBase: string; courseCount: number; sectionCount: number }
export type OfferActivationResponse = { offer: OperationalOffer; reused: boolean }
export type OperationalOfferCatalog = { activeRunId: string | null; items: OperationalOffer[] }
export function validateOfferActivationRequest(value: unknown): asserts value is OfferActivationRequest
export function validateOperationalOffer(value: unknown): asserts value is OperationalOffer
export function validateOfferActivationResponse(value: unknown): asserts value is OfferActivationResponse
export function validateOperationalOfferCatalog(value: unknown): asserts value is OperationalOfferCatalog

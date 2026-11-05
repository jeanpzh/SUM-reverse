import type { Identity } from './local-profile-dashboard.mjs'
import type { AcademicPublication, AcademicPublicationList } from './programacion-academica-api.mjs'
export const E2_API: '/api/local/prematricula/v1'
export const E2_REVISION: 'E2-LOCAL-1'
export type E2Identity = Identity & { actorId: 'SYN-SIS-A' | 'SYN-SIS-B' }
export type E2Choice = { courseId: string; sectionId: string }
export type E2Issue = { kind: 'unmet' | 'insufficient' | 'incomplete'; code: string; message: string; courseIds: string[]; sectionIds: string[] }
export type E2Validation = { actorId: E2Identity['actorId']; publicationId: string; publicationVersion: number; academicRevision: string; selection: E2Choice[]; credits: number; courseCount: number; status: 'valid' | 'unmet' | 'insufficient' | 'incomplete'; issues: E2Issue[] }
export type E2Draft = { revision: 'E2-LOCAL-1'; id: string; version: number; actorId: E2Identity['actorId']; sourceId: 'regular-SISTEMAS-v1'; schoolId: 'SISTEMAS'; planId: 'SYN-SIS-PLAN'; academicPeriod: '2027-I'; publicationId: string; publicationVersion: number; academicRevision: string; selection: E2Choice[]; createdAt: string; updatedAt: string }
export type E2Context = { revision: 'E2-LOCAL-1'; actorId: E2Identity['actorId']; sourceId: 'regular-SISTEMAS-v1'; schoolId: 'SISTEMAS'; planId: 'SYN-SIS-PLAN'; academicPeriod: '2027-I'; academicRevision: string; publications: AcademicPublicationList; draft: E2Draft | null; draftValidation: E2Validation | null }
export type E2ContextRequest = { identity: E2Identity }
export type E2PublicationRequest = E2ContextRequest & { publicationId: string }
export type E2PublicationResponse = { actorId: E2Identity['actorId']; academicRevision: string; publication: AcademicPublication; eligibility: Array<{ courseId: string; issues: E2Issue[] }> }
export type E2ValidateRequest = E2ContextRequest & { publicationId: string; publicationVersion: number; selection: E2Choice[] }
export type E2SaveRequest = E2ValidateRequest & { id: string | null; expectedVersion: number | null; expectedAcademicRevision: string }
export type E2SaveResponse = { draft: E2Draft; validation: E2Validation }
export function validateE2ContextRequest(value: unknown): asserts value is E2ContextRequest
export function validateE2PublicationRequest(value: unknown): asserts value is E2PublicationRequest
export function validateE2ValidateRequest(value: unknown): asserts value is E2ValidateRequest
export function validateE2SaveRequest(value: unknown): asserts value is E2SaveRequest
export function validateE2Draft(value: unknown): asserts value is E2Draft
export function validateE2Validation(value: unknown): asserts value is E2Validation
export function validateE2Context(value: unknown): asserts value is E2Context
export function validateE2PublicationResponse(value: unknown): asserts value is E2PublicationResponse
export function validateE2SaveResponse(value: unknown): asserts value is E2SaveResponse

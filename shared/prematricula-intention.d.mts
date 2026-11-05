import type { E2Choice, E2Identity, E2Validation } from './prematricula-api.mjs'
export const E2_INTENTION_REVISION: 'E2-INTENT-1'
export type E2IntentionRecord = { version: number; draftVersion: number; publicationId: string; publicationVersion: number; academicRevision: string; selection: E2Choice[]; registeredAt: string }
export type E2Intention = { revision: 'E2-INTENT-1'; draftId: string; actorId: E2Identity['actorId']; sourceId: 'regular-SISTEMAS-v1'; schoolId: 'SISTEMAS'; planId: 'SYN-SIS-PLAN'; academicPeriod: '2027-I'; version: number; history: E2IntentionRecord[] }
export type E2IntentionContext = { revision: 'E2-INTENT-1'; actorId: E2Identity['actorId']; academicRevision: string; draftId: string | null; draftVersion: number | null; intention: E2Intention | null; validation: E2Validation | null }
export type E2RegisterIntentionRequest = { identity: E2Identity; draftId: string; expectedDraftVersion: number; expectedIntentionVersion: number | null; expectedAcademicRevision: string }
export type E2DemandRequest = { publicationId: string; publicationVersion: number }
export type E2Demand = { revision: 'E2-DEMAND-1'; schoolId: 'SISTEMAS'; academicPeriod: '2027-I'; publicationId: string; publicationVersion: number; registeredStudents: number; countedStudents: number; excludedStudents: number; courses: Array<{ courseId: string; name: string; students: number; sections: Array<{ sectionId: string; capacity: number; students: number }> }> }
export function validateE2Intention(value: unknown): asserts value is E2Intention
export function validateE2IntentionContext(value: unknown): asserts value is E2IntentionContext
export function validateE2RegisterIntentionRequest(value: unknown): asserts value is E2RegisterIntentionRequest
export function validateE2DemandRequest(value: unknown): asserts value is E2DemandRequest
export function validateE2Demand(value: unknown): asserts value is E2Demand
export { validateE2ContextRequest } from './prematricula-api.mjs'

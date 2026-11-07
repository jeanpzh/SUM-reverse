import type { E2Demand } from './prematricula-intention.mjs'

export const READJUSTMENT_REVISION: 'PA-READJUST-1'
export const READJUSTMENT_MAX_ACCEPTED_ACTIONS: 64
export const READJUSTMENT_MAX_SECTION_CAPACITY: 1000
export const READJUSTMENT_KEEP_REASONS: readonly ['LABORATORY_SECTION', 'ROOM_AT_CAPACITY', 'ROOM_KIND_UNKNOWN']

export type ReadjustmentKeepReason = 'LABORATORY_SECTION' | 'ROOM_AT_CAPACITY' | 'ROOM_KIND_UNKNOWN'
export type ReadjustmentAction =
  | { id: string; type: 'open-section'; courseId: string; demand: number; capacity: number; targetCapacity: number; count: number; ordinals: number[]; reason: 'COURSE_DEMAND_EXCEEDS_CAPACITY' }
  | { id: string; type: 'widen-cap'; courseId: string; sectionId: string; demand: number; capacity: number; newCapacity: number; remainingExcess: number; reason: 'SECTION_DEMAND_EXCEEDS_CAP' }
  | { id: string; type: 'keep'; courseId: string; sectionId: string; demand: number; capacity: number; reason: ReadjustmentKeepReason }
export type AcademicReadjustmentProposal = {
  revision: 'PA-READJUST-1'
  publicationId: string
  publicationVersion: number
  basisFingerprint: string
  status: 'actions' | 'no-change'
  demand: { counted: number; excluded: number }
  actions: ReadjustmentAction[]
}
export type AcademicReadjustmentAcceptRequest = { expectedCurrentId: string; expectedBasisFingerprint: string; acceptedActionIds: string[]; title?: string }
export type AcademicReadjustmentRecord = {
  revision: 'PA-READJUST-1'
  basisFingerprint: string
  publicationId: string
  publicationVersion: number
  acceptedActions: Array<{ id: string; type: 'open-section' | 'widen-cap'; courseId: string; sectionId?: string; count?: number; newCapacity?: number }>
  createdAt: string
}
export type ReadjustmentRoom = { kind: 'classroom' | 'laboratory' | null; capacity: number }
export type ReadjustmentCourseStructure = {
  courseId: string
  targetCapacity: number
  sections: Array<{ sectionId: string; capacity: number; rooms: ReadjustmentRoom[] }>
}
export type ReadjustmentInput = {
  publicationId: string
  publicationVersion: number
  basisFingerprint: string
  demand: E2Demand
  courses: ReadjustmentCourseStructure[]
}

export function readjustmentSectionId(courseId: string, ordinal: number): string
export function parseReadjustmentSectionId(sectionId: unknown): { courseId: string; ordinal: number } | null
export function canonicalReadjustmentBasis(basis: { publicationId: string; publicationVersion: number; demand: E2Demand }): string
export function proposeReadjustment(input: ReadjustmentInput): AcademicReadjustmentProposal
export function readjustedEstimatedDemand(input: { demand: number; sectionCount: number; count: number; targetCapacity: number }): number
export function resolveAcceptedReadjustmentActions(proposal: AcademicReadjustmentProposal, ids: string[]): { ok: boolean; invalidIds: string[]; actions: ReadjustmentAction[] }
export function validateReadjustmentProposalRequest(value: unknown): asserts value is Record<string, never>
export function validateReadjustmentAcceptRequest(value: unknown): asserts value is AcademicReadjustmentAcceptRequest
export function validateReadjustmentProposal(value: unknown): asserts value is AcademicReadjustmentProposal
export function validateAcademicReadjustmentRecord(value: unknown): asserts value is AcademicReadjustmentRecord

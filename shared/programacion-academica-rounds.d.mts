import type { PlanningPeriod } from './academic-planning-policy.mjs'
import type { AcademicInterval, AcademicTeacherResource, AcademicTeacherReview } from './programacion-academica-api.mjs'

export const ROUNDS_REVISION: 'PA-ROUNDS-1'
export const ROUND_PROFILE_REVISION: 'PA-ROUNDS-PROFILE-1'
export const ROUND_RECORD_LIMIT: 200
export const ROUND_OBJECTION_KINDS: readonly ['franja-no-disponible', 'exceso-de-carga', 'aula-inadecuada', 'otra']
export const ROUND_OBJECTION_STATUSES: readonly ['proposed', 'confirmed', 'rejected', 'applied', 'recorded', 'superseded']

// Same shape as `Source` in backend/src/matricula-regular/profile.types.ts.
export type AcademicRoundSource = {
  id: string
  origin: 'evidence' | 'local-decision'
  class: 'normative' | 'observed' | 'testimony' | 'inferred' | null
  reference: string
  date: string
  status: 'documented' | 'reported' | 'unverified' | 'local-only'
}
export type AcademicRoundProfile = {
  revision: 'PA-ROUNDS-PROFILE-1'
  profileId: string
  scope: { facultyId: 'FISI'; schoolId: 'SISTEMAS'; academicPeriod: PlanningPeriod }
  maxRounds: { value: number; sourceIds: string[] }
  deadline: { mode: 'school-entered'; required: boolean; sourceIds: string[] }
  sources: AcademicRoundSource[]
}
export type AcademicRoundObjectionInput =
  | { kind: 'franja-no-disponible'; sectionIds: string[]; intervals: AcademicInterval[] }
  | { kind: 'exceso-de-carga'; sectionIds: string[]; limit: { maxWeeklyMinutes: number } | { courseId: string; maxSections: number } }
  | { kind: 'aula-inadecuada'; sectionIds: string[]; roomIds: string[] }
  | { kind: 'otra'; sectionIds: string[] }
export type AcademicRoundOperation =
  | { type: 'remove-teacher-availability'; teacherId: string; intervals: AcademicInterval[] }
  | { type: 'limit-teacher-load'; teacherId: string; maxWeeklyMinutes: number }
  | { type: 'limit-teacher-sections'; teacherId: string; courseId: string; maxSections: number }
  | { type: 'exclude-section-rooms'; sectionIds: string[]; roomIds: string[] }
  | { type: 'manual' }
export type AcademicRoundObjectionStatus = 'proposed' | 'confirmed' | 'rejected' | 'applied' | 'recorded' | 'superseded'
export type AcademicRoundObjection = AcademicRoundObjectionInput & {
  id: string
  round: number
  teacherId: string
  fingerprint: string
  decisionVersion: number
  operation: AcademicRoundOperation
  status: AcademicRoundObjectionStatus
  decidedVersion: number | null
  decidedAt: string | null
  reason: string
  appliedVersion: number | null
}
export type AcademicRoundControl = {
  revision: 'PA-ROUNDS-1'
  profile: AcademicRoundProfile
  legacyRounds: number
  rounds: Array<{ round: number; submittedVersion: number; deadline: string | null }>
  objections: AcademicRoundObjection[]
  regenerations: Array<{ version: number; at: string; fixedSectionIds: string[]; regeneratedSectionIds: string[]; appliedObjectionIds: string[] }>
  resolutions: Array<{ teacherId: string; fingerprint: string; version: number; at: string; reason: string }>
}
export type AcademicRoundSubmission = { expectedVersion: number; deadline?: string }
export type AcademicRoundReviewDecision = { expectedVersion: number; round: number; teacherId: string; decision: 'conformity' | 'changes-requested'; observation: string; objection?: AcademicRoundObjectionInput }
export type AcademicRoundObjectionDecision = { expectedVersion: number; decision: 'confirm' | 'reject'; reason: string }
export type AcademicRoundRegenerationRequest = { expectedVersion: number }
export type AcademicRoundResolutionRequest = { expectedVersion: number; teacherId: string; reason: string }
export type AcademicRoundRegeneration = {
  status: 'complete' | 'impossible' | 'search-limit' | 'invalid-input'
  saved: boolean
  fixedSectionIds: string[]
  regeneratedSectionIds: string[]
  appliedObjectionIds: string[]
  diagnostics: Array<{ code: string; message: string; sessionIds: string[] }>
}
export type RoundObjectionContext = {
  teacher: Pick<AcademicTeacherResource, 'id' | 'courseIds' | 'maxWeeklyMinutes' | 'availability'>
  assignments: Array<{ sectionId: string; courseId: string; teacherId: string; roomId: string }>
}

export function resolvePlanningRoundProfile(scope: { schoolId: string; academicPeriod: string }): AcademicRoundProfile | null
export function validateAcademicRoundProfile(value: unknown): asserts value is AcademicRoundProfile
export function isRoundDeadlineDate(value: unknown): value is string
export function limaCalendarDate(at: Date | string): string
export function isRoundDeadlineInRange(deadline: string, submittedAt: Date | string): boolean
export function validateAcademicRoundSubmission(value: unknown): asserts value is AcademicRoundSubmission
export function validateAcademicRoundObjectionInput(value: unknown): asserts value is AcademicRoundObjectionInput
export function validateAcademicRoundReviewDecision(value: unknown): asserts value is AcademicRoundReviewDecision
export function validateAcademicRoundObjectionDecision(value: unknown): asserts value is AcademicRoundObjectionDecision
export function validateAcademicRoundRegenerationRequest(value: unknown): asserts value is AcademicRoundRegenerationRequest
export function validateAcademicRoundResolutionRequest(value: unknown): asserts value is AcademicRoundResolutionRequest
export function validateAcademicRoundRegeneration(value: unknown): asserts value is AcademicRoundRegeneration
export function validateAcademicRoundOperation(value: unknown): asserts value is AcademicRoundOperation
export function mapRoundObjectionToOperation(objection: AcademicRoundObjectionInput, teacherId: string): AcademicRoundOperation
export function initialRoundObjectionStatus(operation: AcademicRoundOperation): 'proposed' | 'recorded'
export function subtractRoundIntervals(availability: AcademicInterval[], removed: AcademicInterval[]): AcademicInterval[]
export function applyRoundOperationToTeacher<T extends AcademicTeacherResource>(teacher: T, operation: AcademicRoundOperation): T | null
export function checkRoundObjection(objection: AcademicRoundObjectionInput, context: RoundObjectionContext): { ok: true; message: '' } | { ok: false; message: string }
export function resolvedRoundTeacherIds(review: AcademicTeacherReview | undefined, rounds: AcademicRoundControl | undefined): string[]
export function isRoundReviewReady(review: AcademicTeacherReview | undefined, rounds: AcademicRoundControl | undefined): boolean
export function validateAcademicRoundControl(value: unknown, review: AcademicTeacherReview, version?: number): asserts value is AcademicRoundControl

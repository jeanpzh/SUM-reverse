import type { PlanningPeriod, PlanningPolicy } from './academic-planning-policy.mjs'
export const ACADEMIC_REVISION: 'PA-DEMO-1'
export const ACADEMIC_ROUTE: '/local/programacion-academica'
export const ACADEMIC_API: '/api/local/programacion-academica/v1'
export type AcademicInterval = { day: number; startMinute: number; endMinute: number }
export type AcademicAllocationPolicy = 'preferences' | 'balanced' | 'first-feasible'
export type AcademicTeacherResource = { id: string; name: string; courseIds: string[]; maxWeeklyMinutes: number; availability: AcademicInterval[]; preferences?: AcademicInterval[]; sectionLimits?: Array<{ courseId: string; maxSections: number }>; facultyId?: string; category?: 'principal' | 'asociado' | 'auxiliar'; qualificationSource?: 'synthetic' }
export type AcademicRoomResource = { id: string; name: string; capacity: number; availability: AcademicInterval[]; kind?: 'classroom' | 'laboratory' }
export type AcademicPlanningResources = { teachers: AcademicTeacherResource[]; rooms: AcademicRoomResource[] }
export type AcademicRequest = { revision: string; demands: Array<{ courseId: string; estimatedDemand: number; targetCapacity?: number; patternId?: string; deliveryMode?: 'continuous' | 'split'; sectionCapacities?: Array<{ ordinal: number; capacity: number }> }>; resources?: AcademicPlanningResources; allocationPolicy?: AcademicAllocationPolicy; planningPolicy?: PlanningPolicy }
export type AcademicWeeklySession = { id: string; durationMinutes: number; type?: string }
export type AcademicHistory = { sections: Array<{ sectionId: string; capacity: number; sessions: Array<AcademicInterval & { room: string; teacherId: string; teacherName?: string; type: string }> }> }
export type AcademicCatalog = {
  revision: string
  source?: { kind: string; reference: string; sourcePeriod: string; planningPeriod: string; assumptions: string }
  referenceTeachers?: Array<{ id: string; name: string; courseIds: string[] }>
  referenceRooms?: Array<{ id: string; name: string; capacity: number; kind: 'classroom' | 'laboratory'; pavilion: 'AP' | 'NP' }>
  courses: Array<{ courseId: string; name: string; estimatedDemand: number; targetCapacity: number; weeklySessions: AcademicWeeklySession[]; cycle?: number; credits?: number; history?: AcademicHistory; planningPatterns?: Array<{ id: string; label: string; weeklySessions: AcademicWeeklySession[] }> }>
  teachers: AcademicTeacherResource[]
  rooms: AcademicRoomResource[]
  windows: AcademicInterval[]
  startStepMinutes: number
  maxExplorations: number
}
export type AcademicProposal = {
  editVersion?: number
  manuallyAdjustedSectionIds?: string[]
  preferenceReport?: { policy: AcademicAllocationPolicy; evaluatedSections: number; withinPreferenceSections: number; outsidePreferenceSections: number; withoutPreferenceSections: number; optimality: 'not-proven' }
  proposalId: string
  createdAt: string
  expiresAt: string
  status: 'complete' | 'impossible' | 'search-limit' | 'invalid-input'
  sections: Array<{ sectionId: string; courseId: string; courseName: string; capacity: number; deliveryMode?: 'continuous' | 'split' }>
  assignments: Array<AcademicInterval & { sessionId: string; sectionId: string; courseId: string; courseName: string; teacherId: string; teacherName: string; roomId: string; roomName: string; sessionType?: string }>
  pending: Array<{ sessionId: string; sectionId: string; courseId: string; durationMinutes: number }>
  diagnostics: Array<{ code: string; message: string; sessionIds: string[] }>
  coverageComplete: boolean
  counts: { sections: number; requiredSessions: number; scheduledSessions: number }
  stats: { exploredCandidates: number; candidateVisits: number; backtracks: number; limitReason: 'explorations' | 'work' | 'time' | null }
}
export function validateAcademicRequest(value: unknown): asserts value is AcademicRequest
export function validateAcademicResources(value: unknown): asserts value is AcademicPlanningResources
export function validateAcademicCatalog(value: unknown): asserts value is AcademicCatalog
export function validateAcademicProposal(value: unknown): asserts value is AcademicProposal
export type AcademicAdjustment = { expectedVersion: number; sectionId: string; sessionIds: string[]; teacherId: string; day: number; startMinute: number; roomIds: string[] }
export function validateAcademicAdjustment(value: unknown): asserts value is AcademicAdjustment
export type AcademicDemandSourceId = 'existing-regular-v1' | 'independent-120-v1'
export type AcademicDemandRequest = { revision: string; sourceId: AcademicDemandSourceId; targetPeriod: '2027-I'; courses: Array<{ courseId: string; targetCapacity: number }> }
export type AcademicDemandSource = { id: AcademicDemandSourceId; label: string; revision: string; kind: 'synthetic'; targetPeriod: '2027-I'; cutoffPeriod: '2026-1'; schoolId: 'SISTEMAS'; planId: 'SYN-SIS-PLAN'; populationSize: number; recordCount: number; duplicateRecords: number; reference: string; limitations: string[] }
export type AcademicDemandEstimate = { revision: string; source: AcademicDemandSource; rows: Array<{ courseId: string; eligible: number; retakeEligible: number; nonEligible: number; insufficient: number; baseDemand: number; targetCapacity: number; suggestedSections: number; reasons: Array<{ category: 'non-eligible' | 'insufficient'; code: string; message: string; count: number }> }> }
export function validateAcademicDemandRequest(value: unknown): asserts value is AcademicDemandRequest
export function validateAcademicDemandEstimate(value: unknown): asserts value is AcademicDemandEstimate
export type AcademicDraftState = 'draft' | 'ready-for-review' | 'in-review' | 'ready-for-approval' | 'approved' | 'published'
export type AcademicWorkspace = { schoolId: 'SISTEMAS'; academicPeriod: PlanningPeriod; request: AcademicRequest & { resources: AcademicPlanningResources }; demandSourceId: AcademicDemandSourceId; demandBaseRequest: AcademicDemandRequest | null }
export type AcademicDraftSaveRequest = { id: string | null; expectedVersion: number | null; title: string; state: 'draft' | 'ready-for-review'; configuration: AcademicWorkspace; proposalId: string | null; proposalEditVersion: number | null }
export type AcademicSavedDraft = { id: string; version: number; title: string; state: AcademicDraftState; createdAt: string; updatedAt: string; configuration: AcademicWorkspace; demandBase: AcademicDemandEstimate | null; proposal: AcademicProposal | null; review?: AcademicTeacherReview; approval?: AcademicApproval; publication?: AcademicPublicationMetadata; origin?: AcademicDraftOrigin }
export type AcademicApproval = { sourceVersion: number; approvedVersion: number; approvedAt: string; fingerprint: string }
export type AcademicPublicationMetadata = { publicationVersion: number; publishedAt: string }
export type AcademicDraftOrigin = { draftId: string; version: number; publicationVersion: number | null }
export type AcademicPublicationRequest = { expectedVersion: number; expectedCurrentId: string | null }
export type AcademicScheduleSnapshot = { schoolId: 'SISTEMAS'; academicPeriod: PlanningPeriod; courses: Array<{ courseId: string; name: string; cycle: number; credits: number }>; sections: AcademicProposal['sections']; assignments: AcademicProposal['assignments'] }
export type AcademicReleasePreview = { id: string; version: number; title: string; state: AcademicDraftState; schedule: AcademicScheduleSnapshot }
export type AcademicPublication = { revision: 'PA-PUBLICATION-1'; id: string; publicationVersion: number; title: string; sourceProposalVersion: number; approvedVersion: number; approvedAt: string; publishedAt: string; schedule: AcademicScheduleSnapshot }
export type AcademicPublicationList = { currentId: string | null; items: Array<Omit<AcademicPublication, 'revision' | 'schedule'>> }
export function validateAcademicPublicationRequest(value: unknown): asserts value is AcademicPublicationRequest
export function validateAcademicScheduleSnapshot(value: unknown): asserts value is AcademicScheduleSnapshot
export function validateAcademicReleasePreview(value: unknown): asserts value is AcademicReleasePreview
export function validateAcademicPublication(value: unknown): asserts value is AcademicPublication
export function validateAcademicPublicationList(value: unknown): asserts value is AcademicPublicationList
export type AcademicReviewSubmission = { expectedVersion: number }
export type AcademicReviewDecision = { expectedVersion: number; round: number; teacherId: string; decision: 'conformity' | 'changes-requested'; observation: string }
export type AcademicReviewTeacher = { teacherId: string; teacherName: string; fingerprint: string; status: 'pending' | 'conformity' | 'changes-requested' | 'outdated'; observation: string; decisionVersion: number | null; decidedAt: string | null }
export type AcademicReviewEvent = { type: 'submitted' | 'decision' | 'invalidated'; version: number; round: number; at: string; teacherId: string | null; decision: 'conformity' | 'changes-requested' | null; observation: string; fingerprint: string | null }
export type AcademicTeacherReview = { round: number; submittedVersion: number; submittedAt: string; teachers: AcademicReviewTeacher[]; history: AcademicReviewEvent[] }
export function validateAcademicReviewSubmission(value: unknown): asserts value is AcademicReviewSubmission
export function validateAcademicReviewDecision(value: unknown): asserts value is AcademicReviewDecision
export function validateAcademicTeacherReview(value: unknown, version?: number): asserts value is AcademicTeacherReview
export type AcademicDraftList = { items: Array<Pick<AcademicSavedDraft, 'id' | 'version' | 'title' | 'state' | 'createdAt' | 'updatedAt'> & { schoolId: 'SISTEMAS'; academicPeriod: PlanningPeriod; hasSchedule: boolean }>; unavailableCount: number }
export type AcademicDraftResume = { draft: AcademicSavedDraft }
export function validateAcademicWorkspace(value: unknown): asserts value is AcademicWorkspace
export function validateAcademicDraftSaveRequest(value: unknown): asserts value is AcademicDraftSaveRequest
export function validateAcademicSavedDraft(value: unknown): asserts value is AcademicSavedDraft
export function validateAcademicDraftList(value: unknown): asserts value is AcademicDraftList
export function validateAcademicDraftResume(value: unknown): asserts value is AcademicDraftResume
export type AcademicAdvisorPatch =
  | { kind: 'increase_teacher_load'; adjustments: Array<{ teacherId: string; previousMaxWeeklyMinutes: number; nextMaxWeeklyMinutes: number }> }
  | { kind: 'enable_planning_window'; allowAfternoon?: true; allowSaturday?: true }
  | { kind: 'change_delivery_mode'; courseIds: string[]; deliveryMode: 'split' }
  | { kind: 'incorporate_reference_resource'; teacherIds: string[]; roomIds: string[] }
export type AcademicAdvisorRequest = { expectedEditVersion: number; selectedRecommendationIds?: string[] }
export type AcademicAdvisorBottleneck = {
  category: 'teacher_load' | 'planning_window' | 'missing_resource' | 'delivery_mode' | 'other'
  title: string
  detail: string
  affectedSessionCount: number
}
export type AcademicAdvisorRecommendation = {
  id: string
  title: string
  rationale: string
  impactSummary: string
  recommendedByDefault: boolean
  patch: AcademicAdvisorPatch
}
export type AcademicAdvisorVerifiedImpact = {
  currentScheduledSessions: number
  projectedScheduledSessions: number
  requiredSessions: number
  currentCompleteSections: number
  projectedCompleteSections: number
  totalSections: number
  recommendationIds: string[]
  solverStatus: 'complete' | 'impossible' | 'search-limit'
}
export type AcademicAdvisorReasoningStep = { toolName: string; inputSummary: string; outputSummary: string }
export type AcademicAdvisorResponse = {
  normativeContext?: AcademicNormativeResponse
  verifiedImpact?: AcademicAdvisorVerifiedImpact
  reasoningSteps?: AcademicAdvisorReasoningStep[]
  proposalId: string
  editVersion: number
  source: {
    mode: 'llm-assisted' | 'deterministic-fallback'
    providerLabel: string | null
    fallbackReason?: 'not_configured' | 'timeout' | 'rate_limited' | 'upstream_error' | 'invalid_llm_output'
  }
  summary: string
  bottlenecks: AcademicAdvisorBottleneck[]
  recommendations: AcademicAdvisorRecommendation[]
}
export function validateAcademicAdvisorRequest(value: unknown): asserts value is AcademicAdvisorRequest
export function validateAcademicAdvisorPatch(value: unknown): asserts value is AcademicAdvisorPatch
export function validateAcademicAdvisorResponse(value: unknown): asserts value is AcademicAdvisorResponse

export type AcademicNormativeRequest = { question: string; facultyId: 'FISI'; academicPeriod: PlanningPeriod; asOf: string; teacherType: 'ordinario' | 'contratado' | 'unknown' }
export type AcademicNormativeCitation = { id: string; documentId: string; title: string; article: string; page: number; url: string; excerpt: string; sourceClass: 'normative'; scope: 'UNMSM' | 'FISI'; reviewedAt: string; effectiveFrom: string | null; effectiveTo: string | null }
export type AcademicNormativeResponse = { revision: 'PA-NORMATIVE-1'; question: string; context: Omit<AcademicNormativeRequest, 'question'>; status: 'supported' | 'not-determined' | 'conflict'; answer: string; retrievalMode: 'hybrid' | 'lexical-only' | 'unavailable'; citations: AcademicNormativeCitation[]; gaps: string[]; generation?: { mode: 'llm-assisted' | 'extractive'; providerLabel: string | null; fallbackReason?: 'not_configured' | 'timeout' | 'upstream_error' | 'invalid_llm_output' | 'insufficient_evidence' | 'disabled' } }
export function validateAcademicNormativeRequest(value: unknown): asserts value is AcademicNormativeRequest
export function validateAcademicNormativeResponse(value: unknown, request?: AcademicNormativeRequest): asserts value is AcademicNormativeResponse

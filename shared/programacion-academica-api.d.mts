export const ACADEMIC_REVISION: 'PA-DEMO-1'
export const ACADEMIC_ROUTE: '/local/programacion-academica'
export const ACADEMIC_API: '/api/local/programacion-academica/v1'
export type AcademicInterval = { day: number; startMinute: number; endMinute: number }
export type AcademicAllocationPolicy = 'preferences' | 'balanced' | 'first-feasible'
export type AcademicTeacherResource = { id: string; name: string; courseIds: string[]; maxWeeklyMinutes: number; availability: AcademicInterval[]; preferences?: AcademicInterval[]; sectionLimits?: Array<{ courseId: string; maxSections: number }> }
export type AcademicRoomResource = { id: string; name: string; capacity: number; availability: AcademicInterval[]; kind?: 'classroom' | 'laboratory' }
export type AcademicPlanningResources = { teachers: AcademicTeacherResource[]; rooms: AcademicRoomResource[] }
export type AcademicRequest = { revision: string; demands: Array<{ courseId: string; estimatedDemand: number; targetCapacity?: number; patternId?: string; deliveryMode?: 'continuous' | 'split' }>; resources?: AcademicPlanningResources; allocationPolicy?: AcademicAllocationPolicy }
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
export type AcademicWorkspace = { schoolId: 'SISTEMAS'; academicPeriod: '2027-I'; request: AcademicRequest & { resources: AcademicPlanningResources }; demandSourceId: AcademicDemandSourceId; demandBaseRequest: AcademicDemandRequest | null }
export type AcademicDraftSaveRequest = { id: string | null; expectedVersion: number | null; title: string; state: 'draft' | 'ready-for-review'; configuration: AcademicWorkspace; proposalId: string | null; proposalEditVersion: number | null }
export type AcademicSavedDraft = { id: string; version: number; title: string; state: AcademicDraftState; createdAt: string; updatedAt: string; configuration: AcademicWorkspace; demandBase: AcademicDemandEstimate | null; proposal: AcademicProposal | null; review?: AcademicTeacherReview; approval?: AcademicApproval; publication?: AcademicPublicationMetadata; origin?: AcademicDraftOrigin }
export type AcademicApproval = { sourceVersion: number; approvedVersion: number; approvedAt: string; fingerprint: string }
export type AcademicPublicationMetadata = { publicationVersion: number; publishedAt: string }
export type AcademicDraftOrigin = { draftId: string; version: number; publicationVersion: number | null }
export type AcademicPublicationRequest = { expectedVersion: number; expectedCurrentId: string | null }
export type AcademicScheduleSnapshot = { schoolId: 'SISTEMAS'; academicPeriod: '2027-I'; courses: Array<{ courseId: string; name: string; cycle: number; credits: number }>; sections: AcademicProposal['sections']; assignments: AcademicProposal['assignments'] }
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
export type AcademicDraftList = { items: Array<Pick<AcademicSavedDraft, 'id' | 'version' | 'title' | 'state' | 'createdAt' | 'updatedAt'> & { schoolId: 'SISTEMAS'; academicPeriod: '2027-I'; hasSchedule: boolean }>; unavailableCount: number }
export type AcademicDraftResume = { draft: AcademicSavedDraft }
export function validateAcademicWorkspace(value: unknown): asserts value is AcademicWorkspace
export function validateAcademicDraftSaveRequest(value: unknown): asserts value is AcademicDraftSaveRequest
export function validateAcademicSavedDraft(value: unknown): asserts value is AcademicSavedDraft
export function validateAcademicDraftList(value: unknown): asserts value is AcademicDraftList
export function validateAcademicDraftResume(value: unknown): asserts value is AcademicDraftResume

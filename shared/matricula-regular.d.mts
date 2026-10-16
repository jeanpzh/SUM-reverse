export declare const matriculaRegularCauseCodes: readonly [
  'PRE_ENROLLMENT_NOT_ENABLED', 'OUTSIDE_WINDOW', 'CREDIT_LOAD_INVALID',
  'COURSE_NOT_IN_PRE_ENROLLMENT', 'PLAN_MISMATCH', 'PREREQUISITE_UNMET',
  'RETAKE_PRIORITY', 'SCHEDULE_CONFLICT', 'SECTION_FULL',
  'DEBT_REQUIREMENT_UNMET', 'HEALTH_REQUIREMENT_UNMET', 'ACADEMIC_INELIGIBILITY',
  'TUTORSHIP_REQUIREMENT_UNMET', 'FOURTH_ENROLLMENT_RULE_UNMET', 'ALREADY_ENROLLED',
]

export declare const matriculaRegularGapCodes: readonly [
  'PROFILE_MISSING', 'WINDOW_UNSPECIFIED', 'PRE_ENROLLMENT_UNKNOWN',
  'PLAN_OR_OFFER_UNKNOWN', 'PREREQUISITE_OR_EQUIVALENCE_UNKNOWN', 'SCHEDULE_UNKNOWN',
  'EXCEPTION_UNKNOWN', 'INSTITUTIONAL_REQUIREMENT_UNKNOWN',
  'REPETITION_OR_AUTHORIZATION_UNKNOWN',
]

export declare const matriculaRegularWindowOrigins: readonly ['published-derived', 'synthetic']

export type MatriculaRegularId = `SYN-${string}`
export type MatriculaRegularUuid = string
export type MatriculaRegularCauseCode = (typeof matriculaRegularCauseCodes)[number]
export type MatriculaRegularGapCode = (typeof matriculaRegularGapCodes)[number]
export type MatriculaRegularWindowOrigin = (typeof matriculaRegularWindowOrigins)[number]
export type MatriculaRegularSourceClass = 'normative' | 'observed' | 'testimony' | 'inferred'
export type MatriculaRegularEligibilityState = 'eligible' | 'ineligible' | 'configuration-pending'
export type MatriculaRegularOutcomeState = 'accepted' | 'rejected' | 'configuration-pending'
export type MatriculaRegularCourseType = 'mandatory' | 'elective'

export interface MatriculaRegularChoice {
  courseId: MatriculaRegularId
  sectionId: MatriculaRegularId
}

export interface MatriculaRegularScope {
  facultyId: string
  schoolId: string
  period: string
  planId: MatriculaRegularId
  modality: 'regular-virtual'
}

export interface MatriculaRegularSource {
  id: string
  origin: 'evidence' | 'local-decision'
  class: MatriculaRegularSourceClass | null
  reference: string
  date: string
  status: 'documented' | 'reported' | 'unverified' | 'local-only'
}

export interface MatriculaRegularGap {
  code: MatriculaRegularGapCode
  courseIds: MatriculaRegularId[]
  sourceIds: string[]
}

export interface MatriculaRegularCause {
  code: MatriculaRegularCauseCode
  courseIds: MatriculaRegularId[]
  sectionIds: MatriculaRegularId[]
  sourceIds: string[]
}

export interface MatriculaRegularSession {
  runId: MatriculaRegularUuid
  actorId: MatriculaRegularId
  sessionId: MatriculaRegularUuid
  startedAt: string
  expiresAt: string
}

export interface MatriculaRegularMeeting {
  day: number
  startMinute: number
  endMinute: number
}

export interface MatriculaRegularSection {
  sectionId: MatriculaRegularId
  capacity: number
  occupied: number
  schedule: MatriculaRegularMeeting[] | null
  /** MR-CONTRACT-3 (optional): displayed section number. */
  label?: string
  /** MR-CONTRACT-3 (optional): `APELLIDOS, NOMBRES`; null = no teacher assigned. */
  teacher?: string | null
  /** MR-CONTRACT-3 (optional): null is displayed as «-». */
  room?: string | null
}

export interface MatriculaRegularCourseDocument {
  courseId: MatriculaRegularId
  planId: MatriculaRegularId
  name: string
  credits: number
}

export interface MatriculaRegularOfferedCourse {
  courseId: MatriculaRegularId
  planId: MatriculaRegularId
  name: string
  credits: number
  prerequisiteIds: MatriculaRegularId[]
  sections: MatriculaRegularSection[]
  /** MR-CONTRACT-3 (optional): plan cycle 1-14. */
  cycle?: number | null
  /** MR-CONTRACT-3 (optional). */
  courseType?: MatriculaRegularCourseType | null
}

export interface MatriculaRegularPublishedRow {
  row: number
  groupLabel: string
  day: '2026-08-10'
  startLocal: string
  endLocal: string
  ppMin: number
  ppMax: number
  sourceId: 'F6'
}

export interface MatriculaRegularWindow {
  id: MatriculaRegularId
  startsAt: string
  endsAt: string
  minPp: number
  origin: MatriculaRegularWindowOrigin
  sourceIds: string[]
}

export interface MatriculaRegularCalendar {
  publishedRows: MatriculaRegularPublishedRow[]
  effectiveWindows: MatriculaRegularWindow[]
  unknownDates: string[]
}

export interface MatriculaRegularEligibility {
  state: MatriculaRegularEligibilityState
  windowId: MatriculaRegularId | null
  windowOrigin: MatriculaRegularWindowOrigin | null
  causes: MatriculaRegularCause[]
  gaps: MatriculaRegularGap[]
}

export interface MatriculaRegularContext {
  actorId: MatriculaRegularId
  scope: MatriculaRegularScope
  profileRevision: string
  serverNow: string
  preEnrollmentEnabled: boolean | null
  preEnrollmentComplete: boolean
  preEnrollment: MatriculaRegularCourseDocument[]
  offerKnown: boolean
  offer: MatriculaRegularOfferedCourse[]
  calendar: MatriculaRegularCalendar
  eligibility: MatriculaRegularEligibility
  sources: MatriculaRegularSource[]
  /** MR-CONTRACT-3 (optional): offered courses with one or more failures, sorted and unique. */
  retakeCourseIds?: MatriculaRegularId[]
  /** MR-CONTRACT-3 (optional): «Tope de créditos». */
  creditCap?: number | null
}

export interface MatriculaRegularSessionRequest {
  runId: MatriculaRegularUuid
  actorId: MatriculaRegularId
}

export type MatriculaRegularLookupQuery = MatriculaRegularSessionRequest
export type MatriculaRegularReportQuery = MatriculaRegularSessionRequest

export interface MatriculaRegularSubmission {
  runId: MatriculaRegularUuid
  actorId: MatriculaRegularId
  sessionId: MatriculaRegularUuid
  requestId: MatriculaRegularUuid
  profileRevision: string
  selection: MatriculaRegularChoice[]
}

export interface MatriculaRegularOutcome {
  requestId: MatriculaRegularUuid
  actorId: MatriculaRegularId
  profileRevision: string
  state: MatriculaRegularOutcomeState
  evaluatedAt: string
  windowOrigin: MatriculaRegularWindowOrigin | null
  selection: MatriculaRegularChoice[]
  causes: MatriculaRegularCause[]
  gaps: MatriculaRegularGap[]
  enrollmentId: MatriculaRegularUuid | null
  reportPath: string | null
}

export interface MatriculaRegularLookup {
  state: 'known' | 'unknown'
  outcome: MatriculaRegularOutcome | null
}

export interface MatriculaRegularReportRow {
  courseId: MatriculaRegularId
  sectionId: MatriculaRegularId
  planId: MatriculaRegularId
  name: string
  credits: number
  schedule: MatriculaRegularMeeting[]
  /** MR-CONTRACT-3 (optional). */
  cycle?: number | null
  label?: string
  teacher?: string | null
}

export interface MatriculaRegularEnrollmentReport {
  enrollmentId: MatriculaRegularUuid
  requestId: MatriculaRegularUuid
  actorId: MatriculaRegularId
  scope: MatriculaRegularScope
  profileRevision: string
  acceptedAt: string
  windowOrigin: MatriculaRegularWindowOrigin
  rows: MatriculaRegularReportRow[]
  totalCredits: number
}

export interface MatriculaRegularEnvelope<T> {
  runId: MatriculaRegularUuid
  data: T
}

export interface MatriculaRegularErrorResponse {
  runId: MatriculaRegularUuid
  error: { code: string; fields: string[] }
}

export interface MatriculaRegularExpectedIdentity {
  runId: MatriculaRegularUuid
  actorId: MatriculaRegularId
  requestId?: MatriculaRegularUuid
  enrollmentId?: MatriculaRegularUuid
  sessionId?: MatriculaRegularUuid
}

export declare function validateChoice(value: unknown): asserts value is MatriculaRegularChoice
export declare function validateScope(value: unknown): asserts value is MatriculaRegularScope
export declare function validateSource(value: unknown): asserts value is MatriculaRegularSource
export declare function validateGap(value: unknown): asserts value is MatriculaRegularGap
export declare function validateCause(value: unknown): asserts value is MatriculaRegularCause
export declare function validateSession(value: unknown): asserts value is MatriculaRegularSession
export declare function validateContext(value: unknown): asserts value is MatriculaRegularContext
export declare function validateSubmission(value: unknown): asserts value is MatriculaRegularSubmission
export declare function validateOutcome(value: unknown): asserts value is MatriculaRegularOutcome
export declare function validateLookup(value: unknown): asserts value is MatriculaRegularLookup
export declare function validateEnrollmentReport(value: unknown): asserts value is MatriculaRegularEnrollmentReport
export declare function validateSessionRequest(value: unknown): asserts value is MatriculaRegularSessionRequest
export declare function validateRenewalRequest(sessionId: unknown, value: unknown): asserts value is MatriculaRegularSessionRequest
export declare function validateLookupQuery(value: unknown): asserts value is MatriculaRegularLookupQuery
export declare function validateReportQuery(value: unknown): asserts value is MatriculaRegularReportQuery
export declare function validateSubmissionRequest(value: unknown): asserts value is MatriculaRegularSubmission
export declare function validateActorId(value: unknown): asserts value is MatriculaRegularId
export declare function validateSessionId(value: unknown): asserts value is MatriculaRegularUuid
export declare function validateRequestId(value: unknown): asserts value is MatriculaRegularUuid
export declare function validateEnrollmentId(value: unknown): asserts value is MatriculaRegularUuid

export declare function validateContextResponse(
  value: unknown,
  expectedRunId?: MatriculaRegularUuid,
  expectedActorId?: MatriculaRegularId,
): asserts value is MatriculaRegularEnvelope<MatriculaRegularContext>
export declare function validateSessionResponse(
  value: unknown,
  expectedIdentity: MatriculaRegularExpectedIdentity,
): asserts value is MatriculaRegularEnvelope<MatriculaRegularSession>
export declare function validateOutcomeResponse(
  value: unknown,
  expectedIdentity: MatriculaRegularExpectedIdentity & { requestId: MatriculaRegularUuid },
): asserts value is MatriculaRegularEnvelope<MatriculaRegularOutcome>
export declare function validateLookupResponse(
  value: unknown,
  expectedIdentity: MatriculaRegularExpectedIdentity & { requestId: MatriculaRegularUuid },
): asserts value is MatriculaRegularEnvelope<MatriculaRegularLookup>
export declare function validateEnrollmentReportResponse(
  value: unknown,
  expectedIdentity: MatriculaRegularExpectedIdentity & { enrollmentId: MatriculaRegularUuid },
): asserts value is MatriculaRegularEnvelope<MatriculaRegularEnrollmentReport>
export declare function validateErrorResponse(value: unknown): asserts value is MatriculaRegularErrorResponse

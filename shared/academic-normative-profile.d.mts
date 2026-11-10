export const NORMATIVE_PROFILE_REVISION: 'UNMSM-AAD-2026-04'
export const NORMATIVE_PROFILE_FACULTIES: readonly ['FISI']
export const NORMATIVE_PROFILE_VALID_FROM: '2026-II'
export const LECTIVE_HOUR_MINUTES: readonly [45, 50, 60]
export const TEACHER_REGIMES: readonly ['dedicacion-exclusiva', 'tiempo-completo', 'tiempo-parcial']
export const TEACHER_APPOINTMENTS: readonly ['faculty-ordinary', 'interfaculty-ordinary', 'contract']
export const TEACHER_CATEGORIES: readonly ['principal', 'asociado', 'auxiliar']
export const TEACHER_LOAD_CONDITIONS: readonly ['renacyt-researcher', 'postgraduate-study', 'on-leave']
export const LOAD_AUTHORIZATION_KINDS: readonly ['voluntary-declaration', 'vrap-authorization']
export const NORMATIVE_GAP_CODES: readonly NormativeGapCode[]

export type TeacherRegime = (typeof TEACHER_REGIMES)[number]
export type TeacherAppointment = (typeof TEACHER_APPOINTMENTS)[number]
export type TeacherCategory = (typeof TEACHER_CATEGORIES)[number]
export type TeacherLoadCondition = (typeof TEACHER_LOAD_CONDITIONS)[number]
export type LoadAuthorizationKind = (typeof LOAD_AUTHORIZATION_KINDS)[number]
export type LectiveHourMinutes = (typeof LECTIVE_HOUR_MINUTES)[number]
export type LoadAuthorization = { kind: LoadAuthorizationKind; reference: string; maxLectiveHours?: number }
export type NormativeGapCode =
  | 'APPOINTMENT_MISSING' | 'APPOINTMENT_RANK_INFERRED' | 'CATEGORY_MISSING' | 'CONTRACT_LOAD_NOT_REGULATED' | 'FISI_LECTIVE_HOUR_UNVERIFIED'
  | 'ON_LEAVE_INFERRED' | 'PERFORMANCE_EVALUATION_NO_SOURCE' | 'REGIME_MISSING' | 'RENACYT_TIEMPO_PARCIAL_UNRESOLVED' | 'SOURCE_OF07_URL_NOT_RECORDED'
  | 'TP_MINIMUM_BASIS_UNSPECIFIED' | 'TP_MAXIMUM_NOT_REGULATED' | 'TP_SERVICE_HOURS_MISSING'
export type NormativeGap = { code: NormativeGapCode; message: string }
export type NormativeSource = {
  id: string
  title: string
  date: string
  articles: string[]
  class: 'normative' | 'observed' | 'testimony' | 'inferred'
  status: 'documented' | 'reported' | 'unverified' | 'local-only'
  reference: string
}
export type NormativeProfile = {
  revision: 'UNMSM-AAD-2026-04'
  scope: { facultyIds: string[]; validFromPeriod: string; validUntilPeriod: string | null }
  sources: NormativeSource[]
  loadRules: {
    lectiveHourMinutes: { allowed: number[]; default: null; articles: string[]; sourceIds: string[]; status: 'unverified' }
    regimes: Record<TeacherRegime, {
      serviceHoursPerWeek?: number; serviceHoursBelow?: number; minimumLectiveHours?: number; minimumLectiveShare?: number
      ordinaryMaxLectiveHours: number | null; articles: string[]; sourceIds: string[]
    }>
    voluntaryDeclaration: { maxLectiveHours: number; articles: string[]; sourceIds: string[] }
    renacytResearcher: { minimumLectiveHours: number; articles: string[]; sourceIds: string[] }
    postgraduateStudy: { maxLectiveHours: number; articles: string[]; sourceIds: string[] }
    onLeave: { authorizedMaxLectiveHours: number; articles: string[]; sourceIds: string[] }
    vrapAuthorization: { articles: string[]; sourceIds: string[]; overPostgraduateCapSourceIds: string[] }
  }
  prelation: {
    criteria: Array<{ order: number; id: string; active: boolean; class: 'normative' | 'inferred'; articles: string[]; sourceIds: string[] }>
    appointmentTiers: Record<TeacherAppointment, 0 | 1 | 2>
    categoryRegimeOrder: Array<[TeacherCategory, TeacherRegime]>
    categoryRegimeSourceIds: string[]
    cycleRange: { from: number; to: number }
  }
  gaps: NormativeGap[]
}
// Fields of the teacher resource that the profile reads (all optional; see AcademicTeacherResource).
export type NormativeTeacher = {
  regime?: TeacherRegime
  appointment?: TeacherAppointment
  category?: TeacherCategory
  weeklyServiceHours?: number
  loadConditions?: TeacherLoadCondition[]
  loadAuthorizations?: LoadAuthorization[]
}
export type LoadException = { kind: LoadAuthorizationKind; maxMinutes: number | null; requires: string[]; sourceIds: string[] }
export type TeacherLoadLimits = {
  minimumMinutes: number | null
  ordinaryMaxMinutes: number | null
  authorizedMaxMinutes: number | null
  nextException: LoadException | null
  gaps: NormativeGap[]
  sourceIds: string[]
  articles: string[]
}
export type TeacherPrelation = { appointmentTier: 0 | 1 | 2 | null; categoryRank: number | null; gaps: NormativeGap[]; sourceIds: string[] }
export type LoadAuthorizationBlocker = {
  teacherId: string
  assignedMinutes: number
  authorizedMaxMinutes: number
  reason: 'over-authorized-load' | 'on-leave'
  requiredAuthorization: LoadAuthorizationKind | null
  sourceIds: string[]
}

export class NormativeProfileGapError extends Error {
  code: 'NORMATIVE_PROFILE_FACULTY_UNKNOWN' | 'NORMATIVE_PROFILE_PERIOD_BEFORE_VALIDITY'
  facultyId: string
  period: string
}
export function resolveNormativeProfile(scope: { facultyId: string; period: string }): NormativeProfile
export function teacherLoadLimits(profile: NormativeProfile, teacher: NormativeTeacher, options: { lectiveHourMinutes: LectiveHourMinutes }): TeacherLoadLimits
export function teacherPrelation(profile: NormativeProfile, teacher: NormativeTeacher): TeacherPrelation
export function loadAuthorizationBlockers(
  profile: NormativeProfile,
  teachers: Array<NormativeTeacher & { id: string }>,
  assignedMinutesByTeacherId: Map<string, number> | Record<string, number>,
  options: { lectiveHourMinutes: LectiveHourMinutes },
): LoadAuthorizationBlocker[]

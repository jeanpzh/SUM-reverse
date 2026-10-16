import type { PlanEstudiosWireEnvelope } from '../../../shared/plan-estudios-wire.mjs'
import type { ProgramacionRow } from '../programacion/programacion.types.js'
import type { PerfilAlumno } from '../mi-informacion/mi-informacion.types.js'

export type School = 'SISTEMAS' | 'SOFTWARE'

export type KnowledgeState = 'known' | 'unknown' | 'not-applicable'
export type RequirementState = 'met' | 'unmet' | 'unknown'

export type ProfileScope = {
  facultyId: string
  schoolId: string
  period: string
  planId: string
  modality: 'regular-virtual'
}

export type Source = {
  id: string
  origin: 'evidence' | 'local-decision'
  class: 'normative' | 'observed' | 'testimony' | 'inferred' | null
  reference: string
  date: string
  status: 'documented' | 'reported' | 'unverified' | 'local-only'
}

export type RuleKnowledge = {
  ruleId: string
  sourceIds: string[]
  knowledge: KnowledgeState
}

export type PublishedRow = {
  row: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  groupLabel: string
  day: '2026-08-10'
  startLocal: string
  endLocal: string
  ppMin: number
  ppMax: number
  sourceId: 'F6'
}

export type EffectiveWindow = {
  id: string
  startsAt: string
  endsAt: string
  minPp: number
  origin: 'published-derived' | 'synthetic'
  sourceIds: string[]
}

export type Calendar = {
  publishedRows: PublishedRow[]
  effectiveWindows: EffectiveWindow[]
  unknownDates: string[]
}

export type CreditExceptionKind =
  | 'none'
  | 'remaining-for-completion'
  | 'return-after-suspension'
  | 'plan-change-no-offer'

export type CreditException = {
  kind: CreditExceptionKind
  applicability: 'applicable' | 'not-applicable' | 'unknown'
  sourceIds: string[]
}

export type CourseDocument = {
  courseId: string
  planId: string
  name: string
  credits: number
}

export type Meeting = {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7
  startMinute: number
  endMinute: number
}

export type Section = {
  sectionId: string
  capacity: number
  occupied: number
  schedule: Meeting[] | null
  label?: string
  teacher?: string | null
  room?: string | null
}

export type OfferedCourse = CourseDocument & {
  prerequisiteIds: string[]
  sections: Section[]
  cycle?: number | null
  courseType?: 'mandatory' | 'elective' | null
}

export type AcademicCatalogCourse = Omit<OfferedCourse, 'sections'>

export type AcademicAttempt = {
  courseId: string
  period: `${number}-${0 | 1 | 2}`
  sectionNumber: 1 | 2
  grade: number
  result: 'approved' | 'failed'
  recordId: string
}

export type SyntheticAcademicRecord = {
  seedRevision: 'PS-SEED-1'
  catalog: AcademicCatalogCourse[]
  attempts: AcademicAttempt[]
}

export type ActorProfile = {
  actorId: string
  name: string
  profileRevision: string
  scope: ProfileScope
  preEnrollmentEnabled: boolean | null
  preEnrollment: CourseDocument[]
  preEnrollmentComplete: boolean
  planKnown: boolean
  offerKnown: boolean
  equivalencesKnown: boolean
  approvedCourseIds: string[]
  historyKnown: boolean
  failedCourses: Array<{ courseId: string; failures: 0 | 1 | 2 | 3 | 4 }>
  creditException: CreditException
  institutional: {
    debt: RequirementState
    health: RequirementState
    eligibility: RequirementState
  }
  tutorship: Array<{ courseId: string; condition: RequirementState }>
  fourthAttemptAuthorization: Array<{
    courseId: string
    condition: RequirementState
  }>
  ponderado: number | null
  rules: RuleKnowledge[]
  scenarioData?: {
    plan: PlanEstudiosWireEnvelope
    programming: ProgramacionRow[]
    profile: PerfilAlumno
    courseCodes: Record<string, string>
  }
  academic?: SyntheticAcademicRecord
}

export type EnrollmentProfile = {
  profileRevision: string
  scope: ProfileScope
  sources: Source[]
  calendar: Calendar
  rules: RuleKnowledge[]
}

export type SyntheticFixture = {
  profile: EnrollmentProfile
  actors: ActorProfile[]
  offer: OfferedCourse[]
}

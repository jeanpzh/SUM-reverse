import type { AcademicProposal } from '../../../shared/programacion-academica-api.mjs'
import type { CourseDemand } from './programacion-academica.types.js'
import type { AcademicAssignment, AcademicSchedule, AcademicTeacher, AcademicRoom, CompatibleCourseGroup, ScheduleIssueCode, TimeInterval } from './schedule.types.js'
import type { PlanningPolicy } from '../../../shared/academic-planning-policy.mjs'

export type WeeklySession = {
  id: string
  durationMinutes: number
  type?: string
}
export type DeliveryMode = 'continuous' | 'split'
export type AllocationPolicy = 'preferences' | 'balanced' | 'first-feasible'
export type SectionCapacityOverride = { ordinal: number, capacity: number }
export type GeneratorCourse = CourseDemand & { weeklySessions: WeeklySession[], deliveryMode?: DeliveryMode, cycle?: number, sectionCapacities?: SectionCapacityOverride[] }
export type GeneratorInput = {
  courses: GeneratorCourse[]
  teachers: AcademicTeacher[]
  rooms: AcademicRoom[]
  compatibleGroups: CompatibleCourseGroup[]
  windows: TimeInterval[]
  startStepMinutes: number
  maxExplorations: number
  allocationPolicy?: AllocationPolicy
  planningPolicy?: PlanningPolicy
}
export type RequiredSession = {
  id: string
  sectionId: string
  courseId: string
  durationMinutes: number
  type?: string
  order: number
}
export type CoverageIssue = {
  code: 'INVALID_REQUIREMENTS' | 'INVALID_SOURCE' | 'CATALOG_MISMATCH' | 'INVALID_SCHEDULE' | 'MISSING_SESSION' | 'UNEXPECTED_SESSION'
    | 'SECTION_MISMATCH' | 'COURSE_MISMATCH' | 'DURATION_MISMATCH'
    | 'SECTION_DELIVERY_POLICY'
  sessionId: string | null
  message: string
}
export type SessionCoverage = {
  complete: boolean
  missingSessionIds: string[]
  issues: CoverageIssue[]
}
export type GeneratorDiagnostic = {
  code: string
  message: string
  sessionIds: string[]
}
export type GeneratorResult = Pick<AcademicProposal, 'coverageProof' | 'capacityCertificate' | 'decisions' | 'prelation'> & {
  status: 'complete' | 'impossible' | 'search-limit' | 'invalid-input'
  schedule: AcademicSchedule | null
  requirements: RequiredSession[]
  coverage: SessionCoverage | null
  exploredCandidates: number
  backtracks: number
  candidateVisits: number
  limitReason: 'explorations' | 'work' | 'time' | null
  rejectionCounts: Partial<Record<ScheduleIssueCode, number>>
  diagnostics: GeneratorDiagnostic[]
}

export type GeneratorExecutionOptions = {
  maxElapsedMs?: number
  maxCandidateVisits?: number
  
  now?: () => number
}

/** F-0: fixed placements and exclusions for partial regeneration. Never part of GeneratorInput or retention. */
export type GeneratorSeed = {
  fixedAssignments: AcademicAssignment[]
  excludedTeacherIds: string[]
  sectionRoomExclusions: Array<{ sectionId: string, roomIds: string[] }>
}

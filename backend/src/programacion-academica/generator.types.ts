import type { CourseDemand } from './programacion-academica.types.js'
import type { AcademicSchedule, AcademicTeacher, AcademicRoom, CompatibleCourseGroup, ScheduleIssueCode, TimeInterval } from './schedule.types.js'

export type WeeklySession = {
  id: string
  durationMinutes: number
  type?: string
}
export type DeliveryMode = 'continuous' | 'split'
export type AllocationPolicy = 'preferences' | 'balanced' | 'first-feasible'
export type GeneratorCourse = CourseDemand & { weeklySessions: WeeklySession[], deliveryMode?: DeliveryMode }
export type GeneratorInput = {
  courses: GeneratorCourse[]
  teachers: AcademicTeacher[]
  rooms: AcademicRoom[]
  compatibleGroups: CompatibleCourseGroup[]
  windows: TimeInterval[]
  startStepMinutes: number
  maxExplorations: number
  allocationPolicy?: AllocationPolicy
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
export type GeneratorResult = {
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

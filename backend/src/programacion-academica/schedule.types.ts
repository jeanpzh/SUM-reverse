import type { NormativeTeacher, LoadAuthorizationKind } from '../../../shared/academic-normative-profile.mjs'
export type TimeInterval = {
  day: number
  startMinute: number
  endMinute: number
}
export type AcademicTeacher = NormativeTeacher & {
  configurationMaxWeeklyMinutes?: number
  exceptionMaxWeeklyMinutes?: number
  exceptionKind?: LoadAuthorizationKind | 'configuration-adjustment'
  appointmentTier?: 0 | 1 | 2
  categoryRank?: number
  id: string
  courseIds: string[]
  availability: TimeInterval[]
  maxWeeklyMinutes: number
  preferences?: TimeInterval[]
  sectionLimits?: Array<{ courseId: string, maxSections: number }>
  facultyId?: string
  category?: 'principal' | 'asociado' | 'auxiliar'
  qualificationSource?: 'synthetic'
}
export type AcademicRoom = {
  id: string
  capacity: number
  availability: TimeInterval[]
  kind?: 'classroom' | 'laboratory'
}
export type AcademicSection = {
  id: string
  courseId: string
  capacity: number
  cycle?: number
  ordinal?: number
}
/** One scheduled session, not the entire weekly load of a section. */
export type AcademicAssignment = {
  id: string
  sectionId: string
  teacherId: string
  roomId: string
  interval: TimeInterval
  sessionType?: string
}
export type CompatibleCourseGroup = {
  id: string
  courseIds: string[]
}
export type AcademicSchedule = {
  courses: string[]
  teachers: AcademicTeacher[]
  rooms: AcademicRoom[]
  sections: AcademicSection[]
  assignments: AcademicAssignment[]
  compatibleGroups: CompatibleCourseGroup[]
}
export type ScheduleIssueCode = 'INVALID_INPUT' | 'RESOURCE_NOT_FOUND'
  | 'TEACHER_CONFLICT' | 'ROOM_CONFLICT' | 'SECTION_CONFLICT' | 'COURSE_GROUP_CONFLICT'
  | 'ROOM_CAPACITY' | 'TEACHER_UNAVAILABLE' | 'ROOM_UNAVAILABLE'
  | 'TEACHER_NOT_QUALIFIED' | 'TEACHER_LOAD_EXCEEDED' | 'TEACHER_SECTION_LIMIT' | 'SECTION_TEACHER_MISMATCH' | 'ROOM_KIND_MISMATCH' | 'COHORT_CONFLICT'
export type ScheduleIssue = {
  code: ScheduleIssueCode
  resourceType: 'input' | 'course' | 'teacher' | 'room' | 'section' | 'group'
  resourceId: string | null
  assignmentIds: string[]
  field: string | null
  message: string
}
export type ScheduleValidation = {
  valid: boolean
  issues: ScheduleIssue[]
}

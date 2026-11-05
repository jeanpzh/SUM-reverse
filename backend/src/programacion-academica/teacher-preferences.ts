import type { GeneratorInput, RequiredSession } from './generator.types.js'
import type { AcademicSchedule, TimeInterval } from './schedule.types.js'

export type TeacherPreferenceReport = {
  policy: NonNullable<GeneratorInput['allocationPolicy']>
  evaluatedSections: number
  withinPreferenceSections: number
  outsidePreferenceSections: number
  withoutPreferenceSections: number
  optimality: 'not-proven'
}

function covers(windows: TimeInterval[], interval: TimeInterval): boolean {
  let end = interval.startMinute
  for (const window of windows.filter((item) => item.day === interval.day).sort((a, b) => a.startMinute - b.startMinute)) {
    if (window.endMinute <= end) continue
    if (window.startMinute > end) return false
    end = window.endMinute
    if (end >= interval.endMinute) return true
  }
  return false
}

/** Counts only sections whose every required session has a scheduled assignment. */
export function assessTeacherPreferences(
  input: GeneratorInput,
  schedule: Pick<AcademicSchedule, 'sections' | 'teachers' | 'assignments'>,
  requirements: RequiredSession[],
): TeacherPreferenceReport {
  const teachers = new Map(schedule.teachers.map((teacher) => [teacher.id, teacher]))
  const assigned = new Map(schedule.assignments.map((assignment) => [assignment.id, assignment]))
  let evaluatedSections = 0
  let withinPreferenceSections = 0
  let outsidePreferenceSections = 0
  let withoutPreferenceSections = 0

  for (const section of schedule.sections) {
    const sectionRequirements = requirements.filter((item) => item.sectionId === section.id)
    if (!sectionRequirements.length || sectionRequirements.some((item) => !assigned.has(item.id))) continue
    evaluatedSections++
    const sessions = sectionRequirements.map((item) => assigned.get(item.id)!)
    const teacher = teachers.get(sessions[0]!.teacherId)
    if (!teacher?.preferences?.length) {
      withoutPreferenceSections++
      continue
    }
    if (sessions.every((session) => covers(teacher.preferences!, session.interval))) withinPreferenceSections++
    else outsidePreferenceSections++
  }

  return { policy: input.allocationPolicy ?? 'preferences', evaluatedSections, withinPreferenceSections,
    outsidePreferenceSections, withoutPreferenceSections, optimality: 'not-proven' }
}

/** Candidate rank for a proposed block; preferences remain soft and never remove candidates. */
export function preferenceRank(preferences: TimeInterval[] | undefined, intervals: TimeInterval[]): 0 | 1 | 2 {
  if (!preferences?.length) return 1
  return intervals.every((interval) => covers(preferences, interval)) ? 0 : 2
}

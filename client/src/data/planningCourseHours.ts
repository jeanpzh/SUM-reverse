import type { AcademicWeeklySession } from '../../../shared/programacion-academica-api.mjs'
import { normalizeAcademicSearch } from './academicScheduling.ts'
import type { AcademicCatalog } from './academicScheduling.ts'

export type CourseComponentType = 'T' | 'P' | 'L'
export type CourseComponentHoursTuple = [number, number, number] | ['—', '—', '—']

const SESSION_TYPE_MAP = new Map<string, CourseComponentType>([
  ['t', 'T'],
  ['teor', 'T'],
  ['teor.', 'T'],
  ['teoria', 'T'],
  ['p', 'P'],
  ['pr', 'P'],
  ['pr.', 'P'],
  ['pract', 'P'],
  ['pract.', 'P'],
  ['practica', 'P'],
  ['l', 'L'],
  ['lab', 'L'],
  ['lab.', 'L'],
  ['laboratorio', 'L'],
])

export function classifyCourseSessionType(type: string | undefined): CourseComponentType | null {
  if (typeof type !== 'string') return null
  return SESSION_TYPE_MAP.get(normalizeAcademicSearch(type)) ?? null
}

export function resolveCoursePlanningSessions(
  course: AcademicCatalog['courses'][number],
  selectedPatternId?: string,
): AcademicWeeklySession[] | null {
  if (typeof selectedPatternId === 'string' && selectedPatternId.length > 0) {
    const matched = course.planningPatterns?.find((pattern) => pattern.id === selectedPatternId)
    return matched ? matched.weeklySessions : null
  }
  return course.weeklySessions
}

export function calculateCourseComponentHours(
  course: AcademicCatalog['courses'][number],
  selectedPatternId?: string,
): CourseComponentHoursTuple {
  const sessions = resolveCoursePlanningSessions(course, selectedPatternId)
  if (!sessions || sessions.length === 0) return ['—', '—', '—']

  const minutes: Record<CourseComponentType, number> = { T: 0, P: 0, L: 0 }
  for (const session of sessions) {
    const component = classifyCourseSessionType(session.type)
    if (
      component === null
      || typeof session.durationMinutes !== 'number'
      || !Number.isFinite(session.durationMinutes)
      || session.durationMinutes <= 0
    ) {
      return ['—', '—', '—']
    }
    minutes[component] += session.durationMinutes
  }

  return [minutes.T / 60, minutes.P / 60, minutes.L / 60]
}

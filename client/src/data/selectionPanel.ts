import type {
  MatriculaRegularChoice,
  MatriculaRegularCourseDocument,
  MatriculaRegularId,
  MatriculaRegularOfferedCourse,
  MatriculaRegularMeeting,
} from '../../../shared/matricula-regular.mjs'

export interface SelectableCourseComputation {
  isComplete: boolean
  gapCode: string | null
  courses: MatriculaRegularOfferedCourse[]
}

export function computeSelectableCourses(options: {
  preEnrollmentComplete: boolean
  offerKnown: boolean
  planId: MatriculaRegularId
  preEnrollment: readonly MatriculaRegularCourseDocument[]
  offer: readonly MatriculaRegularOfferedCourse[]
}): SelectableCourseComputation {
  const { preEnrollmentComplete, offerKnown, planId, preEnrollment, offer } = options

  if (!preEnrollmentComplete || !offerKnown) {
    return {
      isComplete: false,
      gapCode: 'PLAN_OR_OFFER_UNKNOWN',
      courses: [],
    }
  }

  // Pre-enrollment courses belonging to the plan
  const preEnrollmentCourseIds = new Set(
    preEnrollment
      .filter((doc) => doc.planId === planId)
      .map((doc) => doc.courseId),
  )

  // Intersection: offered in same plan AND present in preEnrollment
  const selectable = offer.filter(
    (offered) => offered.planId === planId && preEnrollmentCourseIds.has(offered.courseId),
  )

  return {
    isComplete: true,
    gapCode: null,
    courses: selectable,
  }
}

export function calculateSelectionTotalCredits(
  choices: readonly MatriculaRegularChoice[],
  offer: readonly MatriculaRegularOfferedCourse[],
): number {
  const selectedCourseIds = new Set(choices.map((c) => c.courseId))
  let total = 0

  for (const offered of offer) {
    if (selectedCourseIds.has(offered.courseId)) {
      total += offered.credits
    }
  }

  return total
}

export function validateSelectionRules(choices: readonly MatriculaRegularChoice[]): {
  isValid: boolean
  errorMessage: string | null
} {
  const courseIds = new Set<string>()
  for (const choice of choices) {
    if (courseIds.has(choice.courseId)) {
      return {
        isValid: false,
        errorMessage: `Selección duplicada detectada para la asignatura ${choice.courseId}. Cada asignatura admite a lo más una sección.`,
      }
    }
    courseIds.add(choice.courseId)
  }

  return {
    isValid: true,
    errorMessage: null,
  }
}

export function formatMeetingSchedule(schedule: readonly MatriculaRegularMeeting[] | null): string {
  if (schedule === null) {
    return 'Horario no especificado (null / gap)'
  }
  if (schedule.length === 0) {
    return 'Sin horarios asignados'
  }

  const dayNames = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  return schedule
    .map((m) => {
      const day = dayNames[m.day] ?? `Día ${m.day}`
      const startH = String(Math.floor(m.startMinute / 60)).padStart(2, '0')
      const startM = String(m.startMinute % 60).padStart(2, '0')
      const endH = String(Math.floor(m.endMinute / 60)).padStart(2, '0')
      const endM = String(m.endMinute % 60).padStart(2, '0')
      return `${day} ${startH}:${startM}-${endH}:${endM}`
    })
    .join(', ')
}

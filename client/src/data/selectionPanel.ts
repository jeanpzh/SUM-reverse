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

const SESSION_TYPE_LABELS: Record<'T' | 'P' | 'L', string> = {
  T: 'Teoría',
  P: 'Práctica',
  L: 'Laboratorio',
}

const DAY_NAMES = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export interface MeetingSessionDetail {
  day: string
  time: string
  sessionType: string | null
  room: string
  teacher: string
  summary: string
}

function formatMeetingWindow(meeting: MatriculaRegularMeeting): { day: string; time: string } {
  const day = DAY_NAMES[meeting.day] ?? `Día ${meeting.day}`
  const startH = String(Math.floor(meeting.startMinute / 60)).padStart(2, '0')
  const startM = String(meeting.startMinute % 60).padStart(2, '0')
  const endH = String(Math.floor(meeting.endMinute / 60)).padStart(2, '0')
  const endM = String(meeting.endMinute % 60).padStart(2, '0')
  return { day, time: `${startH}:${startM}-${endH}:${endM}` }
}

export function formatSingleMeeting(meeting: MatriculaRegularMeeting): string {
  const { day, time } = formatMeetingWindow(meeting)
  const base = `${day} ${time}`
  if (!meeting.details) return base
  const sessionType = meeting.details.sessionType ? SESSION_TYPE_LABELS[meeting.details.sessionType] : null
  const parts = [sessionType, meeting.details.roomName, meeting.details.teacherName].filter(Boolean)
  return parts.length > 0 ? `${base} (${parts.join(' · ')})` : base
}

export function describeMeetingSessions(
  schedule: readonly MatriculaRegularMeeting[] | null,
): MeetingSessionDetail[] {
  if (!schedule || !schedule.some((meeting) => Boolean(meeting.details))) {
    return []
  }
  return schedule.map((meeting) => {
    const { day, time } = formatMeetingWindow(meeting)
    const sessionType = meeting.details?.sessionType
      ? SESSION_TYPE_LABELS[meeting.details.sessionType]
      : null
    return {
      day,
      time,
      sessionType,
      room: meeting.details?.roomName ?? '—',
      teacher: meeting.details?.teacherName ?? '—',
      summary: formatSingleMeeting(meeting),
    }
  })
}

export function formatMeetingSchedule(schedule: readonly MatriculaRegularMeeting[] | null): string {
  if (schedule === null) {
    return 'Horario no especificado (null / gap)'
  }
  if (schedule.length === 0) {
    return 'Sin horarios asignados'
  }

  return schedule.map(formatSingleMeeting).join(', ')
}

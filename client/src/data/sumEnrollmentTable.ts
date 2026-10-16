import type {
  MatriculaRegularChoice,
  MatriculaRegularContext,
  MatriculaRegularId,
  MatriculaRegularOfferedCourse,
  MatriculaRegularSection,
} from '../../../shared/matricula-regular.mjs'
import { calculateSelectionTotalCredits, computeSelectableCourses, formatMeetingSchedule } from './selectionPanel.ts'

/** V-02 shows «O - Obligatorio»; «E - Electivo» is an inferred label. */
export const COURSE_TYPE_LABELS = { mandatory: 'O - Obligatorio', elective: 'E - Electivo' } as const
export const UNKNOWN_CELL = '--'

export interface SumEnrollmentRow {
  courseId: MatriculaRegularId
  cycle: string
  type: string
  subject: string
  credits: number
  mandatory: boolean
  chosenSection: string | null
}

export interface SectionOption {
  sectionId: MatriculaRegularId
  label: string
  room: string
  teacher: string
  occupancy: string
  schedule: string
}

export interface SelectionSummary {
  creditCap: string
  credits: number
  courses: number
}

export function sectionLabel(section: MatriculaRegularSection): string {
  return section.label ?? section.sectionId
}

/** L-05 intersection of complete pre-enrollment and applicable offer; incomplete data selects nothing. */
export function selectableCourses(context: MatriculaRegularContext): MatriculaRegularOfferedCourse[] {
  const result = computeSelectableCourses({
    preEnrollmentComplete: context.preEnrollmentComplete,
    offerKnown: context.offerKnown,
    planId: context.scope.planId,
    preEnrollment: context.preEnrollment,
    offer: context.offer,
  })
  return result.isComplete ? result.courses : []
}

/** V-02: rows ordered by cycle (unknown last); within a cycle the offer order is kept (stable sort). */
export function buildEnrollmentRows(
  context: MatriculaRegularContext,
  choices: readonly MatriculaRegularChoice[],
): SumEnrollmentRow[] {
  const retake = new Set(context.retakeCourseIds ?? [])
  const cycleOrder = (course: MatriculaRegularOfferedCourse) => course.cycle ?? Number.MAX_SAFE_INTEGER
  return [...selectableCourses(context)]
    .sort((left, right) => cycleOrder(left) - cycleOrder(right))
    .map((course) => {
      const choice = choices.find((item) => item.courseId === course.courseId)
      const section = choice ? course.sections.find((item) => item.sectionId === choice.sectionId) : undefined
      const mandatory = retake.has(course.courseId)
      const cycle = course.cycle ?? null
      const courseType = course.courseType ?? null
      return {
        courseId: course.courseId,
        cycle: cycle === null ? UNKNOWN_CELL : String(cycle),
        type: courseType === null ? UNKNOWN_CELL : COURSE_TYPE_LABELS[courseType],
        subject: `${course.courseId} - ${course.name}${mandatory ? ' (*)' : ''}`,
        credits: course.credits,
        mandatory,
        chosenSection: section ? sectionLabel(section) : (choice ? choice.sectionId : null),
      }
    })
}

export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/** L-12: case- and accent-insensitive substring search; an empty query matches everything. */
export function matchesSearch(fields: readonly string[], query: string): boolean {
  const needle = normalizeSearch(query)
  return needle === '' || normalizeSearch(fields.join(' ')).includes(needle)
}

export function filterEnrollmentRows(rows: readonly SumEnrollmentRow[], query: string): SumEnrollmentRow[] {
  return rows.filter((row) => matchesSearch([row.cycle, row.type, row.subject, String(row.credits)], query))
}

/** V-04: one row per section; full sections stay selectable (the server rejects SECTION_FULL on execute). */
export function buildSectionOptions(course: MatriculaRegularOfferedCourse): SectionOption[] {
  return course.sections.map((section) => ({
    sectionId: section.sectionId,
    label: sectionLabel(section),
    room: section.room ?? '-',
    teacher: section.teacher ?? '-',
    occupancy: `${section.occupied} / ${section.capacity}`,
    schedule: formatMeetingSchedule(section.schedule),
  }))
}

export function chooseSection(
  choices: readonly MatriculaRegularChoice[],
  courseId: MatriculaRegularId,
  sectionId: MatriculaRegularId,
): MatriculaRegularChoice[] {
  return [...choices.filter((item) => item.courseId !== courseId), { courseId, sectionId }]
}

export function removeChoice(choices: readonly MatriculaRegularChoice[], courseId: MatriculaRegularId): MatriculaRegularChoice[] {
  return choices.filter((item) => item.courseId !== courseId)
}

/** V-05 totals: «Tope de créditos», «Créditos matriculados», «Asignaturas matriculadas». */
export function summarizeSelection(
  context: MatriculaRegularContext,
  choices: readonly MatriculaRegularChoice[],
): SelectionSummary {
  const creditCap = context.creditCap ?? null
  return {
    creditCap: creditCap === null ? UNKNOWN_CELL : String(creditCap),
    credits: calculateSelectionTotalCredits(choices, context.offer),
    courses: choices.length,
  }
}

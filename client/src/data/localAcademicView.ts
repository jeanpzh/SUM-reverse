import type { AcademicKey, ReportKey } from './localProfileDashboard.ts'
import type { MatriculaRegularContext, MatriculaRegularEnrollmentReport } from './matriculaRegular.ts'
import type { MatriculaRegularMeeting, MatriculaRegularSection } from '../../../shared/matricula-regular.mjs'
import { buildSumReportView, type SumReportView } from './regularEnrollmentReport.ts'

export type LocalAcademicKind = AcademicKey | ReportKey | 'perfil'
export type LocalAcademicResponse = MatriculaRegularContext | MatriculaRegularEnrollmentReport | null

export function buildScheduleFromCommittedReport(report: MatriculaRegularEnrollmentReport | null): SumReportView | null {
  return report === null ? null : buildSumReportView(report)
}

export function localAcademicContext(response: LocalAcademicResponse): MatriculaRegularContext | null {
  if (response === null || 'enrollmentId' in response) return null
  return response
}

export const PROGRAMMING_HEADERS = ['', 'Asignatura', 'Créd.', 'Sec.', 'Docente', 'Tope', 'Matriculados', 'Horarios']
export const PRE_ENROLLMENT_HEADERS = ['Plan', 'Ciclo', 'Asignatura', 'Créditos', 'Nro. Rep', 'Nro. Mat. Equiv', 'Nro. Rep. Total', 'Etapa']
export const ENROLLMENT_HEADERS = ['Ciclo', 'Asignatura', 'Créditos', 'Sección', 'Docente Asignado']
export const STUDY_PLAN_HEADERS = ['Esp.', 'Asignatura', 'Créd.', 'Tipo', 'Grupo', 'Pre-Requisito', 'Grupo']

export interface ProgrammingRow {
  cycle: number | null
  courseId: string
  name: string
  credits: number
  section: MatriculaRegularSection
}

export interface ScheduleDisplayEvent {
  day: number
  start: number
  end: number
  course: string
  section: string
  kind: string
  time: string
}

const unknown = '—'

export function buildProgrammingRows(context: MatriculaRegularContext): ProgrammingRow[] {
  return context.offer.flatMap((course) => course.sections.map((section) => ({
    cycle: course.cycle ?? null,
    courseId: course.courseId,
    name: course.name,
    credits: course.credits,
    section,
  }))).sort((a, b) => (a.cycle ?? Number.MAX_SAFE_INTEGER) - (b.cycle ?? Number.MAX_SAFE_INTEGER)
    || a.courseId.localeCompare(b.courseId) || (a.section.label ?? a.section.sectionId).localeCompare(b.section.label ?? b.section.sectionId))
}

export function formatProgrammingRow(row: ProgrammingRow): string[] {
  return ['', `${row.courseId} - ${row.name}`, String(row.credits), row.section.label ?? row.section.sectionId,
    row.section.teacher ?? unknown, String(row.section.capacity), String(row.section.occupied), row.section.schedule === null
      ? unknown : row.section.schedule.length ? row.section.schedule.map(formatMeeting).join('; ') : 'Sin horario']
}

function formatMeeting(meeting: MatriculaRegularMeeting) {
  const day = ['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][meeting.day] ?? unknown
  return `${day} ${formatMinute(meeting.startMinute)}-${formatMinute(meeting.endMinute)}`
}

function formatMinute(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function buildPreEnrollmentRows(context: MatriculaRegularContext): string[][] {
  const courseById = new Map(context.offer.map((course) => [course.courseId, course]))
  return context.preEnrollment.map((course) => [course.planId, courseById.get(course.courseId)?.cycle == null
    ? unknown : String(courseById.get(course.courseId)!.cycle), `${course.courseId} - ${course.name}`, String(course.credits),
  unknown, unknown, unknown, unknown])
}

export function buildStudyPlanRows(context: MatriculaRegularContext): string[][] {
  const courseById = new Map(context.offer.map((course) => [course.courseId, course]))
  return context.offer.map((course) => [unknown, `${course.courseId} - ${course.name}`, String(course.credits),
    course.courseType === 'mandatory' ? 'Obligatoria' : course.courseType === 'elective' ? 'Electiva' : unknown,
    unknown, course.prerequisiteIds.map((id) => courseById.get(id)?.name ? `${id} - ${courseById.get(id)!.name}` : id).join(', ') || unknown,
    unknown])
}

export function buildScheduleEvents(report: MatriculaRegularEnrollmentReport | null): ScheduleDisplayEvent[] {
  return report?.rows.flatMap((row) => row.schedule.map((meeting) => ({
    day: meeting.day,
    start: meeting.startMinute,
    end: meeting.endMinute,
    course: row.name,
    section: row.label ?? row.sectionId,
    kind: unknown,
    time: `${formatMinute(meeting.startMinute)}-${formatMinute(meeting.endMinute)}`,
  }))) ?? []
}

import {
  validateActorId,
  validateReportQuery,
} from '../../../shared/matricula-regular.mjs'
import type {
  MatriculaRegularEnrollmentReport,
  MatriculaRegularId,
  MatriculaRegularOutcome,
  MatriculaRegularScope,
  MatriculaRegularUuid,
  MatriculaRegularWindowOrigin,
} from '../../../shared/matricula-regular.mjs'
import { formatMeetingSchedule } from './selectionPanel.ts'
import { formatLimaDateTime } from './sumEnrollmentFormat.ts'

/** Report route owned by the client. The backend `reportPath` is only used to confirm the enrollmentId. */
export const REPORT_ROUTE_PATH = '/local/matricula-regular/reporte/$enrollmentId'
export const REPORT_HEADING_ID = 'regular-enrollment-report-heading'
const BACKEND_REPORT_PREFIX = '/local/matricula-regular/v1/reportes/'

export interface ReportSearch {
  runId: MatriculaRegularUuid
  actorId: MatriculaRegularId
}

export interface ReportLink {
  enrollmentId: MatriculaRegularUuid
  search: ReportSearch
}

export interface ReportView {
  headers: string[]
  rows: string[][]
  courseCount: number
  totalCredits: number
  scope: MatriculaRegularScope
  acceptedAt: string
  windowOriginLabel: string
  csv: { name: string; headers: string[]; rows: string[][] }
}

/**
 * Maps an accepted Outcome to the React route. Only a path that is exactly the documented backend report path
 * for the same enrollmentId is accepted; no remote, absolute or foreign URL is ever followed.
 */
export function reportLinkFromOutcome(
  outcome: MatriculaRegularOutcome,
  runId: MatriculaRegularUuid,
): ReportLink | null {
  if (outcome.state !== 'accepted' || outcome.enrollmentId === null || outcome.reportPath === null) return null
  if (outcome.reportPath !== `${BACKEND_REPORT_PREFIX}${outcome.enrollmentId}`) return null
  return { enrollmentId: outcome.enrollmentId, search: { runId, actorId: outcome.actorId } }
}

/** Route search validation with the real wire validators; throws TypeError (route error component) when invalid. */
export function parseReportSearch(raw: Record<string, unknown>): ReportSearch {
  const query = { runId: raw.runId, actorId: raw.actorId }
  validateReportQuery(query)
  validateActorId(query.actorId)
  if (Object.keys(raw).length !== 2) throw new TypeError('reportSearch: claves no permitidas')
  return { runId: query.runId, actorId: query.actorId }
}

const REPORT_HEADERS = ['Código', 'Asignatura', 'Sección', 'Créditos', 'Horario de Clases', 'Plan']

function windowOriginLabel(origin: MatriculaRegularWindowOrigin): string {
  return origin === 'synthetic' ? 'Ventana sintética de prueba' : 'Ventana derivada de calendario publicado'
}

/** Projection of the accepted enrollment only: rows come from the report, never from a legacy shell or seed. */
export function buildReportView(report: MatriculaRegularEnrollmentReport): ReportView {
  const rows = report.rows.map((row) => [
    row.courseId, row.name, row.sectionId, String(row.credits), formatMeetingSchedule(row.schedule), row.planId,
  ])
  return {
    headers: REPORT_HEADERS,
    rows,
    courseCount: report.rows.length,
    totalCredits: report.totalCredits,
    scope: report.scope,
    acceptedAt: report.acceptedAt,
    windowOriginLabel: windowOriginLabel(report.windowOrigin),
    // The base name carries no extension: the shared DownloadButton appends exactly one «.csv».
    csv: { name: `reporte-matricula-regular-local-${report.actorId}`, headers: REPORT_HEADERS, rows },
  }
}

/** V-08 (#38) columns and the observed placeholder for a section without teacher. */
export const SUM_REPORT_HEADERS = ['Ciclo', 'Asignatura', 'Créditos', 'Sección', 'Docente Asignado']
export const NO_TEACHER = '-- --, --'

export interface SumReportView {
  headers: string[]
  rows: string[][]
  acceptedAt: string
  enrollmentType: string
  totalCredits: number
  courseCount: number
  csv: { name: string; headers: string[]; rows: string[][] }
}

/** Projection of the accepted enrollment for the SUM-style report; rows ordered by cycle (unknown last, stable). */
export function buildSumReportView(report: MatriculaRegularEnrollmentReport): SumReportView {
  const cycleOrder = (cycle: number | null | undefined) => cycle ?? Number.MAX_SAFE_INTEGER
  const rows = [...report.rows]
    .sort((left, right) => cycleOrder(left.cycle) - cycleOrder(right.cycle))
    .map((row) => {
      const cycle = row.cycle ?? null
      return [
        cycle === null ? '--' : String(cycle),
        `${row.courseId} - ${row.name}`,
        String(row.credits),
        row.label ?? row.sectionId,
        row.teacher ?? NO_TEACHER,
      ]
    })
  return {
    headers: SUM_REPORT_HEADERS,
    rows,
    acceptedAt: formatLimaDateTime(report.acceptedAt, 'schedule'),
    enrollmentType: 'Matrícula Vía Web',
    totalCredits: report.totalCredits,
    courseCount: report.rows.length,
    // The base name carries no extension: the shared DownloadButton appends exactly one «.csv».
    csv: { name: `reporte-matricula-${report.actorId}`, headers: SUM_REPORT_HEADERS, rows },
  }
}

/** V-08: «Mostrando 1 - N de N registros». */
export function formatRecordRange(count: number): string {
  return count === 0 ? 'Mostrando 0 - 0 de 0 registros' : `Mostrando 1 - ${count} de ${count} registros`
}

import type { MatriculaRegularContext, MatriculaRegularEnrollmentReport } from '../../../shared/matricula-regular.mjs'

const LIMA = 'America/Lima'
const UNKNOWN = '--'

function limaParts(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LIMA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00'
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

/** O-UI-01: «Fecha del Sistema» = YYYY-MM-DD HH:mm:ss; schedule dates and «Fecha y Hora» = DD/MM/YYYY HH:mm:ss. */
export function formatLimaDateTime(iso: string, style: 'system' | 'schedule'): string {
  const p = limaParts(iso)
  return style === 'system'
    ? `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
    : `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`
}

/** O-UI-01 shows «2026-2» for the local period «2026-II». */
export function formatSumPeriod(period: string): string {
  const match = /^(\d{4})-(I{1,2})$/.exec(period)
  return match ? `${match[1]}-${match[2]!.length}` : period
}

export interface InfoSection {
  titulo: string
  parts: Array<{ text: string; strong?: boolean }>
}

/** Literal text of O-UI-01 (#30). */
export const SUM_ENROLLMENT_INFO: { introduccion: string; secciones: InfoSection[] } = {
  introduccion: 'Información importante acerca del módulo de Matrícula Vía Web',
  secciones: [
    { titulo: 'Control de Cronograma de Matrícula', parts: [
      { text: 'Verificación de Fechas de Inicio y Fin de Matrícula del Período Vigente y de Acceso al Módulo de Matrícula.' },
    ] },
    { titulo: 'Control de Acceso de Facultad', parts: [
      { text: 'Verificación de la Programación Interna establecida por la Oficina de Matrícula de su Facultad.' },
    ] },
    { titulo: 'Control de Pre-Matrícula', parts: [
      { text: 'Verificación del Registro de Pre-Matrícula el cual debe haber sido procesado por la Oficina de Matrícula de su Facultad. De no existir debe acercarse a la Oficina de Matricula personalmente.' },
    ] },
    { titulo: 'Control de Deudas Registradas', parts: [
      { text: 'Verificación de registros de deudas de dinero o de material bibliográfico. Esta información nos la remite la Oficina de Matrícula de su facultad. De registrar deudas pendientes debe acercarse personalmente a la Oficina de Matrícula de su Facultad.' },
    ] },
    { titulo: 'Interfaz de Matrícula', parts: [
      { text: 'Presentación de Asignaturas de Pre-Matrícula y secciones abiertas. ' },
      { text: 'Efectuar Matrícula', strong: true },
      { text: ' registrará su matrícula. Si la Matrícula se efectúa ' },
      { text: 'satisfactoriamente', strong: true },
      { text: ', se mostrará automáticamente el Reporte de Matrícula vigente, de lo contrario mostrará un error.' },
    ] },
  ],
}

export interface EnrollmentStatusView {
  enabled: boolean
  banner: 'MATRICULA INTERNET HABILITADA' | 'MATRICULA INTERNET INHABILITADA'
  period: string
  systemDate: string
  start: string
  end: string
  enrolled: boolean
  canStart: boolean
}

/**
 * Right card of O-UI-01/V-01. Enabled = eligible synthetic context. Start/end span every effective window
 * (local-only: SUM shows the faculty period). Enrolled = a committed report exists (L-11 hides «Iniciar»).
 */
export function buildEnrollmentStatus(
  context: MatriculaRegularContext,
  report: MatriculaRegularEnrollmentReport | null,
): EnrollmentStatusView {
  const enabled = context.eligibility.state === 'eligible'
  const starts = context.calendar.effectiveWindows.map((window) => window.startsAt).sort()
  const ends = context.calendar.effectiveWindows.map((window) => window.endsAt).sort()
  const enrolled = report !== null
  return {
    enabled,
    banner: enabled ? 'MATRICULA INTERNET HABILITADA' : 'MATRICULA INTERNET INHABILITADA',
    period: formatSumPeriod(context.scope.period),
    systemDate: formatLimaDateTime(context.serverNow, 'system'),
    start: starts.length ? formatLimaDateTime(starts[0]!, 'schedule') : UNKNOWN,
    end: ends.length ? formatLimaDateTime(ends[ends.length - 1]!, 'schedule') : UNKNOWN,
    enrolled,
    canStart: enabled && !enrolled,
  }
}

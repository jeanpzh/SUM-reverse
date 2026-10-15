import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { DataTable, DownloadButton, PageTitle, StudentSummary } from '../components/Common'
import { AcademicRequirementsPanel } from '../components/AcademicRequirementsPanel'
import { EnrollmentCalendarPanel } from '../components/EnrollmentCalendarPanel'
import { PreEnrollmentPanel } from '../components/PreEnrollmentPanel'
import { buildScheduleFromCommittedReport, localAcademicContext, buildProgrammingRows, formatProgrammingRow,
  buildPreEnrollmentRows, buildStudyPlanRows, PROGRAMMING_HEADERS, PRE_ENROLLMENT_HEADERS,
  ENROLLMENT_HEADERS, STUDY_PLAN_HEADERS, buildScheduleEvents } from '../data/localAcademicView'
import type { LocalAcademicKind, LocalAcademicResponse, ProgrammingRow } from '../data/localAcademicView'
import { useStudent } from '../data/useStudent'
import { WeeklySchedule } from './WeeklySchedule'

const missing = '—'

function ProgrammingTable({ rows }: { rows: ProgrammingRow[] }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ProgrammingRow | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selected && !dialog.open) dialog.showModal()
    if (!selected && dialog.open) dialog.close()
  }, [selected])
  const query = search.trim().toLocaleLowerCase()
  const visible = rows.filter((row) => !query || [row.courseId, row.name, row.section.label, row.section.sectionId, row.section.teacher,
    row.cycle === null ? '' : `ciclo${row.cycle}`].join(' ').toLocaleLowerCase().includes(query))
  return <>
    <div className="report-toolbar">
      <DownloadButton name="programacion-asignaturas" headers={PROGRAMMING_HEADERS}
        rows={rows.map(formatProgrammingRow)} />
    </div>
    <label className="history-search">Buscar: <input type="search" aria-label="Buscar asignatura" value={search}
      onChange={(event) => setSearch(event.target.value)} /></label>
    <div className="table-card"><div className="table-overflow"><table>
      <thead><tr>{PROGRAMMING_HEADERS.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead>
      <tbody>{visible.length ? visible.map((row, index) => <Fragment key={`${row.courseId}-${row.section.sectionId}-${index}`}>
        {row.cycle !== null && visible[index - 1]?.cycle !== row.cycle &&
          <tr><th scope="rowgroup" colSpan={8}>CICLO {row.cycle}</th></tr>}
        <tr>{formatProgrammingRow(row).slice(0, -1).map((cell, column) => <td key={column}>{cell}</td>)}
          <td><button className="schedule-button" aria-label={`Horarios de ${row.name}, sección ${row.section.label ?? row.section.sectionId}`}
            onClick={() => setSelected(row)} title="Ver horarios">▦</button></td>
        </tr>
      </Fragment>) : <tr><td className="empty-cell" colSpan={8}>No hay registros que coincidan.</td></tr>}</tbody>
    </table></div><p className="table-footer">Mostrando {visible.length} registros</p></div>
    <dialog ref={dialogRef} className="course-schedule-dialog" aria-labelledby="local-course-schedule-title"
      aria-describedby="local-course-schedule-context" onClose={() => setSelected(null)}
      onCancel={(event) => { event.preventDefault(); setSelected(null) }}>
      <header className="course-schedule-dialog__header">
        <h2 id="local-course-schedule-title">Horarios</h2>
        <span id="local-course-schedule-context" className="sr-only">{selected?.name} · Sección {selected?.section.label ?? selected?.section.sectionId}</span>
        <button className="course-schedule-dialog__close" onClick={() => setSelected(null)} aria-label="Cerrar horarios">×</button>
      </header>
      <div className="course-schedule-dialog__body">{!selected ? null
        : selected.section.schedule === null ? <p role="status">Horario no disponible.</p>
        : selected.section.schedule.length ? <DataTable headers={['Día', 'Horas de clase']} rows={selected.section.schedule.map((meeting) => [
          ['—', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][meeting.day] ?? missing,
          `${String(Math.floor(meeting.startMinute / 60)).padStart(2, '0')}:${String(meeting.startMinute % 60).padStart(2, '0')}-${String(Math.floor(meeting.endMinute / 60)).padStart(2, '0')}:${String(meeting.endMinute % 60).padStart(2, '0')}`,
        ])} /> : <p>No hay horarios registrados.</p>}</div>
    </dialog>
  </>
}

export function LocalAcademicView({ kind, response }: { kind: LocalAcademicKind; response: LocalAcademicResponse }) {
  const student = useStudent()
  if (kind === 'perfil') return <section className="screen-profile">
    <PageTitle>Mi Perfil</PageTitle><p>{student.name} · {student.code}</p>
    <p role="status">Datos personales no disponibles para perfiles sintéticos.</p>
  </section>

  const report = response && 'enrollmentId' in response ? response : null
  if (kind === 'matricula' || kind === 'horarios') {
    const view = buildScheduleFromCommittedReport(report)
    const title = kind === 'horarios' ? 'Horarios' : 'Reporte de matrícula'
    if (kind === 'horarios') return <section className="screen-reportes-horarios">
      <PageTitle>{title}</PageTitle><StudentSummary student={{ ...student, period: report?.scope.period ?? student.period }} />
      <p className="local-only-note">Horario del reporte de matrícula sintético; no se usa la oferta pendiente.</p>
      <WeeklySchedule data={null} displayEvents={buildScheduleEvents(report)} />
    </section>
    return <section className="screen-reportes-matricula">
      <PageTitle>{title}</PageTitle><StudentSummary student={{ ...student, period: report?.scope.period ?? student.period }} />
      <p className="local-only-note">Datos de la ejecución sintética local.</p>
      {view && <section className="report-section">
        <h3>ASIGNATURAS MATRICULADAS</h3>
        <p>Fecha y Hora: {view.acceptedAt}</p><p>Tipo: Matrícula Vía Web</p>
        <div className="report-toolbar"><DownloadButton name={view.csv.name} headers={view.csv.headers} rows={view.csv.rows} /></div>
        <DataTable headers={view.headers} rows={view.rows} empty="No hay registros" />
        <p>Créditos matriculados: {view.totalCredits}</p><p>Asignaturas matriculadas: {view.courseCount}</p>
      </section>}
      {!view && <DataTable headers={ENROLLMENT_HEADERS} rows={[]} empty="No hay una matrícula confirmada para este perfil sintético." />}
    </section>
  }

  const context = localAcademicContext(response)
  if (!context) return <p role="status">La información académica local no está disponible.</p>
  const title = kind === 'matriculaInfo' ? 'Información de Matrícula'
    : kind === 'prematricula' ? 'Prematrícula' : kind === 'plan' ? 'Plan de Estudios' : 'Programación de asignaturas'
  const summary = { ...student, period: context.scope.period }
  const courses = buildProgrammingRows(context)
  const planRows = buildStudyPlanRows(context)
  const prematRows = buildPreEnrollmentRows(context)
  return <div className={`screen-local-academic screen-${kind}`}>
    <PageTitle>{title}</PageTitle><StudentSummary student={summary} />
    {kind === 'matriculaInfo' && <Link to="/local/matricula-regular">Ver matrícula</Link>}
    {kind === 'matriculaInfo' && <>
      <PreEnrollmentPanel context={context} />
      <EnrollmentCalendarPanel calendar={context.calendar} eligibility={context.eligibility}
        sources={context.sources} serverNow={context.serverNow} />
      <AcademicRequirementsPanel context={context} />
    </>}
    {kind === 'programacion' && <ProgrammingTable rows={courses} />}
    {kind === 'prematricula' && <section className="report-section">
      <p className="local-only-note">Documento de prematrícula sintético del perfil activo.</p>
      <div className="report-toolbar"><DownloadButton name="reportes-prematricula" headers={PRE_ENROLLMENT_HEADERS} rows={prematRows} /></div>
      <DataTable headers={PRE_ENROLLMENT_HEADERS} rows={prematRows} empty={context.preEnrollmentComplete
        ? 'No hay asignaturas pendientes registradas en este documento.' : 'Documento incompleto; asignaturas pendientes desconocidas.'} />
    </section>}
    {kind === 'plan' && <section className="report-section">
      <p className="local-only-note">Cursos conocidos de la oferta sintética; esta vista no representa el plan completo.</p>
      <div className="report-toolbar"><DownloadButton name="plan-estudios" headers={STUDY_PLAN_HEADERS} rows={planRows} /></div>
      <DataTable headers={STUDY_PLAN_HEADERS} rows={planRows} empty="No hay cursos conocidos para este perfil sintético." />
    </section>}
  </div>
}

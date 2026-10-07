import { useState, type ReactNode } from 'react'
import { routes } from '../data/routes'
import type { ApiResponseMap } from '../data/contracts'
import { useStudent } from '../data/useStudent'
import { toPlanRows, toPrematriculaRows, toMatriculaRows, toAttendanceRows,
  toProgrammingRows, toScheduleEvents } from '../data/adapters'
import { DataTable, DownloadButton, PageTitle, StudentSummary } from '../components/Common'
import { CourseScheduleModal } from '../components/CourseScheduleModal'

type TableScreenProps =
  | { id: 'historial' }
  | { id: 'asistencia'; response: ApiResponseMap['asistencias'] }
  | { id: 'reportes-horarios'; response: ApiResponseMap['horarios'] }
  | { id: 'tutoria'; response: ApiResponseMap['tutoria'] }
  | { id: 'reportes-evaluaciones'; response: ApiResponseMap['evaluaciones'] }
  | { id: 'reportes-deudas'; response: ApiResponseMap['deudas'] }
  | { id: 'plan-estudios'; response: ApiResponseMap['plan'] }
  | { id: 'programacion-asignaturas'; response: ApiResponseMap['programacion'] }
  | { id: 'reportes-prematricula'; response: ApiResponseMap['prematricula'] }
  | { id: 'reportes-matricula'; response: ApiResponseMap['matricula'] }

const unavailableAction = (label: string) => (
  <button className="row-action" disabled aria-label={label}>▦</button>
)

function Attendance({ data }: { data: ApiResponseMap['asistencias']['data'] }) {
  const headers = ['Asignatura', 'Sección', '# Clases', 'Puntual N°', 'Puntual (%)',
    'Tardanzas N°', 'Tardanzas (%)', 'Faltas N°', 'Faltas (%)', 'Asistencia Total N°', 'Asistencia Total (%)']
  const rows = toAttendanceRows(data)
  return (
    <section className="report-section">
      <div className="report-toolbar">
        <DownloadButton name="asistencias" headers={headers} rows={rows.map((row) => row.map(String))} />
      </div>
      <div className="table-overflow">
        <table className="attendance-table">
          <thead>
            <tr>
              <th rowSpan={2}>Asignatura</th><th rowSpan={2}>Sección</th><th rowSpan={2}># Clases</th>
              {['Puntual', 'Tardanzas', 'Faltas', 'Asistencia Total'].map((group) => (
                <th key={group} colSpan={2}>{group}</th>
              ))}
              <th rowSpan={2}>Acción</th>
            </tr>
            <tr>{Array.from({ length: 4 }, (_, i) => (
              <ReactGroup key={i} />
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${data[i].codAsignatura}-${data[i].codSeccion}`}>
                {row.map((cell, j) => <td key={j}>{cell}</td>)}
                <td>{unavailableAction(`Calendario de ${data[i].desAsignatura}`)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={12}>No hay registros de asistencia.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="table-footer">Mostrando {rows.length} registros</p>
    </section>
  )
}
function ReactGroup() {
  return <><th>N°</th><th>(%)</th></>
}

function Programming({ data }: { data: ApiResponseMap['programacion']['data']['programacion'] }) {
  const [selected, setSelected] = useState<(typeof data)[number] | null>(null)
  const headers = ['Asignatura', 'Créd.', 'Sec.', 'Docente', 'Tope', 'Matriculados', 'Horarios']
  const values = toProgrammingRows(data)
  const rows = values.map((row, index) => [...row.slice(0, -1),
    <button className="schedule-button" aria-label={`Horarios de ${data[index].desAsignatura}, sección ${data[index].codSeccion}`}
      onClick={() => setSelected(data[index])} title="Ver horarios"><span aria-hidden="true">▦</span></button>])
  return <>
    <div className="report-toolbar"><DownloadButton name="programacion-asignaturas" headers={headers}
      rows={values.map((row) => row.map(String))} /></div>
    <DataTable headers={headers} rows={rows} />
    <CourseScheduleModal course={selected} onClose={() => setSelected(null)} />
  </>
}

function History() {
  const student = useStudent()
  return (
    <>
      <section className="history-summary">
        <h3>RESUMEN DEL HISTORIAL ACADÉMICO</h3>
        <p>Datos académicos de demostración.</p>
        <dl>
          {[
            ['Estudiante', student.name], ['Código', student.code], ['Facultad', student.faculty],
            ['Programa', student.program], ['Plan de Estudios', student.plan],
            ['Asignaturas aprobadas', '8'], ['Créditos aprobados', '28'],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>
      <section className="weighted-average">
        <h3>Promedio Ponderado</h3>
        <table>
          <thead><tr><th>Periodo Académico</th><th>Créditos</th><th>Promedio</th></tr></thead>
          <tbody><tr><td>2026-1</td><td>28</td><td>15.00</td></tr></tbody>
        </table>
      </section>
      <DataTable className="history-table"
        headers={['Ciclo', 'Plan', 'Tipo', 'Asignatura', 'Calificación', 'Créditos', 'Sección', 'Acta']}
        rows={[]} empty="" />
    </>
  )
}

function Schedule({ data }: { data: ApiResponseMap['horarios']['data'] }) {
  const events = toScheduleEvents(data)
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  return (
    <div className="calendar-card">
      {!events.length && <p>No hay horarios registrados.</p>}
      <div className="calendar-week" aria-label="Calendario semanal">
        <div className="calendar-daynames">{days.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {days.map((day, i) => (
            <div key={day}>
              {events.filter((event) => event.day === i + 1).sort((a, b) => a.start - b.start)
                .map((event, index) => (
                  <article className="calendar-event" key={`${event.course}-${index}`}>
                    <strong>{event.course}</strong><p>{event.time}</p>
                    <p>Sección {event.section} · {event.kind}</p>
                  </article>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LoadedTable({ props }: { props: TableScreenProps }) {
  const student = useStudent()
  if (props.id === 'historial') return <History />
  if (props.id === 'programacion-asignaturas') return <Programming data={props.response.data.programacion} />
  if (props.id === 'asistencia') return <Attendance data={props.response.data} />
  if (props.id === 'reportes-horarios') return <Schedule data={props.response.data} />
  if (props.id === 'tutoria') return (
    <DataTable headers={['Docente', 'Cod. Asignatura', 'Resolucion', 'Fecha', 'Observacion', 'Acción']}
      rows={[]} empty={props.response.data.length ? 'Los registros no se pueden mostrar con la información disponible.' : 'No hay tutorías registradas.'}
      className="tutoring-table" />
  )
  if (props.id === 'reportes-evaluaciones') return (
    <DataTable className="evaluations-table" headers={['Ciclo', 'Asignatura', 'Tipo Evaluación', 'Calificación', 'Fórmula']}
      rows={[]} empty={props.response.data.length ? 'Los registros no se pueden mostrar con la información disponible.' : 'No hay evaluaciones registradas.'} />
  )
  if (props.id === 'reportes-deudas') return (
    <DataTable className="debts-table" headers={['Fecha Registro', 'Periodo Académico', 'Concepto', 'Monto Inicial', 'Monto Final', 'Observación']}
      rows={[]} empty="No se dispone de datos de deuda verificables." />
  )
  let headers: string[]
  let values: (string | number)[][]
  let rows: ReactNode[][]
  if (props.id === 'plan-estudios') {
    headers = ['Esp.', 'Asignatura', 'Créd.', 'Tipo', 'Grupo', 'Pre-Requisito', 'Grupo']
    values = toPlanRows(props.response.data)
    rows = values
  } else if (props.id === 'reportes-prematricula') {
    headers = ['Plan', 'Ciclo', 'Asignatura', 'Créditos', 'Nro. Rep', 'Nro. Mat. Equiv', 'Nro. Rep. Total', 'Etapa']
    values = toPrematriculaRows(props.response.data)
    rows = values
  } else {
    headers = ['Ciclo', 'Asignatura', 'Créditos', 'Sección', 'Docente Asignado']
    values = toMatriculaRows(props.response.data.matricula)
    rows = values
  }
  return (
    <section className={`report-section ${props.id === 'reportes-prematricula' ? 'prematricula-section' : ''} ${props.id === 'reportes-matricula' ? 'matricula-section' : ''}`}>
      {props.id === 'reportes-matricula' && <h3 className="period-heading">Periodo Académico {student.period}</h3>}
      <div className="report-toolbar"><DownloadButton name={props.id} headers={headers} rows={values.map((row) => row.map(String))} /></div>
      <DataTable headers={headers} rows={rows} />
    </section>
  )
}

export function TableScreen(props: TableScreenProps) {
  const title = routes.find((route) => route.id === props.id)!.title
  return (
    <>
      <PageTitle>{title}</PageTitle>
      {props.id !== 'historial' && <StudentSummary />}
      <LoadedTable props={props} />
    </>
  )
}

import { Fragment, useState, type ReactNode } from 'react'
import { routes } from '../data/routes'
import type { ApiResponseMap } from '../data/contracts'
import { useStudent } from '../data/useStudent'
import { toPlanRows, toPrematriculaRows, toMatriculaRows, toAttendanceRows,
  toProgrammingRows, toEvaluacionRows, toDeudaRows } from '../data/adapters'
import { DataTable, DownloadButton, PageTitle, StudentSummary } from '../components/Common'
import { CourseScheduleModal } from '../components/CourseScheduleModal'
import { toHistoryRows, toStudentSummary } from '../data/adapters'
import { getDataMode } from '../data/client'
import { useStudentFormData } from '../data/useStudent'
import { getPlanEstudiosRepresentation, validatePlanEstudios } from '../data/planEstudios'
import { downloadCsv } from '../data/download'
import { toHistorialCandidateData, toHistorialLocalData } from '../data/miInformacion'
import { toHistorialCandidatePromedios, toHistorialCandidateRows, toPlanCandidateRows } from '../data/adapters'
import { AcademicHistory } from './AcademicHistory'
import { WeeklySchedule } from './WeeklySchedule'

type TableScreenProps =
  | { id: 'historial'; response?: ApiResponseMap['historial'] | null }
  | { id: 'asistencia'; response: ApiResponseMap['asistencias'] }
  | { id: 'reportes-horarios'; response: ApiResponseMap['horarios'] }
  | { id: 'tutoria'; response: ApiResponseMap['tutoria'] }
  | { id: 'reportes-evaluaciones'; response: ApiResponseMap['evaluaciones'] }
  | { id: 'reportes-deudas'; response: ApiResponseMap['deudas'] }
  | { id: 'plan-estudios'; response: ApiResponseMap['plan'] }
  | { id: 'programacion-asignaturas'; response: ApiResponseMap['programacion'] }
  | { id: 'reportes-prematricula'; response: ApiResponseMap['prematricula'] }
  | { id: 'reportes-matricula'; response: ApiResponseMap['matricula'] }

function Attendance({ data }: { data: ApiResponseMap['asistencias']['data'] }) {
  const headers = ['Asignatura', 'Sección', '# Clases', 'Puntual N°', 'Puntual (%)',
    'Tardanzas N°', 'Tardanzas (%)', 'Faltas N°', 'Faltas (%)', 'Asistencia Total N°', 'Asistencia Total (%)']
  const rows = toAttendanceRows(data)
  return (
    <section className="report-section">
      <div className="report-toolbar">
        <DownloadButton name="asistencias" headers={headers} rows={rows.map((row) => row.map(String))} />
      </div>
      <p id="attendance-calendar-unavailable" className="sr-only">
        La consulta del calendario de asistencia no está disponible en esta réplica.
      </p>
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
                <td>
                  <button className="row-action" disabled
                    aria-label={`Calendario de ${data[i].desAsignatura}`}
                    aria-describedby="attendance-calendar-unavailable">▦</button>
                </td>
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

function Programming({ response }: { response: ApiResponseMap['programacion'] }) {
  const data = response.data.programacion
  const [selected, setSelected] = useState<(typeof data)[number] | null>(null)
  const [search, setSearch] = useState('')
  const headers = ['', 'Asignatura', 'Créd.', 'Sec.', 'Docente', 'Tope', 'Matriculados', 'Horarios']
  const values = toProgrammingRows(data)
  const query = search.trim().toLocaleLowerCase()
  const matching = data.flatMap((course, index) => {
    const cycle = course.ciclo === 99 ? 0 : course.ciclo
    const cycleLabel = `CICLO${cycle}`
    const searchable = [course.codAsignatura, course.desAsignatura, values[index][4],
      String(course.codSeccion), cycleLabel].join(' ').toLocaleLowerCase()
    return !query || searchable.includes(query) ? [{ course, value: values[index], cycleLabel }] : []
  })
  const csvRows = values.map((row) => row.map(String))
  return <>
    <div className="report-toolbar">
      <button className="download-button" onClick={() => downloadCsv('programacion-asignaturas', headers, csvRows)}>
        <span aria-hidden="true">⇩</span> Descargar CSV local
      </button>
    </div>
    <label className="history-search">
      Buscar: <input type="search" aria-label="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} />
    </label>
    <div className="table-card">
      <div className="table-overflow">
        <table>
          <thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead>
          <tbody>
            {matching.length ? matching.map(({ course, value, cycleLabel }, index) => <Fragment key={`${course.codAsignatura}-${course.codSeccion}-${index}`}>
              {matching[index - 1]?.course.ciclo !== course.ciclo &&
                <tr key={`cycle-${index}`}><th scope="colgroup" colSpan={8}>{cycleLabel}</th></tr>}
              <tr key={`course-${course.codAsignatura}-${course.codSeccion}-${index}`}>
                {[...value.slice(0, -1),
                  <button className="schedule-button" aria-label={`Horarios de ${course.desAsignatura}, sección ${course.codSeccion}`}
                    onClick={() => setSelected(course)} title="Ver horarios"><span aria-hidden="true">▦</span></button>]
                  .map((cell, column) => <td key={column}>{cell}</td>)}
              </tr>
            </Fragment>)
              : <tr><td className="empty-cell" colSpan={8}>No hay registros que coincidan.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="table-footer">Mostrando {matching.length} registros</p>
    </div>
    <CourseScheduleModal course={selected} onClose={() => setSelected(null)} />
  </>
}

function History({ response }: { response?: ApiResponseMap['historial'] | null }) {
  const student = useStudent()
  const candidateData = response ? toHistorialCandidateData(response) : null
  if (candidateData) {
    const allRows = toHistorialCandidateRows(candidateData)
    const averageRows = toHistorialCandidatePromedios(candidateData)
    const latestAverage = averageRows.at(-1)?.[1] || 'No registrado'
    return <AcademicHistory
      metadata={[
        { label: 'Estudiante', value: student.name }, { label: 'Código', value: student.code },
        { label: 'Año de ingreso', value: String(candidateData.anioIngreso) },
        { label: 'Facultad', value: String(candidateData.facultad) },
        { label: 'Escuela', value: String(candidateData.escuela) },
        { label: 'Plan de estudios', value: student.plan },
      ]}
      metrics={[
        { label: 'Créditos aprobados', value: 'No registrado', detail: 'No disponible en este registro' },
        { label: 'Asignaturas aprobadas', value: 'No registrado', detail: 'No disponible en este registro' },
        { label: 'Promedio último periodo', value: latestAverage },
      ]}
      averages={averageRows.map(([period, average]) => ({ period, average: Number(average), displayAverage: average }))}
      courses={candidateData.historial.map((course, index) => ({
        period: course.codSemestre,
        cells: allRows[index]!.slice(0, 8),
        searchable: `${course.codAsignatura} ${course.desAsignatura}`,
      }))} />
  }
  const data = response ? toHistorialLocalData(response) : null
  if (data) {
    const summaryStudent = toStudentSummary(data.alumno)
    const allRows = toHistoryRows(data.asignaturas)
    return <AcademicHistory
      metadata={[
        { label: 'Estudiante', value: summaryStudent.name }, { label: 'Código', value: summaryStudent.code },
        { label: 'Facultad', value: summaryStudent.faculty }, { label: 'Programa', value: summaryStudent.program },
        { label: 'Plan de estudios', value: summaryStudent.plan },
      ]}
      metrics={[
        { label: 'Créditos aprobados', value: String(data.resumen.creditosAprobados), detail: 'Acumulado registrado' },
        { label: 'Asignaturas aprobadas', value: String(data.resumen.asignaturasAprobadas), detail: 'Acumulado registrado' },
        { label: 'Promedio ponderado', value: data.resumen.promedioPonderado === null
          ? 'No registrado' : data.resumen.promedioPonderado.toFixed(2) },
      ]}
      averages={data.periodos.map((period) => ({
        period: period.periodoAcademico, average: period.promedio, displayAverage: String(period.promedio), credits: period.creditos,
      }))}
      courses={data.asignaturas.map((course, index) => ({
        period: course.periodoAcademico,
        cells: allRows[index]!.map(String),
        searchable: `${course.codAsignatura} ${course.desAsignatura}`,
      }))} />
  }
  if (!response && getDataMode() !== 'local') {
    return <AcademicHistory
      metadata={[
        { label: 'Estudiante', value: student.name }, { label: 'Código', value: student.code },
        { label: 'Facultad', value: student.faculty }, { label: 'Programa', value: student.program },
        { label: 'Plan de estudios', value: student.plan },
      ]}
      metrics={[
        { label: 'Créditos aprobados', value: '28', detail: 'Datos de demostración' },
        { label: 'Asignaturas aprobadas', value: '8', detail: 'Datos de demostración' },
        { label: 'Promedio ponderado', value: '15.00', detail: 'Datos de demostración' },
      ]}
      averages={[{ period: '2026-1', average: 15, displayAverage: '15.00' }]}
      courses={[]} emptyMessage="No hay registros académicos en esta demostración." />
  }
  return <p className="route-status" role="status">Información aún no disponible para mostrar.</p>
}

function LoadedTable({ props }: { props: TableScreenProps }) {
  const student = useStudent()
  const formData = useStudentFormData()
  if (props.id === 'historial') return <History response={props.response} />
  if (props.id === 'programacion-asignaturas') return <Programming response={props.response} />
  if (props.id === 'asistencia') return <Attendance data={props.response.data} />
  if (props.id === 'reportes-horarios') return <WeeklySchedule data={props.response.data} />
  if (props.id === 'tutoria') return (
    <DataTable headers={['Docente', 'Cod. Asignatura', 'Resolucion', 'Fecha', 'Observacion', 'Acción']}
      rows={[]} empty={props.response.data.length ? 'Los registros no se pueden mostrar con la información disponible.' : 'No hay tutorías registradas'}
      className="tutoring-table" />
  )
  if (props.id === 'reportes-evaluaciones') {
    const rows = toEvaluacionRows(props.response.data)
    return <DataTable className="evaluations-table" headers={['Ciclo', 'Asignatura', 'Tipo Evaluación', 'Calificación', 'Fórmula']}
      rows={rows} empty="No hay evaluaciones registradas." />
  }
  if (props.id === 'reportes-deudas') {
    const rows = toDeudaRows(props.response.data)
    return <DataTable className="debts-table" headers={['Fecha Registro', 'Periodo Académico', 'Concepto', 'Monto Inicial', 'Monto Final', 'Observación']}
      rows={rows} empty="No hay deudas registradas." />
  }
  let headers: string[]
  let values: (string | number)[][]
  let rows: ReactNode[][]
  if (props.id === 'plan-estudios') {
    const representation = getPlanEstudiosRepresentation(props.response)
    if (getDataMode() === 'local' && !representation) {
      throw new Error('La respuesta local de Plan de Estudios no declara su representación.')
    }
    if (representation === 'candidate-v1') {
      const headers = ['Esp.', 'Asignatura', 'Créd.', 'Tipo', 'Grupo', 'Pre-Requisito', 'Grupo']
      const values = toPlanCandidateRows(props.response.data)
      return <section className="report-section">
        <div className="report-toolbar">
          <button className="download-button" onClick={() => downloadCsv('plan-estudios', headers, values)}>
            <span aria-hidden="true">⇩</span> Descargar CSV local
          </button>
        </div>
        <DataTable headers={headers} rows={values} empty="No hay registros" />
      </section>
    }
    if (representation === 'local-v1') {
      validatePlanEstudios(props.response.data, {
        codFacultad: formData.data.alumno.codFacultad,
        codEscuela: formData.data.alumno.codEscuela,
        codEspecialidad: formData.data.alumno.codEspecialidad,
        codPlan: formData.data.alumno.codPlan,
      })
    }
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
  const candidatePlan = props.id === 'plan-estudios'
    && getPlanEstudiosRepresentation(props.response) === 'candidate-v1'
  return (
    <>
      <PageTitle>{title}</PageTitle>
      {props.id !== 'historial' && !candidatePlan && <StudentSummary student={props.id === 'programacion-asignaturas'
        ? toStudentSummary(props.response.data.alumno) : undefined} />}
      <LoadedTable props={props} />
    </>
  )
}

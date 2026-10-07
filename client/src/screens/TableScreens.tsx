import type { ReactNode } from 'react'
import { courses, routes, student, type ScreenId } from '../data/routes'
import { DataTable, DownloadButton, PageTitle, StudentSummary } from '../components/Common'

const fixtureRows = (count: number, map: (index: number) => ReactNode[]) =>
  Array.from({ length: count }, (_, index) => map(index))
const course = (index: number) => courses[index % courses.length]
const unavailableAction = (label: string) => (
  <button className="row-action" disabled aria-label={label}>
    ▦
  </button>
)

function Attendance() {
  const headers = [
    'Asignatura',
    'Sección',
    '# Clases',
    'Puntual N°',
    'Puntual (%)',
    'Tardanzas N°',
    'Tardanzas (%)',
    'Faltas N°',
    'Faltas (%)',
    'Asistencia Total N°',
    'Asistencia Total (%)',
    'Acción',
  ]
  const rows = fixtureRows(3, (i) => [
    course(i),
    '1',
    '16',
    '14',
    '87.5',
    '1',
    '6.25',
    '1',
    '6.25',
    '15',
    '93.75',
    unavailableAction(`Calendario de ${course(i)}`),
  ])
  return (
    <section className="report-section">
      <div className="report-toolbar">
        <DownloadButton
          name="asistencias"
          headers={headers}
          rows={rows.map((row) =>
            row.map((cell) =>
              typeof cell === 'string' || typeof cell === 'number' ? String(cell) : '',
            ),
          )}
        />
      </div>
      <div className="table-overflow">
        <table className="attendance-table">
          <thead>
            <tr>
              <th rowSpan={2}>Asignatura</th>
              <th rowSpan={2}>Sección</th>
              <th rowSpan={2}># Clases</th>
              {['Puntual', 'Tardanzas', 'Faltas', 'Asistencia Total'].map((group) => (
                <th key={group} colSpan={2}>
                  {group}
                </th>
              ))}
              <th rowSpan={2}>Acción</th>
            </tr>
            <tr>
              {Array.from({ length: 4 }, (_, i) => (
                <ReactGroup key={i} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-footer">Mostrando 3 registros</p>
    </section>
  )
}
function ReactGroup() {
  return (
    <>
      <th>N°</th>
      <th>(%)</th>
    </>
  )
}

function History() {
  const headers = [
    'Ciclo',
    'Plan',
    'Tipo',
    'Asignatura',
    'Calificación',
    'Créditos',
    'Sección',
    'Acta',
  ]
  return (
    <>
      <section className="history-summary">
        <h3>RESUMEN DEL HISTORIAL ACADÉMICO</h3>
        <dl>
          {[
            ['Estudiante', student.name],
            ['Código', student.code],
            ['Facultad', student.faculty],
            ['Programa', student.program],
            ['Plan de Estudios', student.plan],
            ['Asignaturas aprobadas', '8'],
            ['Créditos aprobados', '28'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="weighted-average">
        <h3>Promedio Ponderado</h3>
        <table>
          <thead>
            <tr>
              <th>Periodo Académico</th>
              <th>Créditos</th>
              <th>Promedio</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2026-1</td>
              <td>28</td>
              <td>15.00</td>
            </tr>
          </tbody>
        </table>
      </section>
      <DataTable className="history-table" headers={headers} rows={[]} empty="" />
    </>
  )
}

function Schedule() {
  return (
    <div className="calendar-card">
      <div className="calendar-week" aria-label="Calendario semanal sin eventos">
        <div className="calendar-daynames" />
        <div className="calendar-grid">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function TableScreen({ id }: { id: ScreenId }) {
  const title = routes.find((route) => route.id === id)!.title
  if (id === 'historial')
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <History />
      </>
    )
  if (id === 'asistencia')
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <StudentSummary />
        <Attendance />
      </>
    )
  if (id === 'reportes-horarios')
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <StudentSummary />
        <Schedule />
      </>
    )
  if (id === 'tutoria')
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <StudentSummary />
        <DataTable
          headers={['Docente', 'Cod. Asignatura', 'Resolucion', 'Fecha', 'Observacion', 'Acción']}
          rows={[]}
          empty="No hay tutorías registradas."
          className="tutoring-table"
        />
      </>
    )
  if (id === 'reportes-evaluaciones')
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <StudentSummary />
        <DataTable
          className="evaluations-table"
          headers={['Ciclo', 'Asignatura', 'Tipo Evaluación', 'Calificación', 'Fórmula']}
          rows={[[1, course(0), 'Evaluación final', '15', 'Promedio de evaluaciones']]}
        />
      </>
    )
  if (id === 'reportes-deudas')
    return (
      <>
        <PageTitle>{title}</PageTitle>
        <StudentSummary />
        <DataTable
          className="debts-table"
          headers={[
            'Fecha Registro',
            'Periodo Académico',
            'Concepto',
            'Monto Inicial',
            'Monto Final',
            'Observación',
          ]}
          rows={[
            [
              '01/03/2026',
              '2026-1',
              'Concepto de demostración',
              'S/ 0.00',
              'S/ 0.00',
              'Sin deuda pendiente',
            ],
          ]}
        />
      </>
    )
  let headers: string[]
  let rows: ReactNode[][]
  if (id === 'plan-estudios') {
    headers = ['Esp.', 'Asignatura', 'Créd.', 'Tipo', 'Grupo', 'Pre-Requisito', 'Grupo']
    rows = fixtureRows(85, (i) => [
      '0',
      `${String(i + 1).padStart(3, '0')} - ${course(i)}`,
      '4',
      'Obligatorio',
      String(Math.floor(i / 8) + 1),
      i > 7 ? course(i - 8) : 'Ninguno',
      '1',
    ])
  } else if (id === 'programacion-asignaturas') {
    headers = ['', 'Asignatura', 'Créd.', 'Sec.', 'Docente', 'Tope', 'Matriculados', 'Horarios']
    rows = fixtureRows(165, (i) => [
      '•',
      course(i),
      '4',
      String((i % 3) + 1),
      'DOCENTE DE DEMOSTRACIÓN',
      '40',
      '20',
      unavailableAction(`Horarios de ${course(i)}`),
    ])
  } else if (id === 'reportes-prematricula') {
    headers = [
      'Plan',
      'Ciclo',
      'Asignatura',
      'Créditos',
      'Nro. Rep',
      'Nro. Mat. Equiv',
      'Nro. Rep. Total',
      'Etapa',
    ]
    rows = fixtureRows(3, (i) => ['2018', '1', course(i), '4', '0', '0', '0', 'Regular'])
  } else {
    headers = ['Ciclo', 'Asignatura', 'Créditos', 'Sección', 'Docente Asignado']
    rows = fixtureRows(3, (i) => ['1', course(i), '4', '1', 'DOCENTE DE DEMOSTRACIÓN'])
  }
  const csvRows = rows.map((row) =>
    row.map((cell) => (typeof cell === 'string' || typeof cell === 'number' ? String(cell) : '')),
  )
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <StudentSummary />
      <section
        className={`report-section ${id === 'reportes-prematricula' ? 'prematricula-section' : ''} ${id === 'reportes-matricula' ? 'matricula-section' : ''}`}
      >
        {id === 'reportes-matricula' && (
          <h3 className="period-heading">Periodo Académico {student.period}</h3>
        )}
        <div className="report-toolbar">
          <DownloadButton name={id} headers={headers} rows={csvRows} />
        </div>
        <DataTable headers={headers} rows={rows} />
      </section>
    </>
  )
}

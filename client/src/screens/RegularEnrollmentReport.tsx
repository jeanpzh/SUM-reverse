import { useEffect, useRef, useState } from 'react'
import { DataTable, DownloadButton, StudentSummary } from '../components/Common'
import type { MatriculaRegularEnrollmentReport } from '../data/matriculaRegular'
import { buildReportView, buildSumReportView, formatRecordRange, REPORT_HEADING_ID } from '../data/regularEnrollmentReport'
import { matchesSearch } from '../data/sumEnrollmentTable'
import './RegularEnrollmentReport.css'

export interface RegularEnrollmentReportViewProps {
  report: MatriculaRegularEnrollmentReport
}

/** V-08 (#38): report shown after an accepted enrollment. Focus lands on the heading when the route is shown. */
export function RegularEnrollmentReportView({ report }: RegularEnrollmentReportViewProps) {
  const view = buildSumReportView(report)
  const [query, setQuery] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const rows = view.rows.filter((row) => matchesSearch(row, query))

  return (
    <div className="regular-enrollment-report">
      <StudentSummary />
      <section className="regular-enrollment-report__card" aria-labelledby={REPORT_HEADING_ID}>
        <h3 id={REPORT_HEADING_ID} ref={headingRef} tabIndex={-1} className="regular-enrollment-report__heading">
          ASIGNATURAS MATRICULADAS
        </h3>
        <div className="regular-enrollment-report__meta">
          <p>Fecha y Hora : {view.acceptedAt}</p>
          <p>Tipo : {view.enrollmentType}</p>
        </div>
        <div className="regular-enrollment-report__toolbar">
          <DownloadButton name={view.csv.name} headers={view.csv.headers} rows={view.csv.rows} />
          <label>Búsqueda:<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        </div>
        <DataTable headers={view.headers} rows={rows} footer={false} empty="No hay registros" />
        <p className="regular-enrollment-report__range">{formatRecordRange(rows.length)}</p>
        <div className="regular-enrollment-report__totals">
          <p>Créditos matriculados : {view.totalCredits}</p>
          <p>Asignaturas matriculadas : {view.courseCount}</p>
        </div>
      </section>
      <details className="regular-enrollment-report__local">
        <summary>Detalle local</summary>
        <p>
          Reporte de la réplica local generado al aceptar la solicitud; no es un documento oficial ni equivale a un visado.
          {' '}{buildReportView(report).windowOriginLabel}.
        </p>
      </details>
    </div>
  )
}

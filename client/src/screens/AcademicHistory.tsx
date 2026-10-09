import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './AcademicHistory.css'

type HistoryCourse = {
  period: string
  cells: string[]
  searchable: string
}

type HistoryAverage = {
  period: string
  average: number
  displayAverage: string
  credits?: number
}

type AcademicHistoryProps = {
  metadata: { label: string; value: string }[]
  metrics: { label: string; value: string; detail?: string }[]
  averages: HistoryAverage[]
  courses: HistoryCourse[]
  emptyMessage?: string
}

const tableHeaders = ['Ciclo', 'Plan', 'Tipo', 'Asignatura', 'Calificación', 'Créditos', 'Sección', 'Acta']

function formatAcademicNumber(value: string) {
  return /^-?\d+\.\d+$/.test(value) ? value.replace(/(\.\d{2})\d+$/, '$1') : value
}

function AverageTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; payload: HistoryAverage }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return <div className="academic-history__tooltip">
    <strong>Periodo {label}</strong>
    <span>Promedio: {formatAcademicNumber(payload[0]!.payload.displayAverage)}</span>
  </div>
}

export function AcademicHistory({ metadata, metrics, averages, courses, emptyMessage }: AcademicHistoryProps) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLocaleLowerCase()
  const groupedCourses = useMemo(() => {
    const groups = new Map<string, HistoryCourse[]>()
    courses.filter((course) => !query || course.searchable.toLocaleLowerCase().includes(query))
      .forEach((course) => groups.set(course.period, [...(groups.get(course.period) || []), course]))
    return [...groups.entries()]
  }, [courses, query])
  const visibleCount = groupedCourses.reduce((count, [, group]) => count + group.length, 0)
  const chartValues = averages.map(({ average }) => average).filter(Number.isFinite)
  const chartMinimum = chartValues.length ? Math.floor(Math.min(...chartValues)) : 0
  const chartMaximum = chartValues.length ? Math.ceil(Math.max(...chartValues)) + 2 : 2

  return <div className="academic-history">
    <section className="academic-history__overview" aria-labelledby="history-overview-title">
      <div className="academic-history__identity">
        <span className="academic-history__eyebrow">MI INFORMACIÓN</span>
        <h2 id="history-overview-title">Resumen académico</h2>
        <dl className="academic-history__metadata">
          {metadata.map(({ label, value }) => <div key={label}>
            <dt>{label}</dt><dd>{value || 'No registrado'}</dd>
          </div>)}
        </dl>
      </div>
      <dl className="academic-history__metrics" aria-label="Indicadores académicos">
        {metrics.map(({ label, value, detail }) => <div className="academic-history__metric" key={label}>
          <dt>{label}</dt>
          <dd title={detail}>{formatAcademicNumber(value) || 'No registrado'}</dd>
        </div>)}
      </dl>
    </section>

    <section className="academic-history__chart-card" aria-labelledby="history-chart-title">
      <div className="academic-history__card-heading">
        <div>
          <span className="academic-history__eyebrow">TENDENCIA</span>
          <h3 id="history-chart-title">Promedio por periodo</h3>
        </div>
        {averages.length > 0 && <span className="academic-history__chart-count">{averages.length} periodos</span>}
      </div>
      {averages.length ? <>
        <p id="history-chart-description" className="sr-only">
          Gráfico de promedios de {averages.length} periodos. Usa las flechas del teclado para consultar cada promedio.
        </p>
        <div className="academic-history__chart" aria-describedby="history-chart-description">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={averages} accessibilityLayer margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--color-sum-border)" strokeDasharray="4 5" />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-sum-muted)', fontSize: 12 }} tickMargin={12} />
              <YAxis domain={[chartMinimum, chartMaximum]} allowDataOverflow allowDecimals={false} tickLine={false} axisLine={false}
                tick={{ fill: 'var(--color-sum-muted)', fontSize: 11 }} width={34} />
              <Tooltip content={<AverageTooltip />} />
              <Area type="monotone" dataKey="average" stroke="var(--color-sum-accent)" strokeWidth={3}
                fill="var(--color-sum-accent)" fillOpacity={0.06} activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--color-sum-surface)' }}
                dot={{ r: 3, fill: 'var(--color-sum-accent)', strokeWidth: 2, stroke: 'var(--color-sum-surface)' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </> : <p className="academic-history__chart-empty">No hay promedios registrados por periodo.</p>}
    </section>

    <section className="academic-history__courses" aria-labelledby="history-courses-title">
      <div className="academic-history__courses-heading">
        <div>
          <span className="academic-history__eyebrow">DETALLE</span>
          <h3 id="history-courses-title">Asignaturas cursadas</h3>
        </div>
        <span className="academic-history__result-count" aria-live="polite">
          {visibleCount} de {courses.length} asignaturas
        </span>
      </div>
      <label className="academic-history__search">
        <span className="academic-history__search-icon" aria-hidden="true">⌕</span>
        <span className="sr-only">Buscar asignatura por nombre o código</span>
        <input type="search" aria-label="Buscar asignatura por nombre o código" placeholder="Buscar por asignatura o código" value={search}
          onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className="academic-history__table-scroll" role="region" aria-label="Tabla de asignaturas; desplázate horizontalmente para ver todas las columnas" tabIndex={0}>
        <table className="academic-history__table">
          <thead><tr>{tableHeaders.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
          {groupedCourses.length ? groupedCourses.map(([period, periodCourses]) => <tbody key={period}>
              <tr className="academic-history__period-row">
                <th scope="rowgroup" colSpan={8}><span>PERIODO ACADÉMICO</span><strong>{period}</strong></th>
              </tr>
              {periodCourses.map((course, index) => <tr className="academic-history__course-row"
                key={`${period}-${course.cells[3]}-${index}`}>
                {course.cells.slice(0, 8).map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`}>
                  {cellIndex === 3 ? <span className="academic-history__course-name" title={cell}>{cell}</span>
                    : cellIndex === 4 ? <span className="academic-history__grade">{formatAcademicNumber(cell)}</span>
                      : cellIndex === 7 ? <span className="academic-history__acta" title={cell}>{cell}</span>
                        : cellIndex === 5 ? formatAcademicNumber(cell) : cell}
                </td>)}
              </tr>)}
          </tbody>) : <tbody><tr><td className="academic-history__empty" colSpan={8}>
              {courses.length ? 'No hay asignaturas que coincidan con la búsqueda.' : emptyMessage || 'No hay registros académicos.'}
            </td></tr></tbody>}
        </table>
      </div>
      <p className="academic-history__table-footer">Mostrando {visibleCount} registros académicos</p>
    </section>
  </div>
}

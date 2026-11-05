import type { AcademicDemandEstimate } from '../data/academicScheduling'
import { calculatePresentedSections } from '../data/academicScheduling'

type DemandCourseInput = { courseId: string; name: string; targetCapacity: string; finalDemand: string }

type Props = {
  sourceId: 'existing-regular-v1' | 'independent-120-v1'
  onSourceChange: (value: Props['sourceId']) => void
  courses: DemandCourseInput[]
  estimate: AcademicDemandEstimate | null
  loading: boolean
  error: string | null
  onEstimate: () => void
  onUseBase: (courseId: string, value: number) => void
}

export function AcademicDemandPanel({ sourceId, onSourceChange, courses, estimate, loading, error,
  onEstimate, onUseBase }: Props) {
  const rowsByCourse = new Map(estimate?.rows.map((row) => [row.courseId, row]) ?? [])

  return <section className="academic-demand" aria-labelledby="academic-demand-title">
    <div className="academic-demand__heading">
      <div>
        <h4 id="academic-demand-title">Demanda potencial sintética · 2027-I</h4>
        <p>Base académica de una muestra declarada; no es intención de matrícula ni un pronóstico.</p>
      </div>
      <label>Fuente sintética
        <select aria-label="Fuente de demanda potencial" value={sourceId}
          onChange={(event) => onSourceChange(event.currentTarget.value as Props['sourceId'])}>
          <option value="existing-regular-v1">Escenario regular integrado · 2 perfiles</option>
          <option value="independent-120-v1">Población independiente · 120 identidades sintéticas</option>
        </select>
      </label>
    </div>
    <div className="academic-demand__actions">
      <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary"
        disabled={loading || courses.length === 0 || courses.some((course) => calculatePresentedSections('0', course.targetCapacity) === null)}
        onClick={onEstimate}>{loading ? 'Estimando…' : 'Estimar demanda potencial'}</button>
      <span>Se enviarán solo los cursos seleccionados, su capacidad objetivo y el identificador de fuente.</span>
    </div>
    {error && <p className="academic-demand__error" role="alert">{error} La edición manual y el generador siguen disponibles.</p>}
    {!estimate && !loading && !error && <p className="academic-demand__empty">Estima una base para ver elegibilidad y causas agregadas. La demanda final manual se conserva.</p>}
    {estimate && <div className="academic-demand__source" aria-label="Procedencia de la estimación">
        <strong>{estimate.source.label}</strong>
        <span>{estimate.source.populationSize} personas únicas · {estimate.source.recordCount} registros · {estimate.source.duplicateRecords} duplicados idénticos · corte {estimate.source.cutoffPeriod}</span>
        <span>Revisión de fuente {estimate.source.revision}</span>
        <span>Periodo objetivo {estimate.source.targetPeriod} · {estimate.source.schoolId} · {estimate.source.planId} · {estimate.source.reference}</span>
        <ul>{estimate.source.limitations.map((limitation, index) => <li key={`${index}-${limitation}`}>{limitation}</li>)}</ul>
      </div>}
    {courses.length > 0 && <div className="academic-demand__courses">
        {courses.map((course) => {
          const row = rowsByCourse.get(course.courseId)
          const finalSections = calculatePresentedSections(course.finalDemand, course.targetCapacity)
          return <article className="academic-demand__course" key={course.courseId}>
            <div className="academic-demand__course-heading"><strong>{course.name} · {course.courseId}</strong>
              <span>Capacidad {course.targetCapacity || 'Sin definir'}</span></div>
            <dl>
              <div><dt>Base elegible</dt><dd>{row ? row.baseDemand : '—'}</dd></div>
              <div><dt>Elegibles</dt><dd>{row ? row.eligible : '—'}</dd></div>
              <div><dt>Repitentes incluidos</dt><dd>{row ? row.retakeEligible : '—'}</dd></div>
              <div><dt>No elegibles</dt><dd>{row ? row.nonEligible : '—'}</dd></div>
              <div><dt>Insuficientes</dt><dd>{row ? row.insufficient : '—'}</dd></div>
              <div><dt>Secciones base</dt><dd>{row ? row.suggestedSections : '—'}</dd></div>
              <div><dt>Demanda final</dt><dd>{course.finalDemand === '' ? 'Sin definir' : course.finalDemand}</dd></div>
              <div><dt>Secciones finales sugeridas</dt><dd>{finalSections === null ? 'Revisa demanda/capacidad' : finalSections}</dd></div>
            </dl>
            {row && row.insufficient > 0 && <p className="academic-demand__warning">Hay datos insuficientes; conserva o ingresa la demanda final manual. No se interpretan como cero.</p>}
            {row && <button type="button" className="academic-scheduling__text-button" disabled={row.insufficient > 0}
              onClick={() => onUseBase(course.courseId, row.baseDemand)}>Usar base para este curso</button>}
            {row && row.reasons.length > 0 && <details>
              <summary>Detalle de causas agregadas</summary>
              <ul>{row.reasons.map((reason) => <li key={`${reason.category}:${reason.code}`}>
                {reason.message} · {reason.count} · {reason.category === 'insufficient' ? 'insuficientes' : 'no elegibles'}
              </li>)}</ul>
            </details>}
          </article>
        })}
      </div>}
  </section>
}

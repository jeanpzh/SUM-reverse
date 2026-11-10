import { PlanningFetchLoading } from '../components/PlanningFetchLoading'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Label } from '../components/ui/Label'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/Collapsible'
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
      <Label>Fuente sintética
        <NativeSelect aria-label="Fuente de demanda potencial" value={sourceId}
          onChange={(event) => onSourceChange(event.currentTarget.value as Props['sourceId'])}>
          <option value="existing-regular-v1">Escenario regular integrado · 2 perfiles</option>
          <option value="independent-120-v1">Población independiente · 120 identidades sintéticas</option>
        </NativeSelect>
      </Label>
    </div>
    <div className="academic-demand__actions">
      <Button variant="outline" type="button"
        disabled={loading || courses.length === 0 || courses.some((course) => calculatePresentedSections('0', course.targetCapacity) === null)}
        onClick={onEstimate}>{loading ? 'Estimando…' : 'Estimar demanda potencial'}</Button>
    </div>
    {error && <p className="academic-demand__error" role="alert">{error} La edición manual y el generador siguen disponibles.</p>}
    {loading && <PlanningFetchLoading label="Estimando demanda potencial…" layout="cards" />}
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
              <Badge variant="outline">Capacidad {course.targetCapacity || 'Sin definir'}</Badge></div>
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
            {row && <Button variant="outline" type="button" disabled={row.insufficient > 0}
              onClick={() => onUseBase(course.courseId, row.baseDemand)}>Usar base para este curso</Button>}
            {row && row.reasons.length > 0 && <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" type="button">Detalle de causas agregadas</Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
              <ul>{row.reasons.map((reason) => <li key={`${reason.category}:${reason.code}`}>
                {reason.message} · {reason.count} · {reason.category === 'insufficient' ? 'insuficientes' : 'no elegibles'}
              </li>)}</ul>
            </CollapsibleContent>
            </Collapsible>}
          </article>
        })}
      </div>}
  </section>
}

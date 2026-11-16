import { PlanningFetchLoading } from '../components/PlanningFetchLoading'
import type { AcademicAdvisorResponse, PlanningPeriod } from '../data/academicScheduling'
import { AdvisorFindings } from '../components/ai-elements/AdvisorFindings'
import { AdvisorImpact } from '../components/ai-elements/AdvisorImpact'
import { NormativeAdvice } from '../components/ai-elements/NormativeAdvice'
import { Reasoning } from '../components/ai-elements/Reasoning'
import { SuggestionCard } from '../components/ai-elements/SuggestionCard'
import { Alert, AlertDescription } from '../components/ui/Alert'

export interface PlanningAssistAdvisorProps {
  academicPeriod: PlanningPeriod
  editVersion: number
  /** Sections still partial or pending in the proposal being analysed. */
  openSections: number
  /** Whether the advisor was consulted for this proposal version. */
  requested: boolean
  loading: boolean
  error: string | null
  advice: AcademicAdvisorResponse | null
  impact: AcademicAdvisorResponse['verifiedImpact']
  selectedIds: string[]
  applying: boolean
  isLocked: boolean
  canApply: boolean
  previewCurrent: boolean
  applyDisabledReason: string | null
  applyDisabledReasonId: string
  canConsult: boolean
  consultDisabledReason?: string
  consultDisabledReasonId: string
  teacherNames: Record<string, string>
  courseNames: Record<string, string>
  roomNames: Record<string, string>
  onConsult: () => void
  onCancel: () => void
  onRetry: () => void
  onToggle: (id: string, checked: boolean) => void
  onSimulate: () => void
  onApply: () => void
}

const sectionsLabel = (count: number) => count === 0 ? 'Sin secciones por completar'
  : `${count} ${count === 1 ? 'sección' : 'secciones'} por completar`

export function PlanningAssistAdvisor(props: PlanningAssistAdvisorProps) {
  const { advice, loading, error, requested, selectedIds, applying, isLocked } = props
  const title = sectionsLabel(props.openSections)

  if (!requested || (!loading && !error && !advice)) {
    return <div className="planning-assist-advisor" data-advisor-state="idle">
      <div className="planning-assist-advisor__head">
        <span className="planning-eyebrow">Consejero de planificación · v{props.editVersion}</span>
        <h2 className="planning-assist-advisor__title">{title}</h2>
      </div>
      <p className="planning-assist-advisor__note">El consejero analiza qué limita la cobertura y propone recomendaciones que tú confirmas. No asigna horarios.</p>
      <div className="planning-assist-advisor__actions">
        <button type="button" className="planning-assist-btn" disabled={!props.canConsult} onClick={props.onConsult}
          aria-describedby={!props.canConsult && props.consultDisabledReason ? props.consultDisabledReasonId : undefined}>Analizar la propuesta</button>
        {!props.canConsult && props.consultDisabledReason && <p id={props.consultDisabledReasonId} role="status" className="planning-assist-advisor__note">{props.consultDisabledReason}</p>}
      </div>
    </div>
  }

  const modeLabel = advice?.source.mode === 'llm-assisted'
    ? `IA asistida · ${advice.source.providerLabel ?? 'LLM'}`
    : 'Análisis determinista local'
  const recommendations = advice?.recommendations ?? []
  const applyLabel = applying ? 'Aplicando y regenerando…'
    : selectedIds.length === 0 ? 'Aplicar seleccionadas y regenerar'
    : `Aplicar ${selectedIds.length} ${selectedIds.length === 1 ? 'seleccionada' : 'seleccionadas'} y regenerar`

  return <div className="planning-assist-advisor" data-advisor-state={loading ? 'loading' : error && !advice ? 'error' : 'ready'} aria-busy={loading}>
    <div className="planning-assist-advisor__head">
      <span className="planning-eyebrow">{advice ? `${modeLabel} · v${props.editVersion}` : `Consejero de planificación · v${props.editVersion}`}</span>
      <h2 className="planning-assist-advisor__title">{title}</h2>
    </div>
    {loading && <>
      <PlanningFetchLoading label="Analizando propuesta y restricciones…" layout="cards" />
      <div className="planning-assist-advisor__actions">
        <button type="button" className="planning-assist-btn planning-assist-btn--text" onClick={props.onCancel}>Cancelar consulta</button>
      </div>
    </>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {error && !loading && <div className="planning-assist-advisor__actions">
      <button type="button" className="planning-assist-btn" onClick={props.onRetry}>Reintentar consejero</button>
    </div>}
    {!loading && advice && <>
      <AdvisorFindings advice={advice} />
      {recommendations.length > 0 ? (
        <fieldset className="planning-assist-advisor__recs">
          <legend className="planning-eyebrow">Recomendaciones verificables</legend>
          <p className="planning-assist-advisor__note">Los alcances individuales pueden solaparse. Simula la combinación para conocer su cobertura; no sumes las cifras de cada recomendación.</p>
          {recommendations.map((rec) => <SuggestionCard key={rec.id}
            recommendation={rec} checked={selectedIds.includes(rec.id)} disabled={applying || isLocked}
            onCheckedChange={(checked) => props.onToggle(rec.id, checked)}
            teacherNames={props.teacherNames} courseNames={props.courseNames} roomNames={props.roomNames} />)}
        </fieldset>
      ) : (
        <p className="planning-assist-advisor__note">No se encontraron parches automáticos adicionales para esta configuración.</p>
      )}
      <AdvisorImpact impact={props.impact} />
      <div className="planning-assist-advisor__actions">
        {recommendations.length > 0 && <button type="button" className="planning-assist-btn planning-assist-btn--text" disabled={applying || isLocked} onClick={props.onSimulate}>Simular selección actual</button>}
        {props.canApply && recommendations.length > 0 && <button type="button" className="planning-assist-btn"
          disabled={selectedIds.length === 0 || isLocked || applying || !props.previewCurrent}
          aria-describedby={props.applyDisabledReason ? props.applyDisabledReasonId : undefined} onClick={props.onApply}>{applyLabel}</button>}
        {props.applyDisabledReason && <p id={props.applyDisabledReasonId} role="status" className="planning-assist-advisor__note">{props.applyDisabledReason}</p>}
        <p className="planning-assist-advisor__note">El consejero no asigna horarios: las recomendaciones modifican el workspace y el motor determinista regenera la propuesta. La cobertura se mide después de regenerar.</p>
      </div>
      {(advice.normativeContext || advice.reasoningSteps?.length) ? <div className="planning-assist-advisor__extras">
        {advice.normativeContext && (advice.normativeContext.context.academicPeriod === props.academicPeriod
          && advice.normativeContext.context.facultyId === 'FISI'
          ? <NormativeAdvice advice={advice.normativeContext} />
          : <Alert variant="warning"><AlertDescription>El contexto normativo no corresponde al periodo actual. Consulta las fuentes con los filtros de esta propuesta.</AlertDescription></Alert>)}
        <Reasoning steps={advice.reasoningSteps} />
      </div> : null}
    </>}
  </div>
}

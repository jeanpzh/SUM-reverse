import { BookOpen, ListFilter, Search, ShieldAlert } from 'lucide-react'
import { PlanningFetchLoading } from '../components/PlanningFetchLoading'
import type { AcademicAdvisorResponse, AcademicProposal, PlanningPeriod } from '../data/academicScheduling'
import { AdvisorFindings } from '../components/ai-elements/AdvisorFindings'
import { AdvisorImpact } from '../components/ai-elements/AdvisorImpact'
import { MessageResponse } from '../components/ai-elements/MessageResponse'
import { NormativeAdvice } from '../components/ai-elements/NormativeAdvice'
import { Reasoning } from '../components/ai-elements/Reasoning'
import { SuggestionCard } from '../components/ai-elements/SuggestionCard'
import { Alert, AlertDescription } from '../components/ui/Alert'
import { PlanningNormativeChat } from './PlanningNormativeChat'
import type { NormativeChat } from './useNormativeChat'

export interface PlanningAssistAdvisorProps {
  chat: NormativeChat
  proposal: AcademicProposal
  simulating: boolean
  impactInvalidated: boolean
  academicPeriod: PlanningPeriod
  /** Saved version of the draft being analysed (null before the first save). */
  draftVersion: number | null
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

export function PlanningAssistAdvisor(props: PlanningAssistAdvisorProps) {
  const { advice, loading, error, requested, selectedIds, applying, isLocked, proposal, chat, simulating } = props
  const recommendations = advice?.recommendations ?? []
  const selected = recommendations.filter((item) => selectedIds.includes(item.id))
  const authorizations = selected.filter(({ patch }) => patch.kind === 'increase_teacher_load' || patch.kind === 'enable_planning_window').length
  const initial = !requested || (!loading && !error && !advice)
  const clear = proposal.status === 'complete' && proposal.pending.length === 0
  const busy = applying || loading
  const state = applying ? 'applying' : simulating ? 'simulating' : loading ? 'loading'
    : error && !advice ? 'error' : clear ? 'clear' : initial ? 'idle'
    : props.impactInvalidated ? 'stale' : props.previewCurrent ? 'simulated'
    : advice?.source.mode === 'deterministic-fallback' ? 'degraded' : 'ready'
  const ask = (question: string) => { void chat.submit(question) }

  const introduction = <div className="planning-assist-advisor__thread">
    {clear ? <Alert><AlertDescription>
      <h3>Sin bloqueos que resolver</h3>
      <p>{proposal.counts.scheduledSessions} de {proposal.counts.requiredSessions} sesiones asignadas. Revisa la propuesta antes de enviarla a revisión docente.</p>
    </AlertDescription></Alert> : initial ? <section className="planning-assist-advisor__welcome">
      <h2>¿Qué está bloqueando esta propuesta?</h2>
      <p>Revisa las sesiones sin asignar y los posibles cambios. Tú eliges qué simular y qué aplicar.</p>
      <ul>
        <li><Search size={16} aria-hidden="true" /><span><strong>Diagnóstico.</strong> Qué limita la cobertura de esta propuesta.</span></li>
        <li><ListFilter size={16} aria-hidden="true" /><span><strong>Opciones de cambio.</strong> Alcance y autorización visibles antes de decidir.</span></li>
        <li><BookOpen size={16} aria-hidden="true" /><span><strong>Norma citada.</strong> Pregunta antes de tomar una decisión.</span></li>
      </ul>
    </section> : null}
    {loading && !simulating && <PlanningFetchLoading label="Leyendo la propuesta y la norma aplicable. No se simula nada todavía." layout="cards" />}
    {error && <Alert variant="destructive"><AlertDescription><h3>{advice ? 'No se pudo completar la operación' : 'No se pudo completar la consulta'}</h3><p>{error}</p><p>La consulta no aplica cambios a la propuesta.</p></AlertDescription></Alert>}
    {advice && <>
      <span className="planning-eyebrow">Consejero</span>
      {advice.source.mode === 'llm-assisted' ? <MessageResponse>{advice.summary}</MessageResponse> : <Alert variant="warning"><AlertDescription>
        <h3>Sin redacción del modelo</h3>
        <p>{advice.source.fallbackReason === 'not_configured' ? 'El modelo no está configurado.' : 'La redacción del modelo no está disponible.'} Puedes usar el diagnóstico y las opciones deterministas.</p>
      </AlertDescription></Alert>}
    </>}
    {!advice && !loading && <div className="planning-assist-advisor__questions">
      <span className="planning-eyebrow">O pregunta directamente</span>
      {['¿Quién aprueba la asignación de actividades lectivas?', '¿Qué dice la norma sobre carga lectiva de contratados?', '¿Qué excepciones de carga lectiva requieren autorización?'].map((question) => <button key={question} type="button" className="planning-assist-btn" disabled={chat.loading} onClick={() => ask(question)}>{question}</button>)}
    </div>}
  </div>

  const decision = advice ? <div className="planning-assist-advisor__decision">
    <section className="planning-assist-advisor__card" aria-label="Diagnóstico de la propuesta">
      <span className="planning-eyebrow">Diagnóstico</span>
      <p className="planning-assist-advisor__count"><strong>{proposal.pending.length}</strong> sesiones sin asignar de {proposal.counts.requiredSessions}</p>
      <AdvisorFindings advice={advice} />
    </section>
    {recommendations.length ? <fieldset className="planning-assist-advisor__recs" disabled={busy || isLocked}>
      <legend className="planning-eyebrow">Opciones de cambio · {recommendations.length}</legend>
      <p className="planning-assist-advisor__note">El alcance es estimado y puede solaparse entre opciones. Solo la simulación mide esta combinación.</p>
      {recommendations.map((rec, index) => <SuggestionCard key={rec.id} index={index + 1}
        recommendation={rec} checked={selectedIds.includes(rec.id)} disabled={busy || isLocked}
        measured={props.previewCurrent && selectedIds.includes(rec.id)}
        onCheckedChange={(checked) => props.onToggle(rec.id, checked)}
        teacherNames={props.teacherNames} courseNames={props.courseNames} roomNames={props.roomNames} />)}
    </fieldset> : <p className="planning-assist-advisor__note">No se encontraron opciones ejecutables adicionales para esta configuración. Puedes consultar la normativa.</p>}
    {simulating ? <section className="planning-assist-advisor__card"><PlanningFetchLoading label={`Simulando ${selectedIds.length} opciones seleccionadas…`} /><p className="planning-assist-advisor__note">El motor mide esta combinación. La selección queda bloqueada hasta terminar o cancelar.</p></section>
      : props.impactInvalidated ? <div role="status" data-advisor-impact="stale" className="planning-assist-advisor__stale"><h3>Impacto invalidado</h3><p>La selección cambió. Vuelve a simular para medir su impacto y habilitar Aplicar.</p></div>
      : recommendations.length > 0 && <AdvisorImpact impact={props.impact} />}
    {advice.normativeContext && <details className="planning-assist-advisor__card"><summary>Norma y restricciones</summary>
      {advice.normativeContext.context.academicPeriod === props.academicPeriod && advice.normativeContext.context.facultyId === 'FISI'
        ? <NormativeAdvice advice={advice.normativeContext} /> : <p>El contexto normativo no corresponde al periodo actual. Consulta las fuentes con los filtros de esta propuesta.</p>}
    </details>}
    <Reasoning steps={advice.reasoningSteps} />
  </div> : undefined

  const applyLabel = applying ? 'Aplicando y regenerando…' : `Aplicar ${selectedIds.length} ${selectedIds.length === 1 ? 'seleccionada' : 'seleccionadas'} y regenerar`
  const footer = <div className="planning-assist-advisor__dock">
    <div className="planning-assist-advisor__dock-copy">
      <p role="status">{applying ? 'Aplicando cambios y regenerando la propuesta.' : simulating ? 'Simulación en curso.' : loading ? 'Consulta en curso.' : props.previewCurrent ? 'Simulación vigente para esta selección.' : advice && recommendations.length ? `${selectedIds.length} opciones seleccionadas · impacto no simulado` : clear ? 'Puedes seguir consultando la normativa.' : 'Consulta primero; tú decides los siguientes pasos.'}</p>
      {authorizations > 0 && <p className="planning-assist-advisor__authorization"><ShieldAlert size={14} aria-hidden="true" />{authorizations} {authorizations === 1 ? 'opción requiere' : 'opciones requieren'} autorización externa. El consejero no la concede.</p>}
      {props.applyDisabledReason && advice && <p id={props.applyDisabledReasonId} className="planning-assist-advisor__note">{props.applyDisabledReason}</p>}
      {initial && !props.canConsult && props.consultDisabledReason && <p id={props.consultDisabledReasonId} className="planning-assist-advisor__note">{props.consultDisabledReason}</p>}
    </div>
    <div className="planning-assist-advisor__dock-actions">
      {loading ? <button type="button" className="planning-assist-btn" onClick={props.onCancel}>{simulating ? 'Cancelar simulación' : 'Cancelar consulta'}</button>
        : error ? <button type="button" className="planning-assist-btn planning-assist-btn--primary" disabled={applying || isLocked} onClick={props.onRetry}>Reintentar consejero</button>
        : initial && !clear ? <button type="button" className="planning-assist-btn planning-assist-btn--primary" disabled={!props.canConsult} aria-describedby={!props.canConsult ? props.consultDisabledReasonId : undefined} onClick={props.onConsult}>Consultar consejero</button>
        : recommendations.length > 0 && !props.previewCurrent ? <button type="button" className="planning-assist-btn planning-assist-btn--primary" disabled={applying || isLocked || selectedIds.length === 0} aria-label="Simular selección actual" onClick={props.onSimulate}>Simular selección</button> : null}
      {advice && recommendations.length > 0 && props.canApply && <button type="button" className={`planning-assist-btn${props.previewCurrent ? ' planning-assist-btn--primary' : ''}`} disabled={!props.previewCurrent || busy || isLocked || selectedIds.length === 0} aria-describedby={props.applyDisabledReason ? props.applyDisabledReasonId : undefined} aria-label={applyLabel} onClick={props.onApply}>{props.previewCurrent || applying ? applyLabel : 'Aplicar'}</button>}
    </div>
    {advice && <p className="planning-assist-advisor__note">Aplicar regenera el borrador. No guarda ni publica.</p>}
  </div>

  return <div className="planning-assist-advisor" data-advisor-state={state} aria-busy={busy}>
    <PlanningNormativeChat academicPeriod={props.academicPeriod} chat={chat} embedded introduction={introduction} decision={decision} footer={footer} />
  </div>
}

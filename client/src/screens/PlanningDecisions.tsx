import { useId } from 'react'
import { CircleAlert, CircleCheck, ListChecks, Scale } from 'lucide-react'
import { Alert, AlertDescription } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/Collapsible'
import type { AcademicAdvisorPatch, AcademicProposal, PlanningPolicy } from '../data/academicScheduling'
import type { AcademicPlanningResources } from '../../../shared/programacion-academica-api.mjs'
import type { LoadAuthorizationBlocker } from '../../../shared/academic-normative-profile.mjs'
import { GAP_CLASS_LABEL, buildDecisionQueue, describeBlockers, describeNormativeSummary, describePrelation } from '../data/planningDecisions'
import type { DecisionGroup, DecisionItem } from '../data/planningDecisions'
import './PlanningDecisions.css'

type DecisionList = NonNullable<AcademicProposal['decisions']>

export type PlanningDecisionsProps = {
  proposal: AcademicProposal | null
  // Decisions of the previous proposal, kept while a configuration change has made it outdated.
  staleDecisions?: { decisions: DecisionList } | null
  period: string
  teacherNames: Record<string, string>
  courseNames: Record<string, string>
  resources: AcademicPlanningResources
  policy: PlanningPolicy | null
  deliveryModes: Record<string, 'continuous' | 'split'>
  isLocked: boolean
  busy: boolean
  onApplyPatches: (patches: AcademicAdvisorPatch[]) => Promise<unknown> | unknown
  onRecordAuthorization: (teacherId: string) => void
  onAddTeacher: (courseIds: string[]) => void
  onRegenerate: () => void
}

function ItemRow({ item, disabled, onAction }: { item: DecisionItem; disabled: boolean; onAction: (item: DecisionItem) => void }) {
  const isPatch = item.action.kind === 'apply-patches'
  const label = item.applied && !isPatch ? 'Ver docente' : item.actionLabel
  return <li className="planning-decisions__item">
    <div className="planning-decisions__item-main">
      <div className="planning-decisions__item-heading">
        <strong>{item.title}</strong>
        <Badge variant="outline">{item.kindLabel}</Badge>
        {item.applied && <Badge variant="success"><CircleCheck size={13} aria-hidden="true" />&nbsp;{isPatch ? 'Ya aplicado en la configuración' : 'Autorización registrada'}</Badge>}
      </div>
      <p className="planning-decisions__effect">{item.effect}</p>
      {item.provenance && <p className="planning-decisions__provenance">{item.provenance}</p>}
      {item.action.kind === 'record-authorization' && <p className="planning-decisions__provenance">
        Registrar la autorización no cambia por sí sola la carga semanal del docente: tras registrarla, ajusta su carga máxima hasta el tope autorizado.</p>}
      <p className="planning-decisions__necessity">{item.necessity}</p>
      {(item.requires.length > 0 || item.sources.length > 0) && <details className="planning-decisions__details">
        <summary>Requisitos formales y fuente{item.sources.length ? ` · ${item.sources.map((source) => source.id).join(', ')}` : ''}</summary>
        {item.requires.length > 0 && <ol>{item.requires.map((step) => <li key={step}>{step}</li>)}</ol>}
        {item.sources.length > 0 && <ul>{item.sources.map((source) => <li key={source.id}><strong>{source.id}</strong> · {source.title}</li>)}</ul>}
      </details>}
    </div>
    <Button type="button" size="sm" variant={isPatch && !item.applied ? 'default' : 'outline'} disabled={disabled || (isPatch && item.applied)}
      onClick={() => onAction(item)}>{label}</Button>
  </li>
}

function Group({ group, defaultOpen, isDisabled, onAction }: { group: DecisionGroup; defaultOpen: boolean; isDisabled: (item: DecisionItem) => boolean; onAction: (item: DecisionItem) => void }) {
  const headingId = useId()
  return <Collapsible defaultOpen={defaultOpen} className="planning-decisions__group">
    <CollapsibleTrigger asChild>
      <Button type="button" variant="ghost" className="planning-decisions__group-trigger" aria-describedby={headingId}>
        <span id={headingId}>{group.label}</span>
        <span className="planning-decisions__group-count">
          <Badge variant="secondary">{group.items.length} {group.items.length === 1 ? 'decisión' : 'decisiones'}</Badge>
          <span>{group.basis === 'capacity-relaxation' ? `libera ${group.sectionsUnlocked}` : `hasta ${group.sectionsUnlocked}`} sec.</span>
        </span>
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <p className="planning-decisions__group-description">{group.description}</p>
      <ul className="planning-decisions__list">{group.items.map((item) => <ItemRow key={item.id} item={item} disabled={isDisabled(item)} onAction={onAction} />)}</ul>
    </CollapsibleContent>
  </Collapsible>
}

export function PlanningDecisions(props: PlanningDecisionsProps) {
  const { proposal, staleDecisions, period, isLocked, busy } = props
  const outdated = !proposal && Boolean(staleDecisions)
  const decisions = proposal?.decisions ?? (outdated ? staleDecisions?.decisions : undefined)
  const queue = buildDecisionQueue(decisions, { period, teacherNames: props.teacherNames, courseNames: props.courseNames,
    resources: props.resources, policy: props.policy, deliveryModes: props.deliveryModes })
  const normative = proposal ? describeNormativeSummary(proposal, period) : null
  const prelation = proposal ? describePrelation(proposal) : null
  const titleId = useId()
  if (!queue && !normative && !prelation) return null

  const act = (item: DecisionItem) => {
    if (item.action.kind === 'record-authorization') props.onRecordAuthorization(item.action.teacherId)
    else if (item.action.kind === 'add-teacher') props.onAddTeacher(item.action.courseIds)
    else void props.onApplyPatches(item.action.patches)
  }
  // Patch actions regenerate the schedule: they need a current proposal. Navigation actions stay available for an outdated one.
  const disabledFor = (item: DecisionItem) => busy || (item.action.kind === 'apply-patches' && (isLocked || outdated))

  return <section className="planning-decisions" aria-labelledby={titleId}>
    {queue && <Collapsible defaultOpen className="planning-decisions__queue">
      <div className="planning-decisions__header">
        <div>
          <h3 id={titleId} className="planning-decisions__title"><ListChecks size={16} aria-hidden="true" /> Decisiones para completar el horario</h3>
          {queue.summary && <p className="planning-decisions__summary" role="status">{queue.summary}</p>}
          {queue.windowSummary && <p className="planning-decisions__summary-secondary">{queue.windowSummary}</p>}
        </div>
        <CollapsibleTrigger asChild><Button type="button" variant="ghost" size="sm">Mostrar u ocultar</Button></CollapsibleTrigger>
      </div>
      <CollapsibleContent className="planning-decisions__content">
        {outdated && <Alert variant="warning" role="status"><AlertDescription>
          <CircleAlert size={14} aria-hidden="true" className="inline-block align-text-bottom" /> Estas decisiones son de la propuesta anterior: la configuración cambió y la propuesta quedó desactualizada.
          Regenerarla recalcula las decisiones con la configuración actual.{' '}
          <Button type="button" size="sm" variant="outline" disabled={busy || isLocked} onClick={props.onRegenerate}>Generar propuesta</Button>
        </AlertDescription></Alert>}
        <p className="planning-decisions__note">Cada decisión es una condición necesaria para colocar esas secciones, no una garantía: nada se aplica sin que lo elijas y los cambios regeneran la propuesta.</p>
        {queue.groups.map((group, index) => <Group key={group.id} group={group} defaultOpen={index === 0} isDisabled={disabledFor} onAction={act} />)}
      </CollapsibleContent>
    </Collapsible>}
    {(normative || prelation) && <Collapsible className="planning-decisions__basis">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="planning-decisions__basis-trigger"><Scale size={14} aria-hidden="true" /> Base normativa{normative && normative.gaps.length > 0 ? ` y vacíos (${normative.gaps.length})` : ''}</Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="planning-decisions__basis-content">
        {normative && <>
          <p className="planning-decisions__basis-line">
            Perfil normativo {normative.profileRevision ?? 'no resuelto'} · hora lectiva {normative.lectiveHourMinutes === null ? 'sin indicar' : `${normative.lectiveHourMinutes} min`}.
            {normative.lectiveHourNote && <> <span className="planning-decisions__provenance">{normative.lectiveHourNote}</span></>}
          </p>
          {normative.gaps.length > 0 ? <ul className="planning-decisions__gaps" aria-label="Vacíos normativos">{normative.gaps.map((gap) => <li key={gap.code}>
            <Badge variant="outline">{GAP_CLASS_LABEL[gap.classification]}</Badge>{' '}
            <span>{gap.message}</span>{gap.teacherCount > 0 && <span className="planning-decisions__gap-count"> · {gap.teacherCount} {gap.teacherCount === 1 ? 'docente' : 'docentes'}</span>}
          </li>)}</ul> : <p className="planning-decisions__basis-line">Sin vacíos normativos informados.</p>}
        </>}
        {prelation && <dl className="planning-decisions__prelation" aria-label="Niveles de prelación">{prelation.map((level) => <div key={level.id}>
          <dt>{level.label}</dt>
          <dd><span className="tabular-nums">{level.value}</span> <Badge variant={level.proven ? 'success' : 'warning'}>{level.mark}</Badge></dd>
        </div>)}</dl>}
      </CollapsibleContent>
    </Collapsible>}
  </section>
}

// Teacher, assigned versus authorized minutes and the authorization each blocker needs; reused by the readiness summary and the error surface.
export function LoadBlockerList({ blockers, teacherNames, period, label = 'Bloqueos de carga docente' }:
  { blockers: readonly LoadAuthorizationBlocker[]; teacherNames: Record<string, string>; period: string; label?: string }) {
  const rows = describeBlockers(blockers, teacherNames, period)
  return <ul className="planning-blockers" aria-label={label}>{rows.map((row) => <li key={row.teacherId}>
    <strong>{row.teacherName}</strong> · {row.load}
    <span className="planning-blockers__requirement">{row.requirement}</span>
    {row.sources.length > 0 && <span className="planning-blockers__sources">Fuente: {row.sources.map((source) => source.id).join(', ')}</span>}
  </li>)}</ul>
}

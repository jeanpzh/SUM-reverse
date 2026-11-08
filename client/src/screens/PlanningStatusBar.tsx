import type { AcademicProposal } from '../data/academicScheduling'
import { academicSectionCoverage, academicSectionLabel, academicSessionLabel, formatAcademicDuration } from '../data/academicScheduling'
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/Dialog'
import './PlanningStatusBar.css'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Alert, AlertDescription } from '../components/ui/Alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/Collapsible'

const diagnosticLabels: Record<string, string> = {
  PARTIAL_PROPOSAL: 'Propuesta parcial',
  TEACHER_CAPACITY_SHORTFALL: 'Capacidad docente insuficiente',
  NO_SCHEDULING_WINDOW: 'Sin horario disponible',
  INSUFFICIENT_COURSE_TEACHER_LOAD: 'Carga docente insuficiente para el curso',
}

export interface PlanningStatusBarProps {
  primaryActionId?: string
  proposal: AcademicProposal
  onRegenerate?: () => void
  onReviewPending?: () => void
  isDraft?: boolean
  isLocked?: boolean
}

function statusLabel(status: AcademicProposal['status']) {
  switch (status) {
    case 'complete': return 'Programación completa'
    case 'impossible': return 'Sin solución completa en el dominio configurado'
    case 'search-limit': return 'Búsqueda inconclusa por límite computacional'
    case 'invalid-input': return 'Demanda fuera de los límites del generador'
  }
}

function countAssignedConflicts(assignments: AcademicProposal['assignments']): number {
  let count = 0
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i]
      const b = assignments[j]
      if (a.day === b.day && a.startMinute < b.endMinute && b.startMinute < a.endMinute) {
        if (a.teacherId === b.teacherId || a.roomId === b.roomId) {
          count++
        }
      }
    }
  }
  return count
}

export function PlanningStatusBar({ primaryActionId, proposal, onRegenerate, onReviewPending, isDraft = true, isLocked = false }: PlanningStatusBarProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const diagnosticGroups = Object.values(proposal.diagnostics.reduce<Record<string, typeof proposal.diagnostics>>((groups, diagnostic) => {
    const group = groups[diagnostic.code] ??= []
    group.push(diagnostic)
    return groups
  }, {})).sort((a, b) => Number(b[0]?.code === 'PARTIAL_PROPOSAL') - Number(a[0]?.code === 'PARTIAL_PROPOSAL'))
  const coverage = academicSectionCoverage(proposal)
  const scheduled = proposal.counts.scheduledSessions
  const required = proposal.counts.requiredSessions
  const totalSections = proposal.counts.sections
  const conflicts = countAssignedConflicts(proposal.assignments)

  let badgeText = 'Completa'
  let headline = `Programación completa · ${scheduled}/${required} componentes`
  let subtext = `${coverage.complete}/${totalSections} secciones completas · ${conflicts} cruces en lo asignado`
  let diagnosisText: string | null = null

  if (proposal.status === 'search-limit') {
    badgeText = 'Búsqueda inconclusa'
    headline = `Búsqueda inconclusa · ${scheduled}/${required} componentes`
    subtext = `${coverage.complete}/${totalSections} secciones completas · ${conflicts} cruces en lo asignado`
    diagnosisText = 'La búsqueda alcanzó su límite computacional. No prueba que no exista solución en el dominio configurado.'
  } else if (proposal.status === 'impossible') {
    const partial = proposal.diagnostics.some((d) => d.code === 'PARTIAL_PROPOSAL')
    const notices = proposal.diagnostics.length
    badgeText = partial ? 'Propuesta parcial' : 'Sin solución completa'
    headline = `${badgeText} · ${scheduled}/${required} componentes`
    subtext = `${coverage.complete}/${totalSections} secciones completas · ${conflicts} cruces en lo asignado${notices > 1 ? ` · ${notices} avisos` : ''}`
    diagnosisText = notices === 1
      ? proposal.diagnostics[0].message
      : partial
        ? 'Quedan secciones sin colocar; no se demostró que sea imposible completarlas. Revisa los avisos.'
        : 'Sin solución completa en el dominio configurado.'
  } else if (proposal.status === 'invalid-input') {
    badgeText = 'Entrada inválida'
    headline = 'Demanda fuera de los límites del generador'
    subtext = 'Corrige la configuración de demanda o capacidades para continuar.'
  }

  return (
    <section
      className="planning-status-bar box-border flex min-w-0 flex-col gap-3 rounded-planning-panel border border-solid border-border bg-background px-4 py-3 text-foreground [overflow-wrap:anywhere]"
      aria-labelledby="academic-scheduling-result"
      role="status"
    >
      <div className="planning-status-bar__header flex min-w-0 flex-col gap-2">
        <div className="planning-status-bar__state-row flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant={proposal.status === 'complete' ? 'success' : proposal.status === 'invalid-input' ? 'destructive' : 'warning'}>
            {badgeText}
          </Badge>
          {isDraft && <Badge variant="outline">Borrador · sin confirmar</Badge>}
          {!diagnosisText && (
            <span className="planning-status-bar__status-full text-[13px] text-muted-foreground">
              {statusLabel(proposal.status)}
            </span>
          )}
        </div>
        <h3 id="academic-scheduling-result" className="planning-status-bar__headline m-0 text-lg font-semibold leading-6 tabular-nums">
          {headline}
        </h3>
        <p className="planning-status-bar__subtext m-0 text-sm text-muted-foreground tabular-nums">
          {proposal.diagnostics.length > 0
            ? `${coverage.complete}/${totalSections} secciones colocadas · ${proposal.diagnostics.length} avisos`
            : subtext}
        </p>
        {proposal.diagnostics.length > 0 && <Button type="button" variant="ghost" size="sm" className="w-fit justify-start px-0 underline" aria-haspopup="dialog" onClick={() => setDiagnosticsOpen(true)}>Ver avisos</Button>}
        {diagnosisText && (
          <Alert variant={proposal.status === 'invalid-input' ? 'destructive' : 'warning'}>
            <AlertDescription>{diagnosisText}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="planning-status-bar__actions flex min-w-0 flex-wrap items-center gap-2">
        {(coverage.partial + coverage.pending) > 0 && onReviewPending && (
          <Button
            type="button"
            variant={primaryActionId === 'resolve-pending' ? 'default' : 'outline'}
            onClick={onReviewPending}
          >
            Revisar pendientes
          </Button>
        )}
        {onRegenerate && (
          <Button
            type="button"
            variant="outline"
            disabled={isLocked}
            onClick={onRegenerate}
          >
            Volver a generar
          </Button>
        )}
      </div>

      <Collapsible className="min-w-0 border-0 border-t border-solid border-border pt-2">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm">Detalles de búsqueda</Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="planning-status-bar__details-content mt-2 flex min-w-0 flex-col gap-2">
          <dl className="academic-scheduling__counts">
            <div><dt>Secciones</dt><dd>{proposal.counts.sections}</dd></div>
            <div><dt>Completas</dt><dd>{coverage.complete}</dd></div>
            <div><dt>Parciales</dt><dd>{coverage.partial}</dd></div>
            <div><dt>Pendientes</dt><dd>{coverage.pending}</dd></div>
            <div><dt>Componentes asignados</dt><dd>{scheduled}</dd></div>
            <div><dt>Componentes requeridos</dt><dd>{required}</dd></div>
          </dl>
          <p className="academic-scheduling__stats">
            Búsqueda local: {proposal.stats.exploredCandidates} candidatos explorados, {proposal.stats.candidateVisits} visitas y {proposal.stats.backtracks} retrocesos.
            {proposal.stats.limitReason && <> Límite: {proposal.stats.limitReason}.</>}
          </p>
          {proposal.pending.length > 0 && (
            <div className="academic-scheduling__diagnostics">
              <h4>Componentes pendientes</h4>
              <ul>
                {proposal.pending.map((pending) => (
                  <li key={pending.sessionId}>
                    {proposal.sections.find((section) => section.sectionId === pending.sectionId)?.courseName ?? pending.courseId}
                    {' · '}Sección {academicSectionLabel(proposal, pending.sectionId)}
                    {' · '}{formatAcademicDuration(pending.durationMinutes)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {proposal.preferenceReport && (
            <div className="academic-scheduling__preference-report">
              <h4>Resultado de preferencias · {proposal.preferenceReport.policy}</h4>
              <p>
                {proposal.preferenceReport.withinPreferenceSections} secciones dentro de preferencia, {proposal.preferenceReport.outsidePreferenceSections} fuera y {proposal.preferenceReport.withoutPreferenceSections} sin preferencia evaluable. La búsqueda no demuestra un óptimo global.
              </p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
      <Dialog open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
        <DialogContent className="planning-status-bar__dialog min-w-0">
          <DialogHeader>
            <DialogTitle>Avisos de la generación</DialogTitle>
            <DialogDescription>{proposal.diagnostics.length} avisos agrupados por tipo</DialogDescription>
          </DialogHeader>
          <div className="planning-status-bar__groups grid min-w-0 gap-3">
            {diagnosticGroups.map((group) => {
              const code = group[0].code
              return <Collapsible key={code} defaultOpen={code === 'PARTIAL_PROPOSAL'} className="min-w-0 border-0 border-b border-solid border-border pb-3">
                <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="w-full justify-between text-left">{diagnosticLabels[code] ?? 'Otro aviso'} <Badge variant="secondary">{group.length}</Badge></Button></CollapsibleTrigger>
                <CollapsibleContent className="text-sm [&_ul]:grid [&_ul]:gap-2 [&_ul]:pl-5 [overflow-wrap:anywhere]">
                  {code === 'PARTIAL_PROPOSAL' && <p>La propuesta contiene secciones que no pudieron colocarse por completo.</p>}
                  <ul>{group.map((diagnostic, index) => <li key={`${code}-${index}`}>{diagnostic.message}{diagnostic.sessionIds.length > 0 && <span> Sesiones: {diagnostic.sessionIds.map((id) => academicSessionLabel(proposal, id)).join('; ')}.</span>}</li>)}</ul>
                </CollapsibleContent>
              </Collapsible>
            })}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

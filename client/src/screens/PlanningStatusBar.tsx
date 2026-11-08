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
  let headline = `${scheduled}/${required} componentes asignados`
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
      data-status={proposal.status}
      role="status"
    >
      <div className="planning-status-bar__header flex min-w-0 flex-col gap-2">
        <div className="planning-status-bar__state-row flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant={proposal.status === 'complete' ? 'success' : proposal.status === 'invalid-input' ? 'destructive' : 'warning'}>
            {badgeText}
          </Badge>
          {isDraft && <Badge variant="outline">Borrador · sin confirmar</Badge>}
          <h3 id="academic-scheduling-result" className="planning-status-bar__headline m-0 min-w-0 text-lg font-semibold leading-6 tabular-nums">
            {headline}
          </h3>
        </div>
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
        <CollapsibleContent className="planning-status-bar__details-content mt-2 flex min-w-0 flex-col gap-3">
          <dl className="academic-scheduling__counts not-typeset">
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
          {proposal.pending.length > 0 && (() => {
            const groupedPending: Array<{
              courseId: string
              courseName: string
              sections: Array<{ sectionId: string; sectionLabel: string; durations: string[] }>
            }> = []
            const byCourse = new Map<string, typeof groupedPending[number]>()
            for (const pending of proposal.pending) {
              const courseName = proposal.sections.find((s) => s.sectionId === pending.sectionId)?.courseName ?? pending.courseId
              let courseGroup = byCourse.get(pending.courseId)
              if (!courseGroup) {
                courseGroup = { courseId: pending.courseId, courseName, sections: [] }
                byCourse.set(pending.courseId, courseGroup)
                groupedPending.push(courseGroup)
              }
              let sectionEntry = courseGroup.sections.find((s) => s.sectionId === pending.sectionId)
              if (!sectionEntry) {
                sectionEntry = {
                  sectionId: pending.sectionId,
                  sectionLabel: academicSectionLabel(proposal, pending.sectionId),
                  durations: [],
                }
                courseGroup.sections.push(sectionEntry)
              }
              sectionEntry.durations.push(formatAcademicDuration(pending.durationMinutes))
            }
            return (
              <div className="academic-scheduling__diagnostics typeset typeset-planning">
                <div className="not-typeset flex flex-wrap items-center justify-between gap-2">
                  <h4 className="m-0 text-sm font-semibold text-foreground">Componentes pendientes</h4>
                  <Badge variant="outline">
                    {proposal.pending.length} {proposal.pending.length === 1 ? 'componente' : 'componentes'} en {groupedPending.reduce((acc, g) => acc + g.sections.length, 0)} {groupedPending.reduce((acc, g) => acc + g.sections.length, 0) === 1 ? 'sección' : 'secciones'}
                  </Badge>
                </div>
                <ul className="planning-status-bar__pending-compact">
                  {groupedPending.map((group) => (
                    <li key={group.courseId}>
                      <strong>{group.courseName}</strong>{' '}
                      <span className="text-muted-foreground">({group.courseId})</span>:{' '}
                      {group.sections
                        .map((sec) => `Sección ${sec.sectionLabel} (${sec.durations.join(' + ')})`)
                        .join(' · ')}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}
          {proposal.preferenceReport && (
            <div className="academic-scheduling__preference-report typeset typeset-planning">
              <h4>Resultado de preferencias · {proposal.preferenceReport.policy}</h4>
              <p>
                {proposal.preferenceReport.withinPreferenceSections} secciones dentro de preferencia, {proposal.preferenceReport.outsidePreferenceSections} fuera y {proposal.preferenceReport.withoutPreferenceSections} sin preferencia evaluable. La búsqueda no demuestra un óptimo global.
              </p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
      <Dialog open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
        <DialogContent className="planning-status-bar__dialog min-w-0 sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Avisos de la generación</DialogTitle>
            <DialogDescription>{proposal.diagnostics.length} avisos agrupados por tipo</DialogDescription>
          </DialogHeader>
          <div className="planning-status-bar__groups grid min-w-0 gap-3">
            {diagnosticGroups.map((group) => {
              const code = group[0].code
              return (
                <Collapsible key={code} defaultOpen={code === 'PARTIAL_PROPOSAL'} className="min-w-0 rounded-planning-control border border-solid border-border bg-muted/40 p-3">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="w-full justify-between px-2 py-1.5 text-left font-semibold">
                      <span>{diagnosticLabels[code] ?? 'Otro aviso'}</span>
                      <Badge variant="secondary">{group.length}</Badge>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="typeset typeset-planning mt-2 border-0 border-t border-solid border-border pt-2.5 text-sm [overflow-wrap:anywhere]">
                    {code === 'PARTIAL_PROPOSAL' && <p>La propuesta contiene secciones que no pudieron colocarse por completo.</p>}
                    <ul className="planning-status-bar__diagnostic-list">
                      {group.map((diagnostic, index) => {
                        const groupedSessions = new Map<string, { courseName: string; sections: Map<string, number> }>()
                        for (const id of diagnostic.sessionIds) {
                          const session = [...proposal.assignments, ...proposal.pending].find((item) => item.sessionId === id)
                          if (!session) continue
                          const courseName = proposal.sections.find((item) => item.sectionId === session.sectionId)?.courseName ?? session.courseId
                          const secLabel = academicSectionLabel(proposal, session.sectionId)
                          let entry = groupedSessions.get(session.courseId)
                          if (!entry) {
                            entry = { courseName, sections: new Map() }
                            groupedSessions.set(session.courseId, entry)
                          }
                          entry.sections.set(secLabel, (entry.sections.get(secLabel) ?? 0) + 1)
                        }
                        const courseSummaries = [...groupedSessions.entries()]
                        return (
                          <li key={`${code}-${index}`} className="planning-status-bar__diagnostic-item">
                            <p className="m-0 font-medium text-foreground">{diagnostic.message}</p>
                            {courseSummaries.length > 0 && (
                              <details className="planning-status-bar__diagnostic-sessions not-typeset mt-1.5 rounded-planning-control border border-solid border-border bg-background px-3 py-2 text-xs">
                                <summary className="cursor-pointer font-semibold text-foreground">
                                  Sesiones afectadas ({diagnostic.sessionIds.length} {diagnostic.sessionIds.length === 1 ? 'componente' : 'componentes'} en {courseSummaries.length} {courseSummaries.length === 1 ? 'curso' : 'cursos'})
                                </summary>
                                <ul className="mt-2 grid max-h-48 gap-1.5 overflow-y-auto pl-4 text-muted-foreground">
                                  {courseSummaries.map(([courseId, info]) => {
                                    const secText = [...info.sections.entries()]
                                      .map(([sec, count]) => count > 1 ? `sección ${sec} (×${count})` : `sección ${sec}`)
                                      .join(', ')
                                    return (
                                      <li key={courseId}>
                                        <strong className="text-foreground">{info.courseName}</strong>: {secText}
                                      </li>
                                    )
                                  })}
                                </ul>
                                <span className="sr-only">
                                  {' '}Sesiones: {diagnostic.sessionIds.map((id) => academicSessionLabel(proposal, id)).join('; ')}.
                                </span>
                              </details>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

import type { AcademicAdvisorPatch, AcademicAdvisorResponse, AcademicProposal, PlanningPeriod } from '../data/academicScheduling'
import { academicSectionCoverage, academicSectionLabel, defaultAcademicAdvisorSelection, academicSessionLabel, fetchAcademicProposalAdvice, formatAcademicDuration, hasCurrentAdvisorImpact } from '../data/academicScheduling'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/Dialog'
import './PlanningStatusBar.css'
import { PlanningAssistAdvisor } from './PlanningAssistAdvisor'
import { planningAssist, usePlanningAssist } from './PlanningAssistState'
import { PlanningResultStrip } from './PlanningResultStrip'
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
  onRetrySearch?: () => void
  academicPeriod: PlanningPeriod
  proposal: AcademicProposal
  onApplyAdvisorPatches?: (patches: AcademicAdvisorPatch[]) => Promise<boolean | void> | boolean | void
  teacherNames?: Record<string, string>
  courseNames?: Record<string, string>
  roomNames?: Record<string, string>
  isDraft?: boolean
  isLocked?: boolean
  advisorDisabledReason?: string
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

function resultWording(proposal: AcademicProposal) {
  let badgeText = 'Completa'
  let headline = 'Programación completa'
  let subtext: string | null = null
  let diagnosisText: string | null = null

  if (proposal.status === 'search-limit') {
    badgeText = 'Búsqueda inconclusa'
    headline = 'La programación aún tiene secciones por completar'
    subtext = 'La búsqueda se detuvo antes de completar la programación. Revisa las secciones pendientes o ajusta las restricciones.'
    diagnosisText = 'La búsqueda alcanzó su límite computacional. No prueba que no exista solución en el dominio configurado.'
  } else if (proposal.status === 'impossible') {
    const partial = proposal.diagnostics.some((d) => d.code === 'PARTIAL_PROPOSAL')
    const notices = proposal.diagnostics.length
    badgeText = partial ? 'Propuesta parcial' : 'Sin solución completa'
    headline = badgeText
    subtext = null
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

  return { badgeText, headline, subtext, diagnosisText }
}

export function PlanningStatusBar({ onRetrySearch, proposal, academicPeriod, onApplyAdvisorPatches, teacherNames = {}, courseNames = {}, roomNames = {}, isLocked = false, advisorDisabledReason }: PlanningStatusBarProps) {
  const advisorDisabledReasonId = useId()
  const applyDisabledReasonId = useId()
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [advisorRequested, setAdvisorRequested] = useState(false)
  const [advisorLoading, setAdvisorLoading] = useState(false)
  const [advisorError, setAdvisorError] = useState<string | null>(null)
  const [advisorData, setAdvisorData] = useState<AcademicAdvisorResponse | null>(null)
  const [selectedRecIds, setSelectedRecIds] = useState<string[]>([])
  const [applying, setApplying] = useState(false)
  const requestRef = useRef<AbortController | null>(null)
  const requestedSelection = useRef<string[] | undefined>(undefined)
  const editVersion = proposal.editVersion ?? 0
  useEffect(() => () => requestRef.current?.abort(), [proposal.proposalId, editVersion])
  useEffect(() => planningAssist.registerAdvisor(), [])
  const { slot: advisorSlot } = usePlanningAssist()

  const currentAdvice = advisorData?.proposalId === proposal.proposalId && advisorData.editVersion === editVersion
    ? advisorData : null
  const previewCurrent = hasCurrentAdvisorImpact(currentAdvice, proposal.proposalId, editVersion, selectedRecIds)
  const impact = previewCurrent ? currentAdvice?.verifiedImpact : undefined
  const applyDisabledReason = !onApplyAdvisorPatches || currentAdvice?.recommendations.length === 0 ? null
    : isLocked ? advisorDisabledReason ?? 'La propuesta está bloqueada para cambios.'
    : selectedRecIds.length === 0 ? 'Marca al menos una recomendación para continuar.'
    : !previewCurrent ? 'La selección cambió o no tiene una simulación vigente. Pulsa «Simular selección actual» antes de aplicar.'
    : null

  const requestAdvice = async (ids?: string[]) => {
    requestedSelection.current = ids === undefined ? undefined : [...ids]
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setAdvisorError(null)
    setAdvisorLoading(true)
    setAdvisorData(null)
    try {
      const response = await fetchAcademicProposalAdvice(proposal.proposalId, editVersion, globalThis.fetch, controller.signal, ids)
      if (controller.signal.aborted) return
      setAdvisorData(response)
      setSelectedRecIds(ids ?? defaultAcademicAdvisorSelection(response))
    } catch (error) {
      if (!controller.signal.aborted) setAdvisorError(error instanceof Error ? error.message : 'No se pudo consultar al consejero de planificación.')
    } finally {
      if (!controller.signal.aborted) setAdvisorLoading(false)
    }
  }

  const openAdvisor = () => {
    setAdvisorRequested(true)
    planningAssist.requestOpen('consejero')
    void requestAdvice()
  }

  const cancelAdvisor = () => {
    requestRef.current?.abort()
    setAdvisorLoading(false)
    setAdvisorRequested(false)
  }

  const toggleRecommendation = (id: string, checked: boolean) => {
    setSelectedRecIds((prev) => checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((item) => item !== id))
    // Discard the preview even if the user later returns to the original selection.
    setAdvisorData((prev) => prev ? { ...prev, verifiedImpact: undefined } : prev)
  }

  const applySelectedRecommendations = async () => {
    if (!currentAdvice || !onApplyAdvisorPatches || !previewCurrent || isLocked || applying || advisorLoading) return
    const patches = currentAdvice.recommendations.filter((r) => selectedRecIds.includes(r.id)).map((r) => r.patch)
    if (!patches.length) return
    setApplying(true)
    setAdvisorError(null)
    try {
      const applied = await onApplyAdvisorPatches(patches)
      if (applied !== false) planningAssist.requestClose()
    } catch (error) {
      setAdvisorError(error instanceof Error ? error.message : 'No se pudieron aplicar los cambios.')
    } finally {
      setApplying(false)
    }
  }

  const diagnosticGroups = Object.values(proposal.diagnostics.reduce<Record<string, typeof proposal.diagnostics>>((groups, diagnostic) => {
    const group = groups[diagnostic.code] ??= []
    group.push(diagnostic)
    return groups
  }, {})).sort((a, b) => Number(b[0]?.code === 'PARTIAL_PROPOSAL') - Number(a[0]?.code === 'PARTIAL_PROPOSAL'))
  const coverage = academicSectionCoverage(proposal)
  const totalSections = proposal.counts.sections
  const conflicts = countAssignedConflicts(proposal.assignments)

  const { badgeText, headline, subtext, diagnosisText } = resultWording(proposal)

  return (
    <PlanningResultStrip status={proposal.status} statusId="academic-scheduling-result"
      label={proposal.status === 'complete' ? headline : badgeText}
      facts={[<><span className="planning-desktop-fact">{coverage.complete} de {totalSections} secciones completas</span><span className="planning-mobile-fact">{coverage.complete} de {totalSections} completas</span></>, `${coverage.partial + coverage.pending} por completar`, `${conflicts} cruces en lo asignado`]}
      action={<>
          {proposal.diagnostics.length > 0 && <Button type="button" variant="link" size="sm" aria-haspopup="dialog" onClick={() => setDiagnosticsOpen(true)}>Ver avisos ({proposal.diagnostics.length})</Button>}
          {(coverage.partial + coverage.pending) > 0 && onApplyAdvisorPatches && <>
            <Button type="button" variant="outline" size="sm" disabled={isLocked}
              aria-describedby={isLocked && advisorDisabledReason ? advisorDisabledReasonId : undefined}
              onClick={() => void openAdvisor()}>Consultar consejero</Button>
            {isLocked && advisorDisabledReason && <span id={advisorDisabledReasonId} role="status"
              className="text-sm text-muted-foreground">{advisorDisabledReason}</span>}
          </>}
      </>}>

      {(subtext || diagnosisText) && <p className="planning-status-bar__subtext">{subtext ?? diagnosisText}</p>}
      <Dialog open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
        <DialogContent showCloseButton={false} className="planning-status-bar__dialog min-w-0 sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Avisos de la generación</DialogTitle>
            <DialogDescription>{proposal.diagnostics.length} avisos agrupados por tipo</DialogDescription>
            {onRetrySearch && <Button variant="link" disabled={isLocked} onClick={onRetrySearch}>Reintentar búsqueda</Button>}
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
      {advisorSlot && createPortal(<PlanningAssistAdvisor
        academicPeriod={academicPeriod} editVersion={editVersion} openSections={coverage.partial + coverage.pending}
        requested={advisorRequested} loading={advisorLoading} error={advisorError} advice={currentAdvice} impact={impact}
        selectedIds={selectedRecIds} applying={applying} isLocked={isLocked} canApply={Boolean(onApplyAdvisorPatches)}
        previewCurrent={previewCurrent} applyDisabledReason={applyDisabledReason} applyDisabledReasonId={applyDisabledReasonId}
        canConsult={Boolean(onApplyAdvisorPatches) && !isLocked && coverage.partial + coverage.pending > 0}
        consultDisabledReason={isLocked ? advisorDisabledReason ?? 'La propuesta está bloqueada para cambios.' : coverage.partial + coverage.pending === 0 ? 'No hay secciones por completar.' : undefined}
        consultDisabledReasonId={advisorDisabledReasonId + '-rail'}
        teacherNames={teacherNames} courseNames={courseNames} roomNames={roomNames}
        onConsult={() => void openAdvisor()} onCancel={cancelAdvisor} onRetry={() => void requestAdvice(requestedSelection.current)}
        onToggle={toggleRecommendation} onSimulate={() => void requestAdvice([...selectedRecIds])}
        onApply={() => void applySelectedRecommendations()} />, advisorSlot)}
    </PlanningResultStrip>
  )
}

export function PlanningSearchDetails({ proposal }: { proposal: AcademicProposal }) {
  const coverage = academicSectionCoverage(proposal)
  const scheduled = proposal.counts.scheduledSessions
  const required = proposal.counts.requiredSessions
  const { diagnosisText } = resultWording(proposal)
  return (
      <Collapsible className="planning-status-bar__details min-w-0 border-0 border-t border-solid border-border pt-2">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm">Detalles de búsqueda</Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="planning-status-bar__details-content mt-2 flex min-w-0 flex-col gap-3">
          {diagnosisText && (
            <Alert variant={proposal.status === 'invalid-input' ? 'destructive' : 'warning'}>
              <AlertDescription>{diagnosisText}</AlertDescription>
            </Alert>
          )}
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
  )
}

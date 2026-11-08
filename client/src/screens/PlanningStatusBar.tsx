import type { AcademicProposal } from '../data/academicScheduling'
import { academicSectionCoverage, academicSectionLabel, academicSessionLabel, formatAcademicDuration } from '../data/academicScheduling'
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/Dialog'
import './PlanningStatusBar.css'

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

export function PlanningStatusBar({ primaryActionId, proposal, onRegenerate, onReviewPending, isLocked = false }: PlanningStatusBarProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const diagnosticGroups = Object.values(proposal.diagnostics.reduce<Record<string, typeof proposal.diagnostics>>((groups, diagnostic) => {
    ;(groups[diagnostic.code] ??= []).push(diagnostic)
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
      className={`academic-scheduling__result planning-status-bar academic-scheduling__result--${proposal.status}`}
      aria-labelledby="academic-scheduling-result"
      role="status"
    >
      <div className="planning-status-bar__header">
        <div className="planning-status-bar__state-row">
          <span className={`planning-status-bar__badge planning-status-bar__badge--${proposal.status}`}>
            {badgeText}
          </span>
          <span className="planning-status-bar__status-full">
            {statusLabel(proposal.status)}
          </span>
        </div>
        <h3 id="academic-scheduling-result" className="planning-status-bar__headline">
          {headline}
        </h3>
        <p className="planning-status-bar__subtext">
          {proposal.diagnostics.length > 0
            ? `${coverage.complete}/${totalSections} secciones colocadas · ${proposal.diagnostics.length} avisos`
            : subtext}
        </p>
        {proposal.diagnostics.length > 0 && <button type="button" className="planning-status-bar__notices" aria-haspopup="dialog" onClick={() => setDiagnosticsOpen(true)}>Ver avisos</button>}
        {diagnosisText && (
          <p className="planning-status-bar__diagnosis">
            {diagnosisText}
          </p>
        )}
      </div>

      <div className="planning-status-bar__actions">
        {(coverage.partial + coverage.pending) > 0 && onReviewPending && (
          <button
            type="button"
            className={`academic-scheduling__button${primaryActionId === 'resolve-pending' ? '' : ' academic-scheduling__button--secondary'}`}
            onClick={onReviewPending}
          >
            Revisar pendientes
          </button>
        )}
        {onRegenerate && (
          <button
            type="button"
            className="academic-scheduling__button academic-scheduling__button--secondary"
            disabled={isLocked}
            onClick={onRegenerate}
          >
            Volver a generar
          </button>
        )}
      </div>

      <details className="planning-status-bar__details">
        <summary className="planning-status-bar__details-summary">
          Detalles de búsqueda
        </summary>
        <div className="planning-status-bar__details-content">
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
        </div>
      </details>
      <Dialog open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
        <DialogContent className="planning-status-bar__dialog">
          <DialogHeader>
            <DialogTitle>Avisos de la generación</DialogTitle>
            <DialogDescription>{proposal.diagnostics.length} avisos agrupados por tipo</DialogDescription>
          </DialogHeader>
          <div className="planning-status-bar__groups">
            {diagnosticGroups.map((group) => {
              const code = group[0].code
              return <details key={code} open={code === 'PARTIAL_PROPOSAL'}>
                <summary>{diagnosticLabels[code] ?? 'Otro aviso'} <span>{group.length}</span></summary>
                {code === 'PARTIAL_PROPOSAL' && <p>La propuesta contiene secciones que no pudieron colocarse por completo.</p>}
                <ul>{group.map((diagnostic, index) => <li key={`${code}-${index}`}>{diagnostic.message}{diagnostic.sessionIds.length > 0 && <span> Sesiones: {diagnostic.sessionIds.map((id) => academicSessionLabel(proposal, id)).join('; ')}.</span>}</li>)}</ul>
              </details>
            })}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

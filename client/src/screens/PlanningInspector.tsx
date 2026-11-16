import { X } from 'lucide-react'
import { PlanningWeekAdjustment } from './PlanningWeekAdjustment'
import { Button } from '../components/ui/Button'
import { useMemo } from 'react'
import type {
  AcademicAdjustment,
  AcademicPlanningResources,
} from '../../../shared/programacion-academica-api.mjs'
import type {
  AcademicCatalog,
  AcademicProposal,
} from '../data/academicScheduling'
import { Sheet, SheetContent, SheetTitle } from '../components/ui/Sheet'
import {
  academicSectionLabel,
  aggregateAcademicBlocks,
  formatAcademicMinute,
} from '../data/academicScheduling'


export interface PlanningInspectorProps {
  sectionId: string | null
  proposal: AcademicProposal
  proposalResources: AcademicPlanningResources | null
  catalog: AcademicCatalog | null
  editingBlock: AcademicAdjustment | null
  adjusting: boolean
  adjustmentError: string | null
  docked?: boolean
  isLocked?: boolean
  onViewWeek: () => void
  onClose: () => void
  onStartEdit: (block: ReturnType<typeof aggregateAcademicBlocks>[number]) => void
  onCancelEdit: () => void
  onSubmitEdit: () => Promise<void>
  onChangeEditingBlock: (next: AcademicAdjustment) => void
}

export function PlanningInspector({
  sectionId,
  proposal,
  proposalResources,
  catalog,
  editingBlock,
  adjusting,
  adjustmentError,
  docked = false,
  isLocked = false,
  onClose,
  onViewWeek,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onChangeEditingBlock,
}: PlanningInspectorProps) {
  const blocks = useMemo(() => aggregateAcademicBlocks(proposal), [proposal])

  if (!sectionId) return null

  const section = proposal.sections.find((s) => s.sectionId === sectionId)
  if (!section) return null

  const sectionBlocks = blocks.filter((b) => b.sectionId === sectionId)
  const pendingComponents = proposal.pending.filter((p) => p.sectionId === sectionId)
  const isEditing = editingBlock !== null && editingBlock.sectionId === sectionId

  const activeBlock = isEditing
    ? sectionBlocks.find(
      (b) =>
        b.sessionIds.length === editingBlock.sessionIds.length &&
        b.sessionIds.every((id, idx) => id === editingBlock.sessionIds[idx])
    ) ?? sectionBlocks[0]
    : null

  if (isEditing && activeBlock) return <PlanningWeekAdjustment
    proposal={proposal} proposalResources={proposalResources} catalog={catalog}
    editingBlock={editingBlock} activeBlock={activeBlock} adjusting={adjusting}
    adjustmentError={adjustmentError} docked={docked} onCancelEdit={onCancelEdit}
    onSubmitEdit={onSubmitEdit} onChangeEditingBlock={onChangeEditingBlock} onStartEdit={onStartEdit} />

  const assignedComponents = new Map<string, AcademicProposal['assignments']>()
  for (const item of proposal.assignments.filter((item) => item.sectionId === sectionId)) {
    const key = `${item.sessionType ?? 'Componente'}|${item.teacherId}|${item.roomId}`
    assignedComponents.set(key, [...(assignedComponents.get(key) ?? []), item])
  }
  const dayNamesFull = ['—', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const sLabel = academicSectionLabel(proposal, section.sectionId)

  const title = <h2 id="planning-detail-title" className="planning-inspector__title">{section.courseName}</h2>
  const body = (<>
        <div className="planning-inspector__header">
          <div className="planning-inspector__heading-info">
            <p className="planning-inspector__meta">{section.courseId} · Sección {sLabel} · {section.capacity} vacantes</p>
            {docked ? title : <SheetTitle className="planning-inspector__title">{section.courseName}</SheetTitle>}
          </div>
          <div className="planning-inspector__actions">
            <Button variant="outline" onClick={onViewWeek}>Ver en Semana</Button>
            <Button variant="outline" disabled={isLocked || !sectionBlocks.length || adjusting} onClick={() => onStartEdit(sectionBlocks[0])}>Editar horario</Button>
            <Button variant="ghost" type="button" className="planning-inspector__close-btn" onClick={onClose} aria-label="Cerrar detalle"><X size={14} aria-hidden="true" /></Button>
          </div>
        </div>

        {!isEditing && <div className="planning-detail-cards">
          {[...assignedComponents.values()].map((items) => {
            const item = items[0]
            const room = proposalResources?.rooms.find((room) => room.id === item.roomId)
            return <article className="planning-detail-card" key={item.sessionId}>
              <header><span>{item.sessionType ?? 'Componente'}</span><span className="planning-horario-status--Completa">✓ Asignada</span></header>
              <dl><dt>Docente</dt><dd>{item.teacherName}</dd><dt>Ambiente</dt><dd>{item.roomName}{room ? ` · ${room.capacity}` : ''}</dd><dt>Horario</dt><dd className="planning-horario-mono">{items.map((session) => `${dayNamesFull[session.day].slice(0, 3)} ${formatAcademicMinute(session.startMinute)}–${formatAcademicMinute(session.endMinute)}`).join(' · ')}</dd></dl>
            </article>
          })}
          {pendingComponents.map((item) => <article className="planning-detail-card" key={item.sessionId}>
            <header><span>{catalog?.courses.find((course) => course.courseId === section.courseId)?.weeklySessions.find((session) => item.sessionId === `session:${JSON.stringify([sectionId, session.id])}`)?.type ?? 'Componente'}</span><span className="planning-horario-status--Pendiente">○ Pendiente</span></header>
            <p>{proposal.diagnostics.filter((diagnostic) => diagnostic.sessionIds.includes(item.sessionId)).map((diagnostic) => diagnostic.message).join(' ') || 'Sin motivo registrado'}</p>
            <p className="planning-detail-card__footnote">Causa devuelta por el motor. Un límite de búsqueda no prueba que no exista solución.</p>
          </article>)}
        </div>}
  </>)

  if (docked) {
    return (
      <section className="planning-section-detail planning-inspector planning-inspector--docked"
        aria-label={`Inspector de sección ${sLabel}`}
        onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
        {body}
      </section>
    )
  }
  return (
    <Sheet open modal={false} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="bottom"
        className="planning-section-detail planning-inspector planning-inspector--sheet"
        aria-label={`Inspector de sección ${sLabel}`}
        aria-describedby={undefined}
        showCloseButton={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        {body}
      </SheetContent>
    </Sheet>
  )
}

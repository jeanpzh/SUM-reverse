import { X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Label } from '../components/ui/Label'
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
  formatAcademicDuration,
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

  const activeAssignments = activeBlock
    ? proposal.assignments
      .filter((a) => activeBlock.sessionIds.includes(a.sessionId))
      .sort((a, b) => a.startMinute - b.startMinute || a.sessionId.localeCompare(b.sessionId))
    : []

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

        {isEditing && activeBlock && (
          <section
            id="academic-scheduling-manual-editor"
            className="academic-scheduling__manual-review"
            aria-labelledby="academic-scheduling-manual-review"
          >
            <header className="academic-scheduling__manual-heading">
              <div>
                <h4 id="academic-scheduling-manual-review">
                  Editar horario · {activeBlock.courseName} · Sección {sLabel}
                </h4>
                <p>
                  El ajuste usa los recursos originales de esta propuesta. Las preferencias ordenan alternativas, pero no garantizan un óptimo global.
                </p>
              </div>
              {sectionBlocks.length > 1 && (
                <Label className="academic-scheduling__block-select">
                  Bloque horario
                  <NativeSelect
                    aria-label={`Bloque horario ${activeBlock.sectionId}`}
                    value={activeBlock.sessionIds.join('|')}
                    disabled={adjusting}
                    onChange={(e) => {
                      const next = sectionBlocks.find((b) => b.sessionIds.join('|') === e.currentTarget.value)
                      if (next) onStartEdit(next)
                    }}
                  >
                    {sectionBlocks.map((b) => (
                      <option key={b.sessionIds.join('|')} value={b.sessionIds.join('|')}>
                        {dayNamesFull[b.day]} {formatAcademicMinute(b.startMinute)}–{formatAcademicMinute(b.endMinute)} · {b.componentDetails.map((c) => c.type).join(' + ')}
                      </option>
                    ))}
                  </NativeSelect>
                </Label>
              )}
            </header>

            <div className="academic-scheduling__manual-fields">
              {adjustmentError && (
                <p className="academic-scheduling__inline-error academic-scheduling__manual-error" role="alert">
                  {adjustmentError}
                </p>
              )}
              <div className="planning-inspector__placement-comparison" aria-label="Comparación de ubicación del bloque">
                <div className="planning-inspector__placement-item">
                  <Badge variant="outline" className="planning-inspector__placement-badge planning-inspector__placement-badge--current">
                    Ubicación actual
                  </Badge>
                  <span className="planning-inspector__placement-val">
                    {dayNamesFull[activeBlock.day]} {formatAcademicMinute(activeBlock.startMinute)}–{formatAcademicMinute(activeBlock.endMinute)}
                  </span>
                </div>
                <div className="planning-inspector__placement-item">
                  <Badge variant="outline" className="planning-inspector__placement-badge planning-inspector__placement-badge--proposed">
                    Ubicación propuesta
                  </Badge>
                  <span className="planning-inspector__placement-val">
                    {dayNamesFull[editingBlock.day]} {formatAcademicMinute(editingBlock.startMinute)}–{editingBlock.startMinute + activeBlock.durationMinutes <= 1440 ? formatAcademicMinute(editingBlock.startMinute + activeBlock.durationMinutes) : 'fuera del día'}
                  </span>
                </div>
              </div>

              <p className="academic-scheduling__manual-preview">
                Vista previa: {dayNamesFull[editingBlock.day]} {formatAcademicMinute(editingBlock.startMinute)}–{editingBlock.startMinute + activeBlock.durationMinutes <= 1440 ? formatAcademicMinute(editingBlock.startMinute + activeBlock.durationMinutes) : 'fuera del día'} · duración conservada {formatAcademicDuration(activeBlock.durationMinutes)}.{section.deliveryMode === 'split' ? ' Cambiar docente modifica la responsabilidad de toda la sección; los demás bloques mantienen sus horarios.' : ' Se conserva el bloque continuo completo.'}
              </p>

              <Label>
                Duración (solo lectura)
                <Input
                  type="text"
                  readOnly
                  disabled
                  value={formatAcademicDuration(activeBlock.durationMinutes)}
                  aria-label={`Duración ${activeBlock.sectionId}`}
                />
              </Label>

              <Label>
                Docente responsable
                <NativeSelect
                  aria-label={`Docente revisión ${activeBlock.sectionId}`}
                  value={editingBlock.teacherId}
                  disabled={adjusting}
                  onChange={(e) => onChangeEditingBlock({ ...editingBlock, teacherId: e.currentTarget.value })}
                >
                  {(proposalResources?.teachers ?? [])
                    .filter((teacher: AcademicPlanningResources['teachers'][number]) => teacher.courseIds.includes(activeBlock.courseId))
                    .map((teacher: AcademicPlanningResources['teachers'][number]) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                </NativeSelect>
              </Label>

              <Label>
                Día
                <NativeSelect
                  aria-label={`Día revisión ${activeBlock.sectionId}`}
                  value={editingBlock.day}
                  disabled={adjusting}
                  onChange={(e) => onChangeEditingBlock({ ...editingBlock, day: Number(e.currentTarget.value) })}
                >
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day, idx) => (
                    <option key={day} value={idx + 1}>
                      {day}
                    </option>
                  ))}
                </NativeSelect>
              </Label>

              <Label>
                Hora de inicio
                <Input
                  aria-label={`Inicio revisión ${activeBlock.sectionId}`}
                  type="time"
                  step={catalog?.startStepMinutes ? catalog.startStepMinutes * 60 : 1800}
                  value={formatAcademicMinute(editingBlock.startMinute)}
                  disabled={adjusting}
                  onChange={(e) => {
                    const [hours, minutes] = e.currentTarget.value.split(':').map(Number)
                    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
                      onChangeEditingBlock({ ...editingBlock, startMinute: hours * 60 + minutes })
                    }
                  }}
                />
              </Label>

              <div className="academic-scheduling__manual-components">
                {activeAssignments.map((assignment, index) => {
                  const originalRoom = proposalResources?.rooms.find((room: AcademicPlanningResources['rooms'][number]) => room.id === assignment.roomId)
                  const rooms = (proposalResources?.rooms ?? []).filter(
                    (room: AcademicPlanningResources['rooms'][number]) =>
                      room.capacity >= section.capacity &&
                      (!originalRoom?.kind || room.kind === originalRoom.kind)
                  )
                  return (
                    <Label key={assignment.sessionId}>
                      {assignment.sessionType ?? 'Componente'} · {formatAcademicDuration(assignment.endMinute - assignment.startMinute)}
                      <NativeSelect
                        aria-label={`Ambiente ${assignment.sessionType ?? index + 1} revisión ${activeBlock.sectionId}`}
                        value={editingBlock.roomIds[index] ?? ''}
                        disabled={adjusting}
                        onChange={(e) =>
                          onChangeEditingBlock({
                            ...editingBlock,
                            roomIds: editingBlock.roomIds.map((id: string, rIdx: number) => (rIdx === index ? e.currentTarget.value : id)),
                          })
                        }
                      >
                        {rooms.map((room: AcademicPlanningResources['rooms'][number]) => (
                          <option key={room.id} value={room.id}>
                            {room.name} · capacidad {room.capacity}
                          </option>
                        ))}
                      </NativeSelect>
                    </Label>
                  )
                })}
              </div>

              <div className="academic-scheduling__manual-actions">
                <Button variant="outline"
                  type="button"
                  disabled={
                    adjusting ||
                    !(proposalResources?.teachers ?? []).some((t: AcademicPlanningResources['teachers'][number]) => t.courseIds.includes(activeBlock.courseId))
                  }
                  onClick={() => void onSubmitEdit()}
                >
                  {adjusting ? 'Aplicando…' : 'Aplicar ajuste'}
                </Button>
                <Button variant="outline"
                  type="button"
                  disabled={adjusting}
                  onClick={onCancelEdit}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </section>
        )}

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

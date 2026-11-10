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
import { formatAvailabilitySummary } from '../data/academicResources'

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

  const eligibleTeachers = (proposalResources?.teachers ?? []).filter(
    (t: AcademicPlanningResources['teachers'][number]) => t.courseIds.includes(section.courseId)
  )
  const course = catalog?.courses.find((c) => c.courseId === section.courseId)
  const coursePattern = course?.planningPatterns?.[0]
  const requiresLab = Boolean(
    coursePattern?.weeklySessions.some((s) => s.type === 'laboratorio') ||
    course?.weeklySessions.some((s) => s.type === 'laboratorio')
  )

  const dayNamesFull = ['—', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const sLabel = academicSectionLabel(proposal, section.sectionId)

  const title = <h4 className="planning-inspector__title">{section.courseName} · Sección {sLabel}</h4>
  const body = (<>
        <div className="planning-inspector__header">
          <div className="planning-inspector__heading-info">
            {docked ? title : <SheetTitle asChild>{title}</SheetTitle>}
            <p className="planning-inspector__meta">
              {section.courseId} · Capacidad {section.capacity}
            </p>
          </div>
          <Button variant="ghost"
            type="button"
            className="planning-inspector__close-btn"
            onClick={onClose}
            aria-label="Cerrar inspector"
          >
            <X size={16} aria-hidden="true" />
          </Button>
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

        {!isEditing && (
          <div className="planning-inspector__content">
            {sectionBlocks.length > 0 && (
              <div className="planning-inspector__section">
                <div className="planning-inspector__section-header">
                  <h5 className="planning-inspector__section-title">Bloques asignados</h5>
                  <Button variant="outline"
                    type="button"
                    className="planning-inspector__edit-trigger "
                    disabled={isLocked}
                    onClick={() => onStartEdit(sectionBlocks[0])}
                  >
                    Editar horario
                  </Button>
                </div>
                <div className="planning-inspector__blocks-list">
                  {sectionBlocks.map((b, idx) => (
                    <div key={`${b.sectionId}-${idx}`} className="planning-inspector__block-card">
                      <dl className="planning-inspector__block-facts">
                        <div><dt>Docente</dt><dd>{b.teacherName}</dd></div>
                        <div><dt>Aula</dt><dd>{b.roomNames.join(', ')}</dd></div>
                        <div><dt>Día</dt><dd>{dayNamesFull[b.day]}</dd></div>
                        <div><dt>Horario</dt><dd>{formatAcademicMinute(b.startMinute)}–{formatAcademicMinute(b.endMinute)}</dd></div>
                      </dl>
                      <div className="planning-inspector__block-components">
                        {b.componentDetails.map((c, cIdx) => (
                          <Badge variant="secondary" key={cIdx} className="planning-inspector__component-tag">
                            {c.type} · {formatAcademicDuration(c.durationMinutes)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingComponents.length > 0 && (
              <div className="planning-inspector__section planning-inspector__section--pending typeset typeset-planning">
                <div className="not-typeset flex items-center gap-2">
                  <Badge variant="warning">
                    {pendingComponents.length} {pendingComponents.length === 1 ? 'componente pendiente' : 'componentes pendientes'}
                  </Badge>
                </div>
                <p className="planning-inspector__explanation">
                  {proposal.status === 'search-limit'
                    ? 'La búsqueda alcanzó su límite. No prueba que no exista solución.'
                    : 'Sin solución completa en el dominio configurado.'}
                </p>
                <ul className="planning-inspector__pending-list">
                  {pendingComponents.map((p, index) => {
                    const sessionDef = coursePattern?.weeklySessions[index] ?? course?.weeklySessions[index]
                    const rawType = sessionDef?.type?.trim() ?? ''
                    const typeMap: Record<string, string> = {
                      t: 'Teoría',
                      teoria: 'Teoría',
                      teoría: 'Teoría',
                      p: 'Práctica',
                      practica: 'Práctica',
                      práctica: 'Práctica',
                      l: 'Laboratorio',
                      lab: 'Laboratorio',
                      laboratorio: 'Laboratorio',
                    }
                    const typeLabel = rawType
                      ? (typeMap[rawType.toLowerCase()] ?? (rawType.charAt(0).toUpperCase() + rawType.slice(1)))
                      : `Componente ${index + 1}`
                    return (
                      <li key={p.sessionId}>
                        <strong>{typeLabel}</strong> · {formatAcademicDuration(p.durationMinutes)}
                      </li>
                    )
                  })}
                </ul>

                <h4 className="planning-inspector__section-title">Restricciones de planificación</h4>
                <ul className="planning-inspector__constraints-list">
                  <li>Capacidad mínima: <strong>{section.capacity}</strong></li>
                  {requiresLab && <li>Ambiente requerido: <strong>Laboratorio</strong></li>}
                  {eligibleTeachers.length > 0 ? (
                    <li>
                      {eligibleTeachers.length === 1 ? 'Docente habilitado: ' : 'Docentes habilitados: '}
                      <strong>{eligibleTeachers.map((t: AcademicPlanningResources['teachers'][number]) => t.name).join(', ')}</strong>
                    </li>
                  ) : (
                    <li>Sin docentes habilitados registrados</li>
                  )}
                </ul>

                {eligibleTeachers.length > 0 && (
                  <div className="planning-inspector__availability not-typeset">
                    <h6 className="planning-inspector__avail-title">
                      Disponibilidad ({eligibleTeachers[0].name})
                    </h6>
                    <p className="planning-inspector__avail-summary">
                      {formatAvailabilitySummary(eligibleTeachers[0].availability)} · Disponible
                    </p>
                    <p className="planning-inspector__avail-note">
                      No se asignó docente para esta sección pendiente.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
  </>)

  if (docked) {
    return (
      <section className="planning-inspector planning-inspector--docked"
        aria-label={`Inspector de sección ${sLabel}`}
        onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
        {body}
      </section>
    )
  }
  return (
    <Sheet open modal={false} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        className="planning-inspector planning-inspector--sheet"
        aria-label={`Inspector de sección ${sLabel}`}
        aria-describedby={undefined}
        showCloseButton={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        {body}
      </SheetContent>
    </Sheet>
  )
}

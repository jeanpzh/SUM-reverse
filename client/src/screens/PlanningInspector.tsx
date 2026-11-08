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

  // Non-modal shadcn Sheet: the sections table and the Semana grid stay usable behind it
  // (selecting another section or dragging a block keeps it open); Escape or ✕ closes it.
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
        <div className="planning-inspector__header">
          <div className="planning-inspector__heading-info">
            <SheetTitle asChild>
              <h4 className="planning-inspector__title">
                {section.courseName} · Sección {sLabel}
              </h4>
            </SheetTitle>
            <p className="planning-inspector__meta">
              {section.courseId} · Capacidad {section.capacity}
            </p>
          </div>
          <button
            type="button"
            className="planning-inspector__close-btn"
            onClick={onClose}
            aria-label="Cerrar inspector"
          >
            ✕
          </button>
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
                <label className="academic-scheduling__block-select">
                  Bloque horario
                  <select
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
                  </select>
                </label>
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
                  <span className="planning-inspector__placement-badge planning-inspector__placement-badge--current">
                    Ubicación actual
                  </span>
                  <span className="planning-inspector__placement-val">
                    {dayNamesFull[activeBlock.day]} {formatAcademicMinute(activeBlock.startMinute)}–{formatAcademicMinute(activeBlock.endMinute)}
                  </span>
                </div>
                <div className="planning-inspector__placement-item">
                  <span className="planning-inspector__placement-badge planning-inspector__placement-badge--proposed">
                    Ubicación propuesta
                  </span>
                  <span className="planning-inspector__placement-val">
                    {dayNamesFull[editingBlock.day]} {formatAcademicMinute(editingBlock.startMinute)}–{editingBlock.startMinute + activeBlock.durationMinutes <= 1440 ? formatAcademicMinute(editingBlock.startMinute + activeBlock.durationMinutes) : 'fuera del día'}
                  </span>
                </div>
              </div>

              <p className="academic-scheduling__manual-preview">
                Vista previa: {dayNamesFull[editingBlock.day]} {formatAcademicMinute(editingBlock.startMinute)}–{editingBlock.startMinute + activeBlock.durationMinutes <= 1440 ? formatAcademicMinute(editingBlock.startMinute + activeBlock.durationMinutes) : 'fuera del día'} · duración conservada {formatAcademicDuration(activeBlock.durationMinutes)}.{section.deliveryMode === 'split' ? ' Cambiar docente modifica la responsabilidad de toda la sección; los demás bloques mantienen sus horarios.' : ' Se conserva el bloque continuo completo.'}
              </p>

              <label>
                Duración (solo lectura)
                <input
                  type="text"
                  readOnly
                  disabled
                  value={formatAcademicDuration(activeBlock.durationMinutes)}
                  aria-label={`Duración ${activeBlock.sectionId}`}
                />
              </label>

              <label>
                Docente responsable
                <select
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
                </select>
              </label>

              <label>
                Día
                <select
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
                </select>
              </label>

              <label>
                Hora de inicio
                <input
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
              </label>

              <div className="academic-scheduling__manual-components">
                {activeAssignments.map((assignment, index) => {
                  const originalRoom = proposalResources?.rooms.find((room: AcademicPlanningResources['rooms'][number]) => room.id === assignment.roomId)
                  const rooms = (proposalResources?.rooms ?? []).filter(
                    (room: AcademicPlanningResources['rooms'][number]) =>
                      room.capacity >= section.capacity &&
                      (!originalRoom?.kind || room.kind === originalRoom.kind)
                  )
                  return (
                    <label key={assignment.sessionId}>
                      {assignment.sessionType ?? 'Componente'} · {formatAcademicDuration(assignment.endMinute - assignment.startMinute)}
                      <select
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
                      </select>
                    </label>
                  )
                })}
              </div>

              <div className="academic-scheduling__manual-actions">
                <button
                  type="button"
                  className="academic-scheduling__button"
                  disabled={
                    adjusting ||
                    !(proposalResources?.teachers ?? []).some((t: AcademicPlanningResources['teachers'][number]) => t.courseIds.includes(activeBlock.courseId))
                  }
                  onClick={() => void onSubmitEdit()}
                >
                  {adjusting ? 'Aplicando…' : 'Aplicar ajuste'}
                </button>
                <button
                  type="button"
                  className="academic-scheduling__button academic-scheduling__button--secondary"
                  disabled={adjusting}
                  onClick={onCancelEdit}
                >
                  Cancelar
                </button>
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
                  <button
                    type="button"
                    className="planning-inspector__edit-trigger academic-scheduling__text-button"
                    disabled={isLocked}
                    onClick={() => onStartEdit(sectionBlocks[0])}
                  >
                    Editar horario
                  </button>
                </div>
                <div className="planning-inspector__blocks-list">
                  {sectionBlocks.map((b, idx) => (
                    <div key={`${b.sectionId}-${idx}`} className="planning-inspector__block-card">
                      <div className="planning-inspector__block-time">
                        <strong>
                          {dayNamesFull[b.day]} {formatAcademicMinute(b.startMinute)}–{formatAcademicMinute(b.endMinute)}
                        </strong>
                        <span>{formatAcademicDuration(b.durationMinutes)}</span>
                      </div>
                      <div className="planning-inspector__block-resource">
                        <span>Docente: <strong>{b.teacherName}</strong></span>
                        <span>Ambiente: <strong>{b.roomNames.join(', ')}</strong></span>
                      </div>
                      <div className="planning-inspector__block-components">
                        {b.componentDetails.map((c, cIdx) => (
                          <span key={cIdx} className="planning-inspector__component-tag">
                            {c.type} · {formatAcademicDuration(c.durationMinutes)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingComponents.length > 0 && (
              <div className="planning-inspector__section planning-inspector__section--pending">
                <h5 className="planning-inspector__section-title">
                  {pendingComponents.length} {pendingComponents.length === 1 ? 'componente pendiente' : 'componentes pendientes'}
                </h5>
                <p className="planning-inspector__explanation">
                  {proposal.status === 'search-limit'
                    ? 'La búsqueda alcanzó su límite. No prueba que no exista solución.'
                    : 'Sin solución completa en el dominio configurado.'}
                </p>
                <ul className="planning-inspector__pending-list">
                  {pendingComponents.map((p) => (
                    <li key={p.sessionId}>
                      Componente {p.sessionId} · {formatAcademicDuration(p.durationMinutes)}
                    </li>
                  ))}
                </ul>

                <h5 className="planning-inspector__section-title">Restricciones de planificación</h5>
                <ul className="planning-inspector__constraints-list">
                  <li>Capacidad mínima {section.capacity}</li>
                  {requiresLab && <li>Laboratorio requerido</li>}
                  {eligibleTeachers.length > 0 ? (
                    <li>Docente habilitado {eligibleTeachers.map((t: AcademicPlanningResources['teachers'][number]) => t.name).join(', ')}</li>
                  ) : (
                    <li>Sin docentes habilitados registrados</li>
                  )}
                </ul>

                {eligibleTeachers.length > 0 && (
                  <div className="planning-inspector__availability">
                    <h6 className="planning-inspector__avail-title">
                      Disponibilidad ({eligibleTeachers[0].name})
                    </h6>
                    <p className="planning-inspector__avail-summary">
                      Lun–Vie 08:00–18:00 · Disponible
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
      </SheetContent>
    </Sheet>
  )
}

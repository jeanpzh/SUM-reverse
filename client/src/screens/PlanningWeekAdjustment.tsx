import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, CircleAlert, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Sheet, SheetContent, SheetTitle } from '../components/ui/Sheet'
import type { PlanningInspectorProps } from './PlanningInspector'
import {
  academicSectionLabel,
  aggregateAcademicBlocks,
  formatAcademicDuration,
  formatAcademicMinute,
} from '../data/academicScheduling'
import './PlanningWeekAdjustment.css'

type Props = Pick<
  PlanningInspectorProps,
  | 'proposal'
  | 'proposalResources'
  | 'catalog'
  | 'editingBlock'
  | 'adjusting'
  | 'adjustmentError'
  | 'docked'
  | 'onCancelEdit'
  | 'onSubmitEdit'
  | 'onChangeEditingBlock'
  | 'onStartEdit'
> & {
  activeBlock: ReturnType<typeof aggregateAcademicBlocks>[number]
}
export function PlanningWeekAdjustment({
  proposal,
  proposalResources,
  catalog,
  editingBlock,
  activeBlock,
  adjusting,
  adjustmentError,
  docked,
  onCancelEdit,
  onSubmitEdit,
  onChangeEditingBlock,
  onStartEdit,
}: Props) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true })
      })
    }
  }, [])
  useEffect(() => {
    const target = document.getElementById('planning-week-adjustment-slot')
    const pane = target?.closest('.planning-view-pane')
    const media = matchMedia('(min-width: 1024px)')
    const update = () =>
      setSlot(
        target && pane && getComputedStyle(pane).display !== 'none' && media.matches
          ? target
          : null,
      )
    const observer = new MutationObserver(update)
    if (pane) observer.observe(pane, { attributes: true, attributeFilter: ['style'] })
    media.addEventListener('change', update)
    update()
    return () => {
      observer.disconnect()
      media.removeEventListener('change', update)
    }
  }, [])
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('select')?.focus({ preventScroll: true })
  }, [activeBlock.sectionId, slot])
  if (!editingBlock) return null
  const dayNames = ['—', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const assignments = proposal.assignments
    .filter((a) => activeBlock.sessionIds.includes(a.sessionId))
    .sort((a, b) => a.startMinute - b.startMinute || a.sessionId.localeCompare(b.sessionId))
  const section = proposal.sections.find((s) => s.sectionId === activeBlock.sectionId)!
  const sectionBlocks = aggregateAcademicBlocks(proposal).filter(
    (b) => b.sectionId === section.sectionId,
  )
  const end = editingBlock.startMinute + activeBlock.durationMinutes
  const heading = 'Ajustar bloque'
  const content = (
    <div
      className="planning-week-adjustment planning-inspector academic-scheduling__manual-review"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !adjusting) onCancelEdit()
      }}
    >
      <header>
        <div>
          <p className="planning-week-adjustment__eyebrow">
            {activeBlock.courseId} · Sección {academicSectionLabel(proposal, section.sectionId)} ·{' '}
            {activeBlock.componentDetails.map((c) => c.type).join(' + ')}
          </p>
          {docked || slot ? (
            <h2 id="academic-scheduling-manual-review">{heading}</h2>
          ) : (
            <SheetTitle>
              <span id="academic-scheduling-manual-review">{heading}</span>
            </SheetTitle>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Descartar ajuste"
          disabled={adjusting}
          onClick={onCancelEdit}
        >
          <X size={14} />
        </Button>
      </header>
      <div
        className="planning-week-adjustment__comparison"
        aria-label="Comparación de ubicación del bloque"
      >
        <div>
          <span>Actual</span>
          <p>
            {dayNames[activeBlock.day].slice(0, 3)} {formatAcademicMinute(activeBlock.startMinute)}–
            {formatAcademicMinute(activeBlock.endMinute)}
          </p>
          <small>{activeBlock.roomNames.join(', ')}</small>
        </div>
        <ArrowRight size={16} aria-hidden="true" />
        <div>
          <span>Propuesto</span>
          <p>
            {dayNames[editingBlock.day].slice(0, 3)}{' '}
            {formatAcademicMinute(editingBlock.startMinute)}–
            {end <= 1440 ? formatAcademicMinute(end) : 'fuera del día'}
          </p>
          <small>
            {editingBlock.roomIds
              .map((id) => proposalResources?.rooms.find((r) => r.id === id)?.name ?? id)
              .join(', ')}
          </small>
        </div>
      </div>
      <form
        ref={formRef}
        id="academic-scheduling-manual-editor"
        aria-labelledby="academic-scheduling-manual-review"
        onSubmit={(e) => {
          e.preventDefault()
          if (!adjusting) void onSubmitEdit()
        }}
      >
        {sectionBlocks.length > 1 && (
          <label>
            Bloque horario
            <NativeSelect
              aria-label={`Bloque horario ${section.sectionId}`}
              disabled={adjusting}
              value={activeBlock.sessionIds.join('|')}
              onChange={(e) => {
                const next = sectionBlocks.find((b) => b.sessionIds.join('|') === e.target.value)
                if (next) onStartEdit(next)
              }}
            >
              {sectionBlocks.map((b) => (
                <option key={b.sessionIds.join('|')} value={b.sessionIds.join('|')}>
                  {dayNames[b.day]} {formatAcademicMinute(b.startMinute)}–
                  {formatAcademicMinute(b.endMinute)} ·{' '}
                  {b.componentDetails.map((c) => c.type).join(' + ')}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        <label>
          Docente
          <NativeSelect
            aria-label={`Docente revisión ${section.sectionId}`}
            value={editingBlock.teacherId}
            disabled={adjusting}
            onChange={(e) => onChangeEditingBlock({ ...editingBlock, teacherId: e.target.value })}
          >
            {(proposalResources?.teachers ?? [])
              .filter((t) => t.courseIds.includes(activeBlock.courseId))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </NativeSelect>
        </label>
        {assignments.map((assignment, index) => {
          const originalRoom = proposalResources?.rooms.find((r) => r.id === assignment.roomId)
          const rooms = (proposalResources?.rooms ?? []).filter(
            (r) =>
              r.capacity >= section.capacity &&
              (!originalRoom?.kind || r.kind === originalRoom.kind),
          )
          return (
            <label key={assignment.sessionId}>
              Ambiente{assignments.length > 1 ? ` · ${assignment.sessionType ?? index + 1}` : ''}
              <NativeSelect
                aria-label={`Ambiente ${assignment.sessionType ?? index + 1} revisión ${section.sectionId}`}
                value={editingBlock.roomIds[index] ?? ''}
                disabled={adjusting}
                onChange={(e) =>
                  onChangeEditingBlock({
                    ...editingBlock,
                    roomIds: editingBlock.roomIds.map((id, i) =>
                      i === index ? e.target.value : id,
                    ),
                  })
                }
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · capacidad {r.capacity}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )
        })}
        <div className="planning-week-adjustment__time-fields">
          <label>
            Día
            <NativeSelect
              aria-label={`Día revisión ${section.sectionId}`}
              value={editingBlock.day}
              disabled={adjusting}
              onChange={(e) =>
                onChangeEditingBlock({ ...editingBlock, day: Number(e.target.value) })
              }
            >
              {dayNames.slice(1).map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label>
            Inicio
            <NativeSelect
              aria-label={`Inicio revisión ${section.sectionId}`}
              value={editingBlock.startMinute}
              disabled={adjusting}
              onChange={(e) =>
                onChangeEditingBlock({ ...editingBlock, startMinute: Number(e.target.value) })
              }
            >
              {[
                ...new Set([
                  editingBlock.startMinute,
                  ...Array.from(
                    { length: Math.ceil(1440 / (catalog?.startStepMinutes || 30)) },
                    (_, index) => index * (catalog?.startStepMinutes || 30),
                  ),
                ]),
              ]
                .sort((a, b) => a - b)
                .map((minute) => (
                  <option key={minute} value={minute}>
                    {formatAcademicMinute(minute)}
                  </option>
                ))}
            </NativeSelect>
          </label>
        </div>
        <div className="planning-week-adjustment__duration">
          <span>Duración</span>
          <output aria-label={`Duración ${section.sectionId}`}>
            {formatAcademicDuration(activeBlock.durationMinutes).split(' (')[0]} · no editable
          </output>
        </div>
        <p className="planning-week-adjustment__notice">
          Vista previa local. El servidor valida docente, ambiente y cruces al aplicar; si lo
          rechaza, el horario guardado no cambia.
          {section.deliveryMode === 'split'
            ? ' Cambiar docente modifica la responsabilidad de toda la sección; los demás bloques mantienen sus horarios.'
            : ''}
        </p>
        <div className="planning-week-adjustment__actions">
          <Button
            type="submit"
            disabled={
              adjusting ||
              !(proposalResources?.teachers ?? []).some((t) =>
                t.courseIds.includes(activeBlock.courseId),
              )
            }
          >
            {adjusting ? 'Aplicando…' : 'Aplicar ajuste'}
          </Button>
          <Button type="button" variant="outline" disabled={adjusting} onClick={onCancelEdit}>
            Descartar
          </Button>
        </div>
      </form>
      {adjustmentError && (
        <div
          className="planning-week-adjustment__error academic-scheduling__manual-error academic-scheduling__inline-error"
          role="alert"
        >
          <CircleAlert size={16} aria-hidden="true" />
          <div>
            <strong>El servidor rechazó el ajuste</strong>
            <p>{adjustmentError}</p>
            <p>Se conserva el horario guardado.</p>
          </div>
        </div>
      )}
    </div>
  )
  if (slot)
    return createPortal(
      <aside aria-labelledby="academic-scheduling-manual-review">{content}</aside>,
      slot,
    )
  if (docked) return content
  return (
    <Sheet
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open && !adjusting) onCancelEdit()
      }}
    >
      <SheetContent
        side="bottom"
        className="planning-week-adjustment-sheet"
        showCloseButton={false}
        aria-describedby={undefined}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {content}
      </SheetContent>
    </Sheet>
  )
}

import { Button } from '../components/ui/Button'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Label } from '../components/ui/Label'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AcademicAdjustment, AcademicPlanningResources } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicCatalog, AcademicProposal } from '../data/academicScheduling'
import {
  academicSectionLabel,
  aggregateAcademicBlocks,
  formatAcademicDuration,
  formatAcademicMinute,
  normalizeAcademicSearch,
} from '../data/academicScheduling'
import { computeWeekDayLayout } from '../data/planningWeekLayout'
import './PlanningWeekView.css'

export interface PlanningWeekViewProps {
  proposal: AcademicProposal
  catalog: AcademicCatalog | null
  proposalResources: AcademicPlanningResources | null
  selectedSectionId: string | null
  editingBlock: AcademicAdjustment | null
  searchQuery: string
  onSearchChange: (query: string) => void
  viewMode: 'tabla' | 'semana'
  onToggleView: (mode: 'tabla' | 'semana') => void
  onSelectSection: (sectionId: string) => void
  onStartEditBlock: (block: ReturnType<typeof aggregateAcademicBlocks>[number]) => void
  onChangeEditingBlock?: (adjustment: AcademicAdjustment) => void
  isLocked?: boolean
}

const dayNamesFull = ['—', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const dayNamesShort = ['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const hourHeight = 60

export function PlanningWeekView({
  proposal,
  catalog,
  proposalResources,
  selectedSectionId,
  editingBlock,
  searchQuery,
  onSearchChange,
  viewMode,
  onToggleView,
  onSelectSection,
  onStartEditBlock,
  onChangeEditingBlock,
  isLocked = false,
}: PlanningWeekViewProps) {
  const [selectedAgendaDay, setSelectedAgendaDay] = useState<'all' | number>('all')

  const gridWrapperRef = useRef<HTMLDivElement>(null)
  const agendaRef = useRef<HTMLDivElement>(null)
  const prevSelectedId = useRef<string | null>(selectedSectionId)

  const blocks = useMemo(() => aggregateAcademicBlocks(proposal), [proposal])

  const normalizedQuery = normalizeAcademicSearch(searchQuery)

  // Align section membership: match sections across all their blocks (WV-4)
  const matchedSectionIds = useMemo(() => {
    if (!normalizedQuery) {
      return new Set(proposal.sections.map((s) => s.sectionId))
    }
    const matched = new Set<string>()
    for (const section of proposal.sections) {
      const sLabel = academicSectionLabel(proposal, section.sectionId)
      const sBlocks = blocks.filter((b) => b.sectionId === section.sectionId)
      const teachers = sBlocks.map((b) => b.teacherName).join(' ')
      const rooms = sBlocks.flatMap((b) => b.roomNames).join(' ')
      const hay = normalizeAcademicSearch(
        `${section.courseId} ${section.courseName} ${section.sectionId} ${sLabel} Sección ${sLabel} ${teachers} ${rooms}`
      )
      if (hay.includes(normalizedQuery)) {
        matched.add(section.sectionId)
      }
    }
    return matched
  }, [proposal, blocks, normalizedQuery])

  // Include all blocks of matching sections consistently
  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => matchedSectionIds.has(b.sectionId))
  }, [blocks, matchedSectionIds])

  // Pending sections that match search but have no calendar blocks
  const pendingSectionsMatchingCount = useMemo(() => {
    const assignedSectionIds = new Set(blocks.map((b) => b.sectionId))
    let count = 0
    for (const section of proposal.sections) {
      if (matchedSectionIds.has(section.sectionId) && !assignedSectionIds.has(section.sectionId)) {
        count += 1
      }
    }
    return count
  }, [proposal, blocks, matchedSectionIds])

  // Identify active block being edited
  const activeBlock = useMemo(() => {
    if (!editingBlock) return null
    return (
      blocks.find(
        (b) =>
          b.sectionId === editingBlock.sectionId &&
          b.sessionIds.length === editingBlock.sessionIds.length &&
          b.sessionIds.every((id, idx) => id === editingBlock.sessionIds[idx])
      ) ??
      blocks.find((b) => b.sectionId === editingBlock.sectionId) ??
      null
    )
  }, [blocks, editingBlock])

  // Teacher name and rooms for proposed placement
  const proposedTeacherName = useMemo(() => {
    if (!editingBlock) return ''
    const teacher = proposalResources?.teachers.find((t) => t.id === editingBlock.teacherId)
    return teacher ? teacher.name : editingBlock.teacherId
  }, [editingBlock, proposalResources])

  const proposedRoomNames = useMemo(() => {
    if (!editingBlock) return []
    return editingBlock.roomIds.map((id) => {
      const room = proposalResources?.rooms.find((r) => r.id === id)
      return room ? room.name : id
    })
  }, [editingBlock, proposalResources])

  // Days with configured availability or events (including weekends if configured)
  const configuredDays = useMemo(() => {
    const daysSet = new Set<number>([1, 2, 3, 4, 5])
    for (const b of blocks) {
      if (b.day >= 1 && b.day <= 7) daysSet.add(b.day)
    }
    if (editingBlock?.day && editingBlock.day >= 1 && editingBlock.day <= 7) {
      daysSet.add(editingBlock.day)
    }
    for (const t of proposalResources?.teachers ?? []) {
      for (const av of t.availability ?? []) {
        if (av.day >= 1 && av.day <= 7) daysSet.add(av.day)
      }
    }
    for (const r of proposalResources?.rooms ?? []) {
      for (const av of r.availability ?? []) {
        if (av.day >= 1 && av.day <= 7) daysSet.add(av.day)
      }
    }
    for (const w of catalog?.windows ?? []) {
      if (w.day >= 1 && w.day <= 7) daysSet.add(w.day)
    }
    return [1, 2, 3, 4, 5, 6, 7].filter((d) => daysSet.has(d))
  }, [blocks, editingBlock, proposalResources, catalog])

  // Compute time bounds for grid
  const { minMinute, maxMinute, hours } = useMemo(() => {
    let min = 8 * 60 // 08:00 default min
    let max = 22 * 60 // 22:00 default max

    for (const b of blocks) {
      if (b.startMinute < min) min = Math.floor(b.startMinute / 60) * 60
      if (b.endMinute > max) max = Math.ceil(b.endMinute / 60) * 60
    }

    if (editingBlock && activeBlock) {
      const propStart = editingBlock.startMinute
      const propEnd = propStart + activeBlock.durationMinutes
      if (propStart < min) min = Math.floor(propStart / 60) * 60
      if (propEnd > max) max = Math.ceil(propEnd / 60) * 60
    }

    const hourList: number[] = []
    for (let m = min; m <= max; m += 60) {
      hourList.push(m)
    }

    return { minMinute: min, maxMinute: max, hours: hourList }
  }, [blocks, editingBlock, activeBlock])

  const totalGridHeight = ((maxMinute - minMinute) / 60) * hourHeight

  // Scope scroll into view to the visible content container on user selection change only (WV-2)
  useEffect(() => {
    if (
      selectedSectionId &&
      selectedSectionId !== prevSelectedId.current &&
      typeof CSS !== 'undefined' &&
      CSS.escape
    ) {
      const isAgendaVisible = agendaRef.current
        ? window.getComputedStyle(agendaRef.current).display !== 'none'
        : false
      let el: Element | null = null
      if (isAgendaVisible && agendaRef.current) {
        el = agendaRef.current.querySelector(
          `[data-week-agenda-section-id="${CSS.escape(selectedSectionId)}"]`
        )
      } else if (gridWrapperRef.current) {
        el = gridWrapperRef.current.querySelector(
          `[data-week-grid-section-id="${CSS.escape(selectedSectionId)}"]`
        )
      }
      el?.scrollIntoView({ block: 'nearest' })
    }
    prevSelectedId.current = selectedSectionId
  }, [selectedSectionId])

  const handleSelectBlock = (block: ReturnType<typeof aggregateAcademicBlocks>[number]) => {
    onSelectSection(block.sectionId)
    if (!isLocked) {
      onStartEditBlock(block)
    }
  }

  const handleSlotClick = (day: number, startMinute: number) => {
    if (!editingBlock || !onChangeEditingBlock || isLocked) return
    onChangeEditingBlock({
      ...editingBlock,
      day,
      startMinute,
    })
  }

  return (
    <div className="planning-sections planning-week">
      {/* Shared Toolbar */}
      <div className="planning-sections__toolbar">
        <div className="planning-sections__toolbar-left">
          <h3 className="planning-sections__title">Semana</h3>
          <span className="planning-sections__count">
            Mostrando {filteredBlocks.length} de {blocks.length} {blocks.length === 1 ? 'bloque' : 'bloques'}
            {pendingSectionsMatchingCount > 0 && (
              <> · {pendingSectionsMatchingCount} {pendingSectionsMatchingCount === 1 ? 'sección pendiente permanece en Tabla' : 'secciones pendientes permanecen en Tabla'}</>
            )}
          </span>
        </div>

        <div className="planning-sections__toolbar-right">
          <Input
            type="search"
            className="planning-sections__search"
            placeholder="Buscar por curso, sección o recurso…"
            aria-label="Buscar secciones"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />

          <div className="planning-sections__view-toggle" role="group" aria-label="Vista">
            <Button variant={viewMode === 'tabla' ? 'secondary' : 'ghost'}
              type="button"
              size="sm"
              aria-pressed={viewMode === 'tabla'}
              onClick={() => onToggleView('tabla')}
            >
              Tabla
            </Button>
            <Button variant={viewMode === 'semana' ? 'secondary' : 'ghost'}
              type="button"
              size="sm"
              aria-pressed={viewMode === 'semana'}
              onClick={() => onToggleView('semana')}
            >
              Semana
            </Button>
          </div>
        </div>
      </div>

      {/* Editing active banner */}
      {editingBlock && activeBlock && (
        <div className="planning-week__editing-banner" role="status">
          <div className="planning-week__editing-main">
            <Badge variant="warning">Ajustando bloque</Badge>
            <strong>
              {activeBlock.courseName} · Sección {academicSectionLabel(proposal, editingBlock.sectionId)}
            </strong>
            <span className="planning-week__editing-time">
              Propuesto: {dayNamesFull[editingBlock.day]} {formatAcademicMinute(editingBlock.startMinute)}–
              {formatAcademicMinute(editingBlock.startMinute + activeBlock.durationMinutes)} (
              {formatAcademicDuration(activeBlock.durationMinutes)})
            </span>
          </div>
          <p className="planning-week__editing-hint">
            Usa el formulario del inspector o selecciona una franja horaria en el calendario para cambiar día e inicio.
          </p>
        </div>
      )}

      {/* Desktop Calendar Grid (> 720px) */}
      <div
        className="planning-week__grid-wrapper"
        ref={gridWrapperRef}
        role="region"
        aria-label="Calendario semanal interactivo de programación"
        tabIndex={0}
      >
        <div className="planning-week__grid" style={{ minWidth: `${configuredDays.length * 140 + 70}px` }}>
          {/* Day Headers */}
          <div className="planning-week__header-row">
            <div className="planning-week__time-col-header">Hora</div>
            {configuredDays.map((day) => (
              <div key={day} className="planning-week__day-col-header">
                <span className="planning-week__day-name">{dayNamesFull[day]}</span>
              </div>
            ))}
          </div>

          {/* Time Body */}
          <div className="planning-week__body" style={{ height: `${totalGridHeight}px` }}>
            {/* Hour labels */}
            <div className="planning-week__time-axis" aria-label="Escala de horas">
              {hours.map((minute) => (
                <div
                  key={minute}
                  className="planning-week__time-label"
                  style={{ top: `${((minute - minMinute) / 60) * hourHeight}px` }}
                >
                  {formatAcademicMinute(minute)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {configuredDays.map((day) => {
              const dayBlocks = filteredBlocks.filter((b) => b.day === day)
              const isProposedDay = editingBlock && activeBlock && editingBlock.day === day

              // Compute deterministic overlap lanes for all day items including proposed preview (WV-1)
              const layoutItems = dayBlocks.map((b) => ({
                id: `${b.sectionId}-${b.day}-${b.startMinute}`,
                startMinute: b.startMinute,
                endMinute: b.endMinute,
              }))

              if (isProposedDay && activeBlock) {
                layoutItems.push({
                  id: '__proposed_preview__',
                  startMinute: editingBlock.startMinute,
                  endMinute: editingBlock.startMinute + activeBlock.durationMinutes,
                })
              }

              const dayLayout = computeWeekDayLayout(layoutItems)

              return (
                <div
                  key={day}
                  className="planning-week__day-col"
                  aria-label={`Horarios del ${dayNamesFull[day]}`}
                  style={{ backgroundSize: `100% ${hourHeight}px` }}
                >
                  {/* Clickable slot lines for editing */}
                  {editingBlock && !isLocked && (
                    <div className="planning-week__slots-overlay">
                      {hours.slice(0, -1).map((minute) => (
                        <Button variant="ghost"
                          key={minute}
                          type="button"
                          className="planning-week__slot-target"
                          style={{
                            top: `${((minute - minMinute) / 60) * hourHeight}px`,
                            height: `${hourHeight}px`,
                          }}
                          aria-label={`Mover a ${dayNamesFull[day]} ${formatAcademicMinute(minute)}`}
                          onClick={() => handleSlotClick(day, minute)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Assigned blocks with deterministic non-overlapping lanes */}
                  {dayBlocks.map((block) => {
                    const blockKey = `${block.sectionId}-${block.day}-${block.startMinute}`
                    const isSelected = selectedSectionId === block.sectionId
                    const isBeingEdited =
                      editingBlock &&
                      activeBlock &&
                      block.sectionId === activeBlock.sectionId &&
                      block.day === activeBlock.day &&
                      block.startMinute === activeBlock.startMinute
                    const sLabel = academicSectionLabel(proposal, block.sectionId)
                    const topPx = ((block.startMinute - minMinute) / 60) * hourHeight
                    const heightPx = Math.max((block.durationMinutes / 60) * hourHeight, 36)

                    const blockLayout = dayLayout.get(blockKey)
                    const leftStyle = blockLayout ? `calc(${blockLayout.leftPercent}% + 2px)` : '4px'
                    const widthStyle = blockLayout ? `calc(${blockLayout.widthPercent}% - 4px)` : 'calc(100% - 8px)'

                    const actionLabel = isLocked
                      ? 'Seleccionar para inspeccionar sección.'
                      : 'Seleccionar para editar horario.'

                    return (
                      <article
                        key={blockKey}
                        data-week-grid-section-id={block.sectionId}
                        data-week-section-id={block.sectionId}
                        className={`planning-week__block ${isSelected ? 'planning-week__block--selected' : ''} ${
                          isBeingEdited ? 'planning-week__block--current-placement' : ''
                        }`}
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                          left: leftStyle,
                          width: widthStyle,
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Bloque ${block.courseName}, Sección ${sLabel}, ${dayNamesShort[block.day]} ${formatAcademicMinute(
                          block.startMinute
                        )} a ${formatAcademicMinute(block.endMinute)}, docente ${block.teacherName}, ambiente ${block.roomNames.join(
                          ', '
                        )}.${isBeingEdited ? ' Ubicación actual del bloque en edición.' : ''} ${actionLabel}`}
                        onClick={() => handleSelectBlock(block)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleSelectBlock(block)
                          }
                        }}
                      >
                        <div className="planning-week__block-header">
                          <strong className="planning-week__block-course">{block.courseName}</strong>
                          <span className="planning-week__block-section">Sec. {sLabel}</span>
                        </div>
                        <div className="planning-week__block-time">
                          {formatAcademicMinute(block.startMinute)}–{formatAcademicMinute(block.endMinute)}
                        </div>
                        <div className="planning-week__block-details">
                          <span className="planning-week__block-teacher" title={block.teacherName}>
                            {block.teacherName}
                          </span>
                          <span className="planning-week__block-room" title={block.roomNames.join(', ')}>
                            {block.roomNames.join(', ')}
                          </span>
                        </div>
                        {isBeingEdited && (
                          <Badge variant="outline" className="planning-week__placement-tag planning-week__placement-tag--current">
                            Ubicación actual
                          </Badge>
                        )}
                      </article>
                    )
                  })}

                  {/* Proposed Placement Preview with deterministic lane */}
                  {isProposedDay && activeBlock && (() => {
                    const propLayout = dayLayout.get('__proposed_preview__')
                    const propLeft = propLayout ? `calc(${propLayout.leftPercent}% + 2px)` : '4px'
                    const propWidth = propLayout ? `calc(${propLayout.widthPercent}% - 4px)` : 'calc(100% - 8px)'

                    return (
                      <article
                        className="planning-week__block planning-week__block--proposed-preview"
                        style={{
                          top: `${((editingBlock.startMinute - minMinute) / 60) * hourHeight}px`,
                          height: `${Math.max((activeBlock.durationMinutes / 60) * hourHeight, 36)}px`,
                          left: propLeft,
                          width: propWidth,
                        }}
                        role="status"
                        aria-label={`Ubicación propuesta en vista previa: ${dayNamesFull[editingBlock.day]} ${formatAcademicMinute(
                          editingBlock.startMinute
                        )} a ${formatAcademicMinute(editingBlock.startMinute + activeBlock.durationMinutes)}, docente ${
                          proposedTeacherName
                        }, ambiente ${proposedRoomNames.join(', ')}.`}
                      >
                        <Badge variant="outline" className="planning-week__placement-tag planning-week__placement-tag--proposed">
                          Propuesta (vista previa)
                        </Badge>
                        <div className="planning-week__block-header">
                          <strong className="planning-week__block-course">{activeBlock.courseName}</strong>
                          <span className="planning-week__block-section">
                            Sec. {academicSectionLabel(proposal, editingBlock.sectionId)}
                          </span>
                        </div>
                        <div className="planning-week__block-time">
                          {formatAcademicMinute(editingBlock.startMinute)}–
                          {formatAcademicMinute(editingBlock.startMinute + activeBlock.durationMinutes)}
                        </div>
                        <div className="planning-week__block-details">
                          <span className="planning-week__block-teacher" title={proposedTeacherName}>
                            {proposedTeacherName}
                          </span>
                          <span className="planning-week__block-room" title={proposedRoomNames.join(', ')}>
                            {proposedRoomNames.join(', ')}
                          </span>
                        </div>
                      </article>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Narrow Screen Agenda / List (<= 720px) */}
      <div className="planning-week__agenda" ref={agendaRef} aria-label="Agenda de horario por día">
        <div className="planning-week__agenda-nav">
          <Label htmlFor="planning-week-day-select" className="planning-week__agenda-nav-label">
            Día de la semana:
          </Label>
          <NativeSelect
            id="planning-week-day-select"
            className="planning-week__agenda-day-select"
            value={selectedAgendaDay}
            onChange={(e) => setSelectedAgendaDay(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            aria-label="Filtrar agenda por día"
          >
            <option value="all">Todos los días</option>
            {configuredDays.map((day) => (
              <option key={day} value={day}>
                {dayNamesFull[day]} ({filteredBlocks.filter((b) => b.day === day).length})
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="planning-week__agenda-content">
          {configuredDays
            .filter((day) => selectedAgendaDay === 'all' || selectedAgendaDay === day)
            .map((day) => {
              const dayBlocks = filteredBlocks.filter((b) => b.day === day)
              const hasProposedHere = editingBlock && activeBlock && editingBlock.day === day

              return (
                <section key={day} className="planning-week__agenda-day-group" aria-label={dayNamesFull[day]}>
                  <header className="planning-week__agenda-day-header">
                    <h4 className="planning-week__agenda-day-title">{dayNamesFull[day]}</h4>
                    <Badge variant="outline" className="planning-week__agenda-day-count">
                      {dayBlocks.length} {dayBlocks.length === 1 ? 'bloque' : 'bloques'}
                    </Badge>
                  </header>

                  {dayBlocks.length === 0 && !hasProposedHere ? (
                    <p className="planning-week__agenda-empty">Sin clases programadas este día.</p>
                  ) : (
                    <div className="planning-week__agenda-list">
                      {/* Proposed placement preview card on this day */}
                      {hasProposedHere && activeBlock && (
                        <div
                          className="planning-week__agenda-card planning-week__agenda-card--proposed"
                          role="status"
                          aria-label={`Ubicación propuesta en vista previa: ${dayNamesFull[day]} ${formatAcademicMinute(
                            editingBlock.startMinute
                          )} a ${formatAcademicMinute(editingBlock.startMinute + activeBlock.durationMinutes)}, docente ${
                            proposedTeacherName
                          }.`}
                        >
                          <Badge variant="outline" className="planning-week__placement-tag planning-week__placement-tag--proposed">
                            Ubicación propuesta (vista previa)
                          </Badge>
                          <div className="planning-week__agenda-card-title">
                            <strong>{activeBlock.courseName}</strong>
                            <span>Sec. {academicSectionLabel(proposal, editingBlock.sectionId)}</span>
                          </div>
                          <div className="planning-week__agenda-card-meta">
                            <span>
                              Hora: {formatAcademicMinute(editingBlock.startMinute)}–
                              {formatAcademicMinute(editingBlock.startMinute + activeBlock.durationMinutes)} (
                              {formatAcademicDuration(activeBlock.durationMinutes)})
                            </span>
                            <span>Docente: {proposedTeacherName}</span>
                            <span>Ambiente: {proposedRoomNames.join(', ')}</span>
                          </div>
                        </div>
                      )}

                      {/* Scheduled blocks on this day: clean article container with no nested interactive role */}
                      {dayBlocks.map((block) => {
                        const isSelected = selectedSectionId === block.sectionId
                        const isBeingEdited =
                          editingBlock &&
                          activeBlock &&
                          block.sectionId === activeBlock.sectionId &&
                          block.day === activeBlock.day &&
                          block.startMinute === activeBlock.startMinute
                        const sLabel = academicSectionLabel(proposal, block.sectionId)

                        return (
                          <article
                            key={`${block.sectionId}-${block.startMinute}`}
                            data-week-agenda-section-id={block.sectionId}
                            data-week-section-id={block.sectionId}
                            className={`planning-week__agenda-card ${
                              isSelected ? 'planning-week__agenda-card--selected' : ''
                            } ${isBeingEdited ? 'planning-week__agenda-card--current' : ''}`}
                            onClick={() => onSelectSection(block.sectionId)}
                          >
                            {isBeingEdited && (
                              <Badge variant="outline" className="planning-week__placement-tag planning-week__placement-tag--current">
                                Ubicación actual
                              </Badge>
                            )}
                            <div className="planning-week__agenda-card-title">
                              <strong>{block.courseName}</strong>
                              <span>Sección {sLabel}</span>
                            </div>
                            <div className="planning-week__agenda-card-meta">
                              <span>
                                Hora: {formatAcademicMinute(block.startMinute)}–{formatAcademicMinute(block.endMinute)} (
                                {formatAcademicDuration(block.durationMinutes)})
                              </span>
                              <span>Docente: {block.teacherName}</span>
                              <span>Ambiente: {block.roomNames.join(', ')}</span>
                              <span>Componentes: {block.componentDetails.map((c) => c.type).join(' + ')}</span>
                            </div>
                            <div className="planning-week__agenda-card-actions">
                              <Button variant="outline"
                                type="button"
                                className="planning-sections__action-button"
                                disabled={isLocked}
                                aria-label={`Editar horario ${block.courseName} sección ${sLabel}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSelectBlock(block)
                                }}
                              >
                                Editar horario
                              </Button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
        </div>
      </div>
    </div>
  )
}

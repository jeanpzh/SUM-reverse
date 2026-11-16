import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  AcademicAdjustment,
  AcademicPlanningResources,
} from '../../../shared/programacion-academica-api.mjs'
import type { AcademicCatalog, AcademicProposal } from '../data/academicScheduling'
import {
  academicSectionLabel,
  aggregateAcademicBlocks,
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
  teacherFilter?: string
  onSelectSection: (sectionId: string) => void
  onStartEditBlock: (block: ReturnType<typeof aggregateAcademicBlocks>[number]) => void
  onChangeEditingBlock?: (adjustment: AcademicAdjustment) => void
  isLocked?: boolean
}
const names = ['—', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const short = ['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const blockKey = (b: ReturnType<typeof aggregateAcademicBlocks>[number]) => b.sessionIds.join('|')
function typeLabel(type: string) {
  const value = normalizeAcademicSearch(type)
  return value === 't' || value.includes('teor')
    ? 'Teoría'
    : value === 'l' || value.includes('lab')
      ? 'Lab.'
      : value === 'p' || value.includes('pract')
        ? 'Práctica'
        : type
}

export function PlanningWeekView({
  proposal,
  catalog,
  proposalResources,
  selectedSectionId,
  editingBlock,
  searchQuery,
  teacherFilter = 'all',
  onSelectSection,
  onStartEditBlock,
  isLocked = false,
}: PlanningWeekViewProps) {
  const blocks = useMemo(() => aggregateAcademicBlocks(proposal), [proposal])
  const active = blocks.find(
    (b) =>
      b.sectionId === editingBlock?.sectionId && blockKey(b) === editingBlock.sessionIds.join('|'),
  )
  const [agendaDay, setAgendaDay] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const revealedSelection = useRef<string | null>(null)
  const query = normalizeAcademicSearch(searchQuery)
  const matching = new Set(
    proposal.sections
      .filter((section) => {
        const items = blocks.filter((b) => b.sectionId === section.sectionId)
        if (
          teacherFilter === '__unassigned__'
            ? items.length
            : teacherFilter !== 'all' && !items.some((b) => b.teacherId === teacherFilter)
        )
          return false
        return normalizeAcademicSearch(
          `${section.courseId} ${section.courseName} ${section.sectionId} ${academicSectionLabel(proposal, section.sectionId)} Sección ${academicSectionLabel(proposal, section.sectionId)} ${items.map((b) => `${b.teacherName} ${b.roomNames.join(' ')}`).join(' ')}`,
        ).includes(query)
      })
      .map((s) => s.sectionId),
  )
  const filtered = blocks.filter(
    (b) =>
      matching.has(b.sectionId) &&
      (teacherFilter === 'all' ||
        teacherFilter === '__unassigned__' ||
        b.teacherId === teacherFilter),
  )
  const windows =
    teacherFilter !== 'all' && teacherFilter !== '__unassigned__'
      ? (proposalResources?.teachers.find((t) => t.id === teacherFilter)?.availability ?? [])
      : [
          ...(catalog?.windows ?? []),
          ...(proposalResources?.teachers.flatMap((t) => t.availability) ?? []),
          ...(proposalResources?.rooms.flatMap((r) => r.availability) ?? []),
        ]
  const days = [
    ...new Set([
      1,
      2,
      3,
      4,
      5,
      ...windows.map((w) => w.day),
      ...blocks.map((b) => b.day),
      ...(editingBlock ? [editingBlock.day] : []),
    ]),
  ].sort((a, b) => a - b)
  const min =
    Math.floor(
      Math.min(
        480,
        ...blocks.map((b) => b.startMinute),
        ...windows.map((w) => w.startMinute),
        editingBlock?.startMinute ?? 480,
      ) / 60,
    ) * 60
  const max = Math.min(
    1440,
    Math.ceil(
      Math.max(
        1200,
        ...blocks.map((b) => b.endMinute),
        ...windows.map((w) => w.endMinute),
        editingBlock && active ? editingBlock.startMinute + active.durationMinutes : 1200,
      ) / 60,
    ) * 60,
  )
  const hours = Array.from({ length: (max - min) / 60 }, (_, i) => min + i * 60)
  const selected = filtered.find((b) => b.sectionId === selectedSectionId)
  const visibleDay = agendaDay ?? selected?.day ?? days[0]

  // Both view panes remain mounted: observe the host's visibility change so a
  // selection made in Tabla is revealed even when its id has not changed.
  useEffect(() => {
    const pane = root.current?.closest('.planning-view-pane')
    const reveal = () => {
      if (
        !root.current ||
        !pane ||
        getComputedStyle(pane).display === 'none' ||
        !selectedSectionId ||
        revealedSelection.current === selectedSectionId
      )
        return
      setAgendaDay(null)
      const target = root.current.querySelector<HTMLElement>(
        `[data-week-grid-section-id="${CSS.escape(selectedSectionId)}"]`,
      )
      if (target && getComputedStyle(target).display !== 'none')
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      revealedSelection.current = selectedSectionId
    }
    const observer = new MutationObserver(reveal)
    if (pane) observer.observe(pane, { attributes: true, attributeFilter: ['style'] })
    reveal()
    return () => observer.disconnect()
  }, [selectedSectionId])

  const items = filtered.map((b) => ({
    block: b,
    proposed: false,
    day: b.day,
    startMinute: b.startMinute,
    endMinute: b.endMinute,
    id: blockKey(b),
  }))
  if (active && !filtered.some((b) => blockKey(b) === blockKey(active)))
    items.push({
      block: active,
      proposed: false,
      day: active.day,
      startMinute: active.startMinute,
      endMinute: active.endMinute,
      id: blockKey(active),
    })
  if (active && editingBlock)
    items.push({
      block: active,
      proposed: true,
      day: editingBlock.day,
      startMinute: editingBlock.startMinute,
      endMinute: editingBlock.startMinute + active.durationMinutes,
      id: '__proposed_preview__',
    })
  const renderBlock = (item: (typeof items)[number], style?: CSSProperties, agenda = false) => {
    const b = item.block
    const current = active && blockKey(b) === blockKey(active) && !item.proposed
    const label = `${item.proposed ? 'Propuesto · sin validar' : current ? 'Actual' : 'Bloque'}: ${b.courseName}, Sección ${academicSectionLabel(proposal, b.sectionId)}, ${names[item.day]} ${formatAcademicMinute(item.startMinute)}–${formatAcademicMinute(item.endMinute)}`
    const content = (
      <>
        <span
          className={`planning-week__type${item.proposed ? ' planning-week__placement-tag planning-week__placement-tag--proposed' : current ? ' planning-week__placement-tag planning-week__placement-tag--current' : ''}`}
        >
          {item.proposed
            ? 'Propuesto · sin validar'
            : `${current ? 'Actual · ' : ''}${b.componentDetails.map((c) => typeLabel(c.type)).join(' + ')}`}
        </span>
        <strong className="planning-week__block-course">{b.courseName}</strong>
        <span className="planning-week__meta planning-week__block-details">
          Secc. {academicSectionLabel(proposal, b.sectionId)} ·{' '}
          {item.proposed
            ? editingBlock?.roomIds
                .map((id) => proposalResources?.rooms.find((r) => r.id === id)?.name ?? id)
                .join(', ')
            : b.roomNames.join(', ')}
        </span>
      </>
    )
    const className = `${agenda ? 'planning-week__agenda-card' : 'planning-week__block'}${item.proposed ? ' planning-week__block--proposed-preview' : ''}${selectedSectionId === b.sectionId && !item.proposed ? ' planning-week__block--selected' : ''}`
    return item.proposed ? (
      <div key={item.id} role="note" aria-label={label} className={className} style={style}>
        {content}
      </div>
    ) : (
      <article
        key={item.id}
        role="button"
        tabIndex={0}
        data-kind={typeLabel(b.componentDetails[0]?.type ?? '')}
        data-week-section-id={b.sectionId}
        data-week-grid-section-id={agenda ? undefined : b.sectionId}
        data-week-agenda-section-id={agenda ? b.sectionId : undefined}
        aria-pressed={selectedSectionId === b.sectionId}
        aria-label={label}
        title={`${label} · ${b.teacherName}`}
        className={className}
        style={style}
        onClick={() => {
          onSelectSection(b.sectionId)
          if (!isLocked) onStartEditBlock(b)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelectSection(b.sectionId)
            if (!isLocked) onStartEditBlock(b)
          }
        }}
      >
        {content}
      </article>
    )
  }
  return (
    <div className="planning-week-workspace" ref={root}>
      <section className="planning-week" aria-label="Horario semanal">
        {!filtered.length && (
          <p role="status" className="planning-week__empty">
            {blocks.length
              ? 'No hay bloques que coincidan con los filtros.'
              : 'Aún no hay bloques asignados. Revisa las secciones pendientes en Tabla.'}
          </p>
        )}
        <div
          className="planning-week__grid-wrapper"
          tabIndex={0}
          role="region"
          aria-label="Calendario semanal con días configurados"
        >
          <div
            className="planning-week__grid"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(108px, 1fr))` }}
          >
            <div />
            {days.map((day) => (
              <div key={day} className="planning-week__day-heading">
                {short[day]}
              </div>
            ))}
            <div className="planning-week__time-axis" style={{ height: hours.length * 40 }}>
              {hours
                .filter((_, i) => i % 2 === 0)
                .map((minute) => (
                  <span key={minute} style={{ top: ((minute - min) / 60) * 40 }}>
                    {formatAcademicMinute(minute)}
                  </span>
                ))}
            </div>
            {days.map((day) => {
              const dayItems = items.filter((i) => i.day === day)
              const layout = computeWeekDayLayout(dayItems)
              return (
                <div
                  key={day}
                  className="planning-week__day-col"
                  aria-label={`Horarios del ${names[day]}`}
                  style={{ height: hours.length * 40 }}
                >
                  {hours.map(
                    (minute) =>
                      !windows.some(
                        (w) => w.day === day && w.startMinute < minute + 60 && w.endMinute > minute,
                      ) && (
                        <div
                          key={minute}
                          className="planning-week__unavailable"
                          title="Fuera de la disponibilidad configurada"
                          style={{ top: ((minute - min) / 60) * 40, height: 40 }}
                        />
                      ),
                  )}
                  {dayItems.map((item) => {
                    const lane = layout.get(item.id)
                    return renderBlock(item, {
                      top: ((item.startMinute - min) / 60) * 40 + 2,
                      height: Math.max(24, ((item.endMinute - item.startMinute) / 60) * 40 - 4),
                      left: `calc(${lane?.leftPercent ?? 0}% + 3px)`,
                      width: `calc(${lane?.widthPercent ?? 100}% - 6px)`,
                    })
                  })}
                </div>
              )
            })}
          </div>
        </div>
        <div className="planning-week__agenda">
          <div role="group" aria-label="Día" className="planning-week__day-tabs">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={visibleDay === day}
                onClick={() => setAgendaDay(day)}
              >
                {short[day]}
              </button>
            ))}
          </div>
          <ol>
            {items
              .filter(
                (i) =>
                  i.day === visibleDay ||
                  i.proposed ||
                  (active && blockKey(i.block) === blockKey(active)),
              )
              .sort((a, b) => a.startMinute - b.startMinute)
              .map((item) => (
                <li key={item.id}>
                  <span className="planning-week__agenda-time">
                    {short[item.day]}
                    <br />
                    {formatAcademicMinute(item.startMinute)}
                  </span>
                  {renderBlock(item, undefined, true)}
                </li>
              ))}
          </ol>
          {!items.some((i) => i.day === visibleDay) && (
            <p className="planning-week__empty">Sin clases programadas este día.</p>
          )}
        </div>
        <p className="planning-week__footnote">
          {isLocked
            ? 'Solo lectura · selecciona para consultar.'
            : 'Selecciona un bloque para ajustar con el formulario.'}{' '}
          Los días con disponibilidad configurada permanecen accesibles; la zona rayada queda fuera
          de ella.
        </p>
      </section>
      <div id="planning-week-adjustment-slot" />
    </div>
  )
}

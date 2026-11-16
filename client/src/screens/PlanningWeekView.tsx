import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  AcademicAdjustment,
  AcademicPlanningResources,
} from '../../../shared/programacion-academica-api.mjs'
import type { AcademicCatalog, AcademicProposal } from '../data/academicScheduling'
import {
  indexAcademicProposal,
  academicSectionLabel,
  aggregateAcademicBlocks,
  formatAcademicMinute,
  normalizeAcademicSearch,
} from '../data/academicScheduling'
import { Button } from '../components/ui/Button'
import { computeWeekDayLayout, computeWeekLoad } from '../data/planningWeekLayout'
import './PlanningWeekView.css'

export interface PlanningWeekViewProps {
  proposal: AcademicProposal
  catalog: AcademicCatalog | null
  proposalResources: AcademicPlanningResources | null
  selectedSectionId: string | null
  editingBlock: AcademicAdjustment | null
  searchQuery: string
  teacherFilter?: string
  roomFilter?: string
  onShowPending: () => void
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
  roomFilter = 'all',
  onShowPending,
  onSelectSection,
  onStartEditBlock,
  isLocked = false,
}: PlanningWeekViewProps) {
  const { blocks, blocksBySection } = useMemo(() => indexAcademicProposal(proposal), [proposal])
  const active = blocks.find(
    (b) =>
      b.sectionId === editingBlock?.sectionId && blockKey(b) === editingBlock.sessionIds.join('|'),
  )
  const [agendaDay, setAgendaDay] = useState<number | null>(null)
  const [loadSelection, setLoadSelection] = useState<{ sectionId: string | null; slot: { day: number; startMinute: number } | null }>({ sectionId: null, slot: null })
  const root = useRef<HTMLDivElement>(null)
  const revealedSelection = useRef<string | null>(null)
  const query = normalizeAcademicSearch(searchQuery)
  const filtered = useMemo(() => {
    const roomSessions = new Set(proposal.assignments.filter(item => item.roomId === roomFilter).map(item => item.sessionId))
    const matchesResource = (b: (typeof blocks)[number]) =>
      (teacherFilter === 'all' || b.teacherId === teacherFilter)
      && (roomFilter === 'all' || b.sessionIds.some(id => roomSessions.has(id)))
    const matching = new Set(
      proposal.sections
        .filter((section) => {
          const items = blocksBySection.get(section.sectionId) ?? []
          if (teacherFilter === '__unassigned__' ? items.length : !items.some(matchesResource)) return false
          return normalizeAcademicSearch(
            `${section.courseId} ${section.courseName} ${section.sectionId} ${academicSectionLabel(proposal, section.sectionId)} Sección ${academicSectionLabel(proposal, section.sectionId)} ${items.map((b) => `${b.teacherName} ${b.roomNames.join(' ')}`).join(' ')}`,
          ).includes(query)
        })
        .map((s) => s.sectionId),
    )
    return blocks.filter(
      (b) =>
        matching.has(b.sectionId) &&
        matchesResource(b),
    )
  }, [proposal, blocks, blocksBySection, teacherFilter, roomFilter, query])
  const configuredWindows = useMemo(() => [
    ...(catalog?.windows ?? []),
    ...(proposalResources?.teachers.flatMap((t) => t.availability) ?? []),
    ...(proposalResources?.rooms.flatMap((r) => r.availability) ?? []),
  ], [catalog, proposalResources])
  const windows =
    teacherFilter !== 'all' && teacherFilter !== '__unassigned__'
      ? (proposalResources?.teachers.find((t) => t.id === teacherFilter)?.availability ?? [])
      : roomFilter !== 'all'
        ? (proposalResources?.rooms.find(r => r.id === roomFilter)?.availability ?? [])
        : configuredWindows
  const proposedDay = editingBlock?.day
  const days = useMemo(() => [
    ...new Set([
      1,
      2,
      3,
      4,
      5,
      ...configuredWindows.map((w) => w.day),
      ...blocks.map((b) => b.day),
      ...(proposedDay === undefined ? [] : [proposedDay]),
    ]),
  ].sort((a, b) => a - b), [configuredWindows, blocks, proposedDay])
  const min =
    Math.floor(
      Math.min(
        480,
        ...blocks.map((b) => b.startMinute),
        ...configuredWindows.map((w) => w.startMinute),
        editingBlock?.startMinute ?? 480,
      ) / 60,
    ) * 60
  const max = Math.min(
    1440,
    Math.ceil(
      Math.max(
        1200,
        ...blocks.map((b) => b.endMinute),
        ...configuredWindows.map((w) => w.endMinute),
        editingBlock && active ? editingBlock.startMinute + active.durationMinutes : 1200,
      ) / 60,
    ) * 60,
  )
  const dayAvailability = (day: number) => {
    const merged: Array<{ startMinute: number; endMinute: number }> = []
    for (const window of windows
      .filter((w) => w.day === day)
      .sort((a, b) => a.startMinute - b.startMinute)) {
      const previous = merged[merged.length - 1]
      if (previous && window.startMinute <= previous.endMinute)
        previous.endMinute = Math.max(previous.endMinute, window.endMinute)
      else merged.push({ startMinute: window.startMinute, endMinute: window.endMinute })
    }
    return merged
  }
  const hours = Array.from({ length: (max - min) / 60 }, (_, i) => min + i * 60)
  const selected = filtered.find((b) => b.sectionId === selectedSectionId)
  const visibleDay = agendaDay ?? selected?.day ?? days[0]
  const overview = teacherFilter === 'all' && roomFilter === 'all' && !active
  const loadSlots = useMemo(() => computeWeekLoad(filtered.map(b => ({ ...b, id: blockKey(b) })), days, min, max), [filtered, days, min, max])
  const selectedSlot = loadSelection.sectionId === selectedSectionId ? loadSelection.slot
    : selected ? { day: selected.day, startMinute: min + Math.floor((selected.startMinute - min) / 120) * 120 } : null
  const slot = loadSlots.find(row => row.startMinute === selectedSlot?.startMinute)
  const slotBlocks = slot?.days.find(cell => cell.day === selectedSlot?.day)?.items ?? []
  const maxLoad = Math.max(1, ...loadSlots.flatMap(row => row.days.map(cell => cell.items.length)))
  const unassigned = proposal.sections.filter(section => !blocksBySection.has(section.sectionId)).length

  // Both view panes remain mounted: observe the host's visibility change so a
  // selection made in Tabla is revealed even when its id has not changed.
  useEffect(() => {
    const pane = root.current?.closest('.planning-view-pane')
    let frame = 0
    const reveal = () => {
      if (!pane || !selectedSectionId || revealedSelection.current === selectedSectionId) return
      if (getComputedStyle(pane).display !== 'none') setAgendaDay(null)
      cancelAnimationFrame(frame)
      // The host restores each view's saved scroll in its next animation frame.
      // Reveal a new selection after that restoration, without resetting later switches.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!root.current || getComputedStyle(pane).display === 'none') return
          const target = Array.from(
            root.current.querySelectorAll<HTMLElement>(
              `[data-week-section-id="${CSS.escape(selectedSectionId)}"]`,
            ),
          ).find((element) => element.getClientRects().length > 0)
          target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
          revealedSelection.current = selectedSectionId
        })
      })
    }
    const observer = new MutationObserver(reveal)
    if (pane) observer.observe(pane, { attributes: true, attributeFilter: ['style'] })
    reveal()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [selectedSectionId])

  const previousActive = useRef(false)
  useEffect(() => {
    const returning = previousActive.current && !active
    previousActive.current = Boolean(active)
    if (!returning) return
    const frame = requestAnimationFrame(() => {
      const visibleBlock = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-week-section-id]') ?? [])
        .find(element => element.dataset.weekSectionId === selectedSectionId && element.getClientRects().length > 0)
      const cell = selected && root.current?.querySelector<HTMLButtonElement>(`[data-load-day="${selected.day}"][data-load-start="${min + Math.floor((selected.startMinute - min) / 120) * 120}"]`)
      const target = visibleBlock ?? cell
      target?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [active, min, selected, selectedSectionId])

  const { items, dayLayouts } = useMemo(() => {
    const items = filtered.map((b) => ({
    block: b,
    proposed: false,
    day: b.day,
    startMinute: b.startMinute,
    endMinute: b.endMinute,
    id: blockKey(b),
  })).filter(item => !active || teacherFilter !== 'all' || roomFilter !== 'all' || item.block.sectionId === active.sectionId)
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
    const byDay = new Map<number, typeof items>()
    for (const item of items) {
      const dayItems = byDay.get(item.day) ?? []
      dayItems.push(item)
      byDay.set(item.day, dayItems)
    }
    const dayLayouts = new Map(Array.from(byDay, ([day, dayItems]) => [day, { items: dayItems, layout: computeWeekDayLayout(dayItems) }]))
    return { items, dayLayouts }
  }, [filtered, active, editingBlock, teacherFilter, roomFilter])
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
            : b.roomNames.join(', ')}{agenda && ` · ${b.durationMinutes / 60} h`}
        </span>
        {agenda && <span className="planning-week__meta">{b.teacherName} · {formatAcademicMinute(item.startMinute)}–{formatAcademicMinute(item.endMinute)}</span>}
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
      <section className="planning-week" aria-label="Horario semanal" data-week-mode={overview ? 'load' : 'detail'}>
        <div className="planning-week__summary">
          <span>{overview ? 'Carga de la propuesta' : active && teacherFilter === 'all' && roomFilter === 'all' ? 'Ajuste de la sección seleccionada' : 'Semana del recurso seleccionado'} · {filtered.length} bloques con los filtros actuales</span>
          {(unassigned > 0 || teacherFilter === '__unassigned__') && <Button variant="ghost" type="button" onClick={onShowPending}>Ver secciones sin horario ({unassigned})</Button>}
        </div>
        {!filtered.length && (
          <p role="status" className="planning-week__empty">
            {blocks.length
              ? 'No hay bloques que coincidan con los filtros.'
              : 'Aún no hay bloques asignados. Revisa las secciones pendientes en Tabla.'}
          </p>
        )}
        {overview && <>
          <p className="planning-week__load-help" id="planning-week-load-help">Cada celda cuenta los bloques que intersectan la franja; no indica conflictos. Selecciona una para ver sus clases.</p>
          <div className="planning-week__load-days planning-week__day-tabs" role="group" aria-label="Día del mapa de carga">
            {days.map(day => <button key={day} type="button" aria-pressed={visibleDay === day} onClick={() => setAgendaDay(day)}>{short[day]}</button>)}
          </div>
          <div className="planning-week__load-scroll">
            <table className="planning-week__load" aria-label="Carga de bloques por franja" aria-describedby="planning-week-load-help">
              <thead><tr><th scope="col">Hora</th>{days.map(day => <th key={day} scope="col" className={day === visibleDay ? 'is-day-visible' : undefined}>{short[day]}</th>)}</tr></thead>
              <tbody>{loadSlots.map(row => <tr key={row.startMinute}>
                <th scope="row">{formatAcademicMinute(row.startMinute)}<span>–{formatAcademicMinute(row.endMinute)}</span></th>
                {row.days.map(cell => {
                  const available = dayAvailability(cell.day).some(w => w.startMinute < row.endMinute && w.endMinute > row.startMinute)
                  return <td key={cell.day} className={cell.day === visibleDay ? 'is-day-visible' : undefined}>
                    <button type="button" data-load-day={cell.day} data-load-start={row.startMinute} data-load-count={cell.items.length}
                      data-load-level={!cell.items.length ? 0 : Math.ceil(cell.items.length / maxLoad * 3)}
                      data-unavailable={!available || undefined}
                      aria-pressed={selectedSlot?.day === cell.day && selectedSlot.startMinute === row.startMinute}
                      aria-label={`${names[cell.day]} ${formatAcademicMinute(row.startMinute)}–${formatAcademicMinute(row.endMinute)}: ${cell.items.length} bloques${available ? '' : ', fuera de disponibilidad configurada'}`}
                      onClick={() => setLoadSelection({ sectionId: selectedSectionId, slot: { day: cell.day, startMinute: row.startMinute } })}>
                      <span>{cell.items.length || '—'}</span><small>{cell.items.length === 1 ? 'bloque' : cell.items.length ? 'bloques' : 'sin bloques'}</small>
                    </button>
                  </td>
                })}
              </tr>)}</tbody>
            </table>
          </div>
          <p className="planning-week__load-help">Más intensidad = más bloques en la franja. Un bloque largo puede aparecer en varias franjas.</p>
          {slot && selectedSlot && <section className="planning-week__load-detail" aria-label="Bloques de la franja seleccionada">
            <div className="planning-week__summary"><h2>{names[selectedSlot.day]} · {formatAcademicMinute(slot.startMinute)}–{formatAcademicMinute(slot.endMinute)} · {slotBlocks.length} bloques</h2>
              <Button variant="ghost" type="button" onClick={() => {
                setLoadSelection({ sectionId: selectedSectionId, slot: null })
                root.current?.querySelector<HTMLButtonElement>(`[data-load-day="${selectedSlot.day}"][data-load-start="${slot.startMinute}"]`)?.focus()
              }}>Cerrar franja</Button>
            </div>
            <ul>{[...slotBlocks].sort((a, b) => a.startMinute - b.startMinute || a.courseName.localeCompare(b.courseName, 'es')).map(b => <li key={b.id}>{renderBlock({ block: b, proposed: false, day: b.day, startMinute: b.startMinute, endMinute: b.endMinute, id: b.id }, undefined, true)}</li>)}</ul>
            {!slotBlocks.length && <p className="planning-week__empty">No hay bloques en esta franja con los filtros actuales.</p>}
          </section>}
        </>}
        {!overview && <>

        <div
          className="planning-week__grid-wrapper"
          tabIndex={0}
          role="region"
          aria-label="Calendario semanal con días configurados"
        >
          <div
            className="planning-week__grid"
            style={{ gridTemplateColumns: `56px ${days.map(day => {
              const lanes = dayLayouts.get(day)?.layout
              const count = Math.max(1, ...Array.from(lanes?.values() ?? [], lane => lane.totalLanes))
              return `minmax(${count * 164}px, 1fr)`
            }).join(' ')}` }}
          >
            <div />
            {days.map((day) => (
              <div key={day} className="planning-week__day-heading">
                {short[day]}
                {day > 5 && (
                  <span>
                    {' '}
                    ·{' '}
                    {dayAvailability(day)
                      .map(
                        (w) =>
                          `${formatAcademicMinute(w.startMinute).replace(':00', '')}–${formatAcademicMinute(w.endMinute).replace(':00', '')}`,
                      )
                      .join(', ')}
                  </span>
                )}
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
              const dayItems = dayLayouts.get(day)?.items ?? []
              const layout = dayLayouts.get(day)?.layout
              const unavailable: Array<{ startMinute: number; endMinute: number }> = []
              let cursor = min
              for (const window of dayAvailability(day)) {
                if (window.startMinute > cursor)
                  unavailable.push({
                    startMinute: cursor,
                    endMinute: Math.min(max, window.startMinute),
                  })
                cursor = Math.max(cursor, window.endMinute)
              }
              if (cursor < max) unavailable.push({ startMinute: cursor, endMinute: max })
              return (
                <div
                  key={day}
                  className="planning-week__day-col"
                  aria-label={`Horarios del ${names[day]}`}
                  style={{ height: hours.length * 40 }}
                >
                  {unavailable.map((window) => (
                    <div
                      key={window.startMinute}
                      className="planning-week__unavailable"
                      title="Fuera de la disponibilidad configurada"
                      style={{
                        top: ((window.startMinute - min) / 60) * 40,
                        height: ((window.endMinute - window.startMinute) / 60) * 40,
                      }}
                    />
                  ))}
                  {dayItems.map((item) => {
                    const lane = layout?.get(item.id)
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
                    {item.day !== visibleDay && <>{short[item.day]}<br /></>}
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
        </>}
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

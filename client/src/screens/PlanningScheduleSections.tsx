import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef } from 'react'
import { useMediaQuery } from '../lib/useMediaQuery'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { NativeSelect } from '../components/ui/NativeSelect'
import { indexAcademicProposal, academicSectionLabel, aggregateAcademicBlocks, formatAcademicMinute, normalizeAcademicSearch } from '../data/academicScheduling'
import type { AcademicCatalog, AcademicProposal } from '../data/academicScheduling'

// Planning-only rendering: retains the existing section-level search and teacher predicates.
export function PlanningSectionsTable({ proposal, catalog, selectedSectionId, onSelectSection, searchQuery, teacherFilter, roomFilter }: {
  proposal: AcademicProposal
  catalog: AcademicCatalog | null
  selectedSectionId: string | null
  onSelectSection: (id: string) => void
  searchQuery: string
  teacherFilter: string
  roomFilter: string
}) {
  const narrow = useMediaQuery('(max-width: 719px)')
  const { blocksBySection, assignmentsBySection, pendingBySection, adjustedSections } = useMemo(() => indexAcademicProposal(proposal), [proposal])
  const roomSessions = useMemo(() => new Set(proposal.assignments.filter(item => item.roomId === roomFilter).map(item => item.sessionId)), [proposal, roomFilter])
  const query = normalizeAcademicSearch(searchQuery)
  const sections = proposal.sections.filter((section) => {
    const sectionBlocks = (blocksBySection.get(section.sectionId) ?? [])
    if (teacherFilter === '__unassigned__' && sectionBlocks.length > 0) return false
    if ((teacherFilter !== 'all' && teacherFilter !== '__unassigned__') || roomFilter !== 'all') {
      if (!sectionBlocks.some(block => (teacherFilter === 'all' || block.teacherId === teacherFilter)
        && (roomFilter === 'all' || block.sessionIds.some(id => roomSessions.has(id))))) return false
    }
    const label = academicSectionLabel(proposal, section.sectionId)
    return !query || normalizeAcademicSearch(`${section.courseId} ${section.courseName} ${section.sectionId} ${label} Sección ${label} ${sectionBlocks.map((block) => block.teacherName).join(' ')} ${sectionBlocks.flatMap((block) => block.roomNames).join(' ')}`).includes(query)
  }).sort((a, b) => Number(pendingBySection.has(b.sectionId)) - Number(pendingBySection.has(a.sectionId)))
  const previousSelection = useRef(selectedSectionId)
  useEffect(() => {
    if (selectedSectionId && previousSelection.current !== selectedSectionId) {
      document.querySelector(`[data-section-id="${CSS.escape(selectedSectionId)}"]`)?.scrollIntoView({ block: 'nearest' })
    }
    previousSelection.current = selectedSectionId
  }, [selectedSectionId])
  if (narrow) return <div className="planning-horario-list" role="list" aria-label="Secciones de la propuesta">
    {sections.map((section) => {
      const assigned = (blocksBySection.get(section.sectionId) ?? [])
      const pending = (pendingBySection.get(section.sectionId) ?? [])
      const status = !assigned.length ? 'Pendiente' : pending.length ? 'Parcial' : 'Completa'
      const course = catalog?.courses.find((item) => item.courseId === section.courseId)
      const types = [...new Set(assigned.flatMap((block) => block.componentDetails.map((item) => item.type)))]
      return <div role="listitem" key={section.sectionId}>
        <button type="button" className="planning-horario-list__row" data-section-id={section.sectionId}
          aria-pressed={selectedSectionId === section.sectionId}
          aria-label={`Inspeccionar sección ${academicSectionLabel(proposal, section.sectionId)} de ${section.courseName}`}
          onClick={() => onSelectSection(section.sectionId)}>
          <span className="planning-horario-list__eyebrow">{section.courseId} · Secc. {academicSectionLabel(proposal, section.sectionId)} · {(types.length ? types : course?.weeklySessions.map((item) => item.type) ?? []).map((type) => ({ T: 'Teoría', P: 'Práctica', L: 'Lab.' } as Record<string, string>)[type ?? ''] ?? type).join(' + ') || 'Componente'}</span>
          <span className="planning-horario-list__name">{section.courseName}</span>
          {status !== 'Completa' && <span className={`planning-horario-status planning-horario-status--${status}`}>{status === 'Parcial' ? '◐' : '○'} {status}</span>}
          {assigned.map((block) => <span className="planning-horario-list__meta" key={block.sessionIds.join('|')}>
            {status === 'Completa' ? '✓ ' : ''}{block.teacherName} · {block.roomNames.join(', ')} · {['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][block.day]} {formatAcademicMinute(block.startMinute)}–{formatAcademicMinute(block.endMinute)}
          </span>)}
          {adjustedSections.has(section.sectionId) && <span className="planning-horario-list__meta">Ajustada</span>}
        </button>
      </div>
    })}
    {!sections.length && <p>No se encontraron secciones que coincidan con la búsqueda.</p>}
  </div>
  return <div className="planning-horario-table-scroll">
    <table className="planning-horario-table" aria-label="Secciones de la propuesta">
      <thead><tr>{['Curso', 'Secc.', 'Componente', 'Docente', 'Ambiente', 'Día y hora', 'Estado'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{sections.flatMap((section) => {
        const assigned = (assignmentsBySection.get(section.sectionId) ?? [])
        const pending = (pendingBySection.get(section.sectionId) ?? [])
        const status = assigned.length === 0 ? 'Pendiente' : pending.length ? 'Parcial' : 'Completa'
        const rows = [...assigned, ...pending]
        return (rows.length ? rows : [null]).map((item) => {
          const assignment = item && 'teacherName' in item ? item : null
          return <tr key={item?.sessionId ?? section.sectionId} data-section-id={section.sectionId} aria-selected={selectedSectionId === section.sectionId} onClick={() => onSelectSection(section.sectionId)}>
            <td><span className="planning-horario-code">{section.courseId}</span> <button type="button" aria-label={`Inspeccionar sección ${academicSectionLabel(proposal, section.sectionId)} de ${section.courseName}`} onClick={() => onSelectSection(section.sectionId)}>{section.courseName}</button></td>
            <td className="planning-horario-mono">{academicSectionLabel(proposal, section.sectionId)}</td>
            <td>{assignment?.sessionType ?? catalog?.courses.find((course) => course.courseId === section.courseId)?.weeklySessions.find((session) => item?.sessionId === `session:${JSON.stringify([section.sectionId, session.id])}`)?.type ?? 'Componente'}</td>
            <td>{assignment?.teacherName ?? <i>Por asignar</i>}</td>
            <td>{assignment?.roomName ?? <i>Por asignar</i>}</td>
            <td className="planning-horario-mono">{assignment ? `${['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][assignment.day]} ${formatAcademicMinute(assignment.startMinute)}–${formatAcademicMinute(assignment.endMinute)}` : '—'}</td>
            <td><span className={`planning-horario-status planning-horario-status--${status}`}><span aria-hidden="true">{status === 'Completa' ? '✓' : status === 'Parcial' ? '◐' : '○'}</span> {status}{adjustedSections.has(section.sectionId) && <small> · Ajustada</small>}</span></td>
          </tr>
        })
      })}{!sections.length && <tr><td colSpan={7}>No se encontraron secciones que coincidan con la búsqueda.</td></tr>}</tbody>
    </table>
  </div>
}

export function PlanningScheduleToolbar({ contextContainer, mobileActionContainer, proposal, searchQuery, onSearchChange, teacherFilter, onTeacherFilterChange, roomFilter, onRoomFilterChange, viewMode, onToggleView }: {
  proposal: AcademicProposal
  searchQuery: string
  onSearchChange: (value: string) => void
  teacherFilter: string
  roomFilter: string
  onTeacherFilterChange: (value: string) => void
  onRoomFilterChange: (value: string) => void
  viewMode: 'tabla' | 'semana'
  mobileActionContainer?: HTMLDivElement | null
  contextContainer?: HTMLDivElement | null
  onToggleView: (value: 'tabla' | 'semana') => void
}) {
  const { teachers, rooms, unassigned } = useMemo(() => {
    const blocks = aggregateAcademicBlocks(proposal)
    const byTeacher = new Map<string, { id: string; name: string; sections: Set<string> }>()
    for (const block of blocks) {
      const teacher = byTeacher.get(block.teacherId) ?? { id: block.teacherId, name: block.teacherName, sections: new Set<string>() }
      teacher.sections.add(block.sectionId)
      byTeacher.set(teacher.id, teacher)
    }
    const assigned = new Set(blocks.map((block) => block.sectionId))
    return {
      teachers: [...byTeacher.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      rooms: [...new Map(proposal.assignments.map(item => [item.roomId, { id: item.roomId, name: item.roomName }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      unassigned: proposal.sections.filter((section) => !assigned.has(section.sectionId)).length,
    }
  }, [proposal])

  const controls = <>
    <div className="planning-schedule-toolbar__teacher">
      <NativeSelect aria-label="Filtrar por docente" value={teacherFilter} onChange={(event) => onTeacherFilterChange(event.currentTarget.value)}>
        <option value="all">Todos los docentes</option>
        {unassigned > 0 && <option value="__unassigned__">Sin docente asignado / Pendientes ({unassigned})</option>}
        {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} ({teacher.sections.size})</option>)}
      </NativeSelect>
    </div>
    <div className="planning-schedule-toolbar__teacher">
      <NativeSelect aria-label="Filtrar por aula" value={roomFilter} onChange={event => onRoomFilterChange(event.currentTarget.value)}>
        <option value="all">Todas las aulas</option>
        {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
      </NativeSelect>
    </div>
    <span className="planning-horario-count">{proposal.sections.length} secciones · {proposal.sections.filter((section) => proposal.pending.some((item) => item.sectionId === section.sectionId)).length} pendientes primero</span>
    <span className="planning-horario-toolbar-spacer" aria-hidden="true" />
    <div className="planning-sections__view-toggle" role="group" aria-label="Vista">
      <Button variant="ghost" type="button" aria-pressed={viewMode === 'tabla'} onClick={() => onToggleView('tabla')}>Tabla</Button>
      <Button variant="ghost" type="button" aria-pressed={viewMode === 'semana'} onClick={() => onToggleView('semana')}>Semana</Button>
    </div>
  </>
  const toolbar = <div className="planning-schedule-toolbar">
    <div className="planning-schedule-toolbar__search">
      <Input type="search" placeholder="Buscar curso, sección o aula" aria-label="Buscar secciones"
        value={searchQuery} onChange={(event) => onSearchChange(event.currentTarget.value)} />
    </div>
    {mobileActionContainer ? createPortal(<div className="planning-mobile-schedule-controls">{controls}</div>, mobileActionContainer) : controls}
  </div>
  return contextContainer ? createPortal(toolbar, contextContainer) : toolbar
}


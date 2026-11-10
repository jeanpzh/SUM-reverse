import { CircleCheck, CircleAlert } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table'
import { useEffect, useMemo, useRef } from 'react'
import type { AcademicCatalog, AcademicProposal } from '../data/academicScheduling'
import {
  academicSectionLabel,
  aggregateAcademicBlocks,
  formatAcademicMinute,
  normalizeAcademicSearch,
} from '../data/academicScheduling'

export interface PlanningSectionsTableProps {
  proposal: AcademicProposal
  catalog: AcademicCatalog | null
  demands: Record<string, string>
  selectedSectionId: string | null
  onSelectSection: (sectionId: string) => void
  onEditBlock: (block: ReturnType<typeof aggregateAcademicBlocks>[number]) => void
  isLocked?: boolean
  searchQuery?: string
  teacherFilter?: string
}

export function PlanningSectionsTable({
  proposal,
  catalog,
  demands,
  selectedSectionId,
  onSelectSection,
  searchQuery,
  teacherFilter,
}: PlanningSectionsTableProps) {
  const effectiveQuery = searchQuery ?? ''
  const effectiveTeacherFilter = teacherFilter ?? 'all'
  const prevSelectedId = useRef<string | null>(selectedSectionId)

  useEffect(() => {
    if (
      selectedSectionId &&
      selectedSectionId !== prevSelectedId.current &&
      typeof CSS !== 'undefined' &&
      CSS.escape
    ) {
      const row = document.querySelector(`tr[data-section-id="${CSS.escape(selectedSectionId)}"]`)
      row?.scrollIntoView({ block: 'nearest' })
    }
    prevSelectedId.current = selectedSectionId
  }, [selectedSectionId])

  const blocks = useMemo(() => aggregateAcademicBlocks(proposal), [proposal])

  const blocksBySection = useMemo(() => {
    const map = new Map<string, typeof blocks>()
    for (const block of blocks) {
      map.set(block.sectionId, [...(map.get(block.sectionId) ?? []), block])
    }
    return map
  }, [blocks])

  const normalizedQuery = normalizeAcademicSearch(effectiveQuery)

  const { courseGroups, totalSectionsCount, filteredSectionsCount } = useMemo(() => {
    const groupsMap = new Map<string, { courseId: string; courseName: string; sections: AcademicProposal['sections'] }>()

    for (const section of proposal.sections) {
      const existing = groupsMap.get(section.courseId)
      if (existing) {
        existing.sections.push(section)
      } else {
        groupsMap.set(section.courseId, {
          courseId: section.courseId,
          courseName: section.courseName,
          sections: [section],
        })
      }
    }

    let total = 0
    let filtered = 0

    const groups: Array<{
      courseId: string
      courseName: string
      demand: string
      sections: AcademicProposal['sections']
    }> = []

    for (const group of groupsMap.values()) {
      total += group.sections.length

      const matchedSections = group.sections.filter((section) => {
        const sBlocks = blocksBySection.get(section.sectionId) ?? []
        if (effectiveTeacherFilter === '__unassigned__') {
          if (sBlocks.length > 0) return false
        } else if (effectiveTeacherFilter && effectiveTeacherFilter !== 'all') {
          if (!sBlocks.some((b) => b.teacherId === effectiveTeacherFilter)) return false
        }

        if (!normalizedQuery) return true
        const sLabel = academicSectionLabel(proposal, section.sectionId)
        const teachers = sBlocks.map((b) => b.teacherName).join(' ')
        const rooms = sBlocks.flatMap((b) => b.roomNames).join(' ')
        const hay = normalizeAcademicSearch(
          `${group.courseId} ${group.courseName} ${section.sectionId} ${sLabel} Sección ${sLabel} ${teachers} ${rooms}`
        )
        return hay.includes(normalizedQuery)
      })

      filtered += matchedSections.length

      if (matchedSections.length > 0) {
        const configuredDemand = demands[group.courseId]
        const catalogDemand = catalog?.courses.find((c) => c.courseId === group.courseId)?.estimatedDemand?.toString()
        const derivedDemand = String(group.sections.length * (group.sections[0]?.capacity ?? 45))
        const demand = configuredDemand && configuredDemand.trim() !== '' ? configuredDemand : (catalogDemand ?? derivedDemand)

        groups.push({
          courseId: group.courseId,
          courseName: group.courseName,
          demand,
          sections: matchedSections,
        })
      }
    }

    return {
      courseGroups: groups,
      totalSectionsCount: total,
      filteredSectionsCount: filtered,
    }
  }, [proposal, blocksBySection, normalizedQuery, effectiveTeacherFilter, demands, catalog])

  return (
    <div className="planning-sections">
      <div className="planning-sections__table-wrapper">
        <Table stickyHeader containerClassName="planning-sections__table-scroll" className="academic-scheduling__sections-table planning-sections__table">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Sección</TableHead>
              <TableHead scope="col">Capacidad</TableHead>
              <TableHead scope="col">Docente</TableHead>
              <TableHead scope="col">Ambiente</TableHead>
              <TableHead scope="col">Horario</TableHead>
              <TableHead scope="col">Estado</TableHead>
            </TableRow>
          </TableHeader>
          {courseGroups.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className="planning-sections__empty">
                  No se encontraron secciones que coincidan con la búsqueda.
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            courseGroups.map((group) => {
              const sectionCountText = `${group.sections.length} ${group.sections.length === 1 ? 'sección' : 'secciones'}`
              return (
                <TableBody key={group.courseId} className="planning-sections__group">
                  <TableRow className="planning-sections__group-row">
                    <TableHead colSpan={6} scope="colgroup" className="planning-sections__group-header">
                      {group.courseId} · {group.courseName} · Demanda {group.demand} · {sectionCountText}
                    </TableHead>
                  </TableRow>
                  {group.sections.map((section) => {
                    const isSelected = selectedSectionId === section.sectionId
                    const sBlocks = blocksBySection.get(section.sectionId) ?? []
                    const isPending = sBlocks.length === 0
                    const isPartial = !isPending && proposal.pending.some((item) => item.sectionId === section.sectionId)
                    const isAdjusted = proposal.manuallyAdjustedSectionIds?.includes(section.sectionId)
                    const label = academicSectionLabel(proposal, section.sectionId)

                    const teacherText = isPending
                      ? 'Por asignar'
                      : [...new Set(sBlocks.map((b) => b.teacherName))].join(', ')
                    const roomText = isPending
                      ? '—'
                      : [...new Set(sBlocks.flatMap((b) => b.roomNames))].join(', ')

                    const dayNames = ['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

                    let scheduleNode: React.ReactNode = '—'
                    if (!isPending) {
                      if (sBlocks.length === 1) {
                        const b = sBlocks[0]
                        scheduleNode = `${dayNames[b.day]} ${formatAcademicMinute(b.startMinute)}–${formatAcademicMinute(b.endMinute)}`
                      } else {
                        scheduleNode = (
                          <div className="planning-sections__blocks-compact">
                            <span>
                              {sBlocks
                                .map((b) => `${dayNames[b.day]} ${formatAcademicMinute(b.startMinute)}–${formatAcademicMinute(b.endMinute)}`)
                                .join(' · ')}
                            </span>
                            <Button variant="ghost" size="sm"
                              type="button"
                              className="planning-sections__link-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onSelectSection(section.sectionId)
                              }}
                            >
                              Ver bloques
                            </Button>
                          </div>
                        )
                      }
                    }

                    return (
                      <TableRow
                        key={section.sectionId}
                        data-section-id={section.sectionId}
                        className={`planning-sections__row ${isPending ? 'planning-sections__row--pending' : ''} ${isSelected ? 'planning-sections__row--selected' : ''}`}
                        onClick={() => onSelectSection(section.sectionId)}
                        aria-selected={isSelected}
                        data-state={isSelected ? 'selected' : undefined}
                      >
                        <TableCell className="planning-sections__cell-section">
                          <Button variant="link" size="sm" type="button"
                            aria-label={`Inspeccionar sección ${label} de ${section.courseName}`}
                            onClick={(event) => { event.stopPropagation()
                              onSelectSection(section.sectionId) }}>
                            {label}
                          </Button>
                        </TableCell>
                        <TableCell className="planning-sections__cell-capacity">{section.capacity}</TableCell>
                        <TableCell className="planning-sections__cell-teacher">{teacherText}</TableCell>
                        <TableCell className="planning-sections__cell-room">{roomText}</TableCell>
                        <TableCell className="planning-sections__cell-schedule">{scheduleNode}</TableCell>
                        <TableCell className="planning-sections__cell-status">
                          <span className={`planning-sections__status ${isPending || isPartial ? 'planning-sections__status--pending' : 'planning-sections__status--complete'}`}>
                            {isPending || isPartial ? <CircleAlert size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
                            {isPending ? 'Pendiente' : isPartial ? 'Parcial' : 'Completa'}
                            {isAdjusted && <span className="planning-meta"> · Ajustada</span>}
                          </span>
                        </TableCell>

                      </TableRow>
                    )
                  })}
                </TableBody>
              )
            })
          )}
        </Table>
      </div>
      <p className="planning-sections__count">Mostrando {filteredSectionsCount} de {totalSectionsCount}</p>
    </div>
  )
}

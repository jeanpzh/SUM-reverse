import { useMemo, useState } from 'react'
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
  viewMode: 'tabla' | 'semana'
  onToggleView: (mode: 'tabla' | 'semana') => void
}

export function PlanningSectionsTable({
  proposal,
  catalog,
  demands,
  selectedSectionId,
  onSelectSection,
  onEditBlock,
  isLocked = false,
  viewMode,
  onToggleView,
}: PlanningSectionsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const blocks = useMemo(() => aggregateAcademicBlocks(proposal), [proposal])

  const blocksBySection = useMemo(() => {
    const map = new Map<string, typeof blocks>()
    for (const block of blocks) {
      map.set(block.sectionId, [...(map.get(block.sectionId) ?? []), block])
    }
    return map
  }, [blocks])

  const normalizedQuery = normalizeAcademicSearch(searchQuery)

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
        if (!normalizedQuery) return true
        const sLabel = academicSectionLabel(proposal, section.sectionId)
        const sBlocks = blocksBySection.get(section.sectionId) ?? []
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
  }, [proposal, blocksBySection, normalizedQuery, demands, catalog])

  return (
    <div className="planning-sections">
      <div className="planning-sections__toolbar">
        <div className="planning-sections__toolbar-left">
          <h3 className="planning-sections__title">Secciones</h3>
          <span className="planning-sections__count">
            Mostrando {filteredSectionsCount} de {totalSectionsCount}
          </span>
        </div>

        <div className="planning-sections__toolbar-right">
          <input
            type="search"
            className="planning-sections__search"
            placeholder="Buscar por curso, sección o recurso…"
            aria-label="Buscar secciones"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="planning-sections__view-toggle" role="group" aria-label="Vista">
            <button
              type="button"
              className={`planning-sections__toggle-btn ${viewMode === 'tabla' ? 'planning-sections__toggle-btn--active' : ''}`}
              aria-pressed={viewMode === 'tabla'}
              onClick={() => onToggleView('tabla')}
            >
              Tabla
            </button>
            <button
              type="button"
              className={`planning-sections__toggle-btn ${viewMode === 'semana' ? 'planning-sections__toggle-btn--active' : ''}`}
              aria-pressed={viewMode === 'semana'}
              onClick={() => onToggleView('semana')}
            >
              Semana
            </button>
          </div>
        </div>
      </div>

      <div className="planning-sections__table-wrapper">
        <table className="academic-scheduling__sections-table planning-sections__table">
          <thead>
            <tr>
              <th scope="col">Sección</th>
              <th scope="col">Capacidad</th>
              <th scope="col">Docente</th>
              <th scope="col">Ambiente</th>
              <th scope="col">Horario</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          {courseGroups.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={7} className="planning-sections__empty">
                  No se encontraron secciones que coincidan con la búsqueda.
                </td>
              </tr>
            </tbody>
          ) : (
            courseGroups.map((group) => {
              const sectionCountText = `${group.sections.length} ${group.sections.length === 1 ? 'sección' : 'secciones'}`
              return (
                <tbody key={group.courseId} className="planning-sections__group">
                  <tr className="planning-sections__group-row">
                    <th colSpan={7} scope="colgroup" className="planning-sections__group-header">
                      {group.courseId} · {group.courseName} · Demanda {group.demand} · {sectionCountText}
                    </th>
                  </tr>
                  {group.sections.map((section) => {
                    const isSelected = selectedSectionId === section.sectionId
                    const sBlocks = blocksBySection.get(section.sectionId) ?? []
                    const isPending = sBlocks.length === 0
                    const isAdjusted = proposal.manuallyAdjustedSectionIds?.includes(section.sectionId)
                    const label = academicSectionLabel(proposal, section.sectionId)

                    const teacherText = isPending
                      ? '—'
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
                            <button
                              type="button"
                              className="planning-sections__link-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onSelectSection(section.sectionId)
                              }}
                            >
                              Ver bloques
                            </button>
                          </div>
                        )
                      }
                    }

                    return (
                      <tr
                        key={section.sectionId}
                        className={`planning-sections__row ${isPending ? 'planning-sections__row--pending' : ''} ${isSelected ? 'planning-sections__row--selected' : ''}`}
                        onClick={() => onSelectSection(section.sectionId)}
                        aria-selected={isSelected}
                      >
                        <td className="planning-sections__cell-section">{label}</td>
                        <td className="planning-sections__cell-capacity">{section.capacity}</td>
                        <td className="planning-sections__cell-teacher">{teacherText}</td>
                        <td className="planning-sections__cell-room">{roomText}</td>
                        <td className="planning-sections__cell-schedule">{scheduleNode}</td>
                        <td className="planning-sections__cell-status">
                          {isPending ? (
                            <span className="planning-sections__status planning-sections__status--pending">
                              Pendiente
                            </span>
                          ) : (
                            <span className="planning-sections__status planning-sections__status--complete">
                              Completa{isAdjusted ? ' · Ajustada' : ''}
                            </span>
                          )}
                        </td>
                        <td className="planning-sections__cell-actions">
                          <div className="planning-sections__row-actions">
                            <button
                              type="button"
                              className="planning-sections__action-button"
                              aria-label={`Inspeccionar sección ${label} de ${section.courseName}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                onSelectSection(section.sectionId)
                              }}
                            >
                              Inspeccionar
                            </button>
                            {sBlocks.length > 0 && (
                              <button
                                type="button"
                                className="academic-scheduling__text-button"
                                disabled={isLocked}
                                aria-expanded={isSelected}
                                aria-controls="academic-scheduling-manual-editor"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectSection(section.sectionId)
                                  onEditBlock(sBlocks[0])
                                }}
                              >
                                Editar horario
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              )
            })
          )}
        </table>
      </div>
    </div>
  )
}

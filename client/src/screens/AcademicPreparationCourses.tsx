import { Fragment, useId, useMemo, useState } from 'react'
import type { AcademicCatalog, AcademicDemandEstimate, AcademicProposal, PlanningPeriod } from '../data/academicScheduling.ts'
import { formatAcademicInterval, PLANNING_LIMITS } from '../data/academicScheduling.ts'
import {
  applyBulkChanges,
  buildBulkChangePreview,
  calculatePreparationCounts,
  deselectVisibleCourses,
  filterPreparationCourses,
  groupCoursesByCycle,
  selectVisibleCourses,
} from '../data/academicPreparation.ts'
import type { BulkChangePreview } from '../data/academicPreparation.ts'
import { AcademicDemandPanel } from './AcademicDemandPanel.tsx'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/Dialog'
import './AcademicPreparationCourses.css'

export interface AcademicPreparationCoursesProps {
  catalog: AcademicCatalog | null
  loadingCatalog: boolean
  catalogError: string | null
  onRetryCatalog: () => void
  planningPeriod: PlanningPeriod
  onApplyPeriodDefaults: (period: PlanningPeriod, force?: boolean) => void
  cycleFilter: string
  onCycleFilterChange: (cycle: string) => void
  selectedCourses: string[]
  onToggleCourse: (courseId: string, checked: boolean) => void
  onSelectCourses: (courseIds: string[]) => void
  demands: Record<string, string>
  capacities: Record<string, string>
  patterns: Record<string, string>
  deliveryModes: Record<string, 'continuous' | 'split'>
  onUpdateDemand: (courseId: string, value: string) => void
  onUpdateCapacity: (courseId: string, value: string) => void
  onUpdatePattern: (courseId: string, patternId: string) => void
  onUpdateDeliveryMode: (courseId: string, mode: 'continuous' | 'split') => void
  onApplyBulkChanges: (newDemands: Record<string, string>, newCapacities: Record<string, string>) => void
  proposal: AcademicProposal | null
  isLocked?: boolean
  demandSourceId: 'existing-regular-v1' | 'independent-120-v1'
  onChangeDemandSource: (id: 'existing-regular-v1' | 'independent-120-v1') => void
  demandEstimate: AcademicDemandEstimate | null
  demandLoading: boolean
  demandError: string | null
  onEstimateDemand: () => void
  onUseBaseDemand: (courseId: string, value: number) => void
}

export function AcademicPreparationCourses({
  catalog,
  loadingCatalog,
  catalogError,
  onRetryCatalog,
  planningPeriod,
  onApplyPeriodDefaults,
  cycleFilter,
  onCycleFilterChange,
  selectedCourses,
  onToggleCourse,
  onSelectCourses,
  demands,
  capacities,
  patterns,
  deliveryModes,
  onUpdateDemand,
  onUpdateCapacity,
  onUpdatePattern,
  onUpdateDeliveryMode,
  onApplyBulkChanges,
  proposal,
  isLocked = false,
  demandSourceId,
  onChangeDemandSource,
  demandEstimate,
  demandLoading,
  demandError,
  onEstimateDemand,
  onUseBaseDemand,
}: AcademicPreparationCoursesProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [inspectedCourseId, setInspectedCourseId] = useState<string | null>(null)
  const [demandOpen, setDemandOpen] = useState(false)

  // Bulk edit modal state
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [bulkApplyDemand, setBulkApplyDemand] = useState(false)
  const [bulkApplyCapacity, setBulkApplyCapacity] = useState(false)
  const [bulkDemandInput, setBulkDemandInput] = useState('')
  const [bulkCapacityInput, setBulkCapacityInput] = useState('')
  const [bulkPreview, setBulkPreview] = useState<BulkChangePreview | null>(null)

  const searchInputId = useId()
  const cycleSelectId = useId()

  const courses = useMemo(() => catalog?.courses ?? [], [catalog])

  const availableCycles = useMemo(() => {
    const set = new Set<number>()
    for (const c of courses) {
      if (c.cycle !== undefined) set.add(c.cycle)
    }
    return Array.from(set).sort((a, b) => a - b)
  }, [courses])

  const visibleCourses = useMemo(() => {
    return filterPreparationCourses(courses, searchQuery, cycleFilter)
  }, [courses, searchQuery, cycleFilter])

  const cycleGroups = useMemo(() => {
    return groupCoursesByCycle(visibleCourses)
  }, [visibleCourses])

  const counts = useMemo(() => {
    return calculatePreparationCounts(courses.length, selectedCourses, visibleCourses.length)
  }, [courses.length, selectedCourses, visibleCourses.length])

  const inspectedCourse = useMemo(() => {
    if (!inspectedCourseId) return null
    return courses.find((c) => c.courseId === inspectedCourseId) ?? null
  }, [courses, inspectedCourseId])

  const handleSelectVisible = () => {
    if (isLocked) return
    const visibleIds = visibleCourses.map((c) => c.courseId)
    const nextSelected = selectVisibleCourses(selectedCourses, visibleIds, PLANNING_LIMITS.courses)
    onSelectCourses(nextSelected)
  }

  const handleDeselectVisible = () => {
    if (isLocked) return
    const visibleIds = visibleCourses.map((c) => c.courseId)
    const nextSelected = deselectVisibleCourses(selectedCourses, visibleIds)
    onSelectCourses(nextSelected)
  }

  const handleOpenBulkModal = () => {
    if (isLocked) return
    setIsBulkOpen(true)
    setBulkApplyDemand(false)
    setBulkApplyCapacity(false)
    setBulkDemandInput('')
    setBulkCapacityInput('')
    setBulkPreview(null)
  }

  const handleCloseBulkModal = () => {
    setIsBulkOpen(false)
    setBulkPreview(null)
  }

  const handleComputePreview = () => {
    if (!catalog) return
    const preview = buildBulkChangePreview(
      catalog.courses,
      selectedCourses,
      demands,
      capacities,
      {
        applyDemand: bulkApplyDemand,
        targetDemand: bulkDemandInput,
        applyCapacity: bulkApplyCapacity,
        targetCapacity: bulkCapacityInput,
      }
    )
    setBulkPreview(preview)
  }

  const handleConfirmBulk = () => {
    if (!bulkPreview || isLocked) return
    const result = applyBulkChanges(bulkPreview, demands, capacities)
    onApplyBulkChanges(result.nextDemands, result.nextCapacities)
    handleCloseBulkModal()
  }

  return (
    <section className="academic-scheduling__panel" aria-labelledby="academic-scheduling-courses">
      <header className="academic-scheduling__panel-heading">
        <div>
          <h3 id="academic-scheduling-courses">Paso 1 · Seleccionar cursos</h3>
          <p>
            Selecciona hasta {PLANNING_LIMITS.courses} cursos. La referencia histórica se conserva aparte del patrón usado en la planificación.
          </p>
        </div>
        <div className="academic-scheduling__panel-meta">
          <span className="academic-scheduling__revision">{catalog?.revision ?? 'PA-DEMO-1'}</span>
          <span>{selectedCourses.length} / {PLANNING_LIMITS.courses} seleccionados</span>
        </div>
      </header>

      {loadingCatalog && (
        <p className="academic-scheduling__state" role="status">
          Consultando catálogo local…
        </p>
      )}

      {catalogError && (
        <div className="academic-scheduling__error" role="alert">
          <span>{catalogError}</span>
          <button
            type="button"
            className="academic-scheduling__button academic-scheduling__button--secondary"
            onClick={onRetryCatalog}
          >
            Reintentar
          </button>
        </div>
      )}

      {catalog && (
        <div className="academic-preparation">
          {/* Top Period Configuration */}
          <div className="academic-scheduling__cycle-filter">
            <label>
              Periodo de planificación
              <select
                aria-label="Periodo de planificación"
                value={planningPeriod}
                disabled={isLocked}
                onChange={(event) => onApplyPeriodDefaults(event.currentTarget.value as PlanningPeriod)}
              >
                {!['2026-I', '2026-II', '2027-I', '2027-II'].includes(planningPeriod) && (
                  <option value={planningPeriod}>{planningPeriod}</option>
                )}
                <option value="2026-I">2026-I</option>
                <option value="2026-II">2026-II</option>
                <option value="2027-I">2027-I</option>
                <option value="2027-II">2027-II</option>
              </select>
            </label>
            <button
              type="button"
              className="academic-scheduling__button academic-scheduling__button--secondary"
              disabled={isLocked}
              onClick={() => onApplyPeriodDefaults(planningPeriod, true)}
            >
              Aplicar valores iniciales del periodo
            </button>
            <p>
              Al cambiar de periodo se aplican los valores iniciales a demanda y capacidad. Los ajustes requieren confirmación si hay cambios pendientes.
            </p>
          </div>

          {/* Search, Filter & Bulk Toolbar */}
          <div className="academic-preparation__toolbar">
            <div className="academic-preparation__toolbar-row">
              <div className="academic-preparation__search-field">
                <label htmlFor={searchInputId}>Buscar por código o nombre</label>
                <input
                  id={searchInputId}
                  type="search"
                  placeholder="Buscar código o nombre…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  aria-label="Buscar curso por código o nombre"
                />
              </div>

              <div className="academic-preparation__cycle-filter">
                <label htmlFor={cycleSelectId}>Filtrar cursos por ciclo</label>
                <select
                  id={cycleSelectId}
                  aria-label="Filtrar cursos por ciclo"
                  value={cycleFilter}
                  onChange={(e) => onCycleFilterChange(e.currentTarget.value)}
                >
                  <option value="all">Todos</option>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((cycle) => (
                    <option key={cycle} value={String(cycle)}>
                      Ciclo {cycle}
                    </option>
                  ))}
                  {courses.some((c) => c.cycle === undefined) && (
                    <option value="unspecified">Sin ciclo especificado</option>
                  )}
                </select>
                {availableCycles.length === 0 && <span>El catálogo no especifica ciclos.</span>}
              </div>
            </div>

            {/* Counters Bar distinguishing Catálogo, Incluidos, and Visibles */}
            <div className="academic-preparation__counters" role="status" aria-label="Contadores de preparación">
              <span className="academic-preparation__counter-item">
                <strong>Catálogo:</strong>
                <span className="academic-preparation__counter-badge" data-testid="count-catalog">
                  {counts.totalCatalog}
                </span>
              </span>
              <span className="academic-preparation__counter-item">
                <strong>Incluidos:</strong>
                <span className="academic-preparation__counter-badge" data-testid="count-included">
                  {counts.totalIncluded}
                </span>
              </span>
              <span className="academic-preparation__counter-item">
                <strong>Visibles:</strong>
                <span className="academic-preparation__counter-badge" data-testid="count-visible">
                  {counts.totalVisible}
                </span>
              </span>
            </div>

            {/* Selection actions & Bulk edit */}
            <div className="academic-preparation__actions-row">
              <button
                type="button"
                className="academic-scheduling__button academic-scheduling__button--secondary"
                disabled={isLocked || visibleCourses.length === 0}
                onClick={handleSelectVisible}
              >
                Seleccionar visibles
              </button>
              <button
                type="button"
                className="academic-scheduling__button academic-scheduling__button--secondary"
                disabled={isLocked || visibleCourses.every((c) => !selectedCourses.includes(c.courseId))}
                onClick={handleDeselectVisible}
              >
                Deseleccionar visibles
              </button>
              <button
                type="button"
                className="academic-scheduling__button academic-scheduling__button--secondary"
                disabled={isLocked || selectedCourses.length === 0}
                onClick={handleOpenBulkModal}
                aria-haspopup="dialog"
              >
                Edición en lote ({selectedCourses.length})
              </button>
            </div>
          </div>

          {/* Workbench: Table + Single Inspector */}
          <div className="academic-preparation__workbench">
            {/* Table Pane */}
            <div className="academic-preparation__table-pane">
              <div
                className="academic-preparation__table-wrapper"
                role="region"
                aria-label="Tabla de cursos para planificación"
                tabIndex={0}
              >
                <table className="academic-preparation__table">
                  <thead>
                    <tr>
                      <th scope="col" className="academic-preparation__th-select">
                        Selección
                      </th>
                      <th scope="col">Ciclo</th>
                      <th scope="col">Asignatura</th>
                      <th scope="col">Demanda final</th>
                      <th scope="col">Demanda base</th>
                      <th scope="col">Sec. sugeridas</th>
                      <th scope="col">Capacidad obj.</th>
                      <th scope="col">Sec. prev.</th>
                      <th scope="col">Inspector</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCourses.length === 0 && (
                      <tr>
                        <td colSpan={9} className="planning-sections__empty">
                          No hay cursos que coincidan con los filtros aplicados.
                        </td>
                      </tr>
                    )}
                    {cycleGroups.map((group) => (
                      <Fragment key={String(group.cycle)}>
                        <tr className="academic-preparation__group-row">
                          <th colSpan={9} scope="colgroup">
                            {group.label} · {group.courses.length}{' '}
                            {group.courses.length === 1 ? 'curso' : 'cursos'}
                          </th>
                        </tr>
                        {group.courses.map((course) => {
                          const isSelected = selectedCourses.includes(course.courseId)
                          const isInspected = inspectedCourseId === course.courseId
                          const demandVal = demands[course.courseId] ?? ''
                          const capVal = capacities[course.courseId] ?? ''
                          const demandRow = demandEstimate?.rows.find((row) => row.courseId === course.courseId)
                          const dNum = Number(demandVal)
                          const cNum = Number(capVal)
                          const computedSections =
                            proposal?.status === 'invalid-input'
                              ? 'Entrada inválida'
                              : proposal
                              ? proposal.sections.filter((s) => s.courseId === course.courseId).length
                              : Number.isSafeInteger(dNum) && Number.isSafeInteger(cNum) && cNum > 0
                              ? Math.ceil(dNum / cNum)
                              : '—'

                          return (
                            <tr
                              key={course.courseId}
                              data-course-id={course.courseId}
                              className={`academic-preparation__row ${
                                isInspected ? 'academic-preparation__row--inspected' : ''
                              } ${isSelected ? 'academic-preparation__row--selected' : ''}`}
                            >
                              <td className="academic-preparation__td-select">
                                <label className="academic-scheduling__selection">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={
                                      isLocked ||
                                      (!isSelected && selectedCourses.length >= PLANNING_LIMITS.courses)
                                    }
                                    aria-label={`Seleccionar ${course.courseId}`}
                                    onChange={(e) => {
                                      const checked = e.currentTarget.checked
                                      onToggleCourse(course.courseId, checked)
                                      if (checked && !inspectedCourseId) {
                                        setInspectedCourseId(course.courseId)
                                      }
                                    }}
                                  />
                                </label>
                              </td>
                              <td>{course.cycle !== undefined ? course.cycle : '—'}</td>
                              <td className="academic-preparation__td-course">
                                <div className="academic-preparation__course-cell">
                                  <strong>{course.name}</strong>
                                  <span className="academic-preparation__course-code">
                                    {course.courseId}
                                  </span>
                                </div>
                              </td>
                              <td className="academic-preparation__td-demand">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  inputMode="numeric"
                                  value={demandVal}
                                  disabled={isLocked || !isSelected}
                                  aria-label={`Demanda ${course.courseId}`}
                                  onChange={(e) => onUpdateDemand(course.courseId, e.currentTarget.value)}
                                  onFocus={() => setInspectedCourseId(course.courseId)}
                                  className="academic-preparation__num-input"
                                />
                              </td>
                              <td>{demandRow?.baseDemand ?? '—'}</td>
                              <td>{demandRow?.suggestedSections ?? '—'}</td>
                              <td className="academic-preparation__td-capacity">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  inputMode="numeric"
                                  value={capVal}
                                  disabled={isLocked || !isSelected}
                                  aria-label={`Capacidad ${course.courseId}`}
                                  onChange={(e) => onUpdateCapacity(course.courseId, e.currentTarget.value)}
                                  onFocus={() => setInspectedCourseId(course.courseId)}
                                  className="academic-preparation__num-input"
                                />
                              </td>
                              <td>{computedSections}</td>
                              <td className="academic-preparation__td-actions">
                                <button
                                  type="button"
                                  className={`academic-preparation__inspect-btn ${
                                    isInspected ? 'academic-preparation__inspect-btn--active' : ''
                                  }`}
                                  aria-label={`Inspeccionar ${course.courseId}`}
                                  aria-expanded={isInspected}
                                  onClick={() => setInspectedCourseId(course.courseId)}
                                >
                                  Configurar
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Single Course Inspector */}
            {inspectedCourse && (
              <aside
                className="planning-inspector academic-scheduling__course academic-preparation__inspector"
                aria-label={`Inspector de curso ${inspectedCourse.courseId}`}
              >
                <div className="planning-inspector__header">
                  <div className="planning-inspector__heading-info">
                    <h4 className="planning-inspector__title">{inspectedCourse.name}</h4>
                    <p className="planning-inspector__meta">
                      {inspectedCourse.courseId} · Ciclo {inspectedCourse.cycle ?? '—'} ·{' '}
                      {inspectedCourse.credits ?? '—'} créditos
                    </p>
                  </div>
                  <button
                    type="button"
                    className="planning-inspector__close-btn"
                    aria-label="Cerrar inspector"
                    onClick={() => setInspectedCourseId(null)}
                  >
                    ✕ Cerrar
                  </button>
                </div>

                <div className="academic-preparation__inspector-body">
                  {!selectedCourses.includes(inspectedCourse.courseId) && (
                    <p className="academic-preparation__inspector-warning" role="note">
                      Curso no incluido en la propuesta. Marca su casilla para habilitar sus opciones de configuración.
                    </p>
                  )}

                  {inspectedCourse.planningPatterns && inspectedCourse.planningPatterns.length > 0 && (
                    <label>
                      Patrón semanal de planificación
                      <select
                        value={patterns[inspectedCourse.courseId] ?? ''}
                        disabled={isLocked || !selectedCourses.includes(inspectedCourse.courseId)}
                        aria-label={`Patrón ${inspectedCourse.courseId}`}
                        onChange={(event) =>
                          onUpdatePattern(inspectedCourse.courseId, event.currentTarget.value)
                        }
                      >
                        {inspectedCourse.planningPatterns.map((pattern) => (
                          <option key={pattern.id} value={pattern.id}>
                            {pattern.label} —{' '}
                            {pattern.weeklySessions
                              .map((session) => `${session.type ?? 'Sesión'} ${session.durationMinutes} min`)
                              .join(', ')}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label>
                    Modalidad de sesiones
                    <select
                      value={deliveryModes[inspectedCourse.courseId] ?? 'continuous'}
                      disabled={isLocked || !selectedCourses.includes(inspectedCourse.courseId)}
                      aria-label={`Modalidad de sesiones ${inspectedCourse.courseId}`}
                      onChange={(event) =>
                        onUpdateDeliveryMode(
                          inspectedCourse.courseId,
                          event.currentTarget.value as 'continuous' | 'split'
                        )
                      }
                    >
                      <option value="continuous">Bloque continuo · predeterminado</option>
                      <option value="split">Sesiones divididas · excepción</option>
                    </select>
                  </label>

                  {inspectedCourse.history && (
                    <details className="academic-scheduling__history">
                      <summary>
                        Referencia histórica · {inspectedCourse.history.sections.length} secciones
                      </summary>
                      <div className="academic-scheduling__history-content">
                        {inspectedCourse.history.sections.map((section) => (
                          <div
                            className="academic-scheduling__history-section"
                            key={section.sectionId}
                          >
                            <strong>
                              Sección {section.sectionId} · capacidad histórica {section.capacity}
                            </strong>
                            <ul>
                              {section.sessions.map((session, index) => (
                                <li key={`${section.sectionId}-${index}`}>
                                  {formatAcademicInterval(session)} · {session.type} · {session.room} ·{' '}
                                  {session.teacherName
                                    ? `Docente de referencia: ${session.teacherName}`
                                    : session.teacherId}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </aside>
            )}
          </div>

          {/* Academic Demand Summary (2027-I) */}
          {planningPeriod === '2027-I' ? (
            <>
            <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary academic-demand__summary-trigger"
              aria-haspopup="dialog" onClick={() => setDemandOpen(true)}>Resumen de demanda</button>
            <Dialog open={demandOpen} onOpenChange={setDemandOpen}>
              <DialogContent className="academic-demand__dialog">
                <DialogTitle>Resumen de demanda potencial</DialogTitle>
                <DialogDescription>Fuente, estimación y desglose por curso seleccionado.</DialogDescription>
                <AcademicDemandPanel
              sourceId={demandSourceId}
              onSourceChange={onChangeDemandSource}
              courses={catalog.courses
                .filter((course) => selectedCourses.includes(course.courseId))
                .map((course) => ({
                  courseId: course.courseId,
                  name: course.name,
                  targetCapacity: capacities[course.courseId] ?? '',
                  finalDemand: demands[course.courseId] ?? '',
                }))}
              estimate={demandEstimate}
              loading={demandLoading}
              error={demandError}
              onEstimate={onEstimateDemand}
              onUseBase={onUseBaseDemand}
            />
              </DialogContent>
            </Dialog>
            </>
          ) : (
            <p className="academic-scheduling__resource-note" role="note">
              El estimador de demanda potencial solo tiene ámbito sintético 2027-I. Para {planningPeriod}, ingresa la demanda de planificación manualmente.
            </p>
          )}

          {/* Bulk Changes Modal / Dialog */}
          <Dialog open={isBulkOpen} onOpenChange={(open) => { if (!open) handleCloseBulkModal() }}>
              <DialogContent
                className="academic-preparation__modal"
                showCloseButton={false}
                aria-describedby={undefined}
              >
                <div className="academic-preparation__modal-header">
                  <div>
                    <DialogTitle asChild>
                      <h4 className="academic-preparation__modal-title">
                        Edición en lote de cursos seleccionados
                      </h4>
                    </DialogTitle>
                    <p className="academic-preparation__modal-subtitle">
                      Se aplicará exclusivamente a los {selectedCourses.length} cursos seleccionados.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="planning-inspector__close-btn"
                    aria-label="Cerrar ventana de edición en lote"
                    onClick={handleCloseBulkModal}
                  >
                    ✕ Cerrar
                  </button>
                </div>

                <div className="academic-preparation__modal-body">
                  <div className="academic-preparation__bulk-inputs">
                    <div className="academic-preparation__bulk-input-group">
                      <label className="academic-preparation__bulk-checkbox">
                        <input
                          type="checkbox"
                          checked={bulkApplyDemand}
                          onChange={(e) => {
                            setBulkApplyDemand(e.currentTarget.checked)
                            setBulkPreview(null)
                          }}
                        />
                        Modificar demanda final
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        placeholder="Ej. 40"
                        value={bulkDemandInput}
                        disabled={!bulkApplyDemand}
                        onChange={(e) => {
                            setBulkDemandInput(e.currentTarget.value)
                            setBulkPreview(null)
                          }}
                        aria-label="Nueva demanda en lote"
                        className="academic-preparation__num-input"
                        style={{ width: '100%', textAlign: 'left' }}
                      />
                    </div>

                    <div className="academic-preparation__bulk-input-group">
                      <label className="academic-preparation__bulk-checkbox">
                        <input
                          type="checkbox"
                          checked={bulkApplyCapacity}
                          onChange={(e) => {
                            setBulkApplyCapacity(e.currentTarget.checked)
                            setBulkPreview(null)
                          }}
                        />
                        Modificar capacidad objetivo
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        placeholder="Ej. 30"
                        value={bulkCapacityInput}
                        disabled={!bulkApplyCapacity}
                        onChange={(e) => {
                            setBulkCapacityInput(e.currentTarget.value)
                            setBulkPreview(null)
                          }}
                        aria-label="Nueva capacidad en lote"
                        className="academic-preparation__num-input"
                        style={{ width: '100%', textAlign: 'left' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      className="academic-scheduling__button academic-scheduling__button--secondary"
                      onClick={handleComputePreview}
                      disabled={!bulkApplyDemand && !bulkApplyCapacity}
                    >
                      Calcular vista previa
                    </button>
                  </div>

                  {bulkPreview && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div
                        className="academic-preparation__counters"
                        role="status"
                        aria-label="Resumen de vista previa en lote"
                      >
                        <span className="academic-preparation__counter-item">
                          <strong>Alcance:</strong> {bulkPreview.scopeCount} cursos
                        </span>
                        <span className="academic-preparation__counter-item">
                          <strong>Válidos:</strong>{' '}
                          <span className="academic-preparation__preview-status--valid">
                            {bulkPreview.validCount}
                          </span>
                        </span>
                        <span className="academic-preparation__counter-item">
                          <strong>Excluidos:</strong>{' '}
                          <span
                            className={
                              bulkPreview.excludedCount > 0
                                ? 'academic-preparation__preview-status--excluded'
                                : ''
                            }
                          >
                            {bulkPreview.excludedCount}
                          </span>
                        </span>
                      </div>

                      <div className="academic-preparation__preview-table-wrapper">
                        <table className="academic-preparation__preview-table">
                          <thead>
                            <tr>
                              <th scope="col">Código</th>
                              <th scope="col">Asignatura</th>
                              {bulkPreview.applyDemand && <th scope="col">Demanda (ant → nueva)</th>}
                              {bulkPreview.applyCapacity && <th scope="col">Capacidad (ant → nueva)</th>}
                              <th scope="col">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkPreview.items.map((item) => (
                              <tr key={item.courseId}>
                                <td>
                                  <code>{item.courseId}</code>
                                </td>
                                <td>{item.courseName}</td>
                                {bulkPreview.applyDemand && (
                                  <td>
                                    {item.previousDemand || '—'} →{' '}
                                    <strong>{item.newDemand ?? 'Inválido'}</strong>
                                  </td>
                                )}
                                {bulkPreview.applyCapacity && (
                                  <td>
                                    {item.previousCapacity || '—'} →{' '}
                                    <strong>{item.newCapacity ?? 'Inválido'}</strong>
                                  </td>
                                )}
                                <td>
                                  {item.valid ? (
                                    <span className="academic-preparation__preview-status--valid">
                                      Válido
                                    </span>
                                  ) : (
                                    <span
                                      className="academic-preparation__preview-status--excluded"
                                      role="alert"
                                    >
                                      Excluido: {item.exclusionReason}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="academic-preparation__modal-footer">
                  <button
                    type="button"
                    className="academic-scheduling__button academic-scheduling__button--secondary"
                    onClick={handleCloseBulkModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="academic-scheduling__button"
                    disabled={!bulkPreview || bulkPreview.validCount === 0}
                    onClick={handleConfirmBulk}
                  >
                    Confirmar cambios en lote
                  </button>
                </div>
              </DialogContent>
          </Dialog>
        </div>
      )}
    </section>
  )
}

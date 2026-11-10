import { PlanningFetchLoading } from '../components/PlanningFetchLoading'
import { Badge } from '../components/ui/Badge'
import { Checkbox } from '../components/ui/Checkbox'
import { Button, buttonVariants } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Label } from '../components/ui/Label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table'
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
import { RotateCcw, CheckSquare, Square, SlidersHorizontal } from 'lucide-react'
import { useDefaultLayout } from 'react-resizable-panels'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/Resizable'
import { Sheet, SheetContent, SheetTitle } from '../components/ui/Sheet'
import { useMediaQuery } from '../lib/useMediaQuery'
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
  const wideLayout = useMediaQuery('(min-width: 1024px)')
  const [searchQuery, setSearchQuery] = useState('')
  const [inspectedCourseId, setInspectedCourseId] = useState<string | null>(null)
  const [demandOpen, setDemandOpen] = useState(false)
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'planning-course-detail',
    panelIds: wideLayout && inspectedCourseId ? ['planning-course-table', 'planning-course-inspector'] : ['planning-course-table'],
  })

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

  const courseInspector = inspectedCourse && (
    <aside
      className="planning-inspector planning-inspector--docked academic-preparation__inspector"
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
        <Button variant="ghost"
          type="button"
          className="planning-inspector__close-btn"
          aria-label="Cerrar inspector"
          onClick={() => setInspectedCourseId(null)}
        >
          ✕ Cerrar
        </Button>
      </div>

      <div className="academic-preparation__inspector-body">
        {!selectedCourses.includes(inspectedCourse.courseId) && (
          <p className="academic-preparation__inspector-warning" role="note">
            Curso no incluido en la propuesta. Marca su casilla para habilitar sus opciones de configuración.
          </p>
        )}

        {inspectedCourse.planningPatterns && inspectedCourse.planningPatterns.length > 0 && (
          <Label>
            Patrón semanal de planificación
            <NativeSelect
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
            </NativeSelect>
          </Label>
        )}

        <Label>
          Modalidad de sesiones
          <NativeSelect
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
          </NativeSelect>
        </Label>

        {/* Native details: read-only reference stays openable inside the locked fieldset. */}
        {inspectedCourse.history && (
          <details className="academic-scheduling__history">
            <summary className={`planning-disclosure-trigger ${buttonVariants({ variant: 'ghost' })}`}>Referencia histórica · {inspectedCourse.history.sections.length} secciones</summary>
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
  )

  return (
    <section id="academic-scheduling-courses" className="academic-preparation-view" aria-label="Seleccionar cursos">
      {loadingCatalog && (
        <PlanningFetchLoading label="Consultando catálogo local…" layout="courses-table" />
      )}

      {catalogError && (
        <div className="academic-scheduling__error" role="alert">
          <span>{catalogError}</span>
          <Button variant="outline"
            type="button"
            onClick={onRetryCatalog}
          >
            Reintentar
          </Button>
        </div>
      )}

      {catalog && (
        <div className="academic-preparation">
          <div className="academic-preparation__toolbar">
          <div className="academic-preparation__period">
            <Label>
              <span className="sr-only">Periodo de planificación</span>
              <NativeSelect
                title="Al cambiar de periodo se aplican los valores iniciales a demanda y capacidad. Los ajustes requieren confirmación si hay cambios pendientes."
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
              </NativeSelect>
            </Label>
            <Button
              variant="link"
              type="button"
              disabled={isLocked}
              onClick={() => onApplyPeriodDefaults(planningPeriod, true)}
              aria-label="Aplicar valores iniciales del periodo"
              className="gap-2 text-sm font-normal"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Valores iniciales</span>
            </Button>

          </div>

              <div className="academic-preparation__search-field">
                <Label className="sr-only" htmlFor={searchInputId}>Buscar por código o nombre</Label>
                <Input
                  id={searchInputId}
                  type="search"
                  placeholder="Buscar código o nombre…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  aria-label="Buscar curso por código o nombre"
                />
              </div>

              <div className="academic-preparation__cycle-filter">
                <Label className="sr-only" htmlFor={cycleSelectId}>Filtrar cursos por ciclo</Label>
                <NativeSelect
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
                </NativeSelect>
                {availableCycles.length === 0 && <span>El catálogo no especifica ciclos.</span>}
              </div>
            <div className="academic-preparation__actions-row">
              <Button
                variant="outline"
                type="button"
                disabled={isLocked || visibleCourses.length === 0}
                onClick={handleSelectVisible}
                aria-label="Seleccionar cursos visibles"
                className="gap-2 text-sm font-normal"
              >
                <CheckSquare className="size-3.5" aria-hidden="true" />
                <span>Seleccionar visibles</span>
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={isLocked || visibleCourses.every((c) => !selectedCourses.includes(c.courseId))}
                onClick={handleDeselectVisible}
                aria-label="Deseleccionar cursos visibles"
                className="gap-2 text-sm font-normal"
              >
                <Square className="size-3.5" aria-hidden="true" />
                <span>Quitar selección</span>
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={isLocked || selectedCourses.length === 0}
                onClick={handleOpenBulkModal}
                aria-haspopup="dialog"
                aria-label={`Edición en lote (${selectedCourses.length} cursos seleccionados)`}
                className="gap-2 text-sm font-normal"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                <span>Editar en lote ({selectedCourses.length})</span>
              </Button>
            </div>
          </div>
          <p className="academic-preparation__counters" role="status" aria-label="Contadores de preparación" title={catalog.revision}>
            <span><span data-testid="count-catalog">{counts.totalCatalog}</span> en catálogo · <span data-testid="count-included">{counts.totalIncluded}</span> incluidos · <span data-testid="count-visible">{counts.totalVisible}</span> visibles · máximo {PLANNING_LIMITS.courses}</span>
          </p>

          {/* Workbench: Table + Single Inspector */}
          <div className="academic-preparation__workbench">
            <ResizablePanelGroup orientation="vertical" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged} className="academic-preparation__split">
            <ResizablePanel id="planning-course-table" minSize="40%" className="academic-preparation__table-panel">
            {/* Table Pane */}
            <div className="academic-preparation__table-pane">
              <div
                className="academic-preparation__table-wrapper"
                role="region"
                aria-label="Tabla de cursos para planificación"
                tabIndex={0}
              >
                <Table stickyHeader containerClassName="academic-preparation__table-scroll" className="academic-preparation__table">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col" className="academic-preparation__th-select">
                        <span className="sr-only">Selección</span>
                      </TableHead>
                      <TableHead scope="col">Ciclo</TableHead>
                      <TableHead scope="col">Asignatura</TableHead>
                      <TableHead scope="col">Demanda final</TableHead>
                      <TableHead scope="col">Demanda base</TableHead>
                      <TableHead scope="col">Sec. sugeridas</TableHead>
                      <TableHead scope="col">Capacidad obj.</TableHead>
                      <TableHead scope="col">Sec. prev.</TableHead>

                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleCourses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="planning-sections__empty">
                          No hay cursos que coincidan con los filtros aplicados.
                        </TableCell>
                      </TableRow>
                    )}
                    {cycleGroups.map((group) => (
                      <Fragment key={String(group.cycle)}>
                        <TableRow className="academic-preparation__group-row">
                          <TableHead colSpan={8} scope="colgroup">
                            {group.label} · {group.courses.length}{' '}
                            {group.courses.length === 1 ? 'curso' : 'cursos'}
                          </TableHead>
                        </TableRow>
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
                            <TableRow
                              key={course.courseId}
                              data-course-id={course.courseId}
                              aria-selected={isInspected}
                              onClick={(event) => { if (!(event.target as HTMLElement).closest('button, input, label')) setInspectedCourseId(course.courseId) }}
                              data-state={isSelected ? 'selected' : undefined}
                              className={`academic-preparation__row ${
                                isInspected ? 'academic-preparation__row--inspected' : ''
                              } ${isSelected ? 'academic-preparation__row--selected' : ''}`}
                            >
                              <TableCell className="academic-preparation__td-select">
                                <Label htmlFor={`preparation-select-${course.courseId}`} className="academic-scheduling__selection">
                                  <Checkbox
                                    id={`preparation-select-${course.courseId}`}
                                    checked={isSelected}
                                    disabled={
                                      isLocked ||
                                      (!isSelected && selectedCourses.length >= PLANNING_LIMITS.courses)
                                    }
                                    aria-label={`Seleccionar ${course.courseId}`}
                                    onCheckedChange={(value) => {
                                      const checked = value === true
                                      onToggleCourse(course.courseId, checked)
                                      if (checked && !inspectedCourseId) {
                                        setInspectedCourseId(course.courseId)
                                      }
                                    }}
                                  />
                                </Label>
                              </TableCell>
                              <TableCell>{course.cycle !== undefined ? course.cycle : '—'}</TableCell>
                              <TableCell className="academic-preparation__td-course">
                                <div className="academic-preparation__course-cell">
                                  <Button type="button" variant="link" className="planning-table-name" aria-label={`Inspeccionar ${course.courseId}`} aria-expanded={isInspected} onClick={() => setInspectedCourseId(course.courseId)}>{course.name}</Button>
                                  <span className="academic-preparation__course-code">
                                    {course.courseId}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="academic-preparation__td-demand">
                                <Input
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
                              </TableCell>
                              <TableCell>{demandRow?.baseDemand ?? '—'}</TableCell>
                              <TableCell>{demandRow?.suggestedSections ?? '—'}</TableCell>
                              <TableCell className="academic-preparation__td-capacity">
                                <Input
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
                              </TableCell>
                              <TableCell>{computedSections}</TableCell>

                            </TableRow>
                          )
                        })}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            </ResizablePanel>
            {wideLayout && inspectedCourse && <>
              <ResizableHandle withHandle aria-label="Ajustar altura del detalle de curso" />
              <ResizablePanel id="planning-course-inspector" defaultSize="35%" minSize="20%" maxSize="60%" className="academic-preparation__detail-pane">
                {courseInspector}
              </ResizablePanel>
            </>}
            </ResizablePanelGroup>
            {!wideLayout && inspectedCourse && <Sheet open onOpenChange={(open) => { if (!open) setInspectedCourseId(null) }}>
              <SheetContent className="academic-preparation__course-sheet" showCloseButton={false} aria-describedby={undefined}>
                <SheetTitle className="sr-only">Detalle de curso {inspectedCourse.courseId}</SheetTitle>
                {courseInspector}
              </SheetContent>
            </Sheet>}

          </div>

          {/* Academic Demand Summary (2027-I) */}
          {planningPeriod === '2027-I' ? (
            <>
            <Button variant="ghost" type="button" className="planning-disclosure-trigger academic-demand__summary-trigger"
              aria-haspopup="dialog" aria-expanded={demandOpen} data-state={demandOpen ? 'open' : 'closed'} onClick={() => setDemandOpen(true)}>Resumen de demanda</Button>
            <Dialog open={demandOpen} onOpenChange={setDemandOpen}>
              <DialogContent className="academic-demand__dialog">
                <DialogTitle>Resumen de demanda potencial</DialogTitle>
                <DialogDescription className="sr-only">Fuente, estimación y desglose por curso seleccionado.</DialogDescription>
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
                  <Button variant="ghost"
                    type="button"
                    className="planning-inspector__close-btn"
                    aria-label="Cerrar ventana de edición en lote"
                    onClick={handleCloseBulkModal}
                  >
                    ✕ Cerrar
                  </Button>
                </div>

                <div className="academic-preparation__modal-body">
                  <div className="academic-preparation__bulk-inputs">
                    <div className="academic-preparation__bulk-input-group">
                      <Label htmlFor={`demand-${searchInputId}`} className="academic-preparation__bulk-checkbox">
                        <Checkbox
                          id={`demand-${searchInputId}`}
                          checked={bulkApplyDemand}
                          onCheckedChange={(checked) => {
                            setBulkApplyDemand(checked === true)
                            setBulkPreview(null)
                          }}
                        />
                        Modificar demanda final
                      </Label>
                      <Input
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
                      <Label htmlFor={`capacity-${searchInputId}`} className="academic-preparation__bulk-checkbox">
                        <Checkbox
                          id={`capacity-${searchInputId}`}
                          checked={bulkApplyCapacity}
                          onCheckedChange={(checked) => {
                            setBulkApplyCapacity(checked === true)
                            setBulkPreview(null)
                          }}
                        />
                        Modificar capacidad objetivo
                      </Label>
                      <Input
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
                    <Button variant="outline"
                      type="button"
                      onClick={handleComputePreview}
                      disabled={!bulkApplyDemand && !bulkApplyCapacity}
                    >
                      Calcular vista previa
                    </Button>
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
                          <Badge variant="secondary" className="academic-preparation__preview-status--valid">
                            {bulkPreview.validCount}
                          </Badge>
                        </span>
                        <span className="academic-preparation__counter-item">
                          <strong>Excluidos:</strong>{' '}
                          <Badge variant={bulkPreview.excludedCount > 0 ? 'destructive' : 'secondary'}
                            className={
                              bulkPreview.excludedCount > 0
                                ? 'academic-preparation__preview-status--excluded'
                                : ''
                            }
                          >
                            {bulkPreview.excludedCount}
                          </Badge>
                        </span>
                      </div>

                      <div className="academic-preparation__preview-table-wrapper">
                        <Table stickyHeader className="academic-preparation__preview-table">
                          <TableHeader>
                            <TableRow>
                              <TableHead scope="col">Código</TableHead>
                              <TableHead scope="col">Asignatura</TableHead>
                              {bulkPreview.applyDemand && <TableHead scope="col">Demanda (ant → nueva)</TableHead>}
                              {bulkPreview.applyCapacity && <TableHead scope="col">Capacidad (ant → nueva)</TableHead>}
                              <TableHead scope="col">Estado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bulkPreview.items.map((item) => (
                              <TableRow key={item.courseId}>
                                <TableCell>
                                  <code>{item.courseId}</code>
                                </TableCell>
                                <TableCell>{item.courseName}</TableCell>
                                {bulkPreview.applyDemand && (
                                  <TableCell>
                                    {item.previousDemand || '—'} →{' '}
                                    <strong>{item.newDemand ?? 'Inválido'}</strong>
                                  </TableCell>
                                )}
                                {bulkPreview.applyCapacity && (
                                  <TableCell>
                                    {item.previousCapacity || '—'} →{' '}
                                    <strong>{item.newCapacity ?? 'Inválido'}</strong>
                                  </TableCell>
                                )}
                                <TableCell>
                                  {item.valid ? (
                                    <Badge variant="secondary" className="academic-preparation__preview-status--valid">
                                      Válido
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive"
                                      className="academic-preparation__preview-status--excluded"
                                      role="alert"
                                    >
                                      Excluido: {item.exclusionReason}
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="academic-preparation__modal-footer">
                  <Button variant="outline"
                    type="button"
                    onClick={handleCloseBulkModal}
                  >
                    Cancelar
                  </Button>
                  <Button variant="outline"
                    type="button"
                    disabled={!bulkPreview || bulkPreview.validCount === 0}
                    onClick={handleConfirmBulk}
                  >
                    Confirmar cambios en lote
                  </Button>
                </div>
              </DialogContent>
          </Dialog>
        </div>
      )}
    </section>
  )
}

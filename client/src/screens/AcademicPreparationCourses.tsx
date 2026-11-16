import { PlanningFetchLoading } from '../components/PlanningFetchLoading'
import { Badge } from '../components/ui/Badge'
import { Checkbox } from '../components/ui/Checkbox'
import { Button, buttonVariants } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Label } from '../components/ui/Label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table'
import { useId, useMemo, useState } from 'react'
import type { AcademicCatalog, AcademicDemandEstimate, AcademicProposal, PlanningPeriod } from '../data/academicScheduling.ts'
import { calculatePresentedSections, formatAcademicInterval, PLANNING_LIMITS } from '../data/academicScheduling.ts'
import {
  applyBulkChanges,
  buildBulkChangePreview,
  calculatePreparationCounts,
  deselectVisibleCourses,
  filterPreparationCourses,
  selectVisibleCourses,
} from '../data/academicPreparation.ts'
import type { BulkChangePreview } from '../data/academicPreparation.ts'
import { AcademicDemandPanel } from './AcademicDemandPanel.tsx'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/Dialog'
import { RotateCcw } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '../components/ui/Sheet'
import { useMediaQuery } from '../lib/useMediaQuery'
import './AcademicPreparationCourses.css'

export interface AcademicPreparationCoursesProps {
  resources?: Pick<AcademicCatalog, 'teachers' | 'rooms'>
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
  resources,
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

  const sessionsFor = (course: AcademicCatalog['courses'][number]) =>
    course.planningPatterns?.find((pattern) => pattern.id === patterns[course.courseId])?.weeklySessions ?? course.weeklySessions
  const hoursFor = (course: AcademicCatalog['courses'][number]) => {
    const sessions = sessionsFor(course)
    if (sessions.some((session) => !session.type)) return ['—', '—', '—']
    return ['teor', 'pr', 'lab'].map((type) => sessions
      .filter((session) => session.type?.toLowerCase().startsWith(type))
      .reduce((sum, session) => sum + session.durationMinutes / 60, 0))
  }
  const demandValue = inspectedCourse ? demands[inspectedCourse.courseId] ?? '' : ''
  const capacityValue = inspectedCourse ? capacities[inspectedCourse.courseId] ?? '' : ''
  const invalidDemand = demandValue.trim() === '' || !Number.isSafeInteger(Number(demandValue)) || Number(demandValue) < 0
  const invalidCapacity = capacityValue.trim() === '' || !Number.isSafeInteger(Number(capacityValue)) || Number(capacityValue) <= 0
  const estimateRow = demandEstimate?.rows.find((row) => row.courseId === inspectedCourseId)

  const courseInspector = inspectedCourse && (
    <aside
      className="planning-inspector planning-inspector--docked academic-preparation__inspector"
      aria-label={`Inspector de curso ${inspectedCourse.courseId}`}
    >
      <div className="academic-preparation__detail-heading">
        <div>
          <p className="planning-eyebrow">{inspectedCourse.courseId} · ciclo {inspectedCourse.cycle ?? '—'}</p>
          <h2>{inspectedCourse.name}</h2>
        </div>
        <Button variant="ghost" type="button" aria-label="Cerrar detalle" onClick={() => setInspectedCourseId(null)}>×</Button>
      </div>
      <dl className="academic-preparation__detail-facts">
        <dt>Elegibles potenciales</dt><dd>{estimateRow?.eligible ?? '—'}</dd>
        <dt>Intención registrada</dt><dd>—</dd>
        <dt><Label htmlFor="planning-course-demand">Demanda de planificación</Label></dt>
        <dd><Input id="planning-course-demand" type="number" min="0" step="1" inputMode="numeric" placeholder="Definir"
          aria-label={`Demanda final ${inspectedCourse.courseId}`} aria-invalid={invalidDemand}
          aria-describedby="planning-course-demand-help" value={demandValue}
          disabled={isLocked || !selectedCourses.includes(inspectedCourse.courseId)}
          onChange={(event) => onUpdateDemand(inspectedCourse.courseId, event.currentTarget.value)} /></dd>
      </dl>
      <p id="planning-course-demand-help" className="academic-preparation__detail-help" data-warning={invalidDemand}>
        {invalidDemand ? 'Define la demanda de planificación. ' : ''}Los elegibles y la intención son referencia, no se suman.
      </p>
      <dl className="academic-preparation__detail-facts academic-preparation__detail-components">
        <dt>Secciones</dt><dd>{calculatePresentedSections(demandValue, capacityValue) ?? '—'} × {capacityValue || '—'} vacantes</dd>
        <dt>Componentes</dt><dd>{sessionsFor(inspectedCourse).map((session) => `${session.type ?? 'Sesión'} ${session.durationMinutes / 60} h`).join(' · ')}</dd>
        <dt>Docentes habilitados</dt><dd>{(resources ?? catalog)?.teachers.filter((teacher) => teacher.courseIds.includes(inspectedCourse.courseId)).length ?? '—'}</dd>
      </dl>
      <Button variant="outline" type="button" className="academic-preparation__estimate" disabled={planningPeriod !== '2027-I'} onClick={() => setDemandOpen(true)}>Estimar demanda</Button>
      <details className="academic-preparation__inspector-body"><summary>Configuración del curso</summary>
        {!selectedCourses.includes(inspectedCourse.courseId) && <p className="academic-preparation__detail-help" role="note">Curso no incluido en la propuesta. Marca su casilla para habilitar sus opciones de configuración.</p>}
        <Label>Vacantes por sección
          <Input type="number" min="1" step="1" inputMode="numeric" value={capacityValue}
            aria-label={`Capacidad ${inspectedCourse.courseId}`} aria-invalid={invalidCapacity}
            disabled={isLocked || !selectedCourses.includes(inspectedCourse.courseId)}
            onChange={(event) => onUpdateCapacity(inspectedCourse.courseId, event.currentTarget.value)} />
        </Label>
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
      </details>
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

      {catalog && selectedCourses.length > 0 && (
        <div className="academic-preparation">
          <details className="academic-preparation__settings">
            <summary>Filtros y valores iniciales</summary>
            <div className="academic-preparation__settings-body">
              <Input type="search" placeholder="Buscar curso" aria-label="Buscar curso por código o nombre" value={searchQuery} onChange={(event) => setSearchQuery(event.currentTarget.value)} />
              <span>{visibleCourses.length} cursos visibles · {selectedCourses.length} seleccionados</span>
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
            </div>
          </details>
          {selectedCourses.length > 0 ? <div className="academic-preparation__bulk-bar" role="toolbar" aria-label="Acciones en lote">
            <span>{selectedCourses.length} cursos seleccionados</span>
            <Button variant="outline" disabled={planningPeriod !== '2027-I'} onClick={() => setDemandOpen(true)}>Estimar demanda</Button>
            <Button variant="outline" disabled={isLocked} onClick={handleOpenBulkModal} aria-haspopup="dialog">Editar en lote</Button>
            <Button variant="outline" disabled={isLocked || visibleCourses.length === 0} onClick={handleSelectVisible}>Seleccionar visibles</Button>
            <Button variant="outline" disabled={isLocked} onClick={handleDeselectVisible}>Quitar selección</Button>
          </div> : <div className="academic-preparation__toolbar">
            <Label className="sr-only" htmlFor={searchInputId}>Buscar curso por código o nombre</Label>
            <Input id={searchInputId} type="search" placeholder="Buscar curso" value={searchQuery} onChange={(event) => setSearchQuery(event.currentTarget.value)} />
            <span>{counts.totalIncluded} cursos seleccionados</span>
          </div>}
          <div className="sr-only" role="status" aria-label="Contadores de preparación">
            <span data-testid="count-catalog">{counts.totalCatalog}</span> en catálogo · <span data-testid="count-included">{counts.totalIncluded}</span> incluidos · <span data-testid="count-visible">{counts.totalVisible}</span> visibles · máximo {PLANNING_LIMITS.courses}
          </div>
          <div className="academic-preparation__workbench">
            <div className="academic-preparation__table-wrapper" role="region" aria-label="Tabla de cursos para planificación" tabIndex={0}>
              <Table stickyHeader containerClassName="academic-preparation__table-scroll" className="academic-preparation__table" aria-label="Cursos de la oferta">
                <TableHeader><TableRow>
                  <TableHead><Checkbox aria-label="Seleccionar cursos visibles" disabled={isLocked || !visibleCourses.length} checked={visibleCourses.length > 0 && visibleCourses.every((course) => selectedCourses.includes(course.courseId))} onCheckedChange={(checked) => checked === true ? handleSelectVisible() : handleDeselectVisible()} /></TableHead>
                  <TableHead>Curso</TableHead><TableHead>Ciclo</TableHead><TableHead>Demanda</TableHead><TableHead>Secc.</TableHead><TableHead>Vac./secc.</TableHead><TableHead>Horas T · P · L</TableHead><TableHead>Datos</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {!visibleCourses.length && <TableRow><TableCell colSpan={8}>No hay cursos que coincidan con los filtros aplicados.</TableCell></TableRow>}
                  {visibleCourses.map((course) => {
                    const selected = selectedCourses.includes(course.courseId)
                    const inspected = course.courseId === inspectedCourseId
                    const demand = demands[course.courseId] ?? ''
                    const capacity = capacities[course.courseId] ?? ''
                    const sections = calculatePresentedSections(demand, capacity)
                    const status = demand.trim() === '' ? '△ Demanda sin definir' : sections === null ? '△ Datos por corregir' : '✓ Completo'
                    return <TableRow key={course.courseId} data-course-id={course.courseId} aria-selected={inspected} data-state={selected ? 'selected' : undefined}
                      className={`academic-preparation__row ${inspected ? 'academic-preparation__row--inspected' : ''}`}
                      onClick={(event) => { if (!(event.target as HTMLElement).closest('button, input, label')) setInspectedCourseId(course.courseId) }}>
                      <TableCell><Checkbox aria-label={`Seleccionar ${course.courseId}`} checked={selected} disabled={isLocked || (!selected && selectedCourses.length >= PLANNING_LIMITS.courses)} onCheckedChange={(checked) => { onToggleCourse(course.courseId, checked === true); if (checked) setInspectedCourseId(course.courseId) }} /></TableCell>
                      <TableCell><div className="academic-preparation__course-cell"><code>{course.courseId}</code><Button variant="link" className="planning-table-name" aria-label={`Inspeccionar ${course.courseId}`} aria-expanded={inspected} onClick={() => setInspectedCourseId(course.courseId)}>{course.name}</Button></div></TableCell>
                      <TableCell>{course.cycle ?? '—'}</TableCell><TableCell>{demand || '—'}</TableCell><TableCell>{proposal?.status === 'invalid-input' ? 'Entrada inválida' : sections ?? '—'}</TableCell><TableCell>{capacity || '—'}</TableCell>
                      <TableCell>{hoursFor(course).join(' · ')}</TableCell><TableCell><span className="academic-preparation__data-status" data-ready={sections !== null}>{status}</span></TableCell>
                    </TableRow>
                  })}
                </TableBody>
              </Table>
            </div>
            {wideLayout && courseInspector}
            {!wideLayout && inspectedCourse && <Sheet open onOpenChange={(open) => { if (!open) setInspectedCourseId(null) }}>
              <SheetContent side="bottom" className="academic-preparation__course-sheet" showCloseButton={false} aria-describedby={undefined}>
                <SheetTitle className="sr-only">Detalle de curso {inspectedCourse.courseId}</SheetTitle>{courseInspector}
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

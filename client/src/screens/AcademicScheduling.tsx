import { Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatAcademicInterval } from '../data/academicScheduling'
import type { PlanningPeriod } from '../data/academicScheduling'
import type { AcademicAdjustment, AcademicAllocationPolicy, AcademicDraftState, AcademicPlanningResources } from '../../../shared/programacion-academica-api.mjs'
import { usePlanningSession } from '../data/planningSession'
import type { PlanningPreparationView, PlanningBlock } from '../data/planningSession'
import { AcademicResourceEditor } from './AcademicResourceEditor'
import { AcademicPreparationCourses } from './AcademicPreparationCourses'
import { AcademicTeacherReview as AcademicTeacherReviewPanel } from './AcademicTeacherReview'
import { AcademicPublicationPanel } from './AcademicPublicationPanel'
import { AcademicIntentionDemandPanel } from './AcademicIntentionDemandPanel'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/Dialog'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Checkbox } from '../components/ui/Checkbox'
import { Label } from '../components/ui/Label'
import { Alert, AlertDescription } from '../components/ui/Alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/Collapsible'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { toast } from '../components/ui/Sonner'
import { Tour, TourPortal, TourSpotlight, TourSpotlightRing, TourStep, TourHeader, TourTitle,
  TourDescription, TourFooter, TourPrev, TourNext, TourSkip, TourStepCounter } from '../components/ui/Tour'
import { PlanningScopeHeader } from './PlanningScopeHeader'
import { PlanningPreparationSummary } from './PlanningPreparationSummary'
import { PlanningStageNav } from './PlanningStageNav'
import { PlanningStatusBar } from './PlanningStatusBar'
import { PlanningSectionsTable } from './PlanningSectionsTable'
import { PlanningInspector } from './PlanningInspector'
import { PlanningWeekView } from './PlanningWeekView'
import type { PlanningStage } from '../routes/local.programacion-academica'
import './AcademicScheduling.css'
import './PlanningWorkbench.css'
import './PlanningSections.css'

export function AcademicScheduling({ currentStage = 'preparacion', preparationView = 'resumen', onPreparationViewChange }: {
  currentStage?: PlanningStage
  preparationView?: PlanningPreparationView
  onPreparationViewChange: (view: PlanningPreparationView) => void
}) {
  // Workflow state and rules live in the Sesión de programación (client/src/data/planningSession.ts).
  const { state, view, commands } = usePlanningSession()
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'tabla' | 'semana'>('tabla')
  const [searchQuery, setSearchQuery] = useState('')
  const [cycleFilter, setCycleFilter] = useState('all')
  const navigate = useNavigate()
  const [confirmElement, confirm] = useConfirm()
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const [draftListOpen, setDraftListOpen] = useState(false)
  const viewScrollPositions = useRef<{ tabla: number; semana: number }>({ tabla: 0, semana: 0 })

  const handleToggleView = useCallback((nextMode: 'tabla' | 'semana') => {
    if (nextMode === viewMode) return
    viewScrollPositions.current[viewMode] = window.scrollY
    setViewMode(nextMode)
  }, [viewMode])

  useLayoutEffect(() => {
    const targetY = viewScrollPositions.current[viewMode] ?? 0
    window.scrollTo({ top: targetY, behavior: 'instant' })
    const rafId = requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(rafId)
  }, [viewMode])

  const { catalog, proposal, proposalResources, editingBlock, demands, capacities, patterns, deliveryModes,
    selectedCourses, demandSourceId, demandEstimate, resources, allocationPolicy } = state
  const planningPeriod = state.period
  const planningPolicy = state.policy
  const draftTitle = state.draft.title
  const draftId = state.draft.id
  const draftVersion = state.draft.version
  const savedDraftState = state.draft.savedState
  const savedReview = state.draft.review
  const workspaceDirty = state.dirty
  const draftList = state.draftList
  const draftBusy = state.busy.draft
  const loadingCatalog = state.busy.catalog
  const generating = state.busy.generate
  const adjusting = state.busy.adjust
  const demandLoading = state.busy.demand
  const catalogError = state.errors.catalog
  const proposalError = state.errors.proposal
  const adjustmentError = state.errors.adjustment
  const demandError = state.errors.demand
  const draftError = state.errors.draft
  const reviewError = state.errors.review
  const draftMessage = state.message
  const lockedDraft = view.locked
  const validDemands = view.offerValid
  const canSave = view.canSave
  const disabledSaveReason = view.disabledSaveReason
  const preparationAction = view.primaryAction('preparacion')
  const scheduleAction = view.primaryAction('horario')
  const reviewAction = view.primaryAction('revision')
  const approvalAction = view.primaryAction('aprobacion')
  const primaryVariant = (active: boolean) => active ? 'default' as const : 'outline' as const

  useEffect(() => {
    if (!draftMessage) return
    toast.success(draftMessage)
    commands.edit({ type: 'setDraftMessage', message: null })
  }, [draftMessage, commands])

  const previousAction = useRef({ draftBusy, generating, draftError, proposalError })
  useEffect(() => {
    const previous = previousAction.current
    // Notify once on a failed request; the detailed blocking error stays inline.
    if ((previous.draftBusy && !draftBusy && draftError && draftError !== previous.draftError)
      || (previous.generating && !generating && proposalError && proposalError !== previous.proposalError)) {
      toast.error('La acción no se completó', { description: 'Revisa el aviso para continuar.' })
    }
    previousAction.current = { draftBusy, generating, draftError, proposalError }
  }, [draftBusy, generating, draftError, proposalError])

  const openGuide = async () => {
    // Every target is visible in the preparation summary, including the next valid action.
    await navigate({ to: '/local/programacion-academica', search: { etapa: 'preparacion', vista: 'resumen' } })
    setTourStep(0)
    setTourOpen(true)
  }

  const retryCatalog = () => void commands.loadCatalog()
  const refreshDraftList = () => commands.refreshDrafts()
  const saveDraft = () => commands.save()
  const estimateDemand = () => commands.estimateDemand()
  const generate = () => commands.generate()
  const submitBlockReview = () => commands.adjust()
  const approveDraft = () => commands.approve()
  const publishDraft = (expectedCurrentId: string | null) => commands.publish(expectedCurrentId)
  const submitTeacherReview = () => commands.submitReview()
  const respondTeacherReview = (teacherId: string, decision: 'conformity' | 'changes-requested', observation: string) =>
    commands.respondReview(teacherId, decision, observation)

  const resumeDraft = async (id: string, version: number) => {
    if (workspaceDirty && !(await confirm({ title: 'Descartar cambios', description: 'Hay cambios locales sin guardar. ¿Descartarlos y continuar con esta propuesta?', confirmLabel: 'Descartar cambios', destructive: true }))) return
    if (await commands.resume(id, version)) setDraftListOpen(false)
  }

  // The panels that offer a new draft confirm it (including discarding local changes) themselves.
  const forkDraft = async (id: string, version: number) => {
    if (await commands.fork(id, version)) setDraftListOpen(false)
  }

  const applyPeriodDefaults = async (period: PlanningPeriod, force = false) => {
    if (!catalog || (period === planningPeriod && !force)) return
    if (workspaceDirty && !(await confirm({ title: 'Descartar cambios', description: 'Aplicar valores iniciales para este periodo? Se reemplazarán las demandas y capacidades editadas.', confirmLabel: 'Descartar cambios', destructive: true }))) return
    commands.edit({ type: 'applyPeriodDefaults', period, force })
  }

  const markTitle = (title: string) => commands.edit({ type: 'setTitle', title })
  const markDraftState = (value: AcademicDraftState) => commands.edit({ type: 'setDraftState', state: value })
  const toggleCourse = (courseId: string, checked: boolean) => commands.edit({ type: 'toggleCourse', courseId, checked })
  const selectCourses = (courseIds: string[]) => commands.edit({ type: 'selectCourses', courseIds })
  const applyBulkChanges = (newDemands: Record<string, string>, newCapacities: Record<string, string>) =>
    commands.edit({ type: 'applyBulkChanges', demands: newDemands, capacities: newCapacities })
  const updateDemand = (courseId: string, value: string) => commands.edit({ type: 'updateDemand', courseId, value })
  const updateCapacity = (courseId: string, value: string) => commands.edit({ type: 'updateCapacity', courseId, value })
  const changeDemandSource = (value: 'existing-regular-v1' | 'independent-120-v1') => commands.edit({ type: 'changeDemandSource', value })
  const updatePattern = (courseId: string, value: string) => commands.edit({ type: 'updatePattern', courseId, value })
  const updateDeliveryMode = (courseId: string, value: 'continuous' | 'split') => commands.edit({ type: 'updateDeliveryMode', courseId, value })
  const updateResources = (value: AcademicPlanningResources) => commands.edit({ type: 'updateResources', value })
  const updateAllocationPolicy = (value: AcademicAllocationPolicy) => commands.edit({ type: 'updateAllocationPolicy', value })
  const updatePlanningException = (key: 'allowAfternoon' | 'allowSaturday', checked: boolean) =>
    commands.edit({ type: 'updatePlanningException', key, checked })
  const setEditingBlock = (adjustment: AcademicAdjustment) => commands.edit({ type: 'changeEditingBlock', adjustment })
  const cancelBlockReview = () => commands.edit({ type: 'cancelBlockReview' })
  const startBlockReview = (block: PlanningBlock) => {
    if (!proposal || lockedDraft || draftBusy) return
    setSelectedSectionId(block.sectionId)
    commands.edit({ type: 'startBlockReview', block })
  }

  return <section className="screen-academic-scheduling">
    {confirmElement}
    <PlanningScopeHeader
      onGuide={() => void openGuide()}
      school="Sistemas"
      period={planningPeriod}
      draftVersion={draftVersion}
      draftId={draftId}
      savedDraftState={savedDraftState}
      workspaceDirty={workspaceDirty}
      canSave={canSave}
      draftBusy={draftBusy}
      onSave={() => void saveDraft()}
      disabledReason={disabledSaveReason}
    />

    <PlanningStageNav currentStage={currentStage} />
    {draftError && !draftListOpen && <Alert variant="destructive" role="alert"><AlertDescription>{draftError}</AlertDescription></Alert>}
    {currentStage === 'preparacion' && <nav id="planning-tour-preparation" className="planning-preparation-views" aria-label="Vistas de preparación">
      {(['resumen', 'cursos', 'recursos'] as const).map((vista) => <Link key={vista}
        to="/local/programacion-academica" search={{ etapa: 'preparacion', vista }}
        aria-current={preparationView === vista ? 'page' : undefined}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          onPreparationViewChange(vista)
        }}>{vista === 'resumen' ? 'Resumen' : vista === 'cursos' ? 'Cursos' : 'Recursos'}</Link>)}
    </nav>}

    {/* Stage 1: Preparación */}
    <section
      className="planning-stage-panel planning-stage-panel--preparacion"
      hidden={currentStage !== 'preparacion'}
      aria-label="Etapa de preparación"
    >
      <section className="academic-scheduling__draft-bar" aria-label="Propuestas locales">
        <div className="academic-scheduling__draft-heading">
          <div className="academic-scheduling__draft-field"><Label htmlFor="planning-proposal-title">Propuesta</Label>
            <Input id="planning-proposal-title" aria-label="Nombre de la propuesta" maxLength={100} value={draftTitle} disabled={lockedDraft || draftBusy}
              onChange={(event) => markTitle(event.currentTarget.value)} />
          </div>
          <div className="academic-scheduling__draft-field"><Label htmlFor="planning-proposal-state">Estado</Label>
            <NativeSelect id="planning-proposal-state" aria-label="Estado de la propuesta" disabled={lockedDraft || draftBusy} value={view.displayedDraftState}
              onChange={(event) => markDraftState(event.currentTarget.value as AcademicDraftState)}>
              <option value="draft">Borrador</option>
              <option value="ready-for-review" disabled={!proposal || proposal.status !== 'complete' || !proposal.coverageComplete || proposal.assignments.length === 0}>Lista para revisión</option>
              <option value="in-review" disabled>En revisión docente</option>
              <option value="ready-for-approval" disabled>Lista para aprobación</option>
              {savedDraftState === 'approved' && <option value="approved" disabled>Aprobada (simulada)</option>}
              {savedDraftState === 'published' && <option value="published" disabled>Publicada (simulada)</option>}
            </NativeSelect>
          </div>
          <div className="academic-scheduling__draft-actions">
            <Button type="button" variant="outline"
              id="planning-tour-proposals" aria-haspopup="dialog"
              onClick={() => {
                setDraftListOpen(true)
                void refreshDraftList()
              }}>Mis propuestas</Button>
          </div>
        </div>
        <Dialog open={draftListOpen} onOpenChange={setDraftListOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Mis propuestas</DialogTitle>
              <DialogDescription>Almacenamiento local compartido; no está asociado a una cuenta.</DialogDescription>
            </DialogHeader>
            {draftError && <Alert variant="destructive" role="alert"><AlertDescription>{draftError}</AlertDescription></Alert>}
            <div id="academic-scheduling-saved-proposals" className="academic-scheduling__saved-proposals">
              {draftList?.unavailableCount ? <p role="status">{draftList.unavailableCount} propuesta(s) no se pudieron leer.</p> : null}
              {draftList?.items.length === 0 && <p>No hay propuestas guardadas.</p>}
              <ul className="academic-scheduling__saved-list">{draftList && draftList.items.map((item) => <li className="academic-scheduling__saved-row" key={item.id}>
                <strong>{item.title} · {item.schoolId} · {item.academicPeriod} · {item.state === 'draft' ? 'Borrador' : item.state === 'ready-for-review' ? 'Lista para revisión' : item.state === 'in-review' ? 'En revisión docente' : item.state === 'ready-for-approval' ? 'Lista para aprobación' : item.state === 'approved' ? 'Aprobada (simulada)' : 'Publicada (simulada)'} · v{item.version}</strong>
                <div><span>Actualizada {new Date(item.updatedAt).toLocaleString('es-PE')} · {item.hasSchedule ? 'Con horario' : 'Solo configuración'}</span>
                  <Button type="button" variant="outline"
                    disabled={draftBusy} onClick={() => void resumeDraft(item.id, item.version)}>{item.state === 'approved' || item.state === 'published' ? 'Consultar' : 'Continuar edición'}</Button></div>
              </li>)}</ul>
            </div>
          </DialogContent>
        </Dialog>
      </section>

      <div className="planning-preparation-view" hidden={preparationView !== 'cursos'}>
        <fieldset className="academic-scheduling__locked-workspace" disabled={lockedDraft || draftBusy}>
          <AcademicPreparationCourses
            catalog={catalog}
            loadingCatalog={loadingCatalog}
            catalogError={catalogError}
            onRetryCatalog={retryCatalog}
            planningPeriod={planningPeriod}
            onApplyPeriodDefaults={applyPeriodDefaults}
            cycleFilter={cycleFilter}
            onCycleFilterChange={setCycleFilter}
            selectedCourses={selectedCourses}
            onToggleCourse={toggleCourse}
            onSelectCourses={selectCourses}
            demands={demands}
            capacities={capacities}
            patterns={patterns}
            deliveryModes={deliveryModes}
            onUpdateDemand={updateDemand}
            onUpdateCapacity={updateCapacity}
            onUpdatePattern={updatePattern}
            onUpdateDeliveryMode={updateDeliveryMode}
            onApplyBulkChanges={applyBulkChanges}
            proposal={proposal}
            isLocked={lockedDraft || draftBusy}
            demandSourceId={demandSourceId}
            onChangeDemandSource={changeDemandSource}
            demandEstimate={demandEstimate}
            demandLoading={demandLoading}
            demandError={demandError}
            onEstimateDemand={() => void estimateDemand()}
            onUseBaseDemand={(courseId, value) => updateDemand(courseId, String(value))}
          />
        </fieldset>

      </div>
      <div className="planning-preparation-view" hidden={preparationView !== 'recursos'}>
        {catalog && <section className="academic-scheduling__section" aria-labelledby="academic-scheduling-resource-editor">
          <div className="academic-scheduling__step-heading"><h3 id="academic-scheduling-resource-editor" aria-label="Paso 2 · Configurar recursos">Configurar recursos</h3>
            <p>Los nombres de referencia provienen del escenario sintético y no confirman asignaciones del nuevo periodo.</p></div>
          <AcademicResourceEditor
            catalog={catalog}
            resources={resources}
            onChange={updateResources}
            isLocked={lockedDraft || draftBusy}
            proposal={proposal}
          />
          <Collapsible className="academic-scheduling__general-windows">
            <CollapsibleTrigger asChild><Button type="button" variant="ghost">Franjas generales del catálogo</Button></CollapsibleTrigger>
            <CollapsibleContent>
            <span>La disponibilidad de cada recurso se intersecta con estas franjas; no se deduce del historial.</span>
            <ul>{catalog.windows.map((window, index) => <li key={index}>{formatAcademicInterval(window)}</li>)}</ul>
            </CollapsibleContent>
          </Collapsible>
        </section>}

      </div>
      <div className="planning-preparation-view" hidden={preparationView !== 'resumen'}>
        <PlanningPreparationSummary selectedCourses={selectedCourses.length} invalidCourses={view.invalidCourses.length}
          teachers={resources.teachers.length} rooms={resources.rooms.length} offerReady={preparationAction?.id === 'generate'}>
          <div className="academic-scheduling__locked-workspace">
            {catalog && <section className="academic-scheduling__section academic-scheduling__generate" aria-labelledby="academic-scheduling-generate">
              <h3 id="academic-scheduling-generate" aria-label="Paso 3 · Generar propuesta">Generar propuesta</h3>
              <p>Periodo: {planningPeriod}. Se envían todos los cursos seleccionados, incluidos los que estén ocultos por el filtro de ciclo.</p>
              <Collapsible className="academic-scheduling__advanced">
                <CollapsibleTrigger asChild><Button type="button" variant="ghost">Opciones avanzadas</Button></CollapsibleTrigger>
                <CollapsibleContent>
                  <fieldset className="academic-scheduling__policy">
                    <legend>Excepciones de horario · decisión local explícita</legend>
                    <div className="academic-scheduling__exception"><Checkbox id="planning-allow-afternoon" disabled={lockedDraft || draftBusy} checked={planningPolicy?.allowAfternoon ?? false}
                      onCheckedChange={(checked) => updatePlanningException('allowAfternoon', checked === true)} /><Label htmlFor="planning-allow-afternoon">Permitir propuesta de lunes a viernes desde las 14:00 hasta las 22:00</Label></div>
                    <div className="academic-scheduling__exception"><Checkbox id="planning-allow-saturday" disabled={lockedDraft || draftBusy} checked={planningPolicy?.allowSaturday ?? false}
                      onCheckedChange={(checked) => updatePlanningException('allowSaturday', checked === true)} /><Label htmlFor="planning-allow-saturday">Permitir propuesta sábado de 08:00 a 13:00</Label></div>
                    <p>La disponibilidad docente y de ambientes sigue siendo obligatoria. Habilitar sábado no agrega disponibilidad automáticamente.</p>
                  </fieldset>
                  <div className="academic-scheduling__policy"><Label htmlFor="planning-allocation-policy">Criterio para ordenar alternativas</Label>
                    <NativeSelect disabled={lockedDraft || draftBusy} id="planning-allocation-policy" aria-label="Criterio de asignación" value={allocationPolicy} onChange={(event) => updateAllocationPolicy(event.currentTarget.value as AcademicAllocationPolicy)}>
                      <option value="preferences">Preferencias (predeterminado)</option>
                      <option value="balanced">Preferencias y menor concentración en empates</option>
                      <option value="first-feasible">Primera alternativa factible</option>
                    </NativeSelect>
                  </div>
                  <p className="academic-scheduling__resource-note">
                    {allocationPolicy === 'preferences' && 'Ordena primero bloques dentro de preferencias; luego docentes sin preferencias y deja alternativas fuera como respaldo.'}
                    {allocationPolicy === 'balanced' && 'Aplica la prioridad de preferencias y, en empates, prioriza menor concentración (secciones asignadas y luego minutos); no impone equidad global.'}
                    {allocationPolicy === 'first-feasible' && 'Conserva el orden determinista y no prioriza preferencias.'}
                  </p>
                </CollapsibleContent>
              </Collapsible>
              <div id={preparationAction?.id === 'generate' ? 'planning-tour-primary' : undefined} className="academic-scheduling__actions">
                <Button type="button" variant={primaryVariant(preparationAction?.id === 'generate')} disabled={!validDemands || generating || lockedDraft || draftBusy}
                  onClick={() => void generate()}>{generating ? 'Generando…' : 'Generar horarios'}</Button>
                {!validDemands && <span>Ingresa demanda válida y capacidad entera positiva para cada curso seleccionado. Sin selección se genera una propuesta vacía.</span>}
              </div>
            </section>}
            {proposalError && <Alert variant="destructive" role="alert"><AlertDescription>{proposalError}</AlertDescription></Alert>}
          </div>
          {preparationAction?.id === 'review-offer' && <Button id="planning-tour-primary" type="button" variant="default"
            onClick={() => onPreparationViewChange('cursos')}>{preparationAction.label}</Button>}
        </PlanningPreparationSummary>
      </div>
    </section>

    {/* Stage 2: Horario */}
    <section
      className="planning-stage-panel planning-stage-panel--horario"
      hidden={currentStage !== 'horario'}
      aria-label="Etapa de horario"
    >
      <div className="planning-stage-actions">
        {scheduleAction?.id === 'back-preparation' && <Button asChild><Link to="/local/programacion-academica" search={{ etapa: 'preparacion' }}>{scheduleAction.label}</Link></Button>}
        {scheduleAction?.id === 'save' && <Button type="button" variant="default"
          disabled={!canSave || draftBusy} onClick={() => void saveDraft()}>{scheduleAction.label}</Button>}
        {scheduleAction?.id === 'submit-review' && <Button type="button" variant="default"
          disabled={lockedDraft || draftBusy} onClick={() => void submitTeacherReview()}>{scheduleAction.label}</Button>}
      </div>
      <fieldset className="academic-scheduling__locked-workspace" disabled={draftBusy}>
        {proposalError && <Alert variant="destructive" role="alert"><AlertDescription>{proposalError}</AlertDescription></Alert>}
        {!proposal && (
          <div className="academic-scheduling__empty-stage">
            <p>No hay una propuesta generada. Ve a la etapa de <strong>Preparación</strong> y selecciona <strong>Generar horarios</strong>.</p>
          </div>
        )}
        {proposal && <>
          <PlanningStatusBar
            proposal={proposal}
            primaryActionId={scheduleAction?.id}
            isDraft={!lockedDraft}
            onRegenerate={() => void generate()}
            onReviewPending={() => {
              const sectionId = proposal.pending[0]?.sectionId
                ?? proposal.sections.find((section) => !proposal.assignments.some((assignment) => assignment.sectionId === section.sectionId))?.sectionId
              if (sectionId) setSelectedSectionId(sectionId)
            }}
            isLocked={lockedDraft || draftBusy}
          />

          <div className="planning-workbench-container">
            <div className="planning-workbench-main">
              <div
                className="planning-view-pane planning-view-pane--tabla"
                style={{
                  display: viewMode === 'tabla' ? 'flex' : 'none',
                  flexDirection: 'column',
                  gap: 'calc(var(--planning-spacing) * 4)',
                }}
              >
                <PlanningSectionsTable
                  proposal={proposal}
                  catalog={catalog}
                  demands={demands}
                  selectedSectionId={selectedSectionId}
                  onSelectSection={setSelectedSectionId}
                  onEditBlock={startBlockReview}
                  isLocked={lockedDraft || draftBusy}
                  viewMode={viewMode}
                  onToggleView={handleToggleView}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />

              </div>

              <div
                className="planning-view-pane planning-view-pane--semana"
                style={{ display: viewMode === 'semana' ? 'block' : 'none' }}
              >
                <PlanningWeekView
                  proposal={proposal}
                  catalog={catalog}
                  proposalResources={proposalResources}
                  selectedSectionId={selectedSectionId}
                  editingBlock={editingBlock}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  viewMode={viewMode}
                  onToggleView={handleToggleView}
                  onSelectSection={setSelectedSectionId}
                  onStartEditBlock={startBlockReview}
                  onChangeEditingBlock={setEditingBlock}
                  isLocked={lockedDraft || draftBusy}
                />
              </div>
            </div>

            {selectedSectionId && (
              <PlanningInspector
                sectionId={selectedSectionId}
                proposal={proposal}
                proposalResources={proposalResources}
                catalog={catalog}
                editingBlock={editingBlock}
                adjusting={adjusting}
                adjustmentError={adjustmentError}
                isLocked={lockedDraft || draftBusy}
                onClose={() => {
                  setSelectedSectionId(null)
                  cancelBlockReview()
                }}
                onStartEdit={startBlockReview}
                onCancelEdit={cancelBlockReview}
                onSubmitEdit={submitBlockReview}
                onChangeEditingBlock={setEditingBlock}
              />
            )}
          </div>
        </>}
      </fieldset>
    </section>

    {/* Stage 3: Revisión docente */}
    <section
      className="planning-stage-panel planning-stage-panel--revision"
      hidden={currentStage !== 'revision'}
      aria-label="Etapa de revisión docente"
    >
      <div className="planning-stage-actions">
        {reviewAction?.id === 'back-schedule' && <Button asChild><Link to="/local/programacion-academica" search={{ etapa: 'horario' }}>{reviewAction.label}</Link></Button>}
        {reviewAction?.id === 'to-approval' && <Button asChild><Link to="/local/programacion-academica" search={{ etapa: 'aprobacion' }}>{reviewAction.label}</Link></Button>}
      </div>
      <fieldset className="academic-scheduling__locked-workspace" disabled={lockedDraft || draftBusy}>
        <AcademicTeacherReviewPanel primaryActionId={reviewAction?.id} key={`${draftId ?? 'new'}-${savedReview?.round ?? 0}`} review={savedReview} proposal={proposal} draftId={draftId} draftVersion={draftVersion}
          derivedState={workspaceDirty ? `${savedDraftState === 'ready-for-approval' ? 'La versión guardada está lista para aprobación' : savedDraftState === 'in-review' ? 'La versión guardada está en revisión docente' : savedDraftState === 'ready-for-review' ? 'La versión guardada está lista para revisión' : savedDraftState === 'approved' ? 'La versión guardada está aprobada (simulada)' : savedDraftState === 'published' ? 'La versión guardada está publicada (simulada)' : 'Borrador'}; cambios locales sin guardar` : savedDraftState === 'ready-for-approval' ? 'Lista para aprobación' : savedDraftState === 'in-review' ? 'En revisión docente' : savedDraftState === 'ready-for-review' ? 'Lista para revisión' : savedDraftState === 'approved' ? 'Aprobada (simulada)' : savedDraftState === 'published' ? 'Publicada (simulada)' : 'Borrador'}
          dirty={workspaceDirty} busy={draftBusy} error={reviewError} onSubmit={() => void submitTeacherReview()}
          onRespond={(teacherId, decision, observation) => void respondTeacherReview(teacherId, decision, observation)} />
      </fieldset>
      {lockedDraft && <p className="academic-scheduling__draft-note" role="status">
        {savedDraftState === 'approved' ? 'Aprobada (simulada).' : 'Publicada (simulada).'} Versión congelada de solo lectura; el horario y las respuestas de revisión no se pueden guardar en este documento.
      </p>}
    </section>

    {/* Stage 4: Aprobación */}
    <section
      className="planning-stage-panel planning-stage-panel--aprobacion"
      hidden={currentStage !== 'aprobacion'}
      aria-label="Etapa de aprobación"
    >
      <div className="planning-stage-actions">
        {approvalAction?.id === 'back-review' && <Button asChild><Link to="/local/programacion-academica" search={{ etapa: 'revision' }}>{approvalAction.label}</Link></Button>}
      </div>
      <AcademicPublicationPanel primaryActionId={approvalAction?.id} draftId={draftId} draftVersion={draftVersion} draftTitle={draftTitle}
        draftState={savedDraftState} dirty={workspaceDirty} busy={draftBusy || generating || adjusting || demandLoading} onApprove={approveDraft}
        onPublish={publishDraft} onFork={forkDraft}
        onError={(message) => commands.edit({ type: 'setDraftError', message })}
        onMessage={(message) => commands.edit({ type: 'setDraftMessage', message })} />
      <AcademicIntentionDemandPanel dirty={workspaceDirty} busy={draftBusy || generating || adjusting || demandLoading}
        onFork={(id, version) => void forkDraft(id, version)} potential={demandEstimate}
        finalDemand={Object.fromEntries(selectedCourses.map((courseId) => [courseId, demands[courseId] ?? '']))} />
    </section>
    <Tour open={tourOpen} onOpenChange={setTourOpen} value={tourStep} onValueChange={setTourStep}
      onCloseAutoFocus={(event) => { event.preventDefault(); document.getElementById('planning-tour-guide')?.focus() }}>
      <TourPortal>
        <TourSpotlight />
        <TourSpotlightRing />
        {[
          ['stages', 'Etapas', 'Avanza de la preparación a la publicación desde estas etapas.'],
          ['preparation', 'Preparación', 'Revisa el resumen, los cursos y los recursos antes de generar.'],
          ['save', 'Guardar', 'Guarda explícitamente la versión que quieres conservar.'],
          ['primary', 'Siguiente acción', 'Esta acción indica el siguiente paso según el estado de la propuesta.'],
          ['proposals', 'Mis propuestas', 'Continúa una edición guardada o consulta una versión congelada.'],
        ].map(([target, title, description], index) => <TourStep key={target} target={`#planning-tour-${target}`} role="dialog" aria-labelledby={`planning-guide-title-${target}`}>
          <TourHeader><TourTitle id={`planning-guide-title-${target}`}>{title}</TourTitle><TourDescription>{description}</TourDescription></TourHeader>
          <TourStepCounter format={(current, total) => `Paso ${current} de ${total}`} />
          <TourFooter>
            <TourSkip variant="ghost" aria-label="Cerrar guía">Cerrar</TourSkip>
            <TourPrev aria-label="Paso anterior">Anterior</TourPrev>
            <TourNext variant="outline" aria-label={index === 4 ? 'Finalizar guía' : 'Paso siguiente'}>{index === 4 ? 'Finalizar' : 'Siguiente'}</TourNext>
          </TourFooter>
        </TourStep>)}
      </TourPortal>
    </Tour>
  </section>
}

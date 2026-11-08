import { Link } from '@tanstack/react-router'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
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
  const primaryButtonClass = (active: boolean) => `academic-scheduling__button${active ? '' : ' academic-scheduling__button--secondary'}`

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
    if (workspaceDirty && !window.confirm('Hay cambios locales sin guardar. ¿Descartarlos y continuar con esta propuesta?')) return
    if (await commands.resume(id, version)) setDraftListOpen(false)
  }

  // The panels that offer a new draft confirm it (including discarding local changes) themselves.
  const forkDraft = async (id: string, version: number) => {
    if (await commands.fork(id, version)) setDraftListOpen(false)
  }

  const applyPeriodDefaults = (period: PlanningPeriod, force = false) => {
    if (!catalog || (period === planningPeriod && !force)) return
    if (workspaceDirty && !window.confirm('Aplicar valores iniciales para este periodo? Se reemplazarán las demandas y capacidades editadas.')) return
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
    <PlanningScopeHeader
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
    {currentStage === 'preparacion' && <nav className="planning-preparation-views" aria-label="Vistas de preparación">
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
          <label>Propuesta
            <input aria-label="Nombre de la propuesta" maxLength={100} value={draftTitle} disabled={lockedDraft || draftBusy}
              onChange={(event) => markTitle(event.currentTarget.value)} />
          </label>
          <label>Estado
            <select aria-label="Estado de la propuesta" disabled={lockedDraft || draftBusy} value={view.displayedDraftState}
              onChange={(event) => markDraftState(event.currentTarget.value as AcademicDraftState)}>
              <option value="draft">Borrador</option>
              <option value="ready-for-review" disabled={!proposal || proposal.status !== 'complete' || !proposal.coverageComplete || proposal.assignments.length === 0}>Lista para revisión</option>
              <option value="in-review" disabled>En revisión docente</option>
              <option value="ready-for-approval" disabled>Lista para aprobación</option>
              {savedDraftState === 'approved' && <option value="approved" disabled>Aprobada (simulada)</option>}
              {savedDraftState === 'published' && <option value="published" disabled>Publicada (simulada)</option>}
            </select>
          </label>
          <div className="academic-scheduling__draft-actions">
            <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary"
              aria-haspopup="dialog"
              onClick={() => {
                setDraftListOpen(true)
                void refreshDraftList()
              }}>Mis propuestas</button>
          </div>
        </div>
        <p className="academic-scheduling__draft-note">Almacenamiento local compartido; no está asociado a una cuenta.</p>
        {workspaceDirty && <p className="academic-scheduling__draft-note" role="status">
          {draftId ? `Cambios sin guardar · versión guardada ${draftVersion}.` : 'Cambios sin guardar.'}
        </p>}
        {draftMessage && <p className="academic-scheduling__draft-note" role="status">{draftMessage}</p>}
        {draftError && <p className="academic-scheduling__error" role="alert">{draftError}</p>}
        <Dialog open={draftListOpen} onOpenChange={setDraftListOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Mis propuestas</DialogTitle>
              <DialogDescription>Almacenamiento local compartido; no está asociado a una cuenta.</DialogDescription>
            </DialogHeader>
            {draftError && <p className="academic-scheduling__error" role="alert">{draftError}</p>}
            <div id="academic-scheduling-saved-proposals" className="academic-scheduling__saved-proposals">
              {draftList?.unavailableCount ? <p role="status">{draftList.unavailableCount} propuesta(s) no se pudieron leer.</p> : null}
              {draftList?.items.length === 0 && <p>No hay propuestas guardadas.</p>}
              {draftList && draftList.items.map((item) => <details className="academic-scheduling__saved-row" key={item.id}>
                <summary>{item.title} · {item.schoolId} · {item.academicPeriod} · {item.state === 'draft' ? 'Borrador' : item.state === 'ready-for-review' ? 'Lista para revisión' : item.state === 'in-review' ? 'En revisión docente' : item.state === 'ready-for-approval' ? 'Lista para aprobación' : item.state === 'approved' ? 'Aprobada (simulada)' : 'Publicada (simulada)'} · v{item.version}</summary>
                <div><span>Actualizada {new Date(item.updatedAt).toLocaleString('es-PE')} · {item.hasSchedule ? 'Con horario' : 'Solo configuración'}</span>
                  <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary"
                    disabled={draftBusy} onClick={() => void resumeDraft(item.id, item.version)}>{item.state === 'approved' || item.state === 'published' ? 'Consultar' : 'Continuar edición'}</button></div>
              </details>)}
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
          <div className="academic-scheduling__step-heading"><h3 id="academic-scheduling-resource-editor">Paso 2 · Configurar recursos</h3>
            <p>Los nombres de referencia provienen del escenario sintético y no confirman asignaciones del nuevo periodo.</p></div>
          <AcademicResourceEditor
            catalog={catalog}
            resources={resources}
            onChange={updateResources}
            isLocked={lockedDraft || draftBusy}
            proposal={proposal}
          />
          <div className="academic-scheduling__general-windows"><strong>Franjas generales del catálogo</strong>
            <span>La disponibilidad de cada recurso se intersecta con estas franjas; no se deduce del historial.</span>
            <ul>{catalog.windows.map((window, index) => <li key={index}>{formatAcademicInterval(window)}</li>)}</ul>
          </div>
        </section>}

      </div>
      <div className="planning-preparation-view" hidden={preparationView !== 'resumen'}>
        <PlanningPreparationSummary selectedCourses={selectedCourses.length} invalidCourses={view.invalidCourses.length}
          teachers={resources.teachers.length} rooms={resources.rooms.length} offerReady={preparationAction?.id === 'generate'}>
          <fieldset className="academic-scheduling__locked-workspace" disabled={lockedDraft || draftBusy}>
            {catalog && <section className="academic-scheduling__section academic-scheduling__generate" aria-labelledby="academic-scheduling-generate">
              <h3 id="academic-scheduling-generate">Paso 3 · Generar propuesta</h3>
              <p>Periodo: {planningPeriod}. Se envían todos los cursos seleccionados, incluidos los que estén ocultos por el filtro de ciclo.</p>
              <fieldset className="academic-scheduling__policy">
                <legend>Excepciones de horario · decisión local explícita</legend>
                <label><input type="checkbox" checked={planningPolicy?.allowAfternoon ?? false}
                  onChange={(event) => updatePlanningException('allowAfternoon', event.currentTarget.checked)} />Permitir propuesta de lunes a viernes desde las 14:00 hasta las 22:00</label>
                <label><input type="checkbox" checked={planningPolicy?.allowSaturday ?? false}
                  onChange={(event) => updatePlanningException('allowSaturday', event.currentTarget.checked)} />Permitir propuesta sábado de 08:00 a 13:00</label>
                <p>La disponibilidad docente y de ambientes sigue siendo obligatoria. Habilitar sábado no agrega disponibilidad automáticamente.</p>
              </fieldset>
              <label className="academic-scheduling__policy">Criterio para ordenar alternativas
                <select aria-label="Criterio de asignación" value={allocationPolicy} onChange={(event) => updateAllocationPolicy(event.currentTarget.value as AcademicAllocationPolicy)}>
                  <option value="preferences">Preferencias (predeterminado)</option>
                  <option value="balanced">Preferencias y menor concentración en empates</option>
                  <option value="first-feasible">Primera alternativa factible</option>
                </select>
              </label>
              <p className="academic-scheduling__resource-note">
                {allocationPolicy === 'preferences' && 'Ordena primero bloques dentro de preferencias; luego docentes sin preferencias y deja alternativas fuera como respaldo.'}
                {allocationPolicy === 'balanced' && 'Aplica la prioridad de preferencias y, en empates, prioriza menor concentración (secciones asignadas y luego minutos); no impone equidad global.'}
                {allocationPolicy === 'first-feasible' && 'Conserva el orden determinista y no prioriza preferencias.'}
              </p>
              <div className="academic-scheduling__actions">
                <button type="button" className={primaryButtonClass(preparationAction?.id === 'generate')} disabled={!validDemands || generating}
                  onClick={() => void generate()}>{generating ? 'Generando…' : 'Generar horarios'}</button>
                {!validDemands && <span>Ingresa demanda válida y capacidad entera positiva para cada curso seleccionado. Sin selección se genera una propuesta vacía.</span>}
              </div>
            </section>}
            {proposalError && <p className="academic-scheduling__error" role="alert">{proposalError}</p>}
          </fieldset>
          {preparationAction?.id === 'review-offer' && <button type="button" className="academic-scheduling__button"
            onClick={() => onPreparationViewChange('cursos')}>Revisar oferta ({preparationAction.count ?? 0})</button>}
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
        {scheduleAction?.id === 'back-preparation' && <Link to="/local/programacion-academica" search={{ etapa: 'preparacion' }}
          className="academic-scheduling__button">{scheduleAction.label}</Link>}
        {scheduleAction?.id === 'save' && <button type="button" className="academic-scheduling__button"
          disabled={!canSave || draftBusy} onClick={() => void saveDraft()}>{scheduleAction.label}</button>}
        {scheduleAction?.id === 'submit-review' && <button type="button" className="academic-scheduling__button"
          disabled={lockedDraft || draftBusy} onClick={() => void submitTeacherReview()}>{scheduleAction.label}</button>}
      </div>
      <fieldset className="academic-scheduling__locked-workspace" disabled={draftBusy}>
        {proposalError && <p className="academic-scheduling__error" role="alert">{proposalError}</p>}
        {!proposal && (
          <div className="academic-scheduling__empty-stage">
            <p>No hay una propuesta generada. Ve a la etapa de <strong>Preparación</strong> y selecciona <strong>Generar horarios</strong>.</p>
          </div>
        )}
        {proposal && <>
          <PlanningStatusBar
            proposal={proposal}
            primaryActionId={scheduleAction?.id}
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

                <p className="academic-scheduling__resource-note">Asignaciones propuestas para el nuevo periodo; no están confirmadas.</p>
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
        {reviewAction?.id === 'back-schedule' && <Link to="/local/programacion-academica" search={{ etapa: 'horario' }}
          className="academic-scheduling__button">{reviewAction.label}</Link>}
        {reviewAction?.id === 'to-approval' && <Link to="/local/programacion-academica" search={{ etapa: 'aprobacion' }}
          className="academic-scheduling__button">{reviewAction.label}</Link>}
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
        {approvalAction?.id === 'back-review' && <Link to="/local/programacion-academica" search={{ etapa: 'revision' }}
          className="academic-scheduling__button">{approvalAction.label}</Link>}
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
  </section>
}

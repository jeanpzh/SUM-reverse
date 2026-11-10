import { PlanningFetchLoading } from '../components/PlanningFetchLoading'
import { Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { academicSectionCoverage, formatAcademicInterval } from '../data/academicScheduling'
import type { PlanningPeriod } from '../data/academicScheduling'
import type { AcademicAdjustment, AcademicAllocationPolicy, AcademicDraftState, AcademicPlanningResources } from '../../../shared/programacion-academica-api.mjs'
import { usePlanningSessionContext } from '../components/PlanningSessionProvider'
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
import { PlanningScheduleToolbar } from './PlanningScheduleToolbar'
import { PlanningStatusBar, PlanningSearchDetails } from './PlanningStatusBar'
import { PlanningSectionsTable } from './PlanningSectionsTable'
import { PlanningInspector } from './PlanningInspector'
import { PlanningWeekView } from './PlanningWeekView'
import { useDefaultLayout } from 'react-resizable-panels'
import { useMediaQuery } from '../lib/useMediaQuery'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/Resizable'
import { Sheet, SheetContent, SheetTitle } from '../components/ui/Sheet'
import { useNormativeChat } from './useNormativeChat'
import { PlanningContextPanel } from './PlanningContextPanel'
import { FolderKanban } from 'lucide-react'
import type { PlanningStage } from '../routes/local.programacion-academica'
import './AcademicScheduling.css'
import './PlanningWorkbench.css'
import './PlanningSections.css'

const GUIDE_STEPS = [
  ['nav', 'Recorrido', 'El menú sigue el orden del trabajo: preparar la oferta, programar, revisar y publicar.'],
  ['proposal', 'Propuesta', 'Aquí ves qué propuesta editas y su estado. Puedes renombrarla o abrir otra guardada.'],
  ['save', 'Guardar', 'Guarda explícitamente la versión que quieres conservar.'],
  ['primary', 'Siguiente paso', 'Este botón indica la acción que sigue según el estado de la propuesta.'],
] as const

export function AcademicScheduling({ currentStage = 'preparacion', preparationView = 'resumen', onPreparationViewChange }: {
  currentStage?: PlanningStage
  preparationView?: PlanningPreparationView
  onPreparationViewChange: (view: PlanningPreparationView) => void
}) {
  // Workflow state and rules live in the Sesión de programación (client/src/data/planningSession.ts).
  const { state, view, commands } = usePlanningSessionContext()
  const [applyingAdvisor, setApplyingAdvisor] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'tabla' | 'semana'>('tabla')
  const [searchQuery, setSearchQuery] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [cycleFilter, setCycleFilter] = useState('all')
  const navigate = useNavigate()
  const [confirmElement, confirm] = useConfirm()
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const [guideSteps, setGuideSteps] = useState<ReadonlyArray<readonly [string, string, string]>>([])
  const wideLayout = useMediaQuery('(min-width: 1024px)')
  const [chatOpen, setChatOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [draftListOpen, setDraftListOpen] = useState(false)
  const viewScrollPositions = useRef<{ tabla: number; semana: number }>({ tabla: 0, semana: 0 })

  const handleToggleView = useCallback((nextMode: 'tabla' | 'semana') => {
    if (nextMode === viewMode) return
    viewScrollPositions.current[viewMode] = scrollerRef.current?.scrollTop ?? 0
    setViewMode(nextMode)
  }, [viewMode])

  useLayoutEffect(() => {
    const targetY = viewScrollPositions.current[viewMode] ?? 0
    scrollerRef.current?.scrollTo({ top: targetY, behavior: 'instant' })
    const rafId = requestAnimationFrame(() => {
      scrollerRef.current?.scrollTo({ top: targetY, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(rafId)
  }, [viewMode])

  const { catalog, proposal, proposalResources, editingBlock, demands, capacities, patterns, deliveryModes,
    selectedCourses, demandSourceId, demandEstimate, resources, allocationPolicy } = state
  const planningPeriod = state.period
  const chat = useNormativeChat(planningPeriod)
  const [chatExpanded, setChatExpanded] = useState(false)
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
  const currentAction = currentStage === 'preparacion' ? preparationAction
    : currentStage === 'horario' ? scheduleAction
      : currentStage === 'revision' ? reviewAction : approvalAction
  const pageTitle = currentStage === 'horario' ? 'Horario'
    : currentStage === 'revision' ? 'Revisión docente'
      : currentStage === 'aprobacion' ? 'Aprobación y publicación'
        : preparationView === 'cursos' ? 'Cursos'
          : preparationView === 'recursos' ? 'Docentes y ambientes' : 'Resumen de preparación'

  useEffect(() => {
    if (!draftMessage) return
    // Session messages are plain strings; the non-success outcomes say an edit was not applied or is still pending.
    if (/^No se aplicó|pendiente/.test(draftMessage)) toast.warning(draftMessage, { duration: Infinity })
    else toast.success(draftMessage)
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

  const openGuide = () => {
    setGuideSteps(GUIDE_STEPS.filter(([target]) => {
      const element = document.getElementById(`planning-tour-${target}`)
      return Boolean(element && element.getClientRects().length > 0)
    }))
    setTourStep(0)
    setTourOpen(true)
  }

  const retryCatalog = () => void commands.loadCatalog()
  const refreshDraftList = () => commands.refreshDrafts()
  const saveDraft = async () => {
    await commands.save()
    if (!draftTitle.trim() || draftTitle.trim() !== draftTitle) {
      await navigate({ to: '/local/programacion-academica', search: { etapa: 'preparacion', vista: 'resumen' } })
      document.getElementById('planning-proposal-title')?.focus()
    }
  }
  const estimateDemand = () => commands.estimateDemand()
  const generate = async () => {
    if (await commands.generate()) {
      await navigate({ to: '/local/programacion-academica', search: { etapa: 'horario' } })
    }
  }
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

  const inspectorOpen = currentStage === 'horario' && Boolean(proposal) && selectedSectionId !== null
  const inspectorDocked = wideLayout && inspectorOpen
  const railLayout = useMediaQuery('(min-width: 1280px)')
  const chatInRail = railLayout && chatOpen && !chatExpanded
  const chatInSheet = chatOpen && !chatInRail
  const railOpen = chatInRail
  const closeInspector = () => {
    setSelectedSectionId(null)
    cancelBlockReview()
  }
  const closeChat = () => {
    setChatOpen(false)
    setChatExpanded(false)
    document.getElementById('planning-toggle-chat')?.focus()
  }
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'planning-workspace',
    panelIds: railOpen ? ['planning-content', 'planning-rail'] : ['planning-content'],
  })

  const { defaultLayout: detailLayout, onLayoutChanged: onDetailLayoutChanged } = useDefaultLayout({
    id: 'planning-schedule-detail',
    panelIds: inspectorDocked ? ['planning-schedule-content', 'planning-section-detail'] : ['planning-schedule-content'],
  })
  const reviewPending = () => {
    if (!proposal) return
    const sectionId = proposal.pending[0]?.sectionId
      ?? proposal.sections.find((section) => !proposal.assignments.some((assignment) => assignment.sectionId === section.sectionId))?.sectionId
    if (sectionId) setSelectedSectionId(sectionId)
  }
  const retrySearch = async () => {
    if (!(await confirm({
      title: 'Reemplazar esta propuesta',
      description: 'Reintentar usa la configuración actual y reemplaza esta propuesta, incluidos sus ajustes manuales. Guarda antes si deseas conservarla.',
      confirmLabel: 'Reintentar búsqueda',
      destructive: true,
    }))) return
    await generate()
  }

  const stageLink = (search: {
    etapa: PlanningStage
    vista?: PlanningPreparationView
  }, label: string, variant: 'default' | 'outline' = 'default') => (
    <Button asChild variant={variant} size="sm" id="planning-tour-primary">
      <Link to="/local/programacion-academica" search={search}>{label}</Link>
    </Button>
  )
  let nextAction: ReactNode = null
  if (currentAction) {
    switch (currentAction.id) {
      case 'review-offer':
        nextAction = preparationView === 'cursos' ? null
          : <Button type="button" size="sm" id="planning-tour-primary" onClick={() => onPreparationViewChange('cursos')}>{currentAction.label}</Button>
        break
      case 'generate':
        nextAction = <Button type="button" size="sm" id="planning-tour-primary"
          disabled={!validDemands || generating || lockedDraft || draftBusy}
          onClick={() => void generate()}>{generating ? 'Generando…' : currentAction.label}</Button>
        break
      case 'resolve-pending':
        nextAction = <Button type="button" size="sm" id="planning-tour-primary" onClick={reviewPending}>Revisar {proposal ? academicSectionCoverage(proposal).partial + academicSectionCoverage(proposal).pending : 0} pendientes</Button>
        break
      case 'submit-review':
        nextAction = <Button type="button" size="sm" id="planning-tour-primary"
          disabled={lockedDraft || draftBusy} onClick={() => void submitTeacherReview()}>{currentAction.label}</Button>
        break
      case 'back-preparation':
        nextAction = stageLink({ etapa: 'preparacion' }, currentAction.label, 'outline')
        break
      case 'back-schedule':
        nextAction = stageLink({ etapa: 'horario' }, currentAction.label, 'outline')
        break
      case 'to-approval':
        nextAction = stageLink({ etapa: 'aprobacion' }, currentAction.label)
        break
      case 'back-review':
        nextAction = stageLink({ etapa: 'revision' }, currentAction.label, 'outline')
        break
      default:
        nextAction = null // save, record-response, approve, publish stay in their panels
    }
  }

  return <section className="screen-academic-scheduling">
    {confirmElement}
    <PlanningScopeHeader
      title={pageTitle}
      nextAction={nextAction}
      tertiaryAction={currentStage === 'horario' && proposal ? <Button type="button" variant="link" disabled={lockedDraft || draftBusy} onClick={() => void retrySearch()}>Reintentar búsqueda</Button> : null}
      draftState={view.displayedDraftState}
      proposalControls={
        <div className="academic-scheduling__draft-field"><Label className="sr-only" htmlFor="planning-proposal-title">Propuesta</Label>
          <Input id="planning-proposal-title" aria-label="Nombre de la propuesta" aria-invalid={Boolean(draftError && (!draftTitle.trim() || draftTitle.trim() !== draftTitle))} aria-describedby={draftError && !draftListOpen ? 'planning-draft-error' : undefined} maxLength={100} value={draftTitle} disabled={lockedDraft || draftBusy}
            onChange={(event) => markTitle(event.currentTarget.value)} />
        </div>
      }
      proposalActions={
        <div className="academic-scheduling__draft-actions">
          {!lockedDraft && view.proposalComplete && view.displayedDraftState === 'draft' && (
            <Button type="button" variant="link" disabled={draftBusy} onClick={() => markDraftState('ready-for-review')}>
              Marcar lista para revisión
            </Button>
          )}
          {!lockedDraft && view.displayedDraftState === 'ready-for-review' && (
            <Button type="button" variant="link" disabled={draftBusy} onClick={() => markDraftState('draft')}>
              Volver a borrador
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            id="planning-tour-proposals"
            aria-haspopup="dialog"
            aria-label="Ver mis propuestas guardadas"
            className="gap-1.5"
            onClick={() => {
              setDraftListOpen(true)
              void refreshDraftList()
            }}
          >
            <FolderKanban className="size-3.5" aria-hidden="true" />
            <span>Propuestas</span>
          </Button>
        </div>
      }
      onGuide={openGuide}
      school="Sistemas"
      period={planningPeriod}
      draftStateText={view.draftLabel}
      workspaceDirty={workspaceDirty}
      canSave={canSave}
      draftBusy={draftBusy}
      onSave={() => void saveDraft()}
      disabledReason={disabledSaveReason}
      onToggleChat={() => {
        if (chatOpen) {
          closeChat()
          return
        }
        setChatOpen(true)
      }}
      isChatOpen={chatOpen}
    />
    <Dialog open={draftListOpen} onOpenChange={setDraftListOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mis propuestas</DialogTitle>
          <DialogDescription>Almacenamiento local compartido; no está asociado a una cuenta.</DialogDescription>
        </DialogHeader>
        {draftError && <Alert variant="destructive" role="alert"><AlertDescription>{draftError}</AlertDescription></Alert>}
        {draftBusy && <PlanningFetchLoading label="Consultando propuestas guardadas…" layout="table" />}
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

    <ResizablePanelGroup orientation="horizontal" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged} className="planning-workspace">
    <ResizablePanel id="planning-content" minSize="45%" className="planning-workspace__panel">
    <ResizablePanelGroup orientation="vertical" defaultLayout={detailLayout} onLayoutChanged={onDetailLayoutChanged} className="planning-schedule-split">
    <ResizablePanel id="planning-schedule-content" minSize="40%" className="planning-workspace__panel">
    <div ref={scrollerRef} className={`planning-workspace__content ${currentStage === 'preparacion' && preparationView === 'cursos' ? 'planning-workspace__content--courses' : ''}`}>
    {draftError && !draftListOpen && <Alert id="planning-draft-error" variant="destructive" role="alert"><AlertDescription>{draftError}</AlertDescription></Alert>}
    {loadingCatalog && preparationView !== 'cursos' && currentStage === 'preparacion' && <PlanningFetchLoading label="Consultando catálogo local…" layout="cards" />}
    {/* Stage 1: Preparación */}
    <section
      className="planning-stage-panel planning-stage-panel--preparacion"
      hidden={currentStage !== 'preparacion'}
      aria-label="Etapa de preparación"
    >
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
        {catalog && <section id="academic-scheduling-resource-editor" className="planning-resources-view" aria-label="Configurar recursos">
          <AcademicResourceEditor
            catalog={catalog}
            resources={resources}
            onChange={updateResources}
            isLocked={lockedDraft || draftBusy}
            proposal={proposal}
          />
          <Collapsible className="academic-scheduling__general-windows">
            <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="planning-resources-disclosure">Franjas generales del catálogo</Button></CollapsibleTrigger>
            <CollapsibleContent>
            <span>La disponibilidad de cada recurso se intersecta con estas franjas; no se deduce del historial.</span>
            <ul>{catalog.windows.map((window, index) => <li key={index}>{formatAcademicInterval(window)}</li>)}</ul>
            </CollapsibleContent>
          </Collapsible>
        </section>}

      </div>
      <div className="planning-preparation-view" hidden={preparationView !== 'resumen'}>
        <PlanningPreparationSummary selectedCourses={selectedCourses.length} invalidCourses={view.invalidCourses.length}
          catalogCourseCount={catalog?.courses.length ?? 0} selectionDisabled={lockedDraft || draftBusy || generating}
          onSelectAllCourses={() => selectCourses(catalog?.courses.map((course) => course.courseId) ?? [])}
          invalidOfferNote={!validDemands ? 'Ingresa demanda válida y capacidad entera positiva para cada curso seleccionado. Sin selección se genera una propuesta vacía.' : undefined}
          teachers={resources.teachers.length} rooms={resources.rooms.length} offerReady={preparationAction?.id === 'generate'}>
          <div className="academic-scheduling__locked-workspace">
            {catalog && <section className="academic-scheduling__section academic-scheduling__generate" aria-labelledby="academic-scheduling-generate">
              <h3 id="academic-scheduling-generate">Opciones de generación</h3>
              <p>El horario de {planningPeriod} incluirá todos los cursos seleccionados, también los ocultos por los filtros.</p>
              <Collapsible className="academic-scheduling__advanced">
                <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="academic-scheduling__advanced-toggle">Opciones avanzadas</Button></CollapsibleTrigger>
                <CollapsibleContent className="academic-scheduling__advanced-content">
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

            </section>}
            {proposalError && <Alert variant="destructive" role="alert"><AlertDescription>{proposalError}</AlertDescription></Alert>}
          </div>
        </PlanningPreparationSummary>
      </div>
    </section>

    {/* Stage 2: Horario */}
    <section
      className="planning-stage-panel planning-stage-panel--horario"
      hidden={currentStage !== 'horario'}
      aria-label="Etapa de horario"
    >
      <fieldset className="academic-scheduling__locked-workspace" disabled={draftBusy}>
        {proposalError && <Alert variant="destructive" role="alert"><AlertDescription>{proposalError}</AlertDescription></Alert>}
        {!proposal && <div className="planning-schedule-empty">
          {generating || applyingAdvisor ? <p role="status">{applyingAdvisor ? 'Aplicando y regenerando…' : 'Generando horarios…'}</p>
            : <><p>Selecciona los cursos y revisa los recursos en Preparación para generar una propuesta.</p>
              <Button asChild variant="link"><Link to="/local/programacion-academica" search={{ etapa: 'preparacion', vista: 'resumen' }}>Ir a Preparación</Link></Button></>}
        </div>}
        {proposal && <>
          <PlanningStatusBar key={`${proposal.proposalId}:${proposal.editVersion ?? 0}`}
            teacherNames={Object.fromEntries([...(catalog?.referenceTeachers ?? []), ...resources.teachers].map((teacher) => [teacher.id, teacher.name]))}
            courseNames={Object.fromEntries((catalog?.courses ?? []).map((course) => [course.courseId, course.name]))}
            roomNames={Object.fromEntries([...(catalog?.referenceRooms ?? []), ...resources.rooms].map((room) => [room.id, room.name]))}
            proposal={proposal}
            academicPeriod={state.period}
            isDraft={!lockedDraft}
            onApplyAdvisorPatches={async (patches) => {
              if ((proposal.manuallyAdjustedSectionIds?.length ?? 0) > 0) {
                const confirmed = await confirm({
                  title: 'Reemplazar ajustes manuales',
                  description: 'Aplicar recomendaciones y regenerar el horario descartará los movimientos manuales realizados en esta propuesta. ¿Deseas continuar?',
                  confirmLabel: 'Aplicar y regenerar',
                  destructive: true,
                })
                if (!confirmed) return false
              }
              setApplyingAdvisor(true)
              try {
                return await commands.applyAdvisorPatchesAndRegenerate(patches, { proposalId: proposal.proposalId, editVersion: proposal.editVersion ?? 0 })
              } finally {
                setApplyingAdvisor(false)
              }
            }}
            isLocked={lockedDraft || draftBusy}
          />

          <PlanningScheduleToolbar proposal={proposal} searchQuery={searchQuery} onSearchChange={setSearchQuery}
            teacherFilter={teacherFilter} onTeacherFilterChange={setTeacherFilter} viewMode={viewMode} onToggleView={handleToggleView} />
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
                  onSelectSection={(sectionId) => {
                    setSelectedSectionId(sectionId)
                  }}
                  onEditBlock={startBlockReview}
                  isLocked={lockedDraft || draftBusy}
                  searchQuery={searchQuery}
                  teacherFilter={teacherFilter}
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
                  teacherFilter={teacherFilter}
                  onSelectSection={(sectionId) => {
                    setSelectedSectionId(sectionId)
                  }}
                  onStartEditBlock={startBlockReview}
                  onChangeEditingBlock={setEditingBlock}
                  isLocked={lockedDraft || draftBusy}
                />
              </div>
            </div>

            {selectedSectionId && !wideLayout && (
              <PlanningInspector
                sectionId={selectedSectionId}
                proposal={proposal}
                proposalResources={proposalResources}
                catalog={catalog}
                editingBlock={editingBlock}
                adjusting={adjusting}
                adjustmentError={adjustmentError}
                isLocked={lockedDraft || draftBusy}
                onClose={closeInspector}
                onStartEdit={startBlockReview}
                onCancelEdit={cancelBlockReview}
                onSubmitEdit={submitBlockReview}
                onChangeEditingBlock={setEditingBlock}
              />
            )}
          </div>
          <PlanningSearchDetails proposal={proposal} />
        </>}
      </fieldset>
    </section>

    {/* Stage 3: Revisión docente */}
    <section
      className="planning-stage-panel planning-stage-panel--revision"
      hidden={currentStage !== 'revision'}
      aria-label="Etapa de revisión docente"
    >
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
      <AcademicPublicationPanel primaryActionId={approvalAction?.id} draftId={draftId} draftVersion={draftVersion} draftTitle={draftTitle}
        draftState={savedDraftState} dirty={workspaceDirty} busy={draftBusy || generating || adjusting || demandLoading} onApprove={approveDraft}
        onPublish={publishDraft} onFork={forkDraft}
        onError={(message) => commands.edit({ type: 'setDraftError', message })}
        onMessage={(message) => commands.edit({ type: 'setDraftMessage', message })} />
      <AcademicIntentionDemandPanel dirty={workspaceDirty} busy={draftBusy || generating || adjusting || demandLoading}
        onFork={(id, version) => void forkDraft(id, version)} potential={demandEstimate}
        finalDemand={Object.fromEntries(selectedCourses.map((courseId) => [courseId, demands[courseId] ?? '']))} />
    </section>
    </div>
    </ResizablePanel>
    {inspectorDocked && proposal && <>
      <ResizableHandle withHandle aria-label="Redimensionar detalle de sección" />
      <ResizablePanel id="planning-section-detail" defaultSize="35%" minSize="20%" maxSize="60%" className="planning-workspace__panel planning-workspace__detail">
              <PlanningInspector docked
                sectionId={selectedSectionId}
                proposal={proposal}
                proposalResources={proposalResources}
                catalog={catalog}
                editingBlock={editingBlock}
                adjusting={adjusting}
                adjustmentError={adjustmentError}
                isLocked={lockedDraft || draftBusy}
                onClose={closeInspector}
                onStartEdit={startBlockReview}
                onCancelEdit={cancelBlockReview}
                onSubmitEdit={submitBlockReview}
                onChangeEditingBlock={setEditingBlock}
              />
      </ResizablePanel>
    </>}
    </ResizablePanelGroup>
    </ResizablePanel>
    {railOpen && <>
      <ResizableHandle withHandle aria-label="Redimensionar asistente" />
      <ResizablePanel id="planning-rail" defaultSize="30%" minSize="280px" maxSize="45%" className="planning-workspace__panel">
        <aside className="planning-rail" aria-label="Asistente normativo">
          <PlanningContextPanel academicPeriod={planningPeriod} chat={chat}
            expanded={false} onExpandedChange={setChatExpanded} onClose={closeChat} />
        </aside>
      </ResizablePanel>
    </>}
    </ResizablePanelGroup>
    <Sheet open={chatInSheet} onOpenChange={(open) => { if (!open) closeChat() }}>
      <SheetContent side="right" showCloseButton={false} className="planning-copilot-sheet" aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          document.getElementById('planning-toggle-chat')?.focus({ preventScroll: true })
        }}>
        <SheetTitle className="sr-only">Asistente normativo</SheetTitle>
        <PlanningContextPanel academicPeriod={planningPeriod} chat={chat}
          expanded={chatExpanded} onExpandedChange={setChatExpanded} onClose={closeChat} />
      </SheetContent>
    </Sheet>
    <Tour open={tourOpen} onOpenChange={setTourOpen} value={tourStep} onValueChange={setTourStep}
      onCloseAutoFocus={(event) => { event.preventDefault(); document.getElementById('planning-tour-guide')?.focus({ preventScroll: true }) }}>
      <TourPortal>
        <TourSpotlight />
        <TourSpotlightRing />
        {guideSteps.map(([target, title, description], index) => <TourStep key={index} target={`#planning-tour-${target}`} role="dialog" aria-labelledby={`planning-guide-title-${index}`}>
          <TourHeader><TourTitle id={`planning-guide-title-${index}`}>{title}</TourTitle><TourDescription>{description}</TourDescription></TourHeader>
          <TourStepCounter format={(current, total) => `Paso ${current} de ${total}`} />
          <TourFooter>
            <TourSkip variant="ghost" aria-label="Cerrar guía">Cerrar</TourSkip>
            <TourPrev aria-label="Paso anterior">Anterior</TourPrev>
            <TourNext variant="outline" aria-label={index === guideSteps.length - 1 ? 'Finalizar guía' : 'Paso siguiente'}>{index === guideSteps.length - 1 ? 'Finalizar' : 'Siguiente'}</TourNext>
          </TourFooter>
        </TourStep>)}
      </TourPortal>
    </Tour>
  </section>
}

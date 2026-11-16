import { createPortal } from 'react-dom'
import { AdvisorOutcome } from '../components/ai-elements/AdvisorOutcome'
import { usePlanningAssistantDisplay } from './usePlanningAssistantDisplay'
import { PlanningFetchLoading } from '../components/PlanningFetchLoading'
import { Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { academicSectionCoverage, academicSectionLabel, aggregateAcademicBlocks, formatAcademicMinute, normalizeAcademicSearch, formatAcademicInterval } from '../data/academicScheduling'
import type { AcademicCatalog, AcademicProposal, PlanningPeriod } from '../data/academicScheduling'
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
import { PlanningResultStrip } from './PlanningResultStrip'
import { PlanningScopeHeader } from './PlanningScopeHeader'
import { PlanningPreparationSummary } from './PlanningPreparationSummary'
import { PlanningStatusBar, PlanningSearchDetails } from './PlanningStatusBar'
import { PlanningInspector } from './PlanningInspector'
import { PlanningWeekView } from './PlanningWeekView'
import { useDefaultLayout } from 'react-resizable-panels'
import { useMediaQuery } from '../lib/useMediaQuery'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/Resizable'
import { Sheet, SheetContent, SheetTitle } from '../components/ui/Sheet'
import { useNormativeChat } from './useNormativeChat'
import { PlanningContextPanel } from './PlanningContextPanel'
import { ModeToggle } from '../components/mode-toggle'
import { ChevronDown } from 'lucide-react'
import type { PlanningStage } from '../routes/local.programacion-academica'
import './PlanningWorkbench.css'
import './PlanningSections.css'
import './AcademicScheduling.css'

const GUIDE_STEPS = [
  ['nav', 'Recorrido', 'El menú sigue el orden del trabajo: preparar la oferta, programar, revisar y publicar.'],
  ['proposal', 'Propuesta', 'Aquí ves qué propuesta editas y su estado. Puedes renombrarla o abrir otra guardada.'],
  ['save', 'Guardar', 'Guarda explícitamente la versión que quieres conservar.'],
  ['primary', 'Siguiente paso', 'Este botón indica la acción que sigue según el estado de la propuesta.'],
] as const

export function AcademicScheduling({ currentStage = 'preparacion', preparationView: requestedPreparationView = 'cursos', onPreparationViewChange }: {
  currentStage?: PlanningStage
  preparationView?: PlanningPreparationView
  onPreparationViewChange: (view: PlanningPreparationView) => void
}) {
  const preparationView = requestedPreparationView === 'resumen' ? 'cursos' : requestedPreparationView
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
  const narrowLayout = useMediaQuery('(max-width: 719px)')
  const compactWeek = narrowLayout && currentStage === 'horario' && viewMode === 'semana'
  const wideLayout = useMediaQuery('(min-width: 1024px)')
  const railLayout = useMediaQuery('(min-width: 1280px)')
  const { open: chatOpen, expanded: chatExpanded, setOpen: setChatOpen, setExpanded: setChatExpanded } = usePlanningAssistantDisplay(railLayout)
  const previousAssistantDisplay = useRef({ railLayout, open: chatOpen })
  useLayoutEffect(() => {
    const previous = previousAssistantDisplay.current
    if (previous.railLayout !== railLayout && previous.open) {
      document.getElementById('planning-toggle-chat')?.focus({ preventScroll: true })
    }
    previousAssistantDisplay.current = { railLayout, open: chatOpen }
  }, [railLayout, chatOpen])
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [mobileActions, setMobileActions] = useState<HTMLDivElement | null>(null)
  const [headActions, setHeadActions] = useState<HTMLDivElement | null>(null)
  const [scopeOpen, setScopeOpen] = useState(false)
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
  const planningPolicy = state.policy
  const draftTitle = state.draft.title
  const invalidDraftTitle = !draftTitle.trim() || draftTitle.trim() !== draftTitle
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
        : preparationView === 'cursos' ? 'Oferta de cursos'
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
    if (invalidDraftTitle) setDraftListOpen(true)
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
  const chatInRail = railLayout && chatOpen && !chatExpanded
  const chatInSheet = chatOpen && !chatInRail
  const railOpen = chatInRail
  const closeInspector = () => {
    const selectedRow = selectedSectionId
      ? document.querySelector<HTMLButtonElement>(`tr[data-section-id="${CSS.escape(selectedSectionId)}"] button`)
      : null
    setSelectedSectionId(null)
    cancelBlockReview()
    requestAnimationFrame(() => selectedRow?.focus({ preventScroll: true }))
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
        nextAction = selectedCourses.length === 0 ? <Button variant="outline" disabled aria-describedby="planning-empty-generate-reason">Generar propuesta<span id="planning-empty-generate-reason" className="sr-only">Selecciona cursos para generar</span></Button> : <Button type="button" size="sm" id="planning-tour-primary" onClick={() => onPreparationViewChange('cursos')}>{currentAction.label}</Button>
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
      case 'save':
        nextAction = <Button id="planning-tour-primary" disabled={!canSave || draftBusy} onClick={() => void saveDraft()}>{currentAction.label}</Button>
        break
      default:
        nextAction = null // Panel-owned actions retain their validation and confirmation.
    }
  }

  return <section className="screen-academic-scheduling" data-compact-week={compactWeek || undefined}>
    {confirmElement}
    <PlanningScopeHeader
      title={pageTitle}
      compactWeekLabel={compactWeek ? `Semana · ${teacherFilter === 'all' ? 'Todos los docentes' : teacherFilter === '__unassigned__' ? 'Sin docente asignado' : resources.teachers.find((teacher) => teacher.id === teacherFilter)?.name ?? proposal?.assignments.find((item) => item.teacherId === teacherFilter)?.teacherName ?? 'Docente'}` : undefined}
      eyebrow={currentStage === 'preparacion' ? `Paso 1 de 4 · ${draftVersion ? workspaceDirty ? 'cambios sin guardar' : 'guardada' : 'cambios en memoria hasta guardar'}` : undefined}
      nextAction={nextAction}
      tertiaryAction={currentStage === 'horario' ? <>           {!lockedDraft && view.proposalComplete && view.displayedDraftState === 'draft' && (
            <Button type="button" variant="link" disabled={draftBusy} onClick={() => markDraftState('ready-for-review')}>
              Marcar lista para revisión
            </Button>
          )}
          {!lockedDraft && view.displayedDraftState === 'ready-for-review' && (
            <Button type="button" variant="link" disabled={draftBusy} onClick={() => markDraftState('draft')}>
              Volver a borrador
            </Button>
          )}
 </> : currentStage === 'revision' ? <Button asChild variant="link"><Link to="/local/programacion-academica" search={{ etapa: 'horario' }}>Editar horario</Link></Button> : null}
      draftState={view.displayedDraftState}
      proposalTitle={draftTitle}
      version={draftVersion}
      actionSlotRef={setHeadActions}
      mobileActionSlotRef={currentStage === 'horario' ? setMobileActions : undefined}
      scopeSwitcher={<Button className="planning-scope-switcher-trigger" variant="ghost" onClick={() => setScopeOpen(true)} aria-haspopup="dialog"><span className="planning-scope-bar__faculty">FISI</span> Sistemas · {planningPeriod}<ChevronDown size={12} aria-hidden="true" /></Button>}
      generationOptions={currentStage === 'preparacion' ? <>
        <Button className="planning-generation-trigger" variant="outline" popoverTarget="planning-generation-options">Opciones de generación</Button>
        <div id="planning-generation-options" className="planning-generation-popover" popover="auto" role="dialog" aria-label="Opciones de generación">
          <div className="academic-scheduling__locked-workspace">
            {catalog && <section className="academic-scheduling__section academic-scheduling__generate" aria-labelledby="academic-scheduling-generate">
              <h3 id="academic-scheduling-generate">Opciones de generación</h3>
              <p>El horario de {planningPeriod} incluirá todos los cursos seleccionados, también los ocultos por los filtros.</p>
              <div className="academic-scheduling__advanced">

                <div className="academic-scheduling__advanced-content">
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
                </div>
              </div>

            </section>}
            {proposalError && <Alert variant="destructive" role="alert"><AlertDescription>{proposalError}</AlertDescription></Alert>}
          </div>
          <Button variant="ghost" popoverTarget="planning-generation-options" popoverTargetAction="hide">Cerrar opciones</Button>
        </div>
      </> : null}
      proposalActions={<div className="planning-proposal-trigger">
        <Button variant="ghost" id="planning-tour-proposals" title={`${draftTitle} · ${draftVersion ? `v${draftVersion}` : 'sin versión'} · ${view.draftLabel}`} aria-haspopup="dialog" aria-expanded={draftListOpen}
          onClick={() => { setDraftListOpen(true); void refreshDraftList() }}>
          <span className="planning-proposal-mobile-scope">Sistemas · {planningPeriod}{draftVersion ? ` · v${draftVersion}` : ''}</span><span className="planning-proposal-name">{draftTitle}</span>
          <span className="planning-scope-header__draft-state" data-draft-state={view.displayedDraftState} data-dirty={workspaceDirty || undefined} role="status">
            {draftVersion ? `v${draftVersion}` : 'sin versión'} · {view.displayedDraftState === 'draft' ? 'Borrador' : view.draftLabel}
          </span><ChevronDown size={12} aria-hidden="true" />
        </Button>
      </div>}
      onGuide={openGuide}
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
    <Dialog open={scopeOpen} onOpenChange={setScopeOpen}>
      <DialogContent className="planning-scope-switcher"><DialogHeader><DialogTitle>Escuela y periodo</DialogTitle><DialogDescription>Ámbito local de la propuesta.</DialogDescription></DialogHeader>
        <Label htmlFor="planning-school">Escuela</Label><NativeSelect id="planning-school" value="SISTEMAS" disabled><option value="SISTEMAS">Sistemas</option></NativeSelect>
        <Label htmlFor="planning-scope-period">Periodo</Label><NativeSelect id="planning-scope-period" value={planningPeriod} disabled={lockedDraft || draftBusy} onChange={(event) => { applyPeriodDefaults(event.currentTarget.value as PlanningPeriod); setScopeOpen(false) }}>
          <option value="2026-II">2026-II</option><option value="2027-I">2027-I</option>
        </NativeSelect>
      </DialogContent>
    </Dialog>
    <Dialog modal={false} open={draftListOpen} onOpenChange={setDraftListOpen}>
      <DialogContent id="planning-tour-proposal" aria-modal={false} className="planning-proposal-switcher">
        <DialogHeader className="sr-only">
          <DialogTitle>Propuesta</DialogTitle>
          <DialogDescription>Almacenamiento local compartido; no está asociado a una cuenta.</DialogDescription>
        </DialogHeader>
        <Label htmlFor="planning-proposal-title">Nombre de la propuesta</Label>
          <Input id="planning-proposal-title" aria-label="Nombre de la propuesta" aria-invalid={invalidDraftTitle} aria-describedby={invalidDraftTitle ? 'planning-proposal-title-error' : draftError ? 'planning-proposal-error' : undefined} maxLength={100} value={draftTitle} disabled={lockedDraft || draftBusy}
            onChange={(event) => markTitle(event.currentTarget.value)} />
        {invalidDraftTitle && <p id="planning-proposal-title-error" role="alert">El nombre de la propuesta debe tener entre 1 y 100 caracteres, sin espacios al inicio ni al final.</p>}
        <p className="planning-proposal-rename-note">Se guarda con la propuesta al pulsar Guardar.</p>
        {draftError && <Alert id="planning-proposal-error" variant="destructive" role="alert"><AlertDescription>{draftError}</AlertDescription></Alert>}
        {draftBusy && <PlanningFetchLoading label="Consultando propuestas guardadas…" layout="table" />}
        <div className="planning-mobile-tools"><Button variant="ghost" onClick={() => { setDraftListOpen(false); setScopeOpen(true) }}>Escuela y periodo</Button><Button variant="ghost" onClick={() => { setDraftListOpen(false); openGuide() }}>Guía</Button><ModeToggle /></div>
        <div id="academic-scheduling-saved-proposals" className="academic-scheduling__saved-proposals">
          {draftList?.unavailableCount ? <p role="status">{draftList.unavailableCount} propuesta(s) no se pudieron leer.</p> : null}
          {draftList?.items.length === 0 && <p>No hay propuestas guardadas.</p>}
          <p className="planning-eyebrow">Otras propuestas · Sistemas {planningPeriod}</p>
          <ul className="academic-scheduling__saved-list">{draftList && draftList.items.map((item) => <li className="academic-scheduling__saved-row" data-current={item.id === draftId || undefined} key={item.id}>
            <div className="planning-proposal-option"><span>{item.title}</span><span className="planning-proposal-option__version">v{item.version} · {item.state === 'draft' ? 'Borrador' : item.state === 'published' ? 'Publicada' : item.state === 'approved' ? 'Aprobada' : 'Guardada'}</span></div>
            <div className="planning-proposal-option__actions"><Button type="button" variant="ghost" disabled={draftBusy} onClick={() => void resumeDraft(item.id, item.version)}>Continuar edición</Button><Button type="button" variant="link" disabled={draftBusy} onClick={() => void resumeDraft(item.id, item.version)}>Consultar</Button></div>
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

        <PlanningPreparationSummary selectedCourses={selectedCourses.length} invalidCourses={view.invalidCourses.length}
          catalogCourseCount={catalog?.courses.length ?? 0} selectionDisabled={lockedDraft || draftBusy || generating}
          onSelectAllCourses={() => selectCourses(catalog?.courses.map((course) => course.courseId) ?? [])}
          invalidOfferNote={!validDemands ? 'Ingresa demanda válida y capacidad entera positiva para cada curso seleccionado. Sin selección se genera una propuesta vacía.' : undefined}
          teachers={resources.teachers.length} rooms={resources.rooms.length} offerReady={preparationAction?.id === 'generate'}
          schoolName="Sistemas" planningPeriod={planningPeriod}>

        </PlanningPreparationSummary>

      <div className="planning-preparation-view" hidden={preparationView !== 'cursos'}>
        <fieldset className="academic-scheduling__locked-workspace" disabled={lockedDraft || draftBusy}>
          <AcademicPreparationCourses
            catalog={catalog}
            loadingCatalog={loadingCatalog}
            catalogError={catalogError}
            onRetryCatalog={retryCatalog}
            resources={resources}
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

    </section>

    {/* Stage 2: Horario */}
    <section
      className="planning-stage-panel planning-stage-panel--horario"
      hidden={currentStage !== 'horario'}
      aria-label="Etapa de horario"
    >
      <fieldset className="academic-scheduling__locked-workspace" disabled={draftBusy}>
        {proposalError && <Alert variant="destructive" role="alert"><AlertDescription>{proposalError}</AlertDescription></Alert>}
        {!proposal && <PlanningResultStrip status={generating || applyingAdvisor ? 'generating' : 'empty'} statusId="academic-scheduling-result"
          label={applyingAdvisor ? 'Aplicando y regenerando…' : generating ? 'Generando horarios…' : 'Sin propuesta'}
          facts={generating || applyingAdvisor ? undefined : ['Selecciona los cursos y revisa los recursos en Preparación para generar una propuesta.']}
          action={generating || applyingAdvisor ? null : <Button asChild variant="link"><Link to="/local/programacion-academica" search={{ etapa: 'preparacion', vista: 'cursos' }}>Ir a Preparación</Link></Button>} />}

        {proposal && <>
          <PlanningStatusBar contextContainer={compactWeek ? mobileActions : null} mobileActionContainer={compactWeek ? null : mobileActions} onRetrySearch={() => void retrySearch()} key={`${proposal.proposalId}:${proposal.editVersion ?? 0}`}
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
            advisorDisabledReason={draftBusy ? 'Esperando a que termine la operación con la propuesta.' : undefined}
          />

          {state.advisorOutcome?.proposalId === proposal.proposalId
            && state.advisorOutcome.editVersion === (proposal.editVersion ?? 0)
            && <AdvisorOutcome outcome={state.advisorOutcome} />}

          <PlanningScheduleToolbar contextContainer={compactWeek ? mobileActions : null} mobileActionContainer={compactWeek ? null : mobileActions} proposal={proposal} searchQuery={searchQuery} onSearchChange={setSearchQuery}
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
                  selectedSectionId={selectedSectionId}
                  onSelectSection={(sectionId) => {
                    setSelectedSectionId(sectionId)
                  }}
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
                onViewWeek={() => handleToggleView('semana')}
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
        <AcademicTeacherReviewPanel actionContainer={currentStage === 'revision' ? headActions : null} primaryActionId={reviewAction?.id} key={`${draftId ?? 'new'}-${savedReview?.round ?? 0}`} review={savedReview} proposal={proposal} draftId={draftId} draftVersion={draftVersion}
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
      <AcademicPublicationPanel actionContainer={currentStage === 'aprobacion' ? headActions : null} primaryActionId={approvalAction?.id} draftId={draftId} draftVersion={draftVersion} draftTitle={draftTitle}
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
      <ResizableHandle className="planning-detail-divider" aria-label="Redimensionar detalle de sección" />
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
                onViewWeek={() => handleToggleView('semana')}
              />
      </ResizablePanel>
    </>}
    </ResizablePanelGroup>
    </ResizablePanel>
    {railOpen && <>
      <ResizableHandle withHandle aria-label="Redimensionar asistente" />
      <ResizablePanel id="planning-rail" defaultSize="360px" minSize="320px" maxSize="560px" className="planning-workspace__panel">
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

// Planning-only rendering: retains the existing section-level search and teacher predicates.
function PlanningSectionsTable({ proposal, catalog, selectedSectionId, onSelectSection, searchQuery, teacherFilter }: {
  proposal: AcademicProposal
  catalog: AcademicCatalog | null
  selectedSectionId: string | null
  onSelectSection: (id: string) => void
  searchQuery: string
  teacherFilter: string
}) {
  const narrow = useMediaQuery('(max-width: 719px)')
  const blocks = useMemo(() => aggregateAcademicBlocks(proposal), [proposal])
  const query = normalizeAcademicSearch(searchQuery)
  const sections = proposal.sections.filter((section) => {
    const sectionBlocks = blocks.filter((block) => block.sectionId === section.sectionId)
    if (teacherFilter === '__unassigned__' && sectionBlocks.length > 0) return false
    if (teacherFilter !== 'all' && teacherFilter !== '__unassigned__' && !sectionBlocks.some((block) => block.teacherId === teacherFilter)) return false
    const label = academicSectionLabel(proposal, section.sectionId)
    return !query || normalizeAcademicSearch(`${section.courseId} ${section.courseName} ${section.sectionId} ${label} Sección ${label} ${sectionBlocks.map((block) => block.teacherName).join(' ')} ${sectionBlocks.flatMap((block) => block.roomNames).join(' ')}`).includes(query)
  }).sort((a, b) => Number(proposal.pending.some((item) => item.sectionId === b.sectionId)) - Number(proposal.pending.some((item) => item.sectionId === a.sectionId)))
  const previousSelection = useRef(selectedSectionId)
  useEffect(() => {
    if (selectedSectionId && previousSelection.current !== selectedSectionId) {
      document.querySelector(`[data-section-id="${CSS.escape(selectedSectionId)}"]`)?.scrollIntoView({ block: 'nearest' })
    }
    previousSelection.current = selectedSectionId
  }, [selectedSectionId])
  if (narrow) return <div className="planning-horario-list" role="list" aria-label="Secciones de la propuesta">
    {sections.map((section) => {
      const assigned = blocks.filter((block) => block.sectionId === section.sectionId)
      const pending = proposal.pending.filter((item) => item.sectionId === section.sectionId)
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
          {proposal.manuallyAdjustedSectionIds?.includes(section.sectionId) && <span className="planning-horario-list__meta">Ajustada</span>}
        </button>
      </div>
    })}
    {!sections.length && <p>No se encontraron secciones que coincidan con la búsqueda.</p>}
  </div>
  return <div className="planning-horario-table-scroll">
    <table className="planning-horario-table" aria-label="Secciones de la propuesta">
      <thead><tr>{['Curso', 'Secc.', 'Componente', 'Docente', 'Ambiente', 'Día y hora', 'Estado'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{sections.flatMap((section) => {
        const assigned = proposal.assignments.filter((item) => item.sectionId === section.sectionId)
        const pending = proposal.pending.filter((item) => item.sectionId === section.sectionId)
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
            <td><span className={`planning-horario-status planning-horario-status--${status}`}><span aria-hidden="true">{status === 'Completa' ? '✓' : status === 'Parcial' ? '◐' : '○'}</span> {status}{proposal.manuallyAdjustedSectionIds?.includes(section.sectionId) && <small> · Ajustada</small>}</span></td>
          </tr>
        })
      })}{!sections.length && <tr><td colSpan={7}>No se encontraron secciones que coincidan con la búsqueda.</td></tr>}</tbody>
    </table>
  </div>
}

function PlanningScheduleToolbar({ contextContainer, mobileActionContainer, proposal, searchQuery, onSearchChange, teacherFilter, onTeacherFilterChange, viewMode, onToggleView }: {
  proposal: AcademicProposal
  searchQuery: string
  onSearchChange: (value: string) => void
  teacherFilter: string
  onTeacherFilterChange: (value: string) => void
  viewMode: 'tabla' | 'semana'
  mobileActionContainer?: HTMLDivElement | null
  contextContainer?: HTMLDivElement | null
  onToggleView: (value: 'tabla' | 'semana') => void
}) {
  const { teachers, unassigned } = useMemo(() => {
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

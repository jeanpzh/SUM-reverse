import { PlanningSectionsTable, PlanningScheduleToolbar } from './PlanningScheduleSections'
import { AdvisorOutcome } from '../components/ai-elements/AdvisorOutcome'
import { usePlanningAssistantDisplay } from './usePlanningAssistantDisplay'
import { PlanningFetchLoading } from '../components/PlanningFetchLoading'
import { Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { academicSectionCoverage, formatAcademicInterval, formatAcademicMinute, resolvePlanningTimeProfile } from '../data/academicScheduling'
import type { PlanningPeriod } from '../data/academicScheduling'
import type { AcademicAdjustment, AcademicAllocationPolicy, AcademicDraftState, AcademicPlanningResources, AcademicTeacherAssignmentMode } from '../../../shared/programacion-academica-api.mjs'
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
import { PlanningStatusBar } from './PlanningStatusBar'
import { PlanningInspector } from './PlanningInspector'
import { PlanningWeekView } from './PlanningWeekView'
import { useDefaultLayout, useGroupRef, type GroupImperativeHandle } from 'react-resizable-panels'
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

export function PlanningProposalTrigger({
  draftTitle,
  draftVersion,
  planningPeriod,
  displayedDraftState,
  draftLabel,
  workspaceDirty,
  draftListOpen,
  onOpen,
}: {
  draftTitle: string
  draftVersion: number | null
  planningPeriod: string
  displayedDraftState: string
  draftLabel: string
  workspaceDirty: boolean
  draftListOpen: boolean
  onOpen: () => void
}) {
  return (
    <div className="planning-proposal-trigger">
      <Button
        variant="ghost"
        id="planning-tour-proposals"
        title={`${draftTitle} · ${draftLabel}`}
        aria-haspopup="dialog"
        aria-expanded={draftListOpen}
        onClick={onOpen}
      >
        <span className="planning-proposal-mobile-scope">
          Sistemas · {planningPeriod}{draftVersion ? ` · v${draftVersion}` : ''}
        </span>
        <span className="planning-proposal-name">{draftTitle}</span>
        <span
          className="planning-scope-header__draft-state"
          data-draft-state={displayedDraftState}
          data-dirty={workspaceDirty || undefined}
          role="status"
        >
          {draftLabel}
        </span>
        <ChevronDown size={12} aria-hidden="true" />
      </Button>
    </div>
  )
}

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
  const [detailVisible, setDetailVisible] = useState(false)
  const selectSection = (sectionId: string) => { setSelectedSectionId(sectionId); setDetailVisible(true) }
  const [viewMode, setViewMode] = useState<'tabla' | 'semana'>('tabla')
  const [searchQuery, setSearchQuery] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [cycleFilter, setCycleFilter] = useState('all')
  const navigate = useNavigate()
  const [confirmElement, confirm] = useConfirm()
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const [guideSteps, setGuideSteps] = useState<ReadonlyArray<readonly [string, string, string]>>([])
  const narrowLayout = useMediaQuery('(max-width: 719px)')
  const compactWeek = narrowLayout && currentStage === 'horario' && viewMode === 'semana'
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
    teacherAssignmentModes, selectedCourses, demandSourceId, demandEstimate, resources, allocationPolicy } = state
  const planningPeriod = state.period
  const chat = useNormativeChat(planningPeriod)
  const planningPolicy = state.policy
  const effectivePolicy = planningPolicy ?? {
    revision: 'FISI-PLANNING-1' as const, period: planningPeriod, allowAfternoon: false, allowSaturday: false,
  }
  const timeProfile = resolvePlanningTimeProfile(effectivePolicy)
  const afternoonStart = resolvePlanningTimeProfile({ ...effectivePolicy, allowAfternoon: true }).seniorStartMinute
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
  const updateTeacherAssignmentMode = (courseId: string, value: AcademicTeacherAssignmentMode) =>
    commands.edit({ type: 'updateTeacherAssignmentMode', courseId, value })
  const updateResources = (value: AcademicPlanningResources) => commands.edit({ type: 'updateResources', value })
  const updateAllocationPolicy = (value: AcademicAllocationPolicy) => commands.edit({ type: 'updateAllocationPolicy', value })
  const updatePlanningException = (key: 'allowAfternoon' | 'allowSaturday', checked: boolean) =>
    commands.edit({ type: 'updatePlanningException', key, checked })
  const setEditingBlock = (adjustment: AcademicAdjustment) => commands.edit({ type: 'changeEditingBlock', adjustment })
  const cancelBlockReview = () => commands.edit({ type: 'cancelBlockReview' })
  const startBlockReview = (block: PlanningBlock) => {
    if (!proposal || lockedDraft || draftBusy) return
    selectSection(block.sectionId)
    commands.edit({ type: 'startBlockReview', block })
  }

  const inspectorOpen = currentStage === 'horario' && Boolean(proposal) && selectedSectionId !== null && detailVisible
  const chatInRail = railLayout && chatOpen && !chatExpanded
  const chatInSheet = chatOpen && !chatInRail
  const railOpen = chatInRail
  const closeInspector = () => {
    const selector = selectedSectionId
      ? viewMode === 'semana' ? `[data-week-section-id="${CSS.escape(selectedSectionId)}"]` : `[data-section-id="${CSS.escape(selectedSectionId)}"] button, button[data-section-id="${CSS.escape(selectedSectionId)}"]`
      : null
    setDetailVisible(false)
    setSelectedSectionId(null)
    cancelBlockReview()
    requestAnimationFrame(() => {
      const target = selector && Array.from(document.querySelectorAll<HTMLElement>(selector)).find(element => element.getClientRects().length > 0)
      const cell = document.querySelector<HTMLElement>('.planning-week__load button[aria-pressed="true"]')
      const focusTarget = target || cell
      focusTarget?.focus({ preventScroll: true })
    })
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

  // Removing a panel leaves the survivor at its previous share; give it the whole group back.
  const workspaceGroupRef = useGroupRef()
  useSolePanelFill(workspaceGroupRef, 'planning-content', !railOpen)
  const reviewPending = () => {
    if (!proposal) return
    const sectionId = proposal.pending[0]?.sectionId
      ?? proposal.sections.find((section) => !proposal.assignments.some((assignment) => assignment.sectionId === section.sectionId))?.sectionId
    if (sectionId) selectSection(sectionId)
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

    <ResizablePanelGroup groupRef={workspaceGroupRef} orientation="horizontal" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged} className="planning-workspace">
    <ResizablePanel id="planning-content" minSize="45%" className="planning-workspace__panel">
    <div className="planning-content-column">
    <PlanningScopeHeader
      title={pageTitle}
      compactWeekLabel={compactWeek ? `Semana · ${teacherFilter === 'all' ? 'Todos los docentes' : teacherFilter === '__unassigned__' ? 'Sin docente asignado' : resources.teachers.find((teacher) => teacher.id === teacherFilter)?.name ?? proposal?.assignments.find((item) => item.teacherId === teacherFilter)?.teacherName ?? 'Docente'}${roomFilter !== 'all' ? ` · ${resources.rooms.find(room => room.id === roomFilter)?.name ?? roomFilter}` : ''}` : undefined}
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
                      onCheckedChange={(checked) => updatePlanningException('allowAfternoon', checked === true)} /><Label htmlFor="planning-allow-afternoon">Permitir propuesta de lunes a viernes desde las {formatAcademicMinute(afternoonStart)} hasta las {formatAcademicMinute(timeProfile.weekdayEndMinute)}</Label></div>
                    <div className="academic-scheduling__exception"><Checkbox id="planning-allow-saturday" disabled={lockedDraft || draftBusy} checked={planningPolicy?.allowSaturday ?? false}
                      onCheckedChange={(checked) => updatePlanningException('allowSaturday', checked === true)} /><Label htmlFor="planning-allow-saturday">Permitir propuesta sábado de {formatAcademicMinute(timeProfile.saturdayStartMinute)} a {formatAcademicMinute(timeProfile.saturdayEndMinute)}</Label></div>
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
          </div>
          <Button variant="ghost" popoverTarget="planning-generation-options" popoverTargetAction="hide">Cerrar opciones</Button>
        </div>
      </> : null}
      proposalActions={<PlanningProposalTrigger
        draftTitle={draftTitle}
        draftVersion={draftVersion}
        planningPeriod={planningPeriod}
        displayedDraftState={view.displayedDraftState}
        draftLabel={view.draftLabel}
        workspaceDirty={workspaceDirty}
        draftListOpen={draftListOpen}
        onOpen={() => { setDraftListOpen(true); void refreshDraftList() }}
      />}
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
    <ResizablePanelGroup orientation="vertical" className="planning-schedule-split">
    <ResizablePanel id="planning-schedule-content" minSize="40%" className="planning-workspace__panel">
    <div ref={scrollerRef} className={`planning-workspace__content ${currentStage === 'preparacion' && preparationView === 'cursos' ? 'planning-workspace__content--courses' : ''}`}>
    {draftError && !draftListOpen && <Alert id="planning-draft-error" variant="destructive" role="alert"><AlertDescription>{draftError}</AlertDescription></Alert>}
    {proposalError && currentStage === 'preparacion' && <Alert id="planning-generation-error" variant="destructive" role="alert"><AlertDescription>{proposalError}</AlertDescription></Alert>}
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
            teacherAssignmentModes={teacherAssignmentModes}
            onUpdateDemand={updateDemand}
            onUpdateCapacity={updateCapacity}
            onUpdatePattern={updatePattern}
            onUpdateDeliveryMode={updateDeliveryMode}
            onUpdateTeacherAssignmentMode={updateTeacherAssignmentMode}
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
            academicPeriod={state.period} chat={chat}
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
            teacherFilter={teacherFilter} onTeacherFilterChange={setTeacherFilter} roomFilter={roomFilter} onRoomFilterChange={setRoomFilter} viewMode={viewMode} onToggleView={handleToggleView} />
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
                    selectSection(sectionId)
                  }}
                  searchQuery={searchQuery}
                  teacherFilter={teacherFilter}
                  roomFilter={roomFilter}
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
                  roomFilter={roomFilter}
                  onSelectSection={(sectionId) => {
                    selectSection(sectionId)
                  }}
                  onShowPending={() => { setTeacherFilter('__unassigned__'); setRoomFilter('all'); handleToggleView('tabla') }}
                  onStartEditBlock={startBlockReview}
                  onChangeEditingBlock={setEditingBlock}
                  isLocked={lockedDraft || draftBusy}
                />
              </div>
            </div>

            {inspectorOpen && (
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
                onViewWeek={() => { setDetailVisible(false); handleToggleView('semana') }}
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
      <AcademicPublicationPanel active={currentStage === 'aprobacion'} actionContainer={currentStage === 'aprobacion' ? headActions : null} primaryActionId={approvalAction?.id} draftId={draftId} draftVersion={draftVersion} draftTitle={draftTitle}
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
    </ResizablePanelGroup>
    </div>
    </ResizablePanel>
    {railOpen && <>
      <ResizableHandle withHandle aria-label="Redimensionar asistente" />
      <ResizablePanel id="planning-rail" defaultSize="420px" minSize="320px" maxSize="560px" className="planning-workspace__panel">
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

// The group unregisters a removed panel after this render, so wait a frame and only act once one panel remains.
function useSolePanelFill(groupRef: RefObject<GroupImperativeHandle | null>, panelId: string, sole: boolean) {
  useEffect(() => {
    if (!sole) return
    const frame = requestAnimationFrame(() => {
      const layout = groupRef.current?.getLayout()
      if (layout && Object.keys(layout).length === 1 && (layout[panelId] ?? 100) < 100) groupRef.current?.setLayout({ [panelId]: 100 })
    })
    return () => cancelAnimationFrame(frame)
  }, [groupRef, panelId, sole])
}

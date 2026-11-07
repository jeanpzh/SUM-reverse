import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DataTable } from '../components/Common'
import { fetchAcademicCatalog, estimateAcademicDemand, createAcademicProposal, adjustAcademicProposal, fetchAcademicDrafts, saveAcademicDraft, resumeAcademicDraft, submitAcademicTeacherReview, respondAcademicTeacherReview, formatAcademicInterval, formatAcademicMinute, formatAcademicDuration, toAcademicScheduleEvents, academicSectionLabel, aggregateAcademicBlocks, approveAcademicDraft, publishAcademicDraft, forkAcademicDraft, createAcademicPlanningDefaults, buildAcademicPlanningRequest, PLANNING_LIMITS } from '../data/academicScheduling'
import type { PlanningPeriod, PlanningPolicy } from '../data/academicScheduling'
import type { AcademicCatalog, AcademicDemandEstimate, AcademicProposal } from '../data/academicScheduling'
import type { AcademicAdjustment, AcademicPlanningResources, AcademicAllocationPolicy, AcademicDemandRequest, AcademicDraftList, AcademicDraftState, AcademicWorkspace, AcademicTeacherReview, AcademicSavedDraft } from '../../../shared/programacion-academica-api.mjs'
import { validateAcademicResources, validateAcademicRequest, validateAcademicWorkspace } from '../../../shared/programacion-academica-api.mjs'
import { AcademicResourceEditor } from './AcademicResourceEditor'
import { AcademicDemandPanel } from './AcademicDemandPanel'
import { AcademicTeacherReview as AcademicTeacherReviewPanel } from './AcademicTeacherReview'
import { AcademicPublicationPanel } from './AcademicPublicationPanel'
import { AcademicIntentionDemandPanel } from './AcademicIntentionDemandPanel'
import { WeeklySchedule } from './WeeklySchedule'
import { PlanningScopeHeader } from './PlanningScopeHeader'
import { PlanningStageNav } from './PlanningStageNav'
import { PlanningStatusBar } from './PlanningStatusBar'
import { PlanningSectionsTable } from './PlanningSectionsTable'
import { PlanningInspector } from './PlanningInspector'
import { PlanningWeekView } from './PlanningWeekView'
import type { PlanningStage } from '../routes/local.programacion-academica'
import './AcademicScheduling.css'
import './PlanningWorkbench.css'
import './PlanningSections.css'

function emptyScheduleData() {
  return null
}

export function AcademicScheduling({ currentStage = 'preparacion' }: { currentStage?: PlanningStage } = {}) {
  const [catalog, setCatalog] = useState<AcademicCatalog | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [proposal, setProposal] = useState<AcademicProposal | null>(null)
  const [proposalResources, setProposalResources] = useState<AcademicPlanningResources | null>(null)
  const [editingBlock, setEditingBlock] = useState<AcademicAdjustment | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'tabla' | 'semana'>('tabla')
  const [searchQuery, setSearchQuery] = useState('')
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
  const [adjusting, setAdjusting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [proposalError, setProposalError] = useState<string | null>(null)
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null)
  const [demands, setDemands] = useState<Record<string, string>>({})
  const [capacities, setCapacities] = useState<Record<string, string>>({})
  const [patterns, setPatterns] = useState<Record<string, string>>({})
  const [deliveryModes, setDeliveryModes] = useState<Record<string, 'continuous' | 'split'>>({})
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [demandSourceId, setDemandSourceId] = useState<'existing-regular-v1' | 'independent-120-v1'>('existing-regular-v1')
  const [demandEstimate, setDemandEstimate] = useState<AcademicDemandEstimate | null>(null)
  const [demandLoading, setDemandLoading] = useState(false)
  const [demandError, setDemandError] = useState<string | null>(null)
  const [cycleFilter, setCycleFilter] = useState('all')
  const [resources, setResources] = useState<AcademicPlanningResources>({ teachers: [], rooms: [] })
  const [planningPeriod, setPlanningPeriod] = useState<PlanningPeriod>('2027-I')
  const [planningPolicy, setPlanningPolicy] = useState<PlanningPolicy | null>(null)
  const [allocationPolicy, setAllocationPolicy] = useState<AcademicAllocationPolicy>('preferences')
  const [draftTitle, setDraftTitle] = useState('Propuesta SISTEMAS 2027-I')
  const [draftState, setDraftState] = useState<AcademicDraftState>('draft')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftVersion, setDraftVersion] = useState<number | null>(null)
  const [savedDraftState, setSavedDraftState] = useState<AcademicDraftState>('draft')
  const [savedReview, setSavedReview] = useState<AcademicTeacherReview | undefined>()
  const [workspaceDirty, setWorkspaceDirty] = useState(false)
  const [draftList, setDraftList] = useState<AcademicDraftList | null>(null)
  const [draftListOpen, setDraftListOpen] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  const [draftMessage, setDraftMessage] = useState<string | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [demandBaseRequest, setDemandBaseRequest] = useState<AcademicDemandRequest | null>(null)
  const latestIntent = useRef(0)
  const catalogController = useRef<AbortController | null>(null)
  const demandIntent = useRef(0)
  const demandController = useRef<AbortController | null>(null)
  const draftListIntent = useRef(0)
  const draftSaveIntent = useRef(0)
  const draftResumeIntent = useRef(0)
  const draftController = useRef<AbortController | null>(null)
  const draftListController = useRef<AbortController | null>(null)
  const hydratedFromDraft = useRef(false)
  const workspaceMutation = useRef(0)
  const lockedDraft = savedDraftState === 'approved' || savedDraftState === 'published'

  const markWorkspaceDirty = (configurationChanged = false) => {
    workspaceMutation.current += 1
    setWorkspaceDirty(true)
    setDraftMessage(null)
    if (configurationChanged) setDraftState((current) => current === 'ready-for-review' ? 'draft' : current)
  }

  const invalidateDemandEstimate = useCallback(() => {
    demandIntent.current += 1
    demandController.current?.abort()
    demandController.current = null
    setDemandEstimate(null)
    setDemandLoading(false)
    setDemandError(null)
  }, [])

  const loadCatalog = useCallback(async () => {
    catalogController.current?.abort()
    const controller = new AbortController()
    catalogController.current = controller
    try {
      const value = await fetchAcademicCatalog(globalThis.fetch, controller.signal)
      setCatalog(value)
      if (!hydratedFromDraft.current) {
        const defaults = createAcademicPlanningDefaults(value, '2027-I')
        setDemands(defaults.demands)
        setCapacities(defaults.capacities)
        setPatterns(Object.fromEntries(value.courses.flatMap((course) => course.planningPatterns?.length
          ? [[course.courseId, course.planningPatterns[0].id]] : [])))
        setSelectedCourses([])
      }
      invalidateDemandEstimate()
      if (!hydratedFromDraft.current) {
        const defaults = createAcademicPlanningDefaults(value, '2027-I')
        setResources(defaults.resources)
        setPlanningPolicy(defaults.planningPolicy)
      }
    } catch (error) {
      if (!controller.signal.aborted) setCatalogError(error instanceof Error ? error.message : 'No se pudo consultar el catálogo local.')
    } finally {
      if (!controller.signal.aborted) setLoadingCatalog(false)
    }
  }, [invalidateDemandEstimate])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCatalog(), 0)
    return () => {
      window.clearTimeout(timer)
      catalogController.current?.abort()
      demandController.current?.abort()
      draftController.current?.abort()
      draftListController.current?.abort()
    }
  }, [loadCatalog])

  const retryCatalog = () => {
    setLoadingCatalog(true)
    setCatalogError(null)
    void loadCatalog()
  }

  const refreshDraftList = async () => {
    const intent = ++draftListIntent.current
    draftListController.current?.abort()
    const controller = new AbortController()
    draftListController.current = controller
    setDraftError(null)
    try {
      const value = await fetchAcademicDrafts(globalThis.fetch, controller.signal)
      if (intent === draftListIntent.current) setDraftList(value)
    } catch (error) {
      if (intent === draftListIntent.current && !controller.signal.aborted) setDraftError(error instanceof Error
        ? `No se pudieron consultar las propuestas locales. ${error.message}` : 'No se pudieron consultar las propuestas locales.')
    }
  }

  const buildWorkspace = (): AcademicWorkspace => {
    if (!catalog) throw new Error('Espera a que cargue el catálogo local antes de guardar.')
    const requestBase = {
      revision: catalog.revision,
      demands: catalog.courses.filter((course) => selectedCourses.includes(course.courseId)).map((course) => ({
        courseId: course.courseId,
        estimatedDemand: Number(demands[course.courseId]),
        targetCapacity: Number(capacities[course.courseId]),
        ...(patterns[course.courseId] ? { patternId: patterns[course.courseId] } : {}),
        deliveryMode: deliveryModes[course.courseId] ?? 'continuous',
      })),
      allocationPolicy,
      resources: {
        teachers: resources.teachers.map((teacher) => ({ ...teacher, courseIds: [...teacher.courseIds],
          availability: teacher.availability.map((interval) => ({ ...interval })),
          ...(teacher.preferences ? { preferences: teacher.preferences.map((interval) => ({ ...interval })) } : {}),
          ...(teacher.sectionLimits ? { sectionLimits: teacher.sectionLimits.map((limit) => ({ ...limit })) } : {}) })),
        rooms: resources.rooms.map((room) => ({ ...room, availability: room.availability.map((interval) => ({ ...interval })) })),
      },
    }
    const request = planningPolicy ? buildAcademicPlanningRequest(requestBase, planningPolicy) : requestBase
    validateAcademicRequest(request)
    validateAcademicResources(request.resources)
    const baseRequest = planningPeriod === '2027-I' && demandBaseRequest && demandEstimate ? { ...demandBaseRequest,
      courses: demandEstimate.rows.map((row) => ({ courseId: row.courseId, targetCapacity: row.targetCapacity })) } : null
    const workspace: AcademicWorkspace = { schoolId: 'SISTEMAS', academicPeriod: planningPeriod, request,
      demandSourceId, demandBaseRequest: baseRequest }
    validateAcademicWorkspace(workspace)
    return workspace
  }

  const saveDraft = async () => {
    if (draftBusy || lockedDraft) return
    if (!validDemands) {
      setDraftError('Completa demandas y capacidades válidas para todos los cursos seleccionados antes de guardar.')
      return
    }
    if (draftState === 'ready-for-review' && (!proposal || proposal.status !== 'complete'
      || !proposal.coverageComplete || proposal.assignments.length === 0)) {
      setDraftError('Para marcarla lista, genera una propuesta completa con asignaciones válidas.')
      return
    }
    let configuration: AcademicWorkspace
    try {
      configuration = buildWorkspace()
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'La configuración no es válida para guardar.')
      return
    }
    const intent = ++draftSaveIntent.current
    const mutation = workspaceMutation.current
    const controller = new AbortController()
    setDraftBusy(true)
    setDraftError(null)
    setDraftMessage(null)
    try {
      const saved = await saveAcademicDraft({ id: draftId, expectedVersion: draftVersion, title: draftTitle,
        state: savedReview ? 'draft' : draftState === 'ready-for-review' ? 'ready-for-review' : 'draft', configuration,
        proposalId: proposal && proposal.status !== 'invalid-input' ? proposal.proposalId : null,
        proposalEditVersion: proposal && proposal.status !== 'invalid-input' ? proposal.editVersion ?? 0 : null,
      }, globalThis.fetch, controller.signal)
      if (intent !== draftSaveIntent.current) return
      setSavedDraftState(saved.state)
      setSavedReview(saved.review)
      if (mutation === workspaceMutation.current) {
        setDraftId(saved.id)
        setDraftVersion(saved.version)
        setWorkspaceDirty(false)
        setDraftMessage(`Guardada · versión ${saved.version}.`)
      } else {
        setDraftId(saved.id)
        setDraftVersion(saved.version)
        setWorkspaceDirty(true)
        setDraftMessage('Se guardó una captura anterior; la configuración actual sigue pendiente de guardar.')
      }
      void refreshDraftList()
    } catch (error) {
      if (intent === draftSaveIntent.current) setDraftError(error instanceof Error
        ? `No se guardaron los cambios. ${error.message}` : 'No se guardaron los cambios.')
    } finally {
      if (intent === draftSaveIntent.current) setDraftBusy(false)
    }
  }

  const hydrateDraft = (draft: AcademicSavedDraft, message: string) => {
    const config = draft.configuration
    const nextProposal = draft.proposal
    hydratedFromDraft.current = true
    setDraftId(draft.id)
    setDraftVersion(draft.version)
    setDraftTitle(draft.title)
    setDraftState(draft.state)
    setSavedDraftState(draft.state)
    setSavedReview(draft.review)
    setWorkspaceDirty(false)
    workspaceMutation.current += 1
    setPlanningPeriod(config.academicPeriod)
    setPlanningPolicy(config.request.planningPolicy ? { ...config.request.planningPolicy } : null)
    setAllocationPolicy(config.request.allocationPolicy ?? 'preferences')
    setSelectedCourses(config.request.demands.map((item) => item.courseId))
    setDemands((current) => ({ ...current, ...Object.fromEntries(config.request.demands.map((item) => [item.courseId, String(item.estimatedDemand)])) }))
    setCapacities((current) => ({ ...current, ...Object.fromEntries(config.request.demands.map((item) => [item.courseId, String(item.targetCapacity ?? '')])) }))
    setPatterns((current) => ({ ...current, ...Object.fromEntries(config.request.demands.flatMap((item) => item.patternId ? [[item.courseId, item.patternId]] : [])) }))
    setDeliveryModes((current) => ({ ...current, ...Object.fromEntries(config.request.demands.map((item) => [item.courseId, item.deliveryMode ?? 'continuous'])) }))
    setDemandSourceId(config.demandSourceId)
    setDemandBaseRequest(config.demandBaseRequest)
    setDemandEstimate(draft.demandBase)
    setResources({ teachers: config.request.resources.teachers.map((teacher) => ({ ...teacher,
      courseIds: [...teacher.courseIds], availability: teacher.availability.map((interval) => ({ ...interval })),
      ...(teacher.preferences ? { preferences: teacher.preferences.map((interval) => ({ ...interval })) } : {}),
      ...(teacher.sectionLimits ? { sectionLimits: teacher.sectionLimits.map((limit) => ({ ...limit })) } : {}) })),
    rooms: config.request.resources.rooms.map((room) => ({ ...room, availability: room.availability.map((interval) => ({ ...interval })) })) })
    setProposal(nextProposal)
    setProposalResources(nextProposal ? config.request.resources : null)
    setEditingBlock(null)
    setDraftMessage(message)
    setDraftListOpen(false)
  }

  const resumeDraft = async (id: string, version: number) => {
    if (workspaceDirty && !window.confirm('Hay cambios locales sin guardar. ¿Descartarlos y continuar con esta propuesta?')) return
    const intent = ++draftResumeIntent.current
    const mutation = workspaceMutation.current
    latestIntent.current += 1
    demandIntent.current += 1
    draftSaveIntent.current += 1
    draftController.current?.abort()
    demandController.current?.abort()
    setGenerating(false)
    setAdjusting(false)
    setDemandLoading(false)
    setProposalError(null)
    setAdjustmentError(null)
    setDemandError(null)
    setDraftError(null)
    setDraftMessage(null)
    setDraftBusy(true)
    const controller = new AbortController()
    draftController.current = controller
    try {
      const { draft } = await resumeAcademicDraft(id, version, globalThis.fetch, controller.signal)
      if (intent !== draftResumeIntent.current) return
      if (mutation !== workspaceMutation.current) {
        setDraftMessage('No se aplicó la recuperación porque la edición cambió mientras se consultaba. Puedes volver a abrir la propuesta.')
        return
      }
      hydrateDraft(draft, `Propuesta ${draft.title} recuperada.${draft.state === 'approved' || draft.state === 'published'
        ? ' Es una versión congelada de solo lectura; crea un nuevo borrador para continuar.' : ' Puedes continuar editando el horario.'}`)
    } catch (error) {
      if (intent === draftResumeIntent.current && !controller.signal.aborted) setDraftError(error instanceof Error
        ? `No se abrió la propuesta; se conserva la edición actual. ${error.message}` : 'No se abrió la propuesta; se conserva la edición actual.')
    } finally {
      if (intent === draftResumeIntent.current) setDraftBusy(false)
    }
  }

  const approveDraft = async () => {
    if (!draftId || !draftVersion || workspaceDirty || draftBusy || generating || adjusting || demandLoading || savedDraftState !== 'ready-for-approval') return
    setDraftBusy(true)
    setDraftError(null)
    setDraftMessage(null)
    try {
      const saved = await approveAcademicDraft(draftId, draftVersion)
      setDraftId(saved.id)
      setDraftVersion(saved.version)
      setDraftState(saved.state)
      setSavedDraftState(saved.state)
      setSavedReview(saved.review)
      setDraftMessage(`Aprobada (simulada) · versión ${saved.version}.`)
      void refreshDraftList()
    } catch (error) {
      setDraftError(error instanceof Error ? `No se aprobó la propuesta. ${error.message}` : 'No se aprobó la propuesta.')
    } finally {
      setDraftBusy(false)
    }
  }

  const publishDraft = async (expectedCurrentId: string | null) => {
    if (!draftId || !draftVersion || workspaceDirty || draftBusy || generating || adjusting || demandLoading || savedDraftState !== 'approved') return
    setDraftBusy(true)
    setDraftError(null)
    setDraftMessage(null)
    try {
      const saved = await publishAcademicDraft(draftId, { expectedVersion: draftVersion, expectedCurrentId })
      setDraftId(saved.id)
      setDraftVersion(saved.version)
      setDraftState(saved.state)
      setSavedDraftState(saved.state)
      setSavedReview(saved.review)
      setDraftMessage(`Publicada (simulada) · publicación ${saved.publication?.publicationVersion ?? '—'} · versión ${saved.version}.`)
      void refreshDraftList()
    } catch (error) {
      setDraftError(error instanceof Error ? `No se publicó la propuesta. ${error.message}` : 'No se publicó la propuesta.')
    } finally {
      setDraftBusy(false)
    }
  }

  const forkDraft = async (id: string, version: number) => {
    if (workspaceDirty && !window.confirm('Hay cambios locales sin guardar. ¿Descartarlos y crear un nuevo borrador?')) return
    if (draftBusy || generating || adjusting || demandLoading) return
    const mutation = workspaceMutation.current
    setDraftBusy(true)
    setDraftError(null)
    setDraftMessage(null)
    try {
      const draft = await forkAcademicDraft(id, version)
      if (mutation !== workspaceMutation.current) {
        setDraftMessage('No se aplicó el nuevo borrador porque la edición cambió mientras se consultaba. Puedes volver a intentarlo.')
        return
      }
      hydrateDraft(draft, `Nuevo borrador creado desde ${id.slice(0, 8)}. Puedes continuar editando el horario.`)
    } catch (error) {
      setDraftError(error instanceof Error ? `No se creó el nuevo borrador. ${error.message}` : 'No se creó el nuevo borrador.')
    } finally {
      setDraftBusy(false)
    }
  }

  const submitTeacherReview = async () => {
    if (!draftId || !draftVersion || workspaceDirty || draftBusy || !proposal || proposal.status !== 'complete'
      || !proposal.coverageComplete || proposal.assignments.length === 0) return
    const mutation = workspaceMutation.current
    setDraftBusy(true)
    setReviewError(null)
    setDraftError(null)
    try {
      const saved = await submitAcademicTeacherReview(draftId, { expectedVersion: draftVersion })
      setDraftId(saved.id)
      setDraftVersion(saved.version)
      setSavedDraftState(saved.state)
      setSavedReview(saved.review)
      if (mutation !== workspaceMutation.current) {
        setWorkspaceDirty(true)
        setDraftMessage('La revisión se actualizó sobre la versión guardada; los cambios locales siguen pendientes de guardar.')
      } else setDraftMessage(`Enviada a revisión · ronda ${saved.review?.round ?? '—'} · versión ${saved.version}.`)
      void refreshDraftList()
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'No se pudo enviar la revisión local.')
    } finally {
      setDraftBusy(false)
    }
  }

  const respondTeacherReview = async (teacherId: string, decision: 'conformity' | 'changes-requested', observation: string) => {
    if (!draftId || !draftVersion || !savedReview || workspaceDirty || draftBusy) return
    const mutation = workspaceMutation.current
    setDraftBusy(true)
    setReviewError(null)
    setDraftError(null)
    try {
      const saved = await respondAcademicTeacherReview(draftId, { expectedVersion: draftVersion,
        round: savedReview.round, teacherId, decision, observation })
      setDraftId(saved.id)
      setDraftVersion(saved.version)
      setSavedDraftState(saved.state)
      setSavedReview(saved.review)
      if (mutation !== workspaceMutation.current) {
        setWorkspaceDirty(true)
        setDraftMessage('La respuesta se guardó sobre la versión anterior; los cambios locales siguen pendientes de guardar.')
      } else setDraftMessage(`Respuesta guardada · versión ${saved.version}.`)
      void refreshDraftList()
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'No se pudo guardar la respuesta local.')
    } finally {
      setDraftBusy(false)
    }
  }

  const updateDemand = (courseId: string, value: string) => {
    markWorkspaceDirty(true)
    latestIntent.current += 1
    setProposal(null)
    setProposalResources(null)
    setEditingBlock(null)
    setProposalError(null)
    setAdjustmentError(null)
    setGenerating(false)
    setAdjusting(false)
    setDemands((current) => ({ ...current, [courseId]: value }))
  }

  const invalidateProposal = () => {
    latestIntent.current += 1
    setProposal(null)
    setProposalResources(null)
    setEditingBlock(null)
    setAdjusting(false)
    setProposalError(null)
    setAdjustmentError(null)
    setGenerating(false)
  }

  const toggleCourse = (courseId: string, checked: boolean) => {
    if (checked && selectedCourses.length >= PLANNING_LIMITS.courses) return
    invalidateProposal()
    invalidateDemandEstimate()
    setDemandBaseRequest(null)
    markWorkspaceDirty(true)
    setSelectedCourses((current) => checked
      ? current.includes(courseId) ? current : [...current, courseId]
      : current.filter((id) => id !== courseId))
  }

  const updateCapacity = (courseId: string, value: string) => {
    invalidateProposal()
    invalidateDemandEstimate()
    setDemandBaseRequest(null)
    markWorkspaceDirty(true)
    setCapacities((current) => ({ ...current, [courseId]: value }))
  }

  const changeDemandSource = (value: 'existing-regular-v1' | 'independent-120-v1') => {
    if (value === demandSourceId) return
    invalidateDemandEstimate()
    setDemandBaseRequest(null)
    markWorkspaceDirty(true)
    setDemandSourceId(value)
  }

  const estimateDemand = async () => {
    if (!catalog || planningPeriod !== '2027-I' || !selectedCourses.length) return
    const courses = catalog.courses.filter((course) => selectedCourses.includes(course.courseId))
    const intent = ++demandIntent.current
    demandController.current?.abort()
    const controller = new AbortController()
    demandController.current = controller
    setDemandEstimate(null)
    setDemandError(null)
    setDemandLoading(true)
    try {
      const baseRequest: AcademicDemandRequest = {
        revision: catalog.revision,
        sourceId: demandSourceId,
        targetPeriod: '2027-I',
        courses: courses.map((course) => ({ courseId: course.courseId, targetCapacity: Number(capacities[course.courseId]) })),
      }
      const value = await estimateAcademicDemand(baseRequest, globalThis.fetch, controller.signal)
      if (intent === demandIntent.current) {
        setDemandEstimate(value)
        setDemandBaseRequest(baseRequest)
        markWorkspaceDirty(true)
      }
    } catch (error) {
      if (intent === demandIntent.current && !controller.signal.aborted) setDemandError(error instanceof Error
        ? `No se pudo estimar la demanda potencial local. ${error.message}`
        : 'No se pudo estimar la demanda potencial local.')
    } finally {
      if (intent === demandIntent.current) setDemandLoading(false)
    }
  }

  const updatePattern = (courseId: string, value: string) => {
    invalidateProposal()
    markWorkspaceDirty(true)
    setPatterns((current) => ({ ...current, [courseId]: value }))
  }

  const updateDeliveryMode = (courseId: string, value: 'continuous' | 'split') => {
    invalidateProposal()
    markWorkspaceDirty(true)
    setDeliveryModes((current) => ({ ...current, [courseId]: value }))
  }

  const updateResources = (value: AcademicPlanningResources) => {
    invalidateProposal()
    markWorkspaceDirty(true)
    setResources(value)
  }

  const updateAllocationPolicy = (value: AcademicAllocationPolicy) => {
    invalidateProposal()
    markWorkspaceDirty(true)
    setAllocationPolicy(value)
  }

  const applyPeriodDefaults = (period: PlanningPeriod, force = false) => {
    if (!catalog || (period === planningPeriod && !force)) return
    if (workspaceDirty && !window.confirm('Aplicar valores iniciales para este periodo? Se reemplazarán las demandas y capacidades editadas.')) return
    const defaults = createAcademicPlanningDefaults(catalog, period)
    setPlanningPeriod(period)
    setPlanningPolicy((current) => ({ ...(current ?? defaults.planningPolicy), period }))
    setDemands(defaults.demands)
    setCapacities(defaults.capacities)
    setDemandBaseRequest(null)
    invalidateDemandEstimate()
    invalidateProposal()
    markWorkspaceDirty(true)
  }

  const updatePlanningException = (key: 'allowAfternoon' | 'allowSaturday', checked: boolean) => {
    setPlanningPolicy((current) => ({ revision: 'FISI-PLANNING-1', period: planningPeriod,
      allowAfternoon: current?.allowAfternoon ?? false, allowSaturday: current?.allowSaturday ?? false,
      [key]: checked }))
    invalidateProposal()
    markWorkspaceDirty(true)
  }

  const generate = async () => {
    if (!catalog) return
    markWorkspaceDirty(true)
    const intent = ++latestIntent.current
    setProposal(null)
    setProposalResources(null)
    setEditingBlock(null)
    setAdjusting(false)
    setProposalError(null)
    setAdjustmentError(null)
    setGenerating(true)
    const requestBase = {
      revision: catalog.revision,
      demands: catalog.courses.filter((course) => selectedCourses.includes(course.courseId)).map((course) => ({
        courseId: course.courseId,
        estimatedDemand: demands[course.courseId] === '' ? Number.NaN : Number(demands[course.courseId]),
        targetCapacity: capacities[course.courseId] === '' ? Number.NaN : Number(capacities[course.courseId]),
        ...(patterns[course.courseId] ? { patternId: patterns[course.courseId] } : {}),
        deliveryMode: deliveryModes[course.courseId] ?? 'continuous',
      })),
      allocationPolicy,
      resources: {
        teachers: resources.teachers.map((teacher) => ({ ...teacher, courseIds: [...teacher.courseIds],
          availability: teacher.availability.map((interval) => ({ ...interval })),
          ...(teacher.preferences ? { preferences: teacher.preferences.map((interval) => ({ ...interval })) } : {}),
          ...(teacher.sectionLimits ? { sectionLimits: teacher.sectionLimits.map((limit) => ({ ...limit })) } : {}) })),
        rooms: resources.rooms.map((room) => ({ ...room, availability: room.availability.map((interval) => ({ ...interval })) })),
      },
    }
    try {
      const request = planningPolicy ? buildAcademicPlanningRequest(requestBase, planningPolicy) : requestBase
      validateAcademicResources(request.resources)
      const value = await createAcademicProposal(request)
      if (intent === latestIntent.current) {
        setProposal(value)
        setProposalResources(request.resources)
        markWorkspaceDirty()
      }
    } catch (error) {
      if (intent === latestIntent.current) setProposalError(error instanceof Error
        ? `No se pudo generar la propuesta local. Revisa docentes, aulas y disponibilidad: ${error.message}`
        : 'No se pudo generar la propuesta local.')
    } finally {
      if (intent === latestIntent.current) setGenerating(false)
    }
  }

  const startBlockReview = (block: ReturnType<typeof aggregateAcademicBlocks>[number]) => {
    if (!proposal) return
    const assignments = proposal.assignments.filter((assignment) => block.sessionIds.includes(assignment.sessionId))
      .sort((left, right) => left.startMinute - right.startMinute || left.sessionId.localeCompare(right.sessionId))
    setSelectedSectionId(block.sectionId)
    setAdjustmentError(null)
    setEditingBlock({ expectedVersion: proposal.editVersion ?? 0, sectionId: block.sectionId,
      sessionIds: assignments.map((assignment) => assignment.sessionId), teacherId: block.teacherId,
      day: block.day, startMinute: block.startMinute, roomIds: assignments.map((assignment) => assignment.roomId) })
  }

  const submitBlockReview = async () => {
    if (!proposal || !editingBlock || adjusting) return
    const intent = ++latestIntent.current
    setAdjusting(true)
    setAdjustmentError(null)
    try {
      const value = await adjustAcademicProposal(proposal.proposalId, editingBlock)
      if (intent === latestIntent.current) {
        setProposal(value)
        setEditingBlock(null)
        markWorkspaceDirty()
      }
    } catch (error) {
      if (intent === latestIntent.current) setAdjustmentError(error instanceof Error
        ? `No se aplicó el ajuste; la propuesta anterior se conserva. ${error.message}`
        : 'No se aplicó el ajuste; la propuesta anterior se conserva.')
    } finally {
      if (intent === latestIntent.current) setAdjusting(false)
    }
  }

  const validDemands = Boolean(catalog) && selectedCourses.length <= PLANNING_LIMITS.courses && catalog!.courses
    .filter((course) => selectedCourses.includes(course.courseId)).every((course) => {
    const value = demands[course.courseId]
    const capacity = capacities[course.courseId]
    const patternIds = course.planningPatterns?.map((pattern) => pattern.id) ?? []
    return value !== undefined && value.trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0
      && capacity !== undefined && capacity.trim() !== '' && Number.isSafeInteger(Number(capacity)) && Number(capacity) > 0
      && (!patternIds.length || patternIds.includes(patterns[course.courseId]))
  })
  const visibleCourses = catalog?.courses.filter((course) => cycleFilter === 'all' || String(course.cycle ?? '') === cycleFilter) ?? []
  const availableCycles = [...new Set(catalog?.courses.map((course) => course.cycle).filter((cycle): cycle is number => cycle !== undefined) ?? [])]
    .sort((left, right) => left - right)
  const blocks = proposal ? aggregateAcademicBlocks(proposal) : []
  const assignmentRows = blocks.map((block) => [
    block.courseName,
    `${academicSectionLabel(proposal!, block.sectionId)} · ${proposal!.manuallyAdjustedSectionIds?.includes(block.sectionId) ? 'Ajustada manualmente' : 'Automática'}`,
    block.teacherName,
    block.roomNames.join(', '),
    ['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][block.day],
    `${formatAcademicMinute(block.startMinute)}–${formatAcademicMinute(block.endMinute)}`,
    block.componentDetails.map((component) => `${component.type} · ${formatAcademicDuration(component.durationMinutes)}`).join(' + '),
  ]) ?? []

  const canSave = Boolean(catalog) && !draftBusy && !lockedDraft && validDemands
  const disabledSaveReason = !catalog
    ? 'Catálogo local no disponible'
    : lockedDraft
      ? 'Versión congelada de solo lectura'
      : !validDemands
        ? 'Demanda y capacidad requeridas'
        : null

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
              onChange={(event) => { setDraftTitle(event.currentTarget.value); markWorkspaceDirty() }} />
          </label>
          <label>Estado
            <select aria-label="Estado de la propuesta" disabled={lockedDraft || draftBusy} value={workspaceDirty && savedDraftState === 'ready-for-approval'
              ? 'draft' : savedReview && ['in-review', 'ready-for-approval'].includes(savedDraftState) ? savedDraftState : draftState} onChange={(event) => {
              setDraftState(event.currentTarget.value as AcademicDraftState)
              markWorkspaceDirty()
            }}>
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
              aria-expanded={draftListOpen} aria-controls="academic-scheduling-saved-proposals"
              onClick={() => {
                const opening = !draftListOpen
                setDraftListOpen(opening)
                if (opening) void refreshDraftList()
              }}>Mis propuestas</button>
          </div>
        </div>
        <p className="academic-scheduling__draft-note">Almacenamiento local compartido; no está asociado a una cuenta.</p>
        {workspaceDirty && <p className="academic-scheduling__draft-note" role="status">
          {draftId ? `Cambios sin guardar · versión guardada ${draftVersion}.` : 'Cambios sin guardar.'}
        </p>}
        {draftMessage && <p className="academic-scheduling__draft-note" role="status">{draftMessage}</p>}
        {draftError && <p className="academic-scheduling__error" role="alert">{draftError}</p>}
        {draftListOpen && <div id="academic-scheduling-saved-proposals" className="academic-scheduling__saved-proposals">
          {draftList?.unavailableCount ? <p role="status">{draftList.unavailableCount} propuesta(s) no se pudieron leer.</p> : null}
          {draftList?.items.length === 0 && <p>No hay propuestas guardadas.</p>}
          {draftList && draftList.items.map((item) => <details className="academic-scheduling__saved-row" key={item.id}>
            <summary>{item.title} · {item.schoolId} · {item.academicPeriod} · {item.state === 'draft' ? 'Borrador' : item.state === 'ready-for-review' ? 'Lista para revisión' : item.state === 'in-review' ? 'En revisión docente' : item.state === 'ready-for-approval' ? 'Lista para aprobación' : item.state === 'approved' ? 'Aprobada (simulada)' : 'Publicada (simulada)'} · v{item.version}</summary>
            <div><span>Actualizada {new Date(item.updatedAt).toLocaleString('es-PE')} · {item.hasSchedule ? 'Con horario' : 'Solo configuración'}</span>
              <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary"
                disabled={draftBusy} onClick={() => void resumeDraft(item.id, item.version)}>{item.state === 'approved' || item.state === 'published' ? 'Consultar' : 'Continuar edición'}</button></div>
          </details>)}
        </div>}
      </section>

      <fieldset className="academic-scheduling__locked-workspace" disabled={lockedDraft || draftBusy}>
        <section className="academic-scheduling__panel" aria-labelledby="academic-scheduling-courses">
          <header className="academic-scheduling__panel-heading">
            <div>
              <h3 id="academic-scheduling-courses">Paso 1 · Seleccionar cursos</h3>
              <p>Selecciona hasta {PLANNING_LIMITS.courses} cursos. La referencia histórica se conserva aparte del patrón usado en la planificación.</p>
            </div>
            <div className="academic-scheduling__panel-meta">
              <span className="academic-scheduling__revision">{catalog?.revision ?? 'PA-DEMO-1'}</span>
              <span>{selectedCourses.length} / {PLANNING_LIMITS.courses} seleccionados</span>
            </div>
          </header>

          {loadingCatalog && <p className="academic-scheduling__state" role="status">Consultando catálogo local…</p>}
          {catalogError && <div className="academic-scheduling__error" role="alert">
            <span>{catalogError}</span>
            <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary" onClick={retryCatalog}>Reintentar</button>
          </div>}
          {catalog && <>
            <div className="academic-scheduling__cycle-filter">
              <label>Periodo de planificación
                <select aria-label="Periodo de planificación" value={planningPeriod}
                  onChange={(event) => applyPeriodDefaults(event.currentTarget.value as PlanningPeriod)}>
                  {!['2026-I', '2026-II', '2027-I', '2027-II'].includes(planningPeriod) && <option value={planningPeriod}>{planningPeriod}</option>}
                  <option value="2026-I">2026-I</option><option value="2026-II">2026-II</option>
                  <option value="2027-I">2027-I</option><option value="2027-II">2027-II</option>
                </select>
              </label>
              <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary"
                onClick={() => applyPeriodDefaults(planningPeriod, true)}>Aplicar valores iniciales del periodo</button>
              <p>Al cambiar de periodo se aplican los valores iniciales a demanda y capacidad. Los ajustes requieren confirmación si hay cambios pendientes.</p>
            </div>
            <label className="academic-scheduling__cycle-filter">Filtrar por ciclo
              <select aria-label="Filtrar cursos por ciclo" value={cycleFilter} onChange={(event) => setCycleFilter(event.currentTarget.value)}>
                <option value="all">Todos</option>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((cycle) => <option key={cycle} value={cycle}>Ciclo {cycle}</option>)}
              </select>
              {availableCycles.length === 0 && <span>El catálogo no especifica ciclos.</span>}
            </label>
            <div className="academic-scheduling__courses">
              {visibleCourses.map((course) => <article className="academic-scheduling__course" key={course.courseId}>
                <label className="academic-scheduling__selection">
                  <input type="checkbox" checked={selectedCourses.includes(course.courseId)}
                    disabled={!selectedCourses.includes(course.courseId) && selectedCourses.length >= PLANNING_LIMITS.courses}
                    aria-label={`Seleccionar ${course.courseId}`} onChange={(event) => toggleCourse(course.courseId, event.currentTarget.checked)} />
                  Incluir en la propuesta
                </label>
                <div className="academic-scheduling__course-title">
                  <strong>{course.name}</strong>
                  <span>{course.courseId}</span>
                </div>
                <label>
                  Demanda final de planificación
                  <input type="number" min="0" step="1" inputMode="numeric" value={demands[course.courseId] ?? ''}
                    disabled={!selectedCourses.includes(course.courseId)}
                    aria-label={`Demanda ${course.courseId}`}
                    onChange={(event) => updateDemand(course.courseId, event.currentTarget.value)} />
                </label>
                <label>
                  Capacidad objetivo
                  <input type="number" min="1" step="1" inputMode="numeric" value={capacities[course.courseId] ?? ''}
                    disabled={!selectedCourses.includes(course.courseId)} aria-label={`Capacidad ${course.courseId}`}
                    onChange={(event) => updateCapacity(course.courseId, event.currentTarget.value)} />
                </label>
                {course.planningPatterns && course.planningPatterns.length > 0 && <label>
                  Patrón semanal de planificación
                  <select value={patterns[course.courseId] ?? ''} disabled={!selectedCourses.includes(course.courseId)}
                    aria-label={`Patrón ${course.courseId}`} onChange={(event) => updatePattern(course.courseId, event.currentTarget.value)}>
                    {course.planningPatterns.map((pattern) => <option key={pattern.id} value={pattern.id}>
                      {pattern.label} — {pattern.weeklySessions.map((session) => `${session.type ?? 'Sesión'} ${session.durationMinutes} min`).join(', ')}
                    </option>)}
                  </select>
                </label>}
                <label>
                  Modalidad de sesiones
                  <select value={deliveryModes[course.courseId] ?? 'continuous'} disabled={!selectedCourses.includes(course.courseId)}
                    aria-label={`Modalidad de sesiones ${course.courseId}`}
                    onChange={(event) => updateDeliveryMode(course.courseId, event.currentTarget.value as 'continuous' | 'split')}>
                    <option value="continuous">Bloque continuo · predeterminado</option>
                    <option value="split">Sesiones divididas · excepción</option>
                  </select>
                </label>
                <dl>
                  {course.cycle !== undefined && <div><dt>Ciclo</dt><dd>{course.cycle}</dd></div>}
                  {course.credits !== undefined && <div><dt>Créditos</dt><dd>{course.credits}</dd></div>}
                  <div><dt>Sesiones del patrón</dt><dd>{(course.planningPatterns?.find((pattern) => pattern.id === patterns[course.courseId])?.weeklySessions ?? course.weeklySessions).length}</dd></div>
                  <div><dt>Secciones estimadas</dt><dd>{proposal?.status === 'invalid-input' ? 'Entrada inválida' : proposal
                    ? proposal.sections.filter((section) => section.courseId === course.courseId).length
                    : 'Se calculará al generar'}</dd></div>
                </dl>
                {course.history && <details className="academic-scheduling__history">
                  <summary>Referencia histórica · {course.history.sections.length} secciones</summary>
                  <div className="academic-scheduling__history-content">
                    {course.history.sections.map((section) => <div className="academic-scheduling__history-section" key={section.sectionId}>
                      <strong>Sección {section.sectionId} · capacidad histórica {section.capacity}</strong>
                      <ul>{section.sessions.map((session, index) => <li key={`${section.sectionId}-${index}`}>
                        {formatAcademicInterval(session)} · {session.type} · {session.room} · {session.teacherName
                          ? `Docente de referencia: ${session.teacherName}` : session.teacherId}
                      </li>)}</ul>
                    </div>)}
                  </div>
                </details>}
              </article>)}
            </div>
            {planningPeriod === '2027-I' ? <AcademicDemandPanel sourceId={demandSourceId} onSourceChange={changeDemandSource}
              courses={catalog.courses.filter((course) => selectedCourses.includes(course.courseId)).map((course) => ({
                courseId: course.courseId, name: course.name, targetCapacity: capacities[course.courseId] ?? '', finalDemand: demands[course.courseId] ?? '',
              }))}
              estimate={demandEstimate} loading={demandLoading} error={demandError}
              onEstimate={() => void estimateDemand()} onUseBase={(courseId, value) => updateDemand(courseId, String(value))} />
              : <p className="academic-scheduling__resource-note" role="note">El estimador de demanda potencial solo tiene ámbito sintético 2027-I. Para {planningPeriod}, ingresa la demanda de planificación manualmente.</p>}
          </>}
        </section>

        {catalog && <section className="academic-scheduling__section" aria-labelledby="academic-scheduling-resource-editor">
          <div className="academic-scheduling__step-heading"><h3 id="academic-scheduling-resource-editor">Paso 2 · Configurar recursos</h3>
            <p>Los nombres de referencia provienen del escenario sintético y no confirman asignaciones del nuevo periodo.</p></div>
          <AcademicResourceEditor catalog={catalog} resources={resources} onChange={updateResources} />
          <div className="academic-scheduling__general-windows"><strong>Franjas generales del catálogo</strong>
            <span>La disponibilidad de cada recurso se intersecta con estas franjas; no se deduce del historial.</span>
            <ul>{catalog.windows.map((window, index) => <li key={index}>{formatAcademicInterval(window)}</li>)}</ul>
          </div>
        </section>}

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
            <button type="button" className="academic-scheduling__button" disabled={!validDemands || generating}
              onClick={() => void generate()}>{generating ? 'Generando…' : 'Generar horarios'}</button>
            {!validDemands && <span>Ingresa demanda válida y capacidad entera positiva para cada curso seleccionado. Sin selección se genera una propuesta vacía.</span>}
          </div>
        </section>}
        {proposalError && <p className="academic-scheduling__error" role="alert">{proposalError}</p>}
      </fieldset>
    </section>

    {/* Stage 2: Horario */}
    <section
      className="planning-stage-panel planning-stage-panel--horario"
      hidden={currentStage !== 'horario'}
      aria-label="Etapa de horario"
    >
      <fieldset className="academic-scheduling__locked-workspace" disabled={lockedDraft || draftBusy}>
        {proposalError && <p className="academic-scheduling__error" role="alert">{proposalError}</p>}
        {!proposal && (
          <div className="academic-scheduling__empty-stage">
            <p>No hay una propuesta generada. Ve a la etapa de <strong>Preparación</strong> y selecciona <strong>Generar horarios</strong>.</p>
          </div>
        )}
        {proposal && <>
          <PlanningStatusBar
            proposal={proposal}
            onRegenerate={() => void generate()}
            onReviewPending={() => {
              const firstPending = proposal.pending[0]
              if (firstPending) setSelectedSectionId(firstPending.sectionId)
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

                <section className="academic-scheduling__section" aria-labelledby="academic-scheduling-assignments">
                  <h3 id="academic-scheduling-assignments">Asignaciones de horario</h3>
                  <p className="academic-scheduling__resource-note">Los nombres identifican recursos de esta propuesta local. Un nombre de referencia sintético no confirma una asignación para el nuevo periodo.</p>
                  <div role="region" aria-label="Programación generada">
                    <DataTable className="academic-scheduling__assignments-table" headers={['Asignatura', 'Sección', 'Docente asignado · nuevo periodo', 'Ambiente(s)', 'Día', 'Hora', 'Componentes incluidos']} rows={assignmentRows} empty="No hay componentes asignados." />
                  </div>
                  <p className="academic-scheduling__resource-note">Asignaciones propuestas para el nuevo periodo; no están confirmadas.</p>
                  <WeeklySchedule data={emptyScheduleData()} displayEvents={toAcademicScheduleEvents(proposal)} />
                </section>
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
                  setEditingBlock(null)
                  setAdjustmentError(null)
                }}
                onStartEdit={startBlockReview}
                onCancelEdit={() => {
                  setEditingBlock(null)
                  setAdjustmentError(null)
                }}
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
      <fieldset className="academic-scheduling__locked-workspace" disabled={lockedDraft || draftBusy}>
        <AcademicTeacherReviewPanel key={`${draftId ?? 'new'}-${savedReview?.round ?? 0}`} review={savedReview} proposal={proposal} draftId={draftId} draftVersion={draftVersion}
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
      <AcademicPublicationPanel draftId={draftId} draftVersion={draftVersion} draftTitle={draftTitle}
        draftState={savedDraftState} dirty={workspaceDirty} busy={draftBusy || generating || adjusting || demandLoading} onApprove={approveDraft}
        onPublish={publishDraft} onFork={forkDraft} onBusyChange={setDraftBusy} onError={setDraftError} onMessage={setDraftMessage} />
      <AcademicIntentionDemandPanel dirty={workspaceDirty} busy={draftBusy || generating || adjusting || demandLoading}
        onFork={(id, version) => void forkDraft(id, version)} potential={demandEstimate}
        finalDemand={Object.fromEntries(selectedCourses.map((courseId) => [courseId, demands[courseId] ?? '']))} />
    </section>
  </section>
}

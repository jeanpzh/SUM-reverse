import { useCallback, useEffect, useRef, useState } from 'react'
import { DataTable, PageTitle } from '../components/Common'
import { fetchAcademicCatalog, estimateAcademicDemand, createAcademicProposal, adjustAcademicProposal, fetchAcademicDrafts, saveAcademicDraft, resumeAcademicDraft, submitAcademicTeacherReview, respondAcademicTeacherReview, formatAcademicInterval, formatAcademicMinute, formatAcademicDuration, toAcademicScheduleEvents, academicSectionLabel, academicSessionLabel, aggregateAcademicBlocks, academicSectionCoverage, approveAcademicDraft, publishAcademicDraft, forkAcademicDraft } from '../data/academicScheduling'
import type { AcademicCatalog, AcademicDemandEstimate, AcademicProposal } from '../data/academicScheduling'
import type { AcademicAdjustment, AcademicPlanningResources, AcademicAllocationPolicy, AcademicDemandRequest, AcademicDraftList, AcademicDraftState, AcademicWorkspace, AcademicTeacherReview, AcademicSavedDraft } from '../../../shared/programacion-academica-api.mjs'
import { validateAcademicResources, validateAcademicRequest, validateAcademicWorkspace } from '../../../shared/programacion-academica-api.mjs'
import { AcademicResourceEditor } from './AcademicResourceEditor'
import { AcademicDemandPanel } from './AcademicDemandPanel'
import { AcademicTeacherReview as AcademicTeacherReviewPanel } from './AcademicTeacherReview'
import { AcademicPublicationPanel } from './AcademicPublicationPanel'
import { AcademicIntentionDemandPanel } from './AcademicIntentionDemandPanel'
import { WeeklySchedule } from './WeeklySchedule'
import './AcademicScheduling.css'

function statusLabel(status: AcademicProposal['status']) {
  switch (status) {
    case 'complete': return 'Programación completa'
    case 'impossible': return 'Sin solución completa en el dominio configurado'
    case 'search-limit': return 'Búsqueda inconclusa por límite computacional'
    case 'invalid-input': return 'Demanda fuera de los límites del generador'
  }
}

function emptyScheduleData() {
  return null
}

export function AcademicScheduling() {
  const [catalog, setCatalog] = useState<AcademicCatalog | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [proposal, setProposal] = useState<AcademicProposal | null>(null)
  const [proposalResources, setProposalResources] = useState<AcademicPlanningResources | null>(null)
  const [editingBlock, setEditingBlock] = useState<AcademicAdjustment | null>(null)
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
        setDemands(Object.fromEntries(value.courses.map((course) => [course.courseId, String(course.estimatedDemand)])))
        setCapacities(Object.fromEntries(value.courses.map((course) => [course.courseId, String(course.targetCapacity)])))
        setPatterns(Object.fromEntries(value.courses.flatMap((course) => course.planningPatterns?.length
          ? [[course.courseId, course.planningPatterns[0].id]] : [])))
        setSelectedCourses([])
      }
      invalidateDemandEstimate()
      if (!hydratedFromDraft.current) setResources({ teachers: value.teachers.map((teacher) => ({ ...teacher, courseIds: [...teacher.courseIds],
        availability: teacher.availability.map((interval) => ({ ...interval })),
        ...(teacher.preferences ? { preferences: teacher.preferences.map((interval) => ({ ...interval })) } : {}),
        ...(teacher.sectionLimits ? { sectionLimits: teacher.sectionLimits.map((limit) => ({ ...limit })) } : {}) })),
      rooms: value.rooms.map((room) => ({ ...room, availability: room.availability.map((interval) => ({ ...interval })) })) })
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
    const request = {
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
    validateAcademicRequest(request)
    validateAcademicResources(request.resources)
    const baseRequest = demandBaseRequest && demandEstimate ? { ...demandBaseRequest,
      courses: demandEstimate.rows.map((row) => ({ courseId: row.courseId, targetCapacity: row.targetCapacity })) } : null
    const workspace: AcademicWorkspace = { schoolId: 'SISTEMAS', academicPeriod: '2027-I', request,
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
    if (checked && selectedCourses.length >= 32) return
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
    if (!catalog || !selectedCourses.length) return
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
    const request = {
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

  const validDemands = Boolean(catalog) && selectedCourses.length <= 32 && catalog!.courses
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
  const sectionCoverage = proposal ? academicSectionCoverage(proposal) : { complete: 0, partial: 0, pending: 0 }
  const blocksBySection = new Map<string, typeof blocks>()
  for (const block of blocks) blocksBySection.set(block.sectionId, [...(blocksBySection.get(block.sectionId) ?? []), block])
  const sectionRows = proposal?.sections.map((section) => [
    section.courseId,
    section.courseName,
    academicSectionLabel(proposal!, section.sectionId),
    section.capacity,
    proposal.assignments.find((assignment) => assignment.sectionId === section.sectionId)?.teacherName ?? 'Pendiente',
    <div className="academic-scheduling__section-actions">
      {proposal.manuallyAdjustedSectionIds?.includes(section.sectionId) && <span className="academic-scheduling__manual-badge">Ajustada</span>}
      {(blocksBySection.get(section.sectionId)?.length ?? 0) > 0
        ? <button type="button" className="academic-scheduling__text-button" disabled={adjusting}
          aria-expanded={editingBlock?.sectionId === section.sectionId}
          aria-controls="academic-scheduling-manual-editor"
          onClick={() => startBlockReview(blocksBySection.get(section.sectionId)![0])}>Editar horario</button>
        : <span className="academic-scheduling__no-schedule">Sin asignaciones</span>}
    </div>,
  ]) ?? []
  const assignmentRows = blocks.map((block) => [
    block.courseName,
    `${academicSectionLabel(proposal!, block.sectionId)} · ${proposal!.manuallyAdjustedSectionIds?.includes(block.sectionId) ? 'Ajustada manualmente' : 'Automática'}`,
    block.teacherName,
    block.roomNames.join(', '),
    ['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][block.day],
    `${formatAcademicMinute(block.startMinute)}–${formatAcademicMinute(block.endMinute)}`,
    block.componentDetails.map((component) => `${component.type} · ${formatAcademicDuration(component.durationMinutes)}`).join(' + '),
  ]) ?? []
  const activeBlock = editingBlock && blocks.find((block) => block.sectionId === editingBlock.sectionId
    && block.sessionIds.length === editingBlock.sessionIds.length
    && block.sessionIds.every((id, index) => id === editingBlock.sessionIds[index]))
  const activeSection = activeBlock && proposal?.sections.find((item) => item.sectionId === activeBlock.sectionId)
  const activeBlocks = activeBlock ? blocksBySection.get(activeBlock.sectionId) ?? [] : []
  const activeAssignments = activeBlock && proposal ? proposal.assignments.filter((assignment) => activeBlock.sessionIds.includes(assignment.sessionId))
    .sort((left, right) => left.startMinute - right.startMinute || left.sessionId.localeCompare(right.sessionId)) : []

  return <section className="screen-academic-scheduling">
    <PageTitle>Programación académica asistida</PageTitle>
    <div className="academic-scheduling__notice" role="note">
      <strong>Prototipo local con datos sintéticos.</strong>
      <span>No es una pantalla oficial SUM y no requiere ni otorga permisos administrativos.</span>
      {catalog?.source && <span className="academic-scheduling__provenance">
        Fuente: {catalog.source.kind} · {catalog.source.reference} · periodo de referencia: {catalog.source.sourcePeriod} · planificación: {catalog.source.planningPeriod}. {catalog.source.assumptions}
      </span>}
    </div>

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
          <button type="button" className="academic-scheduling__button" disabled={!catalog || draftBusy || lockedDraft || !validDemands}
            onClick={() => void saveDraft()}>{draftBusy ? 'Guardando…' : 'Guardar propuesta'}</button>
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
      <fieldset className="academic-scheduling__locked-workspace" disabled={lockedDraft || draftBusy}>
      <AcademicTeacherReviewPanel key={`${draftId ?? 'new'}-${savedReview?.round ?? 0}`} review={savedReview} proposal={proposal} draftId={draftId} draftVersion={draftVersion}
        derivedState={workspaceDirty ? `${savedDraftState === 'ready-for-approval' ? 'La versión guardada está lista para aprobación' : savedDraftState === 'in-review' ? 'La versión guardada está en revisión docente' : savedDraftState === 'ready-for-review' ? 'La versión guardada está lista para revisión' : savedDraftState === 'approved' ? 'La versión guardada está aprobada (simulada)' : savedDraftState === 'published' ? 'La versión guardada está publicada (simulada)' : 'Borrador'}; cambios locales sin guardar` : savedDraftState === 'ready-for-approval' ? 'Lista para aprobación' : savedDraftState === 'in-review' ? 'En revisión docente' : savedDraftState === 'ready-for-review' ? 'Lista para revisión' : savedDraftState === 'approved' ? 'Aprobada (simulada)' : savedDraftState === 'published' ? 'Publicada (simulada)' : 'Borrador'}
        dirty={workspaceDirty} busy={draftBusy} error={reviewError} onSubmit={() => void submitTeacherReview()}
        onRespond={(teacherId, decision, observation) => void respondTeacherReview(teacherId, decision, observation)} />
      </fieldset>
      {lockedDraft && <p className="academic-scheduling__draft-note" role="status">
        {savedDraftState === 'approved' ? 'Aprobada (simulada).' : 'Publicada (simulada).'} Versión congelada de solo lectura; el horario y las respuestas de revisión no se pueden guardar en este documento.
      </p>}
      <AcademicPublicationPanel draftId={draftId} draftVersion={draftVersion} draftTitle={draftTitle}
        draftState={savedDraftState} dirty={workspaceDirty} busy={draftBusy || generating || adjusting || demandLoading} onApprove={approveDraft}
        onPublish={publishDraft} onFork={forkDraft} onBusyChange={setDraftBusy} onError={setDraftError} onMessage={setDraftMessage} />
      <AcademicIntentionDemandPanel dirty={workspaceDirty} busy={draftBusy || generating || adjusting || demandLoading}
        onFork={(id, version) => void forkDraft(id, version)} potential={demandEstimate}
        finalDemand={Object.fromEntries(selectedCourses.map((courseId) => [courseId, demands[courseId] ?? '']))} />
    </section>

    <fieldset className="academic-scheduling__locked-workspace" disabled={lockedDraft || draftBusy}>
    <section className="academic-scheduling__panel" aria-labelledby="academic-scheduling-courses">
      <header className="academic-scheduling__panel-heading">
        <div>
          <h3 id="academic-scheduling-courses">Paso 1 · Seleccionar cursos</h3>
          <p>Selecciona hasta 32 cursos. La referencia histórica se conserva aparte del patrón usado en la planificación.</p>
        </div>
        <div className="academic-scheduling__panel-meta">
          <span className="academic-scheduling__revision">{catalog?.revision ?? 'PA-DEMO-1'}</span>
          <span>{selectedCourses.length} / 32 seleccionados</span>
        </div>
      </header>

      {loadingCatalog && <p className="academic-scheduling__state" role="status">Consultando catálogo local…</p>}
      {catalogError && <div className="academic-scheduling__error" role="alert">
        <span>{catalogError}</span>
        <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary" onClick={retryCatalog}>Reintentar</button>
      </div>}
      {catalog && <>
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
                disabled={!selectedCourses.includes(course.courseId) && selectedCourses.length >= 32}
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
        <AcademicDemandPanel sourceId={demandSourceId} onSourceChange={changeDemandSource}
          courses={catalog.courses.filter((course) => selectedCourses.includes(course.courseId)).map((course) => ({
            courseId: course.courseId, name: course.name, targetCapacity: capacities[course.courseId] ?? '', finalDemand: demands[course.courseId] ?? '',
          }))}
          estimate={demandEstimate} loading={demandLoading} error={demandError}
          onEstimate={() => void estimateDemand()} onUseBase={(courseId, value) => updateDemand(courseId, String(value))} />
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
        <p>Se envían todos los cursos seleccionados, incluidos los que estén ocultos por el filtro de ciclo.</p>
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
    {proposal && <>
      <section className={`academic-scheduling__result academic-scheduling__result--${proposal.status}`} aria-labelledby="academic-scheduling-result" role="status">
        <div className="academic-scheduling__result-heading">
          <div><h3 id="academic-scheduling-result">Paso 4 · Resultados · {statusLabel(proposal.status)}</h3>
            <p>{proposal.coverageComplete ? 'Todos los componentes requeridos fueron asignados.'
              : proposal.counts.scheduledSessions === 0 ? 'Sin asignaciones. Las secciones pendientes no demuestran por sí solas que falte un docente.'
                : `Propuesta parcial no definitiva: ${sectionCoverage.complete} secciones completas, ${sectionCoverage.partial} parciales y ${sectionCoverage.pending} pendientes.`}</p>
          </div>
          <span><span className="academic-scheduling__status-code">{proposal.status}</span> · COMPONENTES {proposal.counts.scheduledSessions} / {proposal.counts.requiredSessions}</span>
        </div>
        <dl className="academic-scheduling__counts">
          <div><dt>Secciones</dt><dd>{proposal.counts.sections}</dd></div>
          <div><dt>Completas</dt><dd>{sectionCoverage.complete}</dd></div>
          <div><dt>Parciales</dt><dd>{sectionCoverage.partial}</dd></div>
          <div><dt>Pendientes</dt><dd>{sectionCoverage.pending}</dd></div>
          <div><dt>Componentes asignados</dt><dd>{proposal.counts.scheduledSessions}</dd></div>
          <div><dt>Componentes requeridos</dt><dd>{proposal.counts.requiredSessions}</dd></div>
          <div><dt>Bloques generados</dt><dd>{blocks.length}</dd></div>
        </dl>
        {proposal.preferenceReport && <div className="academic-scheduling__preference-report">
          <h4>Resultado de preferencias · {proposal.preferenceReport.policy}</h4>
          <p>{proposal.preferenceReport.withinPreferenceSections} secciones dentro de preferencia, {proposal.preferenceReport.outsidePreferenceSections} fuera y {proposal.preferenceReport.withoutPreferenceSections} sin preferencia evaluable. La búsqueda no demuestra un óptimo global.</p>
        </div>}
        <p className="academic-scheduling__stats">Búsqueda local: {proposal.stats.exploredCandidates} candidatos explorados, {proposal.stats.candidateVisits} visitas y {proposal.stats.backtracks} retrocesos.
          {proposal.stats.limitReason && <> Límite: {proposal.stats.limitReason}.</>}</p>
        {proposal.pending.length > 0 && <>
          <h4>Componentes pendientes</h4>
          <DataTable headers={['Curso', 'Sección', 'Componente', 'Duración']} rows={proposal.pending.map((pending) => [
            proposal.sections.find((section) => section.sectionId === pending.sectionId)?.courseName ?? pending.courseId,
            academicSectionLabel(proposal, pending.sectionId), 'Componente pendiente', formatAcademicDuration(pending.durationMinutes),
          ])} />
        </>}
        {proposal.diagnostics.length > 0 && <div className="academic-scheduling__diagnostics">
          <h4>Diagnósticos</h4>
          <ul>{proposal.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.code}-${index}`}>
            <strong>{diagnostic.code}</strong> — {diagnostic.message}
            {diagnostic.sessionIds.length > 0 && <span> Sesiones: {diagnostic.sessionIds.map((id) => academicSessionLabel(proposal, id)).join('; ')}.</span>}
          </li>)}</ul>
        </div>}
      </section>

      <section className="academic-scheduling__section" aria-labelledby="academic-scheduling-sections">
        <h3 id="academic-scheduling-sections">Secciones propuestas</h3>
        <DataTable className="academic-scheduling__sections-table" headers={['Código', 'Asignatura', 'Sección', 'Capacidad', 'Docente responsable', 'Acciones']} rows={sectionRows} empty="La propuesta no generó secciones." />
        {proposalResources && activeBlock && editingBlock && activeSection && <section id="academic-scheduling-manual-editor" className="academic-scheduling__manual-review" aria-labelledby="academic-scheduling-manual-review">
          <header className="academic-scheduling__manual-heading">
            <div>
              <h4 id="academic-scheduling-manual-review">Editar horario · {activeBlock.courseName} · Sección {academicSectionLabel(proposal, activeBlock.sectionId)}</h4>
              <p>El ajuste usa los recursos originales de esta propuesta. Las preferencias ordenan alternativas, pero no garantizan un óptimo global.</p>
            </div>
            {activeBlocks.length > 1 && <label className="academic-scheduling__block-select">Bloque horario
              <select aria-label={`Bloque horario ${activeBlock.sectionId}`} value={activeBlock.sessionIds.join('|')} disabled={adjusting}
                onChange={(event) => {
                  const nextBlock = activeBlocks.find((block) => block.sessionIds.join('|') === event.currentTarget.value)
                  if (nextBlock) startBlockReview(nextBlock)
                }}>
                {activeBlocks.map((block) => <option key={block.sessionIds.join('|')} value={block.sessionIds.join('|')}>
                  {['—', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][block.day]} {formatAcademicMinute(block.startMinute)}–{formatAcademicMinute(block.endMinute)} · {block.componentDetails.map((component) => component.type).join(' + ')}
                </option>)}
              </select>
            </label>}
          </header>
          <div className="academic-scheduling__manual-fields">
            {adjustmentError && <p className="academic-scheduling__inline-error academic-scheduling__manual-error" role="alert">{adjustmentError}</p>}
            <p className="academic-scheduling__manual-preview">Vista previa: {['—', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][editingBlock.day]} {formatAcademicMinute(editingBlock.startMinute)}–{editingBlock.startMinute + activeBlock.durationMinutes <= 1440 ? formatAcademicMinute(editingBlock.startMinute + activeBlock.durationMinutes) : 'fuera del día'} · duración conservada {formatAcademicDuration(activeBlock.durationMinutes)}.{activeSection.deliveryMode === 'split' ? ' Cambiar docente modifica la responsabilidad de toda la sección; los demás bloques mantienen sus horarios.' : ' Se conserva el bloque continuo completo.'}</p>
            <label>Docente responsable
              <select aria-label={`Docente revisión ${activeBlock.sectionId}`} value={editingBlock.teacherId} disabled={adjusting}
                onChange={(event) => setEditingBlock({ ...editingBlock, teacherId: event.currentTarget.value })}>
                {proposalResources.teachers.filter((teacher) => teacher.courseIds.includes(activeBlock.courseId)).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </label>
            <label>Día
              <select aria-label={`Día revisión ${activeBlock.sectionId}`} value={editingBlock.day} disabled={adjusting}
                onChange={(event) => setEditingBlock({ ...editingBlock, day: Number(event.currentTarget.value) })}>
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
              </select>
            </label>
            <label>Hora de inicio
              <input aria-label={`Inicio revisión ${activeBlock.sectionId}`} type="time" step={catalog?.startStepMinutes ? catalog.startStepMinutes * 60 : 1800}
                value={formatAcademicMinute(editingBlock.startMinute)} disabled={adjusting}
                onChange={(event) => {
                  const [hours, minutes] = event.currentTarget.value.split(':').map(Number)
                  if (Number.isFinite(hours) && Number.isFinite(minutes)) setEditingBlock({ ...editingBlock, startMinute: hours * 60 + minutes })
                }} />
            </label>
            <div className="academic-scheduling__manual-components">
              {activeAssignments.map((assignment, index) => {
                const originalRoom = proposalResources.rooms.find((room) => room.id === assignment.roomId)
                const rooms = proposalResources.rooms.filter((room) => room.capacity >= activeSection.capacity
                  && (!originalRoom?.kind || room.kind === originalRoom.kind))
                return <label key={assignment.sessionId}>{assignment.sessionType ?? 'Componente'} · {formatAcademicDuration(assignment.endMinute - assignment.startMinute)}
                  <select aria-label={`Ambiente ${assignment.sessionType ?? index + 1} revisión ${activeBlock.sectionId}`}
                    value={editingBlock.roomIds[index] ?? ''} disabled={adjusting}
                    onChange={(event) => setEditingBlock({ ...editingBlock, roomIds: editingBlock.roomIds.map((id, roomIndex) => roomIndex === index ? event.currentTarget.value : id) })}>
                    {rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · capacidad {room.capacity}</option>)}
                  </select>
                </label>
              })}
            </div>
            <div className="academic-scheduling__manual-actions">
              <button type="button" className="academic-scheduling__button" disabled={adjusting || proposalResources.teachers.filter((teacher) => teacher.courseIds.includes(activeBlock.courseId)).length === 0}
                onClick={() => void submitBlockReview()}>{adjusting ? 'Aplicando…' : 'Aplicar ajuste'}</button>
              <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary" disabled={adjusting}
                onClick={() => { setEditingBlock(null); setAdjustmentError(null) }}>Cancelar</button>
            </div>
          </div>
        </section>}
      </section>
      <section className="academic-scheduling__section" aria-labelledby="academic-scheduling-assignments">
        <h3 id="academic-scheduling-assignments">Asignaciones de horario</h3>
        <p className="academic-scheduling__resource-note">Los nombres identifican recursos de esta propuesta local. Un nombre de referencia sintético no confirma una asignación para el nuevo periodo.</p>
        <div role="region" aria-label="Programación generada">
          <DataTable className="academic-scheduling__assignments-table" headers={['Asignatura', 'Sección', 'Docente asignado · nuevo periodo', 'Ambiente(s)', 'Día', 'Hora', 'Componentes incluidos']} rows={assignmentRows} empty="No hay componentes asignados." />
        </div>
        <p className="academic-scheduling__resource-note">Asignaciones propuestas para el nuevo periodo; no están confirmadas.</p>
        <WeeklySchedule data={emptyScheduleData()} displayEvents={toAcademicScheduleEvents(proposal)} />
      </section>
    </>}
    </fieldset>

  </section>
}

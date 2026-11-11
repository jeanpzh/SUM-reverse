import { validateAcademicSearch, validateAcademicSearchRequest } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicSearch } from '../../../shared/programacion-academica-api.mjs'
import { engineUrl, engineJobPayload } from './planning-engine.client.js'
import { resolvePlanningNormative, workspaceNormativeContext } from './normative-planning.js'
import { createHash, randomUUID } from 'node:crypto'
import { HttpException, Injectable } from '@nestjs/common'
import { validateAcademicAdjustment, validateAcademicAdvisorRequest, validateAcademicCatalog, validateAcademicProposal, validateAcademicRequest, validateAcademicDemandRequest } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicAdjustment, AcademicAdvisorResponse, AcademicCatalog, AcademicProposal, AcademicRequest, AcademicInterval, AcademicPlanningResources, AcademicWorkspace, AcademicDemandEstimate } from '../../../shared/programacion-academica-api.mjs'
import { createCoverageAuthority } from './session-coverage.js'
import { generateAcademicSchedule } from './schedule-generator.js'
import type { GeneratorInput, GeneratorDiagnostic, GeneratorResult, GeneratorSeed, RequiredSession } from './generator.types.js'
import type { AcademicSchedule, TimeInterval } from './schedule.types.js'
import { validateAcademicSchedule } from './schedule-validator.js'
import { validateSectionDelivery } from './section-delivery.js'
import { createDemoCatalog } from './demo-catalog.js'
import { assessTeacherPreferences } from './teacher-preferences.js'
import { createDemandSources } from './demand-fixtures.js'
import { estimateAcademicDemand } from './demand-estimator.js'
import { prepareGeneratorInput } from './generator-input.js'
import { analyzeProposalAdvisor, trySolveWithPythonEngine } from './planning-engine.client.js'
import { THESIS_COURSE_IDS } from '../../../shared/academic-planning-policy.mjs'

type RetainedProposal = {
  normativeContext?: Pick<AcademicRequest, 'academicPeriod' | 'lectiveHourMinutes' | 'planningPolicy'>
  request: AcademicRequest
  input: GeneratorInput
  resources: AcademicPlanningResources
  requirements: RequiredSession[]
  authority: ReturnType<typeof createCoverageAuthority>
  automaticView: AcademicProposal
  view: AcademicProposal
}

export type TrustedDraftRetention = Pick<RetainedProposal, 'request' | 'input' | 'resources' | 'automaticView' | 'view'>

const retentionMs = 15 * 60 * 1000
const proposalLimit = 20
const canonicalize = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonicalize).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(',')}}`
    : JSON.stringify(value) ?? 'undefined'

@Injectable()
export class DemoProposalService {
  private readonly catalog = createDemoCatalog()
  private readonly demandSources = createDemandSources(this.catalog)
  private readonly proposals = new Map<string, RetainedProposal>()

  private readonly searches = new Map<string, { engineId: string; base: string; proposalId: string; created: number; fingerprint: string; cleanupPending: boolean; cancelRequested: boolean;
    context: ReturnType<DemoProposalService['validateAndPrepareProposalRequest']>; snapshot: AcademicSearch }>()
  private closing = false
  private readonly fences = new Map<string, number>()
  private starts: Promise<unknown> = Promise.resolve()

  async startSearch(value: unknown): Promise<AcademicSearch> {
    try { validateAcademicSearchRequest(value) } catch { throw this.httpError(400, 'INVALID_REQUEST', 'Solicitud o presupuesto inválido') }
    const base = engineUrl()
    if (!base) throw this.httpError(503, 'ENGINE_UNAVAILABLE', 'El motor de búsqueda está deshabilitado')
    if (this.closing) throw this.httpError(503, 'ENGINE_CLOSING', 'Servicio cerrando')
    const jobId = value.requestId ?? randomUUID()
    const fingerprint = canonicalize({ request: value.request, budgetSeconds: value.budgetSeconds })
    for (const [id, at] of this.fences) if (Date.now() - at > retentionMs) this.fences.delete(id)
    const existing = this.searches.get(jobId)
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw this.httpError(409, 'SEARCH_CONFLICT', 'La identidad ya corresponde a otra solicitud')
      return existing.cancelRequested ? this.searchStatus(jobId, true) : structuredClone(existing.snapshot)
    }
    if (this.fences.has(jobId)) throw this.httpError(409, 'SEARCH_CANCELLED', 'Inicio previamente cancelado')
    for (const [id, job] of this.searches) {
      if (!job.cleanupPending && job.snapshot.state !== 'running' && Date.now() - job.created > retentionMs) this.searches.delete(id)
    }
    if (this.searches.size + this.fences.size >= 256) throw this.httpError(429, 'SEARCH_CAPACITY', 'Reintenta la limpieza de búsquedas pendientes')
    const context = this.validateAndPrepareProposalRequest(value.request)
    const budgetSeconds = value.budgetSeconds
    const snapshot: AcademicSearch = { jobId, state: 'running', phase: 'preparing', elapsedSeconds: 0, budgetSeconds,
      progress: { requiredSessions: prepareGeneratorInput(context.input).requirements.length, scheduledSessions: 0,
        requiredSections: prepareGeneratorInput(context.input).schedule.sections.length, scheduledSections: 0, improvements: 0 }, proposal: null, error: null }
    const job = { engineId: randomUUID().replaceAll('-', ''), base, proposalId: randomUUID(), created: Date.now(),
      fingerprint, cleanupPending: true, cancelRequested: false, context, snapshot }
    this.searches.set(jobId, job) // Ownership exists before either upstream request or queue wait.
    const run = this.starts.catch(() => {}).then(async () => {
      if (job.cancelRequested || this.closing || Date.now() - job.created > retentionMs) return this.searchStatus(jobId, true)
      for (const [id, previous] of this.searches) {
        if (id === jobId) break // Later reservations belong to queued starts, not predecessors.
        if (previous.cleanupPending || previous.snapshot.state === 'running') await this.searchStatus(id, true)
      }
      if (job.cancelRequested || this.closing || Date.now() - job.created > retentionMs) return this.searchStatus(jobId, true)
      try {
        const started = await this.engineSearchRequest(base, '', 'POST', { ...engineJobPayload(context.input, this.catalog, context.resources), maxTimeSeconds: budgetSeconds }, job.engineId) as { jobId: string }
        if (started.jobId !== job.engineId) throw this.httpError(502, 'ENGINE_INVALID', 'Identidad de motor inválida')
        if (job.cancelRequested || this.closing || Date.now() - job.created > retentionMs) return this.searchStatus(jobId, true)
        return structuredClone(job.snapshot)
      } catch (error) {
        job.cancelRequested = true
        await this.searchStatus(jobId, true).catch(() => {}) // Failed cleanup stays owned and retryable.
        throw error
      }
    })
    this.starts = run
    return run
  }

  private async engineSearchRequest(base: string, path: string, method: string, body?: unknown, engineId?: string): Promise<unknown> {
    try {
      const response = await fetch(`${base}/v1/solve-jobs${path}`, { method, headers: { 'Content-Type': 'application/json', ...(engineId ? { 'X-Job-Id': engineId } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw this.httpError(response.status === 404 ? 404 : 502, 'ENGINE_ERROR', 'El motor no pudo atender la búsqueda')
      return await response.json()
    } catch (error) {
      if (error instanceof HttpException) throw error
      throw this.httpError(503, 'ENGINE_UNAVAILABLE', 'No se pudo conectar con el motor local')
    }
  }

  async searchStatus(id: string, cancel = false): Promise<AcademicSearch> {
    const job = this.searches.get(id)
    if (!job) {
      for (const [key, at] of this.fences) if (Date.now() - at > retentionMs) this.fences.delete(key)
      if (!cancel || !/^[0-9a-f-]{36}$/i.test(id)) throw this.httpError(404, 'SEARCH_NOT_FOUND', 'Búsqueda desconocida o caducada')
      if (!this.fences.has(id) && this.fences.size + this.searches.size >= 256) throw this.httpError(429, 'SEARCH_CAPACITY', 'Capacidad de correlación agotada')
      if (!this.fences.has(id)) this.fences.set(id, Date.now())
      return { jobId: id, state: 'cancelled', phase: 'preparing', elapsedSeconds: 0, budgetSeconds: 1,
        progress: { requiredSessions: 0, scheduledSessions: 0, requiredSections: 0, scheduledSections: 0, improvements: 0 }, proposal: null, error: null }
    }
    const expired = Date.now() - job.created > retentionMs
    if (cancel || expired) job.cancelRequested = true
    if (job.snapshot.state !== 'running' && !job.cleanupPending) {
      if (expired) throw this.httpError(404, 'SEARCH_NOT_FOUND', 'Búsqueda caducada')
      return structuredClone(job.snapshot)
    }
    cancel = job.cancelRequested
    try {
      const raw = await this.engineSearchRequest(job.base, `/${job.engineId}`, cancel ? 'DELETE' : 'GET') as AcademicSearch & { result: {
        status: GeneratorResult['status']; assignments: AcademicSchedule['assignments']; exploredCandidates: number; candidateVisits: number;
        backtracks: number; limitReason: GeneratorResult['limitReason']; diagnostics: GeneratorResult['diagnostics']
      } & Pick<GeneratorResult, 'coverageProof' | 'capacityCertificate' | 'decisions' | 'prelation'> | null }
      if (!job.cleanupPending && job.snapshot.state !== 'running') return structuredClone(job.snapshot)
      if (raw.jobId !== job.engineId || raw.budgetSeconds !== job.snapshot.budgetSeconds) throw new Error('Engine identity mismatch')
      const { context } = job
      let proposal: AcademicProposal | null = null
      if (raw.result && raw.state !== 'failed') {
        const prepared = prepareGeneratorInput(context.input)
        const schedule = { ...prepared.schedule, assignments: raw.result.assignments }
        const coverage = context.authority.check(schedule)
        if (coverage.issues.some(issue => issue.code !== 'MISSING_SESSION')) throw new Error('Invalid engine witness')
        const result: GeneratorResult = { ...raw.result, schedule, requirements: prepared.requirements, coverage, rejectionCounts: {} }
        proposal = this.buildProposalView(context.request, context.input, context.resources, result, context.authority)
        proposal.proposalId = job.proposalId
        proposal.createdAt = new Date(job.created).toISOString()
        proposal.expiresAt = new Date(job.created + retentionMs).toISOString()
        this.proposals.set(job.proposalId, { ...context, requirements: prepared.requirements, automaticView: structuredClone(proposal), view: structuredClone(proposal) })
      }
      const snapshot: AcademicSearch = { jobId: id, state: raw.state, phase: raw.phase, elapsedSeconds: raw.elapsedSeconds,
        budgetSeconds: raw.budgetSeconds, progress: raw.progress, proposal, error: raw.error }
      validateAcademicSearch(snapshot)
      job.snapshot = snapshot
      job.cleanupPending = raw.state === 'running'
      if (cancel && job.cleanupPending) throw this.httpError(503, 'CLEANUP_PENDING', 'Cancelación sin confirmar; reintenta')
      if (expired) throw this.httpError(404, 'SEARCH_NOT_FOUND', 'Búsqueda caducada')
      return structuredClone(snapshot)
    } catch (error) {
      if (!job.cleanupPending) throw error
      job.cancelRequested = true
      // DELETE 404 is an engine fence, not evidence obtained from a GET miss.
      let confirmed = false
      for (let attempt = 0; attempt < 2 && !confirmed; attempt++) {
        try {
          const stopped = await this.engineSearchRequest(job.base, `/${job.engineId}`, 'DELETE') as { jobId: string; state: string }
          confirmed = stopped.jobId === job.engineId && ['cancelled', 'completed', 'failed'].includes(stopped.state)
        } catch (cleanupError) { confirmed = cleanupError instanceof HttpException && cleanupError.getStatus() === 404 }
      }
      job.cleanupPending = !confirmed
      if (confirmed) {
        this.proposals.delete(job.proposalId)
        job.snapshot = { ...job.snapshot, state: 'failed', proposal: null, error: { code: 'ENGINE_ERROR', message: 'No se pudo validar o consultar la búsqueda local' } }
      }
      throw error instanceof HttpException ? error : this.httpError(502, 'ENGINE_INVALID', 'El motor devolvió una búsqueda inválida')
    }
  }

  async onModuleDestroy() {
    this.closing = true
    await Promise.all([...this.searches].filter(([, job]) => job.cleanupPending || job.snapshot.state === 'running')
      .map(([id]) => this.searchStatus(id, true).catch(() => {})))
  }

  private assertSearchFinished(proposalId: string) {
    if ([...this.searches.values()].some(job => job.proposalId === proposalId && (job.cleanupPending || job.snapshot.state === 'running'))) {
      throw this.httpError(409, 'SEARCH_RUNNING', 'Cancela o termina la búsqueda antes de modificar o guardar')
    }
  }

  constructor() {
    validateAcademicCatalog(this.catalog)
  }

  getCatalog(): AcademicCatalog {
    return structuredClone(this.catalog)
  }

  estimateDemand(value: unknown) {
    try {
      validateAcademicDemandRequest(value)
      if (value.revision !== this.catalog.revision) {
        throw this.httpError(409, 'REVISION_MISMATCH', 'La revisión de catálogo ya no está vigente')
      }
      return estimateAcademicDemand(this.catalog, this.demandSources, value)
    } catch (error) {
      if (error instanceof HttpException) throw error
      throw this.httpError(400, 'INVALID_REQUEST', error instanceof Error ? error.message : 'Solicitud de demanda inválida')
    }
  }

  private validateAndPrepareProposalRequest(value: unknown): {
    request: AcademicRequest
    resources: AcademicPlanningResources
    input: GeneratorInput
    authority: ReturnType<typeof createCoverageAuthority>
  } {
    let request: AcademicRequest
    try {
      validateAcademicRequest(value)
      request = value
    } catch (error) {
      throw this.httpError(400, 'INVALID_REQUEST', error instanceof Error ? error.message : 'Solicitud inválida')
    }
    if (request.revision !== this.catalog.revision) throw this.httpError(409, 'REVISION_MISMATCH', 'La revisión de catálogo ya no está vigente')
    const catalogIds = new Set(this.catalog.courses.map((course) => course.courseId))
    if (request.demands.some((demand) => !catalogIds.has(demand.courseId))) {
      throw this.httpError(400, 'INVALID_DEMANDS', 'La solicitud incluye cursos desconocidos')
    }
    for (const demand of request.demands) {
      const course = this.catalog.courses.find((candidate) => candidate.courseId === demand.courseId)!
      if (demand.patternId && !course.planningPatterns?.some((pattern) => pattern.id === demand.patternId)) {
        throw this.httpError(400, 'INVALID_DEMANDS', `El patrón solicitado no existe para ${demand.courseId}`)
      }
      const sectionCount = Math.ceil(demand.estimatedDemand / (demand.targetCapacity ?? course.targetCapacity))
      if (demand.sectionCapacities?.some((override) => override.ordinal > sectionCount)) {
        throw this.httpError(400, 'INVALID_REQUEST', `sectionCapacities: el ordinal supera las ${sectionCount} secciones calculadas de ${demand.courseId}`)
      }
    }

    this.cleanExpired()
    if (this.proposals.size >= proposalLimit) throw this.httpError(429, 'PROPOSAL_CAPACITY', 'Se alcanzó el máximo de propuestas retenidas')

    const resources = this.resolveResources(request)
    const input = this.toGeneratorInput(request, resources)
    const authority = createCoverageAuthority(input)
    return { request, resources, input, authority }
  }

  private storeProposalResult(
    request: AcademicRequest,
    input: GeneratorInput,
    resources: AcademicPlanningResources,
    authority: ReturnType<typeof createCoverageAuthority>,
    result: GeneratorResult,
  ): AcademicProposal {
    const view = this.buildProposalView(request, input, resources, result, authority)
    const retainedInput = structuredClone(input)
    const retainedView = structuredClone(view)
    this.proposals.set(view.proposalId, {
      request: structuredClone(request),
      input: retainedInput,
      resources: structuredClone(resources),
      requirements: structuredClone(result.requirements),
      authority,
      automaticView: structuredClone(retainedView),
      view: retainedView,
    })
    return structuredClone(view)
  }

  createProposal(value: unknown): AcademicProposal {
    const { request, resources, input, authority } = this.validateAndPrepareProposalRequest(value)
    const result = generateAcademicSchedule(input)
    return this.storeProposalResult(request, input, resources, authority, result)
  }

  async createProposalAsync(value: unknown): Promise<AcademicProposal> {
    const { request, resources, input, authority } = this.validateAndPrepareProposalRequest(value)
    const pythonResult = await trySolveWithPythonEngine(input, this.catalog, resources)
    const result = pythonResult ?? generateAcademicSchedule(input)
    return this.storeProposalResult(request, input, resources, authority, result)
  }

  async adviseProposal(proposalId: string, value: unknown): Promise<AcademicAdvisorResponse> {
    try {
      validateAcademicAdvisorRequest(value)
    } catch (error) {
      throw this.httpError(400, 'INVALID_REQUEST', error instanceof Error ? error.message : 'Solicitud de consejero inválida')
    }
    this.cleanExpired()
    const retained = this.proposals.get(proposalId)
    if (!retained) throw this.httpError(404, 'PROPOSAL_NOT_FOUND', 'No se encontró la propuesta o ya expiró')
    const currentVersion = retained.view.editVersion ?? 0
    if (value.expectedEditVersion !== currentVersion) {
      throw this.httpError(409, 'VERSION_MISMATCH', `Versión vigente ${currentVersion}; se recibió ${value.expectedEditVersion}`)
    }
    this.assertSearchFinished(proposalId)
    const resolved = resolvePlanningNormative(retained.normativeContext ?? retained.request, retained.resources.teachers)
    const currentNormative = resolved.report(retained.view.assignments)
    if (retained.view.normative?.profileRevision && (currentNormative.profileRevision !== retained.view.normative.profileRevision
      || currentNormative.lectiveHourMinutes !== retained.view.normative.lectiveHourMinutes)) {
      throw this.httpError(409, 'VERSION_MISMATCH', 'El perfil normativo cambió; ejecuta una nueva búsqueda')
    }
    const result = analyzeProposalAdvisor(retained.view, { ...retained.input, teachers: resolved.teachers }, retained.resources, this.catalog)
    const candidates = result.recommendations
    if (value.selectedRecommendationIds?.some((id) => !candidates.some((r) => r.id === id))) {
      throw this.httpError(400, 'INVALID_REQUEST', 'Recomendación desconocida')
    }
    return result
  }

  adjustProposal(proposalId: string, value: unknown): AcademicProposal {
    this.assertSearchFinished(proposalId)
    let adjustment: AcademicAdjustment
    try {
      validateAcademicAdjustment(value)
      adjustment = value
    } catch (error) {
      throw this.httpError(400, 'INVALID_ADJUSTMENT', error instanceof Error ? error.message : 'Ajuste inválido')
    }

    this.cleanExpired()
    const retained = this.proposals.get(proposalId)
    if (!retained) throw this.httpError(404, 'PROPOSAL_NOT_FOUND', 'No se encontró la propuesta o ya expiró')
    const version = retained.view.editVersion ?? 0
    if (adjustment.expectedVersion !== version) throw this.httpError(409, 'VERSION_MISMATCH', `Versión vigente ${version}; se recibió ${adjustment.expectedVersion}`)

    const current = retained.view
    const section = current.sections.find((candidate) => candidate.sectionId === adjustment.sectionId)
    if (!section) throw this.adjustmentRejected('section', adjustment.sectionId, 'Sección desconocida')
    const sectionAssignments = current.assignments.filter((assignment) => assignment.sectionId === section.sectionId)
    const selected = adjustment.sessionIds.map((sessionId) => sectionAssignments.find((assignment) => assignment.sessionId === sessionId))
    if (selected.some((assignment) => !assignment)) throw this.adjustmentRejected('session', adjustment.sessionIds.join(','), 'La sesión no está asignada a esta sección')

    const requirements = retained.requirements.filter((requirement) => requirement.sectionId === section.sectionId).sort((left, right) => left.order - right.order)
    const mode = section.deliveryMode ?? 'continuous'
    if (mode === 'continuous' && (sectionAssignments.length !== requirements.length
      || adjustment.sessionIds.length !== requirements.length
      || requirements.some((requirement, index) => adjustment.sessionIds[index] !== requirement.id))) {
      throw this.adjustmentRejected('section', section.sectionId, 'Una sección continua requiere mover todos sus componentes asignados en su orden declarado')
    }

    const chronologicallySelected = [...selected].sort((left, right) => left!.day - right!.day || left!.startMinute - right!.startMinute)
    if (chronologicallySelected.some((assignment, index) => adjustment.sessionIds[index] !== assignment!.sessionId)) {
      throw this.adjustmentRejected('session', section.sectionId, 'Los componentes deben enviarse en orden cronológico')
    }
    if (chronologicallySelected.some((assignment, index) => index > 0
      && (assignment!.day !== chronologicallySelected[0]!.day || assignment!.startMinute !== chronologicallySelected[index - 1]!.endMinute))) {
      throw this.adjustmentRejected('session', section.sectionId, 'Los componentes seleccionados deben formar un bloque contiguo del mismo día')
    }
    const selectedStart = chronologicallySelected[0]!
    const selectedEnd = chronologicallySelected.at(-1)!
    if (sectionAssignments.some((assignment) => !adjustment.sessionIds.includes(assignment.sessionId)
      && assignment.day === selectedStart.day
      && (assignment.endMinute === selectedStart.startMinute || assignment.startMinute === selectedEnd.endMinute))) {
      throw this.adjustmentRejected('session', section.sectionId, 'El ajuste debe incluir el bloque contiguo completo')
    }

    const targetTeacher = retained.resources.teachers.find((teacher) => teacher.id === adjustment.teacherId)
    if (!targetTeacher) throw this.adjustmentRejected('teacher', adjustment.teacherId, 'Docente desconocido')
    const course = retained.input.courses.find((candidate) => candidate.courseId === section.courseId)
    if (!course || !targetTeacher.courseIds.includes(section.courseId)) {
      throw this.adjustmentRejected('teacher', targetTeacher.id, `TEACHER_NOT_QUALIFIED: no está habilitado para ${section.courseId}`)
    }
    if (retained.request.planningPolicy && THESIS_COURSE_IDS.includes(section.courseId)
      && (targetTeacher.facultyId !== 'FISI' || targetTeacher.qualificationSource !== 'synthetic')) {
      throw this.adjustmentRejected('teacher', targetTeacher.id, `THESIS_TEACHER_NOT_ELIGIBLE: se requiere habilitación sintética FISI para ${section.courseId}`)
    }

    const selectedIds = new Set(adjustment.sessionIds)
    const changeTeacherForSection = sectionAssignments.some((assignment) => assignment.teacherId !== adjustment.teacherId)
    const changedTeacherIds = new Set(changeTeacherForSection ? sectionAssignments.map((assignment) => assignment.sessionId) : [])
    const selectedById = new Map(selected.map((assignment, index) => [assignment!.sessionId, { assignment: assignment!, roomId: adjustment.roomIds[index]! }]))
    const assignments = current.assignments.map((assignment) => {
      const selectedEdit = selectedById.get(assignment.sessionId)
      const teacherId = changedTeacherIds.has(assignment.sessionId) ? adjustment.teacherId : assignment.teacherId
      const teacherName = changedTeacherIds.has(assignment.sessionId) ? targetTeacher.name : assignment.teacherName
      if (!selectedEdit) return { ...assignment, teacherId, teacherName }
      const requirement = retained.requirements.find((item) => item.id === assignment.sessionId)!
      const room = retained.resources.rooms.find((candidate) => candidate.id === selectedEdit.roomId)
      if (!room) throw this.adjustmentRejected('room', selectedEdit.roomId, 'Ambiente desconocido')
      if (retained.request.planningPolicy && requirement.type === 'L' && room.kind !== 'laboratory') {
        throw this.adjustmentRejected('room', room.id, `ROOM_KIND_MISMATCH: ${requirement.type} requiere laboratorio`)
      }
      const automaticAssignment = retained.automaticView.assignments.find((candidate) => candidate.sessionId === assignment.sessionId)
      const oldRoom = retained.resources.rooms.find((candidate) => candidate.id === automaticAssignment?.roomId)
      if (oldRoom?.kind && room.kind !== oldRoom.kind) {
        throw this.adjustmentRejected('room', room.id, `ROOM_KIND_MISMATCH: se conserva el tipo ${oldRoom.kind} del componente ${assignment.sessionId}`)
      }
      const precedingDuration = adjustment.sessionIds.slice(0, adjustment.sessionIds.indexOf(assignment.sessionId))
        .reduce((total, id) => total + retained.requirements.find((item) => item.id === id)!.durationMinutes, 0)
      const startMinute = adjustment.startMinute + precedingDuration
      const interval = { day: adjustment.day as TimeInterval['day'], startMinute, endMinute: startMinute + requirement.durationMinutes }
      if (retained.request.planningPolicy && !this.isAllowedPlanningInterval(course.cycle ?? 0, interval, retained.request.planningPolicy)) {
        throw this.adjustmentRejected('window', assignment.sessionId, 'PLANNING_POLICY_WINDOW: la franja requiere una excepción habilitada y dentro de sus límites')
      }
      if (!this.windowContains(retained.input.windows, interval)) {
        throw this.adjustmentRejected('window', assignment.sessionId, 'WINDOW_UNAVAILABLE: el componente queda fuera de las ventanas generales')
      }
      return { ...assignment, teacherId, teacherName, roomId: room.id, day: interval.day, startMinute: interval.startMinute, endMinute: interval.endMinute,
        roomName: room.name }
    })
    if (selectedIds.size !== selectedById.size) throw this.adjustmentRejected('session', section.sectionId, 'Componentes repetidos')

    const schedule = {
      ...this.toSchedule(retained.input, current),
      assignments: assignments.map((assignment) => ({ id: assignment.sessionId, sectionId: assignment.sectionId, teacherId: assignment.teacherId,
        roomId: assignment.roomId, interval: { day: assignment.day as TimeInterval['day'], startMinute: assignment.startMinute, endMinute: assignment.endMinute } })),
    } as AcademicSchedule
    const validation = validateAcademicSchedule(schedule, { planningPolicy: Boolean(retained.request.planningPolicy) })
    if (!validation.valid) {
      const issue = validation.issues[0]!
      throw this.adjustmentRejected(issue.resourceType, issue.resourceId ?? issue.field ?? 'schedule', `${issue.code}: ${issue.message}`)
    }
    const deliveryIssues = validateSectionDelivery(schedule, retained.requirements, retained.input)
    if (deliveryIssues.length) throw this.adjustmentRejected('section', deliveryIssues[0]!.sectionId, `SECTION_DELIVERY_POLICY: ${deliveryIssues[0]!.message}`)
    const coverage = retained.authority.check(schedule)
    const hardIssues = coverage.issues.filter((issue) => issue.code !== 'MISSING_SESSION')
    if (hardIssues.length) throw this.adjustmentRejected('authority', section.sectionId, `${hardIssues[0]!.code}: ${hardIssues[0]!.message}`)

    const effectiveChange = assignments.some((assignment, index) => {
      const previous = current.assignments[index]!
      return assignment.teacherId !== previous.teacherId || assignment.roomId !== previous.roomId
        || assignment.day !== previous.day || assignment.startMinute !== previous.startMinute || assignment.endMinute !== previous.endMinute
    })
    if (!effectiveChange) return structuredClone(current)

    const preferenceReport = assessTeacherPreferences(retained.input, schedule, retained.requirements)
    const changedView: AcademicProposal = {
      ...structuredClone(current),
      assignments,
      editVersion: version + 1,
      manuallyAdjustedSectionIds: [...new Set([...(current.manuallyAdjustedSectionIds ?? []), section.sectionId])],
      preferenceReport,
    }
    changedView.normative = resolvePlanningNormative(retained.normativeContext ?? retained.request, retained.resources.teachers).report(assignments)
    // Manual teacher changes do not retain the automatic solver's prelation proof.
    delete changedView.prelation
    // A placement edit changes neither demand/resources nor the number of covered
    // sessions, so the original coverage bound and termination remain applicable.
    delete changedView.capacityCertificate
    delete changedView.decisions
    changedView.diagnostics = changedView.diagnostics.filter((diagnostic) => diagnostic.code !== 'PREFERENCES_NOT_MET')
    if (preferenceReport.outsidePreferenceSections > 0) {
      changedView.diagnostics.push({ code: 'PREFERENCES_NOT_MET', message: 'Hay secciones programadas fuera de sus preferencias. Las preferencias son orientativas; no se ha demostrado optimalidad global.', sessionIds: [] })
    }
    try {
      validateAcademicProposal(changedView)
    } catch (error) {
      throw this.httpError(500, 'PROPOSAL_INVALID', error instanceof Error ? error.message : 'La propuesta ajustada no superó su validación')
    }
    retained.view = structuredClone(changedView)
    return structuredClone(changedView)
  }

  getProposal(proposalId: string): AcademicProposal {
    this.cleanExpired()
    const retained = this.proposals.get(proposalId)
    if (!retained) throw this.httpError(404, 'PROPOSAL_NOT_FOUND', 'No se encontró la propuesta o ya expiró')
    const view = structuredClone(retained.view)
    if (view.status !== 'invalid-input') {
      const schedule = this.toSchedule(retained.input, view)
      view.coverageComplete = retained.authority.check(schedule).complete
    }
    try {
      validateAcademicProposal(view)
    } catch {
      throw this.httpError(500, 'PROPOSAL_INVALID', 'La propuesta retenida no superó su validación')
    }
    return structuredClone(view)
  }

  validateDraftWorkspace(workspace: AcademicWorkspace): { input: GeneratorInput, resources: AcademicPlanningResources, demandBase: AcademicDemandEstimate | null } {
    try {
      validateAcademicRequest(workspace.request)
      if (workspace.request.revision !== this.catalog.revision) throw this.httpError(409, 'CATALOG_MISMATCH', 'La revisión de catálogo ya no está vigente')
      const resources = this.resolveResources(workspace.request)
      const input = this.toGeneratorInput({ ...workspace.request, ...workspaceNormativeContext(workspace) }, resources)
      const prepared = prepareGeneratorInput(input)
      const normalizedInput = prepared.input
      let demandBase: AcademicDemandEstimate | null = null
      if (workspace.demandBaseRequest) {
        validateAcademicDemandRequest(workspace.demandBaseRequest)
        demandBase = estimateAcademicDemand(this.catalog, this.demandSources, workspace.demandBaseRequest)
      }
      return { input: normalizedInput, resources, demandBase }
    } catch (error) {
      if (error instanceof HttpException) throw error
      throw this.httpError(422, 'DRAFT_CONFIGURATION_INVALID', 'La configuración no corresponde al catálogo local vigente')
    }
  }

  captureDraftRetention(proposalId: string, editVersion: number, workspace: AcademicWorkspace): TrustedDraftRetention {
    this.assertSearchFinished(proposalId)
    this.cleanExpired()
    const retained = this.proposals.get(proposalId)
    if (!retained) throw this.httpError(404, 'PROPOSAL_NOT_FOUND', 'El horario temporal expiró; vuelve a generarlo antes de guardar')
    if ((retained.view.editVersion ?? 0) !== editVersion) throw this.httpError(409, 'VERSION_MISMATCH', 'El horario cambió; actualiza la propuesta antes de guardar')
    const trusted = this.validateDraftWorkspace(workspace)
    const retainedInput = prepareGeneratorInput(retained.input).input
    if (canonicalize(workspace.request) !== canonicalize(retained.request) || canonicalize(trusted.input) !== canonicalize(retainedInput)
      || canonicalize(trusted.resources) !== canonicalize(retained.resources)) throw this.httpError(422, 'DRAFT_CONFIGURATION_MISMATCH', 'La configuración no corresponde al horario')
    const required = prepareGeneratorInput(trusted.input).requirements
    if (!this.matchesProposalConfiguration(retained.view, trusted.input, trusted.resources, required)
      || !this.matchesProposalConfiguration(retained.automaticView, trusted.input, trusted.resources, required)) {
      throw this.httpError(422, 'DRAFT_CONFIGURATION_MISMATCH', 'El horario no corresponde a la configuración actual')
    }
    return structuredClone({ request: retained.request, input: retainedInput, resources: retained.resources, automaticView: retained.automaticView, view: retained.view })
  }

  /** F-0: regenerate under a seed of fixed placements. Does not touch the proposal map; persistence belongs to the caller. */
  regenerateRetention(workspace: AcademicWorkspace, seed: GeneratorSeed): { status: GeneratorResult['status'], retention: TrustedDraftRetention | null,
    view: AcademicProposal, diagnostics: GeneratorDiagnostic[] } {
    const trusted = this.validateDraftWorkspace(workspace)
    const authority = createCoverageAuthority(trusted.input)
    const result = generateAcademicSchedule(trusted.input, {}, seed)
    const view = this.buildProposalView({ ...workspace.request, ...workspaceNormativeContext(workspace) }, trusted.input, trusted.resources, result, authority)
    const diagnostics = result.diagnostics.map((diagnostic) => ({ ...diagnostic, sessionIds: [...diagnostic.sessionIds] }))
    const retention = result.status === 'complete' && view.coverageComplete
      ? { request: structuredClone(workspace.request), input: structuredClone(trusted.input), resources: structuredClone(trusted.resources),
        automaticView: structuredClone(view), view: structuredClone(view) } : null
    return { status: result.status, retention, view: structuredClone(view), diagnostics }
  }

  restoreDraftRetention(snapshot: TrustedDraftRetention, workspace: AcademicWorkspace): AcademicProposal {
    this.cleanExpired()
    if (this.proposals.size >= proposalLimit) throw this.httpError(429, 'PROPOSAL_CAPACITY', 'Se alcanzó el máximo de propuestas retenidas')
    const prepared = this.validateDraftRetention(snapshot, workspace)
    const proposalId = randomUUID()
    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + retentionMs).toISOString()
    const view = structuredClone(snapshot.view)
    view.proposalId = proposalId
    view.createdAt = now
    view.expiresAt = expiresAt
    view.normative = resolvePlanningNormative(workspaceNormativeContext(workspace), snapshot.resources.teachers).report(view.assignments)
    const automaticView = structuredClone(snapshot.automaticView)
    const authority = createCoverageAuthority(prepared.input)
    const retained: RetainedProposal = { normativeContext: workspaceNormativeContext(workspace), request: structuredClone(snapshot.request), input: prepared.input, resources: structuredClone(snapshot.resources), requirements: prepared.requirements,
      authority, automaticView, view: structuredClone(view) }
    this.proposals.set(proposalId, retained)
    return structuredClone(view)
  }

  validateDraftRetention(snapshot: TrustedDraftRetention, workspace: AcademicWorkspace): ReturnType<typeof prepareGeneratorInput> {
    const trusted = this.validateDraftWorkspace(workspace)
    let prepared: ReturnType<typeof prepareGeneratorInput>
    try {
      validateAcademicRequest(snapshot.request)
      if (canonicalize(snapshot.request) !== canonicalize(workspace.request)) throw new Error('request mismatch')
      prepared = prepareGeneratorInput(snapshot.input)
      if (canonicalize(prepared.input) !== canonicalize(snapshot.input)
        || canonicalize(prepared.input) !== canonicalize(trusted.input)
        || canonicalize(snapshot.resources) !== canonicalize(trusted.resources)) throw new Error('snapshot mismatch')
      this.validateRetainedView(snapshot.automaticView, prepared.input, snapshot.resources, prepared.requirements)
      this.validateRetainedView(snapshot.view, prepared.input, snapshot.resources, prepared.requirements)
      if (canonicalize(this.proposalStructure(snapshot.automaticView)) !== canonicalize(this.proposalStructure(snapshot.view))) throw new Error('proposal structure mismatch')
      const automaticRooms = new Map(snapshot.resources.rooms.map((room) => [room.id, room]))
      if (snapshot.view.assignments.some((assignment) => {
        const automatic = snapshot.automaticView.assignments.find((item) => item.sessionId === assignment.sessionId)
        const previousRoom = automatic && automaticRooms.get(automatic.roomId)
        const currentRoom = snapshot.resources.rooms.find((room) => room.id === assignment.roomId)
        return !automatic || !currentRoom || (previousRoom?.kind !== undefined && previousRoom.kind !== currentRoom.kind)
      })) throw new Error('room kind mismatch')
    } catch {
      throw this.httpError(409, 'DRAFT_CORRUPT', 'El horario guardado no superó la validación del catálogo vigente')
    }
    return prepared
  }

  getCatalogFingerprint(): string {
    return createHash('sha256').update(canonicalize(this.catalog)).digest('hex')
  }

  acceptsCatalogFingerprint(fingerprint: string): boolean {
    if (fingerprint === this.getCatalogFingerprint()) return true
    // Compatibility with the previous synthetic catalog defaults. Saved workspaces
    // carry explicit resources and still pass all request/retention validations.
    const legacyCatalog = { ...this.catalog, teachers: this.catalog.teachers.map(({ id, name, courseIds, availability }) => ({
      id, name, courseIds, availability, maxWeeklyMinutes: 600, // Historical local demo parameter.
    })) }
    return fingerprint === createHash('sha256').update(canonicalize(legacyCatalog)).digest('hex')
  }

  private buildProposalView(request: AcademicRequest, input: GeneratorInput, resources: AcademicPlanningResources, result: GeneratorResult,
    authority: ReturnType<typeof createCoverageAuthority>): AcademicProposal {
    const createdAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + retentionMs).toISOString()
    const assignments = result.schedule?.assignments ?? []
    const assignedIds = new Set(assignments.map((assignment) => assignment.id))
    const sections = (result.schedule?.sections ?? []).map((section) => ({
      sectionId: section.id,
      courseId: section.courseId,
      courseName: this.catalog.courses.find((course) => course.courseId === section.courseId)!.name,
      capacity: section.capacity,
      deliveryMode: input.courses.find((course) => course.courseId === section.courseId)!.deliveryMode ?? 'continuous',
    }))
    const view: AcademicProposal = {
      proposalId: randomUUID(),
      createdAt,
      expiresAt,
      status: result.status,
      sections,
      assignments: assignments.map((assignment) => ({
        sessionId: assignment.id,
        sectionId: assignment.sectionId,
        courseId: sections.find((section) => section.sectionId === assignment.sectionId)!.courseId,
        courseName: sections.find((section) => section.sectionId === assignment.sectionId)!.courseName,
        teacherId: assignment.teacherId,
        teacherName: resources.teachers.find((teacher) => teacher.id === assignment.teacherId)!.name,
        roomId: assignment.roomId,
        roomName: resources.rooms.find((room) => room.id === assignment.roomId)!.name,
        ...(result.requirements.find((required) => required.id === assignment.id)?.type
          ? { sessionType: result.requirements.find((required) => required.id === assignment.id)!.type } : {}),
        ...assignment.interval,
      })),
      pending: result.requirements.filter((required) => !assignedIds.has(required.id)).map((required) => ({
        sessionId: required.id,
        sectionId: required.sectionId,
        courseId: required.courseId,
        durationMinutes: required.durationMinutes,
      })),
      diagnostics: result.diagnostics.map((diagnostic) => ({ ...diagnostic, sessionIds: [...diagnostic.sessionIds] })),
      coverageComplete: result.status === 'complete' && (result.schedule ? authority.check(result.schedule).complete : false),
      counts: { sections: sections.length, requiredSessions: result.requirements.length, scheduledSessions: assignments.length },
      stats: { exploredCandidates: result.exploredCandidates, candidateVisits: result.candidateVisits, backtracks: result.backtracks, limitReason: result.limitReason },
      editVersion: 0,
      manuallyAdjustedSectionIds: [],
      ...(result.schedule ? { preferenceReport: assessTeacherPreferences(input, result.schedule, result.requirements) } : {}),
    }
    if (view.preferenceReport && view.preferenceReport.outsidePreferenceSections > 0) {
      view.diagnostics.push({ code: 'PREFERENCES_NOT_MET', message: 'Hay secciones programadas fuera de sus preferencias. Las preferencias son orientativas; no se ha demostrado optimalidad global.', sessionIds: [] })
    }
    if (request.planningPolicy) {
      const exceptions = view.assignments.filter((assignment) => {
        const cycle = this.catalog.courses.find((course) => course.courseId === assignment.courseId)?.cycle ?? 0
        return assignment.day === 6 || (cycle >= 7 && assignment.startMinute < 18 * 60)
      })
      if (exceptions.length) view.diagnostics.push({ code: 'PLANNING_EXCEPTION',
        message: `La propuesta incluye ${exceptions.length} sesión(es) fuera del horario preferido; requiere aceptación explícita. No se afirma optimalidad ni necesidad de la excepción.`,
        sessionIds: exceptions.map((item) => item.sessionId) })
    }
    const normative = resolvePlanningNormative(request, resources.teachers)
    view.normative = normative.report(view.assignments)
    for (const key of ['coverageProof', 'capacityCertificate', 'prelation'] as const) {
      if (result[key] != null) Object.assign(view, { [key]: structuredClone(result[key]) })
    }
    if (result.decisions !== undefined) view.decisions = normative.enrichDecisions(result.decisions)
    validateAcademicProposal(view)
    return view
  }

  private matchesProposalConfiguration(proposal: AcademicProposal, input: GeneratorInput, resources: AcademicPlanningResources, requirements: RequiredSession[]): boolean {
    const expectedSections = new Map(proposal.sections.map((section) => [section.sectionId, section]))
    const effectiveCapacities = new Map(prepareGeneratorInput(input).schedule.sections.map((section) => [section.id, section.capacity]))
    if (proposal.sections.some((section) => !input.courses.some((course) => course.courseId === section.courseId
      && (effectiveCapacities.get(section.sectionId) ?? course.targetCapacity) === section.capacity && course.deliveryMode === section.deliveryMode))) return false
    return proposal.assignments.every((assignment) => {
      const section = expectedSections.get(assignment.sectionId)
      const resourceTeacher = resources.teachers.find((teacher) => teacher.id === assignment.teacherId)
      const resourceRoom = resources.rooms.find((room) => room.id === assignment.roomId)
      const course = input.courses.find((candidate) => candidate.courseId === assignment.courseId)
      const session = requirements.find((candidate) => candidate.id === assignment.sessionId)
      return !!section && section.courseId === assignment.courseId && !!resourceTeacher && resourceTeacher.name === assignment.teacherName
        && !!resourceRoom && resourceRoom.name === assignment.roomName && !!course && !!session
        && session.sectionId === assignment.sectionId && session.courseId === assignment.courseId
        && (assignment.sessionType === undefined || assignment.sessionType === session.type)
    })
  }

  private validateRetainedView(view: AcademicProposal, input: GeneratorInput, resources: AcademicPlanningResources, requirements: RequiredSession[]): void {
    validateAcademicProposal(view)
    const schedule = this.toSchedule(input, view)
    const coverage = createCoverageAuthority(input).check(schedule)
    if (coverage.issues.some((issue) => issue.code !== 'MISSING_SESSION')) throw new Error('invalid coverage')
    const required = new Set(requirements.map((item) => item.id))
    if (view.assignments.some((assignment) => !required.has(assignment.sessionId))) throw new Error('unexpected session')
    const assigned = new Set(view.assignments.map((assignment) => assignment.sessionId))
    const expectedPending = requirements.filter((item) => !assigned.has(item.id)).map((item) => ({ sessionId: item.id, sectionId: item.sectionId,
      courseId: item.courseId, durationMinutes: item.durationMinutes }))
    if (canonicalize(view.pending) !== canonicalize(expectedPending)) throw new Error('pending mismatch')
    const expectedSections = prepareGeneratorInput(input).schedule.sections
    if (canonicalize(view.sections.map(({ sectionId, courseId, capacity, deliveryMode }) => ({ sectionId, courseId, capacity, deliveryMode })))
      !== canonicalize(expectedSections.map(({ id, courseId, capacity }) => ({ sectionId: id, courseId, capacity,
        deliveryMode: input.courses.find((course) => course.courseId === courseId)?.deliveryMode ?? 'continuous' })))) throw new Error('section mismatch')
    const requirementById = new Map(requirements.map((item) => [item.id, item]))
    if (view.assignments.some((assignment) => {
      const requirement = requirementById.get(assignment.sessionId)
      const catalogCourse = this.catalog.courses.find((course) => course.courseId === assignment.courseId)
      return !requirement || !catalogCourse || assignment.courseName !== catalogCourse.name
        || (assignment.sessionType !== undefined && assignment.sessionType !== requirement.type)
        || (requirement.type !== undefined && assignment.sessionType !== requirement.type)
    })) throw new Error('assignment metadata mismatch')
    if (view.sections.some((section) => this.catalog.courses.find((course) => course.courseId === section.courseId)?.name !== section.courseName)) throw new Error('course name mismatch')
    if (view.assignments.some((assignment) => !resources.teachers.some((teacher) => teacher.id === assignment.teacherId && teacher.name === assignment.teacherName)
      || !resources.rooms.some((room) => room.id === assignment.roomId && room.name === assignment.roomName))) throw new Error('resource mismatch')
    if (view.counts.requiredSessions !== requirements.length || view.counts.scheduledSessions !== view.assignments.length
      || view.counts.sections !== view.sections.length || view.coverageComplete !== coverage.complete) throw new Error('counts mismatch')
    if ((view.status === 'complete') !== coverage.complete) throw new Error('status coverage mismatch')
  }

  private proposalStructure(view: AcademicProposal): unknown {
    return { status: view.status, sections: view.sections,
      assignments: view.assignments.map(({ sessionId, sectionId, courseId, sessionType }) => ({ sessionId, sectionId, courseId, sessionType }))
        .sort((left, right) => left.sessionId.localeCompare(right.sessionId)),
      pending: view.pending, counts: view.counts }
  }

  private cleanExpired(): void {
    const now = Date.now()
    for (const [id, proposal] of this.proposals) {
      if (Date.parse(proposal.view.expiresAt) <= now) this.proposals.delete(id)
    }
  }

  private resolveResources(request: AcademicRequest): AcademicPlanningResources {
    const resources = request.resources ?? { teachers: this.catalog.teachers, rooms: this.catalog.rooms }
    const knownCourses = new Set(this.catalog.courses.map((course) => course.courseId))
    const selectedCourses = new Set(request.demands.map((demand) => demand.courseId))
    for (const teacher of resources.teachers) {
      if (teacher.courseIds.some((courseId) => !knownCourses.has(courseId))) {
        throw this.httpError(400, 'INVALID_REQUEST', 'Habilitación de curso desconocida')
      }
      if (teacher.sectionLimits?.some((limit) => !knownCourses.has(limit.courseId))) {
        throw this.httpError(400, 'INVALID_REQUEST', 'Límite de secciones para una asignatura desconocida')
      }
    }
    // Validate the catalog defaults too; they are trusted only after the catalog validator runs.
    return {
      teachers: resources.teachers.map((teacher) => ({
        ...teacher,
        courseIds: teacher.courseIds.filter((courseId) => selectedCourses.has(courseId)),
        availability: teacher.availability.map((interval) => ({ ...interval })),
        ...(teacher.preferences !== undefined ? { preferences: teacher.preferences.map((interval) => ({ ...interval })) } : {}),
        ...(teacher.sectionLimits !== undefined ? { sectionLimits: teacher.sectionLimits.filter((limit) => selectedCourses.has(limit.courseId) && teacher.courseIds.includes(limit.courseId)).map((limit) => ({ ...limit })) } : {}),
      })),
      rooms: resources.rooms.map((room) => ({
        ...room,
        availability: room.availability.map((interval) => ({ ...interval })),
      })),
    }
  }

  private toGeneratorInput(request: AcademicRequest, resources: AcademicPlanningResources): GeneratorInput {
    return {
      courses: request.demands.map((demand) => {
        const course = this.catalog.courses.find((candidate) => candidate.courseId === demand.courseId)!
        const pattern = demand.patternId
          ? course.planningPatterns!.find((candidate) => candidate.id === demand.patternId)!
          : course.planningPatterns?.[0]
        return {
          courseId: course.courseId,
          estimatedDemand: demand.estimatedDemand,
          targetCapacity: demand.targetCapacity ?? course.targetCapacity,
          ...(course.cycle !== undefined ? { cycle: course.cycle } : {}),
          weeklySessions: structuredClone(pattern?.weeklySessions ?? course.weeklySessions),
          deliveryMode: demand.deliveryMode ?? 'continuous',
          ...(demand.sectionCapacities !== undefined ? { sectionCapacities: demand.sectionCapacities.map((override) => ({ ...override })) } : {}),
        }
      }),
      teachers: resolvePlanningNormative(request, resources.teachers).teachers.filter((teacher) => teacher.courseIds.length > 0),
      rooms: resources.rooms.map(({ id, capacity, availability, kind }) => ({ id, capacity, availability: this.toIntervals(availability), ...(kind ? { kind } : {}) })),
      compatibleGroups: [],
      windows: [...this.toIntervals(this.catalog.windows), ...(request.planningPolicy?.allowSaturday
        ? [{ day: 6 as TimeInterval['day'], startMinute: 8 * 60, endMinute: 13 * 60 }] : [])],
      startStepMinutes: this.catalog.startStepMinutes,
      maxExplorations: this.catalog.maxExplorations,
      allocationPolicy: request.allocationPolicy ?? 'preferences',
      ...(request.planningPolicy ? { planningPolicy: structuredClone(request.planningPolicy) } : {}),
    }
  }

  private toIntervals(values: AcademicInterval[]): TimeInterval[] {
    // validateAcademicCatalog checked every day is an integer 1–7 at construction.
    return values.map((value) => ({ ...value, day: value.day as TimeInterval['day'] }))
  }

  private windowContains(windows: TimeInterval[], interval: TimeInterval): boolean {
    let end = interval.startMinute
    for (const window of windows.filter((candidate) => candidate.day === interval.day).sort((left, right) => left.startMinute - right.startMinute)) {
      if (window.endMinute <= end) continue
      if (window.startMinute > end) return false
      end = Math.max(end, window.endMinute)
      if (end >= interval.endMinute) return true
    }
    return false
  }

  private adjustmentRejected(resource: string, resourceId: string, reason: string): never {
    throw this.httpError(422, 'ADJUSTMENT_REJECTED', `${resource}:${resourceId}: ${reason}`)
  }

  private toSchedule(input: GeneratorInput, view: AcademicProposal) {
    const sections = prepareGeneratorInput(input).schedule.sections
    return {
      courses: input.courses.map((course) => course.courseId),
      teachers: input.teachers,
      rooms: input.rooms,
      compatibleGroups: [],
      sections,
      assignments: view.assignments.map((assignment) => ({
        id: assignment.sessionId,
        sectionId: assignment.sectionId,
        teacherId: assignment.teacherId,
        roomId: assignment.roomId,
        interval: { day: assignment.day, startMinute: assignment.startMinute, endMinute: assignment.endMinute },
        ...(assignment.sessionType ? { sessionType: assignment.sessionType } : {}),
      })),
    }
  }

  private isAllowedPlanningInterval(cycle: number, interval: TimeInterval, policy: NonNullable<AcademicRequest['planningPolicy']>): boolean {
    if (interval.day === 7) return false
    if (interval.day === 6) return policy.allowSaturday && interval.startMinute >= 8 * 60 && interval.endMinute <= 13 * 60
    if (interval.day < 1 || interval.day > 5) return false
    if (cycle >= 7) return (interval.startMinute >= 18 * 60 && interval.endMinute <= 22 * 60)
      || (policy.allowAfternoon && interval.startMinute >= 14 * 60 && interval.endMinute <= 22 * 60)
    return interval.startMinute >= 8 * 60 && interval.endMinute <= 22 * 60
  }

  private httpError(status: number, code: string, message: string): HttpException {
    return new HttpException({ error: { code, message } }, status)
  }
}

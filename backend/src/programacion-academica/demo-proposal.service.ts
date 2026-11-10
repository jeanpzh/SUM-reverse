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
import { buildLocalDeterministicAdvisor, analyzeProposalAdvisor, trySolveWithPythonEngine } from './planning-engine.client.js'
import { THESIS_COURSE_IDS } from '../../../shared/academic-planning-policy.mjs'

type RetainedProposal = {
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
    const candidates = buildLocalDeterministicAdvisor(retained.view, retained.input, retained.resources, this.catalog).recommendations
    if (value.selectedRecommendationIds?.some((id) => !candidates.some((r) => r.id === id))) {
      throw this.httpError(400, 'INVALID_REQUEST', 'Recomendación desconocida')
    }
    const result = await analyzeProposalAdvisor(retained.view, retained.input, retained.resources, retained.requirements, this.catalog, globalThis.fetch, value.selectedRecommendationIds)
    if ((retained.view.editVersion ?? 0) !== currentVersion) throw this.httpError(409, 'VERSION_MISMATCH', 'La propuesta cambió durante la simulación')
    return result
  }

  adjustProposal(proposalId: string, value: unknown): AcademicProposal {
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
      const input = this.toGeneratorInput(workspace.request, resources)
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
    const view = this.buildProposalView(workspace.request, trusted.input, trusted.resources, result, authority)
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
    const automaticView = structuredClone(snapshot.automaticView)
    const authority = createCoverageAuthority(prepared.input)
    const retained: RetainedProposal = { request: structuredClone(snapshot.request), input: prepared.input, resources: structuredClone(snapshot.resources), requirements: prepared.requirements,
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
      teachers: resources.teachers.filter((teacher) => teacher.courseIds.length > 0)
        .map(({ id, courseIds, maxWeeklyMinutes, availability, preferences, sectionLimits, facultyId, category, qualificationSource }) => ({ id, courseIds: [...courseIds], maxWeeklyMinutes, availability: this.toIntervals(availability),
          ...(preferences !== undefined ? { preferences: this.toIntervals(preferences) } : {}),
          ...(sectionLimits !== undefined ? { sectionLimits: sectionLimits.map((limit) => ({ ...limit })) } : {}),
          ...(facultyId !== undefined ? { facultyId } : {}), ...(category !== undefined ? { category } : {}),
          ...(qualificationSource !== undefined ? { qualificationSource } : {}),
        })),
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

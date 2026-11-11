import { startAcademicSearch, pollAcademicSearch, cancelAcademicSearch } from './academicScheduling.ts'
import type { AcademicSearch } from '../../../shared/programacion-academica-api.mjs'
import { resolveNormativeProfile, teacherLoadLimits } from '../../../shared/academic-normative-profile.mjs'
import { measureAdvisorOutcome, type AdvisorOutcome } from './advisorOutcome.ts'
import type { LectiveHourMinutes, LoadAuthorizationBlocker } from '../../../shared/academic-normative-profile.mjs'
// Sesión de programación: owns the internal planning workflow (Preparación → Horario → Revisión docente
// → Aprobación) behind a small interface. Plan: docs/reverse-engineering/plans/planning-session-ui-kit.md (D1–D3, D7).
//
// Shape: a pure reducer (`reducePlanningSession`) plus a store that runs async commands against an injected
// client. The store exists so commands can read the current state after awaiting; React consumes it through
// `usePlanningSession`. Rules are ported unchanged from the previous AcademicScheduling screen.
//
// Edit event → effects (ported from the screen):
// | event                    | invalidates proposal | invalidates demand estimate | clears demand base | dirty | ready-for-review → draft |
// | toggleCourse             | yes                  | yes                         | yes                | yes   | yes                      |
// | selectCourses            | yes                  | yes                         | yes                | yes   | yes                      |
// | applyBulkChanges         | yes                  | yes                         | yes                | yes   | yes                      |
// | updateCapacity           | yes                  | yes                         | yes                | yes   | yes                      |
// | updateDemand             | yes                  | no                          | no                 | yes   | yes                      |
// | changeDemandSource       | no                   | yes                         | yes                | yes   | yes                      |
// | updatePattern            | yes                  | no                          | no                 | yes   | yes                      |
// | updateDeliveryMode       | yes                  | no                          | no                 | yes   | yes                      |
// | updateResources          | yes                  | no                          | no                 | yes   | yes                      |
// | updateAllocationPolicy   | yes                  | no                          | no                 | yes   | yes                      |
// | updatePlanningException  | yes                  | no                          | no                 | yes   | yes                      |
// | updateLectiveHourMinutes | yes                  | no                          | no                 | yes   | yes                      |
// | applyPeriodDefaults      | yes                  | yes                         | yes                | yes   | yes                      |
// | setTitle, setDraftState  | no                   | no                          | no                 | yes   | no                       |
//
// Confirmations for discarding unsaved changes (resume, fork, period defaults) stay in the view: commands never
// open dialogs.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { validateAcademicAdvisorPatch, validateAcademicRequest, validateAcademicResources, validateAcademicWorkspace } from '../../../shared/programacion-academica-api.mjs'
import type {
  AcademicAdjustment, AcademicAdvisorPatch, AcademicAllocationPolicy, AcademicCatalog, AcademicDemandEstimate, AcademicDemandRequest,
  AcademicDemandSourceId, AcademicDraftList, AcademicDraftResume, AcademicDraftSaveRequest, AcademicDraftState,
  AcademicPlanningResources, AcademicProposal, AcademicPublicationRequest, AcademicRequest, AcademicReviewDecision,
  AcademicReviewSubmission, AcademicSavedDraft, AcademicTeacherReview, AcademicWorkspace,
} from '../../../shared/programacion-academica-api.mjs'
import {
  AcademicLoadAuthorizationError, PLANNING_LIMITS, academicPlanningErrorMessage, academicSectionCoverage, adjustAcademicProposal, aggregateAcademicBlocks, approveAcademicDraft,
  buildAcademicPlanningRequest, createAcademicPlanningDefaults, createAcademicProposal, estimateAcademicDemand,
  fetchAcademicCatalog, fetchAcademicDrafts, forkAcademicDraft, publishAcademicDraft, respondAcademicTeacherReview,
  resumeAcademicDraft, saveAcademicDraft, submitAcademicTeacherReview,
} from './academicScheduling.ts'
import type { PlanningPeriod, PlanningPolicy } from './academicScheduling.ts'

export type PlanningStageId = 'preparacion' | 'horario' | 'revision' | 'aprobacion'
export type PlanningPreparationView = 'resumen' | 'cursos' | 'recursos'

export function parsePlanningView(value: unknown, stage: PlanningStageId = 'preparacion'): PlanningPreparationView | undefined {
  if (stage !== 'preparacion') return undefined
  return value === 'cursos' || value === 'recursos' ? value : 'resumen'
}

export type PlanningBlock = ReturnType<typeof aggregateAcademicBlocks>[number]

// Client seam: the production adapter wraps the existing data functions; tests inject an in-memory one.
export interface PlanningSessionClient {
  startSearch?(request: AcademicRequest, requestId?: string): Promise<AcademicSearch>
  pollSearch?(jobId: string, signal?: AbortSignal): Promise<AcademicSearch>
  cancelSearch?(jobId: string): Promise<AcademicSearch>
  fetchCatalog(signal?: AbortSignal): Promise<AcademicCatalog>
  estimateDemand(request: AcademicDemandRequest, signal?: AbortSignal): Promise<AcademicDemandEstimate>
  createProposal(request: AcademicRequest, signal?: AbortSignal): Promise<AcademicProposal>
  adjustProposal(proposalId: string, adjustment: AcademicAdjustment, signal?: AbortSignal): Promise<AcademicProposal>
  fetchDrafts(signal?: AbortSignal): Promise<AcademicDraftList>
  saveDraft(request: AcademicDraftSaveRequest, signal?: AbortSignal): Promise<AcademicSavedDraft>
  resumeDraft(id: string, expectedVersion: number, signal?: AbortSignal): Promise<AcademicDraftResume>
  submitReview(id: string, request: AcademicReviewSubmission): Promise<AcademicSavedDraft>
  respondReview(id: string, request: AcademicReviewDecision): Promise<AcademicSavedDraft>
  approveDraft(id: string, expectedVersion: number): Promise<AcademicSavedDraft>
  publishDraft(id: string, request: AcademicPublicationRequest): Promise<AcademicSavedDraft>
  forkDraft(id: string, expectedVersion: number): Promise<AcademicSavedDraft>
}

export const defaultPlanningSessionClient: PlanningSessionClient = {
  startSearch: (request, requestId) => startAcademicSearch(request, 30, globalThis.fetch, requestId),
  pollSearch: (id, signal) => pollAcademicSearch(id, globalThis.fetch, signal),
  cancelSearch: (id) => cancelAcademicSearch(id),
  fetchCatalog: (signal) => fetchAcademicCatalog(globalThis.fetch, signal),
  estimateDemand: (request, signal) => estimateAcademicDemand(request, globalThis.fetch, signal),
  createProposal: (request, signal) => createAcademicProposal(request, globalThis.fetch, signal),
  adjustProposal: (proposalId, adjustment, signal) => adjustAcademicProposal(proposalId, adjustment, globalThis.fetch, signal),
  fetchDrafts: (signal) => fetchAcademicDrafts(globalThis.fetch, signal),
  saveDraft: (request, signal) => saveAcademicDraft(request, globalThis.fetch, signal),
  resumeDraft: (id, expectedVersion, signal) => resumeAcademicDraft(id, expectedVersion, globalThis.fetch, signal),
  submitReview: (id, request) => submitAcademicTeacherReview(id, request),
  respondReview: (id, request) => respondAcademicTeacherReview(id, request),
  approveDraft: (id, expectedVersion) => approveAcademicDraft(id, expectedVersion),
  publishDraft: (id, request) => publishAcademicDraft(id, request),
  forkDraft: (id, expectedVersion) => forkAcademicDraft(id, expectedVersion),
}

type Busy = { catalog: boolean; demand: boolean; generate: boolean; adjust: boolean; draft: boolean }
type Errors = { catalog: string | null; demand: string | null; proposal: string | null; adjustment: string | null;
  draft: string | null; review: string | null }
type Intents = { proposal: number; demand: number; draftList: number; draftSave: number; draftResume: number }

export interface PlanningSessionState {
  search: AcademicSearch | null
  catalog: AcademicCatalog | null
  period: PlanningPeriod
  lectiveHourMinutes?: AcademicWorkspace['lectiveHourMinutes']
  policy: PlanningPolicy | null
  allocationPolicy: AcademicAllocationPolicy
  selectedCourses: string[]
  demands: Record<string, string>
  capacities: Record<string, string>
  patterns: Record<string, string>
  deliveryModes: Record<string, 'continuous' | 'split'>
  resources: AcademicPlanningResources
  demandSourceId: AcademicDemandSourceId
  demandEstimate: AcademicDemandEstimate | null
  demandBaseRequest: AcademicDemandRequest | null
  proposal: AcademicProposal | null
  advisorOutcome: AdvisorOutcome | null
  proposalResources: AcademicPlanningResources | null
  editingBlock: AcademicAdjustment | null
  draft: { id: string | null; version: number | null; title: string; state: AcademicDraftState;
    savedState: AcademicDraftState; review: AcademicTeacherReview | undefined }
  draftList: AcademicDraftList | null
  dirty: boolean
  message: string | null
  busy: Busy
  errors: Errors
  intents: Intents
  mutation: number
  hydratedFromDraft: boolean
  // Server refusal to publish (LOAD_AUTHORIZATION_REQUIRED): the blocker list, shown through the draft error surface.
  releaseBlockers: LoadAuthorizationBlocker[] | null
  // Decisions of the last proposal while a configuration change has made it outdated; cleared by the next generation.
  staleDecisions: { proposalId: string; decisions: NonNullable<AcademicProposal['decisions']> } | null
}

export function initialPlanningSessionState(): PlanningSessionState {
  return {
    search: null, catalog: null, period: '2027-I', policy: null, allocationPolicy: 'preferences', selectedCourses: [],
    demands: {}, capacities: {}, patterns: {}, deliveryModes: {}, resources: { teachers: [], rooms: [] },
    demandSourceId: 'existing-regular-v1', demandEstimate: null, demandBaseRequest: null,
    proposal: null, advisorOutcome: null, proposalResources: null, editingBlock: null,
    draft: { id: null, version: null, title: 'Propuesta SISTEMAS 2027-I', state: 'draft', savedState: 'draft', review: undefined },
    draftList: null, dirty: false, message: null,
    busy: { catalog: true, demand: false, generate: false, adjust: false, draft: false },
    errors: { catalog: null, demand: null, proposal: null, adjustment: null, draft: null, review: null },
    intents: { proposal: 0, demand: 0, draftList: 0, draftSave: 0, draftResume: 0 },
    mutation: 0, hydratedFromDraft: false, releaseBlockers: null, staleDecisions: null,
  }
}

export type PlanningSessionEvent =
  | { type: 'advisor/applied'; outcome: AdvisorOutcome }
  | { type: 'catalog/started' }
  | { type: 'catalog/succeeded'; catalog: AcademicCatalog }
  | { type: 'catalog/failed'; message: string | null }
  | { type: 'toggleCourse'; courseId: string; checked: boolean }
  | { type: 'selectCourses'; courseIds: string[] }
  | { type: 'applyBulkChanges'; demands: Record<string, string>; capacities: Record<string, string> }
  | { type: 'updateDemand'; courseId: string; value: string }
  | { type: 'updateCapacity'; courseId: string; value: string }
  | { type: 'changeDemandSource'; value: AcademicDemandSourceId }
  | { type: 'updatePattern'; courseId: string; value: string }
  | { type: 'updateDeliveryMode'; courseId: string; value: 'continuous' | 'split' }
  | { type: 'updateResources'; value: AcademicPlanningResources }
  | { type: 'updateAllocationPolicy'; value: AcademicAllocationPolicy }
  | { type: 'updatePlanningException'; key: 'allowAfternoon' | 'allowSaturday'; checked: boolean }
  | { type: 'updateLectiveHourMinutes'; value: LectiveHourMinutes | undefined }
  | { type: 'applyAdvisorPatches'; patches: AcademicAdvisorPatch[] }
  | { type: 'applyPeriodDefaults'; period: PlanningPeriod; force?: boolean }
  | { type: 'setTitle'; title: string }
  | { type: 'setDraftState'; state: AcademicDraftState }
  | { type: 'startBlockReview'; block: PlanningBlock }
  | { type: 'changeEditingBlock'; adjustment: AcademicAdjustment }
  | { type: 'cancelBlockReview' }
  // Feedback written by AcademicPublicationPanel for its own preview/publication reads.
  | { type: 'setDraftError'; message: string | null }
  | { type: 'setDraftMessage'; message: string | null }
  | { type: 'demand/started' }
  | { type: 'demand/succeeded'; token: number; estimate: AcademicDemandEstimate; baseRequest: AcademicDemandRequest }
  | { type: 'demand/failed'; token: number; message: string | null }
  | { type: 'search/uncertain'; token: number; message: string }
  | { type: 'search/progress'; token: number; search: AcademicSearch; resources: AcademicPlanningResources }
  | { type: 'generate/started' }
  | { type: 'generate/succeeded'; token: number; proposal: AcademicProposal; resources: AcademicPlanningResources }
  | { type: 'generate/failed'; token: number; message: string }
  | { type: 'adjust/started' }
  | { type: 'adjust/succeeded'; token: number; proposal: AcademicProposal }
  | { type: 'adjust/failed'; token: number; message: string }
  | { type: 'draftList/started' }
  | { type: 'draftList/succeeded'; token: number; list: AcademicDraftList }
  | { type: 'draftList/failed'; token: number; message: string | null }
  | { type: 'draft/rejected'; message: string }
  | { type: 'save/started' }
  | { type: 'save/succeeded'; token: number; mutation: number; saved: AcademicSavedDraft }
  | { type: 'save/failed'; token: number; message: string }
  | { type: 'resume/started' }
  | { type: 'resume/succeeded'; token: number; mutation: number; draft: AcademicSavedDraft }
  | { type: 'resume/failed'; token: number; message: string | null }
  | { type: 'release/started' }
  | { type: 'release/succeeded'; saved: AcademicSavedDraft; message: string }
  | { type: 'release/failed'; message: string; blockers?: LoadAuthorizationBlocker[] }
  | { type: 'fork/succeeded'; mutation: number; draft: AcademicSavedDraft; sourceId: string }
  | { type: 'review/started' }
  | { type: 'review/succeeded'; mutation: number; saved: AcademicSavedDraft; message: string; staleMessage: string }
  | { type: 'review/failed'; message: string }

function cloneResources(resources: AcademicPlanningResources): AcademicPlanningResources {
  return {
    teachers: resources.teachers.map((teacher) => ({ ...structuredClone(teacher), courseIds: [...teacher.courseIds],
      availability: teacher.availability.map((interval) => ({ ...interval })),
      ...(teacher.preferences ? { preferences: teacher.preferences.map((interval) => ({ ...interval })) } : {}),
      ...(teacher.sectionLimits ? { sectionLimits: teacher.sectionLimits.map((limit) => ({ ...limit })) } : {}) })),
    rooms: resources.rooms.map((room) => ({ ...room, availability: room.availability.map((interval) => ({ ...interval })) })),
  }
}

function markDirty(state: PlanningSessionState, configurationChanged = false): PlanningSessionState {
  return { ...state, mutation: state.mutation + 1, dirty: true, message: null, releaseBlockers: null,
    draft: configurationChanged && state.draft.state === 'ready-for-review' ? { ...state.draft, state: 'draft' } : state.draft }
}

function invalidateProposal(state: PlanningSessionState): PlanningSessionState {
  const staleDecisions = state.proposal?.decisions?.length
    ? { proposalId: state.proposal.proposalId, decisions: structuredClone(state.proposal.decisions) } : state.staleDecisions
  return { ...state, intents: { ...state.intents, proposal: state.intents.proposal + 1 }, proposal: null, search: null, staleDecisions,
    advisorOutcome: null, proposalResources: null, editingBlock: null, busy: { ...state.busy, adjust: false, generate: false },
    errors: { ...state.errors, proposal: null, adjustment: null } }
}

function invalidateDemand(state: PlanningSessionState, clearBase = true): PlanningSessionState {
  return { ...state, intents: { ...state.intents, demand: state.intents.demand + 1 }, demandEstimate: null,
    demandBaseRequest: clearBase ? null : state.demandBaseRequest,
    busy: { ...state.busy, demand: false }, errors: { ...state.errors, demand: null } }
}

export function isPlanningDraftLocked(state: Pick<PlanningSessionState, 'draft'>): boolean {
  return state.draft.savedState === 'approved' || state.draft.savedState === 'published'
}

function hydrate(state: PlanningSessionState, draft: AcademicSavedDraft, message: string): PlanningSessionState {
  const config = draft.configuration
  const demands = config.request.demands
  return {
    ...state,
    hydratedFromDraft: true, advisorOutcome: null, releaseBlockers: null, staleDecisions: null,
    draft: { id: draft.id, version: draft.version, title: draft.title, state: draft.state, savedState: draft.state, review: draft.review },
    dirty: false,
    mutation: state.mutation + 1,
    period: config.academicPeriod,
    lectiveHourMinutes: config.lectiveHourMinutes,
    policy: config.request.planningPolicy ? { ...config.request.planningPolicy } : null,
    allocationPolicy: config.request.allocationPolicy ?? 'preferences',
    selectedCourses: demands.map((item) => item.courseId),
    demands: { ...state.demands, ...Object.fromEntries(demands.map((item) => [item.courseId, String(item.estimatedDemand)])) },
    capacities: { ...state.capacities, ...Object.fromEntries(demands.map((item) => [item.courseId, String(item.targetCapacity ?? '')])) },
    patterns: { ...state.patterns, ...Object.fromEntries(demands.flatMap((item) => item.patternId ? [[item.courseId, item.patternId]] : [])) },
    deliveryModes: { ...state.deliveryModes, ...Object.fromEntries(demands.map((item) => [item.courseId, item.deliveryMode ?? 'continuous'])) },
    demandSourceId: config.demandSourceId,
    demandBaseRequest: config.demandBaseRequest,
    demandEstimate: draft.demandBase,
    resources: cloneResources(config.request.resources),
    proposal: draft.proposal,
    proposalResources: draft.proposal ? config.request.resources : null,
    editingBlock: null,
    message,
  }
}

function applySaved(state: PlanningSessionState, saved: AcademicSavedDraft, includeState: boolean): PlanningSessionState {
  return { ...state, draft: { ...state.draft, id: saved.id, version: saved.version, savedState: saved.state,
    review: saved.review, ...(includeState ? { state: saved.state } : {}) } }
}

export function reducePlanningSession(state: PlanningSessionState, event: PlanningSessionEvent): PlanningSessionState {
  switch (event.type) {
    case 'advisor/applied':
      return state.proposal?.proposalId === event.outcome.proposalId && (state.proposal.editVersion ?? 0) === event.outcome.editVersion
        ? { ...state, advisorOutcome: event.outcome } : state
    case 'catalog/started':
      return { ...state, busy: { ...state.busy, catalog: true }, errors: { ...state.errors, catalog: null } }
    case 'catalog/succeeded': {
      const catalog = event.catalog
      let next: PlanningSessionState = { ...state, catalog }
      if (!state.hydratedFromDraft) {
        const defaults = createAcademicPlanningDefaults(catalog, '2027-I')
        next = { ...next, demands: defaults.demands, capacities: defaults.capacities,
          patterns: Object.fromEntries(catalog.courses.flatMap((course) => course.planningPatterns?.length
            ? [[course.courseId, course.planningPatterns[0].id]] : [])),
          selectedCourses: [], resources: defaults.resources, lectiveHourMinutes: defaults.lectiveHourMinutes, policy: defaults.planningPolicy }
      }
      next = invalidateDemand(next, false)
      return { ...next, busy: { ...next.busy, catalog: false } }
    }
    case 'catalog/failed':
      return { ...state, busy: { ...state.busy, catalog: false },
        errors: { ...state.errors, catalog: event.message ?? state.errors.catalog } }

    case 'toggleCourse': {
      if (event.checked && state.selectedCourses.length >= PLANNING_LIMITS.courses) return state
      const next = markDirty(invalidateDemand(invalidateProposal(state)), true)
      return { ...next, selectedCourses: event.checked
        ? state.selectedCourses.includes(event.courseId) ? state.selectedCourses : [...state.selectedCourses, event.courseId]
        : state.selectedCourses.filter((id) => id !== event.courseId) }
    }
    case 'selectCourses':
      return { ...markDirty(invalidateDemand(invalidateProposal(state)), true), selectedCourses: event.courseIds }
    case 'applyBulkChanges':
      return { ...markDirty(invalidateDemand(invalidateProposal(state)), true), demands: event.demands, capacities: event.capacities }
    case 'updateCapacity':
      return { ...markDirty(invalidateDemand(invalidateProposal(state)), true),
        capacities: { ...state.capacities, [event.courseId]: event.value } }
    case 'updateDemand':
      return { ...markDirty(invalidateProposal(state), true), demands: { ...state.demands, [event.courseId]: event.value } }
    case 'changeDemandSource':
      if (event.value === state.demandSourceId) return state
      return { ...markDirty(invalidateDemand(state), true), demandSourceId: event.value }
    case 'updatePattern':
      return { ...markDirty(invalidateProposal(state), true), patterns: { ...state.patterns, [event.courseId]: event.value } }
    case 'updateDeliveryMode':
      return { ...markDirty(invalidateProposal(state), true), deliveryModes: { ...state.deliveryModes, [event.courseId]: event.value } }
    case 'updateResources':
      return { ...markDirty(invalidateProposal(state), true), resources: event.value }
    case 'updateAllocationPolicy':
      return { ...markDirty(invalidateProposal(state), true), allocationPolicy: event.value }
    case 'updatePlanningException': {
      const policy: PlanningPolicy = { revision: 'FISI-PLANNING-1', period: state.period,
        allowAfternoon: state.policy?.allowAfternoon ?? false, allowSaturday: state.policy?.allowSaturday ?? false,
        [event.key]: event.checked }
      return { ...markDirty(invalidateProposal(state), true), policy }
    }
    case 'updateLectiveHourMinutes':
      return { ...markDirty(invalidateProposal(state), true), lectiveHourMinutes: event.value }
    case 'applyAdvisorPatches': {
      if (!event.patches.length) return state
      let nextResources = cloneResources(state.resources)
      let nextPolicy: PlanningPolicy | null = state.policy ? { ...state.policy } : null
      const nextDeliveryModes = { ...state.deliveryModes }
      for (const patch of event.patches) {
        validateAcademicAdvisorPatch(patch)
        if (patch.kind === 'increase_teacher_load') {
          const profile = resolveNormativeProfile({ facultyId: 'FISI', period: state.period })
          if (state.proposal?.normative?.profileRevision && state.proposal.normative.profileRevision !== profile.revision) throw new Error('El perfil normativo cambió; ejecuta una nueva búsqueda.')
          for (const adjustment of patch.adjustments) {
            const teacher = state.resources.teachers.find(t => t.id === adjustment.teacherId)
            const limit = teacher && state.lectiveHourMinutes !== undefined
              ? teacherLoadLimits(profile, teacher, { lectiveHourMinutes: state.lectiveHourMinutes }).authorizedMaxMinutes : null
            if (!teacher || teacher.maxWeeklyMinutes !== adjustment.previousMaxWeeklyMinutes || limit === null || adjustment.nextMaxWeeklyMinutes > limit) throw new Error('Carga obsoleta o no autorizada; revisa el docente y su perfil.')
          }
        }
        if (patch.kind === 'incorporate_reference_resource' && (!state.catalog
          || patch.teacherIds.some(id => !state.catalog?.referenceTeachers?.some(t => t.id === id))
          || patch.roomIds.some(id => !state.catalog?.referenceRooms?.some(r => r.id === id)))) throw new Error('Referencia desconocida')
      }

      for (const patch of event.patches) {
        if (patch.kind === 'increase_teacher_load') {
          const loadMap = new Map(patch.adjustments.map((item) => [item.teacherId, item.nextMaxWeeklyMinutes]))
          nextResources = {
            ...nextResources,
            teachers: nextResources.teachers.map((teacher) => {
              const targetLoad = loadMap.get(teacher.id)
              return targetLoad !== undefined && targetLoad > teacher.maxWeeklyMinutes
                ? { ...teacher, maxWeeklyMinutes: targetLoad }
                : teacher
            }),
          }
        } else if (patch.kind === 'enable_planning_window') {
          nextPolicy ??= { revision: 'FISI-PLANNING-1', period: state.period, allowAfternoon: false, allowSaturday: false }
          if (patch.allowAfternoon) nextPolicy = { ...nextPolicy, allowAfternoon: true }
          if (patch.allowSaturday) nextPolicy = { ...nextPolicy, allowSaturday: true }
        } else if (patch.kind === 'change_delivery_mode') {
          for (const courseId of patch.courseIds) {
            nextDeliveryModes[courseId] = 'split'
          }
        } else if (patch.kind === 'incorporate_reference_resource' && state.catalog) {
          const existingTeacherIds = new Set(nextResources.teachers.map((t) => t.id))
          const refTeachers = state.catalog.referenceTeachers ?? []
          const addedTeachers = patch.teacherIds
            .filter((id) => !existingTeacherIds.has(id))
            .flatMap((id) => {
              const refIndex = refTeachers.findIndex((t) => t.id === id)
              if (refIndex < 0) return []
              const ref = refTeachers[refIndex]!
              return [{
                ...ref,
                courseIds: [...ref.courseIds],
                maxWeeklyMinutes: 0,
                availability: [],
              }]
            })
          const existingRoomIds = new Set(nextResources.rooms.map((r) => r.id))
          const refRooms = state.catalog.referenceRooms ?? []
          const addedRooms = patch.roomIds
            .filter((id) => !existingRoomIds.has(id))
            .flatMap((id) => {
              const ref = refRooms.find((r) => r.id === id)
              if (!ref) return []
              return [{
                id: ref.id,
                name: ref.name,
                capacity: ref.capacity,
                kind: ref.kind,
                availability: [],
              }]
            })
          nextResources = {
            teachers: [...nextResources.teachers, ...addedTeachers],
            rooms: [...nextResources.rooms, ...addedRooms],
          }
        }
      }
      validateAcademicResources(nextResources)
      return {
        ...markDirty(invalidateProposal(state), true),
        resources: nextResources,
        policy: nextPolicy,
        deliveryModes: nextDeliveryModes,
      }
    }
    case 'applyPeriodDefaults': {
      if (!state.catalog || (event.period === state.period && !event.force)) return state
      const defaults = createAcademicPlanningDefaults(state.catalog, event.period)
      const next = markDirty(invalidateProposal(invalidateDemand(state)), true)
      return { ...next, lectiveHourMinutes: defaults.lectiveHourMinutes, period: event.period, policy: { ...(state.policy ?? defaults.planningPolicy), period: event.period },
        demands: defaults.demands, capacities: defaults.capacities }
    }
    case 'setTitle':
      return { ...markDirty(state), draft: { ...state.draft, title: event.title } }
    case 'setDraftState':
      return { ...markDirty(state), draft: { ...state.draft, state: event.state } }

    case 'startBlockReview': {
      if (!state.proposal || state.busy.generate || isPlanningDraftLocked(state) || state.busy.draft) return state
      const block = event.block
      const assignments = state.proposal.assignments.filter((assignment) => block.sessionIds.includes(assignment.sessionId))
        .sort((left, right) => left.startMinute - right.startMinute || left.sessionId.localeCompare(right.sessionId))
      return { ...state, errors: { ...state.errors, adjustment: null }, editingBlock: {
        expectedVersion: state.proposal.editVersion ?? 0, sectionId: block.sectionId,
        sessionIds: assignments.map((assignment) => assignment.sessionId), teacherId: block.teacherId,
        day: block.day, startMinute: block.startMinute, roomIds: assignments.map((assignment) => assignment.roomId) } }
    }
    case 'changeEditingBlock':
      return { ...state, editingBlock: event.adjustment }
    case 'cancelBlockReview':
      return { ...state, editingBlock: null, errors: { ...state.errors, adjustment: null } }
    case 'setDraftError':
      return { ...state, errors: { ...state.errors, draft: event.message } }
    case 'setDraftMessage':
      return { ...state, message: event.message }

    case 'demand/started':
      return { ...state, intents: { ...state.intents, demand: state.intents.demand + 1 }, demandEstimate: null,
        busy: { ...state.busy, demand: true }, errors: { ...state.errors, demand: null } }
    case 'demand/succeeded':
      if (event.token !== state.intents.demand) return state
      return { ...markDirty(state, true), demandEstimate: event.estimate, demandBaseRequest: event.baseRequest,
        busy: { ...state.busy, demand: false } }
    case 'demand/failed':
      if (event.token !== state.intents.demand) return state
      return { ...state, busy: { ...state.busy, demand: false },
        errors: { ...state.errors, demand: event.message ?? state.errors.demand } }

    case 'search/uncertain':
      if (event.token !== state.intents.proposal) return state
      return { ...state, busy: { ...state.busy, generate: true }, errors: { ...state.errors, proposal: event.message } }
    case 'search/progress':
      if (event.token !== state.intents.proposal) return state
      return { ...state, search: event.search, proposal: event.search.proposal ?? state.proposal,
        proposalResources: event.search.proposal ? event.resources : state.proposalResources,
        busy: { ...state.busy, generate: event.search.state === 'running' },
        errors: { ...state.errors, proposal: event.search.error?.message ?? null } }
    case 'generate/started': {
      const next = markDirty(state, true)
      return { ...next, advisorOutcome: null, intents: { ...next.intents, proposal: next.intents.proposal + 1 }, search: null,
        editingBlock: null, busy: { ...next.busy, adjust: false, generate: true },
        errors: { ...next.errors, proposal: null, adjustment: null } }
    }
    case 'generate/succeeded':
      if (event.token !== state.intents.proposal) return state
      return { ...markDirty(state), proposal: event.proposal, proposalResources: event.resources, staleDecisions: null,
        busy: { ...state.busy, generate: false } }
    case 'generate/failed':
      if (event.token !== state.intents.proposal) return state
      return { ...state, busy: { ...state.busy, generate: false }, errors: { ...state.errors, proposal: event.message } }

    case 'adjust/started':
      return { ...state, intents: { ...state.intents, proposal: state.intents.proposal + 1 },
        busy: { ...state.busy, adjust: true }, errors: { ...state.errors, adjustment: null } }
    case 'adjust/succeeded':
      if (event.token !== state.intents.proposal) return state
      return { ...markDirty(state), proposal: event.proposal, advisorOutcome: null, editingBlock: null, busy: { ...state.busy, adjust: false } }
    case 'adjust/failed':
      if (event.token !== state.intents.proposal) return state
      return { ...state, busy: { ...state.busy, adjust: false }, errors: { ...state.errors, adjustment: event.message } }

    case 'draftList/started':
      return { ...state, intents: { ...state.intents, draftList: state.intents.draftList + 1 }, errors: { ...state.errors, draft: null } }
    case 'draftList/succeeded':
      return event.token === state.intents.draftList ? { ...state, draftList: event.list } : state
    case 'draftList/failed':
      if (event.token !== state.intents.draftList || event.message === null) return state
      return { ...state, errors: { ...state.errors, draft: event.message } }

    case 'draft/rejected':
      return { ...state, errors: { ...state.errors, draft: event.message } }
    case 'save/started':
      return { ...state, intents: { ...state.intents, draftSave: state.intents.draftSave + 1 },
        busy: { ...state.busy, draft: true }, errors: { ...state.errors, draft: null }, message: null }
    case 'save/succeeded': {
      if (event.token !== state.intents.draftSave) return state
      const current = event.mutation === state.mutation
      const next = applySaved(state, event.saved, false)
      return { ...next, dirty: !current, busy: { ...next.busy, draft: false }, message: current
        ? `Guardada · versión ${event.saved.version}.`
        : 'Se guardó una captura anterior; la configuración actual sigue pendiente de guardar.' }
    }
    case 'save/failed':
      if (event.token !== state.intents.draftSave) return state
      return { ...state, busy: { ...state.busy, draft: false }, errors: { ...state.errors, draft: event.message } }

    case 'resume/started':
      return { ...state,
        intents: { ...state.intents, draftResume: state.intents.draftResume + 1, proposal: state.intents.proposal + 1,
          demand: state.intents.demand + 1, draftSave: state.intents.draftSave + 1 },
        busy: { ...state.busy, generate: false, adjust: false, demand: false, draft: true },
        errors: { ...state.errors, proposal: null, adjustment: null, demand: null, draft: null }, message: null }
    case 'resume/succeeded': {
      if (event.token !== state.intents.draftResume) return state
      const settled = { ...state, busy: { ...state.busy, draft: false } }
      if (event.mutation !== state.mutation) {
        return { ...settled, message: 'No se aplicó la recuperación porque la edición cambió mientras se consultaba. Puedes volver a abrir la propuesta.' }
      }
      const frozen = event.draft.state === 'approved' || event.draft.state === 'published'
      return hydrate(settled, event.draft, `Propuesta ${event.draft.title} recuperada.${frozen
        ? ' Es una versión congelada de solo lectura; crea un nuevo borrador para continuar.' : ' Puedes continuar editando el horario.'}`)
    }
    case 'resume/failed':
      if (event.token !== state.intents.draftResume) return state
      return { ...state, busy: { ...state.busy, draft: false },
        errors: { ...state.errors, draft: event.message ?? state.errors.draft } }

    case 'release/started':
      return { ...state, busy: { ...state.busy, draft: true }, errors: { ...state.errors, draft: null }, message: null, releaseBlockers: null }
    case 'release/succeeded': {
      const next = applySaved(state, event.saved, true)
      return { ...next, busy: { ...next.busy, draft: false }, message: event.message, releaseBlockers: null }
    }
    case 'release/failed':
      return { ...state, busy: { ...state.busy, draft: false }, errors: { ...state.errors, draft: event.message }, releaseBlockers: event.blockers ?? null }
    case 'fork/succeeded': {
      const settled = { ...state, busy: { ...state.busy, draft: false } }
      if (event.mutation !== state.mutation) {
        return { ...settled, message: 'No se aplicó el nuevo borrador porque la edición cambió mientras se consultaba. Puedes volver a intentarlo.' }
      }
      return hydrate(settled, event.draft, `Nuevo borrador creado desde ${event.sourceId.slice(0, 8)}. Puedes continuar editando el horario.`)
    }

    case 'review/started':
      return { ...state, busy: { ...state.busy, draft: true }, errors: { ...state.errors, review: null, draft: null } }
    case 'review/succeeded': {
      const next = applySaved(state, event.saved, false)
      const stale = event.mutation !== state.mutation
      return { ...next, busy: { ...next.busy, draft: false }, dirty: stale ? true : next.dirty,
        message: stale ? event.staleMessage : event.message }
    }
    case 'review/failed':
      return { ...state, busy: { ...state.busy, draft: false }, errors: { ...state.errors, review: event.message } }
  }
}

function errorText(error: unknown, prefix: string, fallback: string): string {
  return error instanceof Error ? `${prefix}${academicPlanningErrorMessage(error)}` : fallback
}

function requestBase(state: PlanningSessionState, catalog: AcademicCatalog, blankAsNaN: boolean) {
  const toNumber = (value: string | undefined) => blankAsNaN && value === '' ? Number.NaN : Number(value)
  return {
    revision: catalog.revision,
    ...(state.lectiveHourMinutes !== undefined ? { academicPeriod: state.period, lectiveHourMinutes: state.lectiveHourMinutes } : {}),
    demands: catalog.courses.filter((course) => state.selectedCourses.includes(course.courseId)).map((course) => ({
      courseId: course.courseId,
      estimatedDemand: toNumber(state.demands[course.courseId]),
      targetCapacity: toNumber(state.capacities[course.courseId]),
      ...(state.patterns[course.courseId] ? { patternId: state.patterns[course.courseId] } : {}),
      deliveryMode: state.deliveryModes[course.courseId] ?? 'continuous',
    })),
    allocationPolicy: state.allocationPolicy,
    resources: cloneResources(state.resources),
  }
}

// Throws with a user-facing message when the workspace cannot be saved.
export function buildPlanningWorkspace(state: PlanningSessionState): AcademicWorkspace {
  if (!state.catalog) throw new Error('Espera a que cargue el catálogo local antes de guardar.')
  const base = requestBase(state, state.catalog, false)
  const request = state.policy ? buildAcademicPlanningRequest(base, state.policy) : base
  validateAcademicRequest(request)
  validateAcademicResources(request.resources)
  const baseRequest = state.period === '2027-I' && state.demandBaseRequest && state.demandEstimate ? { ...state.demandBaseRequest,
    courses: state.demandEstimate.rows.map((row) => ({ courseId: row.courseId, targetCapacity: row.targetCapacity })) } : null
  const workspace: AcademicWorkspace = { ...(state.lectiveHourMinutes !== undefined ? { lectiveHourMinutes: state.lectiveHourMinutes } : {}), schoolId: 'SISTEMAS', academicPeriod: state.period, request,
    demandSourceId: state.demandSourceId, demandBaseRequest: baseRequest }
  validateAcademicWorkspace(workspace)
  return workspace
}

// Courses whose demand, capacity or required pattern are not valid (same rule the screen used before saving).
export function invalidPlanningCourses(state: PlanningSessionState): string[] {
  if (!state.catalog) return []
  return state.catalog.courses.filter((course) => state.selectedCourses.includes(course.courseId)).filter((course) => {
    const value = state.demands[course.courseId]
    const capacity = state.capacities[course.courseId]
    const patternIds = course.planningPatterns?.map((pattern) => pattern.id) ?? []
    return !(value !== undefined && value.trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0
      && capacity !== undefined && capacity.trim() !== '' && Number.isSafeInteger(Number(capacity)) && Number(capacity) > 0
      && (!patternIds.length || patternIds.includes(state.patterns[course.courseId])))
  }).map((course) => course.courseId)
}

function proposalComplete(proposal: AcademicProposal | null): boolean {
  return Boolean(proposal && proposal.status === 'complete' && proposal.coverageComplete && proposal.assignments.length > 0)
}

export type PlanningPrimaryActionId = 'review-offer' | 'generate' | 'back-preparation' | 'resolve-pending' | 'save'
  | 'submit-review' | 'record-response' | 'to-approval' | 'back-schedule' | 'back-review' | 'approve' | 'publish'
export type PlanningPrimaryAction = { id: PlanningPrimaryActionId; label: string; count?: number }

// D7 (local-only). Decisions beyond the plan table, recorded here:
// - Horario counts as pending every section that is not complete (partial + pending coverage).
// - Revisión docente without a review, or with changes requested/outdated teachers, sends back to Horario.
// - Aprobación before 'ready-for-approval' sends back to Revisión docente; approve is primary.
//   Approved/published versions have no primary action; publishing remains secondary with confirmation.
export function derivePlanningPrimaryAction(state: PlanningSessionState, stage: PlanningStageId): PlanningPrimaryAction | null {
  switch (stage) {
    case 'preparacion': {
      const invalid = invalidPlanningCourses(state).length
      if (!state.catalog || state.selectedCourses.length === 0 || invalid > 0) {
        return { id: 'review-offer', label: invalid ? `Revisar oferta (${invalid})` : 'Revisar oferta', count: invalid }
      }
      return { id: 'generate', label: 'Generar propuesta' }
    }
    case 'horario': {
      if (!state.proposal || state.proposal.status === 'invalid-input') return { id: 'back-preparation', label: 'Volver a Preparación' }
      const coverage = academicSectionCoverage(state.proposal)
      const pending = coverage.partial + coverage.pending
      if (pending > 0) return { id: 'resolve-pending', label: `Resolver pendientes (${pending})`, count: pending }
      if (state.dirty || !state.draft.id) return { id: 'save', label: 'Guardar borrador' }
      return { id: 'submit-review', label: 'Enviar a revisión docente' }
    }
    case 'revision': {
      const teachers = state.draft.review?.teachers ?? []
      if (!teachers.length) return { id: 'back-schedule', label: 'Volver a Horario' }
      const pending = teachers.filter((teacher) => teacher.status === 'pending').length
      if (pending > 0) return { id: 'record-response', label: `Registrar respuesta (${pending})`, count: pending }
      if (teachers.every((teacher) => teacher.status === 'conformity')) return { id: 'to-approval', label: 'Ir a aprobación' }
      return { id: 'back-schedule', label: 'Volver a Horario' }
    }
    case 'aprobacion': {
      const saved = state.draft.savedState
      if (saved === 'published') return null
      if (saved === 'approved') return state.draft.id && !state.dirty ? { id: 'publish', label: 'Publicar versión' } : null
      if (saved === 'ready-for-approval' && state.draft.id && !state.dirty) return { id: 'approve', label: 'Aprobar versión' }
      return { id: 'back-review', label: 'Volver a Revisión docente' }
    }
  }
}

export type PlanningStepStatus = 'done' | 'current' | 'upcoming'

// Local-only indicator for navigation. It reflects the saved state and the
// presence of a usable proposal; it grants nothing and blocks nothing.
export function derivePlanningProgress(state: Pick<PlanningSessionState, 'proposal' | 'draft'>): Record<PlanningStageId, PlanningStepStatus> {
  const saved = state.draft.savedState
  const order: PlanningStageId[] = ['preparacion', 'horario', 'revision', 'aprobacion']
  if (saved === 'published') return { preparacion: 'done', horario: 'done', revision: 'done', aprobacion: 'done' }
  const current: PlanningStageId = saved === 'approved' || saved === 'ready-for-approval' ? 'aprobacion'
    : saved === 'in-review' ? 'revision'
      : state.proposal && state.proposal.status !== 'invalid-input' ? 'horario' : 'preparacion'
  const index = order.indexOf(current)
  return Object.fromEntries(order.map((stage, position) =>
    [stage, position < index ? 'done' : position === index ? 'current' : 'upcoming'])) as Record<PlanningStageId, PlanningStepStatus>
}

export function derivePlanningDraftLabel(state: Pick<PlanningSessionState, 'draft' | 'dirty'>): string {
  const { draft, dirty } = state
  if (dirty) return draft.id && draft.version !== null
    ? `Cambios sin guardar · versión guardada ${draft.version}.` : 'Cambios sin guardar.'
  if (!draft.id || draft.version === null) return 'Borrador nuevo · Sin guardar'
  const labels: Record<AcademicDraftState, string> = {
    draft: 'Borrador', 'ready-for-review': 'Lista para revisión', 'in-review': 'En revisión docente',
    'ready-for-approval': 'Lista para aprobación', approved: 'Aprobada (simulada)', published: 'Publicada (simulada)',
  }
  return `${labels[draft.savedState]} r${draft.version} · Guardado`
}

export function derivePlanningView(state: PlanningSessionState) {
  const locked = isPlanningDraftLocked(state)
  const invalidCourses = invalidPlanningCourses(state)
  const offerValid = Boolean(state.catalog) && state.selectedCourses.length <= PLANNING_LIMITS.courses && invalidCourses.length === 0
  return {
    locked,
    draftLabel: derivePlanningDraftLabel(state),
    offerValid,
    invalidCourses,
    proposalComplete: proposalComplete(state.proposal),
    canSave: Boolean(state.catalog) && !state.busy.generate && !state.busy.draft && !locked && offerValid,
    disabledSaveReason: !state.catalog ? state.busy.catalog ? 'Cargando catálogo local…' : 'Catálogo local no disponible'
      : locked ? 'Versión congelada de solo lectura'
        : !offerValid ? 'Demanda y capacidad requeridas' : null,
    displayedDraftState: state.dirty && state.draft.savedState === 'ready-for-approval' ? 'draft' as const
      : state.draft.review && ['in-review', 'ready-for-approval'].includes(state.draft.savedState) ? state.draft.savedState : state.draft.state,
    coverage: state.proposal ? academicSectionCoverage(state.proposal) : null,
    primaryAction: (stage: PlanningStageId) => derivePlanningPrimaryAction(state, stage),
  }
}
export type PlanningSessionView = ReturnType<typeof derivePlanningView>

type Channel = 'catalog' | 'demand' | 'draft' | 'draftList'

export function createPlanningSession(client: PlanningSessionClient = defaultPlanningSessionClient,
  initial: PlanningSessionState = initialPlanningSessionState()) {
  let state = initial
  let disposed = false
  type ActiveSearch = { token: number; id: string; stopped: boolean; settled: boolean; cleanup?: Promise<boolean>; controller: AbortController }
  let active: ActiveSearch | null = null
  const pendingCleanup = new Set<ActiveSearch>()
  const performReconcile = async (run: ActiveSearch) => {
    run.stopped = true
    run.controller.abort()
    pendingCleanup.add(run)
    try {
      const search = await client.cancelSearch!(run.id)
      if (search.state === 'running') throw new Error('El motor sigue activo')
      run.settled = true
      pendingCleanup.delete(run)
      if (!disposed && !pendingCleanup.size && run.token !== state.intents.proposal && (!active || active.token !== state.intents.proposal)) {
        dispatch({ type: 'generate/failed', token: state.intents.proposal, message: '' })
      }
      if (!disposed && run.token === state.intents.proposal) dispatch({ type: 'search/progress', token: run.token, search, resources: state.resources })
      return true
    } catch {
      if (run.settled) { pendingCleanup.delete(run); return true }
      if (!disposed) dispatch({ type: 'search/uncertain', token: state.intents.proposal,
        message: 'No se confirmó la detención. Reintenta Cancelar antes de editar o guardar.' })
      return false
    }
  }
  const reconcile = (run: ActiveSearch): Promise<boolean> => {
    run.cleanup ??= performReconcile(run).finally(() => { run.cleanup = undefined })
    return run.cleanup
  }
  const stop = (run: ActiveSearch) => { void reconcile(run) }
  const listeners = new Set<() => void>()
  const controllers: Partial<Record<Channel, AbortController>> = {}
  const getState = () => state
  const dispatch = (event: PlanningSessionEvent) => {
    state = reducePlanningSession(state, event)
    if (active && active.token !== state.intents.proposal) { stop(active); active = null }
    if (pendingCleanup.size) state = { ...state, busy: { ...state.busy, generate: true } }
    for (const listener of listeners) listener()
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const open = (channel: Channel) => {
    controllers[channel]?.abort()
    const controller = new AbortController()
    controllers[channel] = controller
    return controller
  }
  const idle = () => !state.busy.draft && !state.busy.generate && !state.busy.adjust && !state.busy.demand

  const refreshDrafts = async () => {
    dispatch({ type: 'draftList/started' })
    const token = state.intents.draftList
    const controller = open('draftList')
    try {
      dispatch({ type: 'draftList/succeeded', token, list: await client.fetchDrafts(controller.signal) })
    } catch (error) {
      dispatch({ type: 'draftList/failed', token, message: controller.signal.aborted ? null
        : errorText(error, 'No se pudieron consultar las propuestas locales. ', 'No se pudieron consultar las propuestas locales.') })
    }
  }

  const commands = {
    edit: (event: Extract<PlanningSessionEvent, { type: 'toggleCourse' | 'selectCourses' | 'applyBulkChanges' | 'updateDemand'
      | 'updateCapacity' | 'changeDemandSource' | 'updatePattern' | 'updateDeliveryMode' | 'updateResources'
      | 'updateAllocationPolicy' | 'updatePlanningException' | 'updateLectiveHourMinutes' | 'applyAdvisorPatches' | 'applyPeriodDefaults' | 'setTitle' | 'setDraftState'
      | 'startBlockReview' | 'changeEditingBlock' | 'cancelBlockReview' | 'setDraftError'
      | 'setDraftMessage' }>) => { if (pendingCleanup.size) return; dispatch(event) },

    async applyAdvisorPatchesAndRegenerate(patches: AcademicAdvisorPatch[], expected?: { proposalId: string; editVersion: number }) {
      if (pendingCleanup.size || !patches.length || isPlanningDraftLocked(state) || state.busy.generate || state.busy.draft || state.busy.adjust) return false
      if (expected && (state.proposal?.proposalId !== expected.proposalId
        || (state.proposal.editVersion ?? 0) !== expected.editVersion)) {
        throw new Error('La propuesta cambió. Consulta de nuevo antes de aplicar recomendaciones.')
      }
      const before = state.proposal
      dispatch({ type: 'applyAdvisorPatches', patches })
      const applied = await commands.generate()
      if (applied && before && state.proposal) {
        dispatch({ type: 'advisor/applied', outcome: measureAdvisorOutcome(before, state.proposal, patches.length) })
      }
      return applied
    },

    async loadCatalog() {
      disposed = false // React StrictMode remounts effects on the same session.
      dispatch({ type: 'catalog/started' })
      const controller = open('catalog')
      try {
        const catalog = await client.fetchCatalog(controller.signal)
        if (controller.signal.aborted) return
        dispatch({ type: 'catalog/succeeded', catalog })
      } catch (error) {
        if (controller.signal.aborted) return
        dispatch({ type: 'catalog/failed', message: error instanceof Error
          ? academicPlanningErrorMessage(error) : 'No se pudo consultar el catálogo local.' })
      }
    },

    async estimateDemand() {
      const catalog = state.catalog
      if (!catalog || state.period !== '2027-I' || !state.selectedCourses.length) return
      const baseRequest: AcademicDemandRequest = {
        revision: catalog.revision, sourceId: state.demandSourceId, targetPeriod: '2027-I',
        courses: catalog.courses.filter((course) => state.selectedCourses.includes(course.courseId))
          .map((course) => ({ courseId: course.courseId, targetCapacity: Number(state.capacities[course.courseId]) })),
      }
      dispatch({ type: 'demand/started' })
      const token = state.intents.demand
      const controller = open('demand')
      try {
        const estimate = await client.estimateDemand(baseRequest, controller.signal)
        dispatch({ type: 'demand/succeeded', token, estimate, baseRequest })
      } catch (error) {
        dispatch({ type: 'demand/failed', token, message: controller.signal.aborted ? null
          : errorText(error, 'No se pudo estimar la demanda potencial local. ', 'No se pudo estimar la demanda potencial local.') })
      }
    },

    async cancelSearch() {
      const runs = new Set(pendingCleanup)
      if (active) runs.add(active)
      for (const run of runs) await reconcile(run)
    },

    async generate() {
      if (disposed || isPlanningDraftLocked(state) || state.busy.draft || state.busy.adjust) return false
      if (pendingCleanup.size) {
        for (const run of [...pendingCleanup]) if (!await reconcile(run)) return false
      }
      if (active && !active.settled) {
        if (!await reconcile(active)) return false
      }
      const catalog = state.catalog
      if (!catalog) return false
      dispatch({ type: 'generate/started' })
      const token = state.intents.proposal
      const base = requestBase(state, catalog, true)
      try {
        const request = state.policy ? buildAcademicPlanningRequest(base, state.policy) : base
        validateAcademicResources(request.resources)
        // Preserve the legacy test seam when only createProposal overrides the default client.
        // The actual default application and explicit job adapters always use jobs.
        if (client.startSearch && (client.createProposal === defaultPlanningSessionClient.createProposal
          || client.startSearch !== defaultPlanningSessionClient.startSearch)) {
          if (!client.pollSearch || !client.cancelSearch) throw new Error('Adaptador de búsquedas incompleto')
          const run: ActiveSearch = { token, id: crypto.randomUUID(), stopped: false, settled: false, controller: new AbortController() }
          active = run
          try {
            let search = await client.startSearch(request, run.id)
            // Legacy injected adapters may assign an ID instead of honoring requestId.
            // Finish any cancellation of the caller key before cleaning that late ID.
            if (run.id !== search.jobId) {
              await run.cleanup
              run.settled = false
              run.id = search.jobId
            }
            if (disposed || run.stopped || token !== state.intents.proposal) {
              await reconcile(run)
              return false
            }
            const deadline = Date.now() + (search.budgetSeconds * 1.5 + 30) * 1000
            while (!run.stopped && !disposed && token === state.intents.proposal) {
              dispatch({ type: 'search/progress', token, search, resources: request.resources })
              if (search.state !== 'running') { run.settled = true; return search.state === 'completed' && search.proposal !== null }
              if (Date.now() > deadline) throw new Error('La búsqueda no respondió dentro del plazo')
              await new Promise<void>(resolve => {
                const finish = () => { clearTimeout(timer); run.controller.signal.removeEventListener('abort', finish); resolve() }
                const timer = setTimeout(finish, 250)
                run.controller.signal.addEventListener('abort', finish, { once: true })
              })
              if (run.stopped || disposed) return false
              search = await client.pollSearch(run.id, run.controller.signal)
            }
            return false
          } catch (error) {
            const wasStopped = run.stopped
            if (!run.settled && !await reconcile(run)) return false
            if (wasStopped || disposed) return false
            throw error
          } finally { if (active === run && run.settled) active = null }
        }
        const proposal = await client.createProposal(request)
        dispatch({ type: 'generate/succeeded', token, proposal, resources: request.resources })
        return token === state.intents.proposal && state.proposal === proposal && proposal.status !== 'invalid-input'
      } catch (error) {
        dispatch({ type: 'generate/failed', token, message: errorText(error,
          'No se pudo generar la propuesta local. Revisa docentes, aulas y disponibilidad: ', 'No se pudo generar la propuesta local.') })
        return false
      }
    },

    async adjust() {
      const { proposal, editingBlock } = state
      if (!proposal || !editingBlock || state.busy.generate || state.busy.adjust || isPlanningDraftLocked(state) || state.busy.draft) return
      dispatch({ type: 'adjust/started' })
      const token = state.intents.proposal
      try {
        dispatch({ type: 'adjust/succeeded', token, proposal: await client.adjustProposal(proposal.proposalId, editingBlock) })
      } catch (error) {
        dispatch({ type: 'adjust/failed', token, message: errorText(error,
          'No se aplicó el ajuste; la propuesta anterior se conserva. ', 'No se aplicó el ajuste; la propuesta anterior se conserva.') })
      }
    },

    refreshDrafts,

    async save() {
      if (state.busy.generate || state.busy.draft || isPlanningDraftLocked(state)) return
      if (invalidPlanningCourses(state).length > 0 || !state.catalog || state.selectedCourses.length > PLANNING_LIMITS.courses) {
        dispatch({ type: 'draft/rejected', message: 'Completa demandas y capacidades válidas para todos los cursos seleccionados antes de guardar.' })
        return
      }
      if (state.draft.state === 'ready-for-review' && !proposalComplete(state.proposal)) {
        dispatch({ type: 'draft/rejected', message: 'Para marcarla lista, genera una propuesta completa con asignaciones válidas.' })
        return
      }
      let configuration: AcademicWorkspace
      try {
        configuration = buildPlanningWorkspace(state)
      } catch (error) {
        dispatch({ type: 'draft/rejected', message: error instanceof Error ? academicPlanningErrorMessage(error) : 'La configuración no es válida para guardar.' })
        return
      }
      const { proposal, draft } = state
      const mutation = state.mutation
      dispatch({ type: 'save/started' })
      const token = state.intents.draftSave
      try {
        const saved = await client.saveDraft({ id: draft.id, expectedVersion: draft.version, title: draft.title,
          state: draft.review ? 'draft' : draft.state === 'ready-for-review' ? 'ready-for-review' : 'draft', configuration,
          proposalId: proposal && proposal.status !== 'invalid-input' ? proposal.proposalId : null,
          proposalEditVersion: proposal && proposal.status !== 'invalid-input' ? proposal.editVersion ?? 0 : null })
        dispatch({ type: 'save/succeeded', token, mutation, saved })
        if (token === state.intents.draftSave) void refreshDrafts()
      } catch (error) {
        dispatch({ type: 'save/failed', token, message: errorText(error, 'No se guardaron los cambios. ', 'No se guardaron los cambios.') })
      }
    },

    // Resolves true when the requested draft replaced the workspace.
    async resume(id: string, version: number) {
      const mutation = state.mutation
      dispatch({ type: 'resume/started' })
      const token = state.intents.draftResume
      controllers.demand?.abort()
      const controller = open('draft')
      try {
        const { draft } = await client.resumeDraft(id, version, controller.signal)
        dispatch({ type: 'resume/succeeded', token, mutation, draft })
        return state.draft.id === draft.id && state.draft.version === draft.version
      } catch (error) {
        dispatch({ type: 'resume/failed', token, message: controller.signal.aborted ? null
          : errorText(error, 'No se abrió la propuesta; se conserva la edición actual. ', 'No se abrió la propuesta; se conserva la edición actual.') })
        return false
      }
    },

    async approve() {
      const { id, version, savedState } = state.draft
      if (!id || !version || state.dirty || !idle() || savedState !== 'ready-for-approval') return
      dispatch({ type: 'release/started' })
      try {
        const saved = await client.approveDraft(id, version)
        dispatch({ type: 'release/succeeded', saved, message: `Aprobada (simulada) · versión ${saved.version}.` })
        void refreshDrafts()
      } catch (error) {
        dispatch({ type: 'release/failed', message: errorText(error, 'No se aprobó la propuesta. ', 'No se aprobó la propuesta.') })
      }
    },

    async publish(expectedCurrentId: string | null) {
      const { id, version, savedState } = state.draft
      if (!id || !version || state.dirty || !idle() || savedState !== 'approved') return
      dispatch({ type: 'release/started' })
      try {
        const saved = await client.publishDraft(id, { expectedVersion: version, expectedCurrentId })
        dispatch({ type: 'release/succeeded', saved,
          message: `Publicada (simulada) · publicación ${saved.publication?.publicationVersion ?? '—'} · versión ${saved.version}.` })
        void refreshDrafts()
      } catch (error) {
        dispatch({ type: 'release/failed', message: errorText(error, 'No se publicó la propuesta. ', 'No se publicó la propuesta.'),
          ...(error instanceof AcademicLoadAuthorizationError ? { blockers: error.blockers } : {}) })
      }
    },

    // Resolves true when the forked draft replaced the workspace.
    async fork(id: string, version: number) {
      if (!idle()) return false
      const mutation = state.mutation
      dispatch({ type: 'release/started' })
      try {
        const draft = await client.forkDraft(id, version)
        dispatch({ type: 'fork/succeeded', mutation, draft, sourceId: id })
        return state.draft.id === draft.id
      } catch (error) {
        dispatch({ type: 'release/failed', message: errorText(error, 'No se creó el nuevo borrador. ', 'No se creó el nuevo borrador.') })
        return false
      }
    },

    async submitReview() {
      const { id, version } = state.draft
      if (!id || !version || state.dirty || state.busy.draft || !proposalComplete(state.proposal)) return
      const mutation = state.mutation
      dispatch({ type: 'review/started' })
      try {
        const saved = await client.submitReview(id, { expectedVersion: version })
        dispatch({ type: 'review/succeeded', mutation, saved,
          message: `Enviada a revisión · ronda ${saved.review?.round ?? '—'} · versión ${saved.version}.`,
          staleMessage: 'La revisión se actualizó sobre la versión guardada; los cambios locales siguen pendientes de guardar.' })
        void refreshDrafts()
      } catch (error) {
        dispatch({ type: 'review/failed', message: error instanceof Error ? academicPlanningErrorMessage(error) : 'No se pudo enviar la revisión local.' })
      }
    },

    async respondReview(teacherId: string, decision: 'conformity' | 'changes-requested', observation: string) {
      const { id, version, review } = state.draft
      if (!id || !version || !review || state.dirty || state.busy.draft) return
      const mutation = state.mutation
      dispatch({ type: 'review/started' })
      try {
        const saved = await client.respondReview(id, { expectedVersion: version, round: review.round, teacherId, decision, observation })
        dispatch({ type: 'review/succeeded', mutation, saved, message: `Respuesta guardada · versión ${saved.version}.`,
          staleMessage: 'La respuesta se guardó sobre la versión anterior; los cambios locales siguen pendientes de guardar.' })
        void refreshDrafts()
      } catch (error) {
        dispatch({ type: 'review/failed', message: error instanceof Error ? academicPlanningErrorMessage(error) : 'No se pudo guardar la respuesta local.' })
      }
    },
  }

  const dispose = () => {
    disposed = true
    if (active) stop(active)
    for (const controller of Object.values(controllers)) controller?.abort()
  }

  return { getState, subscribe, commands, dispose }
}
export type PlanningSession = ReturnType<typeof createPlanningSession>
export type PlanningSessionCommands = PlanningSession['commands']

// React binding: one session per mounted screen; the catalog loads on mount and requests abort on unmount.
export function usePlanningSession(client: PlanningSessionClient = defaultPlanningSessionClient) {
  const [session] = useState(() => createPlanningSession(client))
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)
  useEffect(() => {
    void session.commands.loadCatalog()
    return () => session.dispose()
  }, [session])
  const view = useMemo(() => derivePlanningView(state), [state])
  return { state, view, commands: session.commands }
}

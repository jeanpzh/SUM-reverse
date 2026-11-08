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
// | applyPeriodDefaults      | yes                  | yes                         | yes                | yes   | yes                      |
// | setTitle, setDraftState  | no                   | no                          | no                 | yes   | no                       |
//
// Confirmations for discarding unsaved changes (resume, fork, period defaults) stay in the view: commands never
// open dialogs.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { validateAcademicRequest, validateAcademicResources, validateAcademicWorkspace } from '../../../shared/programacion-academica-api.mjs'
import type {
  AcademicAdjustment, AcademicAllocationPolicy, AcademicCatalog, AcademicDemandEstimate, AcademicDemandRequest,
  AcademicDemandSourceId, AcademicDraftList, AcademicDraftResume, AcademicDraftSaveRequest, AcademicDraftState,
  AcademicPlanningResources, AcademicProposal, AcademicPublicationRequest, AcademicRequest, AcademicReviewDecision,
  AcademicReviewSubmission, AcademicSavedDraft, AcademicTeacherReview, AcademicWorkspace,
} from '../../../shared/programacion-academica-api.mjs'
import {
  PLANNING_LIMITS, academicSectionCoverage, adjustAcademicProposal, aggregateAcademicBlocks, approveAcademicDraft,
  buildAcademicPlanningRequest, createAcademicPlanningDefaults, createAcademicProposal, estimateAcademicDemand,
  fetchAcademicCatalog, fetchAcademicDrafts, forkAcademicDraft, publishAcademicDraft, respondAcademicTeacherReview,
  resumeAcademicDraft, saveAcademicDraft, submitAcademicTeacherReview,
} from './academicScheduling.ts'
import type { PlanningPeriod, PlanningPolicy } from './academicScheduling.ts'

export type PlanningStageId = 'preparacion' | 'horario' | 'revision' | 'aprobacion'
export type PlanningBlock = ReturnType<typeof aggregateAcademicBlocks>[number]

// Client seam: the production adapter wraps the existing data functions; tests inject an in-memory one.
export interface PlanningSessionClient {
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
  catalog: AcademicCatalog | null
  period: PlanningPeriod
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
}

export function initialPlanningSessionState(): PlanningSessionState {
  return {
    catalog: null, period: '2027-I', policy: null, allocationPolicy: 'preferences', selectedCourses: [],
    demands: {}, capacities: {}, patterns: {}, deliveryModes: {}, resources: { teachers: [], rooms: [] },
    demandSourceId: 'existing-regular-v1', demandEstimate: null, demandBaseRequest: null,
    proposal: null, proposalResources: null, editingBlock: null,
    draft: { id: null, version: null, title: 'Propuesta SISTEMAS 2027-I', state: 'draft', savedState: 'draft', review: undefined },
    draftList: null, dirty: false, message: null,
    busy: { catalog: true, demand: false, generate: false, adjust: false, draft: false },
    errors: { catalog: null, demand: null, proposal: null, adjustment: null, draft: null, review: null },
    intents: { proposal: 0, demand: 0, draftList: 0, draftSave: 0, draftResume: 0 },
    mutation: 0, hydratedFromDraft: false,
  }
}

export type PlanningSessionEvent =
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
  | { type: 'release/failed'; message: string }
  | { type: 'fork/succeeded'; mutation: number; draft: AcademicSavedDraft; sourceId: string }
  | { type: 'review/started' }
  | { type: 'review/succeeded'; mutation: number; saved: AcademicSavedDraft; message: string; staleMessage: string }
  | { type: 'review/failed'; message: string }

function cloneResources(resources: AcademicPlanningResources): AcademicPlanningResources {
  return {
    teachers: resources.teachers.map((teacher) => ({ ...teacher, courseIds: [...teacher.courseIds],
      availability: teacher.availability.map((interval) => ({ ...interval })),
      ...(teacher.preferences ? { preferences: teacher.preferences.map((interval) => ({ ...interval })) } : {}),
      ...(teacher.sectionLimits ? { sectionLimits: teacher.sectionLimits.map((limit) => ({ ...limit })) } : {}) })),
    rooms: resources.rooms.map((room) => ({ ...room, availability: room.availability.map((interval) => ({ ...interval })) })),
  }
}

function markDirty(state: PlanningSessionState, configurationChanged = false): PlanningSessionState {
  return { ...state, mutation: state.mutation + 1, dirty: true, message: null,
    draft: configurationChanged && state.draft.state === 'ready-for-review' ? { ...state.draft, state: 'draft' } : state.draft }
}

function invalidateProposal(state: PlanningSessionState): PlanningSessionState {
  return { ...state, intents: { ...state.intents, proposal: state.intents.proposal + 1 }, proposal: null,
    proposalResources: null, editingBlock: null, busy: { ...state.busy, adjust: false, generate: false },
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
    hydratedFromDraft: true,
    draft: { id: draft.id, version: draft.version, title: draft.title, state: draft.state, savedState: draft.state, review: draft.review },
    dirty: false,
    mutation: state.mutation + 1,
    period: config.academicPeriod,
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
          selectedCourses: [], resources: defaults.resources, policy: defaults.planningPolicy }
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
    case 'applyPeriodDefaults': {
      if (!state.catalog || (event.period === state.period && !event.force)) return state
      const defaults = createAcademicPlanningDefaults(state.catalog, event.period)
      const next = markDirty(invalidateProposal(invalidateDemand(state)), true)
      return { ...next, period: event.period, policy: { ...(state.policy ?? defaults.planningPolicy), period: event.period },
        demands: defaults.demands, capacities: defaults.capacities }
    }
    case 'setTitle':
      return { ...markDirty(state), draft: { ...state.draft, title: event.title } }
    case 'setDraftState':
      return { ...markDirty(state), draft: { ...state.draft, state: event.state } }

    case 'startBlockReview': {
      if (!state.proposal || isPlanningDraftLocked(state) || state.busy.draft) return state
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

    case 'generate/started': {
      const next = markDirty(state, true)
      return { ...next, intents: { ...next.intents, proposal: next.intents.proposal + 1 }, proposal: null,
        proposalResources: null, editingBlock: null, busy: { ...next.busy, adjust: false, generate: true },
        errors: { ...next.errors, proposal: null, adjustment: null } }
    }
    case 'generate/succeeded':
      if (event.token !== state.intents.proposal) return state
      return { ...markDirty(state), proposal: event.proposal, proposalResources: event.resources,
        busy: { ...state.busy, generate: false } }
    case 'generate/failed':
      if (event.token !== state.intents.proposal) return state
      return { ...state, busy: { ...state.busy, generate: false }, errors: { ...state.errors, proposal: event.message } }

    case 'adjust/started':
      return { ...state, intents: { ...state.intents, proposal: state.intents.proposal + 1 },
        busy: { ...state.busy, adjust: true }, errors: { ...state.errors, adjustment: null } }
    case 'adjust/succeeded':
      if (event.token !== state.intents.proposal) return state
      return { ...markDirty(state), proposal: event.proposal, editingBlock: null, busy: { ...state.busy, adjust: false } }
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
      return { ...state, busy: { ...state.busy, draft: true }, errors: { ...state.errors, draft: null }, message: null }
    case 'release/succeeded': {
      const next = applySaved(state, event.saved, true)
      return { ...next, busy: { ...next.busy, draft: false }, message: event.message }
    }
    case 'release/failed':
      return { ...state, busy: { ...state.busy, draft: false }, errors: { ...state.errors, draft: event.message } }
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
  return error instanceof Error ? `${prefix}${error.message}` : fallback
}

function requestBase(state: PlanningSessionState, catalog: AcademicCatalog, blankAsNaN: boolean) {
  const toNumber = (value: string | undefined) => blankAsNaN && value === '' ? Number.NaN : Number(value)
  return {
    revision: catalog.revision,
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
  const workspace: AcademicWorkspace = { schoolId: 'SISTEMAS', academicPeriod: state.period, request,
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
// - Aprobación before 'ready-for-approval' sends back to Revisión docente; a published version has no action.
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
      if (saved === 'approved') return { id: 'publish', label: 'Publicar' }
      if (saved === 'ready-for-approval' && state.draft.id && !state.dirty) return { id: 'approve', label: 'Aprobar versión' }
      return { id: 'back-review', label: 'Volver a Revisión docente' }
    }
  }
}

export function derivePlanningView(state: PlanningSessionState) {
  const locked = isPlanningDraftLocked(state)
  const invalidCourses = invalidPlanningCourses(state)
  const offerValid = Boolean(state.catalog) && state.selectedCourses.length <= PLANNING_LIMITS.courses && invalidCourses.length === 0
  return {
    locked,
    offerValid,
    invalidCourses,
    proposalComplete: proposalComplete(state.proposal),
    canSave: Boolean(state.catalog) && !state.busy.draft && !locked && offerValid,
    disabledSaveReason: !state.catalog ? 'Catálogo local no disponible'
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
  const listeners = new Set<() => void>()
  const controllers: Partial<Record<Channel, AbortController>> = {}
  const getState = () => state
  const dispatch = (event: PlanningSessionEvent) => {
    state = reducePlanningSession(state, event)
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
      | 'updateAllocationPolicy' | 'updatePlanningException' | 'applyPeriodDefaults' | 'setTitle' | 'setDraftState'
      | 'startBlockReview' | 'changeEditingBlock' | 'cancelBlockReview' | 'setDraftError'
      | 'setDraftMessage' }>) => dispatch(event),

    async loadCatalog() {
      dispatch({ type: 'catalog/started' })
      const controller = open('catalog')
      try {
        dispatch({ type: 'catalog/succeeded', catalog: await client.fetchCatalog(controller.signal) })
      } catch (error) {
        dispatch({ type: 'catalog/failed', message: controller.signal.aborted ? null
          : error instanceof Error ? error.message : 'No se pudo consultar el catálogo local.' })
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

    async generate() {
      const catalog = state.catalog
      if (!catalog) return
      dispatch({ type: 'generate/started' })
      const token = state.intents.proposal
      const base = requestBase(state, catalog, true)
      try {
        const request = state.policy ? buildAcademicPlanningRequest(base, state.policy) : base
        validateAcademicResources(request.resources)
        const proposal = await client.createProposal(request)
        dispatch({ type: 'generate/succeeded', token, proposal, resources: request.resources })
      } catch (error) {
        dispatch({ type: 'generate/failed', token, message: errorText(error,
          'No se pudo generar la propuesta local. Revisa docentes, aulas y disponibilidad: ', 'No se pudo generar la propuesta local.') })
      }
    },

    async adjust() {
      const { proposal, editingBlock } = state
      if (!proposal || !editingBlock || state.busy.adjust || isPlanningDraftLocked(state) || state.busy.draft) return
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
      if (state.busy.draft || isPlanningDraftLocked(state)) return
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
        dispatch({ type: 'draft/rejected', message: error instanceof Error ? error.message : 'La configuración no es válida para guardar.' })
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
        dispatch({ type: 'release/failed', message: errorText(error, 'No se publicó la propuesta. ', 'No se publicó la propuesta.') })
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
        dispatch({ type: 'review/failed', message: error instanceof Error ? error.message : 'No se pudo enviar la revisión local.' })
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
        dispatch({ type: 'review/failed', message: error instanceof Error ? error.message : 'No se pudo guardar la respuesta local.' })
      }
    },
  }

  const dispose = () => {
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

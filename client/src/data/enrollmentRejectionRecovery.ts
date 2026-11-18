import type {
  MatriculaRegularCauseCode,
  MatriculaRegularChoice,
  MatriculaRegularContext,
  MatriculaRegularEnvelope,
  MatriculaRegularId,
  MatriculaRegularOutcome,
} from '../../../shared/matricula-regular.mjs'
import { selectableCourses } from './sumEnrollmentTable.ts'

export const RECOVERABLE_REJECTION_CAUSES: ReadonlySet<MatriculaRegularCauseCode> = new Set([
  'CREDIT_LOAD_INVALID',
  'SCHEDULE_CONFLICT',
  'SECTION_FULL',
  'PREREQUISITE_UNMET',
  'RETAKE_PRIORITY',
  'COURSE_NOT_IN_PRE_ENROLLMENT',
  'PLAN_MISMATCH',
  'TUTORSHIP_REQUIREMENT_UNMET',
  'FOURTH_ENROLLMENT_RULE_UNMET',
])

export interface ProfileScopeIdentity {
  status: 'anonymous' | 'entering' | 'error' | 'active' | 'expired'
  runId: string | null
  actorId: MatriculaRegularId | null
  sessionId: string | null
  generation: number
}

export interface ReconcileSelectionResult {
  choices: MatriculaRegularChoice[]
  droppedChoices: MatriculaRegularChoice[]
  clearedReason: 'ineligible' | 'incomplete' | 'stale-offer' | null
}

export interface RejectionCloseResolution {
  selection: MatriculaRegularChoice[]
  shouldRefreshContext: boolean
  preserved: boolean
}

export function isRecoverableBusinessRejection(outcome: MatriculaRegularOutcome | null): boolean {
  if (!outcome || outcome.state !== 'rejected' || outcome.causes.length === 0) return false
  return outcome.causes.every((cause) => RECOVERABLE_REJECTION_CAUSES.has(cause.code))
}

/**
 * Reconciles preserved choices against the latest server Context:
 * keeps only course/section pairs still present in selectableCourses(context),
 * and clears everything if the context is no longer eligible or complete.
 */
export function reconcileSelectionWithContext(
  choices: readonly MatriculaRegularChoice[],
  context: MatriculaRegularContext,
): ReconcileSelectionResult {
  if (choices.length === 0) {
    return { choices: [], droppedChoices: [], clearedReason: null }
  }
  if (!context.preEnrollmentComplete || !context.offerKnown) {
    return {
      choices: [],
      droppedChoices: choices.map((c) => ({ courseId: c.courseId, sectionId: c.sectionId })),
      clearedReason: 'incomplete',
    }
  }
  if (context.eligibility.state !== 'eligible') {
    return {
      choices: [],
      droppedChoices: choices.map((c) => ({ courseId: c.courseId, sectionId: c.sectionId })),
      clearedReason: 'ineligible',
    }
  }

  const sectionsByCourse = new Map<MatriculaRegularId, Set<MatriculaRegularId>>()
  for (const course of selectableCourses(context)) {
    sectionsByCourse.set(course.courseId, new Set(course.sections.map((section) => section.sectionId)))
  }

  const kept: MatriculaRegularChoice[] = []
  const droppedChoices: MatriculaRegularChoice[] = []
  const seenCourseIds = new Set<MatriculaRegularId>()

  for (const choice of choices) {
    const allowedSections = sectionsByCourse.get(choice.courseId)
    if (allowedSections && allowedSections.has(choice.sectionId) && !seenCourseIds.has(choice.courseId)) {
      seenCourseIds.add(choice.courseId)
      kept.push({ courseId: choice.courseId, sectionId: choice.sectionId })
    } else {
      droppedChoices.push({ courseId: choice.courseId, sectionId: choice.sectionId })
    }
  }

  return {
    choices: kept,
    droppedChoices,
    clearedReason: droppedChoices.length > 0 ? 'stale-offer' : null,
  }
}

/**
 * Resolves selection state when closing an Outcome dialog.
 * Recoverable business rejections preserve still-valid choices (recovering from outcome.selection
 * after a reload + consult/replay) and always request a fresh context/vacancy read.
 * Accepted outcomes stay untouched and never trigger a rejection reset.
 */
export function resolveRejectionClose(input: {
  outcome: MatriculaRegularOutcome | null
  currentSelection: readonly MatriculaRegularChoice[]
}): RejectionCloseResolution {
  if (!input.outcome || input.outcome.state !== 'rejected') {
    return {
      selection: input.currentSelection.map((c) => ({ courseId: c.courseId, sectionId: c.sectionId })),
      shouldRefreshContext: false,
      preserved: true,
    }
  }
  if (!isRecoverableBusinessRejection(input.outcome)) {
    return {
      selection: [],
      shouldRefreshContext: true,
      preserved: false,
    }
  }
  const source = input.currentSelection.length > 0 ? input.currentSelection : input.outcome.selection
  return {
    selection: source.map((c) => ({ courseId: c.courseId, sectionId: c.sectionId })),
    shouldRefreshContext: true,
    preserved: true,
  }
}

export function resolveProfileSnapshotTransition(
  prevIdentity: ProfileScopeIdentity | null,
  nextSnapshot: ProfileScopeIdentity,
): 'unchanged' | 'expired' | 'reset' {
  if (!prevIdentity) {
    return nextSnapshot.status === 'expired' ? 'expired' : 'unchanged'
  }
  if (nextSnapshot.status === 'anonymous' || nextSnapshot.status === 'error') {
    return 'reset'
  }
  if (
    prevIdentity.runId !== nextSnapshot.runId
    || prevIdentity.actorId !== nextSnapshot.actorId
    || prevIdentity.generation !== nextSnapshot.generation
  ) {
    return 'reset'
  }
  if (nextSnapshot.status === 'expired' && prevIdentity.status !== 'expired') {
    return 'expired'
  }
  return 'unchanged'
}

export function applyContextRefresh(input: {
  envelope: MatriculaRegularEnvelope<MatriculaRegularContext>
  currentSelection: readonly MatriculaRegularChoice[]
  expectedRunId: string | null
  expectedActorId: MatriculaRegularId | null
}): { accepted: boolean; reconciled: ReconcileSelectionResult } {
  if (
    (input.expectedRunId !== null && input.envelope.runId !== input.expectedRunId)
    || (input.expectedActorId !== null && input.envelope.data.actorId !== input.expectedActorId)
  ) {
    return {
      accepted: false,
      reconciled: { choices: [], droppedChoices: [], clearedReason: null },
    }
  }
  return {
    accepted: true,
    reconciled: reconcileSelectionWithContext(input.currentSelection, input.envelope.data),
  }
}

export function formatDroppedSelectionNotice(reconciled: ReconcileSelectionResult): string | null {
  if (reconciled.droppedChoices.length === 0) return null
  if (reconciled.clearedReason === 'stale-offer') {
    return 'Algunas asignaturas o secciones seleccionadas ya no están disponibles en la oferta actualizada y fueron retiradas de tu selección.'
  }
  if (reconciled.clearedReason === 'ineligible' || reconciled.clearedReason === 'incomplete') {
    return 'El contexto académico ya no está habilitado para selección; se limpió la selección previa.'
  }
  return null
}

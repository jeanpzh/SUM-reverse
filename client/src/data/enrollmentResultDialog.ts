import type {
  MatriculaRegularCause,
  MatriculaRegularOutcome,
  MatriculaRegularUuid,
} from '../../../shared/matricula-regular.mjs'
import { CAUSE_MESSAGES } from './academicRequirements.ts'

export type DialogKind = 'accepted' | 'rejected'

export interface FormattedOutcomeCause {
  code: string
  title: string
  description: string
  coursesSummary: string | null
  sectionsSummary: string | null
}

export interface AcceptedOutcomeSummary {
  courseCount: number
  enrollmentId: MatriculaRegularUuid
  reportPath: string
}

/**
 * Type guard for Accepted outcome (D1):
 * Must have state 'accepted', empty causes, empty gaps, valid enrollmentId and valid reportPath.
 */
export function isAcceptedOutcome(
  outcome: MatriculaRegularOutcome | null,
): outcome is MatriculaRegularOutcome & {
  state: 'accepted'
  enrollmentId: MatriculaRegularUuid
  reportPath: string
} {
  if (!outcome) return false
  return (
    outcome.state === 'accepted' &&
    outcome.causes.length === 0 &&
    outcome.gaps.length === 0 &&
    typeof outcome.enrollmentId === 'string' &&
    outcome.enrollmentId.length > 0 &&
    typeof outcome.reportPath === 'string' &&
    outcome.reportPath.length > 0
  )
}

/**
 * Type guard for Academic Rejected outcome (D2):
 * Must have state 'rejected', non-empty causes, empty gaps, null enrollmentId and null reportPath.
 */
export function isRejectedAcademicOutcome(
  outcome: MatriculaRegularOutcome | null,
): outcome is MatriculaRegularOutcome & {
  state: 'rejected'
  enrollmentId: null
  reportPath: null
} {
  if (!outcome) return false
  return (
    outcome.state === 'rejected' &&
    outcome.causes.length > 0 &&
    outcome.gaps.length === 0 &&
    outcome.enrollmentId === null &&
    outcome.reportPath === null
  )
}

/**
 * Determines whether a modal dialog should be displayed, and of which kind.
 * Returns 'accepted' for D1, 'rejected' for D2.
 * Returns null for pending, uncertain, null, or malformed outcomes.
 * Rule: Dialog local accepted/rejected ONLY. No dialogs for pending/uncertain.
 */
export function getDialogKind(outcome: MatriculaRegularOutcome | null): DialogKind | null {
  if (isAcceptedOutcome(outcome)) return 'accepted'
  if (isRejectedAcademicOutcome(outcome)) return 'rejected'
  return null
}

/**
 * Formats the list of rejection causes for display in the D2 modal dialog.
 * Causes are formatted as a set, with clear descriptive titles and details.
 */
export function formatOutcomeCauses(
  causes: readonly MatriculaRegularCause[],
): FormattedOutcomeCause[] {
  return causes.map((cause) => {
    const msg = CAUSE_MESSAGES[cause.code] ?? {
      title: `Motivo: ${cause.code}`,
      description: 'Causa de rechazo académico identificada al procesar la solicitud.',
    }

    const coursesSummary = cause.courseIds.length > 0
      ? `Asignatura(s): ${cause.courseIds.join(', ')}`
      : null

    const sectionsSummary = cause.sectionIds.length > 0
      ? `Sección(es): ${cause.sectionIds.join(', ')}`
      : null

    return {
      code: cause.code,
      title: msg.title,
      description: msg.description,
      coursesSummary,
      sectionsSummary,
    }
  })
}

/**
 * Extracts accepted enrollment summary for D1 dialog without exposing internal debug UUIDs
 * (requestId, sessionId, runId are internal).
 */
export function formatAcceptedSummary(
  outcome: MatriculaRegularOutcome & {
    state: 'accepted'
    enrollmentId: MatriculaRegularUuid
    reportPath: string
  },
): AcceptedOutcomeSummary {
  return {
    courseCount: outcome.selection.length,
    enrollmentId: outcome.enrollmentId,
    reportPath: outcome.reportPath,
  }
}

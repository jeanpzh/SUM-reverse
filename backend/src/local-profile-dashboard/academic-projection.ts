import {
  validateEnrollmentReportResponse,
  validateOutcome,
} from '../../../shared/matricula-regular.mjs'
import type {
  MatriculaRegularContext,
  MatriculaRegularEnrollmentReport,
  MatriculaRegularEnvelope,
} from '../../../shared/matricula-regular.mjs'
import type { AcademicKey, ActorId } from '../../../shared/local-profile-dashboard.mjs'
import { MatriculaRegularError } from '../matricula-regular/matricula-regular-error.filter.js'
import { projectContext } from '../matricula-regular/context.service.js'
import type { RunSnapshot } from '../matricula-regular/store.types.js'

function localFailure(snapshot: RunSnapshot): never {
  throw new MatriculaRegularError(500, snapshot.runId, 'LOCAL_FAILURE')
}

export function projectAcademicRead(
  key: AcademicKey,
  snapshot: RunSnapshot,
  actorId: ActorId,
  now: Date,
): MatriculaRegularContext {
  void key
  return projectContext(snapshot, actorId, now).data
}

export function projectCommittedReport(
  snapshot: RunSnapshot,
  actorId: ActorId,
): MatriculaRegularEnrollmentReport | null {
  if (!snapshot.actors.some((actor) => actor.actorId === actorId)) {
    throw new MatriculaRegularError(404, snapshot.runId, 'ACTOR_NOT_FOUND')
  }

  const enrollments = snapshot.enrollments.filter(([key, enrollment]) => key === actorId && enrollment.actorId === actorId)
  const actorReports = snapshot.reports.filter(([, report]) => report.actorId === actorId)
  const actorRequests = snapshot.requests.filter(([, request]) => request.outcome.actorId === actorId)
  if (enrollments.length === 0) {
    if (actorReports.length > 0 || actorRequests.some(([, request]) =>
      request.outcome.state === 'accepted' && request.outcome.enrollmentId !== null,
    )) return localFailure(snapshot)
    return null
  }
  if (enrollments.length !== 1) return localFailure(snapshot)
  if (actorReports.length !== 1) return localFailure(snapshot)

  const [, enrollment] = enrollments[0]!
  const enrollmentId = enrollment.enrollmentId
  const actor = snapshot.actors.find((candidate) => candidate.actorId === actorId)!
  const storedRequest = snapshot.requests.find(([key]) => key === `${actorId}:${enrollment.requestId}`)?.[1]
  const reports = snapshot.reports.filter(([id]) => id === enrollmentId)
  if (storedRequest === undefined || reports.length !== 1) return localFailure(snapshot)

  const [, report] = reports[0]!
  try {
    validateOutcome(storedRequest.outcome)
  } catch {
    return localFailure(snapshot)
  }

  const outcome = storedRequest.outcome
  const exactLink = enrollment.requestId === storedRequest.outcome.requestId
    && storedRequest.payload.actorId === actorId
    && storedRequest.payload.profileRevision === actor.profileRevision
    && JSON.stringify(storedRequest.payload.selection) === JSON.stringify(enrollment.selection)
    && enrollment.profileRevision === actor.profileRevision
    && storedRequest.outcome.state === 'accepted'
    && storedRequest.outcome.actorId === actorId
    && storedRequest.outcome.profileRevision === actor.profileRevision
    && storedRequest.outcome.enrollmentId === enrollmentId
    && storedRequest.outcome.selection.length === enrollment.selection.length
    && JSON.stringify(storedRequest.outcome.selection) === JSON.stringify(enrollment.selection)
    && report.enrollmentId === enrollmentId
    && report.requestId === enrollment.requestId
    && report.actorId === actorId
    && JSON.stringify(report.scope) === JSON.stringify(actor.scope)
    && report.profileRevision === actor.profileRevision
    && report.acceptedAt === enrollment.acceptedAt
    && report.acceptedAt === outcome.evaluatedAt
    && report.windowOrigin === outcome.windowOrigin
    && report.rows.length === enrollment.selection.length
  if (!exactLink) return localFailure(snapshot)

  const response: MatriculaRegularEnvelope<MatriculaRegularEnrollmentReport> = {
    runId: snapshot.runId,
    data: structuredClone(report),
  }
  try {
    validateEnrollmentReportResponse(response, {
      runId: snapshot.runId,
      actorId,
      enrollmentId,
    })
  } catch {
    return localFailure(snapshot)
  }
  return response.data
}

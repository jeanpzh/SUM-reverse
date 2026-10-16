import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import {
  validateEnrollmentReport,
  validateOutcome,
  validateOutcomeResponse,
} from '../../../shared/matricula-regular.mjs'
import type {
  MatriculaRegularCause,
  MatriculaRegularEnvelope,
  MatriculaRegularOutcome,
  MatriculaRegularSubmission,
} from '../../../shared/matricula-regular.mjs'
import { evaluateSelectionAdmission } from './selection.rules.js'
import { evaluateSubmissionRules } from './rules.js'
import { canonicalizeCauses } from './canonical-causes.js'
import { evaluateContextEligibility } from './windows.js'
import { MATRICULA_REGULAR_CLOCK } from './context.service.js'
import type { ServerClock } from './clock.js'
import { MatriculaRegularError } from './matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from './matricula-regular.repository.js'
import type { RunState } from './store.types.js'

const canonicalSelection = (selection: MatriculaRegularSubmission['selection']) =>
  structuredClone(selection).sort((left, right) =>
    left.courseId.localeCompare(right.courseId) || left.sectionId.localeCompare(right.sectionId),
  )

function requestKey(actorId: string, requestId: string): string {
  return `${actorId}:${requestId}`
}

function canonicalPayload(request: MatriculaRegularSubmission) {
  return {
    actorId: request.actorId,
    profileRevision: request.profileRevision,
    selection: canonicalSelection(request.selection),
  }
}

function equalPayload(
  left: ReturnType<typeof canonicalPayload>,
  right: ReturnType<typeof canonicalPayload>,
): boolean {
  return left.actorId === right.actorId
    && left.profileRevision === right.profileRevision
    && JSON.stringify(left.selection) === JSON.stringify(right.selection)
}

function alreadyEnrolledCause(): MatriculaRegularCause {
  return { code: 'ALREADY_ENROLLED', courseIds: [], sectionIds: [], sourceIds: ['L-01'] }
}

function commit(state: RunState, request: MatriculaRegularSubmission, clockNow: Date): MatriculaRegularEnvelope<MatriculaRegularOutcome> {
  const key = requestKey(request.actorId, request.requestId)
  const stored = state.requests.get(key)
  if (stored !== undefined) {
    if (!equalPayload(stored.payload, canonicalPayload(request))) {
      throw new MatriculaRegularError(409, state.runId, 'REQUEST_CONFLICT')
    }
    const response = { runId: state.runId, data: structuredClone(stored.outcome) }
    validateOutcomeResponse(response, {
      runId: state.runId,
      actorId: request.actorId,
      requestId: request.requestId,
    })
    return response
  }

  const actor = state.actors.find((candidate) => candidate.actorId === request.actorId)
  if (actor === undefined) throw new MatriculaRegularError(404, state.runId, 'ACTOR_NOT_FOUND')

  const selectedCourses = request.selection.map((choice) => {
    const course = state.offer.find((candidate) => candidate.courseId === choice.courseId)
    const section = course?.sections.find((candidate) => candidate.sectionId === choice.sectionId)
    if (course === undefined || section === undefined) {
      throw new MatriculaRegularError(404, state.runId, 'CHOICE_NOT_FOUND')
    }
    return { choice, course, section }
  })

  if (request.profileRevision !== actor.profileRevision) {
    throw new MatriculaRegularError(409, state.runId, 'PROFILE_CHANGED')
  }

  const session = state.sessions.find((candidate) => candidate.sessionId === request.sessionId)
  if (session === undefined) throw new MatriculaRegularError(404, state.runId, 'SESSION_NOT_FOUND')
  if (session.actorId !== request.actorId || session.runId !== request.runId) {
    throw new MatriculaRegularError(409, state.runId, 'SESSION_CONTEXT_MISMATCH')
  }
  if (clockNow.getTime() >= Date.parse(session.expiresAt)) {
    throw new MatriculaRegularError(409, state.runId, 'SESSION_EXPIRED')
  }

  const eligibility = evaluateContextEligibility(state.profiles, actor, clockNow)
  const profileMissing = eligibility.gaps.some((item) =>
    item.code === 'PROFILE_MISSING' && item.sourceIds.length === 0,
  )
  const admission = profileMissing
    ? { causes: [], gaps: [] }
    : evaluateSelectionAdmission(actor, state.offer, request.selection)
  const evaluated = evaluateSubmissionRules({
    actor,
    offer: state.offer,
    selection: request.selection,
    now: clockNow,
    eligibility,
    additionalCauses: admission.causes,
    additionalGaps: admission.gaps,
  })
  const causes = state.enrollments.has(actor.actorId)
    ? canonicalizeCauses([...evaluated.causes, alreadyEnrolledCause()])
    : canonicalizeCauses(evaluated.causes)
  const gaps = evaluated.gaps
  const stateName: MatriculaRegularOutcome['state'] = gaps.length > 0
    ? 'configuration-pending'
    : causes.length > 0 ? 'rejected' : 'accepted'
  const enrollmentId = stateName === 'accepted' ? randomUUID() : null
  const selection = canonicalSelection(request.selection)
  const outcome: MatriculaRegularOutcome = {
    requestId: request.requestId,
    actorId: request.actorId,
    profileRevision: request.profileRevision,
    state: stateName,
    evaluatedAt: clockNow.toISOString(),
    windowOrigin: evaluated.windowOrigin,
    selection,
    causes,
    gaps,
    enrollmentId,
    reportPath: enrollmentId === null ? null : `/local/matricula-regular/v1/reportes/${enrollmentId}`,
  }
  validateOutcome(outcome)

  const candidate = state
  if (stateName === 'accepted' && selectedCourses.some(({ section }) => section.occupied >= section.capacity)) {
    throw new MatriculaRegularError(500, state.runId, 'LOCAL_FAILURE')
  }
  candidate.requests.set(key, {
    payload: canonicalPayload(request),
    outcome: structuredClone(outcome),
  })

  if (stateName === 'accepted' && enrollmentId !== null) {
    for (const { course, section } of selectedCourses) {
      const candidateSection = candidate.offer
        .find((item) => item.courseId === course.courseId)!
        .sections.find((item) => item.sectionId === section.sectionId)!
      candidateSection.occupied += 1
    }
    const enrollment = {
      enrollmentId,
      requestId: request.requestId,
      actorId: actor.actorId,
      profileRevision: actor.profileRevision,
      selection,
      acceptedAt: outcome.evaluatedAt,
    }
    candidate.enrollments.set(actor.actorId, enrollment)
    const report: unknown = {
      enrollmentId,
      requestId: request.requestId,
      actorId: actor.actorId,
      scope: structuredClone(actor.scope),
      profileRevision: actor.profileRevision,
      acceptedAt: outcome.evaluatedAt,
      windowOrigin: evaluated.windowOrigin ?? 'synthetic',
      rows: selectedCourses
        .map(({ choice, course, section }) => ({
          courseId: course.courseId,
          sectionId: section.sectionId,
          planId: course.planId,
          name: course.name,
          credits: course.credits,
          schedule: structuredClone(section.schedule ?? []),
          ...(course.cycle === undefined ? {} : { cycle: course.cycle }),
          ...(section.label === undefined ? {} : { label: section.label }),
          ...(section.teacher === undefined ? {} : { teacher: section.teacher }),
          choice,
        }))
        .sort((left, right) => left.courseId.localeCompare(right.courseId))
        .map(({ choice: _choice, ...row }) => row),
      totalCredits: selectedCourses.reduce((total, { course }) => total + course.credits, 0),
    }
    validateEnrollmentReport(report)
    candidate.reports.set(enrollmentId, report)
  }

  const response = { runId: candidate.runId, data: structuredClone(outcome) }
  validateOutcomeResponse(response, {
    runId: candidate.runId,
    actorId: request.actorId,
    requestId: request.requestId,
    ...(enrollmentId === null ? {} : { enrollmentId }),
  })
  return response
}

@Injectable()
export class MatriculaRegularService {
  constructor(
    private readonly repository: MatriculaRegularRepository,
    @Inject(MATRICULA_REGULAR_CLOCK) private readonly clock: ServerClock,
  ) {}

  submit(request: MatriculaRegularSubmission): Promise<MatriculaRegularEnvelope<MatriculaRegularOutcome>> {
    return this.repository.enqueue((state) => {
      if (request.runId !== state.runId) throw new MatriculaRegularError(409, state.runId, 'RUN_CHANGED')
      if (!state.actors.some((actor) => actor.actorId === request.actorId)) {
        throw new MatriculaRegularError(404, state.runId, 'ACTOR_NOT_FOUND')
      }
      const key = requestKey(request.actorId, request.requestId)
      const stored = state.requests.get(key)
      if (stored !== undefined) {
        if (!equalPayload(stored.payload, canonicalPayload(request))) {
          throw new MatriculaRegularError(409, state.runId, 'REQUEST_CONFLICT')
        }
        const response = { runId: state.runId, data: structuredClone(stored.outcome) }
        validateOutcomeResponse(response, { runId: state.runId, actorId: request.actorId, requestId: request.requestId })
        return response
      }

      const candidate = structuredClone(state)
      try {
        const response = commit(candidate, request, this.clock.now())
        this.repository.publishCandidate(candidate)
        return response
      } catch (error) {
        if (error instanceof MatriculaRegularError) throw error
        throw new MatriculaRegularError(500, state.runId, 'LOCAL_FAILURE')
      }
    })
  }
}

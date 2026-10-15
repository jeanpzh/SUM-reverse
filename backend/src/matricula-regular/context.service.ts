import { Inject, Injectable } from '@nestjs/common'
import { validateActorId, validateContext, validateContextResponse } from '../../../shared/matricula-regular.mjs'
import type {
  MatriculaRegularContext,
  MatriculaRegularEnvelope,
  MatriculaRegularId,
} from '../../../shared/matricula-regular.mjs'
import { MatriculaRegularError } from './matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from './matricula-regular.repository.js'
import type { ActorProfile, EnrollmentProfile, OfferedCourse } from './profile.types.js'
import { REGULAR_CREDIT_LOAD } from './rules.js'
import { evaluateContextEligibility } from './windows.js'
import type { ServerClock } from './clock.js'

export const MATRICULA_REGULAR_CLOCK = Symbol('MATRICULA_REGULAR_CLOCK')

function matchesScope(left: ActorProfile['scope'], right: ActorProfile['scope']): boolean {
  return left.facultyId === right.facultyId
    && left.schoolId === right.schoolId
    && left.period === right.period
    && left.planId === right.planId
    && left.modality === right.modality
}

/** MR-CONTRACT-3: offered courses of the plan with one or more failures; unknown history yields none. */
function retakeCourseIdsFor(actor: ActorProfile, offer: OfferedCourse[], planId: string): string[] {
  if (!actor.historyKnown) return []
  const offered = new Set(offer.filter((course) => course.planId === planId).map((course) => course.courseId))
  return [...new Set(actor.failedCourses
    .filter((item) => item.failures >= 1 && offered.has(item.courseId))
    .map((item) => item.courseId))]
    .sort()
}

export function projectContext(
  snapshot: ReturnType<MatriculaRegularRepository['readSnapshot']>,
  actorId: MatriculaRegularId,
  now: Date,
): MatriculaRegularEnvelope<MatriculaRegularContext> {
  const actor = snapshot.actors.find((candidate) => candidate.actorId === actorId)
  if (actor === undefined) throw new MatriculaRegularError(404, snapshot.runId, 'ACTOR_NOT_FOUND')
  validateActorId(actor.actorId)

  const profile: EnrollmentProfile | undefined = snapshot.profiles.find((candidate) =>
    candidate.profileRevision === actor.profileRevision
    && matchesScope(candidate.scope, actor.scope),
  )
  const context: unknown = structuredClone({
    actorId: actor.actorId,
    scope: actor.scope,
    profileRevision: actor.profileRevision,
    serverNow: now.toISOString(),
    preEnrollmentEnabled: actor.preEnrollmentEnabled,
    preEnrollmentComplete: actor.preEnrollmentComplete,
    preEnrollment: actor.preEnrollment,
    offerKnown: actor.offerKnown,
    offer: profile === undefined
      ? []
      : snapshot.offer.filter((course) => course.planId === profile.scope.planId),
    calendar: profile?.calendar ?? { publishedRows: [], effectiveWindows: [], unknownDates: [] },
    eligibility: evaluateContextEligibility(snapshot.profiles, actor, now),
    sources: profile?.sources ?? [],
    retakeCourseIds: profile === undefined ? [] : retakeCourseIdsFor(actor, snapshot.offer, profile.scope.planId),
    creditCap: profile === undefined ? null : REGULAR_CREDIT_LOAD.max,
  })
  validateContext(context)
  const envelope = { runId: snapshot.runId, data: context }
  validateContextResponse(envelope, snapshot.runId, actor.actorId)
  return envelope
}

@Injectable()
export class ContextService {
  constructor(
    private readonly repository: MatriculaRegularRepository,
    @Inject(MATRICULA_REGULAR_CLOCK) private readonly clock: ServerClock,
  ) {}

  now(): Date {
    return this.clock.now()
  }

  read(actorId: string): MatriculaRegularEnvelope<MatriculaRegularContext> {
    const snapshot = this.repository.readSnapshot()
    if (!snapshot.actors.some((candidate) => candidate.actorId === actorId)) {
      throw new MatriculaRegularError(404, snapshot.runId, 'ACTOR_NOT_FOUND')
    }
    validateActorId(actorId)
    const now = this.clock.now()
    return projectContext(snapshot, actorId, now)
  }
}

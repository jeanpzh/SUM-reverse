import type {
  MatriculaRegularCause,
  MatriculaRegularChoice,
  MatriculaRegularGap,
} from '../../../shared/matricula-regular.mjs'
import { validateCause } from '../../../shared/matricula-regular.mjs'
import { canonicalizeCauses } from './canonical-causes.js'
import type { ActorProfile, OfferedCourse } from './profile.types.js'

export type SelectionAdmission = {
  selectableCourseIds: string[]
  unknownChoices: MatriculaRegularChoice[]
  causes: MatriculaRegularCause[]
  gaps: MatriculaRegularGap[]
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort()
}

function cause(
  code: MatriculaRegularCause['code'],
  courseId: string,
  sectionId: string,
  sourceId: string,
): MatriculaRegularCause {
  const value: unknown = {
    code,
    courseIds: [courseId],
    sectionIds: [sectionId],
    sourceIds: [sourceId],
  }
  validateCause(value)
  return value
}

export function evaluateSelectionAdmission(
  actor: ActorProfile,
  offer: readonly OfferedCourse[],
  selection: readonly MatriculaRegularChoice[],
): SelectionAdmission {
  const complete = actor.preEnrollmentComplete && actor.offerKnown && actor.planKnown
  const documents = new Map(actor.preEnrollment.map((document) => [document.courseId, document]))
  const samePlanOffer = offer.filter((course) => course.planId === actor.scope.planId)
  const selectableCourseIds = complete
    ? sortedUnique(samePlanOffer
      .filter((course) => documents.get(course.courseId)?.planId === actor.scope.planId)
      .map((course) => course.courseId))
    : []
  const unknownChoices: MatriculaRegularChoice[] = []
  const causes: MatriculaRegularCause[] = []
  const gaps: MatriculaRegularGap[] = []

  if (!complete) {
    gaps.push({
      code: 'PLAN_OR_OFFER_UNKNOWN',
      courseIds: [],
      sourceIds: ['SYN-FIXTURE'],
    })
  }

  for (const choice of selection) {
    const course = offer.find((candidate) => candidate.courseId === choice.courseId)
    const section = course?.sections.find((candidate) => candidate.sectionId === choice.sectionId)
    if (course === undefined || section === undefined) {
      unknownChoices.push({ ...choice })
      continue
    }

    if (course.planId !== actor.scope.planId) {
      causes.push(cause('PLAN_MISMATCH', course.courseId, section.sectionId, 'F1'))
      continue
    }

    const document = documents.get(course.courseId)
    if (complete && (document === undefined || document.planId !== actor.scope.planId)) {
      causes.push(cause('COURSE_NOT_IN_PRE_ENROLLMENT', course.courseId, section.sectionId, 'L-05'))
    }
  }

  return {
    selectableCourseIds,
    unknownChoices: unknownChoices.sort((left, right) =>
      left.courseId.localeCompare(right.courseId) || left.sectionId.localeCompare(right.sectionId),
    ),
    causes: canonicalizeCauses(causes),
    gaps,
  }
}

import type {
  MatriculaRegularCause,
  MatriculaRegularChoice,
  MatriculaRegularGap,
} from '../../../shared/matricula-regular.mjs'
import { validateCause, validateGap } from '../../../shared/matricula-regular.mjs'
import { canonicalizeCauses } from './canonical-causes.js'
import type { ActorProfile, Meeting, OfferedCourse } from './profile.types.js'
import type { MatriculaRegularEligibility } from '../../../shared/matricula-regular.mjs'

/** FISI 2026-II regular load (F1 art. 13.p, RN-01); also exposed as the context «Tope de créditos». */
export const REGULAR_CREDIT_LOAD = Object.freeze({ min: 12, max: 26 } as const)

type RuleInput = {
  actor: ActorProfile
  offer: readonly OfferedCourse[]
  selection: readonly MatriculaRegularChoice[]
  now: Date
  eligibility?: MatriculaRegularEligibility
  additionalCauses?: readonly MatriculaRegularCause[]
  additionalGaps?: readonly MatriculaRegularGap[]
}

export type RuleEvaluation = {
  causes: MatriculaRegularCause[]
  gaps: MatriculaRegularGap[]
  windowOrigin: MatriculaRegularEligibility['windowOrigin']
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

function fallbackAppliesToActor(actor: ActorProfile): boolean {
  const school = actor.scope.schoolId
  if (actor.scope.facultyId !== 'FISI'
    || actor.scope.period !== '2026-II'
    || actor.scope.modality !== 'regular-virtual'
    || (school !== 'SISTEMAS' && school !== 'SOFTWARE')) return false

  const suffix = school === 'SISTEMAS' ? 'SIS' : 'SOFT'
  return actor.scope.planId === `SYN-${suffix}-PLAN`
    && (actor.profileRevision === 'MR-FISI-2026-II-DOC-1' || actor.profileRevision === `MR-SYN-${suffix}-1`)
}

function sourceIds(actor: ActorProfile, ruleId: string, fallback: string): string[] {
  const rule = actor.rules.find((item) => item.ruleId === ruleId)
  if (rule !== undefined) return sortedUnique(rule.sourceIds)
  return fallbackAppliesToActor(actor) ? [fallback] : []
}

function ruleKnowledge(actor: ActorProfile, ruleId: string): ActorProfile['rules'][number]['knowledge'] | undefined {
  return actor.rules.find((rule) => rule.ruleId === ruleId)?.knowledge
}

function canEvaluateRule(
  actor: ActorProfile,
  ruleId: string,
  profileApplicable: boolean,
): boolean {
  const knowledge = ruleKnowledge(actor, ruleId)
  return profileApplicable && (knowledge === undefined || knowledge === 'known')
}

function addCause(
  causes: MatriculaRegularCause[],
  code: MatriculaRegularCause['code'],
  sourceIds: string[],
  courseIds: string[] = [],
  sectionIds: string[] = [],
): void {
  const value: unknown = {
    code,
    courseIds: sortedUnique(courseIds),
    sectionIds: sortedUnique(sectionIds),
    sourceIds: sortedUnique(sourceIds),
  }
  validateCause(value)
  causes.push(value)
}

function addGap(
  gaps: MatriculaRegularGap[],
  code: MatriculaRegularGap['code'],
  sourceIds: string[],
  courseIds: string[] = [],
): void {
  const value: unknown = { code, courseIds: sortedUnique(courseIds), sourceIds: sortedUnique(sourceIds) }
  validateGap(value)
  gaps.push(value)
}

function dedupeGaps(gaps: MatriculaRegularGap[]): MatriculaRegularGap[] {
  const byKey = new Map<string, MatriculaRegularGap>()
  for (const item of gaps) {
    const key = `${item.code}|${item.courseIds.join(',')}`
    const prior = byKey.get(key)
    byKey.set(key, prior === undefined
      ? item
      : { ...item, sourceIds: sortedUnique([...prior.sourceIds, ...item.sourceIds]) })
  }
  return [...byKey.values()].sort((left, right) =>
    left.code.localeCompare(right.code) || left.courseIds.join(',').localeCompare(right.courseIds.join(',')),
  )
}

function overlap(left: { day: number; startMinute: number; endMinute: number }, right: { day: number; startMinute: number; endMinute: number }): boolean {
  return left.day === right.day
    && Math.max(left.startMinute, right.startMinute) < Math.min(left.endMinute, right.endMinute)
}

export function evaluateSubmissionRules(input: RuleInput): RuleEvaluation {
  const { actor, offer, selection, eligibility } = input
  const causes: MatriculaRegularCause[] = []
  const gaps: MatriculaRegularGap[] = []
  const profileMissing = eligibility?.gaps.some((item) =>
    item.code === 'PROFILE_MISSING' && item.sourceIds.length === 0,
  ) ?? false
  const profileApplicable = fallbackAppliesToActor(actor) && !profileMissing
  if (eligibility !== undefined) {
    causes.push(...structuredClone(eligibility.causes))
    gaps.push(...structuredClone(eligibility.gaps))
  }
  causes.push(...structuredClone(input.additionalCauses ?? []))
  gaps.push(...structuredClone(input.additionalGaps ?? []))

  const preEnrollmentSource = sourceIds(actor, 'PRE-ENROLLMENT-ENABLED', 'F1')
  if (canEvaluateRule(actor, 'PRE-ENROLLMENT-ENABLED', profileApplicable)) {
    if (actor.preEnrollmentEnabled === false) addCause(causes, 'PRE_ENROLLMENT_NOT_ENABLED', preEnrollmentSource)
    if (actor.preEnrollmentEnabled === null) addGap(gaps, 'PRE_ENROLLMENT_UNKNOWN', preEnrollmentSource)
  }

  const planOfferSource = sourceIds(actor, 'PLAN-AND-OFFER', 'F1')
  if (canEvaluateRule(actor, 'PLAN-AND-OFFER', profileApplicable)
    && (!actor.planKnown || !actor.preEnrollmentComplete || !actor.offerKnown)) {
    addGap(gaps, 'PLAN_OR_OFFER_UNKNOWN', planOfferSource)
  }

  for (const rule of profileApplicable ? actor.rules.filter((item) => item.knowledge === 'unknown') : []) {
    switch (rule.ruleId) {
      case 'PRE-ENROLLMENT-ENABLED':
        addGap(gaps, 'PRE_ENROLLMENT_UNKNOWN', rule.sourceIds)
        break
      case 'PLAN-AND-OFFER':
        addGap(gaps, 'PLAN_OR_OFFER_UNKNOWN', rule.sourceIds)
        break
      case 'ACADEMIC-HISTORY':
      case 'EQUIVALENCES':
        addGap(gaps, 'PREREQUISITE_OR_EQUIVALENCE_UNKNOWN', rule.sourceIds, selection.map(({ courseId }) => courseId))
        break
      case 'INSTITUTIONAL-REQUIREMENTS':
        addGap(gaps, 'INSTITUTIONAL_REQUIREMENT_UNKNOWN', rule.sourceIds)
        break
      case 'CREDIT-EXCEPTION':
        addGap(gaps, 'EXCEPTION_UNKNOWN', rule.sourceIds)
        break
      case 'CREDIT-LOAD':
      case 'SCHEDULE':
      case 'SECTION-CAPACITY':
        addGap(gaps, 'PROFILE_MISSING', rule.sourceIds)
        break
      default:
        addGap(gaps, 'PROFILE_MISSING', rule.sourceIds)
    }
  }

  const institutionalSource = sourceIds(actor, 'INSTITUTIONAL-REQUIREMENTS', 'F1')
  if (canEvaluateRule(actor, 'INSTITUTIONAL-REQUIREMENTS', profileApplicable)) {
    for (const [field, state] of Object.entries(actor.institutional)) {
      if (state === 'unmet') {
        const code = field === 'debt'
          ? 'DEBT_REQUIREMENT_UNMET'
          : field === 'health' ? 'HEALTH_REQUIREMENT_UNMET' : 'ACADEMIC_INELIGIBILITY'
        addCause(causes, code, institutionalSource)
      }
    }
    if (Object.values(actor.institutional).includes('unknown')) {
      addGap(gaps, 'INSTITUTIONAL_REQUIREMENT_UNKNOWN', institutionalSource)
    }
  }

  const selectedCourses = selection.map((choice) => ({
    choice,
    course: offer.find((item) => item.courseId === choice.courseId),
  }))
  const courseIds = sortedUnique(selection.map(({ courseId }) => courseId))
  const sectionIds = sortedUnique(selection.map(({ sectionId }) => sectionId))
  const credits = selectedCourses.reduce((total, item) => total + (item.course?.credits ?? 0), 0)

  const exception = actor.creditException
  const exceptionApplies = exception.kind !== 'none' && exception.applicability === 'applicable'
  const exceptionUnknown = exception.applicability === 'unknown'
  if (exceptionUnknown) {
    addGap(gaps, 'EXCEPTION_UNKNOWN', sortedUnique(exception.sourceIds))
  }

  const failed = canEvaluateRule(actor, 'ACADEMIC-HISTORY', profileApplicable)
    ? actor.failedCourses.filter((item) => item.failures > 0)
    : []
  const threeFailureCases = failed.filter((item) => item.failures === 3)
  const fourFailureCases = failed.filter((item) => item.failures === 4)
  const twoFailureCases = failed.filter((item) => item.failures === 2)
  const knownFourthBranches = threeFailureCases.length + fourFailureCases.length
  const unresolvedBranch = knownFourthBranches > 1
    || (knownFourthBranches > 0 && twoFailureCases.length > 0)
  const repetitionSource = sourceIds(actor, 'ACADEMIC-HISTORY', 'F1')
  if (unresolvedBranch) {
    addGap(gaps, 'REPETITION_OR_AUTHORIZATION_UNKNOWN', repetitionSource, failed.map(({ courseId }) => courseId))
  }

  const offeredIds = new Set(offer.map(({ courseId }) => courseId))
  for (const item of failed) {
    if (offeredIds.has(item.courseId) && !courseIds.includes(item.courseId)) {
      addCause(causes, 'RETAKE_PRIORITY', repetitionSource, [item.courseId])
    }
  }

  if (canEvaluateRule(actor, 'ACADEMIC-HISTORY', profileApplicable) && canEvaluateRule(actor, 'EQUIVALENCES', profileApplicable)
    && (!actor.historyKnown || !actor.equivalencesKnown)) {
    const prerequisiteIds = sortedUnique(selectedCourses.flatMap(({ course }) => course?.prerequisiteIds ?? []))
    if (!actor.historyKnown || prerequisiteIds.length > 0) {
      addGap(gaps, 'PREREQUISITE_OR_EQUIVALENCE_UNKNOWN', repetitionSource, courseIds)
    }
  } else if (canEvaluateRule(actor, 'ACADEMIC-HISTORY', profileApplicable) && canEvaluateRule(actor, 'EQUIVALENCES', profileApplicable)) {
    for (const { course } of selectedCourses) {
      if (course === undefined) continue
      const unmet = course.prerequisiteIds.filter((prerequisiteId) => !actor.approvedCourseIds.includes(prerequisiteId))
      if (unmet.length > 0) {
        addCause(causes, 'PREREQUISITE_UNMET', sourceIds(actor, 'ACADEMIC-HISTORY', 'F1'), [course.courseId, ...unmet])
      }
    }
  }

  const tutorshipByCourse = new Map(actor.tutorship.map((item) => [item.courseId, item.condition]))
  const authorizationByCourse = new Map(actor.fourthAttemptAuthorization.map((item) => [item.courseId, item.condition]))
  for (const item of twoFailureCases) {
    const condition = tutorshipByCourse.get(item.courseId) ?? 'unknown'
    if (condition === 'unmet') addCause(causes, 'TUTORSHIP_REQUIREMENT_UNMET', repetitionSource, [item.courseId])
    if (condition === 'unknown') addGap(gaps, 'REPETITION_OR_AUTHORIZATION_UNKNOWN', repetitionSource, [item.courseId])
  }

  for (const item of threeFailureCases) {
    if (unresolvedBranch) continue
    if (offeredIds.has(item.courseId)) {
      const condition = tutorshipByCourse.get(item.courseId) ?? 'unknown'
      if (condition === 'unmet') addCause(causes, 'TUTORSHIP_REQUIREMENT_UNMET', repetitionSource, [item.courseId])
      if (condition === 'unknown') addGap(gaps, 'REPETITION_OR_AUTHORIZATION_UNKNOWN', repetitionSource, [item.courseId])
      if (courseIds.length !== 1 || courseIds[0] !== item.courseId) {
        addCause(causes, 'FOURTH_ENROLLMENT_RULE_UNMET', repetitionSource, [...courseIds, item.courseId], sectionIds)
      }
    } else {
      const authorization = authorizationByCourse.get(item.courseId) ?? 'unknown'
      if (authorization === 'unknown') addGap(gaps, 'REPETITION_OR_AUTHORIZATION_UNKNOWN', repetitionSource, [item.courseId])
      if (authorization === 'unmet' || (authorization === 'met' && credits > 12)) {
        addCause(causes, 'FOURTH_ENROLLMENT_RULE_UNMET', repetitionSource, [item.courseId, ...courseIds], sectionIds)
      }
    }
  }

  if (fourFailureCases.length > 0 && !unresolvedBranch) {
    const eligibilityState = actor.institutional.eligibility
    if (eligibilityState === 'unmet') {
      addCause(causes, 'ACADEMIC_INELIGIBILITY', repetitionSource, fourFailureCases.map(({ courseId }) => courseId))
    } else if (eligibilityState === 'unknown') {
      addGap(gaps, 'REPETITION_OR_AUTHORIZATION_UNKNOWN', repetitionSource, fourFailureCases.map(({ courseId }) => courseId))
    } else {
      addGap(gaps, 'REPETITION_OR_AUTHORIZATION_UNKNOWN', repetitionSource, fourFailureCases.map(({ courseId }) => courseId))
    }
  }

  const hasKnownFourthBranch = threeFailureCases.length > 0 && !unresolvedBranch
  if (canEvaluateRule(actor, 'CREDIT-LOAD', profileApplicable)
    && !hasKnownFourthBranch && credits < REGULAR_CREDIT_LOAD.min && !exceptionApplies && !exceptionUnknown) {
    addCause(causes, 'CREDIT_LOAD_INVALID', sourceIds(actor, 'CREDIT-LOAD', 'F1'), courseIds, sectionIds)
  }
  if (canEvaluateRule(actor, 'CREDIT-LOAD', profileApplicable) && credits > REGULAR_CREDIT_LOAD.max) {
    addCause(causes, 'CREDIT_LOAD_INVALID', sourceIds(actor, 'CREDIT-LOAD', 'F1'), courseIds, sectionIds)
  }

  type CourseMeeting = Meeting & { courseId: MatriculaRegularChoice['courseId'] }
  const knownMeetings: CourseMeeting[] = []
  const unknownScheduleCourseIds: string[] = []
  for (const { choice, course } of selectedCourses) {
    const section = course?.sections.find(({ sectionId }) => sectionId === choice.sectionId)
    if (section === undefined) continue
    if (section.schedule === null) {
      unknownScheduleCourseIds.push(choice.courseId)
      continue
    }
    for (const meeting of section.schedule) knownMeetings.push({ ...meeting, courseId: choice.courseId })
  }
  if (canEvaluateRule(actor, 'SCHEDULE', profileApplicable) && unknownScheduleCourseIds.length > 0) {
    addGap(gaps, 'SCHEDULE_UNKNOWN', sourceIds(actor, 'SCHEDULE', 'P04-P05'), unknownScheduleCourseIds)
  }
  for (let left = 0; canEvaluateRule(actor, 'SCHEDULE', profileApplicable) && left < knownMeetings.length; left += 1) {
    const first = knownMeetings[left]!
    for (let right = left + 1; right < knownMeetings.length; right += 1) {
      const second = knownMeetings[right]!
      if (overlap(first, second)) {
        addCause(causes, 'SCHEDULE_CONFLICT', sourceIds(actor, 'SCHEDULE', 'P04-P05'), [first.courseId, second.courseId])
      }
    }
  }

  for (const { choice, course } of selectedCourses) {
    const section = course?.sections.find(({ sectionId }) => sectionId === choice.sectionId)
    if (section !== undefined && section.occupied >= section.capacity) {
      addCause(causes, 'SECTION_FULL', sourceIds(actor, 'SECTION-CAPACITY', 'SYN-FIXTURE'), [course!.courseId], [section.sectionId])
    }
  }

  return {
    causes: canonicalizeCauses(causes),
    gaps: dedupeGaps(gaps),
    windowOrigin: eligibility?.windowOrigin ?? null,
  }
}

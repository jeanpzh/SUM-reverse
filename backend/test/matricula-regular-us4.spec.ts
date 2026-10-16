import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import type { ActorProfile, OfferedCourse, School } from '../src/matricula-regular/profile.types.js'
import { evaluateSubmissionRules } from '../src/matricula-regular/rules.js'
import { evaluateSelectionAdmission } from '../src/matricula-regular/selection.rules.js'
import type { ServerClock } from '../src/matricula-regular/clock.js'
import { createMatriculaRegularTestApp, type MatriculaRegularTestApp } from './matricula-regular-test-app.js'

const schools: School[] = ['SISTEMAS', 'SOFTWARE']

function input(school: School) {
  const fixture = createSyntheticFixture(school)
  const actor = structuredClone(fixture.actors[0]!)
  const offer = structuredClone(fixture.offer)
  return { actor, offer, selection: offer.slice(0, 3).map((course) => ({ courseId: course.courseId, sectionId: course.sections[0]!.sectionId })) }
}

function evaluate(actor: ActorProfile, offer: OfferedCourse[], selection: Array<{ courseId: string; sectionId: string }>) {
  return evaluateSubmissionRules({ actor, offer, selection, now: new Date('2026-08-11T15:00:00.000Z') })
}

function matrixCase(school: School, id: string) {
  const base = input(school)
  const first = base.offer[0]!
  const second = base.offer[1]!
  const all = base.offer.map((course) => ({ courseId: course.courseId, sectionId: course.sections[0]!.sectionId }))
  let selection = all
  let expected: { cause?: string; gap?: string; admission?: string }
  switch (id) {
    case 'MAT-04-V01': first.prerequisiteIds = ['SYN-REQ']; expected = { cause: 'PREREQUISITE_UNMET' }; break
    case 'MAT-04-V02': first.prerequisiteIds = ['SYN-REQ']; base.actor.approvedCourseIds = ['SYN-REQ']; expected = {}; break
    case 'MAT-04-V04': first.prerequisiteIds = ['SYN-EQUIV']; base.actor.approvedCourseIds = ['SYN-EQUIV']; expected = {}; break
    case 'MAT-04-V06': base.actor.failedCourses = [{ courseId: first.courseId, failures: 1 }]; expected = {}; break
    case 'MAT-04-V07': base.actor.failedCourses = [{ courseId: first.courseId, failures: 1 }]; selection = all.slice(1); expected = { cause: 'RETAKE_PRIORITY' }; break
    case 'MAT-04-V08': base.actor.failedCourses = [{ courseId: first.courseId, failures: 2 }]; base.actor.tutorship = [{ courseId: first.courseId, condition: 'met' }]; expected = {}; break
    case 'MAT-04-V09': base.actor.failedCourses = [{ courseId: first.courseId, failures: 2 }]; base.actor.tutorship = [{ courseId: first.courseId, condition: 'unmet' }]; expected = { cause: 'TUTORSHIP_REQUIREMENT_UNMET' }; break
    case 'MAT-04-V11': base.actor.failedCourses = [{ courseId: first.courseId, failures: 3 }]; base.actor.tutorship = [{ courseId: first.courseId, condition: 'met' }]; selection = [all[0]!]; expected = {}; break
    case 'MAT-04-V12': base.actor.failedCourses = [{ courseId: first.courseId, failures: 3 }]; base.actor.tutorship = [{ courseId: first.courseId, condition: 'met' }]; expected = { cause: 'FOURTH_ENROLLMENT_RULE_UNMET' }; break
    case 'MAT-04-V13': base.actor.failedCourses = [{ courseId: first.courseId, failures: 3 }]; base.actor.tutorship = [{ courseId: first.courseId, condition: 'unmet' }]; selection = [all[0]!]; expected = { cause: 'TUTORSHIP_REQUIREMENT_UNMET' }; break
    case 'MAT-04-V14': base.actor.failedCourses = [{ courseId: first.courseId, failures: 3 }]; base.offer = base.offer.slice(1); base.actor.fourthAttemptAuthorization = [{ courseId: first.courseId, condition: 'met' }]; selection = all.slice(1); expected = {}; break
    case 'MAT-04-V15': base.actor.failedCourses = [{ courseId: first.courseId, failures: 3 }]; base.offer = base.offer.slice(1); base.offer[0]!.credits = 13; base.actor.preEnrollment.find(({ courseId }) => courseId === second.courseId)!.credits = 13; base.actor.fourthAttemptAuthorization = [{ courseId: first.courseId, condition: 'met' }]; selection = [{ courseId: second.courseId, sectionId: second.sections[0]!.sectionId }]; expected = { cause: 'FOURTH_ENROLLMENT_RULE_UNMET' }; break
    case 'MAT-04-V17': base.actor.failedCourses = [{ courseId: first.courseId, failures: 3 }]; base.offer = base.offer.slice(1); base.actor.fourthAttemptAuthorization = [{ courseId: first.courseId, condition: 'unmet' }]; selection = all.slice(1); expected = { cause: 'FOURTH_ENROLLMENT_RULE_UNMET' }; break
    case 'MAT-04-V18': base.actor.failedCourses = [{ courseId: first.courseId, failures: 4 }]; base.actor.institutional.eligibility = 'unmet'; expected = { cause: 'ACADEMIC_INELIGIBILITY' }; break
    case 'MAT-06-V01': first.credits = 11; base.actor.preEnrollment[0]!.credits = 11; selection = [all[0]!]; expected = { cause: 'CREDIT_LOAD_INVALID' }; break
    case 'MAT-06-V02': first.credits = 12; base.actor.preEnrollment[0]!.credits = 12; selection = [all[0]!]; expected = {}; break
    case 'MAT-06-V03': first.credits = 26; base.actor.preEnrollment[0]!.credits = 26; selection = [all[0]!]; expected = {}; break
    case 'MAT-06-V04': first.credits = 27; base.actor.preEnrollment[0]!.credits = 27; selection = [all[0]!]; expected = { cause: 'CREDIT_LOAD_INVALID' }; break
    case 'MAT-06-V05': first.credits = 11; base.actor.preEnrollment[0]!.credits = 11; base.actor.creditException = { kind: 'remaining-for-completion', applicability: 'applicable', sourceIds: ['F1'] }; selection = [all[0]!]; expected = {}; break
    case 'MAT-06-V06': first.credits = 11; base.actor.preEnrollment[0]!.credits = 11; base.actor.creditException = { kind: 'return-after-suspension', applicability: 'applicable', sourceIds: ['F1'] }; selection = [all[0]!]; expected = {}; break
    case 'MAT-06-V07': first.credits = 11; base.actor.preEnrollment[0]!.credits = 11; base.actor.creditException = { kind: 'plan-change-no-offer', applicability: 'applicable', sourceIds: ['F1'] }; selection = [all[0]!]; expected = {}; break
    case 'MAT-06-V09': base.actor.institutional.debt = 'unmet'; expected = { cause: 'DEBT_REQUIREMENT_UNMET' }; break
    case 'MAT-06-V10': base.actor.institutional.health = 'unmet'; expected = { cause: 'HEALTH_REQUIREMENT_UNMET' }; break
    case 'MAT-06-V11': base.actor.institutional.eligibility = 'unmet'; expected = { cause: 'ACADEMIC_INELIGIBILITY' }; break
    case 'MAT-02-V05': first.planId = 'SYN-OTHER-PLAN'; expected = { admission: 'PLAN_MISMATCH' }; break
    case 'MAT-04-V03': first.prerequisiteIds = ['SYN-REQ']; base.actor.historyKnown = false; expected = { gap: 'PREREQUISITE_OR_EQUIVALENCE_UNKNOWN' }; break
    case 'MAT-04-V05': first.prerequisiteIds = ['SYN-REQ']; base.actor.equivalencesKnown = false; expected = { gap: 'PREREQUISITE_OR_EQUIVALENCE_UNKNOWN' }; break
    case 'MAT-04-V10': base.actor.failedCourses = [{ courseId: first.courseId, failures: 2 }]; base.actor.tutorship = [{ courseId: first.courseId, condition: 'unknown' }]; expected = { gap: 'REPETITION_OR_AUTHORIZATION_UNKNOWN' }; break
    case 'MAT-04-V16': base.actor.failedCourses = [{ courseId: first.courseId, failures: 3 }]; base.offer = base.offer.slice(1); base.actor.fourthAttemptAuthorization = [{ courseId: first.courseId, condition: 'unknown' }]; selection = all.slice(1); expected = { gap: 'REPETITION_OR_AUTHORIZATION_UNKNOWN' }; break
    case 'MAT-04-V19': base.actor.failedCourses = [{ courseId: first.courseId, failures: 4 }]; base.actor.institutional.eligibility = 'unknown'; expected = { gap: 'REPETITION_OR_AUTHORIZATION_UNKNOWN' }; break
    case 'MAT-04-V20': base.actor.failedCourses = [{ courseId: first.courseId, failures: 2 }, { courseId: second.courseId, failures: 3 }]; base.actor.tutorship = [{ courseId: first.courseId, condition: 'met' }, { courseId: second.courseId, condition: 'met' }]; expected = { gap: 'REPETITION_OR_AUTHORIZATION_UNKNOWN' }; break
    case 'MAT-06-V08': first.credits = 11; base.actor.preEnrollment[0]!.credits = 11; base.actor.creditException = { kind: 'remaining-for-completion', applicability: 'unknown', sourceIds: ['F1'] }; selection = [all[0]!]; expected = { gap: 'EXCEPTION_UNKNOWN' }; break
    case 'MAT-06-V12': base.actor.institutional.debt = 'unknown'; expected = { gap: 'INSTITUTIONAL_REQUIREMENT_UNKNOWN' }; break
    default: throw new Error(`Unsupported synthetic matrix case ${id}`)
  }
  return { ...base, selection, expected: expected! }
}

describe('T028/T030 FISI 2026-II synthetic rule matrix', () => {
  it.each(schools.flatMap((school) => [
    'MAT-04-V01', 'MAT-04-V02', 'MAT-04-V04', 'MAT-04-V06', 'MAT-04-V07', 'MAT-04-V08',
    'MAT-04-V09', 'MAT-04-V11', 'MAT-04-V12', 'MAT-04-V13', 'MAT-04-V14', 'MAT-04-V15',
    'MAT-04-V17', 'MAT-04-V18', 'MAT-06-V01', 'MAT-06-V02', 'MAT-06-V03', 'MAT-06-V04',
    'MAT-06-V05', 'MAT-06-V06', 'MAT-06-V07', 'MAT-06-V09', 'MAT-06-V10', 'MAT-06-V11',
    'MAT-02-V05',
  ].map((id) => ({ school, id }))))('SC-002 known $school $id emits its explicit rule result and source-linked causes', ({ school, id }) => {
    const { actor, offer, selection, expected } = matrixCase(school, id)
    const ruleResult = evaluate(actor, offer, selection)
    const admission = evaluateSelectionAdmission(actor, offer, selection)
    const causes = [...ruleResult.causes, ...admission.causes]
    const codes = causes.map(({ code }) => code)
    expect(ruleResult.gaps).toEqual([])
    if (expected.cause) expect(codes).toContain(expected.cause)
    if (expected.admission) expect(admission.causes.map(({ code }) => code)).toContain(expected.admission)
    expect(causes.every(({ sourceIds }) => sourceIds.length > 0)).toBe(true)
  })

  it.each(schools.flatMap((school) => [
    'MAT-04-V03', 'MAT-04-V05', 'MAT-04-V10', 'MAT-04-V16', 'MAT-04-V19', 'MAT-04-V20', 'MAT-06-V08', 'MAT-06-V12',
  ].map((id) => ({ school, id }))))('SC-002 pending $school $id preserves its explicit source-linked gap', ({ school, id }) => {
    const { actor, offer, selection, expected } = matrixCase(school, id)
    const ruleResult = evaluate(actor, offer, selection)
    const admission = evaluateSelectionAdmission(actor, offer, selection)
    const gaps = [...ruleResult.gaps, ...admission.gaps]
    expect(gaps.map(({ code }) => code)).toContain(expected.gap)
    expect([...ruleResult.causes, ...admission.causes].every(({ sourceIds }) => sourceIds.length > 0)).toBe(true)
  })

  it.each(schools)('%s evaluates MAT04 prerequisites, equivalence and retake priority as complete known sets', (school) => {
    const base = input(school)
    const [first, second, third] = base.offer
    const selected = [first!, second!, third!].map((course) => ({ courseId: course.courseId, sectionId: course.sections[0]!.sectionId }))
    first!.prerequisiteIds = ['SYN-PREREQUISITE']

    const unmet = evaluate(base.actor, base.offer, selected)
    expect(unmet.causes.map(({ code }) => code)).toContain('PREREQUISITE_UNMET')
    expect(unmet.gaps).toEqual([])

    base.actor.approvedCourseIds = ['SYN-PREREQUISITE']
    expect(evaluate(base.actor, base.offer, selected).causes.map(({ code }) => code)).not.toContain('PREREQUISITE_UNMET')

    base.actor.equivalencesKnown = false
    expect(evaluate(base.actor, base.offer, selected).gaps.map(({ code }) => code)).toContain('PREREQUISITE_OR_EQUIVALENCE_UNKNOWN')

    base.actor.equivalencesKnown = true
    base.actor.historyKnown = false
    expect(evaluate(base.actor, base.offer, selected).gaps.map(({ code }) => code)).toContain('PREREQUISITE_OR_EQUIVALENCE_UNKNOWN')

    base.actor.historyKnown = true
    base.actor.failedCourses = [{ courseId: second!.courseId, failures: 1 }]
    expect(evaluate(base.actor, base.offer, selected).causes.map(({ code }) => code)).not.toContain('RETAKE_PRIORITY')
    expect(evaluate(base.actor, base.offer, selected.filter(({ courseId }) => courseId !== second!.courseId)).causes.map(({ code }) => code)).toContain('RETAKE_PRIORITY')
  })

  it.each(schools)('%s evaluates MAT04 repeat branches without composing unknown special cases', (school) => {
    const base = input(school)
    const [first, second] = base.offer
    const one = [{ courseId: first!.courseId, sectionId: first!.sections[0]!.sectionId }]
    const two = [one[0]!, { courseId: second!.courseId, sectionId: second!.sections[0]!.sectionId }]

    base.actor.failedCourses = [{ courseId: first!.courseId, failures: 2 }]
    base.actor.tutorship = [{ courseId: first!.courseId, condition: 'met' }]
    expect(evaluate(base.actor, base.offer, one).causes.map(({ code }) => code)).not.toContain('TUTORSHIP_REQUIREMENT_UNMET')
    base.actor.tutorship[0]!.condition = 'unmet'
    expect(evaluate(base.actor, base.offer, one).causes.map(({ code }) => code)).toContain('TUTORSHIP_REQUIREMENT_UNMET')
    base.actor.tutorship[0]!.condition = 'unknown'
    expect(evaluate(base.actor, base.offer, one).gaps.map(({ code }) => code)).toContain('REPETITION_OR_AUTHORIZATION_UNKNOWN')

    base.actor.failedCourses = [{ courseId: first!.courseId, failures: 3 }]
    base.actor.tutorship[0]!.condition = 'met'
    expect(evaluate(base.actor, base.offer, one).causes.map(({ code }) => code)).not.toContain('CREDIT_LOAD_INVALID')
    expect(evaluate(base.actor, base.offer, two).causes.map(({ code }) => code)).toContain('FOURTH_ENROLLMENT_RULE_UNMET')
    base.actor.tutorship[0]!.condition = 'unmet'
    expect(evaluate(base.actor, base.offer, one).causes.map(({ code }) => code)).toContain('TUTORSHIP_REQUIREMENT_UNMET')

    base.actor.failedCourses = [{ courseId: first!.courseId, failures: 3 }]
    base.offer = base.offer.filter(({ courseId }) => courseId !== first!.courseId)
    base.actor.fourthAttemptAuthorization = [{ courseId: first!.courseId, condition: 'met' }]
    const noOffer = [{ courseId: second!.courseId, sectionId: second!.sections[0]!.sectionId }]
    expect(evaluate(base.actor, base.offer, noOffer).causes.map(({ code }) => code)).not.toContain('CREDIT_LOAD_INVALID')
    base.actor.fourthAttemptAuthorization[0]!.condition = 'unknown'
    expect(evaluate(base.actor, base.offer, noOffer).gaps.map(({ code }) => code)).toContain('REPETITION_OR_AUTHORIZATION_UNKNOWN')
    base.actor.fourthAttemptAuthorization[0]!.condition = 'unmet'
    expect(evaluate(base.actor, base.offer, noOffer).causes.map(({ code }) => code)).toContain('FOURTH_ENROLLMENT_RULE_UNMET')

    base.actor.failedCourses = [{ courseId: first!.courseId, failures: 4 }]
    base.actor.institutional.eligibility = 'unmet'
    expect(evaluate(base.actor, base.offer, noOffer).causes.map(({ code }) => code)).toContain('ACADEMIC_INELIGIBILITY')
    base.actor.institutional.eligibility = 'unknown'
    expect(evaluate(base.actor, base.offer, noOffer).gaps.map(({ code }) => code)).toContain('REPETITION_OR_AUTHORIZATION_UNKNOWN')

    base.actor.failedCourses = [{ courseId: first!.courseId, failures: 2 }, { courseId: second!.courseId, failures: 3 }]
    expect(evaluate(base.actor, base.offer, noOffer).gaps.map(({ code }) => code)).toContain('REPETITION_OR_AUTHORIZATION_UNKNOWN')
  })

  it.each(schools)('%s evaluates MAT06 credit limits, all three known exceptions and unknowns', (school) => {
    const base = input(school)
    const first = base.offer[0]!
    const one = [{ courseId: first.courseId, sectionId: first.sections[0]!.sectionId }]
    const creditCase = (credits: number) => {
      base.offer = base.offer.slice(0, 3).map((course, index) => ({ ...course, credits: index === 0 ? credits : 0.1 }))
      base.actor.preEnrollment = base.actor.preEnrollment.map((course, index) => ({ ...course, credits: index === 0 ? credits : 0.1 }))
      return evaluate(base.actor, base.offer, [{ courseId: base.offer[0]!.courseId, sectionId: base.offer[0]!.sections[0]!.sectionId }])
    }
    expect(creditCase(11).causes.map(({ code }) => code)).toContain('CREDIT_LOAD_INVALID')
    expect(creditCase(12).causes.map(({ code }) => code)).not.toContain('CREDIT_LOAD_INVALID')
    expect(creditCase(26).causes.map(({ code }) => code)).not.toContain('CREDIT_LOAD_INVALID')
    expect(creditCase(27).causes.map(({ code }) => code)).toContain('CREDIT_LOAD_INVALID')

    for (const kind of ['remaining-for-completion', 'return-after-suspension', 'plan-change-no-offer'] as const) {
      creditCase(11)
      base.actor.creditException = { kind, applicability: 'applicable', sourceIds: ['F1'] }
      expect(evaluate(base.actor, base.offer, [one[0]!]).causes.map(({ code }) => code)).not.toContain('CREDIT_LOAD_INVALID')
    }
    creditCase(11)
    base.actor.creditException = { kind: 'remaining-for-completion', applicability: 'unknown', sourceIds: ['F1'] }
    expect(evaluate(base.actor, base.offer, [one[0]!]).gaps.map(({ code }) => code)).toContain('EXCEPTION_UNKNOWN')

    base.actor.creditException = { kind: 'none', applicability: 'not-applicable', sourceIds: ['SYN-FIXTURE'] }
    base.actor.institutional.debt = 'unmet'
    base.actor.institutional.health = 'unmet'
    expect(evaluate(base.actor, base.offer, [one[0]!]).causes.map(({ code }) => code)).toEqual(expect.arrayContaining(['DEBT_REQUIREMENT_UNMET', 'HEALTH_REQUIREMENT_UNMET']))
    base.actor.institutional.eligibility = 'unmet'
    expect(evaluate(base.actor, base.offer, [one[0]!]).causes.map(({ code }) => code)).toContain('ACADEMIC_INELIGIBILITY')
    base.actor.institutional.debt = 'unknown'
    base.actor.institutional.health = 'unknown'
    base.actor.institutional.eligibility = 'unknown'
    expect(evaluate(base.actor, base.offer, [one[0]!]).gaps.map(({ code }) => code)).toContain('INSTITUTIONAL_REQUIREMENT_UNKNOWN')
  })

  it.each(schools)('%s evaluates plan MAT02-V05, known/unknown schedules, overlaps and section capacity', (school) => {
    const base = input(school)
    const [first, second, third] = base.offer
    const selected = [first!, second!, third!].map((course) => ({ courseId: course.courseId, sectionId: course.sections[0]!.sectionId }))
    first!.planId = 'SYN-OTHER-PLAN'
    expect(evaluateSelectionAdmission(base.actor, base.offer, selected).causes.map(({ code }) => code)).toContain('PLAN_MISMATCH')
    first!.planId = base.actor.scope.planId
    second!.sections[0]!.schedule = [{ day: 1, startMinute: 8 * 60 + 30, endMinute: 9 * 60 + 30 }]
    expect(evaluate(base.actor, base.offer, selected).causes.map(({ code }) => code)).toContain('SCHEDULE_CONFLICT')
    second!.sections[0]!.schedule = [{ day: 1, startMinute: 9 * 60, endMinute: 10 * 60 }]
    expect(evaluate(base.actor, base.offer, selected).causes.map(({ code }) => code)).not.toContain('SCHEDULE_CONFLICT')
    second!.sections[0]!.schedule = null
    expect(evaluate(base.actor, base.offer, selected).gaps.map(({ code }) => code)).toContain('SCHEDULE_UNKNOWN')
    second!.sections[0]!.schedule = []
    first!.sections[0]!.occupied = first!.sections[0]!.capacity
    const allKnown = evaluate(base.actor, base.offer, selected)
    expect(allKnown.causes.map(({ code }) => code)).toContain('SECTION_FULL')
    expect(allKnown.causes.every(({ sourceIds }) => sourceIds.length > 0)).toBe(true)
    expect(allKnown.gaps.every(({ sourceIds }) => sourceIds.length > 0)).toBe(true)
  })
})

describe('T030 exact profile scope and rule knowledge', () => {
  const basePath = '/local/matricula-regular/v1'
  let now = new Date('2026-08-11T15:00:00.000Z')
  const clock: ServerClock = { now: () => new Date(now) }
  let testApp: MatriculaRegularTestApp

  beforeAll(async () => {
    testApp = await createMatriculaRegularTestApp(clock)
  })

  afterAll(async () => {
    await testApp.close()
  })

  beforeEach(() => {
    now = new Date('2026-08-11T15:00:00.000Z')
    testApp.reset()
  })

  async function submitForFixture(fixture: ReturnType<typeof createSyntheticFixture>, school: School) {
    testApp.repository.resetForTests([fixture])
    const actor = fixture.actors[0]!
    const session = await supertest(testApp.app.getHttpServer())
      .post(`${basePath}/sesiones`)
      .send({ runId: testApp.repository.runId, actorId: actor.actorId })
    expect(session.status).toBe(200)
    const before = testApp.repository.readSnapshot()
    const response = await supertest(testApp.app.getHttpServer())
      .post(`${basePath}/solicitudes`)
      .send({
        runId: before.runId,
        actorId: actor.actorId,
        sessionId: session.body.data.sessionId,
        requestId: '00000000-0000-4000-8000-000000000030',
        profileRevision: actor.profileRevision,
        selection: fixture.offer.map((course) => ({
          courseId: course.courseId,
          sectionId: course.sections[0]!.sectionId,
        })),
      })
    return { actor, before, response, state: testApp.repository.readSnapshot(), school }
  }

  it.each(schools.flatMap((school) => [
    ['faculty', (fixture: ReturnType<typeof createSyntheticFixture>) => { fixture.actors[0]!.scope.facultyId = 'OTHER' }],
    ['period', (fixture: ReturnType<typeof createSyntheticFixture>) => { fixture.actors[0]!.scope.period = '2026-I' }],
    ['school', (fixture: ReturnType<typeof createSyntheticFixture>) => { fixture.actors[0]!.scope.schoolId = 'OTHER-SCHOOL' }],
    ['plan', (fixture: ReturnType<typeof createSyntheticFixture>) => { fixture.actors[0]!.scope.planId = 'SYN-OTHER-PLAN' }],
    ['modality', (fixture: ReturnType<typeof createSyntheticFixture>) => { Reflect.set(fixture.actors[0]!.scope, 'modality', 'regular-onsite') }],
    ['revision', (fixture: ReturnType<typeof createSyntheticFixture>) => { fixture.actors[0]!.profileRevision = 'MR-SYN-STALE' }],
  ].flatMap(([dimension, mutate]) => [11, 27].map((credits) => ({ school, dimension, mutate, credits })))))(
    '$school $dimension mismatch with $credits credits stays pending without FISI causes',
    async ({ school, mutate, credits }) => {
      const fixture = createSyntheticFixture(school)
      ;(mutate as (value: ReturnType<typeof createSyntheticFixture>) => void)(fixture)
      const actor = fixture.actors[0]!
      actor.rules = []
      actor.failedCourses = [{ courseId: fixture.offer[0]!.courseId, failures: 2 }]
      actor.tutorship = [{ courseId: fixture.offer[0]!.courseId, condition: 'unmet' }]
      actor.approvedCourseIds = []
      fixture.offer[0]!.credits = credits - fixture.offer.slice(1).reduce((total, course) => total + course.credits, 0)
      actor.preEnrollment = actor.preEnrollment.map((course, index) => ({
        ...course,
        credits: fixture.offer[index]?.credits ?? course.credits,
      }))
      fixture.offer[0]!.prerequisiteIds = ['SYN-REQ']
      const { response, before, state } = await submitForFixture(fixture, school)

      expect(response.status).toBe(200)
      expect(response.body.data.state).toBe('configuration-pending')
      expect(response.body.data.gaps.map(({ code }: { code: string }) => code)).toContain('PROFILE_MISSING')
      expect(response.body.data.causes).toEqual([])
      expect(response.body.data.causes.every(({ sourceIds }: { sourceIds: string[] }) => sourceIds.length > 0)).toBe(true)
      expect(response.body.data.enrollmentId).toBeNull()
      expect(state.requests).toHaveLength(1)
      expect(state.enrollments).toEqual([])
      expect(state.reports).toEqual([])
      expect(state.offer.map(({ courseId, sections }) => [courseId, sections[0]!.occupied]))
        .toEqual(before.offer.map(({ courseId, sections }) => [courseId, sections[0]!.occupied]))
    },
  )

  it.each(schools)('%s keeps unknown rules pending and respects explicit not-applicable knowledge', async (school) => {
    const unknownFixture = createSyntheticFixture(school)
    const institutionalRule = unknownFixture.actors[0]!.rules.find(({ ruleId }) => ruleId === 'INSTITUTIONAL-REQUIREMENTS')!
    institutionalRule.knowledge = 'unknown'
    const unknown = await submitForFixture(unknownFixture, school)
    expect(unknown.response.body.data.state).toBe('configuration-pending')
    expect(unknown.response.body.data.gaps.map(({ code }: { code: string }) => code)).toContain('INSTITUTIONAL_REQUIREMENT_UNKNOWN')
    expect(unknown.state.enrollments).toEqual([])
    expect(unknown.state.reports).toEqual([])

    const notApplicable = input(school)
    notApplicable.actor.rules.push({
      ruleId: 'CREDIT-LOAD',
      sourceIds: ['SYN-FIXTURE'],
      knowledge: 'not-applicable',
    })
    notApplicable.actor.creditException = {
      kind: 'none',
      applicability: 'not-applicable',
      sourceIds: ['SYN-FIXTURE'],
    }
    notApplicable.offer[0]!.credits = 11
    notApplicable.actor.preEnrollment[0]!.credits = 11
    const result = evaluate(notApplicable.actor, notApplicable.offer, [
      { courseId: notApplicable.offer[0]!.courseId, sectionId: notApplicable.offer[0]!.sections[0]!.sectionId },
    ])
    expect(result.causes.map(({ code }) => code)).not.toContain('CREDIT_LOAD_INVALID')
    expect(result.gaps).toEqual([])
  })

  it.each(schools)('%s does not emit FISI credit causes when the actor has no matching scope or rule source', (school) => {
    const base = input(school)
    const first = base.offer[0]!
    base.actor.rules = []
    base.actor.scope.facultyId = 'OTHER'
    first.credits = 11
    base.actor.preEnrollment[0]!.credits = 11
    const result = evaluate(base.actor, base.offer, [
      { courseId: first.courseId, sectionId: first.sections[0]!.sectionId },
    ])
    expect(result.causes.map(({ code }) => code)).not.toContain('CREDIT_LOAD_INVALID')
    expect(result.causes.every(({ sourceIds }) => sourceIds.length > 0)).toBe(true)
  })
})

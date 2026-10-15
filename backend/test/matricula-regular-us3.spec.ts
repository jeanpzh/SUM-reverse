import { describe, expect, it } from 'vitest'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { evaluateSelectionAdmission } from '../src/matricula-regular/selection.rules.js'

describe.each(['SISTEMAS', 'SOFTWARE'] as const)('T023 L-05 catalog admission: %s', (school) => {
  it('exposes only the exact same-plan intersection for complete pre-enrollment and offer', () => {
    const fixture = createSyntheticFixture(school)
    const actor = fixture.actors[0]!
    const result = evaluateSelectionAdmission(actor, fixture.offer, [])

    expect(result.selectableCourseIds).toEqual(actor.preEnrollment.map((course) => course.courseId).sort())
    expect(result.causes).toEqual([])
    expect(result.gaps).toEqual([])
    expect(result.unknownChoices).toEqual([])
  })

  it('admits a known same-plan course omitted from complete pre-enrollment for evaluation, returning a local cause', () => {
    const fixture = createSyntheticFixture(school)
    const actor = fixture.actors[0]!
    const omitted = fixture.offer[0]!
    actor.preEnrollment = actor.preEnrollment.filter((course) => course.courseId !== omitted.courseId)

    const result = evaluateSelectionAdmission(actor, fixture.offer, [
      { courseId: omitted.courseId, sectionId: omitted.sections[0]!.sectionId },
    ])

    expect(result.unknownChoices).toEqual([])
    expect(result.causes).toEqual([{
      code: 'COURSE_NOT_IN_PRE_ENROLLMENT',
      courseIds: [omitted.courseId],
      sectionIds: [omitted.sections[0]!.sectionId],
      sourceIds: ['L-05'],
    }])
    expect(result.gaps).toEqual([])
    expect(result.selectableCourseIds).not.toContain(omitted.courseId)
  })

  it('keeps incomplete pre-enrollment as a gap instead of excluding a course from the partial list', () => {
    const fixture = createSyntheticFixture(school)
    const actor = fixture.actors[0]!
    const omitted = fixture.offer[0]!
    actor.preEnrollmentComplete = false
    actor.preEnrollment = []

    const result = evaluateSelectionAdmission(actor, fixture.offer, [
      { courseId: omitted.courseId, sectionId: omitted.sections[0]!.sectionId },
    ])

    expect(result.causes).toEqual([])
    expect(result.gaps).toEqual([{ code: 'PLAN_OR_OFFER_UNKNOWN', courseIds: [], sourceIds: ['SYN-FIXTURE'] }])
    expect(result.selectableCourseIds).toEqual([])
    expect(result.unknownChoices).toEqual([])
  })

  it('reports a known course from another plan once as PLAN_MISMATCH, without a membership cause', () => {
    const fixture = createSyntheticFixture(school)
    const actor = fixture.actors[0]!
    const otherPlanCourse = structuredClone(fixture.offer[0]!)
    otherPlanCourse.planId = school === 'SISTEMAS' ? 'SYN-SOFT-PLAN' : 'SYN-SIS-PLAN'
    otherPlanCourse.courseId = school === 'SISTEMAS' ? 'SYN-SOFT-C1' : 'SYN-SIS-C1'
    otherPlanCourse.sections[0]!.sectionId = school === 'SISTEMAS' ? 'SYN-SOFT-S1' : 'SYN-SIS-S1'

    const result = evaluateSelectionAdmission(actor, [otherPlanCourse, ...fixture.offer], [
      { courseId: otherPlanCourse.courseId, sectionId: otherPlanCourse.sections[0]!.sectionId },
    ])

    expect(result.unknownChoices).toEqual([])
    expect(result.causes).toEqual([{
      code: 'PLAN_MISMATCH',
      courseIds: [otherPlanCourse.courseId],
      sectionIds: [otherPlanCourse.sections[0]!.sectionId],
      sourceIds: ['F1'],
    }])
    expect(result.causes.map((cause) => cause.code)).not.toContain('COURSE_NOT_IN_PRE_ENROLLMENT')
  })

  it('distinguishes a valid catalog entry with an invalid section from unknown catalog IDs', () => {
    const fixture = createSyntheticFixture(school)
    const course = fixture.offer[0]!
    const result = evaluateSelectionAdmission(fixture.actors[0]!, fixture.offer, [
      { courseId: course.courseId, sectionId: 'SYN-UNKNOWN-SECTION' },
      { courseId: 'SYN-UNKNOWN-COURSE', sectionId: 'SYN-UNKNOWN-SECTION-2' },
    ])

    expect(result.unknownChoices).toEqual([
      { courseId: course.courseId, sectionId: 'SYN-UNKNOWN-SECTION' },
      { courseId: 'SYN-UNKNOWN-COURSE', sectionId: 'SYN-UNKNOWN-SECTION-2' },
    ])
    expect(result.causes).toEqual([])
    expect(result.gaps).toEqual([])
  })
})

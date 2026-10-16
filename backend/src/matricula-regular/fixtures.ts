import { createSyntheticProfile } from './profiles.js'
import type {
  ActorProfile,
  CourseDocument,
  OfferedCourse,
  School,
  SyntheticFixture,
} from './profile.types.js'

const clone = <T>(value: T): T => structuredClone(value)

function idsFor(school: School) {
  const prefix = school === 'SISTEMAS' ? 'SIS' : 'SOFT'

  return {
    prefix,
    planId: `SYN-${prefix}-PLAN`,
    courseIds: [
      `SYN-${prefix}-C1`,
      `SYN-${prefix}-C2`,
      `SYN-${prefix}-C3`,
    ],
    sectionIds: [
      `SYN-${prefix}-S1`,
      `SYN-${prefix}-S2`,
      `SYN-${prefix}-S3`,
    ],
  }
}

function createCourseDocuments(school: School): CourseDocument[] {
  const { planId, courseIds } = idsFor(school)

  return courseIds.map((courseId, index) => ({
    courseId,
    planId,
    name: `Asignatura sintética ${index + 1}`,
    credits: 4,
  }))
}

function createActor(school: School, suffix: 'A' | 'B'): ActorProfile {
  const profile = createSyntheticProfile(school)
  const documents = createCourseDocuments(school)

  return {
    actorId: `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}`,
    name: `Estudiante sintético ${suffix}`,
    profileRevision: profile.profileRevision,
    scope: clone(profile.scope),
    preEnrollmentEnabled: true,
    preEnrollment: clone(documents),
    preEnrollmentComplete: true,
    planKnown: true,
    offerKnown: true,
    equivalencesKnown: true,
    approvedCourseIds: [],
    historyKnown: true,
    // L-13: SYN-SOFT-B failed SYN-SOFT-C1 once so the mandatory «(*)» row is visible in the demo.
    failedCourses: school === 'SOFTWARE' && suffix === 'B' ? [{ courseId: 'SYN-SOFT-C1', failures: 1 }] : [],
    creditException: {
      kind: 'none',
      applicability: 'not-applicable',
      sourceIds: ['SYN-FIXTURE'],
    },
    institutional: {
      debt: 'met',
      health: 'met',
      eligibility: 'met',
    },
    tutorship: [],
    fourthAttemptAuthorization: [],
    ponderado: suffix === 'A' ? 17 : 18,
    rules: [
      { ruleId: 'PRE-ENROLLMENT-ENABLED', sourceIds: ['SYN-FIXTURE'], knowledge: 'known' },
      { ruleId: 'PLAN-AND-OFFER', sourceIds: ['SYN-FIXTURE'], knowledge: 'known' },
      { ruleId: 'ACADEMIC-HISTORY', sourceIds: ['SYN-FIXTURE'], knowledge: 'known' },
      { ruleId: 'INSTITUTIONAL-REQUIREMENTS', sourceIds: ['SYN-FIXTURE'], knowledge: 'known' },
      { ruleId: 'CREDIT-EXCEPTION', sourceIds: ['SYN-FIXTURE'], knowledge: 'not-applicable' },
    ],
  }
}

function createOffer(school: School, documents: CourseDocument[]): OfferedCourse[] {
  const { prefix, sectionIds } = idsFor(school)
  const meetingDays = [1, 2, 3] as const

  return documents.map((document, index) => ({
    ...clone(document),
    prerequisiteIds: [],
    // L-13: synthetic display data for MR-CONTRACT-3; not SUM values.
    cycle: index * 2 + 1,
    courseType: 'mandatory' as const,
    sections: [
      {
        sectionId: sectionIds[index]!,
        capacity: index === 0 ? 1 : 2,
        occupied: 0,
        schedule: [
          {
            day: meetingDays[index]!,
            startMinute: 8 * 60,
            endMinute: 9 * 60,
          },
        ],
        label: '1',
        // The first course has no assigned teacher to exercise the observed «-- --, --» (V-08).
        teacher: index === 0 ? null : `SINTÉTICO ${prefix}, DOCENTE ${index + 1}`,
        room: null,
      },
    ],
  }))
}

export function createSyntheticActorFixture(
  school: School,
  actor: 'A' | 'B',
): ActorProfile {
  return createActor(school, actor)
}

export function createSyntheticFixture(school: School): SyntheticFixture {
  const actors = [createActor(school, 'A'), createActor(school, 'B')]
  const documents = createCourseDocuments(school)

  return {
    profile: createSyntheticProfile(school),
    actors,
    offer: createOffer(school, documents),
  }
}

export function cloneActorFixture(actor: ActorProfile): ActorProfile {
  return clone(actor)
}

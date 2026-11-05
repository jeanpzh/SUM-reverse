import { createHash } from 'node:crypto'
import type { AcademicPublication } from '../../../shared/programacion-academica-api.d.mts'
import type { OperationalOffer } from '../../../shared/enrollment-offer.mjs'
import { buildBuiltInEnrollmentScenarioBundles } from './enrollment-scenarios.js'
import { regularTurnWindowsForDate } from './windows.js'
import type { ActorProfile, EnrollmentProfile, OfferedCourse, SyntheticFixture } from './profile.types.js'
import type { RunState } from './store.types.js'

export const E3_CLOCK_BASE = '2027-03-02T03:30:00.000Z'
const LOCAL_SOURCE_ID = 'E3-PUBLICATION-1'

function stableSectionId(offer: OperationalOffer, sourceCourseId: string, sourceSectionId: string): string {
  const digest = createHash('sha256')
    .update(`${offer.publicationId}:${offer.publicationVersion}:${sourceCourseId}:${sourceSectionId}`)
    .digest('hex').slice(0, 20).toUpperCase()
  return `SYN-SIS-E3-${digest}`
}

function regularFixture(): SyntheticFixture {
  const regular = buildBuiltInEnrollmentScenarioBundles().find((bundle) => bundle.scenarioId === 'regular')
  if (!regular) throw new Error('BUNDLE_UNAVAILABLE')
  const actors = regular.fixtures.flatMap((fixture) => fixture.actors)
    .filter((actor) => actor.actorId === 'SYN-SIS-A' || actor.actorId === 'SYN-SIS-B')
  const systems = regular.fixtures.find((fixture) => fixture.actors.some((actor) => actor.actorId === 'SYN-SIS-A'))
  if (!systems || actors.length !== 2 || !actors.every((actor) => actor.scenarioData?.courseCodes && actor.academic)) {
    throw new Error('BUNDLE_UNAVAILABLE')
  }
  const profile = structuredClone(systems.profile)
  profile.scope = { ...profile.scope, period: '2027-I' }
  profile.profileRevision = `MR-E3-${regular.source.sha256.slice(0, 24).toUpperCase()}`
  profile.academicPolicy = 'fisi-regular'
  profile.calendar = {
    publishedRows: [],
    effectiveWindows: regularTurnWindowsForDate('2027-03-01', [LOCAL_SOURCE_ID]),
    unknownDates: [],
  }
  profile.sources = [...profile.sources, {
    id: LOCAL_SOURCE_ID,
    origin: 'local-decision',
    class: null,
    reference: 'docs/reverse-engineering/contracts/local-api/ciclo-completo-fase3.md#seccion-a',
    date: '2026-11-05',
    status: 'local-only',
  }]
  const courses = new Map(systems.offer.map((course) => [course.courseId, structuredClone(course)]))
  return { profile, actors, offer: [...courses.values()] }
}

function mapPublishedOffer(publication: AcademicPublication, offer: OperationalOffer, fixture: SyntheticFixture) {
  const sourceActor = fixture.actors.find((actor) => actor.actorId === 'SYN-SIS-A')!
  const codeMap = sourceActor.scenarioData!.courseCodes
  const academicById = new Map(sourceActor.academic!.catalog.map((course) => [course.courseId, course]))
  const regularById = new Map(fixture.offer.map((course) => [course.courseId, course]))
  const mappedCourseIds = new Set<string>()
  const codeMapOutput: Record<string, string> = {}
  const originEntries: Array<{ publicationId: string; publicationVersion: number; courseId: string; sectionId: string; offeredSectionId: string }> = []
  const mappedOffer: OfferedCourse[] = []

  for (const course of publication.schedule.courses) {
    const matches = Object.entries(codeMap).filter(([, code]) => code === course.courseId)
    if (matches.length !== 1) throw new Error('COURSE_UNMAPPED')
    const [targetId] = matches[0]!
    if (mappedCourseIds.has(targetId)) throw new Error('COURSE_UNMAPPED')
    const academic = academicById.get(targetId)
    const regularCourse = regularById.get(targetId)
    if (!academic || !regularCourse || academic.credits !== course.credits
      || academic.credits !== regularCourse.credits
      || academic.planId !== 'SYN-SIS-PLAN' || regularCourse.planId !== academic.planId
      || [...academic.prerequisiteIds].sort().join('|') !== [...regularCourse.prerequisiteIds].sort().join('|')) {
      throw new Error('COURSE_UNMAPPED')
    }
    mappedCourseIds.add(targetId)
    codeMapOutput[targetId] = course.courseId
    const sourceSections = publication.schedule.sections.filter((section) => section.courseId === course.courseId)
    const sections = sourceSections.map((sourceSection, index) => {
      const sectionId = stableSectionId(offer, course.courseId, sourceSection.sectionId)
      const sessions = publication.schedule.assignments.filter((assignment) =>
        assignment.courseId === course.courseId && assignment.sectionId === sourceSection.sectionId,
      )
      const meetings = [...new Map(sessions.map((session) => [`${session.day}:${session.startMinute}:${session.endMinute}`, {
        day: session.day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        startMinute: session.startMinute,
        endMinute: session.endMinute,
      }])).values()].sort((left, right) => left.day - right.day || left.startMinute - right.startMinute)
      if (meetings.length === 0 || !Number.isSafeInteger(sourceSection.capacity) || sourceSection.capacity < 1) {
        throw new Error('ACADEMIC_CONTEXT_UNAVAILABLE')
      }
      const first = sessions[0]!
      originEntries.push({ publicationId: publication.id, publicationVersion: publication.publicationVersion,
        courseId: course.courseId, sectionId: sourceSection.sectionId, offeredSectionId: sectionId })
      return { sectionId, capacity: sourceSection.capacity, occupied: 0, schedule: meetings,
        label: String(index + 1), teacher: first.teacherName, room: [...new Set(sessions.map((session) => session.roomName))].join(' / ') }
    })
    if (sections.length === 0) throw new Error('ACADEMIC_CONTEXT_UNAVAILABLE')
    mappedOffer.push({ ...structuredClone(regularCourse), courseId: targetId, name: course.name, cycle: course.cycle,
      credits: course.credits, sections })
  }
  if (mappedOffer.length === 0) throw new Error('ACADEMIC_CONTEXT_UNAVAILABLE')
  return { offer: mappedOffer, codeMap: codeMapOutput, originEntries }
}

export function createOperationalRun(publication: AcademicPublication, offer: OperationalOffer): RunState {
  const fixture = regularFixture()
  const mapped = mapPublishedOffer(publication, offer, fixture)
  const profile = fixture.profile
  const mappedIds = new Set(mapped.offer.map((course) => course.courseId))
  const actors: ActorProfile[] = fixture.actors.map((source) => {
    const actor = structuredClone(source)
    actor.profileRevision = profile.profileRevision
    actor.scope = { ...actor.scope, period: '2027-I' }
    actor.preEnrollment = actor.preEnrollment.filter((course) => mappedIds.has(course.courseId))
    actor.scenarioData!.sectionOrigins = structuredClone(mapped.originEntries)
    return actor
  })
  const profiles: EnrollmentProfile[] = [profile]
  return {
    runId: offer.runId,
    profiles,
    actors,
    offer: mapped.offer,
    sessions: [],
    requests: new Map(),
    enrollments: new Map(),
    reports: new Map(),
  }
}

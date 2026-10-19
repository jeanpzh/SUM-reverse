import type { ActorProfile, OfferedCourse } from '../src/matricula-regular/profile.types.js'

export type ScenarioProfile = 'shared' | 'ample' | 'last-seat' | 'multi-uniform' | 'multi-hotspot' | 'distributed'
export type Contention = 'shared' | 'distributed'
export type Choice = { courseId: string; sectionId: string }

export type SyntheticLoadProfile = {
  actorCount: number
  scenarioProfile: ScenarioProfile
  contention: Contention
  offer: OfferedCourse[]
  actors: ActorProfile[]
  selection?: Choice[]
  actorSelections: Map<string, Choice[]>
  auxiliaryActors: ActorProfile[]
  expectedAccepted: number
  expectedRejected: number
  initialEnrollments: number
  initialRequests: number
}

const scenarioProfiles = new Set<ScenarioProfile>([
  'shared', 'ample', 'last-seat', 'multi-uniform', 'multi-hotspot', 'distributed',
])

export function parseActorCount(value: string | undefined): number {
  if (value === undefined) return 100
  if (!/^\d+$/.test(value)) throw new Error('SIMULATOR_ACTOR_COUNT must be an integer from 1 to 1000')
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000) throw new Error('SIMULATOR_ACTOR_COUNT must be an integer from 1 to 1000')
  return count
}

export function resolveScenarioProfile(profileValue: string | undefined, contentionValue: string | undefined): { scenarioProfile: ScenarioProfile; contention: Contention } {
  const legacyContention = contentionValue ?? 'shared'
  if (legacyContention !== 'shared' && legacyContention !== 'distributed') throw new Error('SIMULATOR_CONTENTION must be shared or distributed')
  if (profileValue !== undefined && !scenarioProfiles.has(profileValue as ScenarioProfile)) {
    throw new Error('SIMULATOR_SCENARIO_PROFILE must be shared, ample, last-seat, multi-uniform, multi-hotspot, or distributed')
  }
  const scenarioProfile = (profileValue ?? (legacyContention === 'distributed' ? 'distributed' : 'shared')) as ScenarioProfile
  return { scenarioProfile, contention: scenarioProfile === 'distributed' ? 'distributed' : 'shared' }
}

function selectionForGroup(offer: OfferedCourse[], groupIndex: number): Choice[] {
  return offer.map((course) => ({ courseId: course.courseId, sectionId: course.sections[groupIndex]!.sectionId }))
}

export function createSyntheticLoadProfile(
  actorCount: number,
  scenarioProfile: ScenarioProfile,
  templateActors: ActorProfile[],
  templateOffer: OfferedCourse[],
): SyntheticLoadProfile {
  if (!Number.isSafeInteger(actorCount) || actorCount < 1 || actorCount > 1000) throw new Error('actorCount must be an integer from 1 to 1000')
  if (!scenarioProfiles.has(scenarioProfile)) throw new Error('Unsupported scenario profile')
  if (templateActors.length === 0 || templateOffer.length !== 3 || templateOffer.some((course) => course.sections.length === 0)) {
    throw new Error('Synthetic seed fixture must contain actors and exactly three offered courses')
  }

  const actors = Array.from({ length: actorCount }, (_, index) => ({
    ...structuredClone(templateActors[0]!),
    actorId: `SYN-SIS-U${String(index + 1).padStart(4, '0')}`,
    name: `Estudiante sintético ${String(index + 1).padStart(4, '0')}`,
  }))
  const offer = structuredClone(templateOffer)
  const actorSelections = new Map<string, Choice[]>()
  const sharedSelection = selectionForGroup(offer, 0)
  let auxiliaryActors: ActorProfile[] = []
  let initialEnrollments = 0
  let initialRequests = 0

  if (scenarioProfile === 'shared' || scenarioProfile === 'last-seat') {
    offer.forEach((course, index) => { course.sections[0]!.capacity = index === 0 ? 10 : actorCount + (scenarioProfile === 'last-seat' ? 9 : 0) })
  } else if (scenarioProfile === 'ample') {
    offer.forEach((course) => { course.sections[0]!.capacity = actorCount })
  } else if (scenarioProfile === 'distributed') {
    offer.forEach((course, courseIndex) => {
      const section = course.sections[0]!
      course.sections = actors.map((actor) => ({
        ...structuredClone(section),
        sectionId: `${actor.actorId}-S${courseIndex + 1}`,
        capacity: 1,
        occupied: 0,
      }))
    })
    actors.forEach((actor) => actorSelections.set(actor.actorId, offer.map((course) => ({
      courseId: course.courseId,
      sectionId: course.sections.find((section) => section.sectionId.startsWith(actor.actorId))!.sectionId,
    }))))
  } else {
    offer.forEach((course, courseIndex) => {
      const template = course.sections[0]!
      course.sections = Array.from({ length: 5 }, (_, groupIndex) => ({
        ...structuredClone(template),
        sectionId: `${course.courseId}-G${groupIndex + 1}`,
        label: String(groupIndex + 1),
        capacity: courseIndex === 0 ? 20 : actorCount,
        occupied: 0,
      }))
    })
    actors.forEach((actor, index) => {
      const hotspotCount = Math.floor(actorCount * 0.8)
      const group = scenarioProfile === 'multi-uniform'
        ? index % 5
        : index < hotspotCount
          ? 0
          : 1 + ((index - hotspotCount) % 4)
      actorSelections.set(actor.actorId, selectionForGroup(offer, group))
    })
  }

  if (scenarioProfile === 'last-seat') {
    auxiliaryActors = Array.from({ length: 9 }, (_, index) => ({
      ...structuredClone(templateActors[0]!),
      actorId: `SYN-SIS-LAST-SEAT-${String(index + 1).padStart(2, '0')}`,
      name: `Estudiante auxiliar sintético ${String(index + 1).padStart(2, '0')}`,
    }))
    initialEnrollments = auxiliaryActors.length
    initialRequests = auxiliaryActors.length
  }

  const demandByGroup = new Map<number, number>()
  if (scenarioProfile === 'multi-uniform' || scenarioProfile === 'multi-hotspot') {
    for (const choices of actorSelections.values()) {
      const group = offer[0]!.sections.findIndex((section) => section.sectionId === choices[0]!.sectionId)
      demandByGroup.set(group, (demandByGroup.get(group) ?? 0) + 1)
    }
  }

  let expectedAccepted: number
  if (scenarioProfile === 'shared') expectedAccepted = Math.min(actorCount, offer[0]!.sections[0]!.capacity)
  else if (scenarioProfile === 'last-seat') expectedAccepted = Math.min(actorCount, offer[0]!.sections[0]!.capacity - initialEnrollments)
  else if (scenarioProfile === 'ample' || scenarioProfile === 'distributed') expectedAccepted = actorCount
  else expectedAccepted = [...demandByGroup.entries()].reduce((total, [group, demand]) => {
    const capacity = Math.min(...offer.map((course) => course.sections[group]!.capacity))
    return total + Math.min(demand, capacity)
  }, 0)

  return {
    actorCount,
    scenarioProfile,
    contention: scenarioProfile === 'distributed' ? 'distributed' : 'shared',
    offer,
    actors,
    ...(scenarioProfile === 'shared' || scenarioProfile === 'ample' || scenarioProfile === 'last-seat' ? { selection: sharedSelection } : {}),
    actorSelections,
    auxiliaryActors,
    expectedAccepted,
    expectedRejected: actorCount - expectedAccepted,
    initialEnrollments,
    initialRequests,
  }
}

export function capacityManifest(offer: OfferedCourse[], initialOccupiedBySection: Map<string, number> = new Map()) {
  return offer.flatMap((course) => course.sections.map((section) => ({
    courseId: course.courseId,
    sectionId: section.sectionId,
    capacity: section.capacity,
    initialOccupied: initialOccupiedBySection.get(`${course.courseId}:${section.sectionId}`) ?? section.occupied,
  })))
}

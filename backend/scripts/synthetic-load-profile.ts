import type { ActorProfile, OfferedCourse } from '../src/matricula-regular/profile.types.js'

export type ScenarioProfile = 'shared' | 'ample' | 'last-seat' | 'multi-uniform' | 'multi-hotspot' | 'fisi-schools' | 'distributed'
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
  fisi?: FisiLoad
}

export type FisiCohort = 'SIS' | 'SOFT' | 'CC' | 'IA'
export type FisiConfig = {
  mode: 'franja' | 'jornada'
  franja?: number
  iaActors: number
  capacityMode: 'ample' | 'scarce'
  scarceRatio?: number
}
export type FisiLoad = {
  config: FisiConfig
  cohorts: { cohort: FisiCohort; size: number; capacity: number; sectionIds: string[]; expectedAccepted: number }[]
  waves?: { wave: number; label: string; ppFrom: number; size: number }[]
  hotCohortSize: number
  actorMeta: Map<string, { cohort: FisiCohort; wave?: number }>
}

// Source: contract simulator-load-profiles.md (revision 2026-10-22), testimony of aggregate counts
// from the public FISI ranking PDF, enrollment 2026-I (sourceId FISI-RANKING-2026-I). Local-only sizing.
// Columns: franja, label, PP from, Sistemas, Software, Ciencia de la Computación.
const FISI_WAVES: readonly { label: string; ppFrom: number; weights: readonly [number, number, number] }[] = [
  { label: '06:00', ppFrom: 17, weights: [16, 7, 1] },
  { label: '08:00', ppFrom: 16, weights: [67, 40, 6] },
  { label: '10:00', ppFrom: 15, weights: [135, 137, 21] },
  { label: '12:00', ppFrom: 14, weights: [286, 203, 18] },
  { label: '14:00', ppFrom: 13, weights: [201, 96, 16] },
  { label: '16:00', ppFrom: 12, weights: [77, 34, 6] },
  { label: '18:00', ppFrom: 11, weights: [16, 12, 3] },
  { label: '20:00', ppFrom: 10, weights: [3, 7, 3] },
  { label: '22:00', ppFrom: 0, weights: [3, 5, 3] },
]
const FISI_COHORT_ORDER: readonly FisiCohort[] = ['SIS', 'SOFT', 'CC', 'IA']

const scenarioProfiles = new Set<ScenarioProfile>([
  'shared', 'ample', 'last-seat', 'multi-uniform', 'multi-hotspot', 'fisi-schools', 'distributed',
])

export function parseActorCount(value: string | undefined): number {
  if (value === undefined) return 100
  if (!/^\d+$/.test(value)) throw new Error('SIMULATOR_ACTOR_COUNT must be an integer from 1 to 2000')
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 1 || count > 2000) throw new Error('SIMULATOR_ACTOR_COUNT must be an integer from 1 to 2000')
  return count
}

export function resolveScenarioProfile(profileValue: string | undefined, contentionValue: string | undefined): { scenarioProfile: ScenarioProfile; contention: Contention } {
  const legacyContention = contentionValue ?? 'shared'
  if (legacyContention !== 'shared' && legacyContention !== 'distributed') throw new Error('SIMULATOR_CONTENTION must be shared or distributed')
  if (profileValue !== undefined && !scenarioProfiles.has(profileValue as ScenarioProfile)) {
    throw new Error('SIMULATOR_SCENARIO_PROFILE must be shared, ample, last-seat, multi-uniform, multi-hotspot, fisi-schools, or distributed')
  }
  const scenarioProfile = (profileValue ?? (legacyContention === 'distributed' ? 'distributed' : 'shared')) as ScenarioProfile
  return { scenarioProfile, contention: scenarioProfile === 'distributed' ? 'distributed' : 'shared' }
}

function selectionForGroup(offer: OfferedCourse[], groupIndex: number): Choice[] {
  return offer.map((course) => ({ courseId: course.courseId, sectionId: course.sections[groupIndex]!.sectionId }))
}

const FISI_ENV_NAMES = ['SIMULATOR_FISI_FRANJA', 'SIMULATOR_FISI_IA_ACTORS', 'SIMULATOR_FISI_CAPACITY', 'SIMULATOR_FISI_SCARCE_RATIO'] as const

export const DEFAULT_FISI_CONFIG: FisiConfig = { mode: 'franja', franja: 4, iaActors: 0, capacityMode: 'ample' }

/** Pure parser for the SIMULATOR_FISI_* variables. Returns undefined unless the profile is fisi-schools. */
export function parseFisiConfig(
  env: Record<string, string | undefined>,
  scenarioProfile: ScenarioProfile,
  actorCount: number,
): FisiConfig | undefined {
  if (scenarioProfile !== 'fisi-schools') {
    const present = FISI_ENV_NAMES.filter((name) => env[name] !== undefined)
    if (present.length > 0) throw new Error(`${present.join(', ')} require SIMULATOR_SCENARIO_PROFILE=fisi-schools`)
    return undefined
  }
  const franjaValue = env.SIMULATOR_FISI_FRANJA ?? '4'
  let mode: FisiConfig['mode'] = 'jornada'
  let franja: number | undefined
  if (franjaValue !== 'jornada') {
    if (!/^[1-9]$/.test(franjaValue)) throw new Error('SIMULATOR_FISI_FRANJA must be an integer from 1 to 9 or jornada')
    mode = 'franja'
    franja = Number(franjaValue)
  }
  const iaValue = env.SIMULATOR_FISI_IA_ACTORS ?? '0'
  if (!/^\d+$/.test(iaValue) || !Number.isSafeInteger(Number(iaValue)) || Number(iaValue) > actorCount) {
    throw new Error('SIMULATOR_FISI_IA_ACTORS must be an integer from 0 to SIMULATOR_ACTOR_COUNT')
  }
  const capacityValue = env.SIMULATOR_FISI_CAPACITY ?? 'ample'
  if (capacityValue !== 'ample' && capacityValue !== 'scarce') throw new Error('SIMULATOR_FISI_CAPACITY must be ample or scarce')
  const ratioValue = env.SIMULATOR_FISI_SCARCE_RATIO
  if (ratioValue !== undefined && capacityValue !== 'scarce') throw new Error('SIMULATOR_FISI_SCARCE_RATIO requires SIMULATOR_FISI_CAPACITY=scarce')
  let scarceRatio: number | undefined
  if (capacityValue === 'scarce') {
    const text = ratioValue ?? '0.5'
    const match = /^0?\.(\d{1,6})$/.exec(text)
    scarceRatio = match ? Number(text) : Number.NaN
    if (!match || !(scarceRatio > 0 && scarceRatio < 1)) throw new Error('SIMULATOR_FISI_SCARCE_RATIO must be a decimal greater than 0 and lower than 1 (at most 6 decimals)')
  }
  return {
    mode,
    ...(franja !== undefined ? { franja } : {}),
    iaActors: Number(iaValue),
    capacityMode: capacityValue,
    ...(scarceRatio !== undefined ? { scarceRatio } : {}),
  }
}

/** Largest-remainder allocation; ties resolved by cell order (index ascending). Integer arithmetic only. */
export function allocateLargestRemainder(total: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  const shares = weights.map((weight) => Math.floor((total * weight) / weightSum))
  const remainders = weights.map((weight, index) => ({ index, remainder: (total * weight) % weightSum }))
  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  let leftover = total - shares.reduce((sum, share) => sum + share, 0)
  for (const { index } of remainders) {
    if (leftover <= 0) break
    shares[index]! += 1
    leftover -= 1
  }
  return shares
}

// floor(size * ratio) with integer arithmetic over the decimal digits of the ratio (no float drift).
function scarceCapacity(size: number, ratio: number): number {
  const decimals = ratio.toString().split('.')[1] ?? ''
  const denominator = 10 ** decimals.length
  const numerator = Math.round(ratio * denominator)
  return Math.max(1, Math.floor((size * numerator) / denominator))
}

function createFisiLoadProfile(
  actorCount: number,
  config: FisiConfig,
  templateActor: ActorProfile,
  templateOffer: OfferedCourse[],
) {
  if (!Number.isSafeInteger(config.iaActors) || config.iaActors < 0 || config.iaActors > actorCount) throw new Error('FISI IA actors must be an integer from 0 to actorCount')
  if (config.franja !== undefined && (!Number.isInteger(config.franja) || config.franja < 1 || config.franja > 9)) throw new Error('FISI franja must be an integer from 1 to 9')
  if (config.mode === 'franja' && config.franja === undefined) throw new Error('FISI franja mode requires a franja')
  if (config.capacityMode === 'scarce' && !(config.scarceRatio! > 0 && config.scarceRatio! < 1 && /^0\.\d{1,6}$/.test(config.scarceRatio!.toString()))) throw new Error('FISI scarce ratio must be greater than 0 and lower than 1')
  if (config.capacityMode === 'ample' && config.scarceRatio !== undefined) throw new Error('FISI scarce ratio requires scarce capacity')

  // cells[w][c]: actors of wave w (0-based) and cohort c in SIS, SOFT, CC, IA order.
  const cells: number[][] = FISI_WAVES.map(() => [0, 0, 0, 0])
  const schoolActors = actorCount - config.iaActors
  if (config.mode === 'franja') {
    const wave = config.franja! - 1
    const sizes = allocateLargestRemainder(schoolActors, FISI_WAVES[wave]!.weights)
    sizes.forEach((size, index) => { cells[wave]![index] = size })
    cells[wave]![3] = config.iaActors
  } else {
    const sizes = allocateLargestRemainder(schoolActors, FISI_WAVES.flatMap((wave) => [...wave.weights]))
    sizes.forEach((size, index) => { cells[Math.floor(index / 3)]![index % 3] = size })
    const iaShares = allocateLargestRemainder(config.iaActors, FISI_WAVES.map((wave) => wave.weights.reduce((sum, weight) => sum + weight, 0)))
    iaShares.forEach((share, wave) => { cells[wave]![3] = share })
  }

  const waveRange = config.mode === 'franja' ? [config.franja! - 1] : FISI_WAVES.map((_, index) => index)
  const cohortSizes = FISI_COHORT_ORDER.map((_, cohort) => cells.reduce((sum, row) => sum + row[cohort]!, 0))
  const activeCohorts = FISI_COHORT_ORDER.filter((_, cohort) => cohortSizes[cohort]! > 0)

  const offer = structuredClone(templateOffer)
  const sectionTemplates = offer.map((course) => structuredClone(course.sections[0]!))
  const capacityOf = (cohort: number, courseIndex: number) => {
    const size = cohortSizes[cohort]!
    return courseIndex === 0 && config.capacityMode === 'scarce' ? scarceCapacity(size, config.scarceRatio!) : size
  }
  offer.forEach((course, courseIndex) => {
    course.sections = activeCohorts.map((tag) => {
      const cohort = FISI_COHORT_ORDER.indexOf(tag)
      return {
        ...structuredClone(sectionTemplates[courseIndex]!),
        sectionId: `${course.courseId}-FISI-${tag}`,
        label: tag,
        capacity: capacityOf(cohort, courseIndex),
        occupied: 0,
      }
    })
  })

  const actors: ActorProfile[] = []
  const actorSelections = new Map<string, Choice[]>()
  const actorMeta = new Map<string, { cohort: FisiCohort; wave?: number }>()
  for (const wave of waveRange) {
    FISI_COHORT_ORDER.forEach((tag, cohort) => {
      const groupIndex = activeCohorts.indexOf(tag)
      for (let n = 0; n < cells[wave]![cohort]!; n += 1) {
        const number = String(actors.length + 1).padStart(4, '0')
        const actor = { ...structuredClone(templateActor), actorId: `SYN-SIS-U${number}`, name: `Estudiante sintético ${number}` }
        actors.push(actor)
        actorSelections.set(actor.actorId, selectionForGroup(offer, groupIndex))
        actorMeta.set(actor.actorId, { cohort: tag, ...(config.mode === 'jornada' ? { wave: wave + 1 } : {}) })
      }
    })
  }

  const cohorts = activeCohorts.map((tag) => {
    const cohort = FISI_COHORT_ORDER.indexOf(tag)
    const size = cohortSizes[cohort]!
    const capacity = capacityOf(cohort, 0)
    return { cohort: tag, size, capacity, sectionIds: offer.map((course) => `${course.courseId}-FISI-${tag}`), expectedAccepted: Math.min(size, capacity) }
  })
  const expectedAccepted = cohorts.reduce((sum, cohort) => sum + cohort.expectedAccepted, 0)
  const hotCohortSize = Math.max(...waveRange.flatMap((wave) => cells[wave]!))
  const waves = config.mode === 'jornada'
    ? FISI_WAVES.map((wave, index) => ({ wave: index + 1, label: wave.label, ppFrom: wave.ppFrom, size: cells[index]!.reduce((sum, size) => sum + size, 0) }))
    : undefined
  const fisi: FisiLoad = { config, cohorts, ...(waves ? { waves } : {}), hotCohortSize, actorMeta }
  return { actors, offer, actorSelections, expectedAccepted, fisi }
}

export function createSyntheticLoadProfile(
  actorCount: number,
  scenarioProfile: ScenarioProfile,
  templateActors: ActorProfile[],
  templateOffer: OfferedCourse[],
  fisiConfig?: FisiConfig,
): SyntheticLoadProfile {
  if (!Number.isSafeInteger(actorCount) || actorCount < 1 || actorCount > 2000) throw new Error('actorCount must be an integer from 1 to 2000')
  if (!scenarioProfiles.has(scenarioProfile)) throw new Error('Unsupported scenario profile')
  if (templateActors.length === 0 || templateOffer.length !== 3 || templateOffer.some((course) => course.sections.length === 0)) {
    throw new Error('Synthetic seed fixture must contain actors and exactly three offered courses')
  }
  if (scenarioProfile !== 'fisi-schools' && fisiConfig !== undefined) throw new Error('FISI configuration requires the fisi-schools profile')
  if (scenarioProfile === 'fisi-schools') {
    const fisiLoad = createFisiLoadProfile(actorCount, fisiConfig ?? DEFAULT_FISI_CONFIG, templateActors[0]!, templateOffer)
    return {
      actorCount,
      scenarioProfile,
      contention: 'shared',
      offer: fisiLoad.offer,
      actors: fisiLoad.actors,
      actorSelections: fisiLoad.actorSelections,
      auxiliaryActors: [],
      expectedAccepted: fisiLoad.expectedAccepted,
      expectedRejected: actorCount - fisiLoad.expectedAccepted,
      initialEnrollments: 0,
      initialRequests: 0,
      fisi: fisiLoad.fisi,
    }
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

import type { ActorProfile } from '../src/matricula-regular/profile.types.js'
import type { Choice, SyntheticLoadProfile } from './synthetic-load-profile.js'

// Pure planning for the submit-bench experiment variants (E2 cohorts, E7 catalog, E11 replays).
// Every function returns a new load profile or plan; the input profile is never mutated.

const splitSizes = (total: number, parts: number) => Array.from({ length: parts }, (_, index) => Math.floor(total / parts) + (index < total % parts ? 1 : 0))
const selectionFor = (offer: SyntheticLoadProfile['offer'], sectionIds: string[]): Choice[] => offer.map((course, index) => ({ courseId: course.courseId, sectionId: sectionIds[index]! }))

/** E2: split a `shared` profile into n cohorts, each on its own disjoint sections. 1 returns the profile unchanged. */
export function planCohorts(load: SyntheticLoadProfile, cohorts: number): SyntheticLoadProfile {
  if (cohorts === 1) return load
  if (load.scenarioProfile !== 'shared') throw new Error('cohorts above 1 require the shared profile')
  if (!Number.isSafeInteger(cohorts) || cohorts < 1 || cohorts > load.actorCount) throw new Error('cohorts must be an integer from 1 to the actor count')
  const sizes = splitSizes(load.actorCount, cohorts)
  const offer = structuredClone(load.offer)
  offer.forEach((course, courseIndex) => {
    const base = course.sections[0]!
    course.sections = sizes.map((size, cohort) => ({
      ...structuredClone(base),
      sectionId: `${base.sectionId}-C${cohort + 1}`,
      // The hot course keeps the shared capacity per cohort; the others always fit their cohort.
      capacity: courseIndex === 0 ? base.capacity : size,
      occupied: 0,
    }))
  })
  const actorSelections = new Map<string, Choice[]>()
  load.actors.forEach((actor, index) => {
    const cohort = index % cohorts
    actorSelections.set(actor.actorId, selectionFor(offer, offer.map((course) => course.sections[cohort]!.sectionId)))
  })
  const hotCapacity = offer[0]!.sections[0]!.capacity
  const expectedAccepted = sizes.reduce((total, size) => total + Math.min(size, hotCapacity), 0)
  return { ...load, offer, actorSelections, expectedAccepted, expectedRejected: load.actorCount - expectedAccepted }
}

/** E7: a catalog of n sections per course for a `distributed` profile; actors spread round-robin. Capacity fits the demand. */
export function planCatalog(load: SyntheticLoadProfile, catalogSections: number): SyntheticLoadProfile {
  if (load.scenarioProfile !== 'distributed') throw new Error('catalog-sections requires the distributed profile')
  if (!Number.isSafeInteger(catalogSections) || catalogSections < 1) throw new Error('catalog-sections must be a positive integer')
  const capacity = Math.ceil(load.actorCount / catalogSections)
  const offer = structuredClone(load.offer)
  for (const course of offer) {
    const base = course.sections[0]!
    course.sections = Array.from({ length: catalogSections }, (_, index) => ({
      ...structuredClone(base),
      sectionId: `${course.courseId}-CAT${index + 1}`,
      label: String(index + 1),
      capacity,
      occupied: 0,
    }))
  }
  const actorSelections = new Map<string, Choice[]>()
  load.actors.forEach((actor: ActorProfile, index) => {
    const section = index % catalogSections
    actorSelections.set(actor.actorId, selectionFor(offer, offer.map((course) => course.sections[section]!.sectionId)))
  })
  return { ...load, offer, actorSelections, expectedAccepted: load.actorCount, expectedRejected: 0 }
}

/** E11: indexes (0-based, evenly spread) of the submits that replay an already-processed request. Exact integer arithmetic. */
export function replayIndexes(total: number, ratio: number): Set<number> {
  const scaled = Math.round(ratio * 1_000_000)
  const indexes = new Set<number>()
  for (let index = 0; index < total; index += 1) {
    if (Math.floor(((index + 1) * scaled) / 1_000_000) > Math.floor((index * scaled) / 1_000_000)) indexes.add(index)
  }
  return indexes
}

export type VariantOptions = { cohorts: number; catalogSections?: number }

export function applyVariants(load: SyntheticLoadProfile, options: VariantOptions): SyntheticLoadProfile {
  const cohorted = planCohorts(load, options.cohorts)
  return options.catalogSections === undefined ? cohorted : planCatalog(cohorted, options.catalogSections)
}

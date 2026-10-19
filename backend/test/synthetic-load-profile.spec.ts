import { describe, expect, it } from 'vitest'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import {
  capacityManifest,
  createSyntheticLoadProfile,
  parseActorCount,
  resolveScenarioProfile,
} from '../scripts/synthetic-load-profile.js'

const fixture = createSyntheticFixture('SISTEMAS')

describe('synthetic simulator load profiles', () => {
  it('keeps the legacy defaults and supports bounded actor counts', () => {
    expect(parseActorCount(undefined)).toBe(100)
    expect(parseActorCount('1')).toBe(1)
    expect(parseActorCount('1000')).toBe(1000)
    expect(resolveScenarioProfile(undefined, undefined)).toEqual({ scenarioProfile: 'shared', contention: 'shared' })
    expect(resolveScenarioProfile(undefined, 'distributed')).toEqual({ scenarioProfile: 'distributed', contention: 'distributed' })
    expect(resolveScenarioProfile('ample', 'distributed')).toEqual({ scenarioProfile: 'ample', contention: 'shared' })
  })

  it.each(['0', '1001', '-1', '1.5', 'abc', ''])('rejects actor count %j before a seed can be built', (value) => {
    expect(() => parseActorCount(value)).toThrow('SIMULATOR_ACTOR_COUNT')
  })

  it('rejects unknown profiles and contention values', () => {
    expect(() => resolveScenarioProfile('unknown', 'shared')).toThrow('SIMULATOR_SCENARIO_PROFILE')
    expect(() => resolveScenarioProfile('shared', 'invalid')).toThrow('SIMULATOR_CONTENTION')
  })

  it('constructs shared, ample and last-seat capacity expectations', () => {
    const shared = createSyntheticLoadProfile(400, 'shared', fixture.actors, fixture.offer)
    const ample = createSyntheticLoadProfile(400, 'ample', fixture.actors, fixture.offer)
    const lastSeat = createSyntheticLoadProfile(400, 'last-seat', fixture.actors, fixture.offer)

    expect(shared.expectedAccepted).toBe(10)
    expect(shared.expectedRejected).toBe(390)
    expect(shared.actors).toHaveLength(400)
    expect(shared.selection).toHaveLength(3)
    expect(ample.expectedAccepted).toBe(400)
    expect(ample.offer.map((course) => course.sections[0]!.capacity)).toEqual([400, 400, 400])
    expect(lastSeat.expectedAccepted).toBe(1)
    expect(lastSeat.expectedRejected).toBe(399)
    expect(lastSeat.auxiliaryActors).toHaveLength(9)
    expect(lastSeat.initialEnrollments).toBe(9)
    expect(lastSeat.initialRequests).toBe(9)
    const smallLastSeat = createSyntheticLoadProfile(1, 'last-seat', fixture.actors, fixture.offer)
    expect(smallLastSeat.offer.map(course => course.sections[0]!.capacity)).toEqual([10, 10, 10])
    expect(smallLastSeat.expectedAccepted).toBe(1)
  })

  it('selects each group consistently and calculates both 400-actor multi profiles', () => {
    const uniform = createSyntheticLoadProfile(400, 'multi-uniform', fixture.actors, fixture.offer)
    const hotspot = createSyntheticLoadProfile(400, 'multi-hotspot', fixture.actors, fixture.offer)
    const groupCounts = (profile: typeof uniform) => {
      const counts = new Map<number, number>()
      for (const choices of profile.actorSelections.values()) {
        const group = profile.offer[0]!.sections.findIndex((section) => section.sectionId === choices[0]!.sectionId)
        counts.set(group, (counts.get(group) ?? 0) + 1)
        expect(choices).toEqual(profile.offer.map((course) => ({
          courseId: course.courseId,
          sectionId: course.sections[group]!.sectionId,
        })))
      }
      return [...counts.values()]
    }

    expect(uniform.expectedAccepted).toBe(100)
    expect(uniform.offer[0]!.sections.map(section => section.label)).toEqual(['1', '2', '3', '4', '5'])
    expect(groupCounts(uniform)).toEqual([80, 80, 80, 80, 80])
    expect(hotspot.expectedAccepted).toBe(100)
    expect(groupCounts(hotspot)).toEqual([320, 20, 20, 20, 20])
    expect(hotspot.actorSelections.get('SYN-SIS-U0001')?.map((choice) => choice.sectionId)).toEqual(
      hotspot.offer.map((course) => course.sections[0]!.sectionId),
    )
    expect(capacityManifest(uniform.offer).filter((section) => section.courseId === uniform.offer[0]!.courseId).map(({ capacity }) => capacity)).toEqual([20, 20, 20, 20, 20])
    expect(capacityManifest(uniform.offer).filter((section) => section.courseId !== uniform.offer[0]!.courseId).every(({ capacity }) => capacity === 400)).toBe(true)
  })

  it('preserves the distributed legacy shape with unique one-seat selections', () => {
    const distributed = createSyntheticLoadProfile(100, 'distributed', fixture.actors, fixture.offer)
    expect(distributed.contention).toBe('distributed')
    expect(distributed.expectedAccepted).toBe(100)
    expect(distributed.offer.every((course) => course.sections.length === 100)).toBe(true)
    expect(distributed.actorSelections.get('SYN-SIS-U0001')).toHaveLength(3)
  })

  it('rejects invalid profile bounds and malformed templates', () => {
    expect(() => createSyntheticLoadProfile(0, 'shared', fixture.actors, fixture.offer)).toThrow('actorCount')
    expect(() => createSyntheticLoadProfile(1001, 'shared', fixture.actors, fixture.offer)).toThrow('actorCount')
    expect(() => createSyntheticLoadProfile(100, 'shared', fixture.actors, fixture.offer.slice(0, 2))).toThrow('exactly three')
  })
})

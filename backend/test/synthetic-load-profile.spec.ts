import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import {
  capacityManifest,
  createSyntheticLoadProfile,
  parseActorCount,
  parseFisiConfig,
  resolveScenarioProfile,
} from '../scripts/synthetic-load-profile.js'

const fixture = createSyntheticFixture('SISTEMAS')

describe('synthetic simulator load profiles', () => {
  it('keeps the legacy defaults and supports bounded actor counts', () => {
    expect(parseActorCount(undefined)).toBe(100)
    expect(parseActorCount('1')).toBe(1)
    expect(parseActorCount('1000')).toBe(1000)
    expect(parseActorCount('1422')).toBe(1422)
    expect(parseActorCount('2000')).toBe(2000)
    expect(resolveScenarioProfile(undefined, undefined)).toEqual({ scenarioProfile: 'shared', contention: 'shared' })
    expect(resolveScenarioProfile(undefined, 'distributed')).toEqual({ scenarioProfile: 'distributed', contention: 'distributed' })
    expect(resolveScenarioProfile('ample', 'distributed')).toEqual({ scenarioProfile: 'ample', contention: 'shared' })
  })

  it.each(['0', '2001', '-1', '1.5', 'abc', ''])('rejects actor count %j before a seed can be built', (value) => {
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
    expect(() => createSyntheticLoadProfile(2001, 'shared', fixture.actors, fixture.offer)).toThrow('actorCount')
    expect(() => createSyntheticLoadProfile(100, 'shared', fixture.actors, fixture.offer.slice(0, 2))).toThrow('exactly three')
  })
})

// Output of every pre-existing profile before the fisi-schools change (sha256 of the canonical JSON of the
// full result, Maps as arrays, plus capacityManifest). Any difference means a legacy manifest input changed.
const LEGACY_HASHES: Record<string, string> = {
  'shared:100': '8eb21eab860a7be7fe441be821a097af7b038dce70d583c7e7c7120977166d12',
  'shared:400': '09150ba0276d3897b88d9b5f50a7fef1e9e2ded54a04920d8d0b7f18240ba3a9',
  'ample:100': 'c100f1bf555cb3b54aa4a52039af20dcc01d9d0169df5d288696490e710c7571',
  'ample:400': 'd93c64deff5901b04e43a2911bed1e7dd539c83579196c3db968c796318142f7',
  'last-seat:100': 'fdae6a6620c57e9bec53ce60e083b42ab1aa74a9064b99432809e275d413c448',
  'last-seat:400': 'de4bb9e0ad99d78a40262e1f803d1432f487e4af7c651d200bcc25f3633a276c',
  'multi-uniform:100': '41cbf6d8b9d4dd0bf136d25173b12fc0659e33778686f47eeb1a8158ef922c9c',
  'multi-uniform:400': '56e98aac5684c4700468e44d4f3ac640b39862f86cc8c8e6c3b96f1c01e350d6',
  'multi-hotspot:100': '1127ea4870251243259e5e1a7cb25e058d964155c2b3728bfc4e252840f626c8',
  'multi-hotspot:400': '78b3c6b3594ccdbe7f3cf51ca225dad65934b68d01213e5fdc489c6cbb63a977',
  'distributed:100': '8a9334f6d2bf59fef9513c4f9c32b426ab397e15cd9b26c42b1db77a91176327',
  'distributed:400': '84d3ca0c43b86801a0a041b8d39fe5a436ff1382b59f98269d22c1e849940ed5',
}

describe('legacy profile regression', () => {
  it.each(Object.keys(LEGACY_HASHES))('keeps %s byte-identical', (key) => {
    const [profile, count] = key.split(':') as [Parameters<typeof createSyntheticLoadProfile>[1], string]
    const result = createSyntheticLoadProfile(Number(count), profile, fixture.actors, fixture.offer)
    const serialized = JSON.stringify({ ...result, actorSelections: [...result.actorSelections], capacityManifest: capacityManifest(result.offer) })
    expect(createHash('sha256').update(serialized).digest('hex')).toBe(LEGACY_HASHES[key])
    expect(result.fisi).toBeUndefined()
  })
})

describe('fisi-schools profile', () => {
  const build = (actorCount: number, env: Record<string, string> = {}) => {
    const config = parseFisiConfig(env, 'fisi-schools', actorCount)
    return createSyntheticLoadProfile(actorCount, 'fisi-schools', fixture.actors, fixture.offer, config)
  }
  const sizes = (profile: ReturnType<typeof build>) => profile.fisi!.cohorts.map((cohort) => cohort.size)

  it('accepts the resolver and the actor-count boundaries', () => {
    expect(resolveScenarioProfile('fisi-schools', undefined)).toEqual({ scenarioProfile: 'fisi-schools', contention: 'shared' })
    for (const count of [1, 1000, 1422, 2000]) expect(createSyntheticLoadProfile(count, 'ample', fixture.actors, fixture.offer).actors).toHaveLength(count)
    expect(() => createSyntheticLoadProfile(2001, 'ample', fixture.actors, fixture.offer)).toThrow('actorCount')
    expect(() => createSyntheticLoadProfile(0, 'ample', fixture.actors, fixture.offer)).toThrow('actorCount')
  })

  it('reproduces the franja 4 worked examples', () => {
    expect(sizes(build(507))).toEqual([286, 203, 18])
    expect(sizes(build(400))).toEqual([226, 160, 14])
    const ample = build(507)
    expect(ample.expectedAccepted).toBe(507)
    expect(ample.expectedRejected).toBe(0)
    const scarce = build(507, { SIMULATOR_FISI_CAPACITY: 'scarce' })
    expect(scarce.fisi!.cohorts.map((cohort) => cohort.capacity)).toEqual([143, 101, 9])
    expect(scarce.expectedAccepted).toBe(253)
    expect(scarce.expectedRejected).toBe(254)
    expect(scarce.initialEnrollments).toBe(0)
    expect(scarce.initialRequests).toBe(0)
    expect(scarce.fisi!.hotCohortSize).toBe(286)
    expect(scarce.fisi!.waves).toBeUndefined()
    expect(scarce.fisi!.actorMeta.get('SYN-SIS-U0001')).toEqual({ cohort: 'SIS' })
  })

  it('applies scarce capacity to course 1 only, with exact integer flooring', () => {
    const scarce = build(507, { SIMULATOR_FISI_CAPACITY: 'scarce', SIMULATOR_FISI_SCARCE_RATIO: '0.29' })
    expect(scarce.fisi!.cohorts.map((cohort) => cohort.capacity)).toEqual([82, 58, 5])
    const manifest = capacityManifest(scarce.offer)
    const first = scarce.offer[0]!.courseId
    expect(manifest.filter((row) => row.courseId === first).map((row) => row.capacity)).toEqual([82, 58, 5])
    expect(manifest.filter((row) => row.courseId !== first).map((row) => row.capacity)).toEqual([286, 203, 18, 286, 203, 18])
    expect(build(1, { SIMULATOR_FISI_CAPACITY: 'scarce', SIMULATOR_FISI_SCARCE_RATIO: '.1' }).fisi!.cohorts[0]!.capacity).toBe(1)
  })

  it('reproduces the full journey table with wave sizes and the largest cohort', () => {
    const jornada = build(1422, { SIMULATOR_FISI_FRANJA: 'jornada' })
    expect(jornada.fisi!.waves!.map((wave) => wave.size)).toEqual([24, 113, 293, 507, 313, 117, 31, 13, 11])
    expect(jornada.fisi!.waves!.map((wave) => wave.ppFrom)).toEqual([17, 16, 15, 14, 13, 12, 11, 10, 0])
    expect(sizes(jornada)).toEqual([804, 541, 77])
    expect(jornada.fisi!.hotCohortSize).toBe(286)
    expect(jornada.actors).toHaveLength(1422)
    const perCell = new Map<string, number>()
    for (const meta of jornada.fisi!.actorMeta.values()) perCell.set(`${meta.wave}:${meta.cohort}`, (perCell.get(`${meta.wave}:${meta.cohort}`) ?? 0) + 1)
    expect(perCell.get('1:SIS')).toBe(16)
    expect(perCell.get('4:SIS')).toBe(286)
    expect(perCell.get('9:CC')).toBe(3)
    expect(jornada.fisi!.actorMeta.get('SYN-SIS-U0001')).toEqual({ cohort: 'SIS', wave: 1 })
    expect(jornada.fisi!.actorMeta.get('SYN-SIS-U0017')).toEqual({ cohort: 'SOFT', wave: 1 })
    expect(jornada.fisi!.actorMeta.get('SYN-SIS-U0024')).toEqual({ cohort: 'CC', wave: 1 })
    expect(jornada.fisi!.actorMeta.get('SYN-SIS-U0025')).toEqual({ cohort: 'SIS', wave: 2 })
    expect(jornada.expectedAccepted).toBe(1422)
  })

  it('spreads IA actors over the nine waves by the Total column', () => {
    const jornada = build(1482, { SIMULATOR_FISI_FRANJA: 'jornada', SIMULATOR_FISI_IA_ACTORS: '60' })
    const waves = jornada.fisi!.waves!
    expect(waves.reduce((sum, wave) => sum + wave.size, 0)).toBe(1482)
    expect(jornada.fisi!.cohorts.map((cohort) => cohort.cohort)).toEqual(['SIS', 'SOFT', 'CC', 'IA'])
    expect(jornada.fisi!.cohorts[3]!.size).toBe(60)
    const franja = build(60 + 507, { SIMULATOR_FISI_IA_ACTORS: '60' })
    expect(sizes(franja)).toEqual([286, 203, 18, 60])
    expect(franja.fisi!.actorMeta.get('SYN-SIS-U0567')).toEqual({ cohort: 'IA' })
    const onlyIa = build(5, { SIMULATOR_FISI_IA_ACTORS: '5' })
    expect(onlyIa.fisi!.cohorts.map((cohort) => cohort.cohort)).toEqual(['IA'])
    expect(onlyIa.offer.every((course) => course.sections.length === 1)).toBe(true)
  })

  it('gives each non-empty cohort its own disjoint section group and shared selection', () => {
    const profile = build(1482, { SIMULATOR_FISI_FRANJA: 'jornada', SIMULATOR_FISI_IA_ACTORS: '60' })
    const seen = new Set<string>()
    for (const cohort of profile.fisi!.cohorts) {
      expect(cohort.sectionIds).toHaveLength(3)
      expect(cohort.sectionIds).toEqual(profile.offer.map((course) => `${course.courseId}-FISI-${cohort.cohort}`))
      for (const id of cohort.sectionIds) { expect(seen.has(id)).toBe(false); seen.add(id) }
    }
    const byCohort = new Set<string>()
    for (const actor of profile.actors) {
      const cohort = profile.fisi!.actorMeta.get(actor.actorId)!.cohort
      const selection = profile.actorSelections.get(actor.actorId)!
      expect(selection.map((choice) => choice.sectionId)).toEqual(profile.fisi!.cohorts.find((item) => item.cohort === cohort)!.sectionIds)
      byCohort.add(cohort)
      expect(actor.scope).toEqual(fixture.actors[0]!.scope)
    }
    expect(byCohort.size).toBe(4)
    expect(profile.selection).toBeUndefined()
    expect(profile.offer.every((course) => course.sections.every((section) => section.occupied === 0))).toBe(true)
  })

  it('validates the FISI configuration', () => {
    expect(() => parseFisiConfig({ SIMULATOR_FISI_FRANJA: '4' }, 'shared', 100)).toThrow('SIMULATOR_FISI_FRANJA')
    expect(() => parseFisiConfig({ SIMULATOR_FISI_IA_ACTORS: '0' }, 'ample', 100)).toThrow('fisi-schools')
    expect(parseFisiConfig({}, 'shared', 100)).toBeUndefined()
    expect(parseFisiConfig({}, 'fisi-schools', 100)).toEqual({ mode: 'franja', franja: 4, iaActors: 0, capacityMode: 'ample' })
    expect(() => parseFisiConfig({ SIMULATOR_FISI_SCARCE_RATIO: '0.5' }, 'fisi-schools', 100)).toThrow('scarce')
    expect(() => parseFisiConfig({ SIMULATOR_FISI_CAPACITY: 'ample', SIMULATOR_FISI_SCARCE_RATIO: '0.5' }, 'fisi-schools', 100)).toThrow('scarce')
    for (const franja of ['10', '0', '', 'Jornada', '1.5']) expect(() => parseFisiConfig({ SIMULATOR_FISI_FRANJA: franja }, 'fisi-schools', 100)).toThrow('SIMULATOR_FISI_FRANJA')
    expect(() => parseFisiConfig({ SIMULATOR_FISI_IA_ACTORS: '101' }, 'fisi-schools', 100)).toThrow('SIMULATOR_FISI_IA_ACTORS')
    expect(() => parseFisiConfig({ SIMULATOR_FISI_IA_ACTORS: '-1' }, 'fisi-schools', 100)).toThrow('SIMULATOR_FISI_IA_ACTORS')
    expect(() => parseFisiConfig({ SIMULATOR_FISI_CAPACITY: 'tight' }, 'fisi-schools', 100)).toThrow('SIMULATOR_FISI_CAPACITY')
    for (const ratio of ['0', '1', '0.0', '1.0', '1.5', '-0.5', 'abc', '0.1234567']) {
      expect(() => parseFisiConfig({ SIMULATOR_FISI_CAPACITY: 'scarce', SIMULATOR_FISI_SCARCE_RATIO: ratio }, 'fisi-schools', 100)).toThrow('SIMULATOR_FISI_SCARCE_RATIO')
    }
    expect(parseFisiConfig({ SIMULATOR_FISI_CAPACITY: 'scarce' }, 'fisi-schools', 100)).toMatchObject({ scarceRatio: 0.5 })
    expect(parseFisiConfig({ SIMULATOR_FISI_FRANJA: 'jornada' }, 'fisi-schools', 100)).toEqual({ mode: 'jornada', iaActors: 0, capacityMode: 'ample' })
    expect(() => createSyntheticLoadProfile(100, 'shared', fixture.actors, fixture.offer, { mode: 'franja', franja: 4, iaActors: 0, capacityMode: 'ample' })).toThrow('fisi-schools')
  })
})

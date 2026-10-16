import { describe, expect, it } from 'vitest'
import { createSyntheticAcademicDemoFixture } from '../src/matricula-regular/academic-demo.fixtures.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { validateSyntheticAcademicRecord } from '../src/matricula-regular/academic-demo.validation.js'
import type { School } from '../src/matricula-regular/profile.types.js'

describe('PS-1 synthetic academic demo fixtures', () => {
  it('builds sixteen local courses and valid attempts for the four existing actors', () => {
    const fixtures = (['SISTEMAS', 'SOFTWARE'] as School[]).map(createSyntheticAcademicDemoFixture)
    const actors = fixtures.flatMap(({ actors: fixtureActors }) => fixtureActors)

    expect(actors.map(({ actorId }) => actorId)).toEqual([
      'SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B',
    ])
    for (const fixture of fixtures) {
      expect(fixture.actors).toHaveLength(2)
      expect(fixture.offer).toEqual(createSyntheticFixture(fixture.profile.scope.schoolId as School).offer)
      for (const actor of fixture.actors) {
        const baseActor = createSyntheticFixture(fixture.profile.scope.schoolId as School)
          .actors.find(({ actorId }) => actorId === actor.actorId)!
        const actorWithoutLedger = structuredClone(actor)
        delete actorWithoutLedger.academic
        expect(actorWithoutLedger).toEqual(baseActor)
        expect(actor.academic?.seedRevision).toBe('PS-SEED-1')
        expect(actor.academic?.catalog).toHaveLength(16)
        expect(actor.academic?.catalog.every(({ credits }) => credits === 4)).toBe(true)
        expect(actor.academic?.catalog.filter(({ courseType }) => courseType === 'elective')).toHaveLength(2)
        expect(actor.academic?.attempts).toHaveLength(actor.actorId.endsWith('-A') ? 8 : 9)
        expect(actor.profileRevision).toBe(baseActor.profileRevision)
        expect(actor.scope).toEqual(fixture.profile.scope)
        expect(() => validateSyntheticAcademicRecord(actor, actor.academic)).not.toThrow()
      }
    }
  })

  it('preserves minimal enrollment fixtures for non-dashboard callers', () => {
    for (const school of ['SISTEMAS', 'SOFTWARE'] as School[]) {
      const fixture = createSyntheticFixture(school)
      expect(fixture.actors.every((actor) => actor.academic === undefined)).toBe(true)
      expect(fixture.actors.map((actor) => actor.preEnrollment.map(({ courseId }) => courseId))).toEqual([
        [`SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-C1`, `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-C2`, `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-C3`],
        [`SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-C1`, `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-C2`, `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-C3`],
      ])
    }
  })

  it('rejects duplicate courses, cross-school references, invalid grades, and missing outcomes', () => {
    const actor = createSyntheticAcademicDemoFixture('SISTEMAS').actors[0]!
    const record = actor.academic!

    const duplicate = structuredClone(record)
    duplicate.catalog[1]!.courseId = duplicate.catalog[0]!.courseId
    expect(() => validateSyntheticAcademicRecord(actor, duplicate)).toThrow(/academic\.catalog\.1\.courseId/)

    const crossSchool = structuredClone(record)
    crossSchool.attempts[0]!.courseId = 'SYN-SOFT-C01'
    expect(() => validateSyntheticAcademicRecord(actor, crossSchool)).toThrow(/academic\.attempts\.0\.courseId/)

    const invalidGrade = structuredClone(record)
    invalidGrade.attempts[0]!.grade = 21
    expect(() => validateSyntheticAcademicRecord(actor, invalidGrade)).toThrow(/academic\.attempts\.0\.grade/)

    const missingOutcome = structuredClone(record)
    delete (missingOutcome.attempts[0] as Partial<typeof missingOutcome.attempts[number]>).result
    expect(() => validateSyntheticAcademicRecord(actor, missingOutcome)).toThrow(/academic\.attempts\.0\.result/)
  })
})

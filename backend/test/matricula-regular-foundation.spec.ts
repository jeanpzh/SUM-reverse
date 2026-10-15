import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import {
  validateContext,
  validateScope,
  validateSource,
} from '../../shared/matricula-regular.mjs'
import type { MatriculaRegularContext } from '../../shared/matricula-regular.mjs'
import { createSyntheticClock } from '../src/matricula-regular/clock.js'
import {
  cloneActorFixture,
  createSyntheticActorFixture,
  createSyntheticFixture,
} from '../src/matricula-regular/fixtures.js'
import {
  createDocumentaryProfile,
  createProfileCatalog,
  createSyntheticProfile,
} from '../src/matricula-regular/profiles.js'
import { MATRICULA_REGULAR_CLOCK } from '../src/matricula-regular/matricula-regular.module.js'
import { evaluateContextEligibility } from '../src/matricula-regular/windows.js'
import type { ActorProfile, School, SyntheticFixture } from '../src/matricula-regular/profile.types.js'
import { createMatriculaRegularTestApp, type MatriculaRegularTestApp } from './matricula-regular-test-app.js'

let testApp: MatriculaRegularTestApp

beforeEach(async () => {
  testApp = await createMatriculaRegularTestApp(createSyntheticClock())
})

afterEach(async () => {
  await testApp.close()
})

function contextFor(
  fixture: SyntheticFixture,
  actor: ActorProfile,
  now: Date,
  profiles: ReturnType<typeof createProfileCatalog> = [fixture.profile],
): MatriculaRegularContext {
  return {
    actorId: actor.actorId,
    scope: structuredClone(actor.scope),
    profileRevision: actor.profileRevision,
    serverNow: now.toISOString(),
    preEnrollmentEnabled: actor.preEnrollmentEnabled,
    preEnrollmentComplete: actor.preEnrollmentComplete,
    preEnrollment: structuredClone(actor.preEnrollment),
    offerKnown: actor.offerKnown,
    offer: structuredClone(fixture.offer),
    calendar: structuredClone(fixture.profile.calendar),
    eligibility: evaluateContextEligibility(profiles, actor, now),
    sources: structuredClone(fixture.profile.sources),
  }
}

describe('T012 foundation: synthetic profile factories and clock', () => {
  it('creates independent school fixtures and deep-clones actors', () => {
    const systems = createSyntheticFixture('SISTEMAS')
    const software = createSyntheticFixture('SOFTWARE')

    expect(systems.profile.scope.schoolId).toBe('SISTEMAS')
    expect(software.profile.scope.schoolId).toBe('SOFTWARE')
    expect(systems.profile.scope.planId).not.toBe(software.profile.scope.planId)
    expect(systems.actors.map((actor) => actor.actorId)).toEqual(['SYN-SIS-A', 'SYN-SIS-B'])
    expect(software.actors.map((actor) => actor.actorId)).toEqual(['SYN-SOFT-A', 'SYN-SOFT-B'])
    expect(systems.profile.calendar.publishedRows).toHaveLength(9)
    expect(systems.profile.calendar.unknownDates).toEqual(['2026-08-11', '2026-08-12'])

    const actor = createSyntheticActorFixture('SISTEMAS', 'A')
    const clonedActor = cloneActorFixture(actor)
    clonedActor.scope.schoolId = 'SOFTWARE'
    clonedActor.rules[0]!.sourceIds.push('SYN-CLONE-ONLY')
    expect(actor.scope.schoolId).toBe('SISTEMAS')
    expect(actor.rules[0]!.sourceIds).not.toContain('SYN-CLONE-ONLY')

    systems.profile.calendar.effectiveWindows[0]!.startsAt = '2000-01-01T00:00:00.000Z'
    systems.actors[0]!.scope.schoolId = 'SOFTWARE'
    systems.offer[0]!.sections[0]!.occupied = 1
    const fresh = createSyntheticFixture('SISTEMAS')
    expect(fresh.profile.calendar.effectiveWindows[0]!.startsAt).toBe('2026-08-11T14:00:00.000Z')
    expect(fresh.actors[0]!.scope.schoolId).toBe('SISTEMAS')
    expect(fresh.offer[0]!.sections[0]!.occupied).toBe(0)
  })

  it('injects an explicit synthetic clock into the isolated test module', () => {
    const injectedClock = testApp.app.get(MATRICULA_REGULAR_CLOCK)
    expect(injectedClock.now().toISOString()).toBe('2026-08-11T15:00:00.000Z')
    expect(testApp.clock).toBe(injectedClock)
  })
})

describe('T012 foundation: shared MR-CONTRACT-2 runtime boundaries', () => {
  it('accepts exact scope and source shapes and rejects extra or invalid values without echoing them', () => {
    const profile = createSyntheticProfile('SISTEMAS')
    expect(() => validateScope(profile.scope)).not.toThrow()
    for (const source of profile.sources) expect(() => validateSource(source)).not.toThrow()

    expect(() => validateScope({ ...profile.scope, extra: 'SYN-EXTRA-SENTINEL' })).toThrow()
    expect(() => validateScope({ ...profile.scope, planId: 'INVALID-ID-SENTINEL' })).toThrow()
    expect(() => validateScope({ ...profile.scope, period: '2026-III' })).toThrow()

    const badDate = { ...profile.sources[0]!, date: '2026-02-30' }
    let message = ''
    try {
      validateSource(badDate)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('source.date')
    expect(message).not.toContain('2026-02-30')

    const badProvenance = { ...profile.sources[0]!, class: null }
    expect(() => validateSource(badProvenance)).toThrow()
  })

  it('validates complete Context and rejects extra, malformed ID, impossible instant, and null without a gap', () => {
    const fixture = createSyntheticFixture('SISTEMAS')
    const actor = fixture.actors[0]!
    const now = new Date('2026-08-11T15:00:00.000Z')
    const context = contextFor(fixture, actor, now)

    expect(() => validateContext(context)).not.toThrow()
    expect(context).not.toHaveProperty('selection')
    expect(() => validateContext({ ...context, selection: [] })).toThrow()

    let invalidIdMessage = ''
    try {
      validateContext({ ...context, actorId: 'ACTOR-PRIVATE-SENTINEL' })
    } catch (error) {
      invalidIdMessage = error instanceof Error ? error.message : String(error)
    }
    expect(invalidIdMessage).toContain('context.actorId')
    expect(invalidIdMessage).not.toContain('ACTOR-PRIVATE-SENTINEL')

    let invalidInstantMessage = ''
    try {
      validateContext({ ...context, serverNow: '2026-02-30T15:00:00.000Z' })
    } catch (error) {
      invalidInstantMessage = error instanceof Error ? error.message : String(error)
    }
    expect(invalidInstantMessage).toContain('context.serverNow')
    expect(invalidInstantMessage).not.toContain('2026-02-30')

    const unknownActor = structuredClone(actor)
    unknownActor.preEnrollmentEnabled = null
    const unknownContext = contextFor(fixture, unknownActor, now)
    expect(unknownContext.eligibility.state).toBe('configuration-pending')
    expect(unknownContext.eligibility.gaps.map((item) => item.code)).toContain('PRE_ENROLLMENT_UNKNOWN')
    expect(() => validateContext(unknownContext)).not.toThrow()

    const missingGapContext = {
      ...unknownContext,
      eligibility: {
        ...unknownContext.eligibility,
        gaps: unknownContext.eligibility.gaps.filter((item) => item.code !== 'PRE_ENROLLMENT_UNKNOWN'),
      },
    }
    expect(() => validateContext(missingGapContext)).toThrow()
  })

  it('validates nested real dates and rejects malformed section dates without echoing input values', () => {
    const fixture = createSyntheticFixture('SOFTWARE')
    const actor = fixture.actors[0]!
    const context = contextFor(fixture, actor, new Date('2026-08-12T15:00:00.000Z'))
    const malformed = structuredClone(context)
    malformed.calendar.effectiveWindows[0]!.startsAt = '2026-02-30T15:00:00.000Z'

    let message = ''
    try {
      validateContext(malformed)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('context.calendar.effectiveWindows[0].startsAt')
    expect(message).not.toContain('2026-02-30')
  })
})

describe('T012 foundation: real T007 context eligibility evaluator', () => {
  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s synthetic windows preserve both dates and PP boundaries', (school: School) => {
    const fixture = createSyntheticFixture(school)
    const actor = fixture.actors[0]!

    for (const day of ['11', '12']) {
      for (const ponderado of [0, 16, 17, 20]) {
        actor.ponderado = ponderado
        const now = new Date(`2026-08-${day}T15:00:00.000Z`)
        const result = evaluateContextEligibility([fixture.profile], actor, now)
        expect(result.state).toBe('eligible')
        expect(result.windowOrigin).toBe('synthetic')
        expect(result.windowId).toBe(day === '11' ? 'SYN-WINDOW-1' : 'SYN-WINDOW-2')
        expect(result.causes).toEqual([])
        expect(result.gaps).toEqual([])
      }
    }

    expect(fixture.profile.calendar.unknownDates).toEqual(['2026-08-11', '2026-08-12'])
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s documentary profile keeps 11–12 unknown and does not fall back to synthetic access', (school: School) => {
    const documentary = createDocumentaryProfile(school)
    const actor = createSyntheticFixture(school).actors[0]!
    actor.profileRevision = documentary.profileRevision
    actor.ponderado = 17

    for (const day of ['11', '12']) {
      const result = evaluateContextEligibility([documentary], actor, new Date(`2026-08-${day}T15:00:00.000Z`))
      expect(result.state).toBe('configuration-pending')
      expect(result.windowOrigin).toBeNull()
      expect(result.gaps.map((item) => item.code)).toContain('WINDOW_UNSPECIFIED')
      expect(result.gaps.flatMap((item) => item.sourceIds)).toContain('F6')
    }

    const noMatchingSchoolProfile = evaluateContextEligibility(
      [createDocumentaryProfile(school === 'SISTEMAS' ? 'SOFTWARE' : 'SISTEMAS')],
      actor,
      new Date('2026-08-11T15:00:00.000Z'),
    )
    expect(noMatchingSchoolProfile.state).toBe('configuration-pending')
    expect(noMatchingSchoolProfile.gaps.map((item) => item.code)).toEqual(['PROFILE_MISSING'])
  })

  it('uses the published Monday band until Lima midnight and leaves Tuesday unknown', () => {
    const documentary = createDocumentaryProfile('SISTEMAS')
    const actor = createSyntheticFixture('SISTEMAS').actors[0]!
    actor.profileRevision = documentary.profileRevision

    for (const ponderado of [17, 20]) {
      actor.ponderado = ponderado
      const beforeMidnight = evaluateContextEligibility(
        [documentary], actor, new Date('2026-08-11T04:59:59.999Z'),
      )
      expect(beforeMidnight.state).toBe('eligible')
      expect(beforeMidnight.windowOrigin).toBe('published-derived')

      const limaMidnight = evaluateContextEligibility(
        [documentary], actor, new Date('2026-08-11T05:00:00.000Z'),
      )
      expect(limaMidnight.state).toBe('configuration-pending')
      expect(limaMidnight.gaps.map((item) => item.code)).toContain('WINDOW_UNSPECIFIED')
    }
  })

  it('keeps known causes alongside unknown gaps and evaluates access without a course selection', () => {
    const fixture = createSyntheticFixture('SISTEMAS')
    const actor = fixture.actors[0]!
    actor.preEnrollmentEnabled = false
    actor.institutional.health = 'unknown'
    fixture.offer[0]!.sections[0]!.occupied = fixture.offer[0]!.sections[0]!.capacity
    const result = evaluateContextEligibility(
      [fixture.profile], actor, new Date('2026-08-11T15:00:00.000Z'),
    )

    expect(result.state).toBe('configuration-pending')
    expect(result.causes.map((item) => item.code)).toContain('PRE_ENROLLMENT_NOT_ENABLED')
    expect(result.gaps.map((item) => item.code)).toContain('INSTITUTIONAL_REQUIREMENT_UNKNOWN')

    const emptySelectionContext = contextFor(
      fixture, actor, new Date('2026-08-11T15:00:00.000Z'),
    )
    expect(emptySelectionContext.eligibility.state).toBe('configuration-pending')
    expect(emptySelectionContext).not.toHaveProperty('selection')
    expect(() => validateContext(emptySelectionContext)).not.toThrow()

    actor.preEnrollmentEnabled = true
    actor.institutional.health = 'met'
    const accessWithoutSelection = evaluateContextEligibility(
      [fixture.profile], actor, new Date('2026-08-11T15:00:00.000Z'),
    )
    expect(accessWithoutSelection.state).toBe('eligible')
    expect(fixture.offer[0]!.sections[0]!.occupied).toBe(fixture.offer[0]!.sections[0]!.capacity)
  })

  it('does not evaluate not-applicable pre-enrollment or institutional rules', () => {
    const fixture = createSyntheticFixture('SISTEMAS')
    const actor = fixture.actors[0]!
    actor.preEnrollmentEnabled = false
    actor.rules.find(({ ruleId }) => ruleId === 'PRE-ENROLLMENT-ENABLED')!.knowledge = 'not-applicable'
    actor.institutional.debt = 'unmet'
    actor.institutional.health = 'unknown'
    actor.institutional.eligibility = 'unmet'
    actor.rules.find(({ ruleId }) => ruleId === 'INSTITUTIONAL-REQUIREMENTS')!.knowledge = 'not-applicable'

    const result = evaluateContextEligibility(
      [fixture.profile], actor, new Date('2026-08-11T15:00:00.000Z'),
    )

    expect(result.state).toBe('eligible')
    expect(result.causes).toEqual([])
    expect(result.gaps).toEqual([])
  })

  it('keeps explicit windows ineligible when known PP is below every minimum', () => {
    const fixture = createSyntheticFixture('SISTEMAS')
    const actor = fixture.actors[0]!
    actor.ponderado = 5
    fixture.profile.calendar.effectiveWindows.forEach((window) => { window.minPp = 10 })

    const result = evaluateContextEligibility(
      [fixture.profile], actor, new Date('2026-08-11T15:00:00.000Z'),
    )

    expect(result.state).toBe('ineligible')
    expect(result.causes.map(({ code }) => code)).toEqual(['OUTSIDE_WINDOW'])
    expect(result.windowId).toBeNull()
    expect(result.windowOrigin).toBeNull()
    expect(result.causes[0]!.sourceIds).toEqual(['L-02'])
  })

  it('uses PLAN-AND-OFFER sources for an incomplete pre-enrollment gap', () => {
    const fixture = createSyntheticFixture('SISTEMAS')
    const actor = fixture.actors[0]!
    actor.preEnrollmentComplete = false
    actor.rules = [
      { ruleId: 'PRE-ENROLLMENT-ENABLED', sourceIds: ['SYN-PRE-ENROLLMENT'], knowledge: 'known' },
      { ruleId: 'PLAN-AND-OFFER', sourceIds: ['SYN-PLAN-AND-OFFER'], knowledge: 'known' },
      ...actor.rules.filter(({ ruleId }) => !['PRE-ENROLLMENT-ENABLED', 'PLAN-AND-OFFER'].includes(ruleId)),
    ]

    const result = evaluateContextEligibility(
      [fixture.profile], actor, new Date('2026-08-11T15:00:00.000Z'),
    )
    const planGap = result.gaps.find(({ code }) => code === 'PLAN_OR_OFFER_UNKNOWN')

    expect(planGap?.sourceIds).toContain('SYN-PLAN-AND-OFFER')
    expect(planGap?.sourceIds).not.toContain('SYN-PRE-ENROLLMENT')
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)(
    '%s keeps PRE-ENROLLMENT unknown separate from a known disabled flag',
    (school: School) => {
      const fixture = createSyntheticFixture(school)
      const actor = fixture.actors[0]!
      actor.preEnrollmentEnabled = false
      const rule = actor.rules.find(({ ruleId }) => ruleId === 'PRE-ENROLLMENT-ENABLED')!
      rule.knowledge = 'unknown'

      const result = evaluateContextEligibility(
        [fixture.profile], actor, new Date('2026-08-11T15:00:00.000Z'),
      )

      expect(result.state).toBe('configuration-pending')
      expect(result.causes.map(({ code }) => code)).not.toContain('PRE_ENROLLMENT_NOT_ENABLED')
      expect(result.gaps.map(({ code }) => code)).toEqual(['PRE_ENROLLMENT_UNKNOWN'])
      expect(result.gaps[0]!.sourceIds).toEqual(rule.sourceIds)
      expect(result.gaps[0]!.sourceIds.length).toBeGreaterThan(0)
    },
  )

  it.each(['SISTEMAS', 'SOFTWARE'] as const)(
    '%s keeps unknown institutional rules pending while preserving independent known causes',
    (school: School) => {
      const fixture = createSyntheticFixture(school)
      const actor = fixture.actors[0]!
      const rule = actor.rules.find(({ ruleId }) => ruleId === 'INSTITUTIONAL-REQUIREMENTS')!
      rule.knowledge = 'unknown'
      actor.institutional.debt = 'unmet'
      actor.preEnrollmentEnabled = false

      const result = evaluateContextEligibility(
        [fixture.profile], actor, new Date('2026-08-11T15:00:00.000Z'),
      )

      expect(result.state).toBe('configuration-pending')
      expect(result.causes.map(({ code }) => code)).toEqual(['PRE_ENROLLMENT_NOT_ENABLED'])
      expect(result.gaps.map(({ code }) => code)).toEqual(['INSTITUTIONAL_REQUIREMENT_UNKNOWN'])
      expect(result.gaps[0]!.sourceIds).toEqual(rule.sourceIds)
      expect(result.gaps[0]!.sourceIds.length).toBeGreaterThan(0)
    },
  )

  it.each(['SISTEMAS', 'SOFTWARE'] as const)(
    '%s keeps PRE not-applicable independent from completeness and null facts',
    (school: School) => {
      const fixture = createSyntheticFixture(school)
      const actor = fixture.actors[0]!
      const rule = actor.rules.find(({ ruleId }) => ruleId === 'PRE-ENROLLMENT-ENABLED')!
      rule.knowledge = 'not-applicable'
      actor.preEnrollmentEnabled = false
      actor.preEnrollmentComplete = false

      const incomplete = evaluateContextEligibility(
        [fixture.profile], actor, new Date('2026-08-11T15:00:00.000Z'),
      )

      expect(incomplete.state).toBe('configuration-pending')
      expect(incomplete.causes.map(({ code }) => code)).not.toContain('PRE_ENROLLMENT_NOT_ENABLED')
      expect(incomplete.gaps.map(({ code }) => code)).toEqual(['PLAN_OR_OFFER_UNKNOWN'])
      const planRule = actor.rules.find(({ ruleId }) => ruleId === 'PLAN-AND-OFFER')!
      expect(incomplete.gaps[0]!.sourceIds).toEqual(planRule.sourceIds)
      expect(incomplete.gaps[0]!.sourceIds.length).toBeGreaterThan(0)

      actor.preEnrollmentEnabled = null
      actor.preEnrollmentComplete = true
      const nullFact = evaluateContextEligibility(
        [fixture.profile], actor, new Date('2026-08-11T15:00:00.000Z'),
      )

      expect(nullFact.state).toBe('configuration-pending')
      expect(nullFact.causes).toEqual([])
      expect(nullFact.gaps.map(({ code }) => code)).toEqual(['PRE_ENROLLMENT_UNKNOWN'])
      expect(nullFact.gaps[0]!.sourceIds).toEqual(rule.sourceIds)
      expect(nullFact.gaps[0]!.sourceIds.length).toBeGreaterThan(0)
    },
  )

  it.each(['SISTEMAS', 'SOFTWARE'] as const)(
    '%s reports an unknown PLAN-AND-OFFER rule even when flags are true',
    (school: School) => {
      const fixture = createSyntheticFixture(school)
      const actor = fixture.actors[0]!
      const rule = actor.rules.find(({ ruleId }) => ruleId === 'PLAN-AND-OFFER')!
      rule.knowledge = 'unknown'
      actor.planKnown = true
      actor.offerKnown = true

      const result = evaluateContextEligibility(
        [fixture.profile], actor, new Date('2026-08-11T15:00:00.000Z'),
      )

      expect(result.state).toBe('configuration-pending')
      expect(result.gaps.map(({ code }) => code)).toEqual(['PLAN_OR_OFFER_UNKNOWN'])
      expect(result.gaps[0]!.sourceIds).toEqual(rule.sourceIds)
      expect(result.gaps[0]!.sourceIds.length).toBeGreaterThan(0)
    },
  )

  it.each(['SISTEMAS', 'SOFTWARE'] as const)(
    '%s treats an absent PRE-ENROLLMENT rule as unknown for every flag value and keeps completeness independent',
    (school: School) => {
      const fixture = createSyntheticFixture(school)
      const actor = fixture.actors[0]!
      actor.rules = actor.rules.filter(({ ruleId }) => ruleId !== 'PRE-ENROLLMENT-ENABLED')
      const now = new Date('2026-08-11T15:00:00.000Z')

      for (const enabled of [true, false, null] as const) {
        actor.preEnrollmentEnabled = enabled
        actor.preEnrollmentComplete = true
        const complete = evaluateContextEligibility([fixture.profile], actor, now)

        expect(complete.state).toBe('configuration-pending')
        expect(complete.causes.map(({ code }) => code)).not.toContain('PRE_ENROLLMENT_NOT_ENABLED')
        expect(complete.gaps.map(({ code }) => code)).toEqual(['PRE_ENROLLMENT_UNKNOWN'])
        expect(complete.gaps[0]!.sourceIds).toEqual([])

        actor.preEnrollmentComplete = false
        const incomplete = evaluateContextEligibility([fixture.profile], actor, now)
        expect(incomplete.state).toBe('configuration-pending')
        expect(incomplete.gaps.map(({ code }) => code)).toEqual([
          'PLAN_OR_OFFER_UNKNOWN', 'PRE_ENROLLMENT_UNKNOWN',
        ])
      }
    },
  )

  it.each(['SISTEMAS', 'SOFTWARE'] as const)(
    '%s treats absent institutional rules as unknown for met and unmet facts while preserving independent causes',
    (school: School) => {
      const fixture = createSyntheticFixture(school)
      const actor = fixture.actors[0]!
      actor.rules = actor.rules.filter(({ ruleId }) => ruleId !== 'INSTITUTIONAL-REQUIREMENTS')
      actor.institutional = { debt: 'met', health: 'met', eligibility: 'met' }
      const now = new Date('2026-08-11T15:00:00.000Z')

      const met = evaluateContextEligibility([fixture.profile], actor, now)
      expect(met.state).toBe('configuration-pending')
      expect(met.causes).toEqual([])
      expect(met.gaps.map(({ code }) => code)).toEqual(['INSTITUTIONAL_REQUIREMENT_UNKNOWN'])
      expect(met.gaps[0]!.sourceIds).toEqual([])

      actor.institutional.debt = 'unmet'
      actor.preEnrollmentEnabled = false
      const unmet = evaluateContextEligibility([fixture.profile], actor, now)
      expect(unmet.state).toBe('configuration-pending')
      expect(unmet.causes.map(({ code }) => code)).toEqual(['PRE_ENROLLMENT_NOT_ENABLED'])
      expect(unmet.gaps.map(({ code }) => code)).toEqual(['INSTITUTIONAL_REQUIREMENT_UNKNOWN'])
      expect(unmet.gaps[0]!.sourceIds).toEqual([])
    },
  )

  it.each(['SISTEMAS', 'SOFTWARE'] as const)(
    '%s keeps absent PLAN-AND-OFFER pending even when plan and offer flags are true',
    (school: School) => {
      const fixture = createSyntheticFixture(school)
      const actor = fixture.actors[0]!
      actor.rules = actor.rules.filter(({ ruleId }) => ruleId !== 'PLAN-AND-OFFER')
      actor.preEnrollmentComplete = true

      for (const known of [true, false]) {
        actor.planKnown = known
        actor.offerKnown = known
        const result = evaluateContextEligibility(
          [fixture.profile], actor, new Date('2026-08-11T15:00:00.000Z'),
        )

        expect(result.state).toBe('configuration-pending')
        expect(result.causes).toEqual([])
        expect(result.gaps.map(({ code }) => code)).toEqual(['PLAN_OR_OFFER_UNKNOWN'])
        expect(result.gaps[0]!.sourceIds).toEqual([])
      }
    },
  )

  it.each(['SISTEMAS', 'SOFTWARE'] as const)(
    '%s composes Context over HTTP with pending gaps and no session or academic writes',
    async (school: School) => {
      const fixture = createSyntheticFixture(school)
      const actor = fixture.actors[0]!
      actor.preEnrollmentEnabled = false
      actor.rules.find(({ ruleId }) => ruleId === 'PRE-ENROLLMENT-ENABLED')!.knowledge = 'unknown'
      actor.institutional.debt = 'unmet'
      actor.rules.find(({ ruleId }) => ruleId === 'INSTITUTIONAL-REQUIREMENTS')!.knowledge = 'unknown'
      actor.preEnrollmentComplete = false
      actor.rules.find(({ ruleId }) => ruleId === 'PLAN-AND-OFFER')!.knowledge = 'unknown'
      await testApp.repository.enqueue((state) => {
        const stateActor = state.actors.find(({ actorId }) => actorId === actor.actorId)!
        stateActor.preEnrollmentEnabled = actor.preEnrollmentEnabled
        stateActor.preEnrollmentComplete = actor.preEnrollmentComplete
        stateActor.rules = structuredClone(actor.rules)
        stateActor.institutional = structuredClone(actor.institutional)
      })
      const before = testApp.repository.readSnapshot()

      const response = await supertest(testApp.app.getHttpServer())
        .get(`/local/matricula-regular/v1/contextos/${actor.actorId}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({ runId: testApp.repository.runId, data: { actorId: actor.actorId } })
      expect(() => validateContext(response.body.data)).not.toThrow()
      expect(response.body.data.eligibility.state).toBe('configuration-pending')
      expect(response.body.data.eligibility.causes).toEqual([])
      expect(response.body.data.eligibility.gaps.map(({ code }: { code: string }) => code)).toEqual([
        'INSTITUTIONAL_REQUIREMENT_UNKNOWN',
        'PLAN_OR_OFFER_UNKNOWN',
        'PRE_ENROLLMENT_UNKNOWN',
      ])
      expect(response.body.data.eligibility.gaps.every(({ sourceIds }: { sourceIds: string[] }) => sourceIds.length > 0)).toBe(true)

      const state = testApp.repository.readSnapshot()
      expect(state.sessions).toEqual([])
      expect(state.requests).toEqual([])
      expect(state.enrollments).toEqual([])
      expect(state.reports).toEqual([])
      expect(state.offer.map(({ courseId, sections }) => [courseId, sections.map(({ occupied }) => occupied)]))
        .toEqual(before.offer.map(({ courseId, sections }) => [courseId, sections.map(({ occupied }) => occupied)]))
    },
  )

  it.each(['SISTEMAS', 'SOFTWARE'] as const)(
    '%s GET Context remains pending with absent policies and submission cannot commit',
    async (school: School) => {
      const fixture = createSyntheticFixture(school)
      const actor = fixture.actors[0]!
      actor.rules = actor.rules.filter(({ ruleId }) => ![
        'PRE-ENROLLMENT-ENABLED',
        'INSTITUTIONAL-REQUIREMENTS',
        'PLAN-AND-OFFER',
      ].includes(ruleId))
      actor.preEnrollmentEnabled = true
      actor.preEnrollmentComplete = true
      actor.planKnown = true
      actor.offerKnown = true
      actor.institutional = { debt: 'met', health: 'met', eligibility: 'met' }
      await testApp.repository.enqueue((state) => {
        const stateActor = state.actors.find(({ actorId }) => actorId === actor.actorId)!
        stateActor.rules = structuredClone(actor.rules)
        stateActor.preEnrollmentEnabled = actor.preEnrollmentEnabled
        stateActor.preEnrollmentComplete = actor.preEnrollmentComplete
        stateActor.planKnown = actor.planKnown
        stateActor.offerKnown = actor.offerKnown
        stateActor.institutional = structuredClone(actor.institutional)
      })
      const beforeContext = testApp.repository.readSnapshot()

      const response = await supertest(testApp.app.getHttpServer())
        .get(`/local/matricula-regular/v1/contextos/${actor.actorId}`)

      expect(response.status).toBe(200)
      expect(() => validateContext(response.body.data)).not.toThrow()
      expect(response.body.data.eligibility.state).toBe('configuration-pending')
      expect(response.body.data.eligibility.causes).toEqual([])
      expect(response.body.data.eligibility.gaps.map(({ code }: { code: string }) => code)).toEqual([
        'INSTITUTIONAL_REQUIREMENT_UNKNOWN',
        'PLAN_OR_OFFER_UNKNOWN',
        'PRE_ENROLLMENT_UNKNOWN',
      ])
      expect(response.body.data.eligibility.gaps.every(({ sourceIds }: { sourceIds: string[] }) => sourceIds.length === 0)).toBe(true)
      expect(testApp.repository.readSnapshot().sessions).toEqual(beforeContext.sessions)

      const sessionResponse = await supertest(testApp.app.getHttpServer())
        .post('/local/matricula-regular/v1/sesiones')
        .send({ runId: beforeContext.runId, actorId: actor.actorId })
      expect(sessionResponse.status).toBe(200)

      const choice = fixture.offer[0]!
      const section = choice.sections[0]!
      const submitResponse = await supertest(testApp.app.getHttpServer())
        .post('/local/matricula-regular/v1/solicitudes')
        .send({
          runId: beforeContext.runId,
          actorId: actor.actorId,
          sessionId: sessionResponse.body.data.sessionId,
          requestId: '5d302cee-a551-4d0e-881e-d225a2a46d57',
          profileRevision: actor.profileRevision,
          selection: [{ courseId: choice.courseId, sectionId: section.sectionId }],
        })

      expect(submitResponse.status).toBe(200)
      expect(submitResponse.body.data.state).toBe('configuration-pending')
      expect(submitResponse.body.data.gaps.map(({ code }: { code: string }) => code)).toEqual([
        'INSTITUTIONAL_REQUIREMENT_UNKNOWN',
        'PLAN_OR_OFFER_UNKNOWN',
        'PRE_ENROLLMENT_UNKNOWN',
      ])
      const afterSubmit = testApp.repository.readSnapshot()
      expect(afterSubmit.enrollments).toEqual([])
      expect(afterSubmit.reports).toEqual([])
      expect(afterSubmit.offer.map(({ courseId, sections }) => [courseId, sections.map(({ occupied }) => occupied)]))
        .toEqual(beforeContext.offer.map(({ courseId, sections }) => [courseId, sections.map(({ occupied }) => occupied)]))
    },
  )
})

describe('T012 foundation: run cloning, isolation, reset and queue', () => {
  it('isolates schools, clones reads, resets run-scoped state, and serializes on the current run', async () => {
    const initial = testApp.repository.readSnapshot()
    expect(initial.actors).toHaveLength(4)
    expect(initial.profiles.map((profile) => profile.scope.schoolId)).toContain('SISTEMAS')
    expect(initial.profiles.map((profile) => profile.scope.schoolId)).toContain('SOFTWARE')
    initial.actors.splice(0)
    initial.offer[0]!.sections[0]!.occupied = 1
    expect(testApp.repository.readSnapshot().actors).toHaveLength(4)
    expect(testApp.repository.readSnapshot().offer[0]!.sections[0]!.occupied).toBe(0)

    const queuedRun = testApp.repository.enqueue((state) => state.runId)
    const resetRun = testApp.reset()
    expect(await queuedRun).toBe(resetRun)
    const reset = testApp.repository.readSnapshot()
    expect(reset.runId).toBe(resetRun)
    expect(reset.sessions).toEqual([])
    expect(reset.requests).toEqual([])
    expect(reset.enrollments).toEqual([])
    expect(reset.reports).toEqual([])
    expect(reset.actors.map((actor) => actor.scope.schoolId)).toEqual([
      'SISTEMAS', 'SISTEMAS', 'SOFTWARE', 'SOFTWARE',
    ])
  })
})

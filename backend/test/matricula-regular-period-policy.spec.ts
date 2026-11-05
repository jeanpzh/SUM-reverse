import { describe, expect, it } from 'vitest'
import type { MatriculaRegularChoice } from '../../shared/matricula-regular.mjs'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { evaluateSubmissionRules } from '../src/matricula-regular/rules.js'
import { evaluateContextEligibility, regularTurnWindowsForDate } from '../src/matricula-regular/windows.js'

function setup(period: '2026-II' | '2027-I') {
  const { profile, actors, offer } = createSyntheticFixture('SISTEMAS')
  const actor = actors[0]!
  if (period === '2027-I') {
    profile.scope.period = period
    actor.scope.period = period
    profile.profileRevision = actor.profileRevision = 'MR-SYN-SIS-2027-I-TEST'
    profile.academicPolicy = 'fisi-regular'
    profile.calendar = { publishedRows: [], unknownDates: [], effectiveWindows: regularTurnWindowsForDate('2027-03-15', ['SYN-FIXTURE']) }
  }
  const selection = offer.map(course => ({
    courseId: course.courseId,
    sectionId: course.sections[0]!.sectionId,
  })) as MatriculaRegularChoice[]
  const now = new Date(period === '2027-I' ? '2027-03-15T15:00:00Z' : '2026-08-11T15:00:00Z')
  return { actor, profile, offer, selection, now }
}

describe('shared regular academic policy, isolated from the active offer', () => {
  it.each(['2026-II', '2027-I'] as const)('keeps both credit limits and the existing exception in %s', period => {
    const input = setup(period)
    const first = input.offer[0]!
    const selectOne = { ...input, selection: input.selection.slice(0, 1) }
    for (const credits of [11, 12, 26, 27]) {
      first.credits = credits
      expect(evaluateSubmissionRules(selectOne).causes.some(c => c.code === 'CREDIT_LOAD_INVALID')).toBe(credits < 12 || credits > 26)
    }
    first.credits = 11
    input.actor.creditException = { kind: 'remaining-for-completion', applicability: 'applicable', sourceIds: ['SYN-FIXTURE'] }
    expect(evaluateSubmissionRules(selectOne).causes.some(c => c.code === 'CREDIT_LOAD_INVALID')).toBe(false)
    input.actor.creditException.applicability = 'unknown'
    expect(evaluateSubmissionRules(selectOne).gaps.map(g => g.code)).toContain('EXCEPTION_UNKNOWN')
  })

  it('uses prerequisite, repeat, tutor, overlap and occupancy checks on the future profile', () => {
    const input = setup('2027-I')
    expect(evaluateSubmissionRules(input).gaps).toEqual([])
    const [first, second, third] = input.offer
    first!.prerequisiteIds = [third!.courseId]
    first!.sections[0]!.occupied = first!.sections[0]!.capacity
    second!.sections[0]!.schedule = structuredClone(first!.sections[0]!.schedule)
    input.actor.failedCourses = [{ courseId: third!.courseId, failures: 2 }]
    input.actor.tutorship = [{ courseId: third!.courseId, condition: 'unmet' }]
    const result = evaluateSubmissionRules({ ...input, selection: input.selection.slice(0, 2) })
    expect(result.causes.map(c => c.code)).toEqual(expect.arrayContaining([
      'PREREQUISITE_UNMET', 'RETAKE_PRIORITY', 'TUTORSHIP_REQUIREMENT_UNMET', 'SCHEDULE_CONFLICT', 'SECTION_FULL',
    ]))
    input.actor.failedCourses[0]!.failures = 3
    expect(evaluateSubmissionRules(input).causes.map(c => c.code)).toContain('FOURTH_ENROLLMENT_RULE_UNMET')
  })

  it('fails closed on unknown academic data or missing policy', () => {
    const input = setup('2027-I')
    input.actor.historyKnown = false
    expect(evaluateSubmissionRules(input).gaps.map(g => g.code)).toContain('PREREQUISITE_OR_EQUIVALENCE_UNKNOWN')
    input.profile.academicPolicy = undefined
    expect(evaluateSubmissionRules(input).gaps.map(g => g.code)).toContain('PROFILE_MISSING')
  })

  it('reuses threshold and start rules with a future Lima date', () => {
    const { actor, profile } = setup('2027-I')
    actor.ponderado = 16
    const at = (time: string) => evaluateContextEligibility([profile], actor, new Date(time))
    expect(at('2027-03-15T12:59:00Z').state).toBe('ineligible')
    expect(at('2027-03-15T13:00:00Z').windowId).toBe('SYN-REGULAR-2027-03-15-2')
    expect(at('2027-03-16T04:59:00Z').state).toBe('eligible')
    expect(at('2027-03-16T05:00:00Z').state).toBe('ineligible')
    profile.calendar.effectiveWindows = []
    expect(at('2027-03-15T13:00:00Z').gaps.map(g => g.code)).toContain('WINDOW_UNSPECIFIED')
  })
})

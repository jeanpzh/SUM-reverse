import { describe, expect, it } from 'vitest'
import { generateAcademicSchedule } from '../src/programacion-academica/schedule-generator.js'
import { checkSessionCoverage } from '../src/programacion-academica/session-coverage.js'
import { validateAcademicSchedule } from '../src/programacion-academica/schedule-validator.js'
import { assessTeacherPreferences } from '../src/programacion-academica/teacher-preferences.js'
import type { GeneratorInput } from '../src/programacion-academica/generator.types.js'

const window = { day: 1 as const, startMinute: 480, endMinute: 1440 }
const makeInput = (): GeneratorInput => ({
  courses: [{ courseId: 'ERP20118104', estimatedDemand: 180, targetCapacity: 45,
    weeklySessions: [{ id: 'T', durationMinutes: 120 }, { id: 'P', durationMinutes: 120 }] }],
  teachers: [{ id: 'T1', courseIds: ['ERP20118104'], maxWeeklyMinutes: 960, availability: [window] }],
  rooms: [{ id: 'R1', capacity: 45, availability: [window] }],
  compatibleGroups: [], windows: [window], startStepMinutes: 240, maxExplorations: 1000,
})

describe('academic teacher preferences and section limits', () => {
  it('schedules four 240-minute sections on one qualified teacher when load permits', () => {
    const result = generateAcademicSchedule(makeInput())
    expect(result.status).toBe('complete')
    expect(result.schedule?.sections).toHaveLength(4)
    expect(result.schedule?.assignments).toHaveLength(8)
    expect(new Set(result.schedule?.assignments.map((item) => item.teacherId))).toEqual(new Set(['T1']))
  })

  it('splits the four sections across two teachers by their available weekly load', () => {
    const input = makeInput()
    input.teachers = ['T1', 'T2'].map((id) => ({ id, courseIds: ['ERP20118104'], maxWeeklyMinutes: 480, availability: [window] }))
    input.allocationPolicy = 'balanced'
    const result = generateAcademicSchedule(input)
    expect(result.status).toBe('complete')
    expect(result.schedule?.assignments).toHaveLength(8)
    expect(new Set(result.schedule?.assignments.map((item) => item.teacherId))).toEqual(new Set(['T1', 'T2']))
  })

  it('preserves a valid partial schedule when cooperative exploration ends', () => {
    const input = makeInput()
    input.maxExplorations = 1
    const result = generateAcademicSchedule(input)
    expect(result.status).toBe('search-limit')
    expect(result.diagnostics[0]?.code).toBe('SEARCH_LIMIT')
    expect(result.schedule?.assignments).toHaveLength(2)
    expect(validateAcademicSchedule(result.schedule).valid).toBe(true)
  })

  it('bounds starts rejected by preference rank or teacher availability', () => {
    const outsidePreference = makeInput()
    outsidePreference.teachers[0]!.preferences = [{ day: 2, startMinute: 480, endMinute: 1440 }]
    const preferenceLimited = generateAcademicSchedule(outsidePreference, { maxCandidateVisits: 1, now: () => 0 })
    expect(preferenceLimited.status).toBe('search-limit')
    expect(preferenceLimited.limitReason).toBe('work')
    expect(preferenceLimited.candidateVisits).toBe(1)

    const unavailable = makeInput()
    unavailable.teachers[0]!.availability = []
    const availabilityLimited = generateAcademicSchedule(unavailable, { maxCandidateVisits: 1, now: () => 0 })
    expect(availabilityLimited.status).toBe('search-limit')
    expect(availabilityLimited.limitReason).toBe('work')
    expect(availabilityLimited.candidateVisits).toBe(1)
  })

  it('honors the cooperative clock while all starts miss the preferred rank', () => {
    const input = makeInput()
    input.teachers[0]!.preferences = [{ day: 2, startMinute: 480, endMinute: 1440 }]
    let tick = 0
    const result = generateAcademicSchedule(input, { maxElapsedMs: 3, now: () => tick++ })
    expect(result.status).toBe('search-limit')
    expect(result.limitReason).toBe('time')
    expect(result.diagnostics[0]?.code).toBe('SEARCH_LIMIT')
    expect(result.schedule?.assignments).toHaveLength(0)
  })

  it('proves a coursewide load shortage and keeps the soft preference as fallback', () => {
    const insufficient = makeInput()
    insufficient.teachers[0]!.maxWeeklyMinutes = 959
    const impossible = generateAcademicSchedule(insufficient)
    expect(impossible.status).toBe('impossible')
    expect(impossible.diagnostics[0]?.code).toBe('INSUFFICIENT_COURSE_TEACHER_LOAD')

    const input = makeInput()
    input.teachers[0]!.preferences = [{ day: 1, startMinute: 480, endMinute: 720 }]
    const result = generateAcademicSchedule(input)
    expect(result.status).toBe('complete')
    expect(result.schedule?.assignments).toHaveLength(8)
    const report = assessTeacherPreferences(input, result.schedule!, result.requirements)
    expect(report).toMatchObject({ evaluatedSections: 4, withinPreferenceSections: 1, outsidePreferenceSections: 3, optimality: 'not-proven' })
  })

  it('proves explicit aggregate section caps are insufficient', () => {
    const input = makeInput()
    input.teachers[0]!.sectionLimits = [{ courseId: 'ERP20118104', maxSections: 3 }]
    const result = generateAcademicSchedule(input)
    expect(result.status).toBe('impossible')
    expect(result.diagnostics[0]?.code).toBe('INSUFFICIENT_TEACHER_SECTION_CAP')
  })

  it('rejects tampered course section caps through base validation and retained authority', () => {
    const input = makeInput()
    input.teachers[0]!.sectionLimits = [{ courseId: 'ERP20118104', maxSections: 4 }]
    const result = generateAcademicSchedule(input)
    expect(result.status).toBe('complete')
    result.schedule!.teachers[0]!.sectionLimits![0]!.maxSections = 3
    expect(validateAcademicSchedule(result.schedule).issues.some((issue) => issue.code === 'TEACHER_SECTION_LIMIT')).toBe(true)
    expect(checkSessionCoverage(result.schedule, input).complete).toBe(false)
  })

  it('rejects malformed preferences, duplicate course limits and unknown policies', () => {
    const excessive = makeInput()
    excessive.teachers[0]!.preferences = Array.from({ length: 33 }, () => window)
    expect(generateAcademicSchedule(excessive).status).toBe('invalid-input')
    const duplicate = makeInput()
    duplicate.teachers[0]!.sectionLimits = [
      { courseId: 'ERP20118104', maxSections: 2 }, { courseId: 'ERP20118104', maxSections: 2 },
    ]
    expect(generateAcademicSchedule(duplicate).status).toBe('invalid-input')
    const policy = makeInput()
    Reflect.set(policy, 'allocationPolicy', 'magic')
    expect(generateAcademicSchedule(policy).status).toBe('invalid-input')
  })
})

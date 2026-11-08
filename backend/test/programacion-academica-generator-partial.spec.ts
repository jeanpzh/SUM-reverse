import { describe, expect, it, vi } from 'vitest'
import { planningDefaults, syntheticTeachingMetadata } from '../../shared/academic-planning-policy.mjs'
import * as generator from '../src/programacion-academica/schedule-generator.js'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { validateAcademicSchedule } from '../src/programacion-academica/schedule-validator.js'
import { validateSectionDelivery } from '../src/programacion-academica/section-delivery.js'
import type { GeneratorInput } from '../src/programacion-academica/generator.types.js'

// Independently constructed synthetic inputs; no snapshot data or external services.
const window = { day: 1 as const, startMinute: 480, endMinute: 1200 }
const smallInput = (): GeneratorInput => ({
  courses: ['A', 'B'].map((courseId) => ({ courseId, estimatedDemand: 3, targetCapacity: 1,
    weeklySessions: [{ id: 'T', durationMinutes: 120 }, { id: 'P', durationMinutes: 60 }] })),
  teachers: ['A', 'B'].map((courseId) => ({ id: `teacher-${courseId}`, courseIds: [courseId],
    maxWeeklyMinutes: courseId === 'A' ? 300 : 720, availability: [window] })),
  rooms: [{ id: 'room', capacity: 1, availability: [window] }],
  windows: [window], compatibleGroups: [], startStepMinutes: 60, maxExplorations: 1000,
})

const generate = generator.generateAcademicSchedule

describe('useful deterministic partial proposals', () => {
  it('excludes highest surplus ordinals by indivisible teacher capacity and places other courses', () => {
    const input = smallInput()
    input.courses[1]!.estimatedDemand = 2
    const result = generate(input)
    expect(result.status).toBe('impossible')
    const diagnostic = result.diagnostics.find((item) => item.code === 'TEACHER_CAPACITY_SHORTFALL')!
    expect(diagnostic.message).toContain('3 secciones de 180 min')
    expect(diagnostic.message).toContain('cubren 1 (300 min disponibles)')
    expect(diagnostic.sessionIds).toHaveLength(4)
    expect(diagnostic.sessionIds).toEqual(result.coverage!.missingSessionIds)
    expect(new Set(result.schedule!.assignments.map((item) => item.sectionId)).size).toBe(3)
    expect(result.schedule!.assignments.filter((item) => item.teacherId === 'teacher-B')).toHaveLength(4)
    expect(validateAcademicSchedule(result.schedule).valid).toBe(true)
    expect(generate(input)).toEqual(result)
  })

  it('leaves an early dynamically blocked unit pending and still places later independent units', () => {
    const input = smallInput()
    input.courses.forEach((course) => { course.estimatedDemand = 1 })
    input.courses.push({ ...structuredClone(input.courses[0]!), courseId: 'C' })
    input.teachers[0]!.maxWeeklyMinutes = 600
    input.teachers[0]!.courseIds.push('B')
    input.teachers[1]!.courseIds = ['C']
    input.teachers[1]!.availability = [{ ...window, day: 2 }]
    input.teachers[0]!.availability = [{ ...window, endMinute: 660 }]
    input.rooms[0]!.availability.push({ ...window, day: 2 })
    input.windows.push({ ...window, day: 2 })
    const result = generate(input)
    expect(result.status).toBe('impossible')
    expect(result.schedule!.assignments.map((item) => item.teacherId)).toContain('teacher-B')
    expect(new Set(result.schedule!.assignments.map((item) => item.sectionId)).size).toBe(2)
    expect(result.coverage!.missingSessionIds).toHaveLength(2)
    expect(validateAcademicSchedule(result.schedule).valid).toBe(true)
  })

  it('checks explicit section caps, missing qualification, room kind and windows without weakening constraints', () => {
    const capped = smallInput()
    capped.teachers[0]!.maxWeeklyMinutes = 720
    capped.teachers[0]!.sectionLimits = [{ courseId: 'A', maxSections: 1 }]
    expect(generate(capped).diagnostics.find((item) => item.code === 'TEACHER_CAPACITY_SHORTFALL')?.sessionIds).toHaveLength(4)
    const noTeacher = smallInput()
    noTeacher.teachers[0]!.courseIds = []
    expect(generate(noTeacher).diagnostics.find((item) => item.code === 'NO_QUALIFIED_TEACHER')?.sessionIds).toHaveLength(6)
    const noWindow = smallInput()
    noWindow.windows = [{ ...window, endMinute: 600 }]
    expect(generate(noWindow).diagnostics.some((item) => item.code === 'NO_SCHEDULING_WINDOW')).toBe(true)
    const noRoom = smallInput()
    noRoom.planningPolicy = { revision: 'FISI-PLANNING-1', period: '2026-II', allowAfternoon: false, allowSaturday: false }
    noRoom.courses[1]!.weeklySessions[1]!.type = 'L'
    noRoom.rooms[0]!.kind = 'classroom'
    expect(generate(noRoom).diagnostics.some((item) => item.code === 'NO_COMPATIBLE_ROOM')).toBe(true)
  })

  it('constructs at least 100 full-school sections within the default cooperative budget through the proposal service', () => {
    const service = new DemoProposalService()
    const catalog = service.getCatalog()
    const spy = vi.spyOn(generator, 'generateAcademicSchedule')
    try {
      const started = performance.now()
      const proposal = service.createProposal({ revision: catalog.revision,
        demands: catalog.courses.map((course) => ({ courseId: course.courseId,
          ...planningDefaults(course.cycle!, '2027-I'), patternId: 'pattern-1', deliveryMode: 'continuous' })),
        resources: {
          teachers: catalog.referenceTeachers!.map((teacher, index) => ({ ...teacher, maxWeeklyMinutes: 600, availability: catalog.windows,
            ...syntheticTeachingMetadata(index) })),
          rooms: catalog.referenceRooms!.map(({ pavilion: _pavilion, ...room }) => ({ ...room, availability: catalog.windows })),
        },
        allocationPolicy: 'preferences',
        planningPolicy: { revision: 'FISI-PLANNING-1', period: '2027-I', allowAfternoon: false, allowSaturday: false } })
      const elapsedMs = performance.now() - started
      const input = spy.mock.calls[0]![0] as GeneratorInput
      const result = spy.mock.results[0]!.value as ReturnType<typeof generate>
      const placed = proposal.sections.filter((section) => !proposal.pending.some((item) => item.sectionId === section.sectionId)).length
      const diagnostics = Object.fromEntries([...new Set(proposal.diagnostics.map((item) => item.code))].map((code) =>
        [code, proposal.diagnostics.filter((item) => item.code === code).length]))
      console.info(JSON.stringify({ placed, total: proposal.sections.length, status: proposal.status, elapsedMs, diagnostics,
        candidateVisits: result.candidateVisits, limitReason: result.limitReason }))
      expect(input.courses).toHaveLength(56)
      expect(input.teachers).toHaveLength(91)
      expect(input.rooms).toHaveLength(49)
      expect(result.requirements.reduce((sum, item) => sum + item.durationMinutes, 0)).toBe(44520)
      expect(proposal.sections).toHaveLength(166)
      expect(placed).toBeGreaterThanOrEqual(100)
      expect(result.limitReason).toBeNull()
      expect(proposal.status).toBe('impossible')
      expect(proposal.coverageComplete).toBe(false)
      expect(elapsedMs).toBeLessThan(2000)
      expect(validateAcademicSchedule(result.schedule, { planningPolicy: true }).valid).toBe(true)
      expect(validateSectionDelivery(result.schedule!, result.requirements, input)).toEqual([])
      expect(result.coverage!.issues.every((issue) => issue.code === 'MISSING_SESSION')).toBe(true)
      const assigned = new Set(result.schedule!.assignments.map((item) => item.id))
      const precheckIds = new Set(result.diagnostics.filter((item) => item.code === 'TEACHER_CAPACITY_SHORTFALL').flatMap((item) => item.sessionIds))
      for (const course of input.courses) {
        const minutes = course.weeklySessions.reduce((sum, item) => sum + item.durationMinutes, 0)
        const capacity = input.teachers.filter((teacher) => teacher.courseIds.includes(course.courseId)).reduce((sum, teacher) =>
          sum + Math.min(Math.floor(teacher.maxWeeklyMinutes / minutes), teacher.sectionLimits?.find((limit) => limit.courseId === course.courseId)?.maxSections ?? Infinity), 0)
        const excluded = result.schedule!.sections.filter((section) => section.courseId === course.courseId).slice(capacity)
        for (const section of excluded) {
          expect(result.requirements.filter((item) => item.sectionId === section.id).every((item) => precheckIds.has(item.id))).toBe(true)
        }
      }
      for (const diagnostic of result.diagnostics.filter((item) => ['TEACHER_CAPACITY_SHORTFALL', 'NO_QUALIFIED_TEACHER', 'NO_COMPATIBLE_ROOM', 'NO_SCHEDULING_WINDOW'].includes(item.code))) {
        expect(diagnostic.sessionIds.length).toBeGreaterThan(0)
        expect(diagnostic.sessionIds.every((id) => !assigned.has(id) && result.coverage!.missingSessionIds.includes(id))).toBe(true)
      }
      expect(generate(input)).toEqual(result)
    } finally { spy.mockRestore() }
  }, 10000)
})

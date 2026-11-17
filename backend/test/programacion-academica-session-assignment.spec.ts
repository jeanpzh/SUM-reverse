import { describe, expect, it } from 'vitest'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { buildLocalDeterministicAdvisor } from '../src/programacion-academica/planning-engine.client.js'
import { generateAcademicSchedule } from '../src/programacion-academica/schedule-generator.js'
import type { AcademicRequest } from '../../shared/programacion-academica-api.mjs'

const catalog = createDemoCatalog()
const tplCourseId = '20118031' // T 120 + P 120 + L 120, cycle 3
const seniorCourseId = '20118071' // T 120 + L 120, cycle 7
const workWindows = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 }))

describe('component-group teacher assignment, time profile exceptions and advisor parity', () => {
  it('assigns T+P contiguously to docA and L independently to docB in tp-grouped-l-independent while rejecting legacy mode', () => {
    const service = new DemoProposalService()
    const baseRequest: AcademicRequest = {
      revision: catalog.revision,
      demands: [{ courseId: tplCourseId, estimatedDemand: 25, targetCapacity: 30, deliveryMode: 'continuous' }],
      resources: {
        teachers: [
          {
            id: 'DOC-A',
            name: 'Docente Sintetico A',
            courseIds: [tplCourseId],
            maxWeeklyMinutes: 240,
            availability: [{ day: 5, startMinute: 480, endMinute: 720 }],
          },
          {
            id: 'DOC-B',
            name: 'Docente Sintetico B',
            courseIds: [tplCourseId],
            maxWeeklyMinutes: 120,
            availability: [{ day: 4, startMinute: 600, endMinute: 720 }],
          },
        ],
        rooms: [
          { id: 'SYN-AULA', name: 'Aula Sintetica', kind: 'classroom', capacity: 35, availability: structuredClone(workWindows) },
          { id: 'SYN-LAB', name: 'Lab Sintetico', kind: 'laboratory', capacity: 35, availability: structuredClone(workWindows) },
        ],
      },
    }

    const legacy = service.createProposal(baseRequest)
    expect(legacy.status).toBe('impossible')
    expect(legacy.counts.scheduledSessions).toBe(0)

    const grouped = service.createProposal({
      ...baseRequest,
      demands: [{
        ...baseRequest.demands[0]!,
        teacherAssignmentMode: 'tp-grouped-l-independent',
      }],
    })
    expect(grouped.status).toBe('complete')
    expect(grouped.coverageComplete).toBe(true)
    expect(grouped.counts).toEqual({ sections: 1, requiredSessions: 3, scheduledSessions: 3 })
    expect(grouped.sections[0]!.teacherAssignmentMode).toBe('tp-grouped-l-independent')
    expect(grouped.sections[0]!.responsibleTeacherId).toBe('DOC-A')

    const byType = new Map(grouped.assignments.map((a) => [a.sessionType, a]))
    expect(byType.get('T')?.teacherId).toBe('DOC-A')
    expect(byType.get('P')?.teacherId).toBe('DOC-A')
    expect(byType.get('L')?.teacherId).toBe('DOC-B')
    expect(byType.get('T')?.day).toBe(5)
    expect(byType.get('P')?.day).toBe(5)
    expect(byType.get('P')?.startMinute).toBe(byType.get('T')?.endMinute)
    expect(byType.get('L')?.day).toBe(4)
    expect(byType.get('L')?.startMinute).toBe(600)
    expect(byType.get('L')?.endMinute).toBe(720)
  })

  it('scopes manual adjustments per component group and updates responsibleTeacherId cleanly', () => {
    const service = new DemoProposalService()
    const request: AcademicRequest = {
      revision: catalog.revision,
      demands: [{
        courseId: tplCourseId,
        estimatedDemand: 25,
        targetCapacity: 30,
        deliveryMode: 'continuous',
        teacherAssignmentMode: 'tp-grouped-l-independent',
      }],
      resources: {
        teachers: [
          { id: 'DOC-A', name: 'Docente Sintetico A', courseIds: [tplCourseId], maxWeeklyMinutes: 360, availability: structuredClone(workWindows) },
          { id: 'DOC-B', name: 'Docente Sintetico B', courseIds: [tplCourseId], maxWeeklyMinutes: 360, availability: structuredClone(workWindows) },
        ],
        rooms: [
          { id: 'SYN-AULA', name: 'Aula Sintetica', kind: 'classroom', capacity: 35, availability: structuredClone(workWindows) },
          { id: 'SYN-LAB', name: 'Lab Sintetico', kind: 'laboratory', capacity: 35, availability: structuredClone(workWindows) },
        ],
      },
    }
    const proposal = service.createProposal(request)
    expect(proposal.status).toBe('complete')
    const section = proposal.sections[0]!
    const lab = proposal.assignments.find((a) => a.sessionType === 'L')!
    const nonLab = proposal.assignments.filter((a) => a.sessionType !== 'L')

    const nextLabTeacher = lab.teacherId === 'DOC-A' ? 'DOC-B' : 'DOC-A'
    const adjustedLab = service.adjustProposal(proposal.proposalId, {
      expectedVersion: proposal.editVersion ?? 0,
      sectionId: section.sectionId,
      sessionIds: [lab.sessionId],
      teacherId: nextLabTeacher,
      day: 4,
      startMinute: 600,
      roomIds: ['SYN-LAB'],
    })
    expect(adjustedLab.editVersion).toBe(1)
    expect(adjustedLab.assignments.find((a) => a.sessionId === lab.sessionId)?.teacherId).toBe(nextLabTeacher)
    expect(adjustedLab.assignments.filter((a) => a.sessionType !== 'L').map((a) => a.teacherId))
      .toEqual(nonLab.map((a) => a.teacherId))
    expect(adjustedLab.sections[0]!.responsibleTeacherId).toBe(nonLab[0]!.teacherId)
  })

  it('honors per-session mode, Saturday explicit exceptions, cycle VII afternoon windows, and unknown faculty rejection', () => {
    const service = new DemoProposalService()

    expect(() => service.createProposal({
      revision: catalog.revision,
      demands: [{ courseId: tplCourseId, estimatedDemand: 20, targetCapacity: 30 }],
      planningPolicy: { revision: 'FISI-PLANNING-1', period: '2027-I', allowAfternoon: false, allowSaturday: false, facultyId: 'FII' } as unknown as AcademicRequest['planningPolicy'],
      resources: {
        teachers: [{ id: 'DOC-A', name: 'Docente A', courseIds: [tplCourseId], maxWeeklyMinutes: 360, availability: structuredClone(workWindows) }],
        rooms: [{ id: 'SYN-AULA', name: 'Aula', kind: 'classroom', capacity: 35, availability: structuredClone(workWindows) }],
      },
    })).toThrow()

    // Saturday extended to 14:00 (840) and 14:00–18:00 (1080) by explicit exceptions, plus cycle VII afternoon 14:00–17:00
    const saturdayRequest: AcademicRequest = {
      revision: catalog.revision,
      planningPolicy: {
        revision: 'FISI-PLANNING-1',
        period: '2027-I',
        allowAfternoon: true,
        allowSaturday: true,
        facultyId: 'FISI',
        source: 'synthetic-policy-test',
        exceptions: { saturdayStartMinute: 840, saturdayEndMinute: 1080 },
      },
      demands: [{
        courseId: seniorCourseId,
        estimatedDemand: 20,
        targetCapacity: 30,
        deliveryMode: 'split',
        teacherAssignmentMode: 'per-session',
      }],
      resources: {
        teachers: [
          { id: 'DOC-SAT', name: 'Docente Sabado', courseIds: [seniorCourseId], maxWeeklyMinutes: 120, availability: [{ day: 6, startMinute: 840, endMinute: 1080 }] },
          { id: 'DOC-AFT', name: 'Docente Tarde', courseIds: [seniorCourseId], maxWeeklyMinutes: 120, availability: [{ day: 2, startMinute: 840, endMinute: 1020 }] },
        ],
        rooms: [
          { id: 'SYN-AULA', name: 'Aula', kind: 'classroom', capacity: 35, availability: [{ day: 2, startMinute: 840, endMinute: 1020 }, { day: 6, startMinute: 840, endMinute: 1080 }] },
          { id: 'SYN-LAB', name: 'Lab', kind: 'laboratory', capacity: 35, availability: [{ day: 2, startMinute: 840, endMinute: 1020 }, { day: 6, startMinute: 840, endMinute: 1080 }] },
        ],
      },
    }
    const satProposal = service.createProposal(saturdayRequest)
    expect(satProposal.status).toBe('complete')
    expect(satProposal.assignments.some((a) => a.day === 6 && a.startMinute >= 840 && a.endMinute <= 1080)).toBe(true)
    expect(satProposal.assignments.some((a) => a.day === 2 && a.startMinute >= 840 && a.endMinute <= 1020)).toBe(true)
  })

  it('produces distinct outcomes for allocationPolicy preferences vs first-feasible when preferences conflict with early slots', () => {
    const course = catalog.courses.find((c) => c.courseId === '20118104')!
    const input = {
      courses: [{ courseId: course.courseId, estimatedDemand: 20, targetCapacity: 30, weeklySessions: [{ id: 's1', durationMinutes: 120, type: 'T' }] }],
      teachers: [{
        id: 'DOC-PREF',
        courseIds: [course.courseId],
        maxWeeklyMinutes: 360,
        availability: [{ day: 1, startMinute: 480, endMinute: 720 }, { day: 3, startMinute: 480, endMinute: 720 }],
        preferences: [{ day: 3, startMinute: 480, endMinute: 720 }],
      }],
      rooms: [{ id: 'R1', capacity: 30, kind: 'classroom' as const, availability: [{ day: 1, startMinute: 480, endMinute: 720 }, { day: 3, startMinute: 480, endMinute: 720 }] }],
      compatibleGroups: [],
      windows: [{ day: 1, startMinute: 480, endMinute: 720 }, { day: 3, startMinute: 480, endMinute: 720 }],
      startStepMinutes: 60,
      maxExplorations: 500,
    }
    const prefResult = generateAcademicSchedule({ ...structuredClone(input), allocationPolicy: 'preferences' })
    const firstResult = generateAcademicSchedule({ ...structuredClone(input), allocationPolicy: 'first-feasible' })
    expect(prefResult.status).toBe('complete')
    expect(firstResult.status).toBe('complete')
    expect(prefResult.schedule!.assignments[0]!.interval.day).toBe(3)
    expect(firstResult.schedule!.assignments[0]!.interval.day).toBe(1)
  })

  it('emits deterministic rec-change-teacher-assignment-mode recommendation for pending T/P+L courses', () => {
    const service = new DemoProposalService()
    const request: AcademicRequest = {
      revision: catalog.revision,
      demands: [{ courseId: tplCourseId, estimatedDemand: 25, targetCapacity: 30, deliveryMode: 'continuous' }],
      resources: {
        teachers: [
          { id: 'DOC-A', name: 'Docente A', courseIds: [tplCourseId], maxWeeklyMinutes: 240, availability: [{ day: 5, startMinute: 480, endMinute: 720 }] },
          { id: 'DOC-B', name: 'Docente B', courseIds: [tplCourseId], maxWeeklyMinutes: 120, availability: [{ day: 4, startMinute: 600, endMinute: 720 }] },
        ],
        rooms: [
          { id: 'SYN-AULA', name: 'Aula', kind: 'classroom', capacity: 35, availability: structuredClone(workWindows) },
          { id: 'SYN-LAB', name: 'Lab', kind: 'laboratory', capacity: 35, availability: structuredClone(workWindows) },
        ],
      },
    }
    const proposal = service.createProposal(request)
    expect(proposal.status).toBe('impossible')
    const advisor = buildLocalDeterministicAdvisor(proposal, {
      courses: [{ courseId: tplCourseId, estimatedDemand: 25, targetCapacity: 30, weeklySessions: catalog.courses.find((c) => c.courseId === tplCourseId)!.weeklySessions, deliveryMode: 'continuous', teacherAssignmentMode: 'single-teacher-section' }],
      teachers: request.resources!.teachers,
      rooms: request.resources!.rooms,
      compatibleGroups: [],
      windows: workWindows,
      startStepMinutes: 60,
      maxExplorations: 100,
    }, request.resources!, catalog)
    const rec = advisor.recommendations.find((r) => r.id === 'rec-change-teacher-assignment-mode')
    expect(rec).toBeDefined()
    expect(rec?.patch).toEqual({
      kind: 'change_teacher_assignment_mode',
      courseIds: [tplCourseId],
      teacherAssignmentMode: 'tp-grouped-l-independent',
    })
  })
})

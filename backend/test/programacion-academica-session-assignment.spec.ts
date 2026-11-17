import { lstatSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { buildLocalDeterministicAdvisor } from '../src/programacion-academica/planning-engine.client.js'
import { SavedDraftService } from '../src/programacion-academica/saved-draft.service.js'
import { generateAcademicSchedule } from '../src/programacion-academica/schedule-generator.js'
import type { AcademicRequest, AcademicWorkspace } from '../../shared/programacion-academica-api.mjs'

const catalog = createDemoCatalog()
const tplCourseId = '20118031' // T 120 + P 120 + L 120, cycle 3
const seniorCourseId = '20118071' // T 120 + L 120, cycle 7
const workWindows = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 }))
const fisiBasePolicy: NonNullable<AcademicRequest['planningPolicy']> = {
  revision: 'FISI-PLANNING-1',
  period: '2027-I',
  allowAfternoon: false,
  allowSaturday: false,
  facultyId: 'FISI',
  source: 'synthetic-policy-test',
}

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
      planningPolicy: structuredClone(fisiBasePolicy),
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
    const nonLab = proposal.assignments.filter((a) => a.sessionType !== 'L').sort((a, b) => a.startMinute - b.startMinute)
    expect(lab.roomId).toBe('SYN-LAB')

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

    const nextTpTeacher = nonLab[0]!.teacherId === 'DOC-A' ? 'DOC-B' : 'DOC-A'
    const adjustedTp = service.adjustProposal(proposal.proposalId, {
      expectedVersion: adjustedLab.editVersion ?? 1,
      sectionId: section.sectionId,
      sessionIds: nonLab.map((a) => a.sessionId),
      teacherId: nextTpTeacher,
      day: 2,
      startMinute: 480,
      roomIds: nonLab.map(() => 'SYN-AULA'),
    })
    expect(adjustedTp.editVersion).toBe(2)
    expect(adjustedTp.assignments.filter((a) => a.sessionType !== 'L').map((a) => ({
      teacherId: a.teacherId, day: a.day, roomId: a.roomId,
    }))).toEqual([
      { teacherId: nextTpTeacher, day: 2, roomId: 'SYN-AULA' },
      { teacherId: nextTpTeacher, day: 2, roomId: 'SYN-AULA' },
    ])
    expect(adjustedTp.assignments.find((a) => a.sessionId === lab.sessionId)).toMatchObject({
      teacherId: nextLabTeacher, day: 4, startMinute: 600, roomId: 'SYN-LAB',
    })
    expect(adjustedTp.sections[0]!.responsibleTeacherId).toBe(nextTpTeacher)

    expect(() => service.adjustProposal(proposal.proposalId, {
      expectedVersion: adjustedTp.editVersion ?? 2,
      sectionId: section.sectionId,
      sessionIds: [nonLab[0]!.sessionId],
      teacherId: nextTpTeacher,
      day: 3,
      startMinute: 480,
      roomIds: ['SYN-AULA'],
    })).toThrow()
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

  it('allows moving L independently even when physically contiguous with T+P on the same day', () => {
    const service = new DemoProposalService()
    const request: AcademicRequest = {
      revision: catalog.revision,
      planningPolicy: structuredClone(fisiBasePolicy),
      demands: [{
        courseId: tplCourseId,
        estimatedDemand: 25,
        targetCapacity: 30,
        deliveryMode: 'continuous',
        teacherAssignmentMode: 'tp-grouped-l-independent',
      }],
      resources: {
        teachers: [
          { id: 'DOC-TP', name: 'Docente TP', courseIds: [tplCourseId], maxWeeklyMinutes: 240, availability: [{ day: 1, startMinute: 480, endMinute: 720 }] },
          {
            id: 'DOC-LAB',
            name: 'Docente Lab',
            courseIds: [tplCourseId],
            maxWeeklyMinutes: 120,
            availability: [{ day: 1, startMinute: 720, endMinute: 840 }, { day: 3, startMinute: 480, endMinute: 600 }],
            preferences: [{ day: 1, startMinute: 720, endMinute: 840 }],
          },
        ],
        rooms: [
          { id: 'SYN-AULA', name: 'Aula Sintetica', kind: 'classroom', capacity: 35, availability: structuredClone(workWindows) },
          { id: 'SYN-LAB', name: 'Lab Sintetico', kind: 'laboratory', capacity: 35, availability: structuredClone(workWindows) },
        ],
      },
    }

    const proposal = service.createProposal(request)
    expect(proposal.status).toBe('complete')
    const theory = proposal.assignments.find((a) => a.sessionType === 'T')!
    const practice = proposal.assignments.find((a) => a.sessionType === 'P')!
    const lab = proposal.assignments.find((a) => a.sessionType === 'L')!

    expect(theory.day).toBe(1)
    expect(practice.day).toBe(1)
    expect(practice.startMinute).toBe(theory.endMinute)
    expect(lab.day).toBe(1)
    expect(lab.startMinute).toBe(practice.endMinute)
    expect(lab.roomId).toBe('SYN-LAB')

    const movedLab = service.adjustProposal(proposal.proposalId, {
      expectedVersion: proposal.editVersion ?? 0,
      sectionId: proposal.sections[0]!.sectionId,
      sessionIds: [lab.sessionId],
      teacherId: 'DOC-LAB',
      day: 3,
      startMinute: 480,
      roomIds: ['SYN-LAB'],
    })
    expect(movedLab.editVersion).toBe(1)
    expect(movedLab.assignments.find((a) => a.sessionId === lab.sessionId)).toMatchObject({
      teacherId: 'DOC-LAB', day: 3, startMinute: 480, endMinute: 600, roomId: 'SYN-LAB',
    })
    expect(movedLab.assignments.find((a) => a.sessionId === theory.sessionId)).toEqual(theory)
    expect(movedLab.assignments.find((a) => a.sessionId === practice.sessionId)).toEqual(practice)
    expect(movedLab.sections[0]!.responsibleTeacherId).toBe('DOC-TP')
  })

  it('scopes split-mode teacher changes to the touched group and enforces per-participant load and sectionLimits', () => {
    const service = new DemoProposalService()
    const splitGrouped = service.createProposal({
      revision: catalog.revision,
      planningPolicy: structuredClone(fisiBasePolicy),
      demands: [{
        courseId: tplCourseId,
        estimatedDemand: 25,
        targetCapacity: 30,
        deliveryMode: 'split',
        teacherAssignmentMode: 'tp-grouped-l-independent',
      }],
      resources: {
        teachers: [
          {
            id: 'DOC-A',
            name: 'Docente A',
            courseIds: [tplCourseId],
            maxWeeklyMinutes: 240,
            availability: [{ day: 1, startMinute: 480, endMinute: 600 }, { day: 3, startMinute: 480, endMinute: 600 }],
          },
          { id: 'DOC-B', name: 'Docente B', courseIds: [tplCourseId], maxWeeklyMinutes: 120, availability: [{ day: 5, startMinute: 480, endMinute: 600 }] },
          { id: 'DOC-C', name: 'Docente C', courseIds: [tplCourseId], maxWeeklyMinutes: 240, availability: structuredClone(workWindows) },
        ],
        rooms: [
          { id: 'SYN-AULA', name: 'Aula Sintetica', kind: 'classroom', capacity: 35, availability: structuredClone(workWindows) },
          { id: 'SYN-LAB', name: 'Lab Sintetico', kind: 'laboratory', capacity: 35, availability: structuredClone(workWindows) },
        ],
      },
    })
    expect(splitGrouped.status).toBe('complete')
    const theory = splitGrouped.assignments.find((a) => a.sessionType === 'T')!
    const practice = splitGrouped.assignments.find((a) => a.sessionType === 'P')!
    const lab = splitGrouped.assignments.find((a) => a.sessionType === 'L')!

    const adjustedTpGroup = service.adjustProposal(splitGrouped.proposalId, {
      expectedVersion: splitGrouped.editVersion ?? 0,
      sectionId: splitGrouped.sections[0]!.sectionId,
      sessionIds: [theory.sessionId],
      teacherId: 'DOC-C',
      day: theory.day,
      startMinute: theory.startMinute,
      roomIds: [theory.roomId],
    })
    expect(adjustedTpGroup.assignments.find((a) => a.sessionId === theory.sessionId)?.teacherId).toBe('DOC-C')
    expect(adjustedTpGroup.assignments.find((a) => a.sessionId === practice.sessionId)?.teacherId).toBe('DOC-C')
    expect(adjustedTpGroup.assignments.find((a) => a.sessionId === lab.sessionId)?.teacherId).toBe('DOC-B')
    expect(adjustedTpGroup.sections[0]!.responsibleTeacherId).toBe('DOC-C')

    const perSession = service.createProposal({
      revision: catalog.revision,
      planningPolicy: structuredClone(fisiBasePolicy),
      demands: [{
        courseId: tplCourseId,
        estimatedDemand: 25,
        targetCapacity: 30,
        deliveryMode: 'split',
        teacherAssignmentMode: 'per-session',
      }],
      resources: {
        teachers: [
          { id: 'DOC-01-T', name: 'Docente T', courseIds: [tplCourseId], maxWeeklyMinutes: 120, availability: [{ day: 1, startMinute: 480, endMinute: 600 }] },
          { id: 'DOC-02-P', name: 'Docente P', courseIds: [tplCourseId], maxWeeklyMinutes: 120, availability: [{ day: 2, startMinute: 480, endMinute: 600 }] },
          { id: 'DOC-03-L', name: 'Docente L', courseIds: [tplCourseId], maxWeeklyMinutes: 120, availability: [{ day: 3, startMinute: 480, endMinute: 600 }] },
          {
            id: 'DOC-04-CAP',
            name: 'Docente Cap 180',
            courseIds: [tplCourseId],
            maxWeeklyMinutes: 180,
            sectionLimits: [{ courseId: tplCourseId, maxSections: 1 }],
            availability: [{ day: 4, startMinute: 480, endMinute: 900 }],
          },
          {
            id: 'DOC-05-MULTI',
            name: 'Docente Cap 240',
            courseIds: [tplCourseId],
            maxWeeklyMinutes: 240,
            sectionLimits: [{ courseId: tplCourseId, maxSections: 1 }],
            availability: [{ day: 4, startMinute: 480, endMinute: 900 }],
          },
        ],
        rooms: [
          { id: 'SYN-AULA', name: 'Aula Sintetica', kind: 'classroom', capacity: 35, availability: structuredClone(workWindows) },
          { id: 'SYN-LAB', name: 'Lab Sintetico', kind: 'laboratory', capacity: 35, availability: structuredClone(workWindows) },
        ],
      },
    })
    expect(perSession.status).toBe('complete')
    expect(perSession.sections[0]!.responsibleTeacherId).toBe('DOC-01-T')
    const psT = perSession.assignments.find((a) => a.sessionType === 'T')!
    const psP = perSession.assignments.find((a) => a.sessionType === 'P')!
    const psL = perSession.assignments.find((a) => a.sessionType === 'L')!

    const psStep1 = service.adjustProposal(perSession.proposalId, {
      expectedVersion: perSession.editVersion ?? 0,
      sectionId: perSession.sections[0]!.sectionId,
      sessionIds: [psP.sessionId],
      teacherId: 'DOC-04-CAP',
      day: 4,
      startMinute: 480,
      roomIds: [psP.roomId],
    })
    expect(psStep1.assignments.find((a) => a.sessionId === psP.sessionId)?.teacherId).toBe('DOC-04-CAP')
    expect(psStep1.assignments.find((a) => a.sessionId === psT.sessionId)?.teacherId).toBe('DOC-01-T')
    expect(psStep1.assignments.find((a) => a.sessionId === psL.sessionId)?.teacherId).toBe('DOC-03-L')
    expect(psStep1.sections[0]!.responsibleTeacherId).toBe('DOC-01-T')

    let loadError: unknown
    try {
      service.adjustProposal(perSession.proposalId, {
        expectedVersion: psStep1.editVersion ?? 1,
        sectionId: perSession.sections[0]!.sectionId,
        sessionIds: [psT.sessionId],
        teacherId: 'DOC-04-CAP',
        day: 4,
        startMinute: 660,
        roomIds: [psT.roomId],
      })
    } catch (error) {
      loadError = error
    }
    expect(loadError).toMatchObject({
      status: 422,
      response: { error: { code: 'ADJUSTMENT_REJECTED', message: expect.stringMatching(/TEACHER_LOAD_EXCEEDED/) } },
    })

    const psStep2 = service.adjustProposal(perSession.proposalId, {
      expectedVersion: psStep1.editVersion ?? 1,
      sectionId: perSession.sections[0]!.sectionId,
      sessionIds: [psP.sessionId],
      teacherId: 'DOC-05-MULTI',
      day: 4,
      startMinute: 480,
      roomIds: [psP.roomId],
    })
    const psStep3 = service.adjustProposal(perSession.proposalId, {
      expectedVersion: psStep2.editVersion ?? 2,
      sectionId: perSession.sections[0]!.sectionId,
      sessionIds: [psT.sessionId],
      teacherId: 'DOC-05-MULTI',
      day: 4,
      startMinute: 660,
      roomIds: [psT.roomId],
    })
    expect(psStep3.assignments.find((a) => a.sessionId === psT.sessionId)?.teacherId).toBe('DOC-05-MULTI')
    expect(psStep3.assignments.find((a) => a.sessionId === psP.sessionId)?.teacherId).toBe('DOC-05-MULTI')
    expect(psStep3.assignments.find((a) => a.sessionId === psL.sessionId)?.teacherId).toBe('DOC-03-L')
    expect(psStep3.sections[0]!.responsibleTeacherId).toBe('DOC-05-MULTI')
  })

  it('keeps teacher review, approval, and publication coherent across partial group adjustment', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'sum-session-assignment-review-'))
    vi.stubEnv('SUM_ACADEMIC_DRAFT_DIR', directory)
    try {
      const proposalService = new DemoProposalService()
      const draftService = new SavedDraftService(proposalService)
      const configuration: AcademicWorkspace = {
        schoolId: 'SISTEMAS',
        academicPeriod: '2027-I',
        demandSourceId: 'independent-120-v1',
        demandBaseRequest: null,
        request: {
          revision: catalog.revision,
          planningPolicy: structuredClone(fisiBasePolicy),
          demands: [{
            courseId: tplCourseId,
            estimatedDemand: 25,
            targetCapacity: 30,
            deliveryMode: 'continuous',
            teacherAssignmentMode: 'tp-grouped-l-independent',
          }],
          resources: {
            teachers: [
              { id: 'DOC-TP', name: 'Docente TP', courseIds: [tplCourseId], maxWeeklyMinutes: 240, availability: [{ day: 1, startMinute: 480, endMinute: 720 }] },
              { id: 'DOC-LAB', name: 'Docente Lab', courseIds: [tplCourseId], maxWeeklyMinutes: 120, availability: [{ day: 3, startMinute: 480, endMinute: 600 }] },
              { id: 'DOC-LAB2', name: 'Docente Lab 2', courseIds: [tplCourseId], maxWeeklyMinutes: 120, availability: [{ day: 4, startMinute: 600, endMinute: 720 }] },
            ],
            rooms: [
              { id: 'SYN-AULA', name: 'Aula Sintetica', kind: 'classroom', capacity: 35, availability: structuredClone(workWindows) },
              { id: 'SYN-LAB', name: 'Lab Sintetico', kind: 'laboratory', capacity: 35, availability: structuredClone(workWindows) },
            ],
          },
        },
      }

      const proposal = proposalService.createProposal(configuration.request)
      expect(proposal.status).toBe('complete')
      expect(proposal.sections[0]!.responsibleTeacherId).toBe('DOC-TP')

      const saved = await draftService.save({
        id: null,
        expectedVersion: null,
        title: 'Grupo TP+L revision coherente',
        state: 'draft',
        configuration,
        proposalId: proposal.proposalId,
        proposalEditVersion: proposal.editVersion ?? 0,
      })

      let draft = (await draftService.submitReview(saved.id, { expectedVersion: saved.version })).draft
      expect(draft.state).toBe('in-review')
      expect(draft.review!.teachers.map((t) => t.teacherId).sort()).toEqual(['DOC-LAB', 'DOC-TP'])

      draft = (await draftService.decideReview(draft.id, {
        expectedVersion: draft.version,
        round: draft.review!.round,
        teacherId: 'DOC-TP',
        decision: 'conformity',
        observation: '',
      })).draft
      draft = (await draftService.decideReview(draft.id, {
        expectedVersion: draft.version,
        round: draft.review!.round,
        teacherId: 'DOC-LAB',
        decision: 'conformity',
        observation: '',
      })).draft
      expect(draft.state).toBe('ready-for-approval')

      const lab = proposal.assignments.find((a) => a.sessionType === 'L')!
      const adjusted = proposalService.adjustProposal(proposal.proposalId, {
        expectedVersion: proposal.editVersion ?? 0,
        sectionId: proposal.sections[0]!.sectionId,
        sessionIds: [lab.sessionId],
        teacherId: 'DOC-LAB2',
        day: 4,
        startMinute: 600,
        roomIds: ['SYN-LAB'],
      })

      const resaved = await draftService.save({
        id: draft.id,
        expectedVersion: draft.version,
        title: draft.title,
        state: 'draft',
        configuration,
        proposalId: adjusted.proposalId,
        proposalEditVersion: adjusted.editVersion ?? 1,
      })
      expect(resaved.state).toBe('in-review')
      expect(resaved.review!.teachers.find((t) => t.teacherId === 'DOC-TP')?.status).toBe('conformity')
      expect(resaved.review!.teachers.find((t) => t.teacherId === 'DOC-LAB2')?.status).toBe('pending')
      expect(resaved.review!.teachers.some((t) => t.teacherId === 'DOC-LAB')).toBe(false)

      draft = (await draftService.submitReview(resaved.id, { expectedVersion: resaved.version })).draft
      expect(draft.review!.teachers.find((t) => t.teacherId === 'DOC-TP')?.status).toBe('conformity')
      expect(draft.review!.teachers.find((t) => t.teacherId === 'DOC-LAB2')?.status).toBe('pending')

      draft = (await draftService.decideReview(draft.id, {
        expectedVersion: draft.version,
        round: draft.review!.round,
        teacherId: 'DOC-LAB2',
        decision: 'conformity',
        observation: '',
      })).draft
      expect(draft.state).toBe('ready-for-approval')

      const approved = (await draftService.approve(draft.id, { expectedVersion: draft.version })).draft
      expect(approved.state).toBe('approved')
      const published = (await draftService.publish(approved.id, { expectedVersion: approved.version, expectedCurrentId: null })).draft
      expect(published.state).toBe('published')

      const currentPub = await draftService.currentPublication()
      expect(currentPub.schedule.sections[0]!.responsibleTeacherId).toBe('DOC-TP')
      expect(currentPub.schedule.assignments.find((a) => a.sessionType === 'L')?.teacherId).toBe('DOC-LAB2')
    } finally {
      vi.unstubAllEnvs()
      const absolute = resolve(directory)
      const tempRoot = resolve(tmpdir()) + sep
      if (absolute.toLowerCase().startsWith(tempRoot.toLowerCase())
        && basename(absolute).startsWith('sum-session-assignment-review-')
        && !lstatSync(absolute).isSymbolicLink()) {
        rmSync(absolute, { recursive: true, force: true })
      }
    }
  })
})

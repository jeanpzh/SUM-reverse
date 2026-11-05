import { describe, expect, it } from 'vitest'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import type { AcademicRequest } from '../../shared/programacion-academica-api.mjs'

const catalog = createDemoCatalog()
const courseWithMinutes = (minutes: number) => catalog.courses.find((course) =>
  course.weeklySessions.reduce((sum, session) => sum + session.durationMinutes, 0) === minutes)!

function request(minutes: number, availability: Array<{ day: number; startMinute: number; endMinute: number }>): AcademicRequest {
  const course = courseWithMinutes(minutes)
  return { revision: catalog.revision, demands: [{ courseId: course.courseId, estimatedDemand: 1, targetCapacity: 45 }],
    resources: {
      teachers: [{ id: 'RESPONSIBLE', name: catalog.referenceTeachers![0].name, courseIds: [course.courseId], maxWeeklyMinutes: 1000, availability }],
      rooms: [{ id: 'LAB01NP', name: 'LAB01NP', kind: 'laboratory', capacity: 45, availability }],
    } }
}

describe('E1 default continuous policy at proposal creation and retained review', () => {
  it.each([[240, 1, 18 * 60, 22 * 60], [360, 2, 8 * 60, 14 * 60]])('places %i minutes in the requested continuous window', (minutes, day, startMinute, endMinute) => {
    const service = new DemoProposalService()
    const input = request(minutes, [{ day, startMinute, endMinute }])
    const result = service.createProposal(input)
    expect(result.status).toBe('complete')
    expect(result.coverageComplete).toBe(true)
    expect(result.sections[0].deliveryMode).toBe('continuous')
    expect(result.assignments[0].startMinute).toBe(startMinute)
    expect(result.assignments.at(-1)!.endMinute).toBe(endMinute)
    expect(new Set(result.assignments.map((session) => session.teacherId)).size).toBe(1)
    expect(result.assignments.every((session) => session.day === day)).toBe(true)
    expect(result.assignments.map((session) => session.sessionType)).toEqual(courseWithMinutes(minutes).weeklySessions.map((session) => session.type))
    for (let i = 1; i < result.assignments.length; i++) expect(result.assignments[i].startMinute).toBe(result.assignments[i - 1].endMinute)
    input.resources!.teachers[0].name = 'Edited after creation'
    expect(service.getProposal(result.proposalId)).toEqual(result)
  })

  it('requires an explicit split exception when no four-hour block exists, retaining one responsible teacher', () => {
    const service = new DemoProposalService()
    const input = request(240, [{ day: 1, startMinute: 480, endMinute: 600 }, { day: 2, startMinute: 480, endMinute: 600 }])
    const continuous = service.createProposal(input)
    expect(continuous.status).toBe('impossible')
    input.demands[0].deliveryMode = 'split'
    const split = service.createProposal(input)
    expect(split.status).toBe('complete')
    expect(split.sections[0].deliveryMode).toBe('split')
    expect(new Set(split.assignments.map((session) => session.teacherId)).size).toBe(1)
    expect(new Set(split.assignments.map((session) => session.day)).size).toBe(2)
    expect(service.getProposal(continuous.proposalId)).toEqual(continuous)
  })

  it('rejects section capacity 46 for the configured 45-place laboratory without fabricating a complete schedule', () => {
    const service = new DemoProposalService()
    const input = request(240, [{ day: 1, startMinute: 480, endMinute: 840 }])
    input.demands[0].targetCapacity = 46
    const result = service.createProposal(input)
    expect(result.status).toBe('impossible')
    expect(result.coverageComplete).toBe(false)
    expect(result.pending.length).toBeGreaterThan(0)
  })
})

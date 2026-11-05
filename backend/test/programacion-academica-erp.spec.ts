import { describe, expect, it } from 'vitest'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import type { AcademicRequest } from '../../shared/programacion-academica-api.mjs'

const catalog = createDemoCatalog()
const courseId = '20118104'
const course = catalog.courses.find((row) => row.courseId === courseId)!
const pattern = course.planningPatterns!.find((row) => row.weeklySessions.length === 2 && row.weeklySessions.every((session) => session.durationMinutes === 120))!
const windows = [1, 2, 3, 4].map((day) => ({ day, startMinute: 1080, endMinute: 1320 }))

function erpRequest(): AcademicRequest {
  return { revision: catalog.revision, demands: [{ courseId, estimatedDemand: 180, targetCapacity: 45, patternId: pattern.id, deliveryMode: 'continuous' }],
    allocationPolicy: 'preferences', resources: {
      teachers: [0, 1].map((i) => ({ id: `ERP-T${i + 1}`, name: catalog.referenceTeachers![i].name, courseIds: [courseId], maxWeeklyMinutes: 480,
        availability: structuredClone(windows), preferences: windows.slice(i * 2, i * 2 + 2), sectionLimits: [{ courseId, maxSections: 2 }] })),
      rooms: [{ id: '101AP', name: '101AP', kind: 'classroom', capacity: 45, availability: structuredClone(windows) }],
    } }
}

describe('Planeamiento de Recursos Empresariales, demanda180/capacidad45', () => {
  it('completes four sections/eight components with two shared teachers, respecting preferences and per-course limits', () => {
    const service = new DemoProposalService()
    const input = erpRequest()
    const result = service.createProposal(input)
    expect(result.status).toBe('complete')
    expect(result.counts).toEqual({ sections: 4, requiredSessions: 8, scheduledSessions: 8 })
    expect(result.preferenceReport?.withinPreferenceSections).toBe(4)
    for (const teacher of input.resources!.teachers) {
      expect(new Set(result.assignments.filter((session) => session.teacherId === teacher.id).map((session) => session.sectionId)).size).toBe(2)
    }
    for (const section of result.sections) {
      const sessions = result.assignments.filter((session) => session.sectionId === section.sectionId)
      expect(sessions).toHaveLength(2)
      expect(sessions[0].teacherId).toBe(sessions[1].teacherId)
      expect(sessions[0].day).toBe(sessions[1].day)
      expect(sessions[0].startMinute).toBe(1080)
      expect(sessions[0].endMinute).toBe(sessions[1].startMinute)
      expect(sessions[1].endMinute).toBe(1320)
    }
    input.resources!.teachers[0].preferences = []
    input.resources!.teachers[0].sectionLimits![0].maxSections = 0
    expect(service.getProposal(result.proposalId)).toEqual(result)
  })

  it('allows the same teacher to take all four sections when load, availability and configured limit permit it', () => {
    const input = erpRequest()
    input.resources!.teachers = [input.resources!.teachers[0]]
    input.resources!.teachers[0].maxWeeklyMinutes = 960
    input.resources!.teachers[0].sectionLimits = [{ courseId, maxSections: 4 }]
    input.resources!.teachers[0].preferences = structuredClone(windows)
    const result = new DemoProposalService().createProposal(input)
    expect(result.status).toBe('complete')
    expect(new Set(result.assignments.map((session) => session.teacherId)).size).toBe(1)
    expect(result.counts.scheduledSessions).toBe(8)
  })

  it('reports incompatible total teaching resources rather than a complete schedule when only two sections can be covered', () => {
    const input = erpRequest()
    input.resources!.teachers = [input.resources!.teachers[0]]
    const result = new DemoProposalService().createProposal(input)
    expect(result.status).toBe('impossible')
    expect(result.coverageComplete).toBe(false)
    expect(result.counts.sections).toBe(4)
    expect(result.pending.length).toBeGreaterThan(0)
    expect(result.diagnostics.some((row) => row.code === 'SEARCH_LIMIT')).toBe(false)
  })

  it('keeps soft preferences distinct from hard availability and returns a valid fallback without claiming optimality', () => {
    const input = erpRequest()
    for (const teacher of input.resources!.teachers) teacher.preferences = [{ day: 5, startMinute: 1080, endMinute: 1320 }]
    const result = new DemoProposalService().createProposal(input)
    expect(result.status).toBe('complete')
    expect(result.preferenceReport?.outsidePreferenceSections).toBe(4)
    expect(result.preferenceReport?.optimality).toBe('not-proven')
    expect(result.diagnostics.some((row) => row.code === 'PREFERENCES_NOT_MET')).toBe(true)
  })
})

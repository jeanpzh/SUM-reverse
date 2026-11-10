import { describe, expect, it } from 'vitest'
import { HttpException } from '@nestjs/common'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { generateAcademicSchedule } from '../src/programacion-academica/schedule-generator.js'
import { createSyntheticGeneratorInput } from '../src/programacion-academica/generator.fixtures.js'
import type { GeneratorInput, GeneratorResult, GeneratorSeed } from '../src/programacion-academica/generator.types.js'
import type { AcademicAssignment } from '../src/programacion-academica/schedule.types.js'
import type { AcademicProposal, AcademicWorkspace } from '../../shared/programacion-academica-api.mjs'

const emptySeed = (): GeneratorSeed => ({ fixedAssignments: [], excludedTeacherIds: [], sectionRoomExclusions: [] })
const sectionOf = (courseId: string, ordinal: number) => `section:${JSON.stringify([courseId, ordinal])}`
const week = [1, 2].map((day) => ({ day, startMinute: 480, endMinute: 720 }))
const sessions = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `s${index + 1}`, durationMinutes: 60 }))

/** SYN-A: two 30-seat sections, SYN-B: one section. Two interchangeable teachers and rooms. */
const base = (): GeneratorInput => ({
  courses: [
    { courseId: 'SYN-A', estimatedDemand: 60, targetCapacity: 30, weeklySessions: sessions(2) },
    { courseId: 'SYN-B', estimatedDemand: 30, targetCapacity: 30, weeklySessions: sessions(2) },
  ],
  teachers: ['T1', 'T2'].map((id) => ({ id, courseIds: ['SYN-A', 'SYN-B'], maxWeeklyMinutes: 600, availability: structuredClone(week) })),
  rooms: ['R1', 'R2'].map((id) => ({ id, capacity: 30, availability: structuredClone(week) })),
  compatibleGroups: [], windows: structuredClone(week), startStepMinutes: 60, maxExplorations: 1000,
})
const assignmentsOf = (result: GeneratorResult, sectionIds: string[]) => (result.schedule?.assignments ?? [])
  .filter((assignment) => sectionIds.includes(assignment.sectionId))

describe('F-0 generator seed', () => {
  it('R1: an absent or empty seed leaves results, statistics and diagnostics identical', () => {
    const impossible = base()
    impossible.rooms = [{ id: 'R1', capacity: 10, availability: structuredClone(week) }]
    const cases: Array<[string, () => GeneratorInput, { maxCandidateVisits?: number }]> = [
      ['synthetic fixture', createSyntheticGeneratorInput, {}],
      ['two courses', base, {}],
      ['impossible', () => impossible, {}],
      ['search limit', base, { maxCandidateVisits: 3 }],
    ]
    for (const [name, input, options] of cases) {
      const without = generateAcademicSchedule(input(), options)
      const withEmpty = generateAcademicSchedule(input(), options, emptySeed())
      expect(withEmpty, name).toEqual(without)
    }
    expect(generateAcademicSchedule(base()).status).toBe('complete')
  })

  it('R2: fixed assignments are never moved and non-fixed sections still complete', () => {
    const baseline = generateAcademicSchedule(base())
    const fixedSections = [sectionOf('SYN-A', 1), sectionOf('SYN-A', 2)]
    const fixed = assignmentsOf(baseline, fixedSections)
    expect(fixed).toHaveLength(4)
    const result = generateAcademicSchedule(base(), {}, { ...emptySeed(), fixedAssignments: structuredClone(fixed) })
    expect(result.status).toBe('complete')
    expect(result.coverage?.complete).toBe(true)
    for (const assignment of fixed) expect(result.schedule!.assignments).toContainEqual(assignment)
    expect(assignmentsOf(result, [sectionOf('SYN-B', 1)])).toHaveLength(2)
    expect(result.requirements).toHaveLength(6)
  })

  it('R3: excluded teachers and section rooms are never used for non-fixed sections', () => {
    const baseline = generateAcademicSchedule(base())
    const target = sectionOf('SYN-B', 1)
    const [first] = assignmentsOf(baseline, [target])
    const fixed = assignmentsOf(baseline, [sectionOf('SYN-A', 1), sectionOf('SYN-A', 2)])
    const seed: GeneratorSeed = { fixedAssignments: structuredClone(fixed), excludedTeacherIds: [first!.teacherId],
      sectionRoomExclusions: [{ sectionId: target, roomIds: [first!.roomId] }] }
    const result = generateAcademicSchedule(base(), {}, seed)
    expect(result.status).toBe('complete')
    const moved = assignmentsOf(result, [target])
    expect(moved).toHaveLength(2)
    expect(moved.every((assignment) => assignment.teacherId !== first!.teacherId && assignment.roomId !== first!.roomId)).toBe(true)
    for (const assignment of fixed) expect(result.schedule!.assignments).toContainEqual(assignment)
  })

  it('counts fixed sections toward teacher load', () => {
    const input = base()
    input.courses = [
      { courseId: 'SYN-A', estimatedDemand: 30, targetCapacity: 30, weeklySessions: sessions(2) },
      { courseId: 'SYN-B', estimatedDemand: 30, targetCapacity: 30, weeklySessions: sessions(2) },
    ]
    input.teachers[0]!.maxWeeklyMinutes = 120
    const baseline = generateAcademicSchedule(input)
    const fixed = assignmentsOf(baseline, [sectionOf('SYN-A', 1)])
    expect(fixed.every((assignment) => assignment.teacherId === 'T1')).toBe(true)
    const result = generateAcademicSchedule(input, {}, { ...emptySeed(), fixedAssignments: structuredClone(fixed) })
    expect(result.status).toBe('complete')
    expect(assignmentsOf(result, [sectionOf('SYN-B', 1)]).every((assignment) => assignment.teacherId === 'T2')).toBe(true)
    expect(result.rejectionCounts.TEACHER_LOAD_EXCEEDED).toBeGreaterThan(0)
  })

  describe('R4: fixed placements that block every slot', () => {
    const blocked = () => {
      const input = base()
      input.courses = [
        { courseId: 'SYN-A', estimatedDemand: 30, targetCapacity: 30, weeklySessions: sessions(4) },
        { courseId: 'SYN-B', estimatedDemand: 30, targetCapacity: 30, weeklySessions: sessions(2) },
      ]
      input.rooms = [{ id: 'R1', capacity: 30, availability: [{ day: 1, startMinute: 540, endMinute: 780 }] }]
      input.windows = [{ day: 1, startMinute: 540, endMinute: 780 }]
      input.teachers.forEach((teacher) => { teacher.availability = [{ day: 1, startMinute: 540, endMinute: 780 }] })
      const only = structuredClone(input)
      only.courses = [input.courses[0]!]
      only.teachers.forEach((teacher) => { teacher.courseIds = ['SYN-A'] })
      const fixed = assignmentsOf(generateAcademicSchedule(only), [sectionOf('SYN-A', 1)])
      return { input, fixed }
    }

    it('reports impossible with FIXED_PLACEMENTS_BLOCK as an observation', () => {
      const { input, fixed } = blocked()
      expect(fixed).toHaveLength(4)
      const result = generateAcademicSchedule(input, {}, { ...emptySeed(), fixedAssignments: structuredClone(fixed) })
      expect(result.status).toBe('impossible')
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['FINITE_DOMAIN_EXHAUSTED', 'FIXED_PLACEMENTS_BLOCK'])
      expect(result.diagnostics[1]!.sessionIds).toEqual(fixed.map((assignment) => assignment.id))
      expect(result.coverage?.complete).toBe(false)
      for (const assignment of fixed) expect(result.schedule!.assignments).toContainEqual(assignment)
      expect(assignmentsOf(result, [sectionOf('SYN-B', 1)])).toHaveLength(0)
    })

    it('does not claim impossibility or a block when the search budget runs out', () => {
      const { input, fixed } = blocked()
      const result = generateAcademicSchedule(input, { maxCandidateVisits: 0 }, { ...emptySeed(), fixedAssignments: structuredClone(fixed) })
      expect(result.status).toBe('search-limit')
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['SEARCH_LIMIT'])
    })

    it('does not blame the fixed placements when the other sections fail on their own', () => {
      const { input, fixed } = blocked()
      input.teachers.forEach((teacher) => { teacher.availability = [{ day: 1, startMinute: 540, endMinute: 780 }] })
      const result = generateAcademicSchedule(input, {}, { fixedAssignments: structuredClone(fixed), excludedTeacherIds: ['T1', 'T2'], sectionRoomExclusions: [] })
      expect(result.status).toBe('impossible')
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain('FIXED_PLACEMENTS_BLOCK')
    })
  })

  it('rejects a fixed section that does not carry all of its required sessions', () => {
    const baseline = generateAcademicSchedule(base())
    const [first] = assignmentsOf(baseline, [sectionOf('SYN-A', 1)])
    const result = generateAcademicSchedule(base(), {}, { ...emptySeed(), fixedAssignments: [structuredClone(first!)] })
    expect(result.status).toBe('invalid-input')
    expect(result.schedule).toBeNull()
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: 'FIXED_SECTION_INCOMPLETE',
      sessionIds: [`session:${JSON.stringify([sectionOf('SYN-A', 1), 's2'])}`] })])
  })

  it('rejects fixed assignments that violate a hard constraint and lists the conflicting sessions', () => {
    const baseline = generateAcademicSchedule(base())
    const a = assignmentsOf(baseline, [sectionOf('SYN-A', 1)])
    const b = assignmentsOf(baseline, [sectionOf('SYN-A', 2)]).map((assignment, index) => ({ ...structuredClone(assignment), roomId: a[index]!.roomId,
      interval: structuredClone(a[index]!.interval) }))
    const result = generateAcademicSchedule(base(), {}, { ...emptySeed(), fixedAssignments: structuredClone([...a, ...b]) })
    expect(result.status).toBe('invalid-input')
    expect(result.diagnostics[0]!.code).toBe('FIXED_ASSIGNMENT_INVALID')
    expect(result.diagnostics[0]!.sessionIds.length).toBeGreaterThanOrEqual(2)
    expect(result.diagnostics[0]!.sessionIds.every((id) => [...a, ...b].some((assignment) => assignment.id === id))).toBe(true)
  })

  it('rejects fixed assignments for unknown or repeated sessions', () => {
    const baseline = generateAcademicSchedule(base())
    const a = assignmentsOf(baseline, [sectionOf('SYN-A', 1)])
    const unknown: AcademicAssignment = { ...structuredClone(a[0]!), id: 'session:unknown' }
    const unknownResult = generateAcademicSchedule(base(), {}, { ...emptySeed(), fixedAssignments: [...structuredClone(a), unknown] })
    expect(unknownResult.status).toBe('invalid-input')
    expect(unknownResult.diagnostics[0]).toMatchObject({ code: 'FIXED_ASSIGNMENT_INVALID', sessionIds: ['session:unknown'] })
    const repeated = generateAcademicSchedule(base(), {}, { ...emptySeed(), fixedAssignments: [...structuredClone(a), structuredClone(a[0]!)] })
    expect(repeated.diagnostics[0]!.code).toBe('FIXED_ASSIGNMENT_INVALID')
  })

  it('treats a malformed seed as a programming error', () => {
    expect(() => generateAcademicSchedule(base(), {}, { fixedAssignments: [], excludedTeacherIds: 'T1' } as unknown as GeneratorSeed)).toThrow(TypeError)
  })
})

describe('F-0 per-section capacity in the generator', () => {
  const withOverrides = (sectionCapacities: unknown) => {
    const input = base()
    ;(input.courses[0] as Record<string, unknown>).sectionCapacities = sectionCapacities
    return input
  }

  it('assigns the override to its section only and keeps targetCapacity for the rest', () => {
    const result = generateAcademicSchedule(withOverrides([{ ordinal: 2, capacity: 20 }]))
    expect(result.status).toBe('complete')
    expect(result.schedule!.sections.map((section) => [section.id, section.capacity])).toEqual([
      [sectionOf('SYN-A', 1), 30], [sectionOf('SYN-A', 2), 20], [sectionOf('SYN-B', 1), 30]])
  })

  it('R5: an override above every room capacity is enforced as ROOM_CAPACITY', () => {
    const result = generateAcademicSchedule(withOverrides([{ ordinal: 2, capacity: 31 }]))
    expect(result.status).toBe('impossible')
    expect(result.diagnostics[0]!.code).toBe('ROOM_CAPACITY')
    expect(result.rejectionCounts.ROOM_CAPACITY).toBeGreaterThan(0)
  })

  it('R5: an override above one room but within another is placed in the larger room', () => {
    const input = withOverrides([{ ordinal: 2, capacity: 40 }])
    input.rooms = [{ id: 'R1', capacity: 30, availability: structuredClone(week) }, { id: 'R2', capacity: 45, availability: structuredClone(week) }]
    const result = generateAcademicSchedule(input)
    expect(result.status).toBe('complete')
    expect(assignmentsOf(result, [sectionOf('SYN-A', 2)]).every((assignment) => assignment.roomId === 'R2')).toBe(true)
  })

  it('rejects invalid overrides as invalid input', () => {
    for (const overrides of [
      [{ ordinal: 0, capacity: 10 }], [{ ordinal: 3, capacity: 10 }], [{ ordinal: 1, capacity: 1001 }], [{ ordinal: 1, capacity: 0 }],
      [{ ordinal: 1, capacity: 10 }, { ordinal: 1, capacity: 12 }], [{ ordinal: 1, capacity: 10, extra: true }], 'x',
    ]) {
      const result = generateAcademicSchedule(withOverrides(overrides))
      expect(result.status, JSON.stringify(overrides)).toBe('invalid-input')
      expect(result.diagnostics[0]!.code).toBe('INVALID_INPUT')
    }
  })
})

const catalog = createDemoCatalog()
const manualCourse = catalog.courses.find((candidate) => candidate.courseId === '20118104')!
const pattern = manualCourse.planningPatterns!.find((candidate) => candidate.weeklySessions.length === 2
  && candidate.weeklySessions.every((session) => session.durationMinutes === 120))!
const workWindows = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 }))
const serviceWorkspace = (demand: Partial<AcademicWorkspace['request']['demands'][number]> = {}): AcademicWorkspace => ({
  schoolId: 'SISTEMAS', academicPeriod: '2027-I', demandSourceId: 'independent-120-v1', demandBaseRequest: null,
  request: { revision: catalog.revision, allocationPolicy: 'preferences',
    demands: [{ courseId: manualCourse.courseId, estimatedDemand: 90, targetCapacity: 45, patternId: pattern.id, ...demand }],
    resources: {
      teachers: ['A', 'B'].map((suffix) => ({ id: `SYN-TEACHER-${suffix}`, name: `Synthetic teacher ${suffix}`, courseIds: [manualCourse.courseId],
        maxWeeklyMinutes: 600, availability: structuredClone(workWindows) })),
      rooms: ['1', '2'].map((suffix) => ({ id: `SYN-ROOM-${suffix}`, name: `Synthetic classroom ${suffix}`, kind: 'classroom' as const, capacity: 45,
        availability: structuredClone(workWindows) })),
    } },
})
const toAssignment = (assignment: AcademicProposal['assignments'][number]): AcademicAssignment => ({
  id: assignment.sessionId, sectionId: assignment.sectionId, teacherId: assignment.teacherId, roomId: assignment.roomId,
  interval: { day: assignment.day as 1, startMinute: assignment.startMinute, endMinute: assignment.endMinute },
  ...(assignment.sessionType ? { sessionType: assignment.sessionType } : {}),
})
const thrown = (action: () => unknown): HttpException => {
  try { action() } catch (error) {
    if (error instanceof HttpException) return error
    throw error
  }
  throw new Error('Se esperaba una excepción HTTP')
}
const errorCode = (error: HttpException) => (error.getResponse() as { error: { code: string } }).error.code
const retained = (service: DemoProposalService) => (service as unknown as { proposals: Map<string, unknown> }).proposals

describe('F-0 per-section capacity through the service', () => {
  it('creates sections with their effective capacity and retains them across capture and restore', () => {
    const service = new DemoProposalService()
    const workspace = serviceWorkspace({ sectionCapacities: [{ ordinal: 2, capacity: 30 }] })
    const view = service.createProposal(workspace.request)
    expect(view.status).toBe('complete')
    expect(view.sections.map((section) => section.capacity)).toEqual([45, 30])
    const retention = service.captureDraftRetention(view.proposalId, 0, workspace)
    expect(retention.view.sections.map((section) => section.capacity)).toEqual([45, 30])
    const restored = service.restoreDraftRetention(retention, workspace)
    expect(restored.sections.map((section) => section.capacity)).toEqual([45, 30])
    const changed = serviceWorkspace()
    expect(errorCode(thrown(() => service.captureDraftRetention(view.proposalId, 0, changed)))).toBe('DRAFT_CONFIGURATION_MISMATCH')
  })

  it('R5: enforces ROOM_CAPACITY on the effective capacity', () => {
    const view = new DemoProposalService().createProposal(serviceWorkspace({ sectionCapacities: [{ ordinal: 2, capacity: 46 }] }).request)
    expect(view.status).toBe('impossible')
    expect(view.diagnostics[0]!.code).toBe('ROOM_CAPACITY')
  })

  it('R5: an ordinal above the section count is 400 INVALID_REQUEST at the HTTP boundary', () => {
    const service = new DemoProposalService()
    const explicit = thrown(() => service.createProposal(serviceWorkspace({ sectionCapacities: [{ ordinal: 3, capacity: 10 }] }).request))
    expect([explicit.getStatus(), errorCode(explicit)]).toEqual([400, 'INVALID_REQUEST'])
    // Without an explicit targetCapacity the count depends on the catalog default, which only the service can see.
    const implicit = thrown(() => service.createProposal({ revision: catalog.revision, demands: [{ courseId: manualCourse.courseId,
      estimatedDemand: 1, sectionCapacities: [{ ordinal: 2, capacity: 10 }] }] }))
    expect([implicit.getStatus(), errorCode(implicit)]).toEqual([400, 'INVALID_REQUEST'])
  })

  it('R5: an ordinal above the section count inside a draft is 422 DRAFT_CONFIGURATION_INVALID', () => {
    const service = new DemoProposalService()
    const explicit = thrown(() => service.validateDraftWorkspace(serviceWorkspace({ sectionCapacities: [{ ordinal: 3, capacity: 10 }] })))
    expect([explicit.getStatus(), errorCode(explicit)]).toEqual([422, 'DRAFT_CONFIGURATION_INVALID'])
    const implicit = serviceWorkspace({ estimatedDemand: 1, sectionCapacities: [{ ordinal: 2, capacity: 10 }] })
    delete implicit.request.demands[0]!.targetCapacity
    expect(errorCode(thrown(() => service.validateDraftWorkspace(implicit)))).toBe('DRAFT_CONFIGURATION_INVALID')
  })

  it('an absent key keeps the existing behavior', () => {
    const service = new DemoProposalService()
    const workspace = serviceWorkspace()
    const view = service.createProposal(workspace.request)
    expect(view.sections.map((section) => section.capacity)).toEqual([45, 45])
    expect(() => service.captureDraftRetention(view.proposalId, 0, workspace)).not.toThrow()
  })
})

describe('F-0 DemoProposalService.regenerateRetention', () => {
  const setup = () => {
    const service = new DemoProposalService()
    const workspace = serviceWorkspace()
    const baseline = service.createProposal(workspace.request)
    return { service, workspace, baseline }
  }

  it('R1: an empty seed reproduces createProposal', () => {
    const { service, workspace, baseline } = setup()
    const regenerated = service.regenerateRetention(workspace, emptySeed())
    expect(regenerated.status).toBe('complete')
    const { proposalId: _a, createdAt: _b, expiresAt: _c, ...expected } = baseline
    const { proposalId: _d, createdAt: _e, expiresAt: _f, ...actual } = regenerated.view
    expect(actual).toEqual(expected)
  })

  it('R2/R3: keeps fixed sections byte-identical, honors exclusions and builds a restorable retention', () => {
    const { service, workspace, baseline } = setup()
    const fixedSection = baseline.sections[0]!.sectionId
    const target = baseline.sections[1]!.sectionId
    const targetFirst = baseline.assignments.find((assignment) => assignment.sectionId === target)!
    const stored = retained(service).size
    const regenerated = service.regenerateRetention(workspace, {
      fixedAssignments: baseline.assignments.filter((assignment) => assignment.sectionId === fixedSection).map(toAssignment),
      excludedTeacherIds: [targetFirst.teacherId],
      sectionRoomExclusions: [{ sectionId: target, roomIds: [targetFirst.roomId] }],
    })
    expect(regenerated.status).toBe('complete')
    expect(regenerated.retention).not.toBeNull()
    expect(retained(service).size).toBe(stored)
    const view = regenerated.retention!.view
    expect(view.assignments.filter((assignment) => assignment.sectionId === fixedSection))
      .toEqual(baseline.assignments.filter((assignment) => assignment.sectionId === fixedSection))
    const moved = view.assignments.filter((assignment) => assignment.sectionId === target)
    expect(moved).toHaveLength(2)
    expect(moved.every((assignment) => assignment.teacherId !== targetFirst.teacherId && assignment.roomId !== targetFirst.roomId)).toBe(true)
    expect(view.editVersion).toBe(0)
    expect(view.manuallyAdjustedSectionIds).toEqual([])
    expect(view.coverageComplete).toBe(true)
    expect(regenerated.retention!.automaticView).toEqual(view)
    expect(regenerated.retention!.automaticView).not.toBe(view)
    expect(regenerated.view.assignments).toEqual(view.assignments)
    const restored = service.restoreDraftRetention(regenerated.retention!, workspace)
    expect(restored.assignments).toEqual(view.assignments)
  })

  it('returns no retention unless the status is complete', () => {
    const { service, workspace, baseline } = setup()
    const regenerated = service.regenerateRetention(workspace, {
      fixedAssignments: baseline.assignments.filter((assignment) => assignment.sectionId === baseline.sections[0]!.sectionId).map(toAssignment),
      excludedTeacherIds: ['SYN-TEACHER-A', 'SYN-TEACHER-B'], sectionRoomExclusions: [],
    })
    expect(regenerated.status).toBe('impossible')
    expect(regenerated.retention).toBeNull()
    expect(regenerated.view.coverageComplete).toBe(false)
    expect(regenerated.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain('FIXED_PLACEMENTS_BLOCK')
    expect(regenerated.view.pending.length).toBeGreaterThan(0)
  })

  it('surfaces generator invalid-input diagnostics without a retention', () => {
    const { service, workspace, baseline } = setup()
    const [first] = baseline.assignments.filter((assignment) => assignment.sectionId === baseline.sections[0]!.sectionId)
    const regenerated = service.regenerateRetention(workspace, { ...emptySeed(), fixedAssignments: [toAssignment(first!)] })
    expect(regenerated.status).toBe('invalid-input')
    expect(regenerated.retention).toBeNull()
    expect(regenerated.diagnostics[0]!.code).toBe('FIXED_SECTION_INCOMPLETE')
  })

  it('validates the workspace like a saved draft', () => {
    const { service, workspace } = setup()
    workspace.request.revision = 'stale'
    expect(thrown(() => service.regenerateRetention(workspace, emptySeed())).getStatus()).toBeGreaterThanOrEqual(409)
  })
})

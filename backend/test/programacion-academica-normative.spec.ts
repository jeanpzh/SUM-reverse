import { afterEach, expect, it, vi } from 'vitest'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { validateAcademicProposal } from '../../shared/programacion-academica-api.mjs'
import type { AcademicRequest } from '../../shared/programacion-academica-api.mjs'

// Independently constructed synthetic resource; course/pattern comes from the synthetic demo catalog.
function fixture(): AcademicRequest {
  const catalog = new DemoProposalService().getCatalog()
  const course = catalog.courses.find((c) => c.weeklySessions.reduce((n, s) => n + s.durationMinutes, 0) <= 720)!
  return { revision: catalog.revision, academicPeriod: '2027-I', lectiveHourMinutes: 60,
    demands: [{ courseId: course.courseId, estimatedDemand: 1, targetCapacity: 45 }],
    resources: { teachers: [{ id: 'SYN-T', name: 'Synthetic teacher', courseIds: [course.courseId], maxWeeklyMinutes: 9999,
      regime: 'dedicacion-exclusiva', appointment: 'faculty-ordinary', category: 'principal',
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })) }],
    rooms: [{ id: 'SYN-R', name: 'Synthetic room', capacity: 45,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })) }] } }
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

it.each(['dedicacion-exclusiva', 'tiempo-completo'] as const)('resolves %s before the engine and retains legacy gaps', async (regime) => {
  const request = fixture()
  request.resources!.teachers[0].regime = regime
  let payload: any
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    payload = JSON.parse(init.body)
    return new Response('{}', { status: 503 })
  }))
  vi.stubEnv('SUM_PLANNING_ENGINE_URL', 'http://127.0.0.1:3220')
  const service = new DemoProposalService()
  const ordinary = await service.createProposalAsync(request)
  expect(payload.teachers[0]).toMatchObject({ maxWeeklyMinutes: 720, exceptionMaxWeeklyMinutes: 1200,
    exceptionKind: 'voluntary-declaration', appointmentTier: 0, categoryRank: regime === 'dedicacion-exclusiva' ? 1 : 2 })
  expect(ordinary.normative?.blockers).toEqual([])
  request.resources!.teachers[0].loadAuthorizations = [{ kind: 'voluntary-declaration', reference: 'SYN-DECLARATION' }]
  await service.createProposalAsync(request)
  expect(payload.teachers[0].maxWeeklyMinutes).toBe(1200)
  expect(payload.teachers[0].exceptionMaxWeeklyMinutes).toBeUndefined()
  delete request.resources!.teachers[0].regime
  const legacy = await service.createProposalAsync(request)
  expect(payload.teachers[0].maxWeeklyMinutes).toBe(9999)
  expect(legacy.normative?.gaps).toContainEqual(expect.objectContaining({ code: 'REGIME_MISSING', teacherIds: ['SYN-T'] }))
  delete request.lectiveHourMinutes
  request.resources!.teachers[0].regime = regime
  const noDuration = await service.createProposalAsync(request)
  expect(payload.teachers[0].maxWeeklyMinutes).toBe(9999)
  expect(noDuration.normative?.gaps).toContainEqual(expect.objectContaining({ code: 'LECTIVE_HOUR_MINUTES_MISSING' }))
  request.lectiveHourMinutes = 60
  request.academicPeriod = '2026-I'
  const oldPeriod = await service.createProposalAsync(request)
  expect(payload.teachers[0].maxWeeklyMinutes).toBe(9999)
  expect(oldPeriod.normative?.profileRevision).toBeNull()
  expect(oldPeriod.normative?.gaps).toContainEqual(expect.objectContaining({ code: 'NORMATIVE_PROFILE_PERIOD_BEFORE_VALIDITY' }))
  expect(oldPeriod.coverageProof).toBeUndefined()
  expect(() => validateAcademicProposal(oldPeriod)).not.toThrow()
})

it('forwards solver proof and decisions with formal requirements, including future window decisions', async () => {
  vi.stubEnv('SUM_PLANNING_ENGINE_URL', 'http://127.0.0.1:3220')
  const request = fixture()
  const fallback = new DemoProposalService().createProposal(request)
  const proof = { coverageProof: 'complete', capacityCertificate: { proven: true, requiredSectionsTotal: 1,
    coverableSectionsTotal: 1, courses: [{ courseId: request.demands[0].courseId, requiredSections: 1, coverableSections: 1, requiredMinutes: 60 }] },
    decisions: [
      { id: 'exception:SYN-T', kind: 'teacher-load-exception', teacherId: 'SYN-T', courseIds: [request.demands[0].courseId],
        exceptionKind: 'voluntary-declaration', additionalMinutes: 60, sectionsUnlocked: 1, basis: 'capacity-relaxation' },
      { id: 'window', kind: 'planning-window', teacherId: null, courseIds: [request.demands[0].courseId], exceptionKind: null,
        additionalMinutes: 0, sectionsUnlocked: 1, basis: 'window-precheck', policyChange: { allowAfternoon: true } },
      { id: 'split', kind: 'delivery-mode-split', teacherId: null, courseIds: [request.demands[0].courseId], exceptionKind: null,
        additionalMinutes: 0, sectionsUnlocked: 1, basis: 'window-precheck' },
    ], prelation: { levels: [{ id: 'contract-sections', value: 0, proven: true }] } }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...proof, status: 'complete',
    assignments: fallback.assignments.map((a) => ({ id: a.sessionId, sectionId: a.sectionId, teacherId: a.teacherId, roomId: a.roomId,
      interval: { day: a.day, startMinute: a.startMinute, endMinute: a.endMinute }, ...(a.sessionType ? { sessionType: a.sessionType } : {}) })),
    exploredCandidates: 1, candidateVisits: 1, backtracks: 0, limitReason: null, diagnostics: [] }))))
  const proposal = await new DemoProposalService().createProposalAsync(request)
  expect(proposal.coverageProof).toBe('complete')
  expect(proposal.capacityCertificate).toEqual(proof.capacityCertificate)
  expect(proposal.prelation).toEqual(proof.prelation)
  expect(proposal.decisions?.[0]).toMatchObject({ requires: expect.arrayContaining(['Declaración jurada de carácter voluntario y sin compensación adicional']), sourceIds: ['OF-02'] })
  expect(proposal.decisions?.slice(1)).toEqual(proof.decisions.slice(1))
  expect(() => validateAcademicProposal(proposal)).not.toThrow()
})

it('sends resolved caps through the engine adapter injected fetch seam', async () => {
  const { trySolveWithPythonEngine } = await import('../src/programacion-academica/planning-engine.client.js')
  const service = new DemoProposalService()
  const request = fixture()
  const proposal = service.createProposal(request)
  const snapshot = service.captureDraftRetention(proposal.proposalId, 0, { schoolId: 'SISTEMAS', academicPeriod: '2027-I', lectiveHourMinutes: 60,
    demandSourceId: 'independent-120-v1', demandBaseRequest: null, request: { ...request, resources: request.resources! } })
  let captured: Record<string, unknown> | undefined
  const fetchImpl = (async (_url, init) => {
    captured = JSON.parse(init!.body as string)
    return new Response('{}', { status: 503 })
  }) as typeof fetch
  vi.stubEnv('SUM_PLANNING_ENGINE_URL', 'http://127.0.0.1:3220')
  expect(await trySolveWithPythonEngine(snapshot.input, service.getCatalog(), snapshot.resources, fetchImpl)).toBeNull()
  expect(captured?.teachers).toEqual([expect.objectContaining({ maxWeeklyMinutes: 720, exceptionMaxWeeklyMinutes: 1200, exceptionKind: 'voluntary-declaration' })])
})

it('manual assignment changes recompute the normative report and enforce the resolved cap', () => {
  const service = new DemoProposalService()
  const request = fixture()
  const course = service.getCatalog().courses.find((c) => c.weeklySessions.reduce((n, s) => n + s.durationMinutes, 0) === 240)!
  request.demands = [{ courseId: course.courseId, estimatedDemand: 4, targetCapacity: 1 }]
  request.resources!.teachers[0].courseIds = [course.courseId]
  request.resources!.teachers.push({ ...structuredClone(request.resources!.teachers[0]), id: 'SYN-U', name: 'Synthetic other teacher' })
  let proposal = service.createProposal(request)
  expect(proposal.status).toBe('complete')
  const minutes = (teacherId: string) => proposal.assignments.filter((a) => a.teacherId === teacherId).reduce((n, a) => n + a.endMinute - a.startMinute, 0)
  const target = minutes('SYN-T') < minutes('SYN-U') ? 'SYN-T' : 'SYN-U'
  const sections = proposal.sections.filter((section) => proposal.assignments.some((a) => a.sectionId === section.sectionId && a.teacherId !== target))
  for (const [index, section] of sections.entries()) {
    const assignments = proposal.assignments.filter((a) => a.sectionId === section.sectionId).sort((a, b) => a.startMinute - b.startMinute)
    const adjustment = { expectedVersion: proposal.editVersion, sectionId: section.sectionId, sessionIds: assignments.map((a) => a.sessionId), teacherId: target,
      roomIds: assignments.map((a) => a.roomId), day: assignments[0].day, startMinute: assignments[0].startMinute }
    if (index === sections.length - 1) {
      expect(() => service.adjustProposal(proposal.proposalId, adjustment)).toThrow()
    } else {
      proposal = service.adjustProposal(proposal.proposalId, adjustment)
      expect(proposal.normative?.blockers).toEqual([])
      expect(proposal.normative?.lectiveHourMinutes).toBe(60)
      expect(minutes(target)).toBeLessThanOrEqual(720)
      expect(() => validateAcademicProposal(proposal)).not.toThrow()
    }
  }
})

it('retains workspace lective context when manually adjusting a resumed legacy request', () => {
  const service = new DemoProposalService()
  const request = fixture()
  delete request.lectiveHourMinutes
  delete request.resources!.teachers[0].regime
  const original = service.createProposal(request)
  const workspace = { schoolId: 'SISTEMAS' as const, academicPeriod: '2027-I' as const, lectiveHourMinutes: 60 as const,
    demandSourceId: 'independent-120-v1' as const, demandBaseRequest: null, request: { ...request, resources: request.resources! } }
  const snapshot = service.captureDraftRetention(original.proposalId, 0, workspace)
  const resumed = service.restoreDraftRetention(snapshot, workspace)
  expect(resumed.normative?.lectiveHourMinutes).toBe(60)
  const assignments = [...resumed.assignments].sort((a, b) => a.startMinute - b.startMinute)
  const adjusted = service.adjustProposal(resumed.proposalId, { expectedVersion: 0, sectionId: resumed.sections[0].sectionId,
    sessionIds: assignments.map((a) => a.sessionId), teacherId: assignments[0].teacherId, roomIds: assignments.map((a) => a.roomId),
    day: assignments[0].day === 1 ? 2 : 1, startMinute: assignments[0].startMinute })
  expect(adjusted.normative?.lectiveHourMinutes).toBe(60)
  expect(adjusted.normative?.gaps.some((g) => g.code === 'LECTIVE_HOUR_MINUTES_MISSING')).toBe(false)
})

import { afterEach, expect, it, vi } from 'vitest'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { analyzeProposalAdvisor } from '../src/programacion-academica/planning-engine.client.js'
import { resolvePlanningNormative } from '../src/programacion-academica/normative-planning.js'
import type { AcademicProposal } from '../../shared/programacion-academica-api.mjs'
import type { GeneratorInput } from '../src/programacion-academica/generator.types.js'

// Independently constructed synthetic resources and decisions; no private snapshots.
function fixture() {
  const service = new DemoProposalService()
  const catalog = service.getCatalog()
  const courseId = catalog.courses[0].courseId
  const resources = { teachers: [{ id: 'SYN-T', name: 'Synthetic', courseIds: [courseId], maxWeeklyMinutes: 60,
    regime: 'tiempo-completo' as const, appointment: 'faculty-ordinary' as const, category: 'principal' as const, availability: [] }], rooms: [] }
  const request = { revision: catalog.revision, academicPeriod: '2027-I' as const, lectiveHourMinutes: 60 as const,
    demands: [{ courseId, estimatedDemand: 1 }], resources }
  const resolved = resolvePlanningNormative(request, resources.teachers)
  const proposal: AcademicProposal = { ...service.createProposal(request), decisions: [], coverageProof: 'inconclusive',
    capacityCertificate: { proven: true, requiredSectionsTotal: 1, coverableSectionsTotal: 0, courses: [] }, normative: resolved.report([]) }
  const input: GeneratorInput = { teachers: resolved.teachers, rooms: [], courses: [], compatibleGroups: [], windows: [], startStepMinutes: 30, maxExplorations: 1 }
  const decision = (id: string, fields: Partial<NonNullable<AcademicProposal['decisions']>[number]>) => ({ id, kind: 'teacher-load-exception' as const,
    teacherId: 'SYN-T', courseIds: [courseId], exceptionKind: 'configuration-adjustment' as const, additionalMinutes: 60,
    sectionsUnlocked: 1, basis: 'capacity-relaxation' as const, ...fields })
  return { service, catalog, resources, proposal, input, decision }
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
it('maps exact retained decisions without any HTTP, simulation or guessed Saturday', () => {
  const { catalog, resources, proposal, input, decision } = fixture()
  const network = vi.fn(() => { throw new Error('No network permitted') })
  vi.stubGlobal('fetch', network)
  proposal.decisions = [decision('load', {}), decision('window', { kind: 'planning-window', policyChange: { allowAfternoon: true } }),
    decision('split', { kind: 'delivery-mode-split' }), decision('formal', { exceptionKind: 'voluntary-declaration', requires: ['declaration'], sourceIds: ['norm'] }),
    decision('resource', { kind: 'additional-teacher' })]
  catalog.referenceTeachers = [{ id: 'SYN-REF', name: 'Reference', courseIds: proposal.decisions[0].courseIds }]
  const result = analyzeProposalAdvisor(proposal, input, resources, catalog)
  expect(result.source).toEqual({ mode: 'engine-decisions', providerLabel: null })
  expect(result.recommendations.map(r => r.decisionIds)).toEqual([['load'], ['window'], ['split'], ['resource']])
  expect(result.recommendations[0].patch).toEqual({ kind: 'increase_teacher_load', adjustments: [{ teacherId: 'SYN-T', previousMaxWeeklyMinutes: 60, nextMaxWeeklyMinutes: 120 }] })
  expect(result.recommendations[1].patch).toEqual({ kind: 'enable_planning_window', allowAfternoon: true })
  expect(result.bottlenecks[3].detail).toContain('declaration')
  expect(result.bottlenecks[4].detail).toContain('faltan disponibilidad')
  expect(result.verifiedImpact).toBeUndefined()
  expect(network).not.toHaveBeenCalled()
})
it('does not substitute authorization, overrun the cap or invent missing resources', () => {
  const { catalog, resources, proposal, input, decision } = fixture()
  proposal.decisions = [decision('too-much', { additionalMinutes: 1000 }), decision('resource', { kind: 'additional-teacher' })]
  catalog.referenceTeachers = []
  expect(analyzeProposalAdvisor(proposal, input, resources, catalog).recommendations).toEqual([])
  input.teachers[0].configurationMaxWeeklyMinutes = undefined
  proposal.decisions = [decision('no-cap', {})]
  expect(analyzeProposalAdvisor(proposal, input, resources, catalog).recommendations).toEqual([])
  catalog.referenceTeachers = [{ id: 'DUP', name: 'Synthetic', courseIds: [] }, { id: 'DUP', name: 'Synthetic', courseIds: [] }]
  expect(() => analyzeProposalAdvisor(proposal, input, resources, catalog)).toThrow()
})
it('distinguishes missing analysis, empty complete and empty inconclusive', () => {
  const { catalog, resources, proposal, input } = fixture()
  expect(analyzeProposalAdvisor({ ...proposal, decisions: undefined }, input, resources, catalog).summary).toContain('Falta el análisis')
  expect(analyzeProposalAdvisor({ ...proposal, coverageProof: 'complete' }, input, resources, catalog).summary).toContain('Cobertura completa')
  expect(analyzeProposalAdvisor(proposal, input, resources, catalog).summary).toContain('inconcluso')
})
it('service retains CAS and rejects unknown/duplicate selections without a network call', async () => {
  const { service, proposal } = fixture()
  await expect(service.adviseProposal(proposal.proposalId, { expectedEditVersion: 1 })).rejects.toMatchObject({ status: 409 })
  await expect(service.adviseProposal(proposal.proposalId, { expectedEditVersion: 0, selectedRecommendationIds: ['old'] })).rejects.toMatchObject({ status: 400 })
  await expect(service.adviseProposal(proposal.proposalId, { expectedEditVersion: 0, selectedRecommendationIds: ['old', 'old'] })).rejects.toMatchObject({ status: 400 })
  expect((await service.adviseProposal(proposal.proposalId, { expectedEditVersion: 0, selectedRecommendationIds: [] })).recommendations).toEqual([])
  const retained = (service as unknown as { proposals: Map<string, { view: AcademicProposal }> }).proposals.get(proposal.proposalId)!
  retained.view.normative!.profileRevision = 'SYN-OBSOLETE-PROFILE'
  await expect(service.adviseProposal(proposal.proposalId, { expectedEditVersion: 0 })).rejects.toMatchObject({ status: 409 })
})
it('advisor refuses running and unresolved-cleanup jobs using the existing lifecycle gate', async () => {
  const { service, proposal } = fixture()
  // Synthetic lifecycle injection isolates the advisor gate. The actual protocol has its T4b suite.
  const searches = (service as unknown as { searches: Map<string, unknown> }).searches
  for (const state of [{ cleanupPending: false, snapshot: { state: 'running' } }, { cleanupPending: true, snapshot: { state: 'failed' } }]) {
    searches.set('SYN-JOB', { proposalId: proposal.proposalId, ...state, createdAt: Date.now() })
    await expect(service.adviseProposal(proposal.proposalId, { expectedEditVersion: 0 })).rejects.toMatchObject({ status: 409 })
  }
  searches.clear()
})

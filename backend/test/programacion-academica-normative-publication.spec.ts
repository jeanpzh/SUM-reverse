import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { SavedDraftService } from '../src/programacion-academica/saved-draft.service.js'
import type { AcademicTeacherResource, AcademicWorkspace } from '../../shared/programacion-academica-api.mjs'

// Synthetic historical-source adapter: models a persisted schedule prepared by the old
// generator using declared caps. Only preparation uses old behavior; publication uses
// the actual SavedDraftService, validators, review, approval and filesystem store.
class HistoricalProposalSource extends DemoProposalService {
  override validateDraftWorkspace(workspace: AcademicWorkspace) {
    return super.validateDraftWorkspace({ ...workspace, lectiveHourMinutes: undefined })
  }
}
const configurationRegime = (fields: Partial<AcademicTeacherResource>) => Object.hasOwn(fields, 'regime') ? fields.regime : 'tiempo-completo'
const directories: string[] = []
afterEach(() => { directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })); vi.unstubAllEnvs() })

async function approvedFixture(teacherFields: Partial<AcademicTeacherResource>, duration: 60 | null = 60, demand = 4, sectionMinutes = 240) {
  const directory = mkdtempSync(join(tmpdir(), 'sum-academic-normative-publication-'))
  directories.push(directory)
  vi.stubEnv('SUM_ACADEMIC_DRAFT_DIR', directory)
  const proposals = new HistoricalProposalSource()
  const catalog = proposals.getCatalog()
  const course = catalog.courses.find((c) => c.weeklySessions.reduce((n, s) => n + s.durationMinutes, 0) === sectionMinutes)!
  const availability = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 }))
  const configuration: AcademicWorkspace = { schoolId: 'SISTEMAS', academicPeriod: '2027-I', lectiveHourMinutes: duration ?? undefined,
    demandSourceId: 'independent-120-v1', demandBaseRequest: null,
    request: { revision: catalog.revision, demands: [{ courseId: course.courseId, estimatedDemand: demand, targetCapacity: 1 }], resources: {
      teachers: [{ id: 'SYN-T', name: 'Synthetic historical teacher', courseIds: [course.courseId], maxWeeklyMinutes: 9999,
        availability, regime: 'tiempo-completo', appointment: 'faculty-ordinary', category: 'principal', ...teacherFields }],
      rooms: [{ id: 'SYN-R', name: 'Synthetic room', capacity: 45, availability }],
    } } }
  if (teacherFields.regime === undefined && Object.hasOwn(teacherFields, 'regime')) delete configuration.request.resources.teachers[0].regime
  if (duration === null) delete configuration.lectiveHourMinutes
  if (Object.hasOwn(teacherFields, 'appointment') && teacherFields.appointment === undefined) delete configuration.request.resources.teachers[0].appointment
  // No duration on the old generator request. The historical workspace did record it.
  const generated = proposals.createProposal(configuration.request)
  expect(generated.status).toBe('complete')
  expect(generated.assignments.reduce((n, a) => n + a.endMinute - a.startMinute, 0)).toBe(sectionMinutes * demand)
  const service = new SavedDraftService(proposals)
  let draft = await service.save({ id: null, expectedVersion: null, title: 'Synthetic historical schedule', state: 'draft',
    configuration, proposalId: generated.proposalId, proposalEditVersion: 0 })
  draft = (await service.submitReview(draft.id, { expectedVersion: draft.version })).draft
  draft = (await service.decideReview(draft.id, { expectedVersion: draft.version, round: draft.review!.round,
    teacherId: 'SYN-T', decision: 'conformity', observation: '' })).draft
  draft = (await service.approve(draft.id, { expectedVersion: draft.version })).draft
  return { draft, service }
}

it('rejects an approved schedule lacking formal load authorization, then accepts matching recorded authorization', async () => {
  const unauthorized = await approvedFixture({})
  await expect(unauthorized.service.publish(unauthorized.draft.id, { expectedVersion: unauthorized.draft.version, expectedCurrentId: null }))
    .rejects.toMatchObject({ status: 409, response: { error: { code: 'LOAD_AUTHORIZATION_REQUIRED', blockers: [
      { teacherId: 'SYN-T', assignedMinutes: 960, authorizedMaxMinutes: 720, reason: 'over-authorized-load',
        requiredAuthorization: 'voluntary-declaration', sourceIds: ['OF-02'] },
    ] } } })
  const authorized = await approvedFixture({ loadAuthorizations: [{ kind: 'voluntary-declaration', reference: 'SYN-DECLARATION' }] })
  expect((await authorized.service.publish(authorized.draft.id, { expectedVersion: authorized.draft.version, expectedCurrentId: null })).draft.state).toBe('published')
})

it('rejects load on an on-leave teacher regardless of a declaration', async () => {
  const { draft, service } = await approvedFixture({ loadConditions: ['on-leave'], loadAuthorizations: [{ kind: 'voluntary-declaration', reference: 'SYN-DECLARATION' }] })
  await expect(service.publish(draft.id, { expectedVersion: draft.version, expectedCurrentId: null })).rejects.toMatchObject({ status: 409,
    response: { error: { code: 'LOAD_AUTHORIZATION_REQUIRED', blockers: [expect.objectContaining({ reason: 'on-leave', requiredAuthorization: null, authorizedMaxMinutes: 0 })] } } })
})

it.each([
  [{ appointment: 'contract' }, 'CONTRACT_LOAD_NOT_REGULATED'],
  [{ appointment: 'contract', regime: undefined }, 'CONTRACT_LOAD_NOT_REGULATED'],
  [{ regime: 'tiempo-parcial', weeklyServiceHours: 10 }, 'TP_MAXIMUM_NOT_REGULATED'],
] as const)('publishes teachers without a regulated maximum and reports their gaps: %s', async (fields, code) => {
  const { draft, service } = await approvedFixture(fields)
  const { draft: resumed } = await service.resume(draft.id, { expectedVersion: draft.version })
  // Approved drafts resume as immutable; current report is computed separately below.
  expect(resumed.configuration.request.resources.teachers[0].regime).toBe(configurationRegime(fields))
  expect((await service.publish(draft.id, { expectedVersion: draft.version, expectedCurrentId: null })).draft.state).toBe('published')
  const { resolvePlanningNormative, workspaceNormativeContext } = await import('../src/programacion-academica/normative-planning.js')
  const normative = resolvePlanningNormative(workspaceNormativeContext(draft.configuration), draft.configuration.request.resources.teachers).report(draft.proposal!.assignments)
  expect(normative.blockers).toEqual([])
  expect(normative.gaps).toContainEqual(expect.objectContaining({ code, teacherIds: ['SYN-T'] }))
})

it.each([
  [{}, null, 4, 'LECTIVE_HOUR_MINUTES_MISSING'],
  [{ regime: undefined }, 60, 4, 'REGIME_MISSING'],
  [{ appointment: undefined }, 60, 4, 'APPOINTMENT_MISSING'],
  [{}, 60, 1, 'MINIMUM_LOAD_SCOPE_UNRESOLVED'],
] as const)('T7 publication rejects unresolved mandatory validation %s %s %s', async (fields, duration, demand, code) => {
  const { draft, service } = await approvedFixture(fields, duration, demand)
  await expect(service.publish(draft.id, { expectedVersion: draft.version, expectedCurrentId: null }))
    .rejects.toMatchObject({ status: 409, response: { error: { code: 'NORMATIVE_VALIDATION_REQUIRED', gaps: expect.arrayContaining([expect.objectContaining({ code })]) } } })
})


it('publishes at the profile-derived ordinary minimum without requiring external-load evidence', async () => {
  const { resolveNormativeProfile, teacherLoadLimits } = await import('../../shared/academic-normative-profile.mjs')
  for (const regime of ['tiempo-completo', 'dedicacion-exclusiva'] as const) {
    const minimum = teacherLoadLimits(resolveNormativeProfile({ facultyId: 'FISI', period: '2027-I' }),
      { regime, appointment: 'faculty-ordinary' }, { lectiveHourMinutes: 60 }).minimumMinutes!
    const { draft, service } = await approvedFixture({ regime }, 60, minimum / 120, 120)
    expect((await service.publish(draft.id, { expectedVersion: draft.version, expectedCurrentId: null })).draft.state).toBe('published')
  }
})

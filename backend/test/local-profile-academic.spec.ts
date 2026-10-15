import { expect, it } from 'vitest'
import { validateContextResponse, validateEnrollmentReport } from '../../shared/matricula-regular.mjs'
import { ContextService } from '../src/matricula-regular/context.service.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { createDocumentaryProfile } from '../src/matricula-regular/profiles.js'
import type { ServerClock } from '../src/matricula-regular/clock.js'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'
import { MatriculaRegularService } from '../src/matricula-regular/matricula-regular.service.js'
import { SessionService } from '../src/matricula-regular/session.service.js'
import { createMatriculaRegularTestApp } from './matricula-regular-test-app.js'
import { projectAcademicRead, projectCommittedReport } from '../src/local-profile-dashboard/academic-projection.js'
import { projectContext } from '../src/matricula-regular/context.service.js'

const FIXED_NOW = new Date('2026-08-11T15:00:00.000Z')
const fixedClock: ServerClock = { now: () => new Date(FIXED_NOW) }

it('context_gate_same_evaluator keeps the existing ContextService wire and eligibility decision', () => {
  const fixture = createSyntheticFixture('SISTEMAS')
  const repository = new MatriculaRegularRepository()
  repository.resetForTests([fixture])
  const contextService = new ContextService(repository, fixedClock)
  const snapshot = repository.readSnapshot()
  const expected = contextService.read('SYN-SIS-A')
  const projected = projectContext(snapshot, 'SYN-SIS-A', FIXED_NOW)
  const academicRead = projectAcademicRead('matriculaInfo', snapshot, 'SYN-SIS-A', FIXED_NOW)

  expect(projected).toEqual(expected)
  expect(academicRead).toEqual(expected.data)
  expect(projected.data.eligibility).toEqual(expected.data.eligibility)
  validateContextResponse(projected, snapshot.runId, 'SYN-SIS-A')
})

it('documentary_unknown_unchanged preserves F6 rows and unknown dates as time advances', () => {
  const repository = new MatriculaRegularRepository()
  repository.resetForTests([createSyntheticFixture('SISTEMAS')])
  const snapshot = repository.readSnapshot()
  const before = projectContext(snapshot, 'SYN-SIS-A', new Date('2026-08-11T14:00:00.000Z'))
  const after = projectContext(snapshot, 'SYN-SIS-A', new Date('2026-08-11T16:00:00.001Z'))

  expect(after.data.serverNow).not.toBe(before.data.serverNow)
  expect(after.data.calendar.publishedRows).toEqual(before.data.calendar.publishedRows)
  expect(after.data.calendar.unknownDates).toEqual(['2026-08-11', '2026-08-12'])
})

it('unknown health, unmatched scope and documentary window do not grant context eligibility', () => {
  const repository = new MatriculaRegularRepository()
  repository.resetForTests([createSyntheticFixture('SISTEMAS')])

  const healthSnapshot = repository.readSnapshot()
  healthSnapshot.actors.find(({ actorId }) => actorId === 'SYN-SIS-A')!.institutional.health = 'unknown'
  const unknownHealth = projectContext(healthSnapshot, 'SYN-SIS-A', FIXED_NOW)
  expect(unknownHealth.data.eligibility.state).not.toBe('eligible')
  expect(unknownHealth.data.eligibility.gaps.map(({ code }) => code)).toContain('INSTITUTIONAL_REQUIREMENT_UNKNOWN')

  const scopeSnapshot = repository.readSnapshot()
  const wrongSchool = createSyntheticFixture('SOFTWARE').profile.scope
  scopeSnapshot.actors.find(({ actorId }) => actorId === 'SYN-SIS-A')!.scope = wrongSchool
  const unmatchedScope = projectContext(scopeSnapshot, 'SYN-SIS-A', FIXED_NOW)
  expect(unmatchedScope.data.eligibility.state).not.toBe('eligible')
  expect(unmatchedScope.data.eligibility.gaps.map(({ code }) => code)).toContain('PROFILE_MISSING')

  const documentarySnapshot = repository.readSnapshot()
  const actor = documentarySnapshot.actors.find(({ actorId }) => actorId === 'SYN-SIS-A')!
  const documentary = createDocumentaryProfile('SISTEMAS')
  documentary.profileRevision = actor.profileRevision
  documentarySnapshot.profiles = [documentary]
  const unknownWindow = projectContext(documentarySnapshot, 'SYN-SIS-A', FIXED_NOW)
  expect(unknownWindow.data.eligibility.state).not.toBe('eligible')
  expect(unknownWindow.data.calendar.effectiveWindows).toEqual([])
  expect(unknownWindow.data.calendar.unknownDates).toEqual(['2026-08-11', '2026-08-12'])
})

it('report_null_before_commit returns null until an accepted enrollment is committed', () => {
  const repository = new MatriculaRegularRepository()
  repository.resetForTests([createSyntheticFixture('SISTEMAS')])
  const snapshot = repository.readSnapshot()

  expect(projectCommittedReport(snapshot, 'SYN-SIS-A')).toBeNull()
  expect(projectCommittedReport(snapshot, 'SYN-SIS-B')).toBeNull()
})

it('exact_report_after_commit is linked to the accepted actor, request, enrollment and scope', async () => {
  const app = await createMatriculaRegularTestApp(fixedClock)
  try {
    const actor = app.repository.readSnapshot().actors.find(({ actorId }) => actorId === 'SYN-SIS-A')!
    const runId = app.repository.runId
    const session = await app.app.get(SessionService).create({ runId, actorId: actor.actorId })
    const result = await app.app.get(MatriculaRegularService).submit({
      runId,
      actorId: actor.actorId,
      sessionId: session.data.sessionId,
      requestId: '10000000-0000-4000-8000-000000000001',
      profileRevision: actor.profileRevision,
      selection: actor.preEnrollment.map(({ courseId }, index) => ({ courseId, sectionId: `SYN-SIS-S${index + 1}` })),
    })
    expect(result.data.state).toBe('accepted')
    const snapshot = app.repository.readSnapshot()
    expect(snapshot.enrollments).toHaveLength(1)
    expect(snapshot.reports).toHaveLength(1)
    const report = projectCommittedReport(snapshot, actor.actorId)

    expect(report).not.toBeNull()
    if (report === null) throw new Error('Expected committed report')
    validateEnrollmentReport(report)
    expect(report).toEqual(snapshot.reports[0]?.[1])
    expect(report.actorId).toBe(actor.actorId)
    expect(report.scope).toEqual(actor.scope)
    expect(report.profileRevision).toBe(actor.profileRevision)
  } finally {
    await app.close()
  }
})

it('school_actor_isolation prevents another actor from seeing the committed report', async () => {
  const app = await createMatriculaRegularTestApp(fixedClock)
  try {
    const actor = app.repository.readSnapshot().actors.find(({ actorId }) => actorId === 'SYN-SIS-A')!
    const runId = app.repository.runId
    const session = await app.app.get(SessionService).create({ runId, actorId: actor.actorId })
    await app.app.get(MatriculaRegularService).submit({
      runId,
      actorId: actor.actorId,
      sessionId: session.data.sessionId,
      requestId: '10000000-0000-4000-8000-000000000002',
      profileRevision: actor.profileRevision,
      selection: actor.preEnrollment.map((course, index) => ({ courseId: course.courseId, sectionId: `SYN-SIS-S${index + 1}` })),
    })
    const snapshot = app.repository.readSnapshot()
    expect(projectCommittedReport(snapshot, 'SYN-SIS-A')).not.toBeNull()
    expect(projectCommittedReport(snapshot, 'SYN-SIS-B')).toBeNull()
    expect(projectCommittedReport(snapshot, 'SYN-SOFT-A')).toBeNull()
  } finally {
    await app.close()
  }
})

it('report_link_corruption_fails closed on an enrollment without its exact stored report', async () => {
  const app = await createMatriculaRegularTestApp(fixedClock)
  try {
    const actor = app.repository.readSnapshot().actors.find(({ actorId }) => actorId === 'SYN-SIS-A')!
    const runId = app.repository.runId
    const session = await app.app.get(SessionService).create({ runId, actorId: actor.actorId })
    await app.app.get(MatriculaRegularService).submit({
      runId,
      actorId: actor.actorId,
      sessionId: session.data.sessionId,
      requestId: '10000000-0000-4000-8000-000000000003',
      profileRevision: actor.profileRevision,
      selection: actor.preEnrollment.map((course, index) => ({ courseId: course.courseId, sectionId: `SYN-SIS-S${index + 1}` })),
    })
    const snapshot = app.repository.readSnapshot()
    const corrupt = structuredClone(snapshot)
    corrupt.reports = []

    expect(() => projectCommittedReport(corrupt, actor.actorId)).toThrow()
  } finally {
    await app.close()
  }
})

it('report_immutable_after_offer_change projects only the committed report copy', async () => {
  const app = await createMatriculaRegularTestApp(fixedClock)
  try {
    const actor = app.repository.readSnapshot().actors.find(({ actorId }) => actorId === 'SYN-SIS-A')!
    const runId = app.repository.runId
    const session = await app.app.get(SessionService).create({ runId, actorId: actor.actorId })
    await app.app.get(MatriculaRegularService).submit({
      runId,
      actorId: actor.actorId,
      sessionId: session.data.sessionId,
      requestId: '10000000-0000-4000-8000-000000000004',
      profileRevision: actor.profileRevision,
      selection: actor.preEnrollment.map((course, index) => ({ courseId: course.courseId, sectionId: `SYN-SIS-S${index + 1}` })),
    })
    const snapshot = app.repository.readSnapshot()
    const reportBefore = projectCommittedReport(snapshot, actor.actorId)
    const changedOffer = structuredClone(snapshot)
    changedOffer.offer[0]!.name = 'Oferta posterior modificada'

    expect(projectCommittedReport(changedOffer, actor.actorId)).toEqual(reportBefore)
  } finally {
    await app.close()
  }
})

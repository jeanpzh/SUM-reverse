import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import supertest from 'supertest'
import * as contract from '../../shared/matricula-regular.mjs'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import type { School, SyntheticFixture } from '../src/matricula-regular/profile.types.js'
import type { ServerClock } from '../src/matricula-regular/clock.js'
import { createMatriculaRegularTestApp, type MatriculaRegularTestApp } from './matricula-regular-test-app.js'

const BASE_PATH = '/local/matricula-regular/v1'
const requestIds = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
]
let now = new Date('2026-08-11T15:00:00.000Z')
const clock: ServerClock = { now: () => new Date(now) }
let testApp: MatriculaRegularTestApp

beforeAll(async () => {
  testApp = await createMatriculaRegularTestApp(clock)
})

afterAll(async () => {
  await testApp.close()
})

function fixture(school: School, edit?: (fixture: SyntheticFixture) => void) {
  const value = createSyntheticFixture(school)
  edit?.(value)
  return value
}

beforeEach(() => {
  now = new Date('2026-08-11T15:00:00.000Z')
  testApp.reset()
})

async function session(actorId: string) {
  const response = await supertest(testApp.app.getHttpServer())
    .post(`${BASE_PATH}/sesiones`)
    .send({ runId: testApp.repository.runId, actorId })
  expect(response.status).toBe(200)
  return response.body.data.sessionId as string
}

function submission(actorId: string, sessionId: string, requestId: string, selection?: unknown[]) {
  const fixtureSnapshot = testApp.repository.readSnapshot()
  const actor = fixtureSnapshot.actors.find((item) => item.actorId === actorId)!
  const offer = fixtureSnapshot.offer.filter((item) => item.planId === actor.scope.planId)
  return {
    runId: fixtureSnapshot.runId,
    actorId,
    sessionId,
    requestId,
    profileRevision: actor.profileRevision,
    selection: selection ?? offer.map((course) => ({ courseId: course.courseId, sectionId: course.sections[0]!.sectionId })),
  }
}

describe('T033/T035 MR-SUBMIT rejection sets and atomic commit', () => {
  it('keeps SECTION_FULL as a technical capacity invariant when academic capacity is not-applicable', async () => {
    const scoped = fixture('SISTEMAS', (value) => {
      value.actors[0]!.rules.push({
        ruleId: 'SECTION-CAPACITY',
        sourceIds: ['SYN-FIXTURE'],
        knowledge: 'not-applicable',
      })
      value.offer[0]!.sections[0]!.occupied = value.offer[0]!.sections[0]!.capacity
    })
    testApp.repository.resetForTests([scoped])
    const actorId = 'SYN-SIS-A'
    const sessionId = await session(actorId)
    const before = testApp.repository.readSnapshot()
    const payload = submission(actorId, sessionId, requestIds[0]!, scoped.offer.map((course) => ({
        courseId: course.courseId,
        sectionId: course.sections[0]!.sectionId,
      })))

    const response = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(payload)

    expect(response.status).toBe(200)
    expect(response.body.data.state).toBe('rejected')
    const capacityCause = response.body.data.causes.find(({ code }: { code: string }) => code === 'SECTION_FULL')
    expect(capacityCause).toBeDefined()
    expect(capacityCause.sourceIds).toContain('SYN-FIXTURE')
    expect(testApp.repository.readSnapshot().offer[0]!.sections[0]!.occupied)
      .toBe(before.offer[0]!.sections[0]!.occupied)

    const context = await supertest(testApp.app.getHttpServer()).get(`${BASE_PATH}/contextos/${actorId}`)
    expect(context.status).toBe(200)
    expect(context.body.runId).toBe(before.runId)
    expect(context.body.data.sources.find(({ id }: { id: string }) => id === 'SYN-FIXTURE').status)
      .toBe('local-only')
  })

  it('returns sanitized LOCAL_FAILURE on an unexpected validator error without publishing the candidate', async () => {
    const actorId = 'SYN-SIS-A'
    const sessionId = await session(actorId)
    const payload = submission(actorId, sessionId, requestIds[0]!)
    const before = testApp.repository.readSnapshot()
    const validator = vi.spyOn(contract, 'validateOutcome').mockImplementationOnce(() => {
      throw new Error('SYNTHETIC_VALIDATOR_FAILURE')
    })

    let response
    try {
      response = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(payload)
    } finally {
      validator.mockRestore()
    }

    expect(response!.status).toBe(500)
    expect(response!.body).toEqual({
      runId: before.runId,
      error: { code: 'LOCAL_FAILURE', fields: [] },
    })
    expect(JSON.stringify(response!.body)).not.toContain('SYNTHETIC_VALIDATOR_FAILURE')
    expect(testApp.repository.readSnapshot()).toEqual(before)
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s rejects crossed schedules and a full section without partial writes', async (school) => {
    const scoped = fixture(school, (value) => {
      value.offer[0]!.sections[0]!.schedule = [{ day: 1, startMinute: 480, endMinute: 540 }]
      value.offer[1]!.sections[0]!.schedule = [{ day: 1, startMinute: 510, endMinute: 570 }]
      value.offer[0]!.sections[0]!.occupied = value.offer[0]!.sections[0]!.capacity
    })
    testApp.repository.resetForTests([scoped])
    const actorId = `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-A`
    const sessionId = await session(actorId)
    const before = testApp.repository.readSnapshot()
    const payload = submission(actorId, sessionId, requestIds[0]!)
    const response = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(payload)

    expect(response.status).toBe(200)
    expect(response.body.data.state).toBe('rejected')
    expect(response.body.data.causes.map(({ code }: { code: string }) => code)).toEqual(['SCHEDULE_CONFLICT', 'SECTION_FULL'])
    expect(response.body.data.gaps).toEqual([])
    expect(response.body.data.enrollmentId).toBeNull()
    expect(response.body.data.reportPath).toBeNull()
    const after = testApp.repository.readSnapshot()
    expect(before.requests).toEqual([])
    expect(after.requests).toHaveLength(1)
    expect(after.requests[0]![1].outcome).toEqual(response.body.data)
    expect(after.enrollments).toEqual([])
    expect(after.reports).toEqual([])
    expect(after.offer.map(({ courseId, sections }) => [courseId, sections[0]!.occupied]))
      .toEqual(before.offer.map(({ courseId, sections }) => [courseId, sections[0]!.occupied]))
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s keeps schedule adjacency valid and records an unknown schedule as pending', async (school) => {
    const prefix = school === 'SISTEMAS' ? 'SIS' : 'SOFT'
    const adjacent = fixture(school, (value) => {
      value.offer[0]!.sections[0]!.schedule = [{ day: 1, startMinute: 480, endMinute: 540 }]
      value.offer[1]!.sections[0]!.schedule = [{ day: 1, startMinute: 540, endMinute: 600 }]
    })
    testApp.repository.resetForTests([adjacent])
    const actorId = `SYN-${prefix}-A`
    const activeSession = await session(actorId)
    const accepted = await supertest(testApp.app.getHttpServer())
      .post(`${BASE_PATH}/solicitudes`).send(submission(actorId, activeSession, requestIds[0]!))
    expect(accepted.status).toBe(200)
    expect(accepted.body.data.state).toBe('accepted')
    const acceptedSnapshot = testApp.repository.readSnapshot()
    expect(acceptedSnapshot.enrollments).toHaveLength(1)
    expect(acceptedSnapshot.reports).toHaveLength(1)

    const unknown = fixture(school, (value) => { value.offer[0]!.sections[0]!.schedule = null })
    testApp.repository.resetForTests([unknown])
    const pendingSession = await session(actorId)
    const pending = await supertest(testApp.app.getHttpServer())
      .post(`${BASE_PATH}/solicitudes`).send(submission(actorId, pendingSession, requestIds[1]!))
    expect(pending.status).toBe(200)
    expect(pending.body.data.state).toBe('configuration-pending')
    expect(pending.body.data.causes.map(({ code }: { code: string }) => code)).not.toContain('SCHEDULE_CONFLICT')
    expect(pending.body.data.gaps.map(({ code }: { code: string }) => code)).toContain('SCHEDULE_UNKNOWN')
    expect(testApp.repository.readSnapshot().enrollments).toEqual([])
    expect(testApp.repository.readSnapshot().reports).toEqual([])
    expect(testApp.repository.readSnapshot().offer.map(({ sections }) => sections[0]!.occupied))
      .toEqual([0, 0, 0])
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s serializes the last-place race as one accepted and one rejected without choosing a winner', async (school) => {
    testApp.repository.resetForTests([createSyntheticFixture(school)])
    const prefix = school === 'SISTEMAS' ? 'SIS' : 'SOFT'
    const actorA = `SYN-${prefix}-A`
    const actorB = `SYN-${prefix}-B`
    const [sessionA, sessionB] = await Promise.all([session(actorA), session(actorB)])
    const before = testApp.repository.readSnapshot()
    const [first, second] = await Promise.all([
      supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(submission(actorA, sessionA, requestIds[0]!)),
      supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(submission(actorB, sessionB, requestIds[1]!)),
    ])
    const states = [first.body.data.state, second.body.data.state].sort((left, right) => left.localeCompare(right))
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(states).toEqual(['accepted', 'rejected'])
    const after = testApp.repository.readSnapshot()
    expect(after.enrollments).toHaveLength(1)
    expect(after.reports).toHaveLength(1)
    expect(after.offer.map(({ courseId, sections }) => [courseId, sections[0]!.occupied]))
      .toEqual(before.offer.map(({ courseId, sections }) => [courseId, sections[0]!.occupied + 1]))
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s replays accepted/rejected results stably and conflicts without mutating the original', async (school) => {
    const prefix = school === 'SISTEMAS' ? 'SIS' : 'SOFT'
    const actorId = `SYN-${prefix}-A`
    const activeSession = await session(actorId)
    const payload = submission(actorId, activeSession, requestIds[0]!)
    const first = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(payload)
    expect(first.body.data.state).toBe('accepted')
    now = new Date('2026-08-11T16:00:00.000Z')
    const reorderedPayload = { ...payload, selection: [...payload.selection].reverse() }
    const replay = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(reorderedPayload)
    expect(replay.status).toBe(200)
    expect(replay.body).toEqual(first.body)
    const beforeConflict = testApp.repository.readSnapshot()
    const conflict = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send({
      ...payload,
      requestId: requestIds[0],
      selection: payload.selection.slice(0, 2),
    })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('REQUEST_CONFLICT')
    expect(testApp.repository.readSnapshot()).toEqual(beforeConflict)
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s publishes request, enrollment, report and occupancy as one accepted snapshot', async (school) => {
    const prefix = school === 'SISTEMAS' ? 'SIS' : 'SOFT'
    const actorId = `SYN-${prefix}-A`
    const activeSession = await session(actorId)
    const payload = submission(actorId, activeSession, requestIds[0]!)
    const before = testApp.repository.readSnapshot()
    const response = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(payload)
    expect(response.status).toBe(200)
    expect(Object.keys(response.body).sort()).toEqual(['data', 'runId'])
    expect(response.body.data.state).toBe('accepted')
    expect(response.body.data.causes).toEqual([])
    expect(response.body.data.gaps).toEqual([])
    expect(response.body.data.enrollmentId).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.body.data.reportPath).toBe(`${BASE_PATH}/reportes/${response.body.data.enrollmentId}`)

    const after = testApp.repository.readSnapshot()
    expect(after.requests).toHaveLength(1)
    expect(after.enrollments).toHaveLength(1)
    expect(after.reports).toHaveLength(1)
    expect(after.requests[0]![1].outcome).toEqual(response.body.data)
    const enrolledCourses = new Set((response.body.data.selection as Array<{ courseId: string }>).map(({ courseId }) => courseId))
    expect(after.offer.map(({ courseId, sections }) => [courseId, sections[0]!.occupied]))
      .toEqual(before.offer.map(({ courseId, sections }) => [courseId, sections[0]!.occupied + (enrolledCourses.has(courseId) ? 1 : 0)]))
    const report = after.reports[0]![1]
    expect(report.rows.map(({ courseId }) => courseId)).toEqual(payload.selection.map(({ courseId }) => courseId).sort((left, right) => left.localeCompare(right)))
    expect(report.totalCredits).toBe(12)
  })

  it('rejects a second request by an already enrolled actor without another write', async () => {
    const actorId = 'SYN-SIS-A'
    const activeSession = await session(actorId)
    const first = await supertest(testApp.app.getHttpServer())
      .post(`${BASE_PATH}/solicitudes`).send(submission(actorId, activeSession, requestIds[0]!))
    expect(first.body.data.state).toBe('accepted')
    const before = testApp.repository.readSnapshot()
    const second = await supertest(testApp.app.getHttpServer())
      .post(`${BASE_PATH}/solicitudes`).send(submission(actorId, activeSession, requestIds[1]!))
    expect(second.body.data.state).toBe('rejected')
    expect(second.body.data.causes.map(({ code }: { code: string }) => code)).toContain('ALREADY_ENROLLED')
    const after = testApp.repository.readSnapshot()
    expect(after.enrollments).toEqual(before.enrollments)
    expect(after.reports).toEqual(before.reports)
    expect(after.offer.map(({ sections }) => sections[0]!.occupied)).toEqual(before.offer.map(({ sections }) => sections[0]!.occupied))
  })

  it('returns scoped protocol errors for expired/mismatched sessions, stale profiles and changed runs', async () => {
    const actorA = 'SYN-SIS-A'
    const actorB = 'SYN-SIS-B'
    const activeSession = await session(actorA)
    const body = submission(actorB, activeSession, requestIds[0]!)
    const mismatched = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(body)
    expect(mismatched.status).toBe(409)
    expect(mismatched.body.error.code).toBe('SESSION_CONTEXT_MISMATCH')

    const stale = submission(actorA, activeSession, requestIds[1]!)
    stale.profileRevision = 'MR-SYN-STALE'
    const staleResponse = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(stale)
    expect(staleResponse.status).toBe(409)
    expect(staleResponse.body.error.code).toBe('PROFILE_CHANGED')

    const expired = submission(actorA, activeSession, requestIds[2]!)
    now = new Date('2026-08-11T15:15:00.000Z')
    const expiredResponse = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(expired)
    expect(expiredResponse.status).toBe(409)
    expect(expiredResponse.body.error.code).toBe('SESSION_EXPIRED')

    const oldRun = submission(actorA, activeSession, requestIds[3]!)
    testApp.reset()
    const changedRun = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(oldRun)
    expect(changedRun.status).toBe(409)
    expect(changedRun.body.error.code).toBe('RUN_CHANGED')
    expect(testApp.repository.readSnapshot().requests).toEqual([])
  })

  it('keeps protocol errors outside Outcome and never saves malformed or unknown catalog choices', async () => {
    const actorId = 'SYN-SIS-A'
    const activeSession = await session(actorId)
    const base = submission(actorId, activeSession, requestIds[0]!)
    const before = testApp.repository.readSnapshot()
    const malformed = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send({ ...base, secretSentinel: 'private-value' })
    expect(malformed.status).toBe(400)
    expect(malformed.body).toEqual({ runId: before.runId, error: { code: 'INVALID_REQUEST', fields: ['body.secretSentinel'] } })
    expect(JSON.stringify(malformed.body)).not.toContain('private-value')
    const unknown = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send({
      ...base,
      selection: [{ courseId: 'SYN-SIS-UNKNOWN', sectionId: 'SYN-SIS-SECTION' }],
    })
    expect(unknown.status).toBe(404)
    expect(unknown.body.error.code).toBe('CHOICE_NOT_FOUND')
    expect(testApp.repository.readSnapshot().requests).toEqual([])
    expect(testApp.repository.readSnapshot().enrollments).toEqual([])
    expect(testApp.repository.readSnapshot().reports).toEqual([])
    expect(testApp.repository.readSnapshot().offer).toEqual(before.offer)
  })
})

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import type { School, SyntheticFixture } from '../src/matricula-regular/profile.types.js'
import type { ServerClock } from '../src/matricula-regular/clock.js'
import { createMatriculaRegularTestApp, type MatriculaRegularTestApp } from './matricula-regular-test-app.js'

const BASE_PATH = '/local/matricula-regular/v1'
const requestId = '00000000-0000-4000-8000-000000000061'
let now = new Date('2026-08-11T15:00:00.000Z')
const clock: ServerClock = { now: () => new Date(now) }
let testApp: MatriculaRegularTestApp

beforeAll(async () => {
  testApp = await createMatriculaRegularTestApp(clock)
})

afterAll(async () => {
  await testApp.close()
})

beforeEach(() => {
  now = new Date('2026-08-11T15:00:00.000Z')
  testApp.reset()
})

function prefix(school: School) {
  return school === 'SISTEMAS' ? 'SIS' : 'SOFT'
}

async function session(actorId: string) {
  const response = await supertest(testApp.app.getHttpServer())
    .post(`${BASE_PATH}/sesiones`)
    .send({ runId: testApp.repository.runId, actorId })
  expect(response.status).toBe(200)
  return response.body.data.sessionId as string
}

function submission(actorId: string, sessionId: string, fixture?: SyntheticFixture) {
  const state = testApp.repository.readSnapshot()
  const actor = state.actors.find((item) => item.actorId === actorId)!
  const offer = fixture?.offer ?? state.offer.filter((item) => item.planId === actor.scope.planId)
  return {
    runId: state.runId,
    actorId,
    sessionId,
    requestId,
    profileRevision: actor.profileRevision,
    selection: offer.map((course) => ({ courseId: course.courseId, sectionId: course.sections[0]!.sectionId })),
  }
}

function lookupPath(id = requestId, runId = testApp.repository.runId, actorId = 'SYN-SIS-A') {
  return `${BASE_PATH}/solicitudes/${id}?runId=${runId}&actorId=${actorId}`
}

function reportPath(enrollmentId: string, runId = testApp.repository.runId, actorId = 'SYN-SIS-A') {
  return `${BASE_PATH}/reportes/${enrollmentId}?runId=${runId}&actorId=${actorId}`
}

describe('T040/T042 MR-RESULT and MR-REPORT', () => {
  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s returns explicit unknown before submit without changing run state', async (school) => {
    const actorId = `SYN-${prefix(school)}-A`
    const before = testApp.repository.readSnapshot()
    const response = await supertest(testApp.app.getHttpServer())
      .get(lookupPath(requestId, before.runId, actorId))

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ runId: before.runId, data: { state: 'unknown', outcome: null } })
    expect(testApp.repository.readSnapshot()).toEqual(before)
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s replays concurrent same-ID submissions once and reads exact report without writes after expiry', async (school) => {
    const actorId = `SYN-${prefix(school)}-A`
    const sessionId = await session(actorId)
    const payload = submission(actorId, sessionId)
    const before = testApp.repository.readSnapshot()
    const [first, second] = await Promise.all([
      supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(payload),
      supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(payload),
    ])

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body).toEqual(first.body)
    expect(first.body.data.state).toBe('accepted')
    const acceptedSnapshot = testApp.repository.readSnapshot()
    expect(acceptedSnapshot.requests).toHaveLength(1)
    expect(acceptedSnapshot.enrollments).toHaveLength(1)
    expect(acceptedSnapshot.reports).toHaveLength(1)
    const selectedIds = new Set(payload.selection.map(({ courseId }) => courseId))
    expect(acceptedSnapshot.offer.map(({ courseId, sections }) => [courseId, sections[0]!.occupied]))
      .toEqual(before.offer.map(({ courseId, sections }) => [courseId, sections[0]!.occupied + Number(selectedIds.has(courseId))]))

    now = new Date('2026-08-11T15:15:00.000Z')
    const lookup = await supertest(testApp.app.getHttpServer())
      .get(lookupPath(requestId, before.runId, actorId))
    expect(lookup.status).toBe(200)
    expect(lookup.body.data).toEqual({ state: 'known', outcome: first.body.data })
    const enrollmentId = first.body.data.enrollmentId as string
    const report = await supertest(testApp.app.getHttpServer())
      .get(reportPath(enrollmentId, before.runId, actorId))
    expect(report.status).toBe(200)
    expect(report.body).toEqual({ runId: before.runId, data: acceptedSnapshot.reports[0]![1] })
    expect(report.body.data.rows.map(({ courseId }: { courseId: string }) => courseId))
      .toEqual(payload.selection.map(({ courseId }: { courseId: string }) => courseId).sort())
    expect(report.body.data.totalCredits).toBe(12)
    expect(testApp.repository.readSnapshot()).toEqual(acceptedSnapshot)
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s preserves rejected and pending outcomes on replay without reports or occupancy writes', async (school) => {
    const actorId = `SYN-${prefix(school)}-A`
    const rejectedFixture = createSyntheticFixture(school)
    rejectedFixture.offer[0]!.sections[0]!.occupied = rejectedFixture.offer[0]!.sections[0]!.capacity
    testApp.repository.resetForTests([rejectedFixture])
    const rejectedSession = await session(actorId)
    const rejectedPayload = submission(actorId, rejectedSession, rejectedFixture)
    const rejected = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(rejectedPayload)
    expect(rejected.body.data.state).toBe('rejected')
    const beforeRejectedReplay = testApp.repository.readSnapshot()
    const rejectedReplay = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(rejectedPayload)
    expect(rejectedReplay.body).toEqual(rejected.body)
    expect(testApp.repository.readSnapshot()).toEqual(beforeRejectedReplay)
    expect(testApp.repository.readSnapshot().reports).toEqual([])

    const pendingFixture = createSyntheticFixture(school)
    pendingFixture.offer[0]!.sections[0]!.schedule = null
    testApp.repository.resetForTests([pendingFixture])
    const pendingSession = await session(actorId)
    const pendingPayload = submission(actorId, pendingSession, pendingFixture)
    const pending = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(pendingPayload)
    expect(pending.body.data.state).toBe('configuration-pending')
    const beforePendingReplay = testApp.repository.readSnapshot()
    const pendingReplay = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(pendingPayload)
    expect(pendingReplay.body).toEqual(pending.body)
    expect(testApp.repository.readSnapshot()).toEqual(beforePendingReplay)
    expect(testApp.repository.readSnapshot().enrollments).toEqual([])
    expect(testApp.repository.readSnapshot().reports).toEqual([])
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s rejects changed payload and foreign report identity without mutating or enumerating reports', async (school) => {
    const actorId = `SYN-${prefix(school)}-A`
    const foreignActorId = `SYN-${prefix(school)}-B`
    const sessionId = await session(actorId)
    const payload = submission(actorId, sessionId)
    const created = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(payload)
    const acceptedSnapshot = testApp.repository.readSnapshot()
    const conflict = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send({
      ...payload,
      selection: payload.selection.slice(0, 2),
    })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('REQUEST_CONFLICT')
    expect(testApp.repository.readSnapshot()).toEqual(acceptedSnapshot)

    const foreign = await supertest(testApp.app.getHttpServer())
      .get(reportPath(created.body.data.enrollmentId, acceptedSnapshot.runId, foreignActorId))
    expect(foreign.status).toBe(404)
    expect(foreign.body.error.code).toBe('REPORT_NOT_FOUND')
    expect(JSON.stringify(foreign.body)).not.toContain(created.body.data.enrollmentId)

    const foreignLookup = await supertest(testApp.app.getHttpServer())
      .get(lookupPath(requestId, acceptedSnapshot.runId, foreignActorId))
    expect(foreignLookup.status).toBe(200)
    expect(foreignLookup.body).toEqual({
      runId: acceptedSnapshot.runId,
      data: { state: 'unknown', outcome: null },
    })
    expect(testApp.repository.readSnapshot()).toEqual(acceptedSnapshot)
  })

  it('validates exact result/report query and returns RUN_CHANGED for previous-run lookup and replay', async () => {
    const actorId = 'SYN-SIS-A'
    const sessionId = await session(actorId)
    const payload = submission(actorId, sessionId)
    const oldRunId = payload.runId
    const oldRequest = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(payload)
    const oldEnrollmentId = oldRequest.body.data.enrollmentId as string
    const currentRunId = testApp.reset()
    const before = testApp.repository.readSnapshot()

    for (const path of [lookupPath(requestId, oldRunId, actorId), reportPath(oldEnrollmentId, oldRunId, actorId)]) {
      const oldRead = await supertest(testApp.app.getHttpServer()).get(path)
      expect(oldRead.status).toBe(409)
      expect(oldRead.body.error.code).toBe('RUN_CHANGED')
      expect(oldRead.body.runId).toBe(currentRunId)
    }
    const oldReplay = await supertest(testApp.app.getHttpServer()).post(`${BASE_PATH}/solicitudes`).send(payload)
    expect(oldReplay.status).toBe(409)
    expect(oldReplay.body.error.code).toBe('RUN_CHANGED')
    expect(testApp.repository.readSnapshot()).toEqual(before)

    for (const path of [
      `${BASE_PATH}/solicitudes/${requestId}?runId=${currentRunId}&actorId=${actorId}&extra=x`,
      `${BASE_PATH}/solicitudes/${requestId}?runId=${currentRunId}&runId=${currentRunId}&actorId=${actorId}`,
      `${BASE_PATH}/reportes/${oldEnrollmentId}?runId=${currentRunId}&actorId=${actorId}&extra=x`,
    ]) {
      const invalid = await supertest(testApp.app.getHttpServer()).get(path)
      expect(invalid.status).toBe(400)
      expect(invalid.body.error.code).toBe('INVALID_REQUEST')
      expect(JSON.stringify(invalid.body)).not.toContain(requestId)
    }
    expect(testApp.repository.readSnapshot()).toEqual(before)
  })
})

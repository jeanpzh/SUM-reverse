import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { projectContext } from '../src/matricula-regular/context.service.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'
import { REGULAR_CREDIT_LOAD } from '../src/matricula-regular/rules.js'
import type { ServerClock } from '../src/matricula-regular/clock.js'
import { createMatriculaRegularTestApp, type MatriculaRegularTestApp } from './matricula-regular-test-app.js'

const BASE_PATH = '/local/matricula-regular/v1'
const NOW = new Date('2026-08-11T14:00:00.000Z')
const REQUEST_ID = '00000000-0000-4000-8000-000000000071'

describe('MR-CONTRACT-3 synthetic display fields (L-13)', () => {
  it('offers cycle, course type, section label, teacher and room for every synthetic course', () => {
    for (const school of ['SISTEMAS', 'SOFTWARE'] as const) {
      const { offer } = createSyntheticFixture(school)
      expect(offer.map((course) => course.cycle)).toEqual([1, 3, 5])
      expect(offer.every((course) => course.courseType === 'mandatory')).toBe(true)
      expect(offer.map((course) => course.sections[0]!.label)).toEqual(['1', '1', '1'])
      expect(offer[0]!.sections[0]!.teacher).toBeNull()
      expect(offer[1]!.sections[0]!.teacher).toMatch(/^SINTÉTICO /)
      expect(offer.every((course) => course.sections[0]!.room === null)).toBe(true)
    }
  })

  it('projects retakeCourseIds from failed offered courses and the regular credit cap', () => {
    const snapshot = new MatriculaRegularRepository().readSnapshot()
    expect(projectContext(snapshot, 'SYN-SOFT-B', NOW).data.retakeCourseIds).toEqual(['SYN-SOFT-C1'])
    expect(projectContext(snapshot, 'SYN-SIS-A', NOW).data.retakeCourseIds).toEqual([])
    expect(projectContext(snapshot, 'SYN-SIS-A', NOW).data.creditCap).toBe(REGULAR_CREDIT_LOAD.max)
  })

  it('ignores failures outside the offer and returns no retake courses when history is unknown', () => {
    const snapshot = new MatriculaRegularRepository().readSnapshot()
    const actor = snapshot.actors.find((candidate) => candidate.actorId === 'SYN-SIS-A')!
    actor.failedCourses = [{ courseId: 'SYN-SIS-C9', failures: 2 }, { courseId: 'SYN-SIS-C2', failures: 1 }]
    expect(projectContext(snapshot, 'SYN-SIS-A', NOW).data.retakeCourseIds).toEqual(['SYN-SIS-C2'])
    actor.historyKnown = false
    expect(projectContext(snapshot, 'SYN-SIS-A', NOW).data.retakeCourseIds).toEqual([])
  })
})

describe('MR-CONTRACT-3 report rows', () => {
  const clock: ServerClock = { now: () => new Date('2026-08-11T15:00:00.000Z') }
  let testApp: MatriculaRegularTestApp

  beforeAll(async () => {
    testApp = await createMatriculaRegularTestApp(clock)
  })

  afterAll(async () => {
    await testApp.close()
  })

  it('copies cycle, section label and teacher into the accepted report', async () => {
    testApp.reset()
    const server = testApp.app.getHttpServer()
    const runId = testApp.repository.runId
    const created = await supertest(server).post(`${BASE_PATH}/sesiones`).send({ runId, actorId: 'SYN-SIS-A' })
    expect(created.status).toBe(200)
    const state = testApp.repository.readSnapshot()
    const actor = state.actors.find((item) => item.actorId === 'SYN-SIS-A')!
    const offer = state.offer.filter((item) => item.planId === actor.scope.planId)
    const submitted = await supertest(server).post(`${BASE_PATH}/solicitudes`).send({
      runId,
      actorId: 'SYN-SIS-A',
      sessionId: created.body.data.sessionId,
      requestId: REQUEST_ID,
      profileRevision: actor.profileRevision,
      selection: offer.map((course) => ({ courseId: course.courseId, sectionId: course.sections[0]!.sectionId })),
    })
    expect(submitted.body.data.state).toBe('accepted')
    const report = await supertest(server)
      .get(`${BASE_PATH}/reportes/${submitted.body.data.enrollmentId}?runId=${runId}&actorId=SYN-SIS-A`)
    expect(report.status).toBe(200)
    expect(report.body.data.rows.map((row: { cycle: number; label: string; teacher: string | null }) =>
      [row.cycle, row.label, row.teacher])).toEqual([
      [1, '1', null],
      [3, '1', 'SINTÉTICO SIS, DOCENTE 2'],
      [5, '1', 'SINTÉTICO SIS, DOCENTE 3'],
    ])
  })
})

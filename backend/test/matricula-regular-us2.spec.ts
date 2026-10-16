import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { createDocumentaryProfile } from '../src/matricula-regular/profiles.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { evaluateContextEligibility } from '../src/matricula-regular/windows.js'
import type { School } from '../src/matricula-regular/profile.types.js'
import { createMatriculaRegularTestApp, type MatriculaRegularTestApp } from './matricula-regular-test-app.js'
import type { ServerClock } from '../src/matricula-regular/clock.js'

const BASE_PATH = '/local/matricula-regular/v1'
const FIFTEEN_MINUTES = 15 * 60 * 1000

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

async function jsonRequest(path: string, body: unknown) {
  const response = await supertest(testApp.app.getHttpServer()).post(path).send(body)
  return {
    response,
    body: response.body as {
      runId: string
      data: { actorId: string; runId: string; sessionId: string; startedAt: string; expiresAt: string }
      error: { code: string; fields: string[] }
    },
  }
}

function createSession(actorId: string, runId = testApp.repository.runId) {
  return jsonRequest(`${BASE_PATH}/sesiones`, { runId, actorId })
}

function renewSession(sessionId: string, actorId: string, runId = testApp.repository.runId) {
  return jsonRequest(`${BASE_PATH}/sesiones/${sessionId}/renovar`, { runId, actorId })
}

describe('T018 F6 calendar and access window boundaries', () => {
  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s preserves the nine F6 rows including repeated labels', (school: School) => {
    const rows = createDocumentaryProfile(school).calendar.publishedRows

    expect(rows).toEqual([
      { row: 1, groupLabel: '1', day: '2026-08-10', startLocal: '06:00', endLocal: '08:00', ppMin: 17, ppMax: 19, sourceId: 'F6' },
      { row: 2, groupLabel: '2', day: '2026-08-10', startLocal: '08:00', endLocal: '10:00', ppMin: 16, ppMax: 19, sourceId: 'F6' },
      { row: 3, groupLabel: '3', day: '2026-08-10', startLocal: '10:00', endLocal: '12:00', ppMin: 15, ppMax: 19, sourceId: 'F6' },
      { row: 4, groupLabel: '4', day: '2026-08-10', startLocal: '12:00', endLocal: '14:00', ppMin: 14, ppMax: 19, sourceId: 'F6' },
      { row: 5, groupLabel: '5', day: '2026-08-10', startLocal: '14:00', endLocal: '16:00', ppMin: 13, ppMax: 19, sourceId: 'F6' },
      { row: 6, groupLabel: '6', day: '2026-08-10', startLocal: '16:00', endLocal: '18:00', ppMin: 12, ppMax: 19, sourceId: 'F6' },
      { row: 7, groupLabel: '7', day: '2026-08-10', startLocal: '18:00', endLocal: '20:00', ppMin: 11, ppMax: 19, sourceId: 'F6' },
      { row: 8, groupLabel: '6 (repetido)', day: '2026-08-10', startLocal: '20:00', endLocal: '22:00', ppMin: 10, ppMax: 19, sourceId: 'F6' },
      { row: 9, groupLabel: '7 (repetido)', day: '2026-08-10', startLocal: '22:00', endLocal: '23:59', ppMin: 0, ppMax: 19, sourceId: 'F6' },
    ])
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s uses every published threshold, PP17, and values above 19 without rewriting F6', (school: School) => {
    const fixture = createSyntheticFixture(school)
    const actor = fixture.actors[0]!
    const profile = createDocumentaryProfile(school)
    actor.profileRevision = profile.profileRevision

    for (const [rowIndex, threshold] of [17, 16, 15, 14, 13, 12, 11, 10, 0].entries()) {
      actor.ponderado = threshold
      const openingHourUtc = 11 + rowIndex * 2
      const result = evaluateContextEligibility(
        [profile],
        actor,
        new Date(`2026-08-${openingHourUtc < 24 ? '10' : '11'}T${String(openingHourUtc % 24).padStart(2, '0')}:00:00.000Z`),
      )
      expect(result.state, `F6 row ${rowIndex + 1} threshold ${threshold}`).toBe('eligible')
      expect(result.windowId).toBe(`SYN-PUBLISHED-ROW-${rowIndex + 1}`)
      expect(result.windowOrigin).toBe('published-derived')
    }

    actor.ponderado = 20
    const above19 = evaluateContextEligibility([profile], actor, new Date('2026-08-10T11:00:00.000Z'))
    expect(above19.state).toBe('eligible')
    expect(above19.windowId).toBe('SYN-PUBLISHED-ROW-1')
    expect(profile.calendar.publishedRows[0]!.ppMax).toBe(19)

    actor.ponderado = null
    const unknown = evaluateContextEligibility([profile], actor, new Date('2026-08-10T11:00:00.000Z'))
    expect(unknown.state).toBe('configuration-pending')
    expect(unknown.gaps.map((item) => item.code)).toContain('PROFILE_MISSING')
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s makes the final Monday minute inclusive and Lima midnight exclusive', (school: School) => {
    const actor = createSyntheticFixture(school).actors[0]!
    actor.profileRevision = createDocumentaryProfile(school).profileRevision
    actor.ponderado = 0
    const profile = createDocumentaryProfile(school)

    const finalMinute = evaluateContextEligibility(
      [profile], actor, new Date('2026-08-11T04:59:59.999Z'),
    )
    const limaMidnight = evaluateContextEligibility(
      [profile], actor, new Date('2026-08-11T05:00:00.000Z'),
    )

    expect(finalMinute.state).toBe('eligible')
    expect(finalMinute.windowId).toBe('SYN-PUBLISHED-ROW-9')
    expect(limaMidnight.state).toBe('configuration-pending')
    expect(limaMidnight.gaps.map((item) => item.code)).toContain('WINDOW_UNSPECIFIED')
  })

  it.each(['SISTEMAS', 'SOFTWARE'] as const)('%s keeps documentary unknown dates separate from explicit synthetic windows', (school: School) => {
    const fixture = createSyntheticFixture(school)
    const documentary = createDocumentaryProfile(school)
    const actor = fixture.actors[0]!

    for (const day of ['11', '12']) {
      actor.profileRevision = documentary.profileRevision
      for (const ponderado of [0, 11, 16, 17, 20, null]) {
        actor.ponderado = ponderado
        const pending = evaluateContextEligibility(
          [documentary], actor, new Date(`2026-08-${day}T15:00:00.000Z`),
        )
        expect(pending.state).toBe('configuration-pending')
        expect(pending.gaps.map((item) => item.code)).toContain('WINDOW_UNSPECIFIED')
        expect(pending.windowOrigin).toBeNull()
      }

      actor.profileRevision = fixture.profile.profileRevision
      for (const ponderado of [0, 16, 17, 20]) {
        actor.ponderado = ponderado
        const synthetic = evaluateContextEligibility(
          [fixture.profile], actor, new Date(`2026-08-${day}T15:00:00.000Z`),
        )
        expect(synthetic.state).toBe('eligible')
        expect(synthetic.windowOrigin).toBe('synthetic')
        expect(synthetic.windowId).toBe(day === '11' ? 'SYN-WINDOW-1' : 'SYN-WINDOW-2')
      }
    }
  })
})

describe('T018 MR-SESSION / MR-RENEW runtime contract', () => {
  it('starts inclusively with a 15 minute server-clock session and renews the same session only while active', async () => {
    const actorId = 'SYN-SIS-A'
    const { response, body } = await createSession(actorId)
    const session = body.data

    expect(response.status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(['data', 'runId'])
    expect(session).toMatchObject({
      runId: testApp.repository.runId,
      actorId,
      startedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + FIFTEEN_MINUTES).toISOString(),
    })
    expect(testApp.repository.readSnapshot().sessions).toEqual([session])

    now = new Date(now.getTime() + FIFTEEN_MINUTES - 1)
    const renewal = await renewSession(session.sessionId, actorId)
    expect(renewal.response.status).toBe(200)
    expect(renewal.body.data).toEqual({
      ...session,
      expiresAt: new Date(now.getTime() + FIFTEEN_MINUTES).toISOString(),
    })

    now = new Date(renewal.body.data.expiresAt)
    const expiredRenewal = await renewSession(session.sessionId, actorId)
    expect(expiredRenewal.response.status).toBe(409)
    expect(expiredRenewal.body.error.code).toBe('SESSION_EXPIRED')
    const newEntry = await createSession(actorId)
    expect(newEntry.response.status).toBe(200)
    expect(newEntry.body.data.sessionId).not.toBe(session.sessionId)
    expect(newEntry.body.data.startedAt).toBe(now.toISOString())
  })

  it('does not renew on context reads; explicit renewal uses the current server time', async () => {
    const actorId = 'SYN-SOFT-A'
    const created = await createSession(actorId)
    const initialExpiry = created.body.data.expiresAt
    now = new Date(now.getTime() + 5 * 60 * 1000)

    const context = await supertest(testApp.app.getHttpServer()).get(`${BASE_PATH}/contextos/${actorId}`)
    expect(context.status).toBe(200)
    expect(testApp.repository.readSnapshot().sessions[0]!.expiresAt).toBe(initialExpiry)

    const renewal = await renewSession(created.body.data.sessionId, actorId)
    expect(renewal.response.status).toBe(200)
    expect(renewal.body.data.sessionId).toBe(created.body.data.sessionId)
    expect(renewal.body.data.expiresAt).toBe(new Date(now.getTime() + FIFTEEN_MINUTES).toISOString())
  })

  it('rejects malformed, extra, query-repeated, actor-mismatched, and run-mismatched requests without side effects', async () => {
    const actorId = 'SYN-SIS-A'
    const before = testApp.repository.readSnapshot()
    const malformed = await jsonRequest(`${BASE_PATH}/sesiones`, { runId: before.runId, actorId, extra: 'SENTINEL' })
    expect(malformed.response.status).toBe(400)
    expect(malformed.body.error).toEqual({ code: 'INVALID_REQUEST', fields: ['body.extra'] })

    const created = await createSession(actorId)
    const sessionId = created.body.data.sessionId as string
    const actorMismatch = await renewSession(sessionId, 'SYN-SIS-B')
    expect(actorMismatch.response.status).toBe(409)
    expect(actorMismatch.body.error.code).toBe('SESSION_CONTEXT_MISMATCH')

    const runMismatch = await renewSession(sessionId, actorId, '00000000-0000-4000-8000-000000000001')
    expect(runMismatch.response.status).toBe(409)
    expect(runMismatch.body.error.code).toBe('RUN_CHANGED')

    const malformedPath = await renewSession('not-a-uuid', actorId)
    expect(malformedPath.response.status).toBe(400)
    const repeatedQuery = await supertest(testApp.app.getHttpServer())
      .post(`${BASE_PATH}/sesiones?x=1&x=2`)
      .send({ runId: before.runId, actorId })
    expect(repeatedQuery.status).toBe(400)
    expect(testApp.repository.readSnapshot().sessions).toHaveLength(1)
    expect(testApp.repository.readSnapshot().requests).toEqual([])
    expect(testApp.repository.readSnapshot().enrollments).toEqual([])
    expect(testApp.repository.readSnapshot().reports).toEqual([])
  })
})

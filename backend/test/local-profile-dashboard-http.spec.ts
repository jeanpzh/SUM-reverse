import { afterAll, beforeAll, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { dashboardKeys } from '../../shared/local-profile-dashboard.mjs'
import { validateMiInformacionWire } from '../../shared/mi-informacion-wire.mjs'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'
import { MATRICULA_REGULAR_CLOCK } from '../src/matricula-regular/matricula-regular.module.js'
import { createAdvancingSyntheticClock } from '../src/matricula-regular/clock.js'
import { LocalProfileDashboardModule } from '../src/local-profile-dashboard/local-profile-dashboard.module.js'

const BASE_PATH = '/local/perfiles/v1'
const elapsed = { value: 0 }
let app: INestApplication
let repository: MatriculaRegularRepository

async function resetRun() {
  elapsed.value += 1
  const startElapsed = elapsed.value
  const runId = repository.resetForTests()
  const actors = repository.readSnapshot().actors
  return {
    runId,
    startElapsed,
    actorA: actors.find(({ actorId }) => actorId === 'SYN-SIS-A')!,
    actorB: actors.find(({ actorId }) => actorId === 'SYN-SIS-B')!,
  }
}

async function createSession(runId: string, actorId: string) {
  const response = await supertest(app.getHttpServer())
    .post('/local/matricula-regular/v1/sesiones')
    .send({ runId, actorId })
  expect(response.status).toBe(200)
  return response.body.data as { sessionId: string; startedAt: string; expiresAt: string }
}

function consultationPath(key: string, runId: string, actorId: string, sessionId: string) {
  const query = new URLSearchParams({ runId, actorId, sessionId })
  return `${BASE_PATH}/consultas/${encodeURIComponent(key)}?${query}`
}

beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [LocalProfileDashboardModule] })
    .overrideProvider(MATRICULA_REGULAR_CLOCK)
    .useValue(createAdvancingSyntheticClock('2026-08-11T14:00:00.000Z', () => elapsed.value))
    .compile()
  app = module.createNestApplication({ logger: false })
  await app.init()
  repository = app.get(MatriculaRegularRepository)
}, 30000)

afterAll(async () => {
  await app?.close()
})

it('catalog_entry_cycle lists four actors and serves formulario after one MR2 session creation', async () => {
  const { runId, startElapsed, actorA } = await resetRun()
  const catalog = await supertest(app.getHttpServer()).get(`${BASE_PATH}/perfiles`)
  expect(catalog.status).toBe(200)
  expect(catalog.body.runId).toBe(runId)
  expect(catalog.body.data.profiles.map((profile: { actorId: string }) => profile.actorId)).toEqual([
    'SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B',
  ])

  const session = await createSession(runId, actorA.actorId)
  const read = await supertest(app.getHttpServer())
    .get(consultationPath('formulario', runId, actorA.actorId, session.sessionId))
  expect(read.status).toBe(200)
  expect(read.body.data.payload.data.alumno.codAlumno).toBe(actorA.actorId)
  expect(read.body.data.sessionId).toBe(session.sessionId)
  expect(repository.readSnapshot().sessions).toHaveLength(1)
  expect(session.expiresAt).toBe(new Date(Date.parse('2026-08-11T14:00:00.000Z') + startElapsed + 900000).toISOString())
})

it('all14_keys serves every frozen dashboard key through one read route', async () => {
  const { runId, actorA } = await resetRun()
  const session = await createSession(runId, actorA.actorId)

  for (const key of dashboardKeys) {
    const response = await supertest(app.getHttpServer())
      .get(consultationPath(key, runId, actorA.actorId, session.sessionId))
    expect(response.status, key).toBe(200)
    expect(response.headers['content-type']).toMatch(/application\/json/i)
    expect(response.body.data.key).toBe(key)
    expect(response.body.data.actorId).toBe(actorA.actorId)
    expect(response.body.data.sessionId).toBe(session.sessionId)
  }
  expect(repository.readSnapshot().sessions).toHaveLength(1)
})

it('compatible MI payloads validate as delivered over HTTP for all four actors', async () => {
  const { runId } = await resetRun()
  for (const actor of repository.readSnapshot().actors) {
    const session = await createSession(runId, actor.actorId)
    for (const [key, wireKey] of [
      ['formulario', 'formularioDatos'],
      ['historial', 'historial'],
      ['fichaSocioeconomica', 'fichaSocioeconomica'],
    ] as const) {
      const response = await supertest(app.getHttpServer())
        .get(consultationPath(key, runId, actor.actorId, session.sessionId))
      expect(response.status).toBe(200)
      expect(() => validateMiInformacionWire(wireKey, response.body.data.payload, 'local-v1')).not.toThrow()
      expect(response.body.data.payload.data.alumno.codAlumno).toBe(actor.actorId)
    }
  }
  expect(repository.readSnapshot().sessions).toHaveLength(4)
  expect(repository.readSnapshot().enrollments).toHaveLength(0)
})

it('invalid_query_body_path rejects extra, duplicate or absent query keys and noncanonical paths', async () => {
  const { runId, actorA } = await resetRun()
  const session = await createSession(runId, actorA.actorId)
  const valid = consultationPath('formulario', runId, actorA.actorId, session.sessionId)

  const extra = await supertest(app.getHttpServer()).get(`${valid}&extra=value`)
  expect(extra.status).toBe(400)
  expect(extra.body.error).toEqual({ code: 'INVALID_REQUEST', fields: ['query.extra'] })

  const duplicate = await supertest(app.getHttpServer()).get(`${valid}&actorId=${actorA.actorId}`)
  expect(duplicate.status).toBe(400)
  expect(duplicate.body.error.fields).toContain('query.actorId')

  const missing = await supertest(app.getHttpServer()).get(`${BASE_PATH}/consultas/formulario?runId=${runId}`)
  expect(missing.status).toBe(400)
  expect(missing.body.error.fields).toEqual(['query.actorId', 'query.sessionId'])

  const body = await supertest(app.getHttpServer()).get(valid).send({ body: true })
  expect(body.status).toBe(400)
  expect(body.body.error.fields).toEqual(['body'])

  const path = await supertest(app.getHttpServer()).get(valid.replace('/formulario?', '/%66ormulario?'))
  expect(path.status).toBe(400)
  expect(path.body.error.fields).toContain('path')
})

it('wrong_run_actor_session preserves MR2 precedence and errors', async () => {
  const { runId, actorA, actorB } = await resetRun()
  const session = await createSession(runId, actorA.actorId)
  const wrongRun = await supertest(app.getHttpServer())
    .get(consultationPath('formulario', '10000000-0000-4000-8000-000000000001', actorA.actorId, session.sessionId))
  expect(wrongRun.status).toBe(409)
  expect(wrongRun.body.error.code).toBe('RUN_CHANGED')

  const wrongActor = await supertest(app.getHttpServer())
    .get(consultationPath('formulario', runId, actorB.actorId, session.sessionId))
  expect(wrongActor.status).toBe(409)
  expect(wrongActor.body.error.code).toBe('SESSION_CONTEXT_MISMATCH')

  const unknownSession = await supertest(app.getHttpServer())
    .get(consultationPath('formulario', runId, actorA.actorId, '00000000-0000-4000-8000-000000000001'))
  expect(unknownSession.status).toBe(404)
  expect(unknownSession.body.error.code).toBe('SESSION_NOT_FOUND')
})

it('expired_read rejects the exact server-side expiry boundary', async () => {
  const { runId, startElapsed, actorA } = await resetRun()
  const session = await createSession(runId, actorA.actorId)
  elapsed.value = startElapsed + 900000
  const response = await supertest(app.getHttpServer())
    .get(consultationPath('formulario', runId, actorA.actorId, session.sessionId))

  expect(response.status).toBe(409)
  expect(response.body.error.code).toBe('SESSION_EXPIRED')
  expect(repository.readSnapshot().sessions).toHaveLength(1)
})

it('session_boundary_899999_900000 serves at 899999ms and expires at 900000ms', async () => {
  const { runId, startElapsed, actorA } = await resetRun()
  const session = await createSession(runId, actorA.actorId)
  elapsed.value = startElapsed + 899999
  const active = await supertest(app.getHttpServer())
    .get(consultationPath('formulario', runId, actorA.actorId, session.sessionId))
  expect(active.status).toBe(200)
  elapsed.value = startElapsed + 900000
  const expired = await supertest(app.getHttpServer())
    .get(consultationPath('formulario', runId, actorA.actorId, session.sessionId))
  expect(expired.status).toBe(409)
  expect(expired.body.error.code).toBe('SESSION_EXPIRED')
})

it('run_reset invalidates prior session reads without mutating the old run into a new identity', async () => {
  const { runId: oldRun, actorA } = await resetRun()
  const session = await createSession(oldRun, actorA.actorId)
  const newRun = repository.resetForTests()
  const response = await supertest(app.getHttpServer())
    .get(consultationPath('formulario', oldRun, actorA.actorId, session.sessionId))

  expect(newRun).not.toBe(oldRun)
  expect(response.status).toBe(409)
  expect(response.body.runId).toBe(newRun)
  expect(response.body.error.code).toBe('RUN_CHANGED')
  expect(repository.readSnapshot().sessions).toEqual([])
})

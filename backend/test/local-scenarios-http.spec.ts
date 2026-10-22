import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, it } from 'vitest'
import supertest from 'supertest'
import { validateScenarioCatalogResponse } from '../../shared/local-profile-dashboard.mjs'
import { buildBuiltInEnrollmentScenarioBundles } from '../src/matricula-regular/enrollment-scenarios.js'
import { createLocalProfileDashboardTestApp, type LocalProfileDashboardTestApp } from './local-profile-dashboard-test-app.js'

let handle: LocalProfileDashboardTestApp
let origin: string

beforeAll(async () => {
  handle = await createLocalProfileDashboardTestApp({ scenarios: buildBuiltInEnrollmentScenarioBundles() })
  origin = await handle.listen(0)
}, 30000)

afterAll(async () => handle?.close())

async function selection(runId: string, scenarioId: string) {
  return supertest(handle.app.getHttpServer())
    .post('/local/perfiles/v1/escenarios/seleccion')
    .send({ runId, scenarioId })
}

async function submit(runId: string, actorId: string, selection: unknown[]) {
  const sessionResponse = await fetch(`${origin}/local/matricula-regular/v1/sesiones`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId, actorId }),
  })
  expect(sessionResponse.status).toBe(200)
  const session = await sessionResponse.json() as { data: { sessionId: string } }
  const actor = handle.repository.readSnapshot().actors.find((candidate) => candidate.actorId === actorId)!
  const response = await fetch(`${origin}/local/matricula-regular/v1/solicitudes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId, actorId, sessionId: session.data.sessionId, requestId: randomUUID(), profileRevision: actor.profileRevision, selection }),
  })
  return response.json() as Promise<{ data: { state: string; enrollmentId: string | null; reportPath: string | null } }>
}

it('lists nine profiles and metadata in fixed order, including safe prerequisite recommendations', async () => {
  const response = await supertest(handle.app.getHttpServer()).get('/local/perfiles/v1/escenarios')
  expect(response.status).toBe(200)
  expect(() => validateScenarioCatalogResponse(response.body)).not.toThrow()
  expect(response.body.data.scenarios.map(({ scenarioId }: { scenarioId: string }) => scenarioId)).toEqual([
    'regular', 'repitencia', 'tutoria', 'prerrequisito', 'cruce', 'cupo', 'deuda', 'docente-no-asignado', 'prioridad',
  ])
  const prerequisite = response.body.data.scenarios[3]
  expect(prerequisite.description).toContain('C13 queda fuera')
  expect(prerequisite.profiles[0].recommendedCourseIds).toEqual(['SYN-SIS-C09', 'SYN-SIS-C10', 'SYN-SIS-C11', 'SYN-SIS-C12'])
  expect(prerequisite.profiles[0].recommendedCourseIds).not.toContain('SYN-SIS-C13')
  expect(prerequisite.profiles[0].expectedResult).toContain('la matrícula se acepta')
  expect(prerequisite.profiles[0].summary).toContain('60 aprobadas')
})

it('switches to a fresh run, clears all mutable state and rejects stale or malformed requests without effects', async () => {
  const initial = await supertest(handle.app.getHttpServer()).get('/local/perfiles/v1/escenarios')
  const oldRunId = initial.body.runId as string
  const regular = buildBuiltInEnrollmentScenarioBundles().find(({ scenarioId }) => scenarioId === 'regular')!
  const accepted = await submit(oldRunId, 'SYN-SIS-A', regular.cases.find(({ actorId }) => actorId === 'SYN-SIS-A')!.selection)
  expect(accepted.data.state).toBe('accepted')
  expect(accepted.data.enrollmentId).toBeTruthy()
  expect(handle.repository.readSnapshot().reports).toHaveLength(1)

  const changed = await selection(oldRunId, 'tutoria')
  expect(changed.status).toBe(200)
  expect(changed.body.runId).not.toBe(oldRunId)
  expect(changed.body.data.profiles.map(({ actorId }: { actorId: string }) => actorId)).toEqual([
    'SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B',
  ])
  const currentRunId = changed.body.runId as string
  const clean = handle.repository.readSnapshot()
  expect(clean.sessions).toEqual([])
  expect(clean.requests).toEqual([])
  expect(clean.enrollments).toEqual([])
  expect(clean.reports).toEqual([])
  expect(clean.offer.map(({ sections }) => sections[0]!.occupied)).toEqual(
    buildBuiltInEnrollmentScenarioBundles().find(({ scenarioId }) => scenarioId === 'tutoria')!.fixtures.flatMap(({ offer }) => offer.map(({ sections }) => sections[0]!.occupied)),
  )

  const stale = await selection(oldRunId, 'regular')
  expect(stale.status).toBe(409)
  expect(stale.body.error.code).toBe('RUN_CHANGED')
  expect(handle.repository.readSnapshot()).toEqual(clean)

  const tutoria = buildBuiltInEnrollmentScenarioBundles().find(({ scenarioId }) => scenarioId === 'tutoria')!
  const caseA = tutoria.cases.find(({ actorId }) => actorId === 'SYN-SIS-A')!
  const caseB = tutoria.cases.find(({ actorId }) => actorId === 'SYN-SIS-B')!
  const acceptedA = await submit(currentRunId, caseA.actorId, caseA.selection)
  const rejectedB = await submit(currentRunId, caseB.actorId, caseB.selection)
  expect(acceptedA.data.state).toBe('accepted')
  expect(acceptedA.data.reportPath).toContain('/reportes/')
  expect(rejectedB.data.state).toBe('rejected')
  expect(rejectedB.data.enrollmentId).toBeNull()
  expect(handle.repository.readSnapshot().enrollments).toHaveLength(1)
  expect(handle.repository.readSnapshot().reports).toHaveLength(1)

  const beforeInvalid = handle.repository.readSnapshot()
  const malformed = await selection(currentRunId, 'inventado')
  expect(malformed.status).toBe(400)
  expect(malformed.body.error).toEqual({ code: 'INVALID_REQUEST', fields: ['body.scenarioId'] })
  const extra = await supertest(handle.app.getHttpServer())
    .post('/local/perfiles/v1/escenarios/seleccion?unexpected=1')
    .send({ runId: currentRunId, scenarioId: 'regular' })
  expect(extra.status).toBe(400)
  expect(extra.body.error.fields).toContain('query.unexpected')
  expect(handle.repository.readSnapshot()).toEqual(beforeInvalid)
})

it('returns an empty catalog when scenarios are not configured', async () => {
  const isolated = await createLocalProfileDashboardTestApp()
  try {
    const isolatedOrigin = await isolated.listen(0)
    const response = await fetch(`${isolatedOrigin}/local/perfiles/v1/escenarios`)
    const body = await response.json() as { runId: string; data: { currentScenarioId: string | null; scenarios: unknown[] } }
    expect(response.status).toBe(200)
    expect(body.data.currentScenarioId).toBeNull()
    expect(body.data.scenarios).toEqual([])
  } finally {
    await isolated.close()
  }
})

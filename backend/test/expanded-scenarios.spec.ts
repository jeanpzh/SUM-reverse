import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { buildBuiltInEnrollmentScenarioBundles } from '../src/matricula-regular/enrollment-scenarios.js'
import { scenarioPlanRows, scenarioProgrammingRows } from '../src/matricula-regular/scenario-reference.seed.js'
import { createLocalProfileDashboardTestApp } from './local-profile-dashboard-test-app.js'
import { projectProfileRead } from '../src/local-profile-dashboard/profile-projection.js'

it('preserves the full reference plan and programming, with long coherent school-specific histories', () => {
  const bundles = buildBuiltInEnrollmentScenarioBundles()
  for (const fixture of bundles[0]!.fixtures) for (const actor of fixture.actors) {
    expect(actor.scenarioData!.plan.data).toHaveLength(97)
    expect(actor.scenarioData!.programming).toEqual(scenarioProgrammingRows)
    expect(actor.academic!.catalog).toHaveLength(85)
    expect(actor.academic!.attempts.length).toBeGreaterThanOrEqual(60)
    expect(new Set(actor.academic!.attempts.map((attempt) => attempt.period)).size).toBe(9)
    expect(actor.scenarioData!.plan.data.map((row) => ({ ...row, codEscuela: 1 }))).toEqual(scenarioPlanRows)
    const history = projectProfileRead('historial', actor)
    expect(history.resumen.promedioPonderado).toBe(actor.ponderado)
    expect(history.resumen.asignaturasAprobadas).toBe(actor.approvedCourseIds.length)
    expect(actor.failedCourses).toHaveLength(actor.actorId.endsWith('-A') ? 0 : 2)
    const passed = new Map<string, string>()
    for (const attempt of actor.academic!.attempts) {
      const course = actor.academic!.catalog.find((item) => item.courseId === attempt.courseId)!
      for (const prerequisite of course.prerequisiteIds) expect(passed.get(prerequisite), `${course.name}: ${prerequisite}`).toBeDefined()
      if (attempt.result === 'approved') passed.set(course.courseId, attempt.period)
    }
    for (const row of actor.preEnrollment) {
      expect(actor.approvedCourseIds).not.toContain(row.courseId)
      const course = fixture.offer.find((item) => item.courseId === row.courseId)!
      expect(course.prerequisiteIds.every((id) => actor.approvedCourseIds.includes(id))).toBe(true)
    }
  }
})

it('retains all 36 scenario outcomes through real HTTP and serves complete profile/reference views', async () => {
  for (const bundle of buildBuiltInEnrollmentScenarioBundles()) {
    const app = await createLocalProfileDashboardTestApp({ fixtures: bundle.fixtures,
      clock: { now: () => new Date(bundle.clockBase) } })
    try {
      const origin = await app.listen(0)
      for (const item of bundle.cases) {
        app.reset()
        const runId = app.repository.runId
        const sessionResponse = await fetch(`${origin}/local/matricula-regular/v1/sesiones`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId, actorId: item.actorId }),
        })
        expect(sessionResponse.status).toBe(200)
        const session = await sessionResponse.json() as { data: { sessionId: string } }
        const identity = { runId, actorId: item.actorId, sessionId: session.data.sessionId }
        if (bundle.scenarioId === 'regular') for (const key of ['perfil', 'formulario', 'historial', 'plan', 'programacion']) {
          const read = await fetch(`${origin}/local/perfiles/v1/consultas/${key}?${new URLSearchParams(identity)}`)
          expect(read.status, key).toBe(200)
          const body = await read.json() as { data: { payload: { data: unknown } } }
          if (key === 'plan') expect(body.data.payload.data).toHaveLength(97)
          if (key === 'programacion') expect((body.data.payload.data as { programacion: unknown[] }).programacion).toHaveLength(165)
        }
        const actor = app.repository.readSnapshot().actors.find((actor) => actor.actorId === item.actorId)!
        const response = await fetch(`${origin}/local/matricula-regular/v1/solicitudes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...identity, requestId: randomUUID(), profileRevision: actor.profileRevision, selection: item.selection }),
        })
        const result = await response.json() as { data: { state: string; causes: unknown[]; gaps: unknown[] } }
        expect(response.status, `${bundle.scenarioId}/${item.actorId}`).toBe(200)
        expect(result.data.state, `${bundle.scenarioId}/${item.actorId}`).toBe(item.expected.state)
        expect(result.data.causes).toEqual(item.expected.causes)
        expect(result.data.gaps).toEqual(item.expected.gaps)
      }
    } finally { await app.close() }
  }
}, 120000)

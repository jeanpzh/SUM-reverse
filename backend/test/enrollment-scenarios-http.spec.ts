import { randomUUID } from 'node:crypto'
import { afterEach, expect, it } from 'vitest'
import { buildEnrollmentScenarioBundles } from '../src/matricula-regular/enrollment-scenarios.js'
import type { SelectedPlanCourse } from '../src/matricula-regular/enrollment-scenarios.js'
import { createLocalProfileDashboardTestApp, type LocalProfileDashboardTestApp } from './local-profile-dashboard-test-app.js'

const rows: SelectedPlanCourse[] = [
  { codAsignatura: '20118041', desAsignatura: 'ALGORÍTMICA Y PROGRAMACIÓN ORIENTADA A OBJETOS', creditos: 4, ciclo: 4, tipoAsignatura: 'O' },
  { codAsignatura: '20118051', desAsignatura: 'BASE DE DATOS', creditos: 4, ciclo: 5, tipoAsignatura: 'O' },
  { codAsignatura: '20118066', desAsignatura: 'REDES, TRANSMISIÓN Y AUTOMATIZACIÓN Y CONTROL', creditos: 4, ciclo: 6, tipoAsignatura: 'O' },
  { codAsignatura: '20118084', desAsignatura: 'INGENIERIA DE LA INFORMACIÓN', creditos: 4, ciclo: 8, tipoAsignatura: 'O' },
]
const bundles = buildEnrollmentScenarioBundles(rows, 'b'.repeat(64))
const opened: LocalProfileDashboardTestApp[] = []

afterEach(async () => Promise.all(opened.splice(0).map((handle) => handle.close())))

async function open(fixtures: LocalProfileDashboardTestAppOptions['fixtures']) {
  const handle = await createLocalProfileDashboardTestApp({ clock: { now: () => new Date('2026-08-11T14:00:00.000Z') }, fixtures })
  opened.push(handle)
  return handle
}

type LocalProfileDashboardTestAppOptions = Parameters<typeof createLocalProfileDashboardTestApp>[0]

it('serves all 36 PEM cases over loopback HTTP, including lookup, report, idempotency and occupancy effects', async () => {
  for (const bundle of bundles) {
    const handle = await open(bundle.fixtures)
    const origin = await handle.listen(0)
    for (const scenarioCase of bundle.cases) {
      handle.reset()
      const initial = handle.repository.readSnapshot()
      const actor = initial.actors.find(({ actorId }) => actorId === scenarioCase.actorId)!
      const catalogResponse = await fetch(`${origin}/local/perfiles/v1/perfiles`)
      const catalog = await catalogResponse.json() as { runId: string }
      const sessionResponse = await fetch(`${origin}/local/matricula-regular/v1/sesiones`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: catalog.runId, actorId: scenarioCase.actorId }),
      })
      const session = await sessionResponse.json() as { data: { sessionId: string } }
      const identity = new URLSearchParams({ runId: catalog.runId, actorId: actor.actorId, sessionId: session.data.sessionId })
      for (const key of ['prematricula', 'matriculaInfo']) {
        const read = await fetch(`${origin}/local/perfiles/v1/consultas/${key}?${identity}`)
        expect(read.status).toBe(200)
        const payload = await read.json() as { data: { payload: { preEnrollment: typeof actor.preEnrollment } } }
        expect(payload.data.payload.preEnrollment).toEqual(actor.preEnrollment)
        expect(payload.data.payload.preEnrollment.map(({ courseId }) => courseId.slice(-3)))
          .toEqual(actor.actorId.endsWith('-A') ? ['C09', 'C10', 'C11', 'C12'] : ['C07', 'C08', 'C09', 'C10'])
      }
      const requestId = randomUUID()
      const submission = {
        runId: catalog.runId, actorId: scenarioCase.actorId, sessionId: session.data.sessionId,
        requestId, profileRevision: actor.profileRevision, selection: scenarioCase.selection,
      }
      const response = await fetch(`${origin}/local/matricula-regular/v1/solicitudes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission),
      })
      const body = await response.json() as { runId: string; data: { state: string; causes: unknown[]; gaps: unknown[]; enrollmentId: string | null; reportPath: string | null } }
      expect(catalogResponse.status, `${bundle.scenarioId}/${scenarioCase.actorId} catalog`).toBe(200)
      expect(sessionResponse.status, `${bundle.scenarioId}/${scenarioCase.actorId} session`).toBe(200)
      expect(response.status, `${bundle.scenarioId}/${scenarioCase.actorId} submission`).toBe(200)
      expect(body.data.state, `${bundle.scenarioId}/${scenarioCase.actorId} state`).toBe(scenarioCase.expected.state)
      expect(body.data.causes, `${bundle.scenarioId}/${scenarioCase.actorId} causes`).toEqual(scenarioCase.expected.causes)
      expect(body.data.gaps, `${bundle.scenarioId}/${scenarioCase.actorId} gaps`).toEqual(scenarioCase.expected.gaps)

      const lookupUrl = `${origin}/local/matricula-regular/v1/solicitudes/${requestId}?${new URLSearchParams({ runId: catalog.runId, actorId: scenarioCase.actorId })}`
      const lookup = await (await fetch(lookupUrl)).json() as { data: { state: string; outcome: unknown } }
      expect(lookup.data.state).toBe('known')
      expect(lookup.data.outcome).toEqual(body.data)
      const afterFirst = handle.repository.readSnapshot()

      if (scenarioCase.expected.state === 'accepted') {
        expect(body.data.enrollmentId).toBeTruthy()
        expect(body.data.reportPath).toBe(`/local/matricula-regular/v1/reportes/${body.data.enrollmentId}`)
        expect(afterFirst.enrollments).toHaveLength(1)
        expect(afterFirst.reports).toHaveLength(1)
        for (const item of scenarioCase.selection) {
          const selected = afterFirst.offer.find(({ courseId }) => courseId === item.courseId)!.sections.find(({ sectionId }) => sectionId === item.sectionId)!
          const before = initial.offer.find(({ courseId }) => courseId === item.courseId)!.sections.find(({ sectionId }) => sectionId === item.sectionId)!
          expect(selected.occupied).toBe(before.occupied + 1)
        }
        const reportResponse = await fetch(`${origin}${body.data.reportPath}?${new URLSearchParams({ runId: catalog.runId, actorId: scenarioCase.actorId })}`)
        const report = await reportResponse.json() as { data: { rows: unknown[] } }
        expect(reportResponse.status).toBe(200)
        expect(report.data.rows).toHaveLength(scenarioCase.selection.length)
      } else {
        expect(body.data.enrollmentId).toBeNull()
        expect(body.data.reportPath).toBeNull()
        expect(afterFirst.enrollments).toHaveLength(0)
        expect(afterFirst.reports).toHaveLength(0)
        expect(afterFirst.offer.map((course) => course.sections[0]!.occupied)).toEqual(initial.offer.map((course) => course.sections[0]!.occupied))
      }

      const retryResponse = await fetch(`${origin}/local/matricula-regular/v1/solicitudes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission),
      })
      const retry = await retryResponse.json() as { data: unknown }
      expect(retryResponse.status).toBe(200)
      expect(retry.data).toEqual(body.data)
      const afterRetry = handle.repository.readSnapshot()
      expect(afterRetry.offer.map((course) => course.sections[0]!.occupied)).toEqual(afterFirst.offer.map((course) => course.sections[0]!.occupied))
      expect(afterRetry.enrollments).toHaveLength(afterFirst.enrollments.length)
      expect(afterRetry.reports).toHaveLength(afterFirst.reports.length)
    }
  }
}, 120000)

it('reset returns to the chosen seed, clears all request/session/report state and issues a new run', async () => {
  const externalSeed = structuredClone(bundles[0]!.fixtures)
  const expectedActors = structuredClone(externalSeed.flatMap(({ actors }) => actors))
  const expectedOffer = structuredClone(externalSeed.flatMap(({ offer }) => offer))
  const handle = await open(externalSeed)
  const origin = await handle.listen(0)
  const firstRun = handle.repository.runId
  const firstCatalog = await (await fetch(`${origin}/local/perfiles/v1/perfiles`)).json() as { runId: string }
  const actorId = 'SYN-SIS-A'
  const sessionResponse = await fetch(`${origin}/local/matricula-regular/v1/sesiones`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: firstCatalog.runId, actorId: 'SYN-SIS-A' }),
  })
  const session = await sessionResponse.json() as { data: { sessionId: string } }
  const actor = handle.repository.readSnapshot().actors.find(({ actorId: id }) => id === actorId)!
  const requestId = randomUUID()
  const submission = {
    runId: firstCatalog.runId, actorId, sessionId: session.data.sessionId, requestId,
    profileRevision: actor.profileRevision, selection: bundles[0]!.cases[0]!.selection,
  }
  const submitted = await fetch(`${origin}/local/matricula-regular/v1/solicitudes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission),
  })
  expect(submitted.status).toBe(200)
  expect(handle.repository.readSnapshot().enrollments).toHaveLength(1)
  externalSeed[0]!.actors[0]!.name = 'mutación externa posterior al arranque'
  const nextRun = handle.reset()
  const snapshot = handle.repository.readSnapshot()
  expect(nextRun).not.toBe(firstRun)
  expect(snapshot.sessions).toEqual([])
  expect(snapshot.requests).toEqual([])
  expect(snapshot.reports).toEqual([])
  expect(snapshot.enrollments).toEqual([])
  expect(snapshot.actors).toEqual(expectedActors)
  expect(snapshot.offer).toEqual(expectedOffer)
})

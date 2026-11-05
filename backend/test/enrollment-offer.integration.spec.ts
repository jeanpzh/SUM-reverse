import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import supertest from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'
import { ContextService } from '../src/matricula-regular/context.service.js'
import { OperationalOfferModule } from '../src/matricula-regular/operational-offer.module.js'
import { PrematriculaModule } from '../src/prematricula/prematricula.module.js'
import { OperationalOfferStore } from '../src/matricula-regular/operational-offer.store.js'
import { OperationalStorageError } from '../src/matricula-regular/operational-run-store.js'
import type { OperationalRunDocument } from '../src/matricula-regular/operational-run-store.js'
import { SavedDraftStore } from '../src/programacion-academica/saved-draft-store.js'
import { evaluateAndCommitSubmission } from '../src/matricula-regular/matricula-regular.service.js'
import { validateSubmission } from '../../shared/matricula-regular.mjs'
import { LocalScenariosService } from '../src/local-profile-dashboard/local-scenarios.service.js'
import { buildBuiltInEnrollmentScenarioBundles } from '../src/matricula-regular/enrollment-scenarios.js'

const catalog = createDemoCatalog()
const e1 = '/local/programacion-academica/v1'
const e3 = '/local/matricula-regular/v1'
const courseCodes = ['20118091', '20118094', '20118095', '20118097', '20118084', '20118087']
const actorA = 'SYN-SIS-A'
const availability = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 }))

describe('operational enrollment offer integration', () => {
  const directories: string[] = []
  let app: INestApplication
  let directory: string

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'sum-enrollment-offer-'))
    directories.push(directory)
    vi.stubEnv('SUM_ACADEMIC_DRAFT_DIR', directory)
    vi.stubEnv('SUM_ACADEMIC_SCHEDULING', '1')
    vi.stubEnv('SUM_LOCAL_SCENARIOS', '1')
    vi.stubEnv('SIMULATOR_DEPLOYMENT', 'local')
    vi.stubEnv('SIMULATOR_STORAGE', 'memory')
    vi.stubEnv('MATRICULA_SNAPSHOT_DIR', undefined)
    app = await startApp()
  })

  afterEach(async () => {
    await app?.close()
    for (const target of directories.splice(0)) {
      const absolute = resolve(target)
      const temporaryRoot = resolve(tmpdir()) + sep
      if (!absolute.toLowerCase().startsWith(temporaryRoot.toLowerCase())
        || !basename(absolute).startsWith('sum-enrollment-offer-')) throw new Error('Unsafe synthetic offer test cleanup target')
      rmSync(absolute, { recursive: true, force: true })
    }
    vi.unstubAllEnvs()
  })

  async function startApp(): Promise<INestApplication> {
    const module = await Test.createTestingModule({ imports: [OperationalOfferModule, PrematriculaModule] }).compile()
    const instance = module.createNestApplication({ logger: false })
    await instance.init()
    instance.get(LocalScenariosService).configure(buildBuiltInEnrollmentScenarioBundles())
    return instance
  }

  async function publish(options: { codes?: string[]; capacity?: number; period?: string; estimatedDemand?: number } = {}) {
    const capacity = options.capacity ?? 45
    const period = options.period ?? '2027-I'
    const selected = (options.codes ?? courseCodes).map((code) => catalog.courses.find((course) => course.courseId === code))
    expect(selected.every(Boolean)).toBe(true)
    const courses = selected as NonNullable<typeof selected[number]>[]
    const request = {
      revision: catalog.revision,
      planningPolicy: { revision: 'FISI-PLANNING-1', period, allowAfternoon: false, allowSaturday: false },
      demands: courses.map((course) => ({
        courseId: course.courseId,
        estimatedDemand: options.estimatedDemand ?? (options.capacity === undefined ? 46 : capacity),
        targetCapacity: capacity,
        deliveryMode: course.planningPatterns![0]!.weeklySessions.reduce((sum, session) => sum + session.durationMinutes, 0) > 240 ? 'split' : 'continuous',
        patternId: course.planningPatterns![0]!.id,
      })),
      resources: {
        teachers: courses.map((course, index) => ({
          id: `OFFER-T${index}`, name: `Docente sintético ${index + 1}`, courseIds: [course.courseId], maxWeeklyMinutes: 2400,
          availability, facultyId: 'FISI', category: 'principal', qualificationSource: 'synthetic',
        })),
        rooms: Array.from({ length: 8 }, (_, index) => ({
          id: `OFFER-R${index}`, name: `Ambiente sintético ${index + 1}`, kind: index % 2 ? 'laboratory' : 'classroom', capacity: 45, availability,
        })),
      },
    }
    const proposal = (await supertest(app.getHttpServer()).post(`${e1}/propuestas`).send(request).expect(200)).body
    expect(proposal).toMatchObject({ status: 'complete', coverageComplete: true })
    const configuration = { schoolId: 'SISTEMAS', academicPeriod: period, demandSourceId: 'existing-regular-v1', demandBaseRequest: null, request }
    let draft = (await supertest(app.getHttpServer()).post(`${e1}/borradores/guardar`).send({
      id: null, expectedVersion: null, title: 'Oferta sintética 2027-I', state: 'draft', configuration,
      proposalId: proposal.proposalId, proposalEditVersion: proposal.editVersion,
    }).expect(200)).body
    draft = (await supertest(app.getHttpServer()).post(`${e1}/borradores/${draft.id}/revision/enviar`)
      .send({ expectedVersion: draft.version }).expect(200)).body.draft
    for (const teacher of draft.review.teachers) {
      draft = (await supertest(app.getHttpServer()).post(`${e1}/borradores/${draft.id}/revision/responder`).send({
        expectedVersion: draft.version, round: draft.review.round, teacherId: teacher.teacherId,
        decision: 'conformity', observation: '',
      }).expect(200)).body.draft
    }
    draft = (await supertest(app.getHttpServer()).post(`${e1}/borradores/${draft.id}/aprobar`)
      .send({ expectedVersion: draft.version }).expect(200)).body.draft
    const history = (await supertest(app.getHttpServer()).get(`${e1}/publicaciones`).expect(200)).body
    draft = (await supertest(app.getHttpServer()).post(`${e1}/borradores/${draft.id}/publicar`)
      .send({ expectedVersion: draft.version, expectedCurrentId: history.currentId }).expect(200)).body.draft
    return (await supertest(app.getHttpServer()).get(`${e1}/publicaciones/${draft.id}`).expect(200)).body
  }

  async function activate(publication: { id: string; publicationVersion: number }) {
    const current = (await supertest(app.getHttpServer()).get(`${e3}/ofertas`).expect(200)).body
    return (await supertest(app.getHttpServer()).post(`${e3}/ofertas/activar`).send({
      publicationId: publication.id, publicationVersion: publication.publicationVersion, expectedActiveRunId: current.activeRunId,
    }).expect(200)).body.offer as { runId: string; offerVersion: number }
  }

  async function submission(runId: string, actorId = actorA) {
    const context = (await supertest(app.getHttpServer()).get(`${e3}/contextos/${actorId}`).query({ runId }).expect(200)).body.data
    const session = (await supertest(app.getHttpServer()).post(`${e3}/sesiones`).send({ runId, actorId }).expect(200)).body.data
    const value = { runId, actorId, sessionId: session.sessionId, requestId: randomUUID(), profileRevision: context.profileRevision,
      selection: context.offer.map((course: { courseId: string; sections: Array<{ sectionId: string }> }) => ({ courseId: course.courseId, sectionId: course.sections[0]!.sectionId })) }
    validateSubmission(value)
    return value
  }

  it('activates the exact publication, persists an accepted enrollment, and restores it on restart', async () => {
    const publication = await publish()
    const catalogResponse = (await supertest(app.getHttpServer()).get(`${e3}/ofertas`).expect(200)).body
    const activationRequest = {
      publicationId: publication.id,
      publicationVersion: publication.publicationVersion,
      expectedActiveRunId: catalogResponse.activeRunId,
    }
    const activated = (await supertest(app.getHttpServer()).post(`${e3}/ofertas/activar`).send(activationRequest).expect(200)).body
    expect(activated).toMatchObject({ reused: false, offer: { academicPeriod: '2027-I', publicationId: publication.id, publicationVersion: publication.publicationVersion } })
    const reused = (await supertest(app.getHttpServer()).post(`${e3}/ofertas/activar`).send(activationRequest).expect(200)).body
    expect(reused).toMatchObject({ reused: true, offer: { runId: activated.offer.runId } })

    const runId = activated.offer.runId
    expect(app.get(ContextService).read(actorA, runId).data.scope.period).toBe('2027-I')
    const contextResponse = await supertest(app.getHttpServer()).get(`${e3}/contextos/${actorA}`).query({ runId })
    expect(contextResponse.status, JSON.stringify(contextResponse.body)).toBe(200)
    const context = contextResponse.body.data
    expect(context.scope.period).toBe('2027-I')
    expect(context.sources.some((source: { id: string }) => source.id === 'E3-PUBLICATION-1')).toBe(true)
    const session = (await supertest(app.getHttpServer()).post(`${e3}/sesiones`).send({ runId, actorId: actorA }).expect(200)).body.data
    const form = await supertest(app.getHttpServer()).get('/local/perfiles/v1/consultas/formulario')
      .query({ runId, actorId: actorA, sessionId: session.sessionId }).expect(200)
    expect(form.body.data.payload.data.alumno.periodo).toBe('2027-1')
    for (const course of context.offer) expect(course.sections.map((section: { label: string }) => section.label)).toEqual(['1', '2'])
    const choices = context.offer.filter((course: { cycle?: number }) => course.cycle === 9)
      .map((course: { courseId: string; sections: Array<{ sectionId: string }> }) => ({ courseId: course.courseId, sectionId: course.sections[0]!.sectionId }))
    expect(choices).toHaveLength(4)
    const request = {
      runId, actorId: actorA, sessionId: session.sessionId, requestId: randomUUID(), profileRevision: context.profileRevision,
      selection: choices,
    }
    const outcome = (await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send(request).expect(200)).body.data
    expect(outcome.state).toBe('accepted')
    const committed = app.get(MatriculaRegularRepository).readSnapshot(runId)
    expect(committed.requests.some(([id]) => id === `${actorA}:${request.requestId}`)).toBe(true)
    expect(committed.enrollments).toHaveLength(1)
    expect(committed.reports).toHaveLength(1)
    expect(committed.offer.flatMap((course) => course.sections).some((section) => section.occupied > 0)).toBe(true)

    await app.close()
    app = await startApp()
    const restored = app.get(MatriculaRegularRepository).readSnapshot(runId)
    expect(restored.requests.some(([id]) => id === `${actorA}:${request.requestId}`)).toBe(true)
    expect(restored.enrollments).toHaveLength(1)
    expect(restored.reports).toHaveLength(1)
    expect(restored.offer.flatMap((course) => course.sections).some((section) => section.occupied > 0)).toBe(true)
    await supertest(app.getHttpServer()).get(`${e3}/contextos/${actorA}`).query({ runId: randomUUID() })
      .expect(409).expect(({ body }) => expect(body.error.code).toBe('RUN_CHANGED'))
  })

  it('does not replace the active offer when activation uses a stale compare-and-swap value', async () => {
    const firstPublication = await publish()
    const publication = await publish()
    const initial = (await supertest(app.getHttpServer()).get(`${e3}/ofertas`).expect(200)).body
    const accepted = (await supertest(app.getHttpServer()).post(`${e3}/ofertas/activar`).send({
      publicationId: firstPublication.id, publicationVersion: firstPublication.publicationVersion, expectedActiveRunId: initial.activeRunId,
    }).expect(200)).body
    const conflict = await supertest(app.getHttpServer()).post(`${e3}/ofertas/activar`).send({
      publicationId: publication.id, publicationVersion: publication.publicationVersion, expectedActiveRunId: null,
    }).expect(409)
    expect(conflict.body.error.code).toBe('ACTIVE_OFFER_CHANGED')
    expect((await supertest(app.getHttpServer()).get(`${e3}/ofertas`).expect(200)).body.activeRunId).toBe(accepted.offer.runId)
    const oldState = app.get(MatriculaRegularRepository).readSnapshot(accepted.offer.runId)
    const next = await activate(publication)
    expect(next.runId).not.toBe(accepted.offer.runId)
    expect(next.offerVersion).toBe(accepted.offer.offerVersion + 1)
    expect(app.get(MatriculaRegularRepository).readSnapshot(accepted.offer.runId)).toEqual(oldState)
  })

  it('serializes two independently admissible students competing for the last places without duplicates', async () => {
    const publication = await publish({ codes: ['20118091', '20118094', '20118092', '20118093'], capacity: 1, estimatedDemand: 2 })
    const { runId } = await activate(publication)
    const requests = [await submission(runId), await submission(runId, 'SYN-SIS-B')]
    const repository = app.get(MatriculaRegularRepository)
    const before = repository.readSnapshot(runId)
    for (const request of requests) {
      const copy = structuredClone(before)
      const candidate = { ...copy, requests: new Map(copy.requests), enrollments: new Map(copy.enrollments), reports: new Map(copy.reports) }
      expect(evaluateAndCommitSubmission(candidate, request, app.get(ContextService).now(runId)).data.state).toBe('accepted')
    }
    const outcomes = await Promise.all(requests.map((request) => supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send(request).expect(200)))
    expect(outcomes.map((response) => response.body.data.state).sort((left: string, right: string) => left.localeCompare(right))).toEqual(['accepted', 'rejected'])
    const loser = outcomes.find((response) => response.body.data.state === 'rejected')!.body.data
    expect(loser.causes.length).toBeGreaterThan(0)
    expect(loser.causes.every((cause: { code: string }) => cause.code === 'SECTION_FULL')).toBe(true)
    const committed = repository.readSnapshot(runId)
    expect(committed.enrollments).toHaveLength(1)
    expect(committed.reports).toHaveLength(1)
    expect(committed.offer.every((course) => course.sections[0]!.occupied === 1 && course.sections[1]!.occupied === 0)).toBe(true)
    const winnerIndex = outcomes.findIndex((response) => response.body.data.state === 'accepted')
    const winner = requests[winnerIndex]!
    const replay = await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send(winner).expect(200)
    expect(replay.body).toEqual(outcomes[winnerIndex]!.body)
    await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send({ ...winner, selection: winner.selection.slice(1) }).expect(409)
    expect(repository.readSnapshot(runId)).toEqual(committed)
    const loserRequest = requests[1 - winnerIndex]!
    const alternative = { ...loserRequest, requestId: randomUUID(), selection: committed.offer.map((course) => ({
      courseId: course.courseId, sectionId: course.sections[1]!.sectionId,
    })) }
    const retried = await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send(alternative).expect(200)
    expect(retried.body.data.state).toBe('accepted')
    const final = repository.readSnapshot(runId)
    expect(final.enrollments).toHaveLength(2)
    expect(final.offer.flatMap((course) => course.sections).every((section) => section.occupied === 1)).toBe(true)
    expect((await supertest(app.getHttpServer()).get(`${e1}/publicaciones/${publication.id}`).expect(200)).body).toEqual(publication)
  }, 30000)

  it('prevents a second enrollment across offer versions of the same period, including after restart', async () => {
    const options = { codes: ['20118091', '20118094', '20118095', '20118097'], capacity: 2 }
    const first = await activate(await publish(options))
    const originalRequest = await submission(first.runId)
    const accepted = (await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send(originalRequest).expect(200)).body
    expect(accepted.data.state).toBe('accepted')
    const next = await activate(await publish(options))
    const request = await submission(next.runId)
    const rejected = (await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send(request).expect(200)).body
    expect(rejected.data.state).toBe('rejected')
    expect(rejected.data.causes.map((cause: { code: string }) => cause.code)).toEqual(['ALREADY_ENROLLED'])
    expect(app.get(MatriculaRegularRepository).readSnapshot(next.runId).offer.flatMap((course) => course.sections)
      .every((section) => section.occupied === 0)).toBe(true)
    await app.close()
    app = await startApp()
    const retry = await submission(next.runId)
    const afterRestart = (await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send(retry).expect(200)).body
    expect(afterRestart.data.state).toBe('rejected')
    expect(afterRestart.data.causes.map((cause: { code: string }) => cause.code)).toEqual(['ALREADY_ENROLLED'])
    const replay = await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send(originalRequest).expect(200)
    expect(replay.body).toEqual(accepted)
    expect(app.get(MatriculaRegularRepository).readSnapshot(first.runId).enrollments).toHaveLength(1)
    expect(app.get(MatriculaRegularRepository).readSnapshot(next.runId).enrollments).toEqual([])
  }, 30000)

  it('rolls back the whole operational write on persistence failure and recovers the identical request after restart', async () => {
    const publication = await publish({ codes: ['20118091', '20118094', '20118095', '20118097'], capacity: 2 })
    const { runId } = await activate(publication)
    const request = await submission(runId)
    const repository = app.get(MatriculaRegularRepository)
    const before = repository.readSnapshot(runId)
    const write = vi.spyOn(app.get(OperationalOfferStore), 'write').mockImplementationOnce(() => {
      throw new OperationalStorageError(503, 'STORAGE_UNAVAILABLE', 'Injected synthetic disk failure')
    })
    const failed = await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send(request).expect(503)
    expect(failed.body.error.code).toBe('STORAGE_UNAVAILABLE')
    expect(repository.readSnapshot(runId)).toEqual(before)
    write.mockRestore()
    const accepted = (await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send(request).expect(200)).body
    expect(accepted.data.state).toBe('accepted')
    await app.close()
    app = await startApp()
    const lookup = await supertest(app.getHttpServer()).get(`${e3}/solicitudes/${request.requestId}`).query({ runId, actorId: actorA }).expect(200)
    expect(lookup.body.data).toEqual({ state: 'known', outcome: accepted.data })
    expect(app.get(MatriculaRegularRepository).readSnapshot(runId).sessions).toEqual([])
    const replay = await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send(request).expect(200)
    expect(replay.body).toEqual(accepted)
    expect(app.get(MatriculaRegularRepository).readSnapshot(runId).enrollments).toHaveLength(1)
  })

  it('rejects a valid-checksum operational file with inconsistent occupancy without resetting it', async () => {
    const publication = await publish({ codes: ['20118091', '20118094', '20118095', '20118097'], capacity: 1 })
    const { runId } = await activate(publication)
    await app.close()
    const store = new SavedDraftStore<OperationalRunDocument>(join(directory, 'e3-ofertas'))
    const document = store.read(runId)
    if (!document) throw new Error('Expected the independently created operational offer document')
    document.snapshot.offer[0]!.sections[0]!.occupied = 1
    store.write(runId, document)
    const file = join(directory, 'e3-ofertas', `${runId}.json`)
    const bytes = readFileSync(file, 'utf8')
    app = await startApp()
    const response = await supertest(app.getHttpServer()).get(`${e3}/ofertas`).expect(409)
    expect(response.body.error.code).toBe('DRAFT_CORRUPT')
    await supertest(app.getHttpServer()).get(`${e3}/contextos/${actorA}`).query({ runId }).expect(409)
    const legacy = await supertest(app.getHttpServer()).get(`${e3}/contextos/${actorA}`).expect(200)
    expect(legacy.body.data.scope.period).toBe('2026-II')
    expect(readFileSync(file, 'utf8')).toBe(bytes)
  })

  it('isolates other E1 periods from activation and the E2 publication picker', async () => {
    const publication = await publish({ codes: ['20118091'], capacity: 1, period: '2026-II' })
    await supertest(app.getHttpServer()).post(`${e3}/ofertas/activar`).send({ publicationId: publication.id,
      publicationVersion: publication.publicationVersion, expectedActiveRunId: null }).expect(422)
    const repository = app.get(MatriculaRegularRepository)
    const runId = repository.runId
    const session = (await supertest(app.getHttpServer()).post(`${e3}/sesiones`).send({ runId, actorId: actorA }).expect(200)).body.data
    const identity = { runId, actorId: actorA, sessionId: session.sessionId }
    const context = await supertest(app.getHttpServer()).post('/local/prematricula/v1/contexto').send({ identity }).expect(200)
    expect(context.body.publications.items).toEqual([])
    await supertest(app.getHttpServer()).post('/local/prematricula/v1/publicacion').send({ identity, publicationId: publication.id }).expect(422)
  })
})

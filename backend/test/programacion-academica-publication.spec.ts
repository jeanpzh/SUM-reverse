import { createHash } from 'node:crypto'
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import supertest from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { ACADEMIC_API } from '../../shared/programacion-academica-api.mjs'
import type { AcademicWorkspace } from '../../shared/programacion-academica-api.mjs'
import { AcademicSchedulingModule } from '../src/programacion-academica/demo-module.js'
import { SavedDraftService } from '../src/programacion-academica/saved-draft.service.js'
import { SavedDraftStore } from '../src/programacion-academica/saved-draft-store.js'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'

const catalog = createDemoCatalog()
const course = catalog.courses.find((candidate) => catalog.teachers.some((teacher) => teacher.courseIds.includes(candidate.courseId)))!
const api = ACADEMIC_API.replace(/^\/api/, '')
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
    : JSON.stringify(value) ?? 'undefined'

describe('academic approval and publication', () => {
  const directories: string[] = []
  let app: INestApplication
  let directory: string

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'sum-academic-publication-'))
    directories.push(directory)
    vi.stubEnv('SUM_ACADEMIC_DRAFT_DIR', directory)
    const module = await Test.createTestingModule({ imports: [AcademicSchedulingModule] }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app?.close()
    for (const target of directories.splice(0)) {
      const absolute = resolve(target)
      const temporaryRoot = resolve(tmpdir()) + sep
      if (!absolute.toLowerCase().startsWith(temporaryRoot.toLowerCase()) || !basename(absolute).startsWith('sum-academic-publication-')
        || lstatSync(absolute).isSymbolicLink()) throw new Error('Unsafe synthetic publication test cleanup target')
      rmSync(absolute, { recursive: true, force: true })
    }
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const requestWorkspace = (): AcademicWorkspace => ({
    schoolId: 'SISTEMAS',
    academicPeriod: '2027-I',
    lectiveHourMinutes: 60,
    demandSourceId: 'independent-120-v1',
    demandBaseRequest: null,
    request: {
      revision: catalog.revision,
      academicPeriod: '2027-I',
      lectiveHourMinutes: 60,
      demands: [{ courseId: course.courseId, estimatedDemand: 1 }],
      // Lifecycle/CAS fixture uses independently synthetic contract teachers: ordinary minima are tested separately.
      resources: structuredClone({ teachers: catalog.teachers.map((teacher) => ({ ...teacher, appointment: 'contract' as const })), rooms: catalog.rooms }),
    },
  })

  const createApproved = async (title = 'Synthetic release', conformityObservation = '', configuration = requestWorkspace()) => {
    const generated = await supertest(app.getHttpServer()).post(`${api}/propuestas`).send(configuration.request).expect(200)
    expect(generated.body.status).toBe('complete')
    const created = await supertest(app.getHttpServer()).post(`${api}/borradores/guardar`).send({
      id: null, expectedVersion: null, title, state: 'draft', configuration,
      proposalId: generated.body.proposalId, proposalEditVersion: generated.body.editVersion,
    }).expect(200)
    let current = created.body
    const submitted = await supertest(app.getHttpServer()).post(`${api}/borradores/${current.id}/revision/enviar`)
      .send({ expectedVersion: current.version }).expect(200)
    current = submitted.body.draft
    for (const teacher of current.review.teachers) {
      const decided = await supertest(app.getHttpServer()).post(`${api}/borradores/${current.id}/revision/responder`).send({
        expectedVersion: current.version, round: current.review.round, teacherId: teacher.teacherId,
        decision: 'conformity', observation: conformityObservation,
      }).expect(200)
      current = decided.body.draft
    }
    expect(current.state).toBe('ready-for-approval')
    return current
  }

  const approve = async (draft: { id: string, version: number }) => (await supertest(app.getHttpServer())
    .post(`${api}/borradores/${draft.id}/aprobar`).send({ expectedVersion: draft.version }).expect(200)).body.draft

  it('T7 client data adapter publishes through a fresh synthetic HTTP application', async () => {
    // Runtime acceptance seam crosses project roots; each project type-checks its own sources.
    const clientModule = new URL('../../client/src/data/academicScheduling.ts', import.meta.url).href
    const { publishAcademicDraft } = await import(clientModule)
    const approved = await approve(await createApproved('Synthetic HTTP integration'))
    await app.listen(0, '127.0.0.1')
    const address = app.getHttpServer().address() as { port: number }
    const fetchImpl = ((path: string | URL | Request, init?: RequestInit) => {
      const target = typeof path === 'string' ? path : path instanceof URL ? path.href : path.url
      return fetch(`http://127.0.0.1:${address.port}${target.replace(/^\/api/, '')}`, init)
    }) as typeof fetch
    const result = await publishAcademicDraft(approved.id, { expectedVersion: approved.version, expectedCurrentId: null }, fetchImpl)
    expect(result.state).toBe('published')
    await expect(publishAcademicDraft(approved.id, { expectedVersion: approved.version, expectedCurrentId: null }, fetchImpl)).rejects.toThrow()
    const provisional = requestWorkspace()
    provisional.request.resources.teachers.find((teacher) => teacher.courseIds.includes(course.courseId))!.appointment = 'faculty-ordinary'
    const underMinimum = await approve(await createApproved('Synthetic provisional', '', provisional))
    await expect(publishAcademicDraft(underMinimum.id, { expectedVersion: underMinimum.version, expectedCurrentId: approved.id }, fetchImpl)).rejects.toThrow(/acreditar|mínimo/)
  })

  it('previews, approves, publishes, serves immutable history and forks the published schedule', async () => {
    const ready = await createApproved()
    const preview = await supertest(app.getHttpServer()).get(`${api}/borradores/${ready.id}/vista-previa`).expect(200)
    expect(preview.body.state).toBe('ready-for-approval')
    expect(preview.body.schedule.assignments.length).toBeGreaterThan(0)

    const approved = await approve(ready)
    expect(approved.version).toBe(ready.version + 1)
    expect(approved.approval.sourceVersion).toBe(ready.version)
    expect(await supertest(app.getHttpServer()).get(`${api}/borradores/${ready.id}/vista-previa`).then((response) => response.body.state)).toBe('approved')
    await supertest(app.getHttpServer()).post(`${api}/borradores/${ready.id}/revision/enviar`).send({ expectedVersion: approved.version }).expect(409)

    const published = (await supertest(app.getHttpServer()).post(`${api}/borradores/${ready.id}/publicar`)
      .send({ expectedVersion: approved.version, expectedCurrentId: null }).expect(200)).body.draft
    expect(published.state).toBe('published')
    expect(published.publication.publicationVersion).toBe(1)
    const result = await supertest(app.getHttpServer()).get(`${api}/publicaciones/vigente`).expect(200)
    expect(result.body.id).toBe(ready.id)
    expect(result.body.schedule).toEqual(preview.body.schedule)
    expect(result.body).not.toHaveProperty('demandBase')
    expect((await supertest(app.getHttpServer()).get(`${api}/publicaciones`).expect(200)).body).toMatchObject({ currentId: ready.id, items: [{ publicationVersion: 1 }] })
    expect((await supertest(app.getHttpServer()).get(`${api}/publicaciones/${ready.id}`).expect(200)).body).toEqual(result.body)

    const resumed = (await supertest(app.getHttpServer()).post(`${api}/borradores/${ready.id}/continuar`).send({ expectedVersion: published.version }).expect(200)).body.draft
    expect(resumed.proposal.proposalId).toBe(published.proposal.proposalId)
    const fork = (await supertest(app.getHttpServer()).post(`${api}/borradores/${ready.id}/nuevo-borrador`).send({ expectedVersion: published.version }).expect(200)).body.draft
    expect(fork).toMatchObject({ version: 1, state: 'draft', origin: { draftId: ready.id, version: published.version, publicationVersion: 1 } })
    expect(fork.review).toBeUndefined()
    expect(fork.approval).toBeUndefined()
    expect(fork.publication).toBeUndefined()
    await supertest(app.getHttpServer()).post(`${api}/borradores/guardar`).send({
      id: published.id, expectedVersion: published.version, title: published.title, state: 'draft',
      configuration: published.configuration, proposalId: null, proposalEditVersion: null,
    }).expect(409)
    expect((await supertest(app.getHttpServer()).get(`${api}/publicaciones/${ready.id}`).expect(200)).body).toEqual(result.body)
  })

  it('uses current-publication compare-and-swap while preserving the earlier publication', async () => {
    const first = await approve(await createApproved('First'))
    const second = await approve(await createApproved('Second'))
    const firstPublished = (await supertest(app.getHttpServer()).post(`${api}/borradores/${first.id}/publicar`)
      .send({ expectedVersion: first.version, expectedCurrentId: null }).expect(200)).body.draft
    await supertest(app.getHttpServer()).post(`${api}/borradores/${second.id}/publicar`)
      .send({ expectedVersion: second.version, expectedCurrentId: null }).expect(409)
    const secondPublished = (await supertest(app.getHttpServer()).post(`${api}/borradores/${second.id}/publicar`)
      .send({ expectedVersion: second.version, expectedCurrentId: first.id }).expect(200)).body.draft
    expect(secondPublished.publication.publicationVersion).toBe(2)
    expect((await supertest(app.getHttpServer()).get(`${api}/publicaciones/vigente`).expect(200)).body.id).toBe(second.id)
    expect((await supertest(app.getHttpServer()).get(`${api}/publicaciones/${first.id}`).expect(200)).body.publicationVersion).toBe(1)
    expect(firstPublished.state).toBe('published')
  })

  it('rejects incomplete previews and approval attempts with explicit validation errors', async () => {
    const configuration = requestWorkspace()
    const saved = await supertest(app.getHttpServer()).post(`${api}/borradores/guardar`).send({
      id: null, expectedVersion: null, title: 'Incomplete synthetic draft', state: 'draft', configuration,
      proposalId: null, proposalEditVersion: null,
    }).expect(200)
    await supertest(app.getHttpServer()).get(`${api}/borradores/${saved.body.id}/vista-previa`).expect(422)
    const error = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.body.id}/aprobar`)
      .send({ expectedVersion: saved.body.version }).expect(422)
    expect(error.body.error.code).toBe('APPROVAL_NOT_READY')
    await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.body.id}/publicar`)
      .send({ expectedVersion: saved.body.version, expectedCurrentId: null }).expect(422)
  })

  it('serializes simultaneous publication attempts with current compare-and-swap', async () => {
    const first = await approve(await createApproved('Concurrent A'))
    const second = await approve(await createApproved('Concurrent B'))
    const post = (draft: { id: string, version: number }) => supertest(app.getHttpServer()).post(`${api}/borradores/${draft.id}/publicar`)
      .send({ expectedVersion: draft.version, expectedCurrentId: null })
    const results = await Promise.all([post(first), post(second)])
    expect(results.map((result) => result.status).sort((left, right) => left - right)).toEqual([200, 409])
    expect((await supertest(app.getHttpServer()).get(`${api}/publicaciones`).expect(200)).body.items).toHaveLength(1)
  })

  it('rejects resealed publication metadata and frozen schedule corruption', async () => {
    const approved = await approve(await createApproved())
    const published = (await supertest(app.getHttpServer()).post(`${api}/borradores/${approved.id}/publicar`)
      .send({ expectedVersion: approved.version, expectedCurrentId: null }).expect(200)).body.draft
    const path = join(directory, `${published.id}.json`)
    const original = readFileSync(path, 'utf8')
    const tamperAndReseal = (mutate: (payload: { document: Record<string, any> }) => void) => {
      const envelope = JSON.parse(original) as { payload: { document: Record<string, any> }, checksum: string }
      mutate(envelope.payload)
      envelope.checksum = createHash('sha256').update(canonical(envelope.payload)).digest('hex')
      writeFileSync(path, JSON.stringify(envelope), 'utf8')
    }

    tamperAndReseal((payload) => { payload.document.approval.fingerprint = '0'.repeat(64) })
    expect((await supertest(app.getHttpServer()).get(`${api}/publicaciones`).expect(409)).body.error.code).toBe('DRAFT_CORRUPT')

    writeFileSync(path, original, 'utf8')
    tamperAndReseal((payload) => { payload.document.publication.publicationVersion = 2 })
    expect((await supertest(app.getHttpServer()).get(`${api}/publicaciones/vigente`).expect(409)).body.error.code).toBe('DRAFT_CORRUPT')

    writeFileSync(path, original, 'utf8')
    tamperAndReseal((payload) => { payload.document.proposal.assignments[0].day = (payload.document.proposal.assignments[0].day % 7) + 1 })
    expect((await supertest(app.getHttpServer()).get(`${api}/publicaciones`).expect(409)).body.error.code).toBe('DRAFT_CORRUPT')
  })

  it('leaves the approved source untouched when atomic publication replacement fails', async () => {
    const approved = await approve(await createApproved())
    const saved = app.get(SavedDraftService) as unknown as { store: SavedDraftStore }
    saved.store = new SavedDraftStore(directory, () => { throw new Error('synthetic atomic replacement failure') })
    await supertest(app.getHttpServer()).post(`${api}/borradores/${approved.id}/publicar`)
      .send({ expectedVersion: approved.version, expectedCurrentId: null }).expect(503)
    const afterFailure = (await supertest(app.getHttpServer()).post(`${api}/borradores/${approved.id}/continuar`)
      .send({ expectedVersion: approved.version }).expect(200)).body.draft
    expect(afterFailure.state).toBe('approved')
    expect(afterFailure.version).toBe(approved.version)
    expect((await supertest(app.getHttpServer()).get(`${api}/publicaciones`).expect(200)).body.items).toHaveLength(0)
  })

  it('clones an approved source without changing it or assigning a publication number', async () => {
    const approved = await approve(await createApproved())
    const fork = (await supertest(app.getHttpServer()).post(`${api}/borradores/${approved.id}/nuevo-borrador`)
      .send({ expectedVersion: approved.version }).expect(200)).body.draft
    expect(fork.origin).toEqual({ draftId: approved.id, version: approved.version, publicationVersion: null })
    expect(fork.proposal.assignments).toEqual(approved.proposal.assignments)
    expect((await supertest(app.getHttpServer()).post(`${api}/borradores/${approved.id}/continuar`)
      .send({ expectedVersion: approved.version }).expect(200)).body.draft).toEqual(approved)
  })

  it('accepts an optional note on a conformity decision when approving', async () => {
    const ready = await createApproved('Conformity note', 'Reviewed and conforming')
    const approved = await approve(ready)
    expect(approved.state).toBe('approved')
  })

  it('rejects approval for pending, rejected and invalidated teacher reviews', async () => {
    const configuration = requestWorkspace()
    const generated = await supertest(app.getHttpServer()).post(`${api}/propuestas`).send(configuration.request).expect(200)
    const saved = await supertest(app.getHttpServer()).post(`${api}/borradores/guardar`).send({
      id: null, expectedVersion: null, title: 'Pending review', state: 'draft', configuration,
      proposalId: generated.body.proposalId, proposalEditVersion: generated.body.editVersion,
    }).expect(200)
    let pending = (await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.body.id}/revision/enviar`)
      .send({ expectedVersion: saved.body.version }).expect(200)).body.draft
    await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.body.id}/aprobar`).send({ expectedVersion: pending.version }).expect(422)
    const teacher = pending.review.teachers[0]
    pending = (await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.body.id}/revision/responder`).send({
      expectedVersion: pending.version, round: pending.review.round, teacherId: teacher.teacherId,
      decision: 'changes-requested', observation: 'Synthetic requested change',
    }).expect(200)).body.draft
    await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.body.id}/aprobar`).send({ expectedVersion: pending.version }).expect(422)

    const ready = await createApproved('Review invalidation')
    const changedConfiguration = structuredClone(ready.configuration)
    changedConfiguration.request.resources.teachers = changedConfiguration.request.resources.teachers.map((resource: { name: string }) => ({
      ...resource, name: `${resource.name} reviewed`,
    }))
    const changedProposal = await supertest(app.getHttpServer()).post(`${api}/propuestas`).send(changedConfiguration.request).expect(200)
    const invalidated = (await supertest(app.getHttpServer()).post(`${api}/borradores/guardar`).send({
      id: ready.id, expectedVersion: ready.version, title: ready.title, state: 'draft', configuration: changedConfiguration,
      proposalId: changedProposal.body.proposalId, proposalEditVersion: changedProposal.body.editVersion,
    }).expect(200)).body
    expect(invalidated.state).toBe('in-review')
    expect(invalidated.review.teachers.some((entry: { status: string }) => entry.status === 'outdated')).toBe(true)
    await supertest(app.getHttpServer()).post(`${api}/borradores/${ready.id}/aprobar`).send({ expectedVersion: invalidated.version }).expect(422)
  })

  it('recovers the publication from the same JSON files in a fresh service process', async () => {
    const approved = await approve(await createApproved())
    const published = (await supertest(app.getHttpServer()).post(`${api}/borradores/${approved.id}/publicar`)
      .send({ expectedVersion: approved.version, expectedCurrentId: null }).expect(200)).body.draft
    await app.close()
    const module = await Test.createTestingModule({ imports: [AcademicSchedulingModule] }).compile()
    app = module.createNestApplication()
    await app.init()
    const recovered = await supertest(app.getHttpServer()).get(`${api}/publicaciones/vigente`).expect(200)
    expect(recovered.body.id).toBe(published.id)
    expect(recovered.body.publicationVersion).toBe(1)
  })
})

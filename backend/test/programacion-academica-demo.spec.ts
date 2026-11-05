import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import supertest from 'supertest'
import { ACADEMIC_API } from '../../shared/programacion-academica-api.mjs'
import { AcademicSchedulingModule } from '../src/programacion-academica/demo-module.js'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import { assertAcademicSchedulingStartup } from '../src/programacion-academica/local-main.js'
import type { INestApplication } from '@nestjs/common'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'

const catalogPath = `${ACADEMIC_API.replace(/^\/api/, '')}/catalogo`
const proposalsPath = `${ACADEMIC_API.replace(/^\/api/, '')}/propuestas`
const defaultCatalog = createDemoCatalog()
const defaultQualifiedCourses = new Set(defaultCatalog.teachers.flatMap((teacher) => teacher.courseIds))
const selectedCourses = defaultCatalog.courses.filter((course) => defaultQualifiedCourses.has(course.courseId)).slice(0, 2)
const validRequest = () => ({
  revision: 'PA-DEMO-1',
  demands: selectedCourses.map((course, index) => ({ courseId: course.courseId, estimatedDemand: index === 0 ? 31 : 20 })),
})
const resourcesFor = (courseIds: string[]) => {
  const catalog = createDemoCatalog()
  const teachers = courseIds.map((courseId, index) => ({
    id: `TEST-TEACHER-${index + 1}`,
    name: `Configured teacher ${index + 1}`,
    courseIds: [courseId],
    maxWeeklyMinutes: 600,
    availability: catalog.windows,
  }))
  return { teachers, rooms: catalog.rooms }
}

describe('PA-DEMO-1 local scheduling API', () => {
  let app: INestApplication

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AcademicSchedulingModule] }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('serves a synthetic catalog and clones catalog and proposal results', async () => {
    const catalog = await supertest(app.getHttpServer()).get(catalogPath).expect(200)
    expect(catalog.body.courses).toHaveLength(56)
    expect(catalog.body.teachers).toHaveLength(8)
    expect(catalog.body.rooms[0].capacity).toBe(45)
    expect(catalog.body.maxExplorations).toBe(10000)
    catalog.body.courses[0].name = 'mutated'
    expect((await supertest(app.getHttpServer()).get(catalogPath).expect(200)).body.courses[0].name).not.toBe('mutated')

    const created = await supertest(app.getHttpServer()).post(proposalsPath).send(validRequest()).expect(200)
    expect(created.body.status).toBe('complete')
    expect(created.body.coverageComplete).toBe(true)
    const expectedSessions = selectedCourses.reduce((count, course, index) => count
      + (index === 0 ? 2 : 1) * course.weeklySessions.length, 0)
    expect(created.body.assignments).toHaveLength(expectedSessions)
    expect(created.body.counts).toEqual({ sections: 3, requiredSessions: expectedSessions, scheduledSessions: expectedSessions })
    const id = created.body.proposalId
    created.body.coverageComplete = false
    const read = await supertest(app.getHttpServer()).get(`${proposalsPath}/${id}`).expect(200)
    expect(read.body.coverageComplete).toBe(true)
    expect(read.body.proposalId).toBe(id)
  })

  it('rejects malformed, extra and stale client input with the contracted statuses', async () => {
    await supertest(app.getHttpServer()).post(proposalsPath).send({ ...validRequest(), secret: 'x' }).expect(400)
    await supertest(app.getHttpServer()).post(proposalsPath).send({
      revision: 'PA-DEMO-1', demands: [...validRequest().demands, { courseId: 'UNKNOWN-COURSE', estimatedDemand: 1 }],
    }).expect(400)
    await supertest(app.getHttpServer()).post(proposalsPath).send({
      revision: 'PA-DEMO-1', demands: [{ courseId: selectedCourses[0].courseId, estimatedDemand: 0 }, { courseId: selectedCourses[0].courseId, estimatedDemand: 1 }],
    }).expect(400)
    const stale = await supertest(app.getHttpServer()).post(proposalsPath).send({ ...validRequest(), revision: 'OLD' }).expect(409)
    expect(stale.body.error.code).toBe('REVISION_MISMATCH')
    const bounded = await supertest(app.getHttpServer()).post(proposalsPath).send({
      revision: 'PA-DEMO-1', demands: [{ courseId: selectedCourses[0].courseId, estimatedDemand: 3850 }],
    }).expect(200)
    expect(bounded.body.status).toBe('invalid-input')
    expect(bounded.body.coverageComplete).toBe(false)
  })

  it('rejects read inputs, cross-site writes, expires entries, and caps retention', async () => {
    const readWithQuery = await supertest(app.getHttpServer()).get(`${catalogPath}?extra=1`).expect(400)
    expect(readWithQuery.body.error.code).toBe('UNEXPECTED_INPUT')
    await supertest(app.getHttpServer()).post(proposalsPath).set('Origin', 'https://outside.example').send(validRequest()).expect(403)
    await supertest(app.getHttpServer()).post(proposalsPath).set('Sec-Fetch-Site', 'cross-site').send(validRequest()).expect(403)

    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const created = await supertest(app.getHttpServer()).post(proposalsPath).send(validRequest()).expect(200)
    clock.mockReturnValue(now + 15 * 60 * 1000)
    await supertest(app.getHttpServer()).get(`${proposalsPath}/${created.body.proposalId}`).expect(404)

    clock.mockReturnValue(now + 20 * 60 * 1000)
    for (let index = 0; index < 20; index++) await supertest(app.getHttpServer()).post(proposalsPath).send(validRequest()).expect(200)
    const full = await supertest(app.getHttpServer()).post(proposalsPath).send(validRequest()).expect(429)
    expect(full.body.error.code).toBe('PROPOSAL_CAPACITY')
  })

  it('requires the explicit isolated local startup configuration', () => {
    expect(() => assertAcademicSchedulingStartup({})).toThrow('SUM_ACADEMIC_SCHEDULING=1')
    expect(() => assertAcademicSchedulingStartup({ SUM_ACADEMIC_SCHEDULING: '1', SIMULATOR_DEPLOYMENT: 'public' })).toThrow('no admite despliegue público')
    expect(() => assertAcademicSchedulingStartup({ SUM_ACADEMIC_SCHEDULING: '1', MATRICULA_SNAPSHOT_DIR: 'private-path' })).toThrow('no admite fuentes snapshot')
    expect(() => assertAcademicSchedulingStartup({ SUM_ACADEMIC_SCHEDULING: '1' })).not.toThrow()
  })

  it('does not accept client authority on creation or retrieval and retains older proposals', async () => {
    const repository = new MatriculaRegularRepository()
    const before = repository.readSnapshot()
    const original = await supertest(app.getHttpServer()).post(proposalsPath).send(validRequest()).expect(200)
    await supertest(app.getHttpServer()).post(proposalsPath).send({ ...validRequest(), requirements: [] }).expect(400)
    await supertest(app.getHttpServer()).post(`${proposalsPath}?input=replace`).send(validRequest()).expect(400)
    await supertest(app.getHttpServer()).get(`${proposalsPath}/${original.body.proposalId}`).send({ requirements: [] }).expect(400)
    await supertest(app.getHttpServer()).get(`${proposalsPath}/${original.body.proposalId}?requirements=[]`).expect(400)
    await supertest(app.getHttpServer()).post(proposalsPath).send({ revision: 'PA-DEMO-1', demands: validRequest().demands.map((demand) => ({ ...demand, estimatedDemand: 0 })) }).expect(200)
    expect((await supertest(app.getHttpServer()).get(`${proposalsPath}/${original.body.proposalId}`).expect(200)).body).toEqual(original.body)
    expect(repository.readSnapshot()).toEqual(before)
  })

  it('serializes zero demand, impossible and a deterministic cooperative search-limit', async () => {
    const zero = await supertest(app.getHttpServer()).post(proposalsPath).send({ revision: 'PA-DEMO-1', demands: validRequest().demands.map((demand) => ({ ...demand, estimatedDemand: 0 })) }).expect(200)
    expect(zero.body.status).toBe('complete')
    expect(zero.body.counts.requiredSessions).toBe(0)
    expect((await supertest(app.getHttpServer()).get(`${proposalsPath}/${zero.body.proposalId}`).expect(200)).body.coverageComplete).toBe(true)
    const impossible = await supertest(app.getHttpServer()).post(proposalsPath).send({ revision: 'PA-DEMO-1', demands: [
      { courseId: selectedCourses[0].courseId, estimatedDemand: 1000, targetCapacity: 1 },
    ] }).expect(200)
    expect(['impossible', 'invalid-input']).toContain(impossible.body.status)
    expect(impossible.body.coverageComplete).toBe(false)
    let tick = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => { tick += 3000; return tick })
    const limited = await supertest(app.getHttpServer()).post(proposalsPath).send(validRequest()).expect(200)
    clock.mockRestore()
    expect(limited.body.status).toBe('search-limit')
    expect(limited.body.stats.limitReason).toBe('time')
  })

  it('accepts a small selection, validates its pattern and honors a capacity override', async () => {
    const catalog = await supertest(app.getHttpServer()).get(catalogPath).expect(200)
    const course = catalog.body.courses.find((candidate: { planningPatterns: Array<{ id: string }> }) => candidate.planningPatterns.length > 1)
    expect(course).toBeDefined()
    const pattern = course.planningPatterns[1]
    const selected = await supertest(app.getHttpServer()).post(proposalsPath).send({ revision: 'PA-DEMO-1', demands: [
      { courseId: course.courseId, estimatedDemand: 31, targetCapacity: 40, patternId: pattern.id },
    ], resources: resourcesFor([course.courseId]) }).expect(200)
    expect(selected.body.sections).toHaveLength(1)
    expect(selected.body.sections[0].capacity).toBe(40)
    expect(selected.body.counts.requiredSessions).toBe(pattern.weeklySessions.length)
    expect(selected.body.coverageComplete).toBe(true)

    await supertest(app.getHttpServer()).post(proposalsPath).send({ revision: 'PA-DEMO-1', demands: [
      { courseId: course.courseId, estimatedDemand: 1, patternId: 'unknown-pattern' },
    ] }).expect(400)
    await supertest(app.getHttpServer()).post(proposalsPath).send({ revision: 'PA-DEMO-1', demands: [
      { courseId: 'unknown-course', estimatedDemand: 1 },
    ] }).expect(400)
    const empty = await supertest(app.getHttpServer()).post(proposalsPath).send({ revision: 'PA-DEMO-1', demands: [] }).expect(200)
    expect(empty.body.sections).toHaveLength(0)
    expect(empty.body.coverageComplete).toBe(true)
  })

  it('covers three selected courses within the expanded synthetic exploration budget', async () => {
    const third = createDemoCatalog().courses.find((course) => course.planningPatterns!.length > 1
      && !selectedCourses.some((selected) => selected.courseId === course.courseId))!
    const request = validRequest()
    request.demands.push({ courseId: third.courseId, estimatedDemand: 1 })
    const configuredRequest = { ...request, resources: resourcesFor(request.demands.map((demand) => demand.courseId)) }
    const response = await supertest(app.getHttpServer()).post(proposalsPath).send(configuredRequest).expect(200)
    expect(response.body.status).toBe('complete')
    expect(response.body.coverageComplete).toBe(true)
    expect(response.body.counts.sections).toBe(4)
    expect(response.body.counts.requiredSessions).toBe(8)
    expect(response.body.counts.scheduledSessions).toBe(8)
  })

  it('does not register the feature in the public AppModule even if its local flag is set', async () => {
    vi.stubEnv('SIMULATOR_DEPLOYMENT', 'public')
    vi.stubEnv('SUM_ACADEMIC_SCHEDULING', '1')
    vi.stubEnv('SIMULATOR_STORAGE', 'postgres')
    vi.stubEnv('DATABASE_URL', 'postgresql://synthetic.invalid/synthetic')
    vi.stubEnv('SIMULATOR_CAMPAIGN_ID', 'SYNTHETIC-TEST')
    vi.stubEnv('SIMULATOR_PUBLIC_ORIGIN', 'http://127.0.0.1')
    vi.stubEnv('SIMULATOR_METRICS_TOKEN', 'SYNTHETIC-TEST')
    const { AppModule } = await import('../src/app.module.js')
    const imports = Reflect.getMetadata('imports', AppModule) as Array<{ name: string }>
    expect(imports.map((module) => module.name)).toEqual(['PublicSimulatorPersistenceModule'])
    // Metadata only: no application, connection or PostgreSQL service is started.
  }, 15000)
})

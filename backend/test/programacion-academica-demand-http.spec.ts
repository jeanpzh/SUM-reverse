import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { AcademicSchedulingModule } from '../src/programacion-academica/demo-module.js'
import { ACADEMIC_API } from '../../shared/programacion-academica-api.mjs'

const demandPath = `${ACADEMIC_API.replace(/^\/api/, '')}/demanda/estimar`
const validRequest = () => ({ revision: 'PA-DEMO-1', sourceId: 'independent-120-v1', targetPeriod: '2027-I', courses: [{ courseId: '20118104', targetCapacity: 25 }] })

describe('PA-DEMO-1 synthetic academic demand HTTP API', () => {
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

  it('returns only aggregate estimates and declared source metadata', async () => {
    const response = await supertest(app.getHttpServer()).post(demandPath).send(validRequest()).expect(200)
    expect(response.body.revision).toBe('PA-DEMO-1')
    expect(response.body.source).toMatchObject({
      id: 'independent-120-v1', revision: 'DEMAND-SYN-1', kind: 'synthetic', targetPeriod: '2027-I', cutoffPeriod: '2026-1',
      schoolId: 'SISTEMAS', planId: 'SYN-SIS-PLAN', populationSize: 120, recordCount: 132, duplicateRecords: 12,
    })
    expect(response.body.rows[0]).toMatchObject({ eligible: 60, retakeEligible: 24, nonEligible: 36, insufficient: 24, baseDemand: 60, suggestedSections: 3 })
    expect(JSON.stringify(response.body)).not.toMatch(/SYN-DEMAND|actorId|studentName|attempts|students/i)
    const regular = await supertest(app.getHttpServer()).post(demandPath).send({ ...validRequest(), sourceId: 'existing-regular-v1' }).expect(200)
    expect(regular.body.source.populationSize).toBe(2)
    expect(JSON.stringify(regular.body)).not.toMatch(/SYN-SIS-[AB]|actorId|studentName|attempts|students/i)
  })

  it('rejects unknown courses and malformed requests, and reports stale revisions', async () => {
    await supertest(app.getHttpServer()).post(demandPath).send({ ...validRequest(), extra: 'client authority' }).expect(400)
    await supertest(app.getHttpServer()).post(demandPath).send({ ...validRequest(), courses: [{ courseId: 'UNKNOWN', targetCapacity: 2 }] }).expect(400)
    await supertest(app.getHttpServer()).post(demandPath).send({ ...validRequest(), courses: [{ courseId: '20118104', targetCapacity: 0 }] }).expect(400)
    const stale = await supertest(app.getHttpServer()).post(demandPath).send({ ...validRequest(), revision: 'OLD' }).expect(409)
    expect(stale.body.error.code).toBe('REVISION_MISMATCH')
    await supertest(app.getHttpServer()).post(demandPath).send({ ...validRequest(), revision: 'OLD', clientAuthority: true }).expect(400)
    await supertest(app.getHttpServer()).post(demandPath).send({ ...validRequest(), sourceId: 'unknown-source' }).expect(400)
  })

  it('applies the same query, JSON content, origin and fetch-site checks as proposal writes', async () => {
    await supertest(app.getHttpServer()).post(`${demandPath}?extra=1`).send(validRequest()).expect(400)
    await supertest(app.getHttpServer()).post(demandPath).set('Origin', 'https://outside.example').send(validRequest()).expect(403)
    await supertest(app.getHttpServer()).post(demandPath).set('Sec-Fetch-Site', 'cross-site').send(validRequest()).expect(403)
    vi.stubEnv('SIMULATOR_DEPLOYMENT', 'public')
    const publicDeployment = await supertest(app.getHttpServer()).post(demandPath).send(validRequest()).expect(403)
    expect(publicDeployment.body.error.code).toBe('LOOPBACK_ONLY')
  })

  it('does not accept client-supplied student authority or mutate the catalog', async () => {
    const catalogBefore = await supertest(app.getHttpServer()).get(`${ACADEMIC_API.replace(/^\/api/, '')}/catalogo`).expect(200)
    await supertest(app.getHttpServer()).post(demandPath).send({ ...validRequest(), students: [{ actorId: 'SYN-X', approved: true }] }).expect(400)
    const result = await supertest(app.getHttpServer()).post(demandPath).send({ ...validRequest(), courses: [] }).expect(200)
    expect(result.body.rows).toEqual([])
    const catalogAfter = await supertest(app.getHttpServer()).get(`${ACADEMIC_API.replace(/^\/api/, '')}/catalogo`).expect(200)
    expect(catalogAfter.body).toEqual(catalogBefore.body)
  })
})


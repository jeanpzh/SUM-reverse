import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import supertest from 'supertest'
import { ACADEMIC_API } from '../../shared/programacion-academica-api.mjs'
import type { AcademicRequest } from '../../shared/programacion-academica-api.mjs'
import { AcademicSchedulingModule } from '../src/programacion-academica/demo-module.js'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import type { INestApplication } from '@nestjs/common'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'

const catalog = createDemoCatalog()
const courses = catalog.courses.slice(0, 2)
const proposalsPath = `${ACADEMIC_API.replace(/^\/api/, '')}/propuestas`

const requestFor = (courseIds = [courses[0].courseId]): AcademicRequest => ({
  revision: catalog.revision,
  demands: courseIds.map((courseId) => ({ courseId, estimatedDemand: 1 })),
})

const configuredResources = (courseIds: string[], options?: { maxWeeklyMinutes?: number; availability?: typeof catalog.windows; capacity?: number }) => ({
  teachers: [{
    id: 'CUSTOM-TEACHER',
    name: 'Configured shared teacher',
    courseIds,
    maxWeeklyMinutes: options?.maxWeeklyMinutes ?? 10080,
    availability: options?.availability ?? catalog.windows,
  }],
  rooms: [{
    id: 'CUSTOM-ROOM',
    name: 'Configured room',
    capacity: options?.capacity ?? 40,
    availability: catalog.windows,
  }],
})

describe('academic planning resources API', () => {
  let app: INestApplication

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AcademicSchedulingModule] }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  it('shares a configured teacher across selected courses without scheduling overlapping sessions', async () => {
    const request = requestFor(courses.map((course) => course.courseId))
    request.resources = configuredResources(courses.map((course) => course.courseId))
    const response = await supertest(app.getHttpServer()).post(proposalsPath).send(request).expect(200)

    expect(response.body.coverageComplete).toBe(true)
    expect(response.body.assignments.every((assignment: { teacherId: string }) => assignment.teacherId === 'CUSTOM-TEACHER')).toBe(true)
    const assignments = response.body.assignments as Array<{ day: number; startMinute: number; endMinute: number }>
    for (let left = 0; left < assignments.length; left++) {
      for (let right = left + 1; right < assignments.length; right++) {
        if (assignments[left].day !== assignments[right].day) continue
        expect(assignments[left].endMinute <= assignments[right].startMinute
          || assignments[right].endMinute <= assignments[left].startMinute).toBe(true)
      }
    }
  })

  it('applies configured load, availability and room capacity limits', async () => {
    const courseId = courses[0].courseId
    for (const resources of [
      configuredResources([courseId], { maxWeeklyMinutes: 0 }),
      configuredResources([courseId], { availability: [] }),
      configuredResources([courseId], { capacity: 1 }),
    ]) {
      const response = await supertest(app.getHttpServer()).post(proposalsPath).send({
        revision: catalog.revision,
        demands: [{ courseId, estimatedDemand: 31, targetCapacity: 40 }],
        resources,
      }).expect(200)
      expect(response.body.coverageComplete).toBe(false)
    }
  })

  it('rejects unknown course qualifications and duplicate resource identifiers', async () => {
    const courseId = courses[0].courseId
    const unknown = configuredResources([courseId])
    unknown.teachers[0].courseIds.push('UNKNOWN-COURSE')
    await supertest(app.getHttpServer()).post(proposalsPath).send({ ...requestFor(), resources: unknown }).expect(400)

    const duplicateId = configuredResources([courseId])
    duplicateId.rooms.push({ ...duplicateId.rooms[0], name: 'Second room' })
    await supertest(app.getHttpServer()).post(proposalsPath).send({ ...requestFor(), resources: duplicateId }).expect(400)

    const repeatedName = configuredResources([courseId])
    repeatedName.rooms.push({ ...repeatedName.rooms[0], id: 'SECOND-ROOM' })
    repeatedName.teachers[0].availability.push({ ...repeatedName.teachers[0].availability[0] })
    await supertest(app.getHttpServer()).post(proposalsPath).send({ ...requestFor(), resources: repeatedName }).expect(200)
  })

  it('keeps explicitly empty resources empty and reports the unassigned requirement', async () => {
    const response = await supertest(app.getHttpServer()).post(proposalsPath).send({
      ...requestFor(),
      resources: { teachers: [], rooms: [] },
    }).expect(200)

    expect(response.body.assignments).toHaveLength(0)
    expect(response.body.pending.length).toBeGreaterThan(0)
    expect(response.body.diagnostics.length).toBeGreaterThan(0)
    expect(response.body.coverageComplete).toBe(false)
  })

  it('retains custom resource names in proposal reads without changing the enrollment offer', async () => {
    const repository = new MatriculaRegularRepository()
    const offerBefore = repository.readSnapshot()
    const request = requestFor()
    request.resources = configuredResources([courses[0].courseId])
    request.resources.teachers[0].name = 'Named custom instructor'
    request.resources.rooms[0].name = 'Named custom laboratory'

    const created = await supertest(app.getHttpServer()).post(proposalsPath).send(request).expect(200)
    expect(created.body.assignments[0].teacherName).toBe('Named custom instructor')
    expect(created.body.assignments[0].roomName).toBe('Named custom laboratory')
    const reread = await supertest(app.getHttpServer()).get(`${proposalsPath}/${created.body.proposalId}`).expect(200)
    expect(reread.body.assignments[0].teacherName).toBe('Named custom instructor')
    expect(reread.body.assignments[0].roomName).toBe('Named custom laboratory')
    expect(repository.readSnapshot()).toEqual(offerBefore)
  })
})

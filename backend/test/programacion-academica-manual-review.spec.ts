import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import supertest from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { ACADEMIC_API } from '../../shared/programacion-academica-api.mjs'
import { AcademicSchedulingModule } from '../src/programacion-academica/demo-module.js'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import type { AcademicRequest } from '../../shared/programacion-academica-api.mjs'

const catalog = createDemoCatalog()
const courseId = '20118104'
const course = catalog.courses.find((row) => row.courseId === courseId)!
const pattern = course.planningPatterns!.find((row) => row.weeklySessions.length === 2 && row.weeklySessions.every((session) => session.durationMinutes === 120))!
const api = ACADEMIC_API.replace(/^\/api/, '')
const proposalsPath = `${api}/propuestas`
const workWindows = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 }))

function firstBlock(assignments: Array<{ day: number; startMinute: number; endMinute: number; sessionId: string }>) {
  const ordered = [...assignments].sort((left, right) => left.day - right.day || left.startMinute - right.startMinute)
  const block = [ordered[0]!]
  while (block.at(-1)!.day === ordered[block.length]?.day && block.at(-1)!.endMinute === ordered[block.length]?.startMinute) {
    block.push(ordered[block.length]!)
  }
  return block
}

function erpRequest(deliveryMode: 'continuous' | 'split' = 'continuous'): AcademicRequest {
  return {
    revision: catalog.revision,
    demands: [{ courseId, estimatedDemand: 180, targetCapacity: 45, patternId: pattern.id, deliveryMode }],
    allocationPolicy: 'preferences',
    resources: {
      teachers: [1, 2].map((index) => ({ id: `ERP-T${index}`, name: `Synthetic teacher ${index}`, courseIds: [courseId],
        maxWeeklyMinutes: 1440, availability: structuredClone(workWindows), preferences: [{ day: 5, startMinute: 1080, endMinute: 1320 }],
        sectionLimits: [{ courseId, maxSections: 4 }] })),
      rooms: [{ id: 'ERP-ROOM', name: 'Synthetic classroom', kind: 'classroom', capacity: 45, availability: structuredClone(workWindows) }],
    },
  }
}

const errorCode = (response: { body: { error?: { code?: string } } }) => response.body.error?.code

describe('E1 manual proposal review', () => {
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

  it('atomically moves a complete continuous section and recalculates preference status without regenerating', async () => {
    const created = await supertest(app.getHttpServer()).post(proposalsPath).send(erpRequest()).expect(200)
    expect(created.body.counts).toEqual({ sections: 4, requiredSessions: 8, scheduledSessions: 8 })
    expect(created.body.editVersion).toBe(0)
    expect(created.body.manuallyAdjustedSectionIds).toEqual([])
    const preferredAssignment = created.body.assignments.find((item: { day: number; startMinute: number }) => item.day === 5 && item.startMinute === 1080)
    expect(preferredAssignment).toBeDefined()
    const section = created.body.sections.find((candidate: { sectionId: string }) => candidate.sectionId === preferredAssignment.sectionId)
    const block = created.body.assignments.filter((item: { sectionId: string }) => item.sectionId === section.sectionId)
      .sort((left: { startMinute: number }, right: { startMinute: number }) => left.startMinute - right.startMinute)
    const beforeOtherSections = created.body.assignments.filter((item: { sectionId: string }) => item.sectionId !== section.sectionId)
    const noOp = await supertest(app.getHttpServer()).post(`${proposalsPath}/${created.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: section.sectionId, sessionIds: block.map((item: { sessionId: string }) => item.sessionId),
      teacherId: block[0].teacherId, day: block[0].day, startMinute: block[0].startMinute,
      roomIds: block.map((item: { roomId: string }) => item.roomId),
    }).expect(200)
    expect(noOp.body.editVersion).toBe(0)
    expect(noOp.body.manuallyAdjustedSectionIds).toEqual([])
    const updated = await supertest(app.getHttpServer()).post(`${proposalsPath}/${created.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: section.sectionId, sessionIds: block.map((item: { sessionId: string }) => item.sessionId),
      teacherId: block[0].teacherId, day: 5, startMinute: 8 * 60, roomIds: block.map(() => 'ERP-ROOM'),
    }).expect(200)

    expect(updated.body.editVersion).toBe(1)
    expect(updated.body.manuallyAdjustedSectionIds).toEqual([section.sectionId])
    expect(updated.body.status).toBe(created.body.status)
    expect(updated.body.stats).toEqual(created.body.stats)
    expect(updated.body.assignments.filter((item: { sectionId: string }) => item.sectionId === section.sectionId).map((item: { day: number }) => item.day)).toEqual([5, 5])
    expect(updated.body.assignments.filter((item: { sectionId: string }) => item.sectionId !== section.sectionId)).toEqual(beforeOtherSections)
    expect(updated.body.preferenceReport.outsidePreferenceSections).toBe(created.body.preferenceReport.outsidePreferenceSections + 1)
    expect(updated.body.diagnostics.some((item: { code: string }) => item.code === 'PREFERENCES_NOT_MET')).toBe(true)
    expect((await supertest(app.getHttpServer()).get(`${proposalsPath}/${created.body.proposalId}`).expect(200)).body).toEqual(updated.body)

    const stale = await supertest(app.getHttpServer()).post(`${proposalsPath}/${created.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: section.sectionId, sessionIds: block.map((item: { sessionId: string }) => item.sessionId),
      teacherId: block[0].teacherId, day: 5, startMinute: 18 * 60, roomIds: block.map(() => 'ERP-ROOM'),
    }).expect(409)
    expect(errorCode(stale)).toBe('VERSION_MISMATCH')
  })

  it('applies a split-section teacher change to every component while moving only the selected block', async () => {
    const created = await supertest(app.getHttpServer()).post(proposalsPath).send(erpRequest('split')).expect(200)
    const section = created.body.sections[0]
    const sectionAssignments = created.body.assignments.filter((item: { sectionId: string }) => item.sectionId === section.sectionId)
    const selectedBlock = firstBlock(sectionAssignments)
    if (selectedBlock.length > 1) {
      await supertest(app.getHttpServer()).post(`${proposalsPath}/${created.body.proposalId}/ajustes`).send({
        expectedVersion: 0, sectionId: section.sectionId, sessionIds: [selectedBlock[0]!.sessionId], teacherId: 'ERP-T2', day: 5,
        startMinute: 18 * 60, roomIds: ['ERP-ROOM'],
      }).expect(422)
    }
    const otherSectionAssignments = created.body.assignments.filter((item: { sectionId: string }) => item.sectionId !== section.sectionId)
    const updated = await supertest(app.getHttpServer()).post(`${proposalsPath}/${created.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: section.sectionId, sessionIds: selectedBlock.map((item) => item.sessionId), teacherId: 'ERP-T2', day: 5,
      startMinute: 18 * 60, roomIds: selectedBlock.map(() => 'ERP-ROOM'),
    }).expect(200)
    const changed = updated.body.assignments.filter((item: { sectionId: string }) => item.sectionId === section.sectionId)
    expect(new Set(changed.map((item: { teacherId: string }) => item.teacherId))).toEqual(new Set(['ERP-T2']))
    expect(changed.filter((item: { sessionId: string }) => selectedBlock.some((selected) => selected.sessionId === item.sessionId)).every((item: { day: number }) => item.day === 5)).toBe(true)
    expect(changed.filter((item: { sessionId: string }) => !selectedBlock.some((selected) => selected.sessionId === item.sessionId)).map((item: { day: number }) => item.day))
      .toEqual(sectionAssignments.filter((item: { sessionId: string }) => !selectedBlock.some((selected) => selected.sessionId === item.sessionId)).map((item: { day: number }) => item.day))
    expect(updated.body.assignments.filter((item: { sectionId: string }) => item.sectionId !== section.sectionId)).toEqual(otherSectionAssignments)
  })

  it('preserves six-hour continuous component order and the original termination status', async () => {
    const sixHourCourse = catalog.courses.find((candidate) => candidate.weeklySessions.reduce((sum, session) => sum + session.durationMinutes, 0) === 360)!
    const result = await supertest(app.getHttpServer()).post(proposalsPath).send({
      revision: catalog.revision, demands: [{ courseId: sixHourCourse.courseId, estimatedDemand: 1, targetCapacity: 45 }],
      resources: {
        teachers: [{ id: 'SIX-HOUR', name: 'Synthetic six-hour teacher', courseIds: [sixHourCourse.courseId], maxWeeklyMinutes: 360,
          availability: structuredClone(workWindows) }],
        rooms: [{ id: 'SIX-HOUR-ROOM', name: 'Synthetic six-hour room', kind: 'classroom', capacity: 45, availability: structuredClone(workWindows) }],
      },
    }).expect(200)
    expect(result.body.status).toBe('complete')
    const section = result.body.sections[0]
    const block = result.body.assignments.filter((item: { sectionId: string }) => item.sectionId === section.sectionId)
      .sort((left: { startMinute: number }, right: { startMinute: number }) => left.startMinute - right.startMinute)
    const updated = await supertest(app.getHttpServer()).post(`${proposalsPath}/${result.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: section.sectionId, sessionIds: block.map((item: { sessionId: string }) => item.sessionId),
      teacherId: block[0].teacherId, day: 5, startMinute: 16 * 60, roomIds: block.map(() => 'SIX-HOUR-ROOM'),
    }).expect(200)
    const moved = updated.body.assignments.filter((item: { sectionId: string }) => item.sectionId === section.sectionId)
      .sort((left: { startMinute: number }, right: { startMinute: number }) => left.startMinute - right.startMinute)
    expect(updated.body.status).toBe(result.body.status)
    expect(updated.body.stats).toEqual(result.body.stats)
    expect(moved[0].startMinute).toBe(16 * 60)
    expect(moved.at(-1).endMinute).toBe(22 * 60)
    expect(moved.slice(1).every((item: { day: number }, index: number) => item.day === 5
      && item.startMinute === moved[index].endMinute)).toBe(true)
  })

  it('rejects malformed input, unknown IDs, disallowed origins, room-kind changes and conflicts without mutation', async () => {
    const created = await supertest(app.getHttpServer()).post(proposalsPath).send(erpRequest()).expect(200)
    const section = created.body.sections[0]
    const block = created.body.assignments.filter((item: { sectionId: string }) => item.sectionId === section.sectionId)
      .sort((left: { startMinute: number }, right: { startMinute: number }) => left.startMinute - right.startMinute)
    const path = `${proposalsPath}/${created.body.proposalId}/ajustes`
    const valid = { expectedVersion: 0, sectionId: section.sectionId, sessionIds: block.map((item: { sessionId: string }) => item.sessionId),
      teacherId: block[0].teacherId, day: 5, startMinute: 18 * 60, roomIds: block.map(() => 'ERP-ROOM') }
    const malformed = await supertest(app.getHttpServer()).post(path).send({ ...valid, extra: true }).expect(400)
    expect(errorCode(malformed)).toBe('INVALID_ADJUSTMENT')
    await supertest(app.getHttpServer()).post(path).send({ ...valid, requirements: [] }).expect(400)
    const crossSite = await supertest(app.getHttpServer()).post(path).set('Origin', 'https://outside.example').send(valid).expect(403)
    expect(errorCode(crossSite)).toBe('CROSS_SITE')
    const unknown = await supertest(app.getHttpServer()).post(path).send({ ...valid, sectionId: 'UNKNOWN' }).expect(422)
    expect(errorCode(unknown)).toBe('ADJUSTMENT_REJECTED')
    const unknownRoom = await supertest(app.getHttpServer()).post(path).send({ ...valid, roomIds: block.map(() => 'UNKNOWN-ROOM') }).expect(422)
    expect(errorCode(unknownRoom)).toBe('ADJUSTMENT_REJECTED')

    const collidingBlock = created.body.assignments.find((item: { sectionId: string }) => item.sectionId !== section.sectionId)
    const conflict = await supertest(app.getHttpServer()).post(path).send({ ...valid, day: collidingBlock.day, startMinute: collidingBlock.startMinute }).expect(422)
    expect(errorCode(conflict)).toBe('ADJUSTMENT_REJECTED')
    const afterConflict = await supertest(app.getHttpServer()).get(`${proposalsPath}/${created.body.proposalId}`).expect(200)
    expect(afterConflict.body).toEqual(created.body)

    const kindRequest = erpRequest()
    kindRequest.resources!.rooms.push({ id: 'ERP-LAB', name: 'Synthetic laboratory', kind: 'laboratory', capacity: 45, availability: structuredClone(workWindows) })
    const kindProposal = await supertest(app.getHttpServer()).post(proposalsPath).send(kindRequest).expect(200)
    const kindSection = kindProposal.body.sections[0]
    const kindBlock = kindProposal.body.assignments.filter((item: { sectionId: string }) => item.sectionId === kindSection.sectionId)
    const incompatibleRoom = kindBlock[0].roomId === 'ERP-LAB' ? 'ERP-ROOM' : 'ERP-LAB'
    const wrongKind = await supertest(app.getHttpServer()).post(`${proposalsPath}/${kindProposal.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: kindSection.sectionId, sessionIds: kindBlock.map((item: { sessionId: string }) => item.sessionId),
      teacherId: kindBlock[0].teacherId, day: 5, startMinute: 18 * 60, roomIds: kindBlock.map(() => incompatibleRoom),
    }).expect(422)
    expect(errorCode(wrongKind)).toBe('ADJUSTMENT_REJECTED')
  })

  it('rejects qualification, weekly load, section caps, resource availability, global windows and capacity', async () => {
    // HTTP cases below use a valid retained proposal so every rejection exercises the real service boundary.
    const request = erpRequest()
    const created = await supertest(app.getHttpServer()).post(proposalsPath).send(request).expect(200)
    const section = created.body.sections[0]
    const block = created.body.assignments.filter((item: { sectionId: string }) => item.sectionId === section.sectionId)
    const adjustment = { expectedVersion: 0, sectionId: section.sectionId, sessionIds: block.map((item: { sessionId: string }) => item.sessionId),
      teacherId: 'UNQUALIFIED', day: 5, startMinute: 18 * 60, roomIds: block.map(() => 'ERP-ROOM') }
    const unqualified = erpRequest()
    unqualified.resources!.teachers.push({ id: 'UNQUALIFIED', name: 'Unqualified synthetic teacher', courseIds: [], maxWeeklyMinutes: 1440,
      availability: structuredClone(workWindows) })
    const unqualifiedProposal = await supertest(app.getHttpServer()).post(proposalsPath).send(unqualified).expect(200)
    const unqualifiedSection = unqualifiedProposal.body.sections[0]
    const unqualifiedBlock = unqualifiedProposal.body.assignments.filter((item: { sectionId: string }) => item.sectionId === unqualifiedSection.sectionId)
    const unqualifiedResponse = await supertest(app.getHttpServer()).post(`${proposalsPath}/${unqualifiedProposal.body.proposalId}/ajustes`).send({
      ...adjustment, sectionId: unqualifiedSection.sectionId, sessionIds: unqualifiedBlock.map((item: { sessionId: string }) => item.sessionId),
    }).expect(422)
    expect(unqualifiedResponse.body.error.message).toContain('TEACHER_NOT_QUALIFIED')

    const capped = erpRequest()
    capped.resources!.teachers.find((teacher) => teacher.id === 'ERP-T2')!.sectionLimits = [{ courseId, maxSections: 0 }]
    const cappedProposal = await supertest(app.getHttpServer()).post(proposalsPath).send(capped).expect(200)
    const cappedSection = cappedProposal.body.sections[0]
    const cappedBlock = cappedProposal.body.assignments.filter((item: { sectionId: string }) => item.sectionId === cappedSection.sectionId)
    const cappedResponse = await supertest(app.getHttpServer()).post(`${proposalsPath}/${cappedProposal.body.proposalId}/ajustes`).send({
      ...adjustment, sectionId: cappedSection.sectionId, sessionIds: cappedBlock.map((item: { sessionId: string }) => item.sessionId), teacherId: 'ERP-T2',
    }).expect(422)
    expect(cappedResponse.body.error.message).toContain('TEACHER_SECTION_LIMIT')

    const overloaded = erpRequest()
    overloaded.resources!.teachers.find((teacher) => teacher.id === 'ERP-T2')!.maxWeeklyMinutes = 0
    const overloadedProposal = await supertest(app.getHttpServer()).post(proposalsPath).send(overloaded).expect(200)
    const overloadedSection = overloadedProposal.body.sections[0]
    const overloadedBlock = overloadedProposal.body.assignments.filter((item: { sectionId: string }) => item.sectionId === overloadedSection.sectionId)
    const overloadedResponse = await supertest(app.getHttpServer()).post(`${proposalsPath}/${overloadedProposal.body.proposalId}/ajustes`).send({
      ...adjustment, sectionId: overloadedSection.sectionId, sessionIds: overloadedBlock.map((item: { sessionId: string }) => item.sessionId), teacherId: 'ERP-T2',
    }).expect(422)
    expect(overloadedResponse.body.error.message).toContain('TEACHER_LOAD_EXCEEDED')

    const unavailable = erpRequest()
    unavailable.resources!.teachers.forEach((teacher) => { teacher.availability = workWindows.slice(0, 4) })
    unavailable.resources!.rooms[0].availability = structuredClone(workWindows)
    const unavailableProposal = await supertest(app.getHttpServer()).post(proposalsPath).send(unavailable).expect(200)
    const unavailableSection = unavailableProposal.body.sections[0]
    const unavailableBlock = unavailableProposal.body.assignments.filter((item: { sectionId: string }) => item.sectionId === unavailableSection.sectionId)
    const unavailableResponse = await supertest(app.getHttpServer()).post(`${proposalsPath}/${unavailableProposal.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: unavailableSection.sectionId, sessionIds: unavailableBlock.map((item: { sessionId: string }) => item.sessionId),
      teacherId: unavailableBlock[0].teacherId, day: 5, startMinute: 18 * 60, roomIds: unavailableBlock.map(() => 'ERP-ROOM'),
    }).expect(422)
    expect(unavailableResponse.body.error.message).toContain('TEACHER_UNAVAILABLE')

    const roomUnavailable = erpRequest()
    roomUnavailable.resources!.rooms[0].availability = workWindows.slice(0, 4)
    const roomUnavailableProposal = await supertest(app.getHttpServer()).post(proposalsPath).send(roomUnavailable).expect(200)
    const roomUnavailableSection = roomUnavailableProposal.body.sections[0]
    const roomUnavailableBlock = roomUnavailableProposal.body.assignments.filter((item: { sectionId: string }) => item.sectionId === roomUnavailableSection.sectionId)
    const roomUnavailableResponse = await supertest(app.getHttpServer()).post(`${proposalsPath}/${roomUnavailableProposal.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: roomUnavailableSection.sectionId, sessionIds: roomUnavailableBlock.map((item: { sessionId: string }) => item.sessionId),
      teacherId: roomUnavailableBlock[0].teacherId, day: 5, startMinute: 18 * 60, roomIds: roomUnavailableBlock.map(() => 'ERP-ROOM'),
    }).expect(422)
    expect(roomUnavailableResponse.body.error.message).toContain('ROOM_UNAVAILABLE')

    const outsideWindow = erpRequest()
    outsideWindow.resources!.teachers.forEach((teacher) => { teacher.availability = [1, 2, 3, 4, 5, 6].map((day) => ({ day, startMinute: 480, endMinute: 1320 })) })
    outsideWindow.resources!.rooms[0].availability = structuredClone(outsideWindow.resources!.teachers[0]!.availability)
    const outsideProposal = await supertest(app.getHttpServer()).post(proposalsPath).send(outsideWindow).expect(200)
    const outsideSection = outsideProposal.body.sections[0]
    const outsideBlock = outsideProposal.body.assignments.filter((item: { sectionId: string }) => item.sectionId === outsideSection.sectionId)
    const outsideResponse = await supertest(app.getHttpServer()).post(`${proposalsPath}/${outsideProposal.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: outsideSection.sectionId, sessionIds: outsideBlock.map((item: { sessionId: string }) => item.sessionId),
      teacherId: outsideBlock[0].teacherId, day: 6, startMinute: 18 * 60, roomIds: outsideBlock.map(() => 'ERP-ROOM'),
    }).expect(422)
    expect(outsideResponse.body.error.message).toContain('WINDOW_UNAVAILABLE')

    const capacity = erpRequest()
    capacity.resources!.rooms.push({ id: 'SMALL-ROOM', name: 'Small synthetic room', kind: 'classroom', capacity: 44, availability: structuredClone(workWindows) })
    const capacityProposal = await supertest(app.getHttpServer()).post(proposalsPath).send(capacity).expect(200)
    const capacitySection = capacityProposal.body.sections[0]
    const capacityBlock = capacityProposal.body.assignments.filter((item: { sectionId: string }) => item.sectionId === capacitySection.sectionId)
    const capacityResponse = await supertest(app.getHttpServer()).post(`${proposalsPath}/${capacityProposal.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: capacitySection.sectionId, sessionIds: capacityBlock.map((item: { sessionId: string }) => item.sessionId),
      teacherId: capacityBlock[0].teacherId, day: 5, startMinute: 18 * 60, roomIds: capacityBlock.map(() => 'SMALL-ROOM'),
    }).expect(422)
    expect(capacityResponse.body.error.message).toContain('ROOM_CAPACITY')
  })

  it('reports teacher and room overlaps independently', async () => {
    const teacherConflictRequest = erpRequest()
    teacherConflictRequest.resources!.rooms.push({ id: 'ERP-ROOM-2', name: 'Second synthetic classroom', kind: 'classroom', capacity: 45,
      availability: structuredClone(workWindows) })
    const teacherProposal = await supertest(app.getHttpServer()).post(proposalsPath).send(teacherConflictRequest).expect(200)
    const teacherSection = teacherProposal.body.sections[0]
    const teacherBlock = teacherProposal.body.assignments.filter((item: { sectionId: string }) => item.sectionId === teacherSection.sectionId)
    const teacherCollision = teacherProposal.body.assignments.find((item: { sectionId: string }) => item.sectionId !== teacherSection.sectionId)
    const teacherConflict = await supertest(app.getHttpServer()).post(`${proposalsPath}/${teacherProposal.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: teacherSection.sectionId, sessionIds: teacherBlock.map((item: { sessionId: string }) => item.sessionId),
      teacherId: teacherCollision.teacherId, day: teacherCollision.day, startMinute: teacherCollision.startMinute,
      roomIds: teacherBlock.map(() => 'ERP-ROOM-2'),
    }).expect(422)
    expect(teacherConflict.body.error.message).toContain('TEACHER_CONFLICT')

    const roomConflictRequest = erpRequest()
    for (let index = 1; index <= 3; index++) roomConflictRequest.resources!.teachers.push({ id: `ZZ-FREE-${index}`, name: `Synthetic free teacher ${index}`,
      courseIds: [courseId], maxWeeklyMinutes: 1440, availability: structuredClone(workWindows) })
    const roomProposal = await supertest(app.getHttpServer()).post(proposalsPath).send(roomConflictRequest).expect(200)
    const roomSection = roomProposal.body.sections[0]
    const roomBlock = roomProposal.body.assignments.filter((item: { sectionId: string }) => item.sectionId === roomSection.sectionId)
    const roomCollision = roomProposal.body.assignments.find((item: { sectionId: string }) => item.sectionId !== roomSection.sectionId)
    const occupiedTeachers = new Set(roomProposal.body.assignments.filter((item: { day: number; startMinute: number; endMinute: number }) =>
      item.day === roomCollision.day && item.startMinute < roomCollision.endMinute && roomCollision.startMinute < item.endMinute)
      .map((item: { teacherId: string }) => item.teacherId))
    const idleTeacher = ['ZZ-FREE-1', 'ZZ-FREE-2', 'ZZ-FREE-3'].find((id) => !occupiedTeachers.has(id))!
    const roomConflict = await supertest(app.getHttpServer()).post(`${proposalsPath}/${roomProposal.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: roomSection.sectionId, sessionIds: roomBlock.map((item: { sessionId: string }) => item.sessionId),
      teacherId: idleTeacher, day: roomCollision.day, startMinute: roomCollision.startMinute, roomIds: roomBlock.map(() => 'ERP-ROOM'),
    }).expect(422)
    expect(roomConflict.body.error.message).toContain('ROOM_CONFLICT')
  })

  it('edits assigned components on an incomplete proposal and keeps pending sessions and status', async () => {
    const partialRequest = erpRequest('split')
    partialRequest.demands[0]!.estimatedDemand = 90
    partialRequest.resources!.teachers = [{ ...partialRequest.resources!.teachers[0]!, sectionLimits: [{ courseId, maxSections: 1 }] }]
    const partial = await supertest(app.getHttpServer()).post(proposalsPath).send(partialRequest).expect(200)
    expect(partial.body.status).toBe('impossible')
    expect(partial.body.pending).toHaveLength(2)
    const section = partial.body.sections.find((candidate: { sectionId: string }) => partial.body.assignments.some((item: { sectionId: string }) => item.sectionId === candidate.sectionId))
    const assignments = partial.body.assignments.filter((item: { sectionId: string }) => item.sectionId === section.sectionId)
    const block = firstBlock(assignments)
    const updated = await supertest(app.getHttpServer()).post(`${proposalsPath}/${partial.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: section.sectionId, sessionIds: block.map((item) => item.sessionId), teacherId: assignments[0].teacherId,
      day: 5, startMinute: 8 * 60, roomIds: block.map(() => 'ERP-ROOM'),
    }).expect(200)
    expect(updated.body.status).toBe(partial.body.status)
    expect(updated.body.pending).toEqual(partial.body.pending)
    expect(updated.body.coverageComplete).toBe(false)
    expect(updated.body.counts).toEqual(partial.body.counts)
  })

  it('prioritizes preferred windows even when a feasible nonpreferred window occurs earlier', async () => {
    const preferredCourse = catalog.courses.find((candidate) => candidate.weeklySessions.reduce((sum, session) => sum + session.durationMinutes, 0) === 240)!
    const service = new DemoProposalService()
    const input: AcademicRequest = { revision: catalog.revision, demands: [{ courseId: preferredCourse.courseId, estimatedDemand: 1, targetCapacity: 45 }], resources: {
      teachers: [{ id: 'PREFERRED', name: 'Synthetic preferred teacher', courseIds: [preferredCourse.courseId], maxWeeklyMinutes: 240,
        availability: [{ day: 1, startMinute: 480, endMinute: 720 }, { day: 3, startMinute: 1080, endMinute: 1320 }],
        preferences: [{ day: 3, startMinute: 1080, endMinute: 1320 }] }],
      rooms: [{ id: 'PREFERRED-ROOM', name: 'Synthetic preferred room', kind: 'classroom', capacity: 45,
        availability: [{ day: 1, startMinute: 480, endMinute: 720 }, { day: 3, startMinute: 1080, endMinute: 1320 }] }],
    } }
    const result = service.createProposal(input)
    expect(result.assignments[0]).toMatchObject({ day: 3, startMinute: 1080 })
  })

  it('expires manual review with the retained proposal', async () => {
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const created = await supertest(app.getHttpServer()).post(proposalsPath).send(erpRequest()).expect(200)
    clock.mockReturnValue(now + 15 * 60 * 1000)
    const expired = await supertest(app.getHttpServer()).post(`${proposalsPath}/${created.body.proposalId}/ajustes`).send({
      expectedVersion: 0, sectionId: 'UNKNOWN', sessionIds: ['UNKNOWN'], teacherId: 'UNKNOWN', day: 1, startMinute: 480, roomIds: ['UNKNOWN'],
    }).expect(404)
    expect(errorCode(expired)).toBe('PROPOSAL_NOT_FOUND')
  })
})

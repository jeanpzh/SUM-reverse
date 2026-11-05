import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lstatSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { ACADEMIC_API } from '../../shared/programacion-academica-api.mjs'
import type { AcademicWorkspace } from '../../shared/programacion-academica-api.mjs'
import { AcademicSchedulingModule } from '../src/programacion-academica/demo-module.js'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { SavedDraftStore } from '../src/programacion-academica/saved-draft-store.js'
import { SavedDraftService } from '../src/programacion-academica/saved-draft.service.js'
import { DemoProposalService as FreshProposalService } from '../src/programacion-academica/demo-proposal.service.js'

const api = ACADEMIC_API.replace(/^\/api/, '')
const workWindows = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 }))

describe('E1 teacher review persistence', () => {
  let app: INestApplication
  let directory: string
  let proposalService: DemoProposalService

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'sum-academic-review-'))
    vi.stubEnv('SUM_ACADEMIC_DRAFT_DIR', directory)
    const module = await Test.createTestingModule({ imports: [AcademicSchedulingModule] }).compile()
    app = module.createNestApplication()
    await app.init()
    proposalService = app.get(DemoProposalService)
  })

  afterEach(async () => {
    await app.close()
    vi.unstubAllEnvs()
    const absolute = resolve(directory)
    const tempRoot = resolve(tmpdir()) + sep
    if (!absolute.toLowerCase().startsWith(tempRoot.toLowerCase()) || !basename(absolute).startsWith('sum-academic-review-') || lstatSync(absolute).isSymbolicLink()) throw new Error('Unsafe test cleanup target')
    rmSync(absolute, { recursive: true, force: true })
  })

  function configuration(): AcademicWorkspace {
    const catalog = proposalService.getCatalog()
    const course = catalog.courses.find((item) => item.weeklySessions.length > 0 && catalog.teachers.some((teacher) => teacher.courseIds.includes(item.courseId)))!
    const teacher = catalog.teachers.find((item) => item.courseIds.includes(course.courseId))!
    const room = catalog.rooms.find((item) => item.capacity >= 30)!
    return {
      schoolId: 'SISTEMAS', academicPeriod: '2027-I', demandSourceId: 'independent-120-v1', demandBaseRequest: null,
      request: { revision: catalog.revision, demands: [{ courseId: course.courseId, estimatedDemand: 1, targetCapacity: Math.max(1, Math.min(30, room.capacity)) }],
        resources: { teachers: [{ ...structuredClone(teacher), maxWeeklyMinutes: 10080, availability: structuredClone(workWindows) }],
          rooms: [{ ...structuredClone(room), availability: structuredClone(workWindows) }] } },
    }
  }

  async function createSavedDraft(config = configuration()) {
    const generated = proposalService.createProposal(config.request)
    expect(generated.status).toBe('complete')
    const response = await supertest(app.getHttpServer()).post(`${api}/borradores/guardar`).send({
      id: null, expectedVersion: null, title: 'Synthetic teacher review', state: 'draft', configuration: config,
      proposalId: generated.proposalId, proposalEditVersion: generated.editVersion ?? 0,
    }).expect(200)
    return response.body as { id: string; version: number; state: string; proposal: { proposalId: string; editVersion?: number; assignments: Array<{ teacherId: string }> } }
  }

  it('submits, records a teacher decision, and derives ready-for-approval from current conformities', async () => {
    const saved = await createSavedDraft()
    const submitted = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/enviar`).send({ expectedVersion: saved.version }).expect(200)
    expect(submitted.body.draft.state).toBe('in-review')
    const teacherIds = [...new Set(submitted.body.draft.review.teachers.map((teacher: { teacherId: string }) => teacher.teacherId))]
    for (const teacherId of teacherIds) {
      const decision = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/responder`).send({
        expectedVersion: submitted.body.draft.version, round: submitted.body.draft.review.round, teacherId, decision: 'conformity', observation: '',
      }).expect(200)
      submitted.body.draft.version = decision.body.draft.version
      submitted.body.draft.review = decision.body.draft.review
      expect(decision.body.draft.state).toBe('ready-for-approval')
    }
    const resumed = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/continuar`).send({ expectedVersion: submitted.body.draft.version }).expect(200)
    expect(resumed.body.draft.state).toBe('ready-for-approval')
    expect(resumed.body.draft.review.history.map((event: { type: string }) => event.type)).toEqual(['submitted', ...teacherIds.map(() => 'decision')])
  })

  it('requires an observation for changes, rejects stale version and round, and creates a new review round on resubmission', async () => {
    const saved = await createSavedDraft()
    const submitted = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/enviar`).send({ expectedVersion: saved.version }).expect(200)
    const teacherId = submitted.body.draft.review.teachers[0].teacherId
    await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/responder`).send({ expectedVersion: submitted.body.draft.version,
      round: submitted.body.draft.review.round, teacherId, decision: 'changes-requested', observation: '' }).expect(400)
    const decision = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/responder`).send({ expectedVersion: submitted.body.draft.version,
      round: submitted.body.draft.review.round, teacherId, decision: 'changes-requested', observation: 'Synthetic schedule conflict' }).expect(200)
    await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/responder`).send({ expectedVersion: submitted.body.draft.version,
      round: decision.body.draft.review.round, teacherId, decision: 'conformity', observation: '' }).expect(409)
    await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/enviar`).send({ expectedVersion: decision.body.draft.version + 1 }).expect(409)
    const next = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/enviar`).send({ expectedVersion: decision.body.draft.version }).expect(200)
    expect(next.body.draft.review.round).toBe(2)
    expect(next.body.draft.review.history.filter((event: { type: string }) => event.type === 'submitted')).toHaveLength(2)
    expect(next.body.draft.review.teachers[0].status).toBe('pending')
  })

  it('invalidates only a changed teacher fingerprint and retains legacy drafts without review', async () => {
    const original = configuration()
    const courseId = original.request.demands[0]!.courseId
    const firstTeacher = original.request.resources.teachers[0]!
    const secondTeacher = { ...structuredClone(firstTeacher), id: 'SYNTHETIC-REVIEW-TEACHER-B', name: 'Synthetic review teacher B', sectionLimits: [{ courseId, maxSections: 1 }] }
    firstTeacher.sectionLimits = [{ courseId, maxSections: 1 }]
    original.request.demands[0]!.estimatedDemand = 60
    original.request.demands[0]!.targetCapacity = 30
    original.request.resources.teachers.push(secondTeacher)
    const secondRoom = { ...structuredClone(original.request.resources.rooms[0]!), id: 'SYNTHETIC-REVIEW-ROOM-B', name: 'Synthetic review room B' }
    const manualRoom = { ...structuredClone(secondRoom), id: 'SYNTHETIC-REVIEW-ROOM-C', name: 'Synthetic review room C' }
    original.request.resources.rooms.push(secondRoom, manualRoom)
    original.request.allocationPolicy = 'balanced'
    const saved = await createSavedDraft(original)
    const submitted = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/enviar`).send({ expectedVersion: saved.version }).expect(200)
    expect(submitted.body.draft.review.teachers).toHaveLength(2)
    let version = submitted.body.draft.version
    for (const teacher of submitted.body.draft.review.teachers as Array<{ teacherId: string }>) {
      const conformed = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/responder`).send({
        expectedVersion: version, round: submitted.body.draft.review.round, teacherId: teacher.teacherId, decision: 'conformity', observation: '',
      }).expect(200)
      version = conformed.body.draft.version
    }
    const selected = saved.proposal.assignments[0]!.teacherId
    const savedProposal = proposalService.getProposal(saved.proposal.proposalId)
    const targetAssignment = savedProposal.assignments.find((item) => item.teacherId === selected)!
    const section = savedProposal.sections.find((item) => item.sectionId === targetAssignment.sectionId)!
    const sectionAssignments = savedProposal.assignments.filter((item) => item.sectionId === section.sectionId)
    const adjusted = proposalService.adjustProposal(saved.proposal.proposalId, { expectedVersion: saved.proposal.editVersion ?? 0, sectionId: section.sectionId,
      sessionIds: sectionAssignments.map((item) => item.sessionId), teacherId: sectionAssignments[0]!.teacherId, day: 5, startMinute: 480,
      roomIds: sectionAssignments.map(() => manualRoom.id) })
    expect(sectionAssignments.some((item) => item.teacherId === selected)).toBe(true)
    const updated = await supertest(app.getHttpServer()).post(`${api}/borradores/guardar`).send({
      id: saved.id, expectedVersion: version, title: 'Synthetic teacher review', state: 'draft', configuration: original,
      proposalId: adjusted.proposalId, proposalEditVersion: adjusted.editVersion ?? 0,
    }).expect(200)
    expect(updated.body.review.teachers).toHaveLength(2)
    const statuses = Object.fromEntries(updated.body.review.teachers.map((teacher: { teacherId: string; status: string }) => [teacher.teacherId, teacher.status]))
    const unchangedTeacherId = submitted.body.draft.review.teachers.find((teacher: { teacherId: string }) => teacher.teacherId !== selected).teacherId
    expect(statuses[selected]).toBe('outdated')
    expect(statuses[unchangedTeacherId]).toBe('conformity')
    expect(updated.body.state).toBe('in-review')

    const resent = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/enviar`).send({ expectedVersion: updated.body.version }).expect(200)
    expect(resent.body.draft.review.teachers.find((teacher: { teacherId: string }) => teacher.teacherId === unchangedTeacherId).status).toBe('conformity')
    expect(resent.body.draft.review.teachers.find((teacher: { teacherId: string }) => teacher.teacherId === selected).status).toBe('pending')
    const completed = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/responder`).send({
      expectedVersion: resent.body.draft.version, round: resent.body.draft.review.round, teacherId: selected, decision: 'conformity', observation: '',
    }).expect(200)
    expect(completed.body.draft.state).toBe('ready-for-approval')

    const restarted = await new SavedDraftService(new FreshProposalService()).resume(saved.id, { expectedVersion: completed.body.draft.version })
    expect(restarted.draft.review.history).toEqual(completed.body.draft.review.history)
    expect(restarted.draft.state).toBe('ready-for-approval')

    const legacy = await createSavedDraft()
    expect(legacy).not.toHaveProperty('review')
    const resumed = await supertest(app.getHttpServer()).post(`${api}/borradores/${legacy.id}/continuar`).send({ expectedVersion: legacy.version }).expect(200)
    expect(resumed.body.draft).not.toHaveProperty('review')
  })

  it('rejects a resealed review whose fingerprint no longer matches the retained schedule', async () => {
    const saved = await createSavedDraft()
    const submitted = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/enviar`).send({ expectedVersion: saved.version }).expect(200)
    const store = new SavedDraftStore(directory)
    const payload = store.read(saved.id)!
    const document = structuredClone(payload.document) as typeof submitted.body.draft
    document.review.teachers[0].fingerprint = '0'.repeat(64)
    store.write(saved.id, { ...payload, document })
    expect(await supertest(app.getHttpServer()).get(`${api}/borradores`).expect(200).then((response) => response.body.unavailableCount)).toBe(1)
    await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/continuar`).send({ expectedVersion: submitted.body.draft.version }).expect(409)
  })

  it('keeps a teacher outdated when the section returns to the original schedule in the same round', async () => {
    const catalog = proposalService.getCatalog()
    const course = catalog.courses.find((item) => item.courseId === '20118104')!
    const transferPattern = course.planningPatterns!.find((pattern) => pattern.weeklySessions.length === 2
      && pattern.weeklySessions.every((session) => session.durationMinutes === 120))!
    const teacherA = { id: 'SYNTHETIC-TRANSFER-TEACHER-A', name: 'Synthetic transfer teacher A', courseIds: [course.courseId],
      maxWeeklyMinutes: 10080, availability: structuredClone(workWindows) }
    const teacherB = { ...structuredClone(teacherA), id: 'SYNTHETIC-TRANSFER-TEACHER-B', name: 'Synthetic transfer teacher B' }
    const room = { id: 'SYNTHETIC-TRANSFER-ROOM', name: 'Synthetic transfer room', capacity: 30, kind: 'classroom' as const,
      availability: structuredClone(workWindows) }
    const config: AcademicWorkspace = {
      schoolId: 'SISTEMAS', academicPeriod: '2027-I', demandSourceId: 'independent-120-v1', demandBaseRequest: null,
      request: { revision: catalog.revision, allocationPolicy: 'balanced', demands: [{ courseId: course.courseId, estimatedDemand: 1, targetCapacity: 30, patternId: transferPattern.id }],
        resources: { teachers: [teacherA, teacherB], rooms: [room] } },
    }
    const saved = await createSavedDraft(config)
    const proposal = proposalService.getProposal(saved.proposal.proposalId)
    const originalTeacher = proposal.assignments[0]!.teacherId
    const returnedTeacher = originalTeacher === teacherA.id ? teacherA.id : teacherB.id
    const alternateTeacher = originalTeacher === teacherA.id ? teacherB.id : teacherA.id
    const submitted = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/enviar`).send({ expectedVersion: saved.version }).expect(200)
    const conformed = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/responder`).send({
      expectedVersion: submitted.body.draft.version, round: submitted.body.draft.review.round, teacherId: originalTeacher, decision: 'conformity', observation: '',
    }).expect(200)

    const section = proposal.sections[0]!
    const assignments = proposal.assignments.filter((item) => item.sectionId === section.sectionId).sort((a, b) => a.day - b.day || a.startMinute - b.startMinute)
    const assignment = assignments[0]!
    const transfer = proposalService.adjustProposal(proposal.proposalId, { expectedVersion: proposal.editVersion ?? 0, sectionId: section.sectionId,
      sessionIds: assignments.map((item) => item.sessionId), teacherId: alternateTeacher, day: assignment.day, startMinute: assignment.startMinute,
      roomIds: assignments.map((item) => item.roomId) })
    const afterTransfer = await supertest(app.getHttpServer()).post(`${api}/borradores/guardar`).send({ id: saved.id, expectedVersion: conformed.body.draft.version,
      title: 'Synthetic teacher review', state: 'draft', configuration: config, proposalId: transfer.proposalId, proposalEditVersion: transfer.editVersion ?? 0 }).expect(200)
    expect(afterTransfer.body.review.teachers.map((teacher: { teacherId: string }) => teacher.teacherId)).toEqual([alternateTeacher])

    const returned = proposalService.adjustProposal(transfer.proposalId, { expectedVersion: transfer.editVersion ?? 0, sectionId: section.sectionId,
      sessionIds: assignments.map((item) => item.sessionId), teacherId: returnedTeacher, day: assignment.day, startMinute: assignment.startMinute,
      roomIds: assignments.map((item) => item.roomId) })
    const returnedDraft = await supertest(app.getHttpServer()).post(`${api}/borradores/guardar`).send({ id: saved.id, expectedVersion: afterTransfer.body.version,
      title: 'Synthetic teacher review', state: 'draft', configuration: config, proposalId: returned.proposalId, proposalEditVersion: returned.editVersion ?? 0 }).expect(200)
    expect(returnedDraft.body.review.teachers).toMatchObject([{ teacherId: returnedTeacher, status: 'outdated' }])
    const restarted = await new SavedDraftService(new FreshProposalService()).resume(saved.id, { expectedVersion: returnedDraft.body.version })
    expect(restarted.draft.review!.teachers).toMatchObject([{ teacherId: returnedTeacher, status: 'outdated' }])

    const resubmitted = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/enviar`).send({ expectedVersion: returnedDraft.body.version }).expect(200)
    expect(resubmitted.body.draft.review.teachers).toMatchObject([{ teacherId: returnedTeacher, status: 'pending' }])
    const ready = await supertest(app.getHttpServer()).post(`${api}/borradores/${saved.id}/revision/responder`).send({ expectedVersion: resubmitted.body.draft.version,
      round: resubmitted.body.draft.review.round, teacherId: returnedTeacher, decision: 'conformity', observation: '' }).expect(200)
    expect(ready.body.draft.state).toBe('ready-for-approval')
  })

  it('rejects history growth beyond 200 events without replacing the last valid file', async () => {
    const saved = await createSavedDraft()
    const service = app.get(SavedDraftService)
    let draft = await service.submitReview(saved.id, { expectedVersion: saved.version }).then((result) => result.draft)
    const teacherId = draft.review!.teachers[0]!.teacherId
    for (let round = 1; round < 100; round++) {
      draft = (await service.decideReview(saved.id, { expectedVersion: draft.version, round, teacherId, decision: 'conformity', observation: '' })).draft
      draft = (await service.submitReview(saved.id, { expectedVersion: draft.version })).draft
    }
    draft = (await service.decideReview(saved.id, { expectedVersion: draft.version, round: 100, teacherId, decision: 'conformity', observation: '' })).draft
    const fileBefore = new SavedDraftStore(directory).read(saved.id)
    await expect(service.submitReview(saved.id, { expectedVersion: draft.version })).rejects.toMatchObject({ status: 429, response: { error: { code: 'REVIEW_HISTORY_LIMIT' } } })
    expect(new SavedDraftStore(directory).read(saved.id)).toEqual(fileBefore)
  }, 60_000)
})

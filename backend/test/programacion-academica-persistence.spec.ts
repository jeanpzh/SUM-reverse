import { createHash } from 'node:crypto'
import { lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import supertest from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { ACADEMIC_API } from '../../shared/programacion-academica-api.mjs'
import { AcademicSchedulingModule } from '../src/programacion-academica/demo-module.js'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { SavedDraftService } from '../src/programacion-academica/saved-draft.service.js'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import { SavedDraftStore } from '../src/programacion-academica/saved-draft-store.js'
import type { AcademicWorkspace } from '../../shared/programacion-academica-api.mjs'

const catalog = createDemoCatalog()
const course = catalog.courses.find((candidate) => catalog.teachers.some((teacher) => teacher.courseIds.includes(candidate.courseId)))!
const workspace = (): AcademicWorkspace => ({
  schoolId: 'SISTEMAS',
  academicPeriod: '2027-I',
  demandSourceId: 'independent-120-v1',
  demandBaseRequest: null,
  request: {
    revision: catalog.revision,
    demands: [{ courseId: course.courseId, estimatedDemand: 1 }],
    resources: structuredClone({ teachers: catalog.teachers, rooms: catalog.rooms }),
  },
})
const workWindows = [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 }))
const manualWorkspace = (): AcademicWorkspace => {
  const manualCourse = catalog.courses.find((candidate) => candidate.courseId === '20118104')!
  const pattern = manualCourse.planningPatterns!.find((candidate) => candidate.weeklySessions.length === 2
    && candidate.weeklySessions.every((session) => session.durationMinutes === 120))!
  return { schoolId: 'SISTEMAS', academicPeriod: '2027-I', demandSourceId: 'independent-120-v1', demandBaseRequest: null,
    request: { revision: catalog.revision, demands: [{ courseId: manualCourse.courseId, estimatedDemand: 1, targetCapacity: 45, patternId: pattern.id }],
      allocationPolicy: 'preferences', resources: {
        teachers: [{ id: 'SYN-TEACHER-A', name: 'Synthetic teacher A', courseIds: [manualCourse.courseId], maxWeeklyMinutes: 600,
          availability: structuredClone(workWindows), preferences: [{ day: 5, startMinute: 1080, endMinute: 1320 }] },
        { id: 'SYN-TEACHER-B', name: 'Synthetic teacher B', courseIds: [manualCourse.courseId], maxWeeklyMinutes: 600, availability: structuredClone(workWindows) }],
        rooms: [{ id: 'SYN-ROOM', name: 'Synthetic classroom', kind: 'classroom', capacity: 45, availability: structuredClone(workWindows) }],
      } } }
}

const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
    : JSON.stringify(value) ?? 'undefined'

describe('durable local academic drafts', () => {
  const directories: string[] = []
  let httpApp: INestApplication | undefined

  afterEach(async () => {
    await httpApp?.close()
    httpApp = undefined
    for (const directory of directories.splice(0)) {
      const absolute = resolve(directory)
      const temporaryRoot = resolve(tmpdir()) + sep
      if (!absolute.toLowerCase().startsWith(temporaryRoot.toLowerCase()) || !basename(absolute).startsWith('sum-academic-drafts-')
        || lstatSync(absolute).isSymbolicLink()) throw new Error('Unsafe synthetic test directory cleanup target')
      rmSync(absolute, { recursive: true, force: true })
    }
    vi.unstubAllEnvs()
  })

  const createServices = () => {
    const directory = mkdtempSync(join(tmpdir(), 'sum-academic-drafts-'))
    directories.push(directory)
    vi.stubEnv('SUM_ACADEMIC_DRAFT_DIR', directory)
    return { directory, proposals: new DemoProposalService(), saved: undefined as SavedDraftService | undefined }
  }

  const saveRequest = (proposalId: string | null = null, proposalEditVersion: number | null = null) => ({
    id: null,
    expectedVersion: null,
    title: 'Synthetic planning proposal',
    state: 'draft' as const,
    configuration: workspace(),
    proposalId,
    proposalEditVersion,
  })

  it('saves a trusted generated proposal and resumes it after a fresh service instance', async () => {
    const first = createServices()
    const generated = first.proposals.createProposal(workspace().request)
    const saved = await new SavedDraftService(first.proposals).save(saveRequest(generated.proposalId, generated.editVersion ?? 0))
    expect(saved.version).toBe(1)
    expect(saved.proposal?.assignments.length).toBeGreaterThan(0)
    expect((await new SavedDraftService(first.proposals).list()).items[0]?.id).toBe(saved.id)

    const restarted = new DemoProposalService()
    const resumed = await new SavedDraftService(restarted).resume(saved.id, { expectedVersion: saved.version })
    expect(resumed.draft.id).toBe(saved.id)
    expect(resumed.draft.version).toBe(saved.version)
    expect(resumed.draft.proposal?.proposalId).not.toBe(generated.proposalId)
    expect(resumed.draft.proposal?.assignments).toEqual(generated.assignments)
    expect(resumed.draft.proposal?.editVersion).toBe(generated.editVersion ?? 0)
  })

  it('serializes optimistic updates and rejects stale versions', async () => {
    const { proposals } = createServices()
    const savedService = new SavedDraftService(proposals)
    const created = await savedService.save(saveRequest())
    const update = { ...saveRequest(), id: created.id, expectedVersion: created.version, title: 'Updated synthetic proposal' }
    const outcomes = await Promise.allSettled([savedService.save(update), savedService.save(update)])
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((item) => item.status === 'rejected')).toHaveLength(1)
    const current = (await savedService.list()).items[0]
    expect(current?.version).toBe(2)
    expect(current?.title).toBe('Updated synthetic proposal')
  })

  it('preserves a manually adjusted schedule through durable resume', async () => {
    const { proposals } = createServices()
    const savedService = new SavedDraftService(proposals)
    const configuration = manualWorkspace()
    const generated = proposals.createProposal(configuration.request)
    expect(generated.status).toBe('complete')
    const section = generated.sections[0]!
    const block = generated.assignments.filter((item) => item.sectionId === section.sectionId)
      .sort((left, right) => left.startMinute - right.startMinute)
    const adjusted = proposals.adjustProposal(generated.proposalId, { expectedVersion: 0, sectionId: section.sectionId,
      sessionIds: block.map((item) => item.sessionId), teacherId: block[0]!.teacherId, day: 5, startMinute: 540,
      roomIds: block.map((item) => item.roomId) })
    expect(adjusted.editVersion).toBe(1)
    const saved = await savedService.save({ ...saveRequest(adjusted.proposalId, adjusted.editVersion ?? 0), configuration })
    const resumed = await new SavedDraftService(new DemoProposalService()).resume(saved.id, { expectedVersion: saved.version })
    expect(resumed.draft.proposal?.assignments).toEqual(adjusted.assignments)
    expect(resumed.draft.proposal?.manuallyAdjustedSectionIds).toEqual(adjusted.manuallyAdjustedSectionIds)
    expect(resumed.draft.proposal?.editVersion).toBe(1)
  })

  it('rejects ready state without complete nonempty coverage and stale configuration pointers', async () => {
    const { proposals } = createServices()
    const savedService = new SavedDraftService(proposals)
    const incompleteWorkspace = workspace()
    incompleteWorkspace.request.demands[0]!.estimatedDemand = 3850
    const incomplete = proposals.createProposal(incompleteWorkspace.request)
    await expect(savedService.save({ ...saveRequest(incomplete.proposalId, incomplete.editVersion ?? 0), configuration: incompleteWorkspace, state: 'ready-for-review' }))
      .rejects.toMatchObject({ status: 422 })

    const originalWorkspace = workspace()
    const generated = proposals.createProposal(originalWorkspace.request)
    const changedWorkspace = structuredClone(originalWorkspace)
    changedWorkspace.request.demands[0]!.estimatedDemand += 1
    await expect(savedService.save({ ...saveRequest(generated.proposalId, generated.editVersion ?? 0), configuration: changedWorkspace }))
      .rejects.toMatchObject({ status: 422 })
  })

  it('stores the recomputed base estimate separately from the final planning demand', async () => {
    const { proposals } = createServices()
    const configuration = workspace()
    configuration.request.demands[0] = { courseId: course.courseId, estimatedDemand: 1, targetCapacity: 45 }
    configuration.demandBaseRequest = { revision: catalog.revision, sourceId: configuration.demandSourceId, targetPeriod: '2027-I',
      courses: [{ courseId: course.courseId, targetCapacity: 45 }] }
    const saved = await new SavedDraftService(proposals).save({ ...saveRequest(), configuration })
    expect(saved.demandBase?.rows[0]?.baseDemand).not.toBe(configuration.request.demands[0]?.estimatedDemand)
    expect((await new SavedDraftService(new DemoProposalService()).resume(saved.id, { expectedVersion: 1 })).draft.demandBase)
      .toEqual(saved.demandBase)
  })

  it('retains a non-2027 planning period with its validated policy across save and resume', async () => {
    const { proposals } = createServices()
    const savedService = new SavedDraftService(proposals)
    const configuration = workspace()
    configuration.academicPeriod = '2026-II'
    configuration.request.planningPolicy = { revision: 'FISI-PLANNING-1', period: '2026-II', allowAfternoon: false, allowSaturday: false }
    const saved = await savedService.save({ ...saveRequest(), configuration })
    const resumed = await new SavedDraftService(new DemoProposalService()).resume(saved.id, { expectedVersion: saved.version })
    expect(resumed.draft.configuration.academicPeriod).toBe('2026-II')
    expect(resumed.draft.configuration.request.planningPolicy?.period).toBe('2026-II')
    const mismatched = structuredClone(configuration)
    mismatched.request.planningPolicy!.period = '2026-I'
    await expect(savedService.save({ ...saveRequest(), configuration: mismatched })).rejects.toMatchObject({ status: 400 })
  })

  it('revalidates manual senior-course moves against the same evening and afternoon policy', () => {
    const manualCourse = catalog.courses.find((candidate) => candidate.courseId === '20118104')!
    const pattern = manualCourse.planningPatterns!.find((candidate) => candidate.weeklySessions.length === 2
      && candidate.weeklySessions.every((session) => session.durationMinutes === 120))!
    const resources = {
      teachers: [{ id: 'SYN-POLICY-TEACHER', name: 'Synthetic policy teacher', courseIds: [manualCourse.courseId],
        maxWeeklyMinutes: 600, availability: structuredClone(workWindows) }],
      rooms: catalog.rooms.filter((room) => room.kind === 'laboratory'),
    }
    const makeRequest = (allowAfternoon: boolean) => ({ revision: catalog.revision,
      demands: [{ courseId: manualCourse.courseId, estimatedDemand: 1, targetCapacity: 45, patternId: pattern.id }],
      resources: structuredClone(resources), planningPolicy: { revision: 'FISI-PLANNING-1' as const, period: '2027-I' as const,
        allowAfternoon, allowSaturday: false } })
    const propose = (allowAfternoon: boolean) => {
      const proposals = new DemoProposalService()
      const generated = proposals.createProposal(makeRequest(allowAfternoon))
      expect(generated.status).toBe('complete')
      const assignments = generated.assignments.filter((item) => item.sectionId === generated.sections[0]!.sectionId)
        .sort((left, right) => left.startMinute - right.startMinute)
      return { proposals, generated, assignments }
    }
    const strict = propose(false)
    let rejection: unknown
    try { strict.proposals.adjustProposal(strict.generated.proposalId, { expectedVersion: 0,
      sectionId: strict.generated.sections[0]!.sectionId, sessionIds: strict.assignments.map((item) => item.sessionId),
      teacherId: strict.assignments[0]!.teacherId, day: 1, startMinute: 14 * 60, roomIds: strict.assignments.map((item) => item.roomId) }) }
    catch (error) { rejection = error }
    expect(rejection).toBeDefined()
    expect((rejection as { getResponse(): unknown }).getResponse()).toMatchObject({
      error: { message: expect.stringContaining('PLANNING_POLICY_WINDOW') },
    })
    const exception = propose(true)
    const adjusted = exception.proposals.adjustProposal(exception.generated.proposalId, { expectedVersion: 0,
      sectionId: exception.generated.sections[0]!.sectionId, sessionIds: exception.assignments.map((item) => item.sessionId),
      teacherId: exception.assignments[0]!.teacherId, day: 1, startMinute: 14 * 60, roomIds: exception.assignments.map((item) => item.roomId) })
    expect(adjusted.assignments.every((item) => item.startMinute >= 14 * 60 && item.startMinute < 18 * 60)).toBe(true)
  })

  it('preserves the old version when atomic rename fails', async () => {
    const { proposals } = createServices()
    const savedService = new SavedDraftService(proposals)
    const created = await savedService.save(saveRequest())
    const directory = directories.at(-1)!
    const actualPath = join(directory, `${created.id}.json`)
    const before = readFileSync(actualPath, 'utf8')
    const original = new SavedDraftStore(directory).read(created.id)!
    const failingStore = new SavedDraftStore(directory, () => { throw new Error('synthetic rename failure') })
    let error: unknown
    try { failingStore.write(created.id, original) } catch (caught) { error = caught }
    expect(error).toMatchObject({ status: 503 })
    expect(readFileSync(actualPath, 'utf8')).toBe(before)
    expect(new SavedDraftStore(directory).list().some((entry) => entry.payload === null)).toBe(false)
    expect(readdirSync(directory).some((name) => name.endsWith('.tmp'))).toBe(false)
  })

  it('enforces the fifty-file quota and the two MiB file limit', async () => {
    const { directory, proposals } = createServices()
    const store = new SavedDraftStore(directory)
    for (let index = 0; index < 50; index++) {
      const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
      store.write(id, { schemaVersion: 1, catalogFingerprint: 'synthetic', document: null, retained: null })
    }
    await expect(new SavedDraftService(proposals).save(saveRequest())).rejects.toMatchObject({ status: 429 })
    let error: unknown
    try { store.write('10000000-0000-4000-8000-000000000000', {
      schemaVersion: 1, catalogFingerprint: 'synthetic', document: 'x'.repeat(2 * 1024 * 1024), retained: null,
    }) } catch (caught) { error = caught }
    expect(error).toMatchObject({ status: 413 })
  })

  it('does not silently replace or resume a checksum-corrupt file', async () => {
    const { directory, proposals } = createServices()
    const savedService = new SavedDraftService(proposals)
    const saved = await savedService.save(saveRequest())
    const file = join(directory, `${saved.id}.json`)
    const encoded = JSON.parse(readFileSync(file, 'utf8')) as { payload: unknown, checksum: string }
    encoded.checksum = '0'.repeat(64)
    writeFileSync(file, JSON.stringify(encoded))

    expect(await savedService.list()).toMatchObject({ items: [], unavailableCount: 1 })
    await expect(savedService.resume(saved.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 409 })
    await expect(savedService.save({ ...saveRequest(), id: saved.id, expectedVersion: 1 })).rejects.toMatchObject({ status: 409 })
    expect((JSON.parse(readFileSync(file, 'utf8')) as { checksum: string }).checksum).toBe('0'.repeat(64))
  })

  it('rejects a semantically altered snapshot even when its checksum is recomputed', async () => {
    const { directory, proposals } = createServices()
    const generated = proposals.createProposal(workspace().request)
    const saved = await new SavedDraftService(proposals).save(saveRequest(generated.proposalId, generated.editVersion ?? 0))
    const file = join(directory, `${saved.id}.json`)
    const envelope = JSON.parse(readFileSync(file, 'utf8')) as { payload: Record<string, unknown>, checksum: string }
    const document = envelope.payload.document as Record<string, unknown>
    const retained = envelope.payload.retained as Record<string, unknown>
    const savedProposal = document.proposal as { assignments: Array<{ teacherName: string }> }
    const retainedView = retained.view as { assignments: Array<{ teacherName: string }> }
    savedProposal.assignments[0]!.teacherName = 'Synthetic forged name'
    retainedView.assignments[0]!.teacherName = 'Synthetic forged name'
    envelope.checksum = createHash('sha256').update(canonical(envelope.payload)).digest('hex')
    writeFileSync(file, JSON.stringify(envelope))
    expect(await new SavedDraftService(new DemoProposalService()).list()).toMatchObject({ items: [], unavailableCount: 1 })
    await expect(new SavedDraftService(new DemoProposalService()).resume(saved.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 409 })
  })

  it('keeps persistence disabled when no directory is configured', async () => {
    vi.stubEnv('SUM_ACADEMIC_DRAFT_DIR', '')
    const saved = new SavedDraftService(new DemoProposalService())
    await expect(saved.list()).rejects.toMatchObject({ status: 503 })
    await expect(saved.save(saveRequest())).rejects.toMatchObject({ status: 503 })
    expect(new SavedDraftStore().configured).toBe(false)
  })

  it('exposes guarded local endpoints and rejects client authority', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'sum-academic-drafts-'))
    directories.push(directory)
    vi.stubEnv('SUM_ACADEMIC_DRAFT_DIR', directory)
    const module = await Test.createTestingModule({ imports: [AcademicSchedulingModule] }).compile()
    httpApp = module.createNestApplication()
    await httpApp.init()
    const api = ACADEMIC_API.replace(/^\/api/, '')
    const created = await supertest(httpApp.getHttpServer()).post(`${api}/borradores/guardar`).send(saveRequest()).expect(200)
    expect(created.body.version).toBe(1)
    expect((await supertest(httpApp.getHttpServer()).get(`${api}/borradores`).expect(200)).body.items).toHaveLength(1)
    await supertest(httpApp.getHttpServer()).get(`${api}/borradores?extra=1`).expect(400)
    await supertest(httpApp.getHttpServer()).post(`${api}/borradores/guardar`).set('Origin', 'https://outside.example').send(saveRequest()).expect(403)
    await supertest(httpApp.getHttpServer()).post(`${api}/borradores/guardar`).send({ ...saveRequest(), assignments: [] }).expect(400)
    await supertest(httpApp.getHttpServer()).post(`${api}/borradores/${created.body.id}/continuar`).send({ expectedVersion: 1 }).expect(200)
    await supertest(httpApp.getHttpServer()).post(`${api}/borradores/${created.body.id}/continuar`).send({ expectedVersion: 2 }).expect(409)
  })
})

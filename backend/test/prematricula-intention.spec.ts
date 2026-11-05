import { lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpException } from '@nestjs/common'
import { buildBuiltInEnrollmentScenarioBundles } from '../src/matricula-regular/enrollment-scenarios.js'
import { MatriculaRegularError } from '../src/matricula-regular/matricula-regular-error.filter.js'
import { PrematriculaService } from '../src/prematricula/prematricula.service.js'
import { classify } from '../src/programacion-academica/demand-estimator.js'
import { projectActor } from '../src/programacion-academica/demand-fixtures.js'
import type { ActorProfile } from '../src/matricula-regular/profile.types.js'
import type { E2Identity } from '../../shared/prematricula-api.d.mts'
import type { E2DemandRequest, E2RegisterIntentionRequest } from '../../shared/prematricula-intention.d.mts'
import type { AcademicPublication } from '../../shared/programacion-academica-api.d.mts'

const actors = buildBuiltInEnrollmentScenarioBundles().find(item => item.scenarioId === 'regular')!.fixtures.flatMap(fixture => fixture.actors)
const runId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'
const publicationId = '00000000-0000-4000-8000-000000000003'
const dirs: string[] = []
const envKeys = ['SUM_LOCAL_SCENARIOS', 'SUM_ACADEMIC_SCHEDULING', 'SIMULATOR_DEPLOYMENT', 'SUM_ACADEMIC_DRAFT_DIR'] as const
const previousEnv = new Map(envKeys.map(key => [key, process.env[key]]))

function identity(actorId: 'SYN-SIS-A' | 'SYN-SIS-B'): E2Identity { return { runId, actorId, sessionId } }

function eligibleCourse(actor: ActorProfile): string {
  const learner = projectActor(actor)
  return learner.courses.find(course => classify(learner, course.courseCode, false).category === 'eligible')!.courseCode
}

const sharedCourseId = eligibleCourse(actors.find(actor => actor.actorId === 'SYN-SIS-A')!)

function publication(version = 1, courseIds = [sharedCourseId]): AcademicPublication {
  const sections = courseIds.map((courseId, index) => ({ sectionId: `SEC-${String(index + 1).padStart(2, '0')}`, courseId, courseName: 'Curso sintético', capacity: 30 }))
  return {
    revision: 'PA-PUBLICATION-1', id: publicationId, publicationVersion: version, title: 'Publicación sintética',
    sourceProposalVersion: 1, approvedVersion: 2, approvedAt: '2026-11-04T12:00:00.000Z', publishedAt: '2026-11-04T12:00:00.000Z',
    schedule: { schoolId: 'SISTEMAS', academicPeriod: '2027-I',
      courses: courseIds.map(courseId => ({ courseId, name: 'Curso sintético', cycle: 1, credits: 4 })), sections,
      assignments: sections.map((section, index) => ({ day: 1, startMinute: 480 + index * 120, endMinute: 540 + index * 120,
        sessionId: `SESSION-${index}`, sectionId: section.sectionId, courseId: section.courseId, courseName: 'Curso sintético',
        teacherId: `TEACHER-${index}`, teacherName: 'Docente sintético', roomId: `ROOM-${index}`, roomName: 'Aula sintética' })),
    },
  }
}

function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'prematricula-intention-'))
  dirs.push(directory)
  process.env.SUM_ACADEMIC_DRAFT_DIR = directory
  process.env.SUM_LOCAL_SCENARIOS = '1'
  process.env.SUM_ACADEMIC_SCHEDULING = '1'
  delete process.env.SIMULATOR_DEPLOYMENT
  const state = { actors: structuredClone(actors), sessionActive: true, scenario: 'regular', currentPublication: publication() }
  const snapshot = () => ({ runId, actors: state.actors, sessions: [], profiles: [], offer: [], requests: [], enrollments: [], reports: [] })
  const repository = { hasOperationalRun: () => false, readSnapshot: () => structuredClone(snapshot()) } as never
  const sessions = { requireActive: vi.fn(() => { if (!state.sessionActive) throw new MatriculaRegularError(404, runId, 'SESSION_NOT_FOUND') }) } as never
  const context = { now: () => new Date('2026-11-04T12:00:00.000Z') } as never
  const scenarios = { catalog: () => ({ data: { currentScenarioId: state.scenario } }) } as never
  const saved = {
    publications: async () => ({ currentId: publicationId, items: [{ id: publicationId, publicationVersion: state.currentPublication.publicationVersion, title: 'Publicación sintética', sourceProposalVersion: 1, approvedVersion: 2, approvedAt: '2026-11-04T12:00:00.000Z', publishedAt: '2026-11-04T12:00:00.000Z' }] }),
    getPublication: async (id: string) => id === publicationId ? structuredClone(state.currentPublication) : Promise.reject(new HttpException({ error: { code: 'DRAFT_NOT_FOUND', message: 'missing' } }, 404)),
  }
  const create = () => new PrematriculaService(repository, context, sessions, scenarios, saved as never)
  const register = async (actorId: 'SYN-SIS-A' | 'SYN-SIS-B', overrides: Partial<E2RegisterIntentionRequest> = {}) => {
    const who = identity(actorId)
    const service = create()
    const contextNow = await service.getContext({ identity: who })
    const draft = await service.save({ identity: who, publicationId, publicationVersion: state.currentPublication.publicationVersion,
      selection: [{ courseId: sharedCourseId, sectionId: 'SEC-01' }], id: null, expectedVersion: null, expectedAcademicRevision: contextNow.academicRevision })
    const latest = await service.getIntentionContext({ identity: who })
    return service.registerIntention({ identity: who, draftId: draft.draft.id, expectedDraftVersion: draft.draft.version,
      expectedIntentionVersion: latest.intention?.version ?? null, expectedAcademicRevision: latest.academicRevision, ...overrides })
  }
  return { create, register, state, directory, saved, publication: state.currentPublication }
}

afterEach(() => {
  for (const directory of dirs.splice(0)) {
    const absolute = resolve(directory)
    const temporaryRoot = resolve(tmpdir()) + sep
    if (!absolute.toLowerCase().startsWith(temporaryRoot.toLowerCase()) || !basename(absolute).startsWith('prematricula-intention-') || lstatSync(absolute).isSymbolicLink()) throw new Error('Unsafe synthetic test cleanup target')
    rmSync(absolute, { recursive: true, force: true })
  }
  for (const [key, value] of previousEnv) if (value === undefined) delete process.env[key]; else process.env[key] = value
  vi.restoreAllMocks()
})

describe('prematrícula E2 intenciones locales', () => {
  it('lee vacío y guardar borrador no registra; el registro devuelve historial y persiste al recrear servicio', async () => {
    const state = setup()
    const who = identity('SYN-SIS-A')
    const service = state.create()
    const empty = await service.getIntentionContext({ identity: who })
    expect(empty).toMatchObject({ draftId: null, draftVersion: null, intention: null, validation: null })
    const ctx = await service.getContext({ identity: who })
    const saved = await service.save({ identity: who, publicationId, publicationVersion: 1, selection: [{ courseId: sharedCourseId, sectionId: 'SEC-01' }], id: null, expectedVersion: null, expectedAcademicRevision: ctx.academicRevision })
    expect((await state.create().getIntentionContext({ identity: who })).intention).toBeNull()
    const registered = await state.create().registerIntention({ identity: who, draftId: saved.draft.id, expectedDraftVersion: 1, expectedIntentionVersion: null, expectedAcademicRevision: ctx.academicRevision })
    expect(registered.intention?.history).toHaveLength(1)
    expect((await state.create().getIntentionContext({ identity: who })).intention).toEqual(registered.intention)
  })

  it('rechaza selección vacía, incumplimiento y verificaciones pendientes', async () => {
    const state = setup()
    const actor = state.state.actors.find(item => item.actorId === 'SYN-SIS-A')!
    const saveAndRegister = async (target: ReturnType<typeof setup>, courseId: string, selection: Array<{ courseId: string, sectionId: string }>) => {
      target.state.currentPublication = publication(1, [courseId])
      const service = target.create()
      const who = identity('SYN-SIS-A')
      const ctx = await service.getContext({ identity: who })
      const saved = await service.save({ identity: who, publicationId, publicationVersion: 1, selection, id: null, expectedVersion: null, expectedAcademicRevision: ctx.academicRevision })
      return service.registerIntention({ identity: who, draftId: saved.draft.id, expectedDraftVersion: 1, expectedIntentionVersion: null, expectedAcademicRevision: ctx.academicRevision })
    }
    const service = state.create()
    const who = identity('SYN-SIS-A')
    const ctx = await service.getContext({ identity: who })
    const empty = await service.save({ identity: who, publicationId, publicationVersion: 1, selection: [], id: null, expectedVersion: null, expectedAcademicRevision: ctx.academicRevision })
    await expect(service.registerIntention({ identity: who, draftId: empty.draft.id, expectedDraftVersion: 1, expectedIntentionVersion: null, expectedAcademicRevision: ctx.academicRevision })).rejects.toMatchObject({ status: 422 })
    const learner = projectActor(actor)
    const badCourse = learner.courses.find(course => classify(learner, course.courseCode, false).category === 'non-eligible')?.courseCode
    expect(badCourse).toBeTruthy()
    await expect(saveAndRegister(setup(), badCourse!, [{ courseId: badCourse!, sectionId: 'SEC-01' }])).rejects.toMatchObject({ status: 422 })
    const pendingState = setup()
    pendingState.state.actors.find(item => item.actorId === 'SYN-SIS-A')!.historyKnown = false
    await expect(saveAndRegister(pendingState, sharedCourseId, [{ courseId: sharedCourseId, sectionId: 'SEC-01' }])).rejects.toMatchObject({ status: 422 })
  })

  it('actualiza solo con versión nueva, bloquea duplicado y detecta CAS concurrente', async () => {
    const state = setup()
    const who = identity('SYN-SIS-A')
    const service = state.create()
    const ctx = await service.getContext({ identity: who })
    const first = await service.save({ identity: who, publicationId, publicationVersion: 1, selection: [{ courseId: sharedCourseId, sectionId: 'SEC-01' }], id: null, expectedVersion: null, expectedAcademicRevision: ctx.academicRevision })
    const req: E2RegisterIntentionRequest = { identity: who, draftId: first.draft.id, expectedDraftVersion: 1, expectedIntentionVersion: null, expectedAcademicRevision: ctx.academicRevision }
    await service.registerIntention(req)
    await expect(service.registerIntention({ ...req, expectedIntentionVersion: 1 })).rejects.toMatchObject({ status: 422 })
    const saved2 = await service.save({ identity: who, publicationId, publicationVersion: 1, selection: [{ courseId: sharedCourseId, sectionId: 'SEC-01' }], id: first.draft.id, expectedVersion: 1, expectedAcademicRevision: ctx.academicRevision })
    const updateReq = { ...req, expectedDraftVersion: 2, expectedIntentionVersion: 1 }
    const outcomes = await Promise.allSettled([service.registerIntention(updateReq), service.registerIntention(updateReq)])
    expect(outcomes.filter(item => item.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.find(item => item.status === 'fulfilled')).toMatchObject({ value: { intention: { version: 2 } } })
    expect(saved2.draft.version).toBe(2)
  })

  it('aísla propietarios, rechaza sesión/propiedad/versión y preserva intención al guardar', async () => {
    const state = setup()
    const result = await state.register('SYN-SIS-A')
    const service = state.create()
    const initialContextB = await service.getIntentionContext({ identity: identity('SYN-SIS-B') })
    expect(initialContextB.intention).toBeNull()
    const owned = result.draftId!
    const contextB = await service.getIntentionContext({ identity: identity('SYN-SIS-B') })
    await expect(service.registerIntention({ identity: identity('SYN-SIS-B'), draftId: owned, expectedDraftVersion: 1, expectedIntentionVersion: null, expectedAcademicRevision: contextB.academicRevision })).rejects.toMatchObject({ status: 403 })
    state.state.sessionActive = false
    await expect(service.getIntentionContext({ identity: identity('SYN-SIS-A') })).rejects.toMatchObject({ status: 404 })
    state.state.sessionActive = true
    await expect(service.registerIntention({ identity: identity('SYN-SIS-A'), draftId: owned, expectedDraftVersion: 99, expectedIntentionVersion: 1, expectedAcademicRevision: result.academicRevision })).rejects.toMatchObject({ status: 409 })
    const saved = await service.save({ identity: identity('SYN-SIS-A'), publicationId, publicationVersion: 1, selection: [{ courseId: sharedCourseId, sectionId: 'SEC-01' }], id: owned, expectedVersion: 1, expectedAcademicRevision: result.academicRevision })
    expect(saved.draft.version).toBe(2)
    expect((await service.getIntentionContext({ identity: identity('SYN-SIS-A') })).intention?.version).toBe(1)
  })

  it('agrega una vez por propietario, devuelve ceros y no filtra IDs; cambiar de publicación exige registrar', async () => {
    const state = setup()
    await state.register('SYN-SIS-A')
    const empty = await state.create().getDemand({ publicationId, publicationVersion: 1 } satisfies E2DemandRequest)
    expect(empty).toMatchObject({ registeredStudents: 1, countedStudents: 1, excludedStudents: 0, courses: [{ students: 1, sections: [{ students: 1 }] }] })
    expect(JSON.stringify(empty)).not.toContain('SYN-SIS-A')
    state.state.currentPublication = publication(2)
    await expect(state.create().getDemand({ publicationId, publicationVersion: 1 })).rejects.toMatchObject({ status: 409 })
    const demand = await state.create().getDemand({ publicationId, publicationVersion: 2 })
    expect(demand).toMatchObject({ registeredStudents: 0, countedStudents: 0, excludedStudents: 0, courses: [{ students: 0, sections: [{ students: 0 }] }] })
  })

  it('cuenta A y B como propietarios distintos y suma selecciones por curso/sección', async () => {
    const state = setup()
    await state.register('SYN-SIS-A')
    await state.register('SYN-SIS-B')
    const demand = await state.create().getDemand({ publicationId, publicationVersion: 1 })
    expect(demand).toMatchObject({ registeredStudents: 2, countedStudents: 2, excludedStudents: 0, courses: [{ students: 2, sections: [{ students: 2 }] }] })
  })

  it('excluye una intención al cambiar el contexto académico y rechaza publicación no recuperable', async () => {
    const state = setup()
    await state.register('SYN-SIS-A')
    const actor = state.state.actors.find(item => item.actorId === 'SYN-SIS-A')!
    actor.academic!.attempts.push({ ...actor.academic!.attempts[0]!, recordId: 'synthetic-change', period: '2026-1' })
    const demand = await state.create().getDemand({ publicationId, publicationVersion: 1 })
    expect(demand).toMatchObject({ registeredStudents: 1, countedStudents: 0, excludedStudents: 1 })
    state.state.currentPublication = publication(2)
    await expect(state.create().getDemand({ publicationId, publicationVersion: 1 })).rejects.toMatchObject({ status: 409 })
  })

  it('revalida la última intención al consultar aunque su publicación haya dejado de estar disponible', async () => {
    const state = setup()
    const registered = await state.register('SYN-SIS-A')
    state.saved.getPublication = async () => Promise.reject(new HttpException({ error: { code: 'PUBLICATION_NOT_FOUND', message: 'missing' } }, 404))
    const context = await state.create().getIntentionContext({ identity: identity('SYN-SIS-A') })
    expect(context.intention).toEqual(registered.intention)
    expect(context.validation).toMatchObject({ status: 'insufficient', issues: [expect.objectContaining({ code: 'PUBLICATION_UNAVAILABLE' })] })
  })

  it('rechaza versión de intención obsoleta y request con campos de cliente adicionales', async () => {
    const state = setup()
    const registered = await state.register('SYN-SIS-A')
    await expect(state.create().registerIntention({ identity: identity('SYN-SIS-A'), draftId: registered.draftId, expectedDraftVersion: registered.draftVersion,
      expectedIntentionVersion: null, expectedAcademicRevision: registered.academicRevision })).rejects.toMatchObject({ status: 409 })
    await expect(state.create().registerIntention({ identity: identity('SYN-SIS-A'), draftId: registered.draftId, expectedDraftVersion: registered.draftVersion,
      expectedIntentionVersion: 1, expectedAcademicRevision: registered.academicRevision, selection: [{ courseId: sharedCourseId, sectionId: 'SEC-01' }] })).rejects.toMatchObject({ status: 400 })
  })

  it('falla cerrado ante payload corrupto y conserva compatibilidad de payload legado', async () => {
    const state = setup()
    const who = identity('SYN-SIS-A')
    const ctx = await state.create().getContext({ identity: who })
    const saved = await state.create().save({ identity: who, publicationId, publicationVersion: 1, selection: [{ courseId: sharedCourseId, sectionId: 'SEC-01' }], id: null, expectedVersion: null, expectedAcademicRevision: ctx.academicRevision })
    const path = join(state.directory, 'e2-prematricula', `${saved.draft.id}.json`)
    const envelope = JSON.parse(readFileSync(path, 'utf8'))
    envelope.payload.unexpected = true
    writeFileSync(path, JSON.stringify(envelope))
    await expect(state.create().getIntentionContext({ identity: who })).rejects.toMatchObject({ status: 409 })
    expect(readdirSync(join(state.directory, 'e2-prematricula'))).toContain(`${saved.draft.id}.json`)
  })

  it('rechaza escenario no regular y conserva intacto el snapshot E1 durante el registro', async () => {
    const state = setup()
    const before = structuredClone(state.state.actors)
    const ctx = await state.create().getContext({ identity: identity('SYN-SIS-A') })
    const saved = await state.create().save({ identity: identity('SYN-SIS-A'), publicationId, publicationVersion: 1, selection: [{ courseId: sharedCourseId, sectionId: 'SEC-01' }], id: null, expectedVersion: null, expectedAcademicRevision: ctx.academicRevision })
    state.state.scenario = 'cruce'
    await expect(state.create().registerIntention({ identity: identity('SYN-SIS-A'), draftId: saved.draft.id, expectedDraftVersion: 1, expectedIntentionVersion: null, expectedAcademicRevision: ctx.academicRevision })).rejects.toMatchObject({ status: 403 })
    expect(state.state.actors).toEqual(before)
  })
})

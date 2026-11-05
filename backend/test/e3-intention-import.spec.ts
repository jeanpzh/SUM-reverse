import { lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpException } from '@nestjs/common'
import { buildBuiltInEnrollmentScenarioBundles } from '../src/matricula-regular/enrollment-scenarios.js'
import { MatriculaRegularError } from '../src/matricula-regular/matricula-regular-error.filter.js'
import { PrematriculaService } from '../src/prematricula/prematricula.service.js'
import { projectActor } from '../src/programacion-academica/demand-fixtures.js'
import { classify } from '../src/programacion-academica/demand-estimator.js'
import type { E2Identity } from '../../shared/prematricula-api.d.mts'
import type { E2RegisterIntentionRequest } from '../../shared/prematricula-intention.d.mts'
import type { AcademicPublication } from '../../shared/programacion-academica-api.d.mts'

const bundle = buildBuiltInEnrollmentScenarioBundles().find(item => item.scenarioId === 'regular')!
const fixture = bundle.fixtures.find(item => item.profile.scope.schoolId === 'SISTEMAS')!
const actors = fixture.actors
const runId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'
const publicationId = '00000000-0000-4000-8000-000000000003'
const dirs: string[] = []
const envKeys = ['SUM_LOCAL_SCENARIOS', 'SUM_ACADEMIC_SCHEDULING', 'SIMULATOR_DEPLOYMENT', 'SUM_ACADEMIC_DRAFT_DIR'] as const
const previousEnv = new Map(envKeys.map(key => [key, process.env[key]]))

function identity(actorId: 'SYN-SIS-A' | 'SYN-SIS-B'): E2Identity { return { runId, actorId, sessionId } }

const sourceActor = actors.find(actor => actor.actorId === 'SYN-SIS-A')!
const sourceCourseId = fixture.offer
  .map(course => sourceActor.scenarioData!.courseCodes[course.courseId]!)
  .find(courseCode => classify(projectActor(sourceActor), courseCode, false).category === 'eligible')!

function publication(version = 1, courseIds = [sourceCourseId]): AcademicPublication {
  const sections = courseIds.map((courseId, index) => ({ sectionId: `SEC-${String(index + 1).padStart(2, '0')}`, courseId, courseName: 'Curso sintético', capacity: 30 }))
  return {
    revision: 'PA-PUBLICATION-1', id: publicationId, publicationVersion: version, title: 'Oferta sintética 2027-I',
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
  const directory = mkdtempSync(join(tmpdir(), 'e3-intention-import-'))
  dirs.push(directory)
  process.env.SUM_ACADEMIC_DRAFT_DIR = directory
  process.env.SUM_LOCAL_SCENARIOS = '1'
  process.env.SUM_ACADEMIC_SCHEDULING = '1'
  delete process.env.SIMULATOR_DEPLOYMENT
  const state = { actors: structuredClone(actors), sessionActive: true, scenario: 'regular', currentPublication: publication(), offer: structuredClone(fixture.offer) }
  const actor = state.actors.find(item => item.actorId === 'SYN-SIS-A')!
  actor.scope.period = fixture.profile.scope.period = '2027-I'
  const targetCourseId = Object.entries(actor.scenarioData!.courseCodes).find(([, code]) => code === sourceCourseId)![0]
  const targetCourse = state.offer.find(course => course.courseId === targetCourseId)!
  const targetSection = targetCourse.sections[0]!
  targetSection.schedule = [{ day: 1, startMinute: 480, endMinute: 540 }]
  actor.scenarioData!.sectionOrigins = [{ publicationId, publicationVersion: 1, courseId: sourceCourseId,
    sectionId: 'SEC-01', offeredSectionId: targetSection.sectionId }]
  const snapshot = () => ({ runId, actors: state.actors, sessions: [], profiles: [fixture.profile], offer: state.offer, requests: [], enrollments: [], reports: [] })
  const repository = { readSnapshot: () => structuredClone(snapshot()) } as never
  const sessions = { requireActive: vi.fn(() => { if (!state.sessionActive) throw new MatriculaRegularError(404, runId, 'SESSION_NOT_FOUND') }) } as never
  const context = { now: () => new Date('2026-11-04T12:00:00.000Z') } as never
  const scenarios = { catalog: () => ({ data: { currentScenarioId: state.scenario } }) } as never
  const saved = {
    publications: async () => ({ currentId: publicationId, items: [{ id: publicationId, publicationVersion: state.currentPublication.publicationVersion, title: 'Oferta sintética 2027-I', sourceProposalVersion: 1, approvedVersion: 2, approvedAt: '2026-11-04T12:00:00.000Z', publishedAt: '2026-11-04T12:00:00.000Z' }] }),
    getPublication: async (id: string) => id === publicationId ? structuredClone(state.currentPublication) : Promise.reject(new HttpException({ error: { code: 'PUBLICATION_NOT_FOUND', message: 'missing' } }, 404)),
  }
  const create = () => new PrematriculaService(repository, context, sessions, scenarios, saved as never)
  const register = async (actorId: 'SYN-SIS-A' | 'SYN-SIS-B' = 'SYN-SIS-A', overrides: Partial<E2RegisterIntentionRequest> = {}) => {
    const who = identity(actorId)
    const service = create()
    const contextNow = await service.getContext({ identity: who })
    const draft = await service.save({ identity: who, publicationId, publicationVersion: state.currentPublication.publicationVersion,
      selection: [{ courseId: sourceCourseId, sectionId: 'SEC-01' }], id: null, expectedVersion: null, expectedAcademicRevision: contextNow.academicRevision })
    const latest = await service.getIntentionContext({ identity: who })
    await service.registerIntention({ identity: who, draftId: draft.draft.id, expectedDraftVersion: draft.draft.version,
      expectedIntentionVersion: latest.intention?.version ?? null, expectedAcademicRevision: latest.academicRevision, ...overrides })
    return service
  }
  return { create, register, state, directory, targetCourseId, targetSection, actor, sourceCourseId }
}

afterEach(() => {
  for (const directory of dirs.splice(0)) {
    const absolute = resolve(directory)
    const temporaryRoot = resolve(tmpdir()) + sep
    if (!absolute.toLowerCase().startsWith(temporaryRoot.toLowerCase()) || !basename(absolute).startsWith('e3-intention-import-') || lstatSync(absolute).isSymbolicLink()) throw new Error('Unsafe synthetic test cleanup target')
    rmSync(absolute, { recursive: true, force: true })
  }
  for (const [key, value] of previousEnv) if (value === undefined) delete process.env[key]; else process.env[key] = value
  vi.restoreAllMocks()
})

describe('traslado local de intención E2 a E3', () => {
  it('precarga solo correspondencias explícitas con horario, admisión y cupo compatibles; conserva E1, E2 y ocupaciones', async () => {
    const state = setup()
    const service = await state.register()
    const beforeE1 = JSON.stringify({ academic: state.actor.academic, scenarioData: state.actor.scenarioData, offer: state.state.offer })
    const e2Path = join(state.directory, 'e2-prematricula', readdirSync(join(state.directory, 'e2-prematricula'))[0]!)
    const beforeE2 = readFileSync(e2Path, 'utf8')
    const result = await service.transferIntention({ identity: identity('SYN-SIS-A') })
    const afterE1 = JSON.stringify({ academic: state.actor.academic, scenarioData: state.actor.scenarioData, offer: state.state.offer })

    expect(result).toMatchObject({
      runId, actorId: 'SYN-SIS-A', profileRevision: state.actor.profileRevision,
      intention: { version: 1, publicationId, publicationVersion: 1, academicPeriod: '2027-I' },
      selection: [{ courseId: state.targetCourseId, sectionId: state.targetSection.sectionId }],
      issues: [],
    })
    expect(afterE1).toBe(beforeE1)
    expect(readFileSync(e2Path, 'utf8')).toBe(beforeE2)
    expect(state.state.offer.find(course => course.courseId === state.targetCourseId)!.sections[0]!.occupied).toBeLessThan(state.targetSection.capacity)
  })

  it('devuelve selección vacía cuando E2 aún no tiene intención', async () => {
    const state = setup()
    const result = await state.create().transferIntention({ identity: identity('SYN-SIS-A') })
    expect(result).toMatchObject({ runId, actorId: 'SYN-SIS-A', intention: null, selection: [], issues: [] })
  })

  it.each([
    ['sin curso destino', (state: ReturnType<typeof setup>) => { delete state.actor.scenarioData!.courseCodes[state.targetCourseId] }, 'COURSE_UNAVAILABLE'],
    ['sin origen de sección', (state: ReturnType<typeof setup>) => { state.actor.scenarioData!.sectionOrigins = [] }, 'SECTION_UNMAPPED'],
    ['origen ambiguo', (state: ReturnType<typeof setup>) => { state.actor.scenarioData!.sectionOrigins!.push({ ...state.actor.scenarioData!.sectionOrigins![0]! }) }, 'AMBIGUOUS_MAPPING'],
    ['ámbito de publicación distinto', (state: ReturnType<typeof setup>) => { state.state.currentPublication.schedule.academicPeriod = '2026-II' }, 'SCOPE_MISMATCH'],
    ['periodo de matrícula distinto aun con correspondencia', (state: ReturnType<typeof setup>) => {
      state.state.actors.find(actor => actor.actorId === 'SYN-SIS-A')!.scope.period = '2026-II'
    }, 'SCOPE_MISMATCH'],
    ['horario distinto', (state: ReturnType<typeof setup>) => { state.targetSection.schedule = [{ day: 2, startMinute: 480, endMinute: 540 }] }, 'SCHEDULE_CHANGED'],
    ['sección llena', (state: ReturnType<typeof setup>) => { state.targetSection.occupied = state.targetSection.capacity }, 'SECTION_FULL'],
    ['curso fuera de admisión', (state: ReturnType<typeof setup>) => { state.actor.preEnrollment = [] }, 'ACADEMIC_PENDING'],
  ])('deja pendiente %s sin precargar', async (_label, change, code) => {
    const state = setup()
    const service = await state.register()
    change(state)
    const result = await service.transferIntention({ identity: identity('SYN-SIS-A') })
    expect(result.selection).toEqual([])
    expect(result.issues).toContainEqual({ courseId: state.sourceCourseId, sectionId: 'SEC-01', code })
  })

  it('revalida la sesión tras recuperar la publicación', async () => {
    const state = setup()
    const service = await state.register()
    const getPublication = vi.fn(async (id: string) => {
      state.state.sessionActive = false
      return id === publicationId ? structuredClone(state.state.currentPublication) : Promise.reject(new HttpException({}, 404))
    })
    const changedService = new PrematriculaService(
      { readSnapshot: () => ({ runId, actors: state.state.actors, sessions: [], profiles: [], offer: state.state.offer, requests: [], enrollments: [], reports: [] }) } as never,
      { now: () => new Date('2026-11-04T12:00:00.000Z') } as never,
      { requireActive: vi.fn(() => { if (!state.state.sessionActive) throw new MatriculaRegularError(404, runId, 'SESSION_NOT_FOUND') }) } as never,
      { catalog: () => ({ data: { currentScenarioId: 'regular' } }) } as never,
      { ...({} as never), getPublication } as never,
    )
    await expect(changedService.transferIntention({ identity: identity('SYN-SIS-A') })).rejects.toMatchObject({ status: 404 })
    expect(service).toBeDefined()
  })
})

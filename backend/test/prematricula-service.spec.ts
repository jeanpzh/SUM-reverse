import { lstatSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpException } from '@nestjs/common'
import { buildBuiltInEnrollmentScenarioBundles } from '../src/matricula-regular/enrollment-scenarios.js'
import { MatriculaRegularError } from '../src/matricula-regular/matricula-regular-error.filter.js'
import { PrematriculaErrorFilter } from '../src/prematricula/prematricula-error.filter.js'
import { PrematriculaService } from '../src/prematricula/prematricula.service.js'
import { classify } from '../src/programacion-academica/demand-estimator.js'
import { projectActor } from '../src/programacion-academica/demand-fixtures.js'
import type { ActorProfile } from '../src/matricula-regular/profile.types.js'
import type { DemandLearner } from '../src/programacion-academica/demand-fixtures.js'
import type { E2Identity, E2SaveRequest } from '../../shared/prematricula-api.d.mts'
import type { AcademicPublication } from '../../shared/programacion-academica-api.d.mts'

const bundle = buildBuiltInEnrollmentScenarioBundles().find((item) => item.scenarioId === 'regular')!
const actors = bundle.fixtures.flatMap((fixture) => fixture.actors)
const uuidA = '00000000-0000-4000-8000-000000000001'
const uuidB = '00000000-0000-4000-8000-000000000002'
const dirs: string[] = []
const envKeys = ['SUM_LOCAL_SCENARIOS', 'SUM_ACADEMIC_SCHEDULING', 'SIMULATOR_DEPLOYMENT', 'SUM_ACADEMIC_DRAFT_DIR'] as const
const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]))

function makeIdentity(actorId: 'SYN-SIS-A' | 'SYN-SIS-B' = 'SYN-SIS-A'): E2Identity {
  return { runId: uuidA, actorId, sessionId: uuidB }
}

function makePublication(actor: ActorProfile, publicationVersion = 1, requestedCourseIds?: string | string[], credits = 4, overlap = false): AcademicPublication {
  const learner = projectActor(actor)
  const defaultCourseId = learner.courses.find((course) => classify(learner, course.courseCode, false).category === 'eligible')?.courseCode
    ?? learner.courses[0]!.courseCode
  const courseIds = requestedCourseIds === undefined ? [defaultCourseId] : typeof requestedCourseIds === 'string' ? [requestedCourseIds] : requestedCourseIds
  const sections = courseIds.map((courseId, index) => ({ sectionId: `SEC-0${index + 1}`, courseId, courseName: 'Asignatura sintética', capacity: 30 }))
  return {
    revision: 'PA-PUBLICATION-1', id: '00000000-0000-4000-8000-000000000003', publicationVersion,
    title: 'Publicación sintética', sourceProposalVersion: 1, approvedVersion: 2,
    approvedAt: '2026-10-01T12:00:00.000Z', publishedAt: '2026-10-01T12:00:00.000Z',
    schedule: {
      schoolId: 'SISTEMAS', academicPeriod: '2027-I',
      courses: courseIds.map((courseId) => ({ courseId, name: 'Asignatura sintética', cycle: 1, credits })),
      sections,
      assignments: sections.map((section, index) => ({ day: 1, startMinute: index === 0 ? 480 : overlap ? 540 : 600, endMinute: index === 0 ? 600 : overlap ? 660 : 720,
        sessionId: `S${index + 1}`, sectionId: section.sectionId, courseId: section.courseId, courseName: 'Asignatura sintética', teacherId: `T${index + 1}`, teacherName: 'Docente sintético', roomId: `R${index + 1}`, roomName: 'Aula sintética' })),
    },
  }
}

function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'prematricula-e2-'))
  dirs.push(directory)
  process.env.SUM_ACADEMIC_DRAFT_DIR = directory
  process.env.SUM_LOCAL_SCENARIOS = '1'
  process.env.SUM_ACADEMIC_SCHEDULING = '1'
  delete process.env.SIMULATOR_DEPLOYMENT
  const snapshot = { runId: uuidA, actors, sessions: [], profiles: [], offer: [], requests: [], enrollments: [], reports: [] } as never
  const repository = { hasOperationalRun: () => false, readSnapshot: () => structuredClone(snapshot) } as never
  let sessionActive = true
  const sessions = { requireActive: vi.fn(() => { if (!sessionActive) throw new MatriculaRegularError(404, uuidA, 'SESSION_NOT_FOUND') }) } as never
  const context = { now: () => new Date('2026-11-04T12:00:00.000Z') } as never
  let currentScenario = 'regular'
  const scenarios = { catalog: () => ({ data: { currentScenarioId: currentScenario } }) } as never
  const saved = {
    publications: async () => ({ currentId: null, items: [] }),
    getPublication: async (id: string) => id === '00000000-0000-4000-8000-000000000003' ? makePublication(actors[0]!) : Promise.reject(new HttpException({ error: { code: 'DRAFT_NOT_FOUND', message: 'missing' } }, 404)),
  } as { publications: () => Promise<{ currentId: null, items: never[] }>, getPublication: (id: string) => Promise<AcademicPublication> }
  const create = () => new PrematriculaService(repository, context, sessions, scenarios, saved as never)
  const identity = makeIdentity()
  const publication = makePublication(actors[0]!)
  const request = (overrides: Partial<E2SaveRequest> = {}): E2SaveRequest => ({
    identity, publicationId: publication.id, publicationVersion: publication.publicationVersion,
    selection: [{ courseId: publication.schedule.courses[0]!.courseId, sectionId: 'SEC-01' }],
    id: null, expectedVersion: null, expectedAcademicRevision: '0'.repeat(64), ...overrides,
  })
  return {
    create, identity, publication, request, saved, directory,
    repository: repository as { readSnapshot: () => { offer: unknown[] } },
    setScenario: (scenario: string) => { currentScenario = scenario },
    setSessionActive: (active: boolean) => { sessionActive = active },
    sessions: sessions as { requireActive: ReturnType<typeof vi.fn> },
  }
}

afterEach(() => {
  for (const directory of dirs.splice(0)) {
    const absolute = resolve(directory)
    const temporaryRoot = resolve(tmpdir()) + sep
    if (!absolute.toLowerCase().startsWith(temporaryRoot.toLowerCase()) || !basename(absolute).startsWith('prematricula-e2-') || lstatSync(absolute).isSymbolicLink()) throw new Error('Unsafe synthetic test cleanup target')
    rmSync(absolute, { recursive: true, force: true })
  }
  for (const [key, value] of previousEnv) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.restoreAllMocks()
})

describe('prematrícula E2 local', () => {
  it('exige los modos locales y bloquea el despliegue público antes de acceder a la sesión', async () => {
    const state = setup()
    process.env.SIMULATOR_DEPLOYMENT = 'public'
    await expect(state.create().getContext({ identity: state.identity })).rejects.toMatchObject({ status: 403 })
    expect(state.sessions.requireActive).not.toHaveBeenCalled()
  })

  it('rechaza sesión ausente y no lee la publicación', async () => {
    const state = setup()
    state.sessions.requireActive.mockImplementation(() => { throw new MatriculaRegularError(404, uuidA, 'SESSION_NOT_FOUND') })
    await expect(state.create().getPublication({ identity: state.identity, publicationId: state.publication.id })).rejects.toMatchObject({ status: 404 })
  })

  it('rechaza el escenario no regular', async () => {
    const state = setup()
    state.setScenario('cruce')
    await expect(state.create().getContext({ identity: state.identity })).rejects.toMatchObject({ status: 403 })
  })

  it('devuelve contexto vacío estable sin materializar borrador', async () => {
    const state = setup()
    const result = await state.create().getContext({ identity: state.identity })
    expect(result).toMatchObject({ actorId: 'SYN-SIS-A', academicPeriod: '2027-I', publications: { currentId: null }, draft: null, draftValidation: null })
  })

  it('clasifica la selección vacía y rechaza referencias de curso/sección que no están publicadas', async () => {
    const state = setup()
    await expect(state.create().validate({ identity: state.identity, publicationId: state.publication.id, publicationVersion: 1, selection: [] })).resolves.toMatchObject({ status: 'incomplete', issues: [expect.objectContaining({ code: 'EMPTY_SELECTION' })] })
    await expect(state.create().validate({ identity: state.identity, publicationId: state.publication.id, publicationVersion: 1, selection: [{ courseId: 'bad', sectionId: 'SEC-01' }] })).rejects.toMatchObject({ status: 400 })
    await expect(state.create().validate({ identity: state.identity, publicationId: state.publication.id, publicationVersion: 1, selection: [{ courseId: state.publication.schedule.courses[0]!.courseId, sectionId: 'SEC-WRONG' }] })).rejects.toMatchObject({ status: 400 })
    await expect(state.create().validate({ identity: state.identity, publicationId: state.publication.id, publicationVersion: 1, selection: [{ courseId: 'dup', sectionId: 'A' }, { courseId: 'dup', sectionId: 'B' }] })).rejects.toMatchObject({ status: 400 })
  })

  it('requiere la versión exacta de la publicación sin sustituirla por la vigente', async () => {
    const state = setup()
    await expect(state.create().validate({ identity: state.identity, publicationId: state.publication.id, publicationVersion: 2, selection: [{ courseId: state.publication.schedule.courses[0]!.courseId, sectionId: 'SEC-01' }] })).rejects.toMatchObject({ status: 409 })
  })

  it('mapea publicación inexistente o no publicada a 404', async () => {
    const state = setup()
    await expect(state.create().getPublication({ identity: state.identity, publicationId: state.publication.id.replace(/.$/, '4') })).rejects.toMatchObject({ status: 404 })
    state.saved.getPublication = async () => Promise.reject(new HttpException({ error: { code: 'PUBLICATION_NOT_FOUND', message: 'Not published' } }, 404))
    await expect(state.create().getPublication({ identity: state.identity, publicationId: state.publication.id })).rejects.toMatchObject({ status: 404 })
  })

  it('preserva el error de almacenamiento 503 y el filtro devuelve STORAGE_UNAVAILABLE', async () => {
    const state = setup()
    state.saved.getPublication = async () => Promise.reject(new HttpException({ error: { code: 'STORAGE_UNAVAILABLE', message: 'Storage unavailable' } }, 503))

    let error: unknown
    try {
      await state.create().getPublication({ identity: state.identity, publicationId: state.publication.id })
    } catch (caught) {
      error = caught
    }
    expect(error).toMatchObject({ status: 503 })

    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const host = { switchToHttp: () => ({ getResponse: () => response }) }
    new PrematriculaErrorFilter().catch(error, host as never)
    expect(response.status).toHaveBeenCalledWith(503)
    expect(response.json).toHaveBeenCalledWith({ error: { code: 'STORAGE_UNAVAILABLE', message: 'El almacenamiento local no está disponible' } })
  })

  it('mantiene 409 para una publicación inválida', async () => {
    const state = setup()
    state.saved.getPublication = async () => Promise.reject(new HttpException({ error: { code: 'DRAFT_CORRUPT', message: 'Invalid publication' } }, 409))
    await expect(state.create().getPublication({ identity: state.identity, publicationId: state.publication.id }))
      .rejects.toMatchObject({ status: 409, response: { error: { code: 'PUBLICATION_UNAVAILABLE' } } })
  })

  it('usa las asignaturas SIS publicadas sin convertir sus IDs al código interno SYN', async () => {
    const state = setup()
    const response = await state.create().getPublication({ identity: state.identity, publicationId: state.publication.id })
    const courseId = state.publication.schedule.courses[0]!.courseId
    expect(response.eligibility).toContainEqual({ courseId, issues: [] })
    const result = await state.create().validate({ identity: state.identity, publicationId: state.publication.id, publicationVersion: 1, selection: [{ courseId, sectionId: 'SEC-01' }] })
    expect(result.status).toBe('valid')
  })

  it('marca como no habilitada una asignatura aprobada y como insuficiente una equivalencia desconocida', async () => {
    const state = setup()
    const learner = projectActor(actors[0]!)
    const approved = learner.attempts.find((attempt) => attempt.result === 'approved')!
    state.saved.getPublication = async () => makePublication(actors[0]!, 1, approved.courseCode)
    const approvedPublication = await state.create().getPublication({ identity: state.identity, publicationId: state.publication.id })
    expect(approvedPublication.eligibility[0]?.issues[0]?.code).toBe('COURSE_ALREADY_APPROVED')
    state.saved.getPublication = async () => makePublication(actors[0]!)
    const previous = actors[0]!.equivalencesKnown
    actors[0]!.equivalencesKnown = false
    try {
      const unknown = await state.create().getPublication({ identity: state.identity, publicationId: state.publication.id })
      expect(unknown.eligibility[0]?.issues[0]?.code).toBe('UNKNOWN_EQUIVALENCES')
    } finally {
      actors[0]!.equivalencesKnown = previous
    }
  })

  it('mantiene la regla de equivalencia reconocida del clasificador sintético', () => {
    const learner = projectActor(actors[0]!)
    const course = learner.courses.find((candidate) => classify(learner, candidate.courseCode, false).category === 'eligible')!
    const withKnownRecognition: DemandLearner = { ...learner, equivalencesKnown: true, equivalentCourseCodes: [course.courseCode] }
    expect(classify(withKnownRecognition, course.courseCode, false)).toEqual({ category: 'non-eligible', code: 'COURSE_RECOGNIZED' })
  })

  it('no permite que otra asignatura seleccionada satisfaga un prerrequisito pendiente', async () => {
    const state = setup()
    const learner = projectActor(actors[0]!)
    const unmet = learner.courses.find((course) => {
      const outcome = classify(learner, course.courseCode, false)
      return outcome.category === 'non-eligible' && outcome.code === 'PREREQUISITE_NOT_MET'
    })!
    const prerequisite = unmet.prerequisiteIds[0]!
    const publication = makePublication(actors[0]!, 1, [unmet.courseCode, prerequisite])
    state.saved.getPublication = async () => publication
    const result = await state.create().validate({ identity: state.identity, publicationId: publication.id, publicationVersion: 1,
      selection: [{ courseId: unmet.courseCode, sectionId: 'SEC-01' }, { courseId: prerequisite, sectionId: 'SEC-02' }] })
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'PREREQUISITE_NOT_MET', courseIds: [unmet.courseCode] }))
  })

  it('suma créditos por curso sin imponer topes institucionales y detecta el cruce entre dos cursos', async () => {
    const state = setup()
    const learner = projectActor(actors[0]!)
    const eligible = learner.courses.filter((course) => classify(learner, course.courseCode, false).category === 'eligible').slice(0, 2)
    expect(eligible).toHaveLength(2)
    const noOverlap = makePublication(actors[0]!, 1, eligible.map((course) => course.courseCode), 14)
    state.saved.getPublication = async () => noOverlap
    const selection = noOverlap.schedule.sections.map((section) => ({ courseId: section.courseId, sectionId: section.sectionId }))
    const valid = await state.create().validate({ identity: state.identity, publicationId: noOverlap.id, publicationVersion: 1, selection })
    expect(valid).toMatchObject({ status: 'valid', courseCount: 2, credits: 28 })
    const overlap = makePublication(actors[0]!, 1, eligible.map((course) => course.courseCode), 14, true)
    state.saved.getPublication = async () => overlap
    const crossed = await state.create().validate({ identity: state.identity, publicationId: overlap.id, publicationVersion: 1, selection })
    expect(crossed).toMatchObject({ status: 'unmet', credits: 28 })
    expect(crossed.issues).toContainEqual(expect.objectContaining({ code: 'SCHEDULE_CONFLICT' }))
  })

  it('guarda un borrador parcial con versión inicial y lo recupera tras recrear el servicio', async () => {
    const state = setup()
    const service = state.create()
    const revision = (await service.getContext({ identity: state.identity })).academicRevision
    const before = state.repository.readSnapshot()
    const saved = await service.save(state.request({ expectedAcademicRevision: revision }))
    expect(state.repository.readSnapshot()).toEqual(before)
    expect(saved.draft.version).toBe(1)
    const recovered = await state.create().getContext({ identity: state.identity })
    expect(recovered.draft).toMatchObject({ id: saved.draft.id, version: 1, actorId: 'SYN-SIS-A' })
  })

  it('aísla borradores entre perfiles y bloquea escritura cruzada por ID', async () => {
    const state = setup()
    const service = state.create()
    const revisionA = (await service.getContext({ identity: state.identity })).academicRevision
    const saved = await service.save(state.request({ expectedAcademicRevision: revisionA }))
    const identityB = makeIdentity('SYN-SIS-B')
    const revisionB = (await service.getContext({ identity: identityB })).academicRevision
    expect((await service.getContext({ identity: identityB })).draft).toBeNull()
    await expect(service.save(state.request({ identity: identityB, id: saved.draft.id, expectedVersion: 1, expectedAcademicRevision: revisionB }))).rejects.toMatchObject({ status: 403 })
  })

  it('aplica CAS de versión y de revisión académica antes de sobrescribir', async () => {
    const state = setup()
    const service = state.create()
    const revision = (await service.getContext({ identity: state.identity })).academicRevision
    const first = await service.save(state.request({ expectedAcademicRevision: revision }))
    await expect(service.save(state.request({ id: first.draft.id, expectedVersion: 8, expectedAcademicRevision: revision }))).rejects.toMatchObject({ status: 409 })
    await expect(service.save(state.request({ expectedAcademicRevision: 'f'.repeat(64) }))).rejects.toMatchObject({ status: 409 })
  })

  it('serializa dos guardados CAS concurrentes: uno crea el borrador y el otro recibe conflicto', async () => {
    const state = setup()
    const service = state.create()
    const revision = (await service.getContext({ identity: state.identity })).academicRevision
    const results = await Promise.allSettled([
      service.save(state.request({ expectedAcademicRevision: revision })),
      service.save(state.request({ expectedAcademicRevision: revision })),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: { status: 409 } })
  })

  it('revalida la sesión tras una espera de publicación y no crea archivo si caduca mientras espera', async () => {
    const state = setup()
    const service = state.create()
    const revision = (await service.getContext({ identity: state.identity })).academicRevision
    let release: ((publication: AcademicPublication) => void) | undefined
    state.saved.getPublication = () => new Promise((resolvePublication) => { release = resolvePublication })
    const saving = service.save(state.request({ expectedAcademicRevision: revision }))
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    state.setSessionActive(false)
    release!(state.publication)
    await expect(saving).rejects.toMatchObject({ status: 404 })
    expect(readdirSync(join(state.directory, 'e2-prematricula'))).toEqual([])
  })

  it('recalcula y avisa si cambia el contexto sin escribir el borrador guardado', async () => {
    const state = setup()
    const service = state.create()
    const revision = (await service.getContext({ identity: state.identity })).academicRevision
    const saved = await service.save(state.request({ expectedAcademicRevision: revision }))
    const originalAttempts = structuredClone(actors[0]!.academic!.attempts)
    try {
      actors[0]!.academic!.attempts.push({ courseId: actors[0]!.academic!.catalog[0]!.courseId, period: '2026-1', sectionNumber: 1, grade: 10, result: 'failed', recordId: 'synthetic-new-attempt' })
      const result = await state.create().getContext({ identity: state.identity })
      expect(result.draftValidation?.issues).toContainEqual(expect.objectContaining({ code: 'ACADEMIC_CONTEXT_CHANGED', kind: 'insufficient' }))
      expect(result.draft?.version).toBe(saved.draft.version)
    } finally {
      actors[0]!.academic!.attempts = originalAttempts
    }
  })
})

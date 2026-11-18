import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import supertest from 'supertest'
import type { INestApplication } from '@nestjs/common'
import type { AcademicPublication } from '../../shared/programacion-academica-api.d.mts'
import type { OperationalOffer } from '../../shared/enrollment-offer.mjs'
import { validateMatriculaWire } from '../../shared/matricula-wire.mjs'
import { validateContextResponse, validateEnrollmentReportResponse } from '../../shared/matricula-regular.mjs'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import { SavedDraftStore } from '../src/programacion-academica/saved-draft-store.js'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'
import { OperationalOfferModule } from '../src/matricula-regular/operational-offer.module.js'
import { createOperationalRun, E3_CLOCK_BASE } from '../src/matricula-regular/operational-offer.factory.js'
import type { OperationalRunDocument } from '../src/matricula-regular/operational-run-store.js'
import { PrematriculaModule } from '../src/prematricula/prematricula.module.js'
import { LocalProfileDashboardModule } from '../src/local-profile-dashboard/local-profile-dashboard.module.js'
import { LocalScenariosService } from '../src/local-profile-dashboard/local-scenarios.service.js'
import { projectScenarioProgramming } from '../src/local-profile-dashboard/scenario-reference-projection.js'
import { buildBuiltInEnrollmentScenarioBundles } from '../src/matricula-regular/enrollment-scenarios.js'
import type { RunSnapshot } from '../src/matricula-regular/store.types.js'

const catalog = createDemoCatalog()
const e1 = '/local/programacion-academica/v1'
const e3 = '/local/matricula-regular/v1'
const perfiles = '/local/perfiles/v1'
const actorA = 'SYN-SIS-A'
const actorB = 'SYN-SIS-B'
const tpDays = [1, 2, 3].map((day) => ({ day, startMinute: 480, endMinute: 1200 }))
const labDays = [4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1200 }))
const enrollmentCourseCodes = ['20118091', '20118094', '20118095', '20118097']
const publishedCourseCodes = ['20118031', ...enrollmentCourseCodes, '20118084', '20118087']

type MeetingWithOptionalDetails = {
  day: number
  startMinute: number
  endMinute: number
  details?: {
    sessionId: string
    teacherId: string
    teacherName: string
    roomId: string
    roomName: string
    sessionType?: 'T' | 'P' | 'L'
  }
}

function toSnapshot(state: ReturnType<typeof createOperationalRun>): RunSnapshot {
  return {
    ...state,
    requests: [...state.requests.entries()],
    enrollments: [...state.enrollments.entries()],
    reports: [...state.reports.entries()],
  }
}

describe('operational session details preservation (MR-SESSION-DETAILS-1)', () => {
  const directories: string[] = []
  let app: INestApplication
  let directory: string

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'sum-session-details-'))
    directories.push(directory)
    vi.stubEnv('SUM_ACADEMIC_DRAFT_DIR', directory)
    vi.stubEnv('SUM_ACADEMIC_SCHEDULING', '1')
    vi.stubEnv('SUM_LOCAL_SCENARIOS', '1')
    vi.stubEnv('SIMULATOR_DEPLOYMENT', 'local')
    vi.stubEnv('SIMULATOR_STORAGE', 'memory')
    vi.stubEnv('MATRICULA_SNAPSHOT_DIR', undefined)
    app = await startApp()
  })

  afterEach(async () => {
    await app?.close()
    for (const target of directories.splice(0)) {
      const absolute = resolve(target)
      const temporaryRoot = resolve(tmpdir()) + sep
      if (!absolute.toLowerCase().startsWith(temporaryRoot.toLowerCase())
        || !basename(absolute).startsWith('sum-session-details-')) {
        throw new Error('Unsafe synthetic session-details test cleanup target')
      }
      rmSync(absolute, { recursive: true, force: true })
    }
    vi.unstubAllEnvs()
  })

  async function startApp(): Promise<INestApplication> {
    const module = await Test.createTestingModule({
      imports: [OperationalOfferModule, PrematriculaModule, LocalProfileDashboardModule],
    }).compile()
    const instance = module.createNestApplication({ logger: false })
    await instance.init()
    instance.get(LocalScenariosService).configure(buildBuiltInEnrollmentScenarioBundles())
    return instance
  }

  async function publishSplitTeachers(options: {
    teacherAName?: string
    teacherBName?: string
    roomAName?: string
    roomBName?: string
    codes?: string[]
  } = {}): Promise<AcademicPublication> {
    const codes = options.codes ?? publishedCourseCodes
    const selected = codes.map((code) => catalog.courses.find((course) => course.courseId === code))
    expect(selected.every(Boolean)).toBe(true)
    const courses = selected as NonNullable<typeof selected[number]>[]
    const totalLabMinutes = courses.reduce(
      (sum, course) => sum + course.planningPatterns![0]!.weeklySessions
        .filter((s) => s.type === 'L')
        .reduce((inner, s) => inner + s.durationMinutes, 0),
      0,
    )
    const request = {
      revision: catalog.revision,
      planningPolicy: { revision: 'FISI-PLANNING-1', period: '2027-I', allowAfternoon: true, allowSaturday: false },
      demands: courses.map((course) => ({
        courseId: course.courseId,
        estimatedDemand: 25,
        targetCapacity: 35,
        deliveryMode: course.planningPatterns![0]!.weeklySessions.reduce((sum, s) => sum + s.durationMinutes, 0) > 240 ? 'split' : 'continuous',
        teacherAssignmentMode: 'tp-grouped-l-independent' as const,
        patternId: course.planningPatterns![0]!.id,
      })),
      resources: {
        teachers: [
          {
            id: 'DOC-SYN-A',
            name: options.teacherAName ?? 'Docente Teoría Práctica Uno',
            courseIds: codes,
            maxWeeklyMinutes: 2400,
            availability: tpDays,
            facultyId: 'FISI',
            category: 'principal',
            qualificationSource: 'synthetic',
          },
          {
            id: 'DOC-SYN-B',
            name: options.teacherBName ?? 'Docente Laboratorio Dos',
            courseIds: codes,
            maxWeeklyMinutes: totalLabMinutes,
            availability: labDays,
            facultyId: 'FISI',
            category: 'asociado',
            qualificationSource: 'synthetic',
          },
        ],
        rooms: [
          {
            id: 'AULA-SYN-A',
            name: options.roomAName ?? 'Aula 101 AP',
            kind: 'classroom',
            capacity: 45,
            availability: tpDays,
          },
          {
            id: 'LAB-SYN-B',
            name: options.roomBName ?? 'Lab 202 AP',
            kind: 'laboratory',
            capacity: 45,
            availability: labDays,
          },
        ],
      },
    }

    const proposal = (await supertest(app.getHttpServer()).post(`${e1}/propuestas`).send(request).expect(200)).body
    expect(proposal).toMatchObject({ status: 'complete', coverageComplete: true })
    const configuration = {
      schoolId: 'SISTEMAS',
      academicPeriod: '2027-I',
      demandSourceId: 'existing-regular-v1',
      demandBaseRequest: null,
      request,
    }
    let draft = (await supertest(app.getHttpServer()).post(`${e1}/borradores/guardar`).send({
      id: null,
      expectedVersion: null,
      title: 'Publicación con docentes separados T/P y L',
      state: 'draft',
      configuration,
      proposalId: proposal.proposalId,
      proposalEditVersion: proposal.editVersion,
    }).expect(200)).body
    draft = (await supertest(app.getHttpServer()).post(`${e1}/borradores/${draft.id}/revision/enviar`)
      .send({ expectedVersion: draft.version }).expect(200)).body.draft
    for (const teacher of draft.review.teachers) {
      draft = (await supertest(app.getHttpServer()).post(`${e1}/borradores/${draft.id}/revision/responder`).send({
        expectedVersion: draft.version,
        round: draft.review.round,
        teacherId: teacher.teacherId,
        decision: 'conformity',
        observation: '',
      }).expect(200)).body.draft
    }
    draft = (await supertest(app.getHttpServer()).post(`${e1}/borradores/${draft.id}/aprobar`)
      .send({ expectedVersion: draft.version }).expect(200)).body.draft
    const history = (await supertest(app.getHttpServer()).get(`${e1}/publicaciones`).expect(200)).body
    draft = (await supertest(app.getHttpServer()).post(`${e1}/borradores/${draft.id}/publicar`)
      .send({ expectedVersion: draft.version, expectedCurrentId: history.currentId }).expect(200)).body.draft
    return (await supertest(app.getHttpServer()).get(`${e1}/publicaciones/${draft.id}`).expect(200)).body
  }

  async function activate(publication: AcademicPublication) {
    const current = (await supertest(app.getHttpServer()).get(`${e3}/ofertas`).expect(200)).body
    return (await supertest(app.getHttpServer()).post(`${e3}/ofertas/activar`).send({
      publicationId: publication.id,
      publicationVersion: publication.publicationVersion,
      expectedActiveRunId: current.activeRunId,
    }).expect(200)).body.offer as OperationalOffer
  }

  it('preserves T/P vs L teacher and room details from E1 publication through offer, accepted report, dashboard projection, and restart', async () => {
    const publication = await publishSplitTeachers()

    // Sanity-check E1 publication itself assigned DOC-SYN-A to T/P in AULA-SYN-A and DOC-SYN-B to L in LAB-SYN-B
    const pubTplAssignments = publication.schedule.assignments.filter((a) => a.courseId === '20118031')
    expect(pubTplAssignments).toHaveLength(3)
    expect(pubTplAssignments.filter((a) => a.sessionType === 'T' || a.sessionType === 'P').every((a) =>
      a.teacherId === 'DOC-SYN-A' && a.roomId === 'AULA-SYN-A')).toBe(true)
    expect(pubTplAssignments.find((a) => a.sessionType === 'L')).toMatchObject({
      teacherId: 'DOC-SYN-B',
      roomId: 'LAB-SYN-B',
      sessionType: 'L',
    })

    const offer = await activate(publication)
    const runId = offer.runId

    const contextBody = (await supertest(app.getHttpServer()).get(`${e3}/contextos/${actorA}`).query({ runId }).expect(200)).body
    validateContextResponse(contextBody, runId, actorA)

    const snapshotBefore = app.get(MatriculaRegularRepository).readSnapshot(runId)
    const codeMap = snapshotBefore.actors.find((actor) => actor.actorId === actorA)!.scenarioData!.courseCodes
    const reverseCodeMap = new Map(Object.entries(codeMap).map(([courseId, cod]) => [cod, courseId]))

    // Verify 20118031 (T + P + L) section preserves all 3 meetings with exact details and multi-teacher/room summary
    const tplOfferCourse = contextBody.data.offer.find((c: { courseId: string }) => c.courseId === reverseCodeMap.get('20118031'))
    expect(tplOfferCourse).toBeDefined()
    const tplSection = tplOfferCourse.sections[0]
    expect(tplSection.schedule).toHaveLength(3)
    expect(tplSection.teacher).toContain('Docente Teoría Práctica Uno')
    expect(tplSection.teacher).toContain('Docente Laboratorio Dos')
    expect(tplSection.room).toContain('Aula 101 AP')
    expect(tplSection.room).toContain('Lab 202 AP')

    const tplDetails = (tplSection.schedule as MeetingWithOptionalDetails[]).map((m) => m.details)
    expect(tplDetails.every(Boolean)).toBe(true)
    const tplByType = new Map(tplDetails.map((d) => [d!.sessionType, d!]))
    expect(tplByType.get('T')).toMatchObject({
      teacherId: 'DOC-SYN-A',
      teacherName: 'Docente Teoría Práctica Uno',
      roomId: 'AULA-SYN-A',
      roomName: 'Aula 101 AP',
      sessionType: 'T',
    })
    expect(tplByType.get('P')).toMatchObject({
      teacherId: 'DOC-SYN-A',
      teacherName: 'Docente Teoría Práctica Uno',
      roomId: 'AULA-SYN-A',
      roomName: 'Aula 101 AP',
      sessionType: 'P',
    })
    expect(tplByType.get('L')).toMatchObject({
      teacherId: 'DOC-SYN-B',
      teacherName: 'Docente Laboratorio Dos',
      roomId: 'LAB-SYN-B',
      roomName: 'Lab 202 AP',
      sessionType: 'L',
    })

    // Enroll SYN-SIS-A in 4 pre-enrollment courses (12 credits total) including T+L and T+P courses
    const session = (await supertest(app.getHttpServer()).post(`${e3}/sesiones`).send({ runId, actorId: actorA }).expect(200)).body.data
    const enrollTargetIds = new Set(enrollmentCourseCodes.map((code) => reverseCodeMap.get(code)!))
    const selection = contextBody.data.offer
      .filter((c: { courseId: string }) => enrollTargetIds.has(c.courseId))
      .map((c: { courseId: string; sections: Array<{ sectionId: string }> }) => ({
        courseId: c.courseId,
        sectionId: c.sections[0]!.sectionId,
      }))
    expect(selection).toHaveLength(4)

    const outcome = (await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send({
      runId,
      actorId: actorA,
      sessionId: session.sessionId,
      requestId: randomUUID(),
      profileRevision: contextBody.data.profileRevision,
      selection,
    }).expect(200)).body.data
    expect(outcome.state).toBe('accepted')
    const enrollmentId = outcome.enrollmentId as string

    const assertPersistedState = async (sessionId: string) => {
      const reportBody = (await supertest(app.getHttpServer()).get(`${e3}/reportes/${enrollmentId}`)
        .query({ runId, actorId: actorA }).expect(200)).body
      validateEnrollmentReportResponse(reportBody, { runId, actorId: actorA, enrollmentId })

      const row91 = reportBody.data.rows.find((r: { courseId: string }) => r.courseId === reverseCodeMap.get('20118091'))
      expect(row91).toBeDefined()
      expect(row91.teacher).toContain('Docente Teoría Práctica Uno')
      expect(row91.teacher).toContain('Docente Laboratorio Dos')
      expect(row91.schedule).toHaveLength(2)
      const r91Details = (row91.schedule as MeetingWithOptionalDetails[]).map((m) => m.details!)
      expect(r91Details.find((d) => d.sessionType === 'T')).toMatchObject({
        teacherId: 'DOC-SYN-A',
        teacherName: 'Docente Teoría Práctica Uno',
        roomId: 'AULA-SYN-A',
        roomName: 'Aula 101 AP',
        sessionType: 'T',
      })
      expect(r91Details.find((d) => d.sessionType === 'L')).toMatchObject({
        teacherId: 'DOC-SYN-B',
        teacherName: 'Docente Laboratorio Dos',
        roomId: 'LAB-SYN-B',
        roomName: 'Lab 202 AP',
        sessionType: 'L',
      })

      // Dashboard programacion projection
      const progRes = (await supertest(app.getHttpServer()).get(`${perfiles}/consultas/programacion`)
        .query({ runId, actorId: actorA, sessionId }).expect(200)).body
      const envelope = progRes.data.payload
      expect(() => validateMatriculaWire('programacion', envelope)).not.toThrow()

      const tplProg = envelope.data.programacion.find((row: { codAsignatura: string }) => row.codAsignatura === '20118031')
      expect(tplProg).toBeDefined()
      expect(tplProg.apePatDocente).toBe('')
      expect(tplProg.apeMatDocente).toBe('')
      expect(tplProg.nomDocente).toContain('Docente Teoría Práctica Uno')
      expect(tplProg.nomDocente).toContain('Docente Laboratorio Dos')
      expect(tplProg.horarios).toHaveLength(3)
      const tSlot = tplProg.horarios.find((h: { codTipoHoraAsignatura: string }) => h.codTipoHoraAsignatura === 'T')
      const pSlot = tplProg.horarios.find((h: { codTipoHoraAsignatura: string }) => h.codTipoHoraAsignatura === 'P')
      const lSlot = tplProg.horarios.find((h: { codTipoHoraAsignatura: string }) => h.codTipoHoraAsignatura === 'L')
      expect(tSlot).toMatchObject({
        codDocente: 'DOC-SYN-A',
        nomDocente: 'Docente Teoría Práctica Uno',
        codAula: 'Aula 101 AP',
        codTipoHoraAsignatura: 'T',
        desTipoHoraAsignatura: 'Teoría',
      })
      expect(pSlot).toMatchObject({
        codDocente: 'DOC-SYN-A',
        nomDocente: 'Docente Teoría Práctica Uno',
        codAula: 'Aula 101 AP',
        codTipoHoraAsignatura: 'P',
        desTipoHoraAsignatura: 'Práctica',
      })
      expect(lSlot).toMatchObject({
        codDocente: 'DOC-SYN-B',
        nomDocente: 'Docente Laboratorio Dos',
        codAula: 'Lab 202 AP',
        codTipoHoraAsignatura: 'L',
        desTipoHoraAsignatura: 'Laboratorio',
      })

      const prog91 = envelope.data.programacion.find((row: { codAsignatura: string }) => row.codAsignatura === '20118091')
      expect(prog91.matriculados).toBe(1)

      // Dashboard matricula & horarios endpoints preserve report schedule details
      for (const key of ['matricula', 'horarios'] as const) {
        const dash = (await supertest(app.getHttpServer()).get(`${perfiles}/consultas/${key}`)
          .query({ runId, actorId: actorA, sessionId }).expect(200)).body
        expect(dash.data.payload).toEqual(reportBody.data)
      }
    }

    await assertPersistedState(session.sessionId)

    // Restart and re-verify persisted offer, report, and dashboard projections
    await app.close()
    app = await startApp()
    const restartedSession = (await supertest(app.getHttpServer()).post(`${e3}/sesiones`).send({ runId, actorId: actorA }).expect(200)).body.data
    await assertPersistedState(restartedSession.sessionId)
  }, 30000)

  it('does not deduplicate identical time slots, preserves omitted sessionType without seed fabrication, and orders summaries deterministically', () => {
    const pubId = randomUUID()
    const basePublication = (reverseOrder: boolean): AcademicPublication => {
      const assignments: AcademicPublication['schedule']['assignments'] = [
        // 20118031: T+P with DOC-A in Aula 101, L with DOC-B in Lab 202
        {
          sessionId: 'S-T-1',
          sectionId: 'SEC-31',
          courseId: '20118031',
          courseName: 'ANALISIS Y DISENO DE SISTEMAS DE INFORMACION',
          teacherId: 'DOC-A',
          teacherName: 'Docente Alfa',
          roomId: 'R-A',
          roomName: 'Aula 101',
          day: 5,
          startMinute: 480,
          endMinute: 600,
          sessionType: 'T',
        },
        {
          sessionId: 'S-P-2',
          sectionId: 'SEC-31',
          courseId: '20118031',
          courseName: 'ANALISIS Y DISENO DE SISTEMAS DE INFORMACION',
          teacherId: 'DOC-A',
          teacherName: 'Docente Alfa',
          roomId: 'R-A',
          roomName: 'Aula 101',
          day: 5,
          startMinute: 600,
          endMinute: 720,
          sessionType: 'P',
        },
        {
          sessionId: 'S-L-3',
          sectionId: 'SEC-31',
          courseId: '20118031',
          courseName: 'ANALISIS Y DISENO DE SISTEMAS DE INFORMACION',
          teacherId: 'DOC-B',
          teacherName: 'Docente Beta',
          roomId: 'R-B',
          roomName: 'Lab 202',
          day: 4,
          startMinute: 600,
          endMinute: 720,
          sessionType: 'L',
        },
        // 20118091: two sessions sharing identical day/startMinute/endMinute without sessionType
        {
          sessionId: 'DUP-SLOT-1',
          sectionId: 'SEC-91',
          courseId: '20118091',
          courseName: 'DESARROLLO DE PROYECTOS DE TESIS I',
          teacherId: 'DOC-X',
          teacherName: 'Docente Equis',
          roomId: 'R-X',
          roomName: 'Aula X',
          day: 2,
          startMinute: 600,
          endMinute: 720,
        },
        {
          sessionId: 'DUP-SLOT-2',
          sectionId: 'SEC-91',
          courseId: '20118091',
          courseName: 'DESARROLLO DE PROYECTOS DE TESIS I',
          teacherId: 'DOC-Y',
          teacherName: 'Docente Ye',
          roomId: 'R-Y',
          roomName: 'Aula Y',
          day: 2,
          startMinute: 600,
          endMinute: 720,
        },
      ]
      return {
        revision: 'PA-PUBLICATION-1',
        id: pubId,
        publicationVersion: 1,
        title: 'Publicación directa sintética',
        sourceProposalVersion: 1,
        approvedVersion: 1,
        approvedAt: '2027-02-20T10:00:00.000Z',
        publishedAt: '2027-02-21T10:00:00.000Z',
        schedule: {
          schoolId: 'SISTEMAS',
          academicPeriod: '2027-I',
          courses: [
            { courseId: '20118031', name: 'ANALISIS Y DISENO DE SISTEMAS DE INFORMACION', cycle: 3, credits: 4 },
            { courseId: '20118091', name: 'DESARROLLO DE PROYECTOS DE TESIS I', cycle: 9, credits: 2 },
          ],
          sections: [
            { sectionId: 'SEC-31', courseId: '20118031', courseName: 'ANALISIS Y DISENO DE SISTEMAS DE INFORMACION', capacity: 30 },
            { sectionId: 'SEC-91', courseId: '20118091', courseName: 'DESARROLLO DE PROYECTOS DE TESIS I', capacity: 30 },
          ],
          assignments: reverseOrder ? [...assignments].reverse() : assignments,
        },
      }
    }

    const offer: OperationalOffer = {
      runId: randomUUID(),
      publicationId: pubId,
      publicationVersion: 1,
      offerVersion: 1,
      academicPeriod: '2027-I',
      schoolId: 'SISTEMAS',
      planId: 'SYN-SIS-PLAN',
      activatedAt: '2027-02-22T10:00:00.000Z',
      clockBase: E3_CLOCK_BASE,
      courseCount: 2,
      sectionCount: 2,
    }

    const stateA = createOperationalRun(basePublication(false), offer)
    const stateB = createOperationalRun(basePublication(true), offer)
    expect(stateA.offer).toEqual(stateB.offer)

    const course91 = stateA.offer.find((c) => c.courseId === 'SYN-SIS-C09')!
    const sec91 = course91.sections[0]!
    expect(sec91.schedule).toHaveLength(2)
    expect(sec91.teacher).toBe('Docente Equis / Docente Ye')
    expect(sec91.room).toBe('Aula X / Aula Y')
    const sec91Schedule = sec91.schedule as MeetingWithOptionalDetails[]
    expect(sec91Schedule.map((m) => m.details?.sessionId)).toEqual(['DUP-SLOT-1', 'DUP-SLOT-2'])
    expect(Object.hasOwn(sec91Schedule[0]!.details!, 'sessionType')).toBe(false)
    expect(Object.hasOwn(sec91Schedule[1]!.details!, 'sessionType')).toBe(false)

    const actor = stateA.actors.find((a) => a.actorId === actorA)!
    const envelope = projectScenarioProgramming(actor, toSnapshot(stateA))
    expect(() => validateMatriculaWire('programacion', envelope)).not.toThrow()
    const row91 = envelope.data.programacion.find((r) => r.codAsignatura === '20118091')!
    expect(row91.horarios).toHaveLength(2)
    expect(row91.horarios[0]).toMatchObject({
      codDocente: 'DOC-X',
      nomDocente: 'Docente Equis',
      codAula: 'Aula X',
      codTipoHoraAsignatura: '--',
      desTipoHoraAsignatura: '--',
    })
    expect(row91.horarios[1]).toMatchObject({
      codDocente: 'DOC-Y',
      nomDocente: 'Docente Ye',
      codAula: 'Aula Y',
      codTipoHoraAsignatura: '--',
      desTipoHoraAsignatura: '--',
    })
  })

  it('keeps previously accepted reports immutable across subsequent publications and isolates actors and offers', async () => {
    const pub1 = await publishSplitTeachers({
      teacherAName: 'Docente Original A',
      teacherBName: 'Docente Original B',
      roomAName: 'Aula Orig 1',
      roomBName: 'Lab Orig 2',
    })
    const offer1 = await activate(pub1)
    const ctx1 = (await supertest(app.getHttpServer()).get(`${e3}/contextos/${actorA}`).query({ runId: offer1.runId }).expect(200)).body.data
    const ses1 = (await supertest(app.getHttpServer()).post(`${e3}/sesiones`).send({ runId: offer1.runId, actorId: actorA }).expect(200)).body.data
    const snapshot1 = app.get(MatriculaRegularRepository).readSnapshot(offer1.runId)
    const codeMap1 = snapshot1.actors.find((a) => a.actorId === actorA)!.scenarioData!.courseCodes
    const reverse1 = new Map(Object.entries(codeMap1).map(([k, v]) => [v, k]))
    const selection1 = enrollmentCourseCodes.map((code) => {
      const courseId = reverse1.get(code)!
      const course = ctx1.offer.find((c: { courseId: string }) => c.courseId === courseId)!
      return { courseId, sectionId: course.sections[0].sectionId }
    })

    const out1 = (await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send({
      runId: offer1.runId,
      actorId: actorA,
      sessionId: ses1.sessionId,
      requestId: randomUUID(),
      profileRevision: ctx1.profileRevision,
      selection: selection1,
    }).expect(200)).body.data
    expect(out1.state).toBe('accepted')

    const reportBefore = (await supertest(app.getHttpServer()).get(`${e3}/reportes/${out1.enrollmentId}`)
      .query({ runId: offer1.runId, actorId: actorA }).expect(200)).body.data

    // Publish and activate second offer with completely different teachers and rooms
    const pub2 = await publishSplitTeachers({
      teacherAName: 'Docente Nuevo A',
      teacherBName: 'Docente Nuevo B',
      roomAName: 'Aula Nueva 3',
      roomBName: 'Lab Nuevo 4',
    })
    const offer2 = await activate(pub2)
    expect(offer2.runId).not.toBe(offer1.runId)

    // Accepted report in offer1 remains unchanged
    const reportAfter = (await supertest(app.getHttpServer()).get(`${e3}/reportes/${out1.enrollmentId}`)
      .query({ runId: offer1.runId, actorId: actorA }).expect(200)).body.data
    expect(reportAfter).toEqual(reportBefore)
    const row91After = reportAfter.rows.find((r: { courseId: string }) => r.courseId === reverse1.get('20118091'))
    expect((row91After.schedule as MeetingWithOptionalDetails[])[0]!.details!.teacherName).toContain('Docente Original')

    // Actor and offer isolation
    await supertest(app.getHttpServer()).get(`${e3}/reportes/${out1.enrollmentId}`)
      .query({ runId: offer1.runId, actorId: actorB }).expect(404)
    await supertest(app.getHttpServer()).get(`${e3}/reportes/${out1.enrollmentId}`)
      .query({ runId: offer2.runId, actorId: actorA }).expect(404)

    // SYN-SIS-B enrolls in offer2 and gets the new metadata
    const ctx2B = (await supertest(app.getHttpServer()).get(`${e3}/contextos/${actorB}`).query({ runId: offer2.runId }).expect(200)).body.data
    const ses2B = (await supertest(app.getHttpServer()).post(`${e3}/sesiones`).send({ runId: offer2.runId, actorId: actorB }).expect(200)).body.data
    const sel2B = ['20118084', '20118087', '20118091', '20118094'].map((code) => {
      const courseId = reverse1.get(code)!
      const course = ctx2B.offer.find((c: { courseId: string }) => c.courseId === courseId)!
      return { courseId, sectionId: course.sections[0].sectionId }
    })
    const out2B = (await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send({
      runId: offer2.runId,
      actorId: actorB,
      sessionId: ses2B.sessionId,
      requestId: randomUUID(),
      profileRevision: ctx2B.profileRevision,
      selection: sel2B,
    }).expect(200)).body.data
    expect(out2B.state).toBe('accepted')
    const report2B = (await supertest(app.getHttpServer()).get(`${e3}/reportes/${out2B.enrollmentId}`)
      .query({ runId: offer2.runId, actorId: actorB }).expect(200)).body.data
    const row84 = report2B.rows.find((r: { courseId: string }) => r.courseId === reverse1.get('20118084'))
    expect((row84.schedule as MeetingWithOptionalDetails[]).some((m) => m.details?.teacherName === 'Docente Nuevo A')).toBe(true)
    expect((row84.schedule as MeetingWithOptionalDetails[]).some((m) => m.details?.teacherName === 'Docente Nuevo B')).toBe(true)
  }, 30000)

  it('accepts legacy persisted snapshots without details and fails closed on corrupted persisted details without resetting disk', async () => {
    const pub = await publishSplitTeachers()
    const offer = await activate(pub)
    const runId = offer.runId
    const ctx = (await supertest(app.getHttpServer()).get(`${e3}/contextos/${actorA}`).query({ runId }).expect(200)).body.data
    const ses = (await supertest(app.getHttpServer()).post(`${e3}/sesiones`).send({ runId, actorId: actorA }).expect(200)).body.data
    const selection = ctx.offer
      .filter((c: { cycle?: number }) => c.cycle === 9)
      .map((c: { courseId: string; sections: Array<{ sectionId: string }> }) => ({ courseId: c.courseId, sectionId: c.sections[0]!.sectionId }))
    const out = (await supertest(app.getHttpServer()).post(`${e3}/solicitudes`).send({
      runId,
      actorId: actorA,
      sessionId: ses.sessionId,
      requestId: randomUUID(),
      profileRevision: ctx.profileRevision,
      selection,
    }).expect(200)).body.data
    expect(out.state).toBe('accepted')
    const enrollmentId = out.enrollmentId as string

    await app.close()
    const store = new SavedDraftStore<OperationalRunDocument>(join(directory, 'e3-ofertas'))
    const doc = store.read(runId)
    expect(doc).not.toBeNull()

    // Case 1: Legacy operational document without meeting details stays valid
    const legacyDoc = structuredClone(doc!)
    for (const course of legacyDoc.snapshot.offer) {
      for (const section of course.sections) {
        for (const m of (section.schedule ?? []) as MeetingWithOptionalDetails[]) {
          delete m.details
        }
      }
    }
    for (const [, report] of legacyDoc.snapshot.reports) {
      for (const row of report.rows) {
        for (const m of row.schedule as MeetingWithOptionalDetails[]) {
          delete m.details
        }
      }
    }
    store.write(runId, legacyDoc)
    app = await startApp()
    const legacyContext = (await supertest(app.getHttpServer()).get(`${e3}/contextos/${actorA}`).query({ runId }).expect(200)).body
    validateContextResponse(legacyContext, runId, actorA)
    const legacyReport = (await supertest(app.getHttpServer()).get(`${e3}/reportes/${enrollmentId}`)
      .query({ runId, actorId: actorA }).expect(200)).body
    validateEnrollmentReportResponse(legacyReport, { runId, actorId: actorA, enrollmentId })
    const legacySession = (await supertest(app.getHttpServer()).post(`${e3}/sesiones`).send({ runId, actorId: actorA }).expect(200)).body.data
    const legacyProg = (await supertest(app.getHttpServer()).get(`${perfiles}/consultas/programacion`)
      .query({ runId, actorId: actorA, sessionId: legacySession.sessionId }).expect(200)).body.data.payload
    expect(() => validateMatriculaWire('programacion', legacyProg)).not.toThrow()
    expect(legacyProg.data.programacion[0].horarios[0].codTipoHoraAsignatura).toBe('--')

    // Case 2: Corrupted persisted details (invalid sessionType in report) triggers 409 DRAFT_CORRUPT without file reset
    await app.close()
    const corruptDoc = structuredClone(doc!)
    const firstReportMeeting = corruptDoc.snapshot.reports[0]![1].rows[0]!.schedule[0] as MeetingWithOptionalDetails
    firstReportMeeting.details = {
      sessionId: 's-1',
      teacherId: 't-1',
      teacherName: 'Docente',
      roomId: 'r-1',
      roomName: 'Aula',
      sessionType: 'Z' as unknown as 'T',
    }
    store.write(runId, corruptDoc)
    const filePath = join(directory, 'e3-ofertas', `${runId}.json`)
    const bytesBefore = readFileSync(filePath, 'utf8')
    app = await startApp()
    const corruptOffers = await supertest(app.getHttpServer()).get(`${e3}/ofertas`).expect(409)
    expect(corruptOffers.body.error.code).toBe('DRAFT_CORRUPT')
    expect(readFileSync(filePath, 'utf8')).toBe(bytesBefore)

    // Case 3: Partial persisted offer details (missing teacherName) triggers 409 DRAFT_CORRUPT without file reset
    await app.close()
    const partialDoc = structuredClone(doc!)
    const offerMeeting = partialDoc.snapshot.offer[0]!.sections[0]!.schedule![0] as unknown as {
      details?: Record<string, unknown>
    }
    delete offerMeeting.details!.teacherName
    store.write(runId, partialDoc)
    const partialBytes = readFileSync(filePath, 'utf8')
    app = await startApp()
    const partialOffers = await supertest(app.getHttpServer()).get(`${e3}/ofertas`).expect(409)
    expect(partialOffers.body.error.code).toBe('DRAFT_CORRUPT')
    expect(readFileSync(filePath, 'utf8')).toBe(partialBytes)
  }, 30000)
})

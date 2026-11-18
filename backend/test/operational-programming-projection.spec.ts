import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import type { AcademicPublication } from '../../shared/programacion-academica-api.d.mts'
import type { OperationalOffer } from '../../shared/enrollment-offer.mjs'
import { validateMatriculaWire } from '../../shared/matricula-wire.mjs'
import { LocalProfileDashboardModule } from '../src/local-profile-dashboard/local-profile-dashboard.module.js'
import { LocalProfileDashboardService } from '../src/local-profile-dashboard/local-profile-dashboard.service.js'
import { projectScenarioProgramming } from '../src/local-profile-dashboard/scenario-reference-projection.js'
import { createDemoCatalog } from '../src/programacion-academica/demo-catalog.js'
import { buildBuiltInEnrollmentScenarioBundles } from '../src/matricula-regular/enrollment-scenarios.js'
import { MATRICULA_REGULAR_CLOCK } from '../src/matricula-regular/matricula-regular.module.js'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'
import { MatriculaRegularService } from '../src/matricula-regular/matricula-regular.service.js'
import { createOperationalRun, E3_CLOCK_BASE } from '../src/matricula-regular/operational-offer.factory.js'
import type { OperationalRunDocument, OperationalRunStore } from '../src/matricula-regular/operational-run-store.js'
import type { RunSnapshot, RunState } from '../src/matricula-regular/store.types.js'
import { SessionService } from '../src/matricula-regular/session.service.js'

const catalog = createDemoCatalog()

type CourseSeed = {
  courseId: string
  sections: Array<{
    capacity: number
    teacherName: string
    roomName: string
    meetings: Array<{ day: number; startMinute: number; endMinute: number; sessionType?: string }>
  }>
}

function buildSyntheticPublication(courseSeeds: CourseSeed[], version = 1): AcademicPublication {
  const courses = courseSeeds.map((seed) => {
    const entry = catalog.courses.find((course) => course.courseId === seed.courseId)
    if (!entry) throw new Error(`Curso sintético no encontrado: ${seed.courseId}`)
    return {
      courseId: entry.courseId,
      name: entry.name,
      cycle: entry.cycle ?? 0,
      credits: entry.credits,
    }
  })

  const sections: AcademicPublication['schedule']['sections'] = []
  const assignments: AcademicPublication['schedule']['assignments'] = []

  for (const seed of courseSeeds) {
    const course = courses.find((item) => item.courseId === seed.courseId)!
    seed.sections.forEach((sectionSpec, sectionIndex) => {
      const sectionId = `${seed.courseId}-SEC-${sectionIndex + 1}`
      sections.push({
        sectionId,
        courseId: seed.courseId,
        courseName: course.name,
        capacity: sectionSpec.capacity,
      })
      sectionSpec.meetings.forEach((meeting, meetingIndex) => {
        assignments.push({
          sessionId: `${sectionId}-S-${meetingIndex + 1}`,
          sectionId,
          courseId: seed.courseId,
          courseName: course.name,
          teacherId: `T-${seed.courseId}-${sectionIndex + 1}`,
          teacherName: sectionSpec.teacherName,
          roomId: `R-${seed.courseId}-${sectionIndex + 1}`,
          roomName: sectionSpec.roomName,
          day: meeting.day,
          startMinute: meeting.startMinute,
          endMinute: meeting.endMinute,
          ...(meeting.sessionType ? { sessionType: meeting.sessionType } : {}),
        })
      })
    })
  }

  return {
    revision: 'PA-PUBLICATION-1',
    id: randomUUID(),
    publicationVersion: version,
    title: 'Publicación sintética de prueba',
    sourceProposalVersion: 1,
    approvedVersion: 1,
    approvedAt: '2027-02-20T10:00:00.000Z',
    publishedAt: '2027-02-21T10:00:00.000Z',
    schedule: {
      schoolId: 'SISTEMAS',
      academicPeriod: '2027-I',
      courses,
      sections,
      assignments,
    },
  }
}

function toSnapshot(state: RunState): RunSnapshot {
  return {
    ...state,
    requests: [...state.requests.entries()],
    enrollments: [...state.enrollments.entries()],
    reports: [...state.reports.entries()],
  }
}

function createOperationalFixture(courseSeeds: CourseSeed[]) {
  const publication = buildSyntheticPublication(courseSeeds)
  const offer: OperationalOffer = {
    runId: randomUUID(),
    publicationId: publication.id,
    publicationVersion: publication.publicationVersion,
    offerVersion: 1,
    academicPeriod: '2027-I',
    schoolId: 'SISTEMAS',
    planId: 'SYN-SIS-PLAN',
    activatedAt: '2027-02-22T10:00:00.000Z',
    clockBase: E3_CLOCK_BASE,
    courseCount: publication.schedule.courses.length,
    sectionCount: publication.schedule.sections.length,
  }
  const state = createOperationalRun(publication, offer)
  return { offer, state, snapshot: toSnapshot(state) }
}

function createMemoryOfferStore(): OperationalRunStore {
  const docs = new Map<string, OperationalRunDocument>()
  return {
    configured: true,
    list: () => [...docs.entries()].map(([id, payload]) => ({ id, payload })),
    write: (id, document) => { docs.set(id, structuredClone(document)) },
  }
}

describe('operational programming projection (Ticket A)', () => {
  it('reproduces P1 and projects all 56 catalog courses / 166 sections with reduced INE013/INO201 through dashboard service', async () => {
    // Catalog of 56 courses where INE013 has 2 sections (legacy has 6) and INO201 has 1 section (legacy has 5),
    // totaling 53 * 3 + 2 + 1 + 4 = 166 sections across the 56 courses.
    expect(catalog.courses).toHaveLength(56)

    const seeds: CourseSeed[] = catalog.courses.map((course, index) => {
      let sectionCount = 3
      if (course.courseId === 'INE013') sectionCount = 2
      else if (course.courseId === 'INO201') sectionCount = 1
      else if (index === catalog.courses.length - 1) sectionCount = 4

      return {
        courseId: course.courseId,
        sections: Array.from({ length: sectionCount }, (_, secIndex) => ({
          capacity: 30 + secIndex,
          teacherName: `Docente Sintético ${course.courseId}-${secIndex + 1}`,
          roomName: `AULA-${100 + secIndex}`,
          meetings: [
            { day: ((index + secIndex) % 5) + 1, startMinute: 480 + secIndex * 120, endMinute: 600 + secIndex * 120 },
          ],
        })),
      }
    })
    const totalSections = seeds.reduce((sum, item) => sum + item.sections.length, 0)
    expect(totalSections).toBe(166)

    const { offer, state } = createOperationalFixture(seeds)
    const module = await Test.createTestingModule({ imports: [LocalProfileDashboardModule] })
      .overrideProvider(MATRICULA_REGULAR_CLOCK)
      .useValue({ now: () => new Date(E3_CLOCK_BASE) })
      .compile()
    const app = module.createNestApplication({ logger: false })
    await app.init()

    try {
      const repository = app.get(MatriculaRegularRepository)
      repository.configureOperationalStore(createMemoryOfferStore())
      repository.activateOperational(offer, state, null)

      const session = await app.get(SessionService).create({ runId: offer.runId, actorId: 'SYN-SIS-A' })
      const response = app.get(LocalProfileDashboardService).read('programacion', {
        runId: offer.runId,
        actorId: 'SYN-SIS-A',
        sessionId: session.data.sessionId,
      })
      const envelope = response.data.payload
      if (!('data' in envelope) || !('programacion' in envelope.data)) {
        throw new Error('Se esperaba ProgramacionEnvelope')
      }
      expect(() => validateMatriculaWire('programacion', envelope)).not.toThrow()
      expect(envelope.data.alumno.codAlumno).toBe('SYN-SIS-A')
      expect(envelope.data.alumno.periodo).toBe('2027-1')
      expect(envelope.data.programacion).toHaveLength(166)

      const ine013Rows = envelope.data.programacion.filter((row) => row.codAsignatura === 'INE013')
      const ino201Rows = envelope.data.programacion.filter((row) => row.codAsignatura === 'INO201')
      expect(ine013Rows.map((row) => row.codSeccion)).toEqual([1, 2])
      expect(ino201Rows.map((row) => row.codSeccion)).toEqual([1])
    } finally {
      await app.close()
    }
  })

  it('projects a small subset catalog with exact day, minutes, capacity, occupancy, and no invented sessions', () => {
    const { snapshot } = createOperationalFixture([
      {
        courseId: '20118091',
        sections: [
          {
            capacity: 25,
            teacherName: 'Docente Subset A',
            roomName: '101AP',
            meetings: [{ day: 2, startMinute: 600, endMinute: 720 }],
          },
        ],
      },
      {
        courseId: '20118094',
        sections: [
          {
            capacity: 40,
            teacherName: 'Docente Subset B',
            roomName: 'LAB01AP',
            meetings: [
              { day: 4, startMinute: 840, endMinute: 960 },
              { day: 5, startMinute: 960, endMinute: 1080 },
            ],
          },
        ],
      },
    ])

    const actor = snapshot.actors.find((item) => item.actorId === 'SYN-SIS-A')!
    const envelope = projectScenarioProgramming(actor, snapshot)
    expect(() => validateMatriculaWire('programacion', envelope)).not.toThrow()

    const rows = envelope.data.programacion
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      codAsignatura: '20118091',
      codSeccion: 1,
      topeAlumnos: 25,
      matriculados: 0,
      nomDocente: 'Docente Subset A',
    })
    expect(rows[0]!.horarios).toHaveLength(1)
    expect(rows[0]!.horarios[0]).toMatchObject({
      dia: 'MARTES',
      horaInicio: '10:00',
      horaFin: '12:00',
      horaInicioMin: 600,
      horaFinMin: 720,
      codAula: '101AP',
      codEscuela: 1,
      codTipoHoraAsignatura: '--',
      desTipoHoraAsignatura: '--',
    })
    expect(rows[1]!.horarios).toHaveLength(2)
    expect(rows[1]!.horarios[0]).toMatchObject({
      dia: 'JUEVES',
      horaInicio: '14:00',
      horaFin: '16:00',
      horaInicioMin: 840,
      horaFinMin: 960,
      codAula: 'LAB01AP',
    })
    expect(rows[1]!.horarios[1]).toMatchObject({
      dia: 'VIERNES',
      horaInicio: '16:00',
      horaFin: '18:00',
      horaInicioMin: 960,
      horaFinMin: 1080,
      codAula: 'LAB01AP',
    })
  })

  it('projects expanded sections beyond legacy reference counts', () => {
    // Legacy INE002 has only 1 section; operational offer expands it to 3 sections.
    const { snapshot } = createOperationalFixture([
      {
        courseId: 'INE002',
        sections: [
          { capacity: 20, teacherName: 'Docente Uno', roomName: '101AP', meetings: [{ day: 1, startMinute: 480, endMinute: 600 }] },
          { capacity: 22, teacherName: 'Docente Dos', roomName: '102AP', meetings: [{ day: 3, startMinute: 600, endMinute: 720 }] },
          { capacity: 24, teacherName: 'Docente Tres', roomName: '101NP', meetings: [{ day: 5, startMinute: 720, endMinute: 840 }] },
        ],
      },
    ])

    const actor = snapshot.actors.find((item) => item.actorId === 'SYN-SIS-A')!
    const envelope = projectScenarioProgramming(actor, snapshot)
    expect(() => validateMatriculaWire('programacion', envelope)).not.toThrow()
    expect(envelope.data.programacion).toHaveLength(3)
    expect(envelope.data.programacion.map((row) => [row.codSeccion, row.topeAlumnos, row.nomDocente])).toEqual([
      [1, 20, 'Docente Uno'],
      [2, 22, 'Docente Dos'],
      [3, 24, 'Docente Tres'],
    ])
  })

  it('reflects schedule changes and occupancy updates after enrollment without inventing missing teacher/room metadata', async () => {
    const { offer, state } = createOperationalFixture([
      {
        courseId: '20118091',
        sections: [{ capacity: 15, teacherName: 'Docente 91', roomName: '101AP', meetings: [{ day: 1, startMinute: 480, endMinute: 540 }] }],
      },
      {
        courseId: '20118094',
        sections: [{ capacity: 15, teacherName: 'Docente 94', roomName: '102AP', meetings: [{ day: 2, startMinute: 480, endMinute: 540 }] }],
      },
      {
        courseId: '20118095',
        sections: [{ capacity: 15, teacherName: 'Docente 95', roomName: '101NP', meetings: [{ day: 3, startMinute: 480, endMinute: 540 }] }],
      },
      {
        courseId: '20118097',
        sections: [{ capacity: 15, teacherName: 'Docente 97', roomName: 'LAB01AP', meetings: [{ day: 4, startMinute: 480, endMinute: 540 }] }],
      },
    ])

    // Mutate section 1 of 20118091 schedule and clear teacher/room on 20118094 to verify honest fallback without fabrication
    const c91 = state.offer.find((course) => course.courseId === 'SYN-SIS-C09')!
    c91.sections[0]!.schedule = [{ day: 6, startMinute: 540, endMinute: 690 }]
    const c94 = state.offer.find((course) => course.courseId === 'SYN-SIS-C10')!
    c94.sections[0]!.teacher = null
    c94.sections[0]!.room = null

    const module = await Test.createTestingModule({ imports: [LocalProfileDashboardModule] })
      .overrideProvider(MATRICULA_REGULAR_CLOCK)
      .useValue({ now: () => new Date(E3_CLOCK_BASE) })
      .compile()
    const app = module.createNestApplication({ logger: false })
    await app.init()

    try {
      const repository = app.get(MatriculaRegularRepository)
      repository.configureOperationalStore(createMemoryOfferStore())
      repository.activateOperational(offer, state, null)

      const session = await app.get(SessionService).create({ runId: offer.runId, actorId: 'SYN-SIS-A' })
      const actor = repository.readSnapshot(offer.runId).actors.find((item) => item.actorId === 'SYN-SIS-A')!
      const result = await app.get(MatriculaRegularService).submit({
        runId: offer.runId,
        actorId: 'SYN-SIS-A',
        sessionId: session.data.sessionId,
        requestId: randomUUID(),
        profileRevision: actor.profileRevision,
        selection: state.offer.map((course) => ({
          courseId: course.courseId,
          sectionId: course.sections[0]!.sectionId,
        })),
      })
      expect(result.data.state).toBe('accepted')

      const dashboardRead = app.get(LocalProfileDashboardService).read('programacion', {
        runId: offer.runId,
        actorId: 'SYN-SIS-A',
        sessionId: session.data.sessionId,
      })
      const envelope = dashboardRead.data.payload
      if (!('data' in envelope) || !('programacion' in envelope.data)) {
        throw new Error('Se esperaba ProgramacionEnvelope')
      }
      expect(() => validateMatriculaWire('programacion', envelope)).not.toThrow()
      for (const row of envelope.data.programacion) {
        expect(row.matriculados).toBe(1)
        expect(row.topeAlumnos).toBe(15)
      }
      const row91 = envelope.data.programacion.find((row) => row.codAsignatura === '20118091')!
      expect(row91.horarios[0]).toMatchObject({
        dia: 'SABADO',
        horaInicio: '09:00',
        horaFin: '11:30',
        horaInicioMin: 540,
        horaFinMin: 690,
      })
      const row94 = envelope.data.programacion.find((row) => row.codAsignatura === '20118094')!
      expect(row94).toMatchObject({
        codDocente: '--',
        nomDocente: '--',
        apePatDocente: '--',
        apeMatDocente: '--',
      })
      expect(row94.horarios[0]).toMatchObject({
        codAula: '--',
        codDocente: '--',
        codTipoHoraAsignatura: '--',
        desTipoHoraAsignatura: '--',
      })
    } finally {
      await app.close()
    }
  })

  it('preserves legacy non-operational projection and schedule/occupancy variations intact', () => {
    const bundles = buildBuiltInEnrollmentScenarioBundles()
    const regular = bundles.find((bundle) => bundle.scenarioId === 'regular')!
    const systemsFixture = regular.fixtures.find((fixture) => fixture.profile.scope.schoolId === 'SISTEMAS')!
    const softwareFixture = regular.fixtures.find((fixture) => fixture.profile.scope.schoolId === 'SOFTWARE')!

    const buildLegacySnapshot = (fixture: typeof systemsFixture): RunSnapshot => ({
      runId: randomUUID(),
      profiles: [fixture.profile],
      actors: fixture.actors,
      offer: fixture.offer,
      sessions: [],
      requests: [],
      enrollments: [],
      reports: [],
    })

    const sisSnapshot = buildLegacySnapshot(systemsFixture)
    const sisActor = sisSnapshot.actors[0]!
    expect(sisActor.scenarioData?.sectionOrigins).toBeUndefined()
    const sisEnvelope = projectScenarioProgramming(sisActor, sisSnapshot)
    expect(() => validateMatriculaWire('programacion', sisEnvelope)).not.toThrow()
    expect(sisEnvelope.data.programacion).toHaveLength(165)
    expect(sisEnvelope.data.programacion[0]!.horarios[0]!.codEscuela).toBe(1)
    expect(sisEnvelope.data.programacion[0]!.horarios[0]!.codTipoHoraAsignatura).toBe('T')

    const softSnapshot = buildLegacySnapshot(softwareFixture)
    const softActor = softSnapshot.actors[0]!
    const softEnvelope = projectScenarioProgramming(softActor, softSnapshot)
    expect(() => validateMatriculaWire('programacion', softEnvelope)).not.toThrow()
    expect(softEnvelope.data.programacion).toHaveLength(165)
    expect(softEnvelope.data.programacion[0]!.horarios[0]!.codEscuela).toBe(2)

    const cruce = bundles.find((bundle) => bundle.scenarioId === 'cruce')!
    const cruceFixture = cruce.fixtures.find((fixture) => fixture.profile.scope.schoolId === 'SISTEMAS')!
    const cruceEnvelope = projectScenarioProgramming(cruceFixture.actors[0]!, buildLegacySnapshot(cruceFixture))
    const c09 = cruceEnvelope.data.programacion.find((row) => row.codAsignatura === '20118091' && row.codSeccion === 1)!
    const c10 = cruceEnvelope.data.programacion.find((row) => row.codAsignatura === '20118094' && row.codSeccion === 2)!
    expect(c09.horarios.every((slot) => slot.dia === 'MIERCOLES')).toBe(true)
    expect(c10.horarios.every((slot) => slot.dia === 'MIERCOLES')).toBe(true)
  })

  it('isolates profiles/plans and fails closed on empty operational sectionOrigins', () => {
    const { snapshot } = createOperationalFixture([
      {
        courseId: '20118091',
        sections: [{ capacity: 30, teacherName: 'Docente A', roomName: '101AP', meetings: [{ day: 1, startMinute: 480, endMinute: 600 }] }],
      },
    ])

    const actorB = snapshot.actors.find((actor) => actor.actorId === 'SYN-SIS-B')!
    const envelopeB = projectScenarioProgramming(actorB, snapshot)
    expect(envelopeB.data.alumno.codAlumno).toBe('SYN-SIS-B')
    expect(envelopeB.data.programacion).toHaveLength(1)

    const foreignActor = structuredClone(actorB)
    foreignActor.scope = { ...foreignActor.scope, schoolId: 'SOFTWARE', planId: 'SYN-SOFT-PLAN' }
    const foreignEnvelope = projectScenarioProgramming(foreignActor, snapshot)
    expect(foreignEnvelope.data.programacion).toEqual([])

    const emptyOriginsActor = structuredClone(actorB)
    emptyOriginsActor.scenarioData!.sectionOrigins = []
    expect(() => projectScenarioProgramming(emptyOriginsActor, snapshot)).toThrow()
  })
})

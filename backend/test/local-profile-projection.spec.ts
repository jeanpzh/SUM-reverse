import { describe, expect, it } from 'vitest'
import { validateMiInformacionWire } from '../../shared/mi-informacion-wire.mjs'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { createSyntheticAcademicDemoFixture } from '../src/matricula-regular/academic-demo.fixtures.js'
import type { ActorProfile, School } from '../src/matricula-regular/profile.types.js'
import { projectProfileRead, projectStudent } from '../src/local-profile-dashboard/profile-projection.js'

const actors: ActorProfile[] = (['SISTEMAS', 'SOFTWARE'] as School[])
  .flatMap((school) => createSyntheticFixture(school).actors)

describe('local profile compatible projections', () => {
  it('four_actor_identity and school_plan_period_mapping project each repository actor consistently', () => {
    expect(actors.map(({ actorId }) => actorId)).toEqual([
      'SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B',
    ])

    for (const actor of actors) {
      const student = projectStudent(actor)
      expect(student.codAlumno).toBe(actor.actorId)
      expect(student.nomAlumno).toBe(actor.name)
      expect(student.desEscuela).toBe(actor.scope.schoolId)
      expect(student.codPlan).toBe(actor.scope.planId)
      expect(student.desPlan).toBe(actor.scope.planId)
      expect(student.periodo).toBe('2026-2')
      expect(student.desEspecialidad).toBe('No disponible')
      expect(student.ponderado).toBe(actor.ponderado ?? 0)
    }
  })

  it('catalog_sections_8_13 reuses the existing form and socioeconomic catalogs', () => {
    const actor = actors[0]!
    const formulario = projectProfileRead('formulario', actor)
    const ficha = projectProfileRead('fichaSocioeconomica', actor)

    expect(formulario.secciones).toHaveLength(8)
    expect(ficha.secciones).toHaveLength(13)
    expect(formulario.secciones.flatMap(({ campos }) => campos)
      .filter(({ etiqueta }) => etiqueta === 'Código de Estudiante' || etiqueta === 'Nombre de Estudiante')
      .every(({ valor }) => valor !== null)).toBe(true)
    expect(formulario.secciones.flatMap(({ campos }) => campos)
      .filter(({ etiqueta }) => etiqueta !== 'Código de Estudiante' && etiqueta !== 'Nombre de Estudiante')
      .every(({ valor }) => valor === null)).toBe(true)
  })

  it('no_private_or_mock_repository uses only independently constructed actor values', () => {
    const actor = actors[0]!
    const student = projectStudent(actor)
    const unavailablePersonalFields: readonly string[] = [
      'fechaNacimiento',
      'tipoDocumento',
      'numDocumento',
      'correoPersonal',
    ]
    const emptyInstitutionalFields = [
      student.codPermanencia,
      student.desPermanencia,
      student.codSituacion,
      student.desSituacion,
      student.regimen,
      student.egresadoEG,
      student.correoInstitucional,
      student.urlFoto,
      student.foto,
    ]

    expect(unavailablePersonalFields.every((field) => !(field in student))).toBe(true)
    expect(emptyInstitutionalFields.every((value) => value === '')).toBe(true)
    expect(student.codFacultad).toBe(0)
    expect(student.codEscuela).toBe(0)
    expect(student.codEspecialidad).toBe(0)
    expect(student.infoMatricula.indMatDeudores).toBe('')
    expect(student.infoMatricula.indCertificadoMed).toBe('')
    expect(student.infoMatricula.indHabMatricula).toBe('')
    expect(projectProfileRead('perfil', actor)).toBeNull()
  })

  it('alumno_local_v1_valid validates all four student and MI projections', () => {
    for (const actor of actors) {
      const formulario = projectProfileRead('formulario', actor)
      const historial = projectProfileRead('historial', actor)
      const ficha = projectProfileRead('fichaSocioeconomica', actor)

      expect(() => validateMiInformacionWire('formularioDatos', {
        message: null,
        codError: null,
        data: formulario,
      }, 'local-v1')).not.toThrow()
      expect(() => validateMiInformacionWire('historial', {
        message: null,
        codError: null,
        data: historial,
      }, 'local-v1')).not.toThrow()
      expect(() => validateMiInformacionWire('fichaSocioeconomica', {
        message: null,
        codError: null,
        data: ficha,
      }, 'local-v1')).not.toThrow()
    }
  })

  it('empty_records_not_approval returns empty histories, evaluation, debt, attendance, and tutoring', () => {
    for (const actor of actors) {
      const historial = projectProfileRead('historial', actor)
      const evaluaciones = projectProfileRead('evaluaciones', actor)
      const deudas = projectProfileRead('deudas', actor)
      const asistencias = projectProfileRead('asistencias', actor)
      const tutoria = projectProfileRead('tutoria', actor)

      expect(historial.resumen).toEqual({ asignaturasAprobadas: 0, creditosAprobados: 0, promedioPonderado: null })
      expect(historial.periodos).toEqual([])
      expect(historial.asignaturas).toEqual([])
      expect(evaluaciones).toEqual({ message: null, codError: null, data: [] })
      expect(deudas).toEqual({ message: null, codError: null, data: [] })
      expect(asistencias).toEqual({ message: null, codError: null, data: [] })
      expect(tutoria).toEqual({ message: null, codError: null, data: [] })
      expect(actor.institutional).toEqual({ debt: 'met', health: 'met', eligibility: 'met' })
    }
  })

  it('PS-A2 projects explicit attempts, distinct approvals, credits, and weighted averages', () => {
    const demoActors: ActorProfile[] = (['SISTEMAS', 'SOFTWARE'] as School[])
      .flatMap((school) => createSyntheticAcademicDemoFixture(school).actors)
    const expected = [
      { attempts: 8, approved: 8, credits: 32, average: 16, periodCount: 2 },
      { attempts: 9, approved: 6, credits: 24, average: 12.67, periodCount: 3 },
      { attempts: 8, approved: 8, credits: 32, average: 16.75, periodCount: 2 },
      { attempts: 9, approved: 6, credits: 24, average: 11.89, periodCount: 3 },
    ]

    demoActors.forEach((actor, index) => {
      const history = projectProfileRead('historial', actor)
      const expectedActor = expected[index]!
      expect(history.asignaturas).toHaveLength(expectedActor.attempts)
      expect(history.resumen).toEqual({
        asignaturasAprobadas: expectedActor.approved,
        creditosAprobados: expectedActor.credits,
        promedioPonderado: expectedActor.average,
      })
      expect(history.periodos).toHaveLength(expectedActor.periodCount)
      expect(history.alumno.ponderado).toBe(expectedActor.average)
      expect(history.asignaturas.every((attempt) => attempt.acta.startsWith('SYN-ACTA-'))).toBe(true)
    })
  })

  it('PS-A4 keeps other compatible profile payloads identical to the minimal fixture', () => {
    for (const school of ['SISTEMAS', 'SOFTWARE'] as School[]) {
      const baseActors = createSyntheticFixture(school).actors
      const demoActors = createSyntheticAcademicDemoFixture(school).actors
      for (const index of [0, 1]) {
        for (const key of ['perfil', 'formulario', 'fichaSocioeconomica', 'evaluaciones', 'deudas', 'asistencias', 'tutoria'] as const) {
          expect(projectProfileRead(key, demoActors[index]!)).toEqual(projectProfileRead(key, baseActors[index]!))
        }
      }
    }
  })

  it('independent_clones does not let one response mutate another actor projection', () => {
    const actor = actors[0]!
    const first = projectProfileRead('formulario', actor)
    const second = projectProfileRead('formulario', actor)
    first.secciones[0]!.campos[0]!.valor = 'changed locally'

    expect(second.secciones[0]!.campos[0]!.valor).not.toBe('changed locally')
    expect(actor.actorId).toBe('SYN-SIS-A')
    expect(projectStudent(actor).codAlumno).toBe('SYN-SIS-A')
  })
})

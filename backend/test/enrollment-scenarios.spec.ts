import { expect, it } from 'vitest'
import { createSyntheticAcademicDemoFixture } from '../src/matricula-regular/academic-demo.fixtures.js'
import { buildEnrollmentScenarioBundles, enrollmentScenarioIds, selectedCourseCodes } from '../src/matricula-regular/enrollment-scenarios.js'
import type { SelectedPlanCourse } from '../src/matricula-regular/enrollment-scenarios.js'

const planRows: SelectedPlanCourse[] = [
  { codAsignatura: '20118041', desAsignatura: 'ALGORÍTMICA Y PROGRAMACIÓN ORIENTADA A OBJETOS', creditos: 4, ciclo: 4, tipoAsignatura: 'O' },
  { codAsignatura: '20118051', desAsignatura: 'BASE DE DATOS', creditos: 4, ciclo: 5, tipoAsignatura: 'O' },
  { codAsignatura: '20118066', desAsignatura: 'REDES, TRANSMISIÓN Y AUTOMATIZACIÓN Y CONTROL', creditos: 4, ciclo: 6, tipoAsignatura: 'O' },
  { codAsignatura: '20118084', desAsignatura: 'INGENIERIA DE LA INFORMACIÓN', creditos: 4, ciclo: 8, tipoAsignatura: 'O' },
]
const hash = 'a'.repeat(64)

it('builds nine isolated four-actor bundles and derives academic state from PS-1 attempts', () => {
  const sourceBefore = structuredClone(planRows)
  const bundles = buildEnrollmentScenarioBundles(planRows, hash)
  expect(bundles.map(({ scenarioId }) => scenarioId)).toEqual(enrollmentScenarioIds)
  expect(bundles.every(({ fixtures, cases }) => fixtures.length === 2 && cases.length === 4)).toBe(true)
  for (const bundle of bundles) {
    expect(bundle.cases.map(({ actorId }) => actorId)).toEqual(['SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B'])
    expect(new Set(bundle.fixtures.flatMap(({ actors }) => actors.map(({ actorId }) => actorId))).size).toBe(4)
    expect(bundle.source.selectedCourseCodes).toEqual([...selectedCourseCodes])
    const actors = bundle.fixtures.flatMap(({ actors }) => actors)
    expect(actors.map(({ approvedCourseIds }) => approvedCourseIds.length)).toEqual([8, 6, 8, 6])
    expect(actors.map(({ ponderado }) => ponderado)).toEqual([16, 12.67, 16.75, 11.89])
    expect(actors[1]!.failedCourses).toEqual([{ courseId: 'SYN-SIS-C07', failures: 1 }, { courseId: 'SYN-SIS-C08', failures: 2 }])
    expect(actors[3]!.failedCourses).toEqual([{ courseId: 'SYN-SOFT-C07', failures: 1 }, { courseId: 'SYN-SOFT-C08', failures: 2 }])
    expect(actors.map(({ preEnrollment }) => preEnrollment.length)).toEqual([4, 4, 4, 4])
    for (const fixture of bundle.fixtures) {
      for (const actor of fixture.actors) {
        const approved = new Set(actor.approvedCourseIds)
        const expected = actor.actorId.endsWith('-A') ? ['C09', 'C10', 'C11', 'C12'] : ['C07', 'C08', 'C09', 'C10']
        expect(actor.preEnrollment.map(({ courseId }) => courseId.slice(-3))).toEqual(expected)
        for (const document of actor.preEnrollment) {
          const course = fixture.offer.find(({ courseId }) => courseId === document.courseId)!
          expect(approved.has(course.courseId)).toBe(false)
          expect(course.prerequisiteIds.every((id) => approved.has(id))).toBe(true)
        }
      }
    }
  }
  const systems = bundles[0]!.fixtures[0]!
  for (const actor of systems.actors) {
    expect(actor.academic!.catalog.slice(8, 12).map(({ name, credits, cycle, courseType }) => [name, credits, cycle, courseType])).toEqual([
      ['ALGORÍTMICA Y PROGRAMACIÓN ORIENTADA A OBJETOS', 4, 4, 'mandatory'], ['BASE DE DATOS', 4, 5, 'mandatory'],
      ['REDES, TRANSMISIÓN Y AUTOMATIZACIÓN Y CONTROL', 4, 6, 'mandatory'], ['INGENIERIA DE LA INFORMACIÓN', 4, 8, 'mandatory'],
    ])
  }
  expect(bundles[0]!.fixtures[1]!.actors[0]!.academic).toEqual(createSyntheticAcademicDemoFixture('SOFTWARE').actors[0]!.academic)
  expect(planRows).toEqual(sourceBefore)
  const mutableSourceCodes = bundles[0]!.source.selectedCourseCodes as unknown as string[]
  mutableSourceCodes.push('mutated')
  expect(bundles[1]!.source.selectedCourseCodes).toEqual([...selectedCourseCodes])
  bundles[0]!.fixtures[0]!.actors[0]!.approvedCourseIds.push('SYN-EXTRA')
  expect(bundles[1]!.fixtures[0]!.actors[0]!.approvedCourseIds).not.toContain('SYN-EXTRA')
})

it('models the nine scenario oracles and the four picks per actor without mutating the factory seed', () => {
  const bundles = buildEnrollmentScenarioBundles(planRows, hash)
  expect(bundles.map(({ scenarioId, cases }) => [scenarioId, cases.map(({ expected }) => expected.state)])).toEqual([
    ['regular', ['accepted', 'accepted', 'accepted', 'accepted']],
    ['repitencia', ['accepted', 'accepted', 'accepted', 'accepted']],
    ['tutoria', ['accepted', 'rejected', 'accepted', 'rejected']],
    ['prerrequisito', ['rejected', 'accepted', 'rejected', 'accepted']],
    ['cruce', ['rejected', 'rejected', 'rejected', 'rejected']],
    ['cupo', ['rejected', 'rejected', 'rejected', 'rejected']],
    ['deuda', ['accepted', 'rejected', 'accepted', 'rejected']],
    ['gap-horario', ['configuration-pending', 'configuration-pending', 'configuration-pending', 'configuration-pending']],
    ['prioridad', ['accepted', 'rejected', 'accepted', 'rejected']],
  ])
  expect(bundles[3]!.cases[0]!.expected.causes.map(({ code, courseIds }) => [code, courseIds])).toEqual([
    ['COURSE_NOT_IN_PRE_ENROLLMENT', ['SYN-SIS-C13']],
    ['PREREQUISITE_UNMET', ['SYN-SIS-C09', 'SYN-SIS-C13']],
  ])
  expect(bundles[8]!.cases[1]!.expected.causes.map(({ code, courseIds }) => [code, courseIds])).toEqual([
    ['RETAKE_PRIORITY', ['SYN-SIS-C07']],
  ])
  expect(createSyntheticAcademicDemoFixture('SISTEMAS').actors[0]!.preEnrollment.map(({ courseId }) => courseId)).toEqual([
    'SYN-SIS-C1', 'SYN-SIS-C2', 'SYN-SIS-C3',
  ])
})

it('rejects missing, contradictory, malformed and changed selected fields with safe paths', () => {
  expect(() => buildEnrollmentScenarioBundles(planRows.slice(1), hash)).toThrow('data.codAsignatura(20118041) ausente')
  expect(() => buildEnrollmentScenarioBundles([...planRows, { ...planRows[0]!, ciclo: 9 }], hash)).toThrow('duplicada con campos contradictorios')
  expect(() => buildEnrollmentScenarioBundles(planRows.map((row, index) => index === 0 ? { ...row, creditos: Number.NaN } : row), hash)).toThrow('data.creditos(20118041) inválido')
  expect(() => buildEnrollmentScenarioBundles(planRows.map((row, index) => index === 0 ? { ...row, ciclo: 5 } : row), hash)).toThrow('no coincide en desAsignatura/creditos/ciclo/tipoAsignatura')
  expect(() => buildEnrollmentScenarioBundles(planRows, 'bad-hash')).toThrow('64 caracteres hexadecimales')
})

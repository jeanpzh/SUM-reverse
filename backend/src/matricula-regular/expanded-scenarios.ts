import type { MatriculaRegularId } from '../../../shared/matricula-regular.mjs'
import type { EnrollmentScenarioBundle } from './enrollment-scenarios.js'
import type { AcademicAttempt, ActorProfile, Meeting, OfferedCourse, School } from './profile.types.js'
import { scenarioPlanRows, scenarioProgrammingRows } from './scenario-reference.seed.js'
import { validateSyntheticAcademicRecord } from './academic-demo.validation.js'

// Keep scenario aliases stable, using actual prerequisite chains in the supplied synthetic plan.
const anchors: Record<number, string> = {
  7: '20118084', 8: '20118087', 9: '20118091', 10: '20118094',
  11: '20118095', 12: '20118097', 13: '20118101', 14: '20118103',
}
const courseNumbers = new Map(Object.entries(anchors).map(([number, code]) => [code, Number(number)]))
let nextNumber = 1
for (const row of scenarioPlanRows) {
  if (courseNumbers.has(row.codAsignatura)) continue
  while (Object.hasOwn(anchors, nextNumber)) nextNumber++
  courseNumbers.set(row.codAsignatura, nextNumber++)
}
const idFor = (school: School, code: string): MatriculaRegularId => {
  const number = courseNumbers.get(code)
  if (!number) throw new TypeError(`Asignatura sin correspondencia sintética: ${code}`)
  return `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-C${String(number).padStart(2, '0')}`
}
const minute = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
const days = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']

function catalogFor(actor: ActorProfile, school: School) {
  return [...courseNumbers].map(([code]) => {
    const rows = scenarioPlanRows.filter((row) => row.codAsignatura === code)
    const row = rows[0]!
    return {
      courseId: idFor(school, code), planId: actor.scope.planId, name: row.desAsignatura,
      credits: row.creditos, cycle: row.ciclo,
      courseType: row.tipoAsignatura === 'O' ? 'mandatory' as const : 'elective' as const,
      prerequisiteIds: [...new Set(rows.filter((item) => item.codAsignaturaPre !== 'NR')
        .map((item) => idFor(school, item.codAsignaturaPre)))],
    }
  }).sort((a, b) => a.courseId.localeCompare(b.courseId))
}

function enrichHistory(actor: ActorProfile, school: School) {
  const catalog = catalogFor(actor, school)
  const suffix = actor.actorId.endsWith('-A') ? 'A' : 'B'
  const electiveCodes = ['INE002', 'INE004', 'INE005', 'INE013']
  const electiveTerms = ['2022-2', '2023-2', '2024-2', '2026-1'] as const
  const failedTerms = ['2022-1', '2023-1', '2024-1', '2025-2'] as const
  const attempts: AcademicAttempt[] = []
  for (const course of catalog) {
    const code = [...courseNumbers].find(([, number]) => course.courseId.endsWith(`C${String(number).padStart(2, '0')}`))![0]
    const electiveIndex = electiveCodes.indexOf(code)
    if (course.courseType === 'elective' && electiveIndex < 0 || course.cycle > 8) continue
    const period: AcademicAttempt['period'] = electiveIndex >= 0 ? electiveTerms[electiveIndex]!
      : `${2022 + Math.floor((course.cycle - 1) / 2)}-${course.cycle % 2 === 1 ? 1 : 2}`
    const pending = suffix === 'B' && (code === anchors[7] || code === anchors[8])
    if (electiveIndex >= 0) attempts.push({ courseId: course.courseId, period: failedTerms[electiveIndex]!,
      sectionNumber: 1, grade: 8 + electiveIndex % 3, result: 'failed', recordId: '' })
    attempts.push({ courseId: course.courseId, period, sectionNumber: 1,
      grade: pending ? 9 : (suffix === 'A' ? 14 : 12) + (courseNumbers.get(code)! + (school === 'SOFTWARE' ? 1 : 0)) % 5,
      result: pending ? 'failed' : 'approved', recordId: '' })
    if (pending && code === anchors[8]) attempts.push({ courseId: course.courseId, period: '2026-1',
      sectionNumber: 2, grade: 10, result: 'failed', recordId: '' })
  }
  attempts.sort((a, b) => a.period.localeCompare(b.period) || a.courseId.localeCompare(b.courseId))
  attempts.forEach((attempt, index) => { attempt.recordId = `SYN-ACTA-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}-${String(index + 1).padStart(2, '0')}` })
  actor.academic = { seedRevision: 'PS-SEED-1', catalog, attempts }
  validateSyntheticAcademicRecord(actor, actor.academic)
  actor.approvedCourseIds = [...new Set(attempts.filter((attempt) => attempt.result === 'approved').map((attempt) => attempt.courseId))].sort()
  actor.failedCourses = suffix === 'B' ? [
    { courseId: idFor(school, anchors[7]!), failures: 1 }, { courseId: idFor(school, anchors[8]!), failures: 2 },
  ] : []
  const credits = new Map<string, number>(catalog.map((course) => [course.courseId, course.credits]))
  const total = attempts.reduce((sum, attempt) => sum + credits.get(attempt.courseId)!, 0)
  actor.ponderado = Math.round(attempts.reduce((sum, attempt) => sum + attempt.grade * credits.get(attempt.courseId)!, 0) / total * 100) / 100
  actor.scenarioData = {
    courseCodes: Object.fromEntries([...courseNumbers].map(([code]) => [idFor(school, code), code])),
    plan: { message: null, codError: null, data: scenarioPlanRows.map((row) => ({ ...row, codEscuela: school === 'SISTEMAS' ? 1 : 2 })) },
    programming: structuredClone(scenarioProgrammingRows),
    profile: {
      tipoDocumento: 'Documento sintético', numDocumento: `SYN-DOC-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-${suffix}`,
      estadoCivil: 'Soltero/a', codSexo: suffix === 'A' ? 'F' : 'M', desSexo: suffix === 'A' ? 'Femenino' : 'Masculino',
      fechaNacimiento: suffix === 'A' ? '2003-04-18' : '2002-09-23', departamentoNac: 'Lima', provinciaNac: 'Lima',
      distritoNac: suffix === 'A' ? 'San Miguel' : 'Los Olivos', telefono: 'No registrado', celular: 'SYN-TEL-0001',
      correoInstitucional: `${actor.actorId.toLowerCase()}@example.test`, correoPersonal: `${actor.actorId.toLowerCase()}.personal@example.test`,
      departamentoDir: 'Lima', provinciaDir: 'Lima', distritoDir: suffix === 'A' ? 'San Miguel' : 'Los Olivos',
      direccion: `Av. Demostración ${suffix === 'A' ? '120' : '240'} — domicilio sintético`, anioIngreso: '2022',
      codTipoIngreso: 'SYN-ORD', desTipoIngreso: 'Examen ordinario (simulado)', codColegioProc: 'SYN-COL-01',
      desColegioProc: 'Institución Educativa de Demostración', anioEstudio: 5, promedio: actor.ponderado,
      situAcademica: suffix === 'A' ? 'Regular' : 'Con asignaturas pendientes', permanencia: 'Activo',
      codSemUltMat: '2026-1', promUltMat: 0,
    },
  }
  const last = attempts.filter((attempt) => attempt.period === '2026-1')
  actor.scenarioData.profile.promUltMat = Math.round(last.reduce((sum, attempt) => sum + attempt.grade * credits.get(attempt.courseId)!, 0)
    / last.reduce((sum, attempt) => sum + credits.get(attempt.courseId)!, 0) * 100) / 100
}

export function expandScenarioBundle(bundle: EnrollmentScenarioBundle): EnrollmentScenarioBundle {
  for (const fixture of bundle.fixtures) {
    const school = fixture.profile.scope.schoolId as School
    fixture.actors.forEach((actor) => enrichHistory(actor, school))
    const catalog = fixture.actors[0]!.academic!.catalog
    fixture.offer = catalog.filter((course) => scenarioProgrammingRows.some((row) => idFor(school, row.codAsignatura) === course.courseId))
      .map((course): OfferedCourse => ({ ...structuredClone(course), sections: scenarioProgrammingRows
        .filter((row) => idFor(school, row.codAsignatura) === course.courseId)
        .map((row, index) => {
          const number = Number(course.courseId.slice(-2))
          const active = number >= 7 && number <= 14 && index === 0
          const day = (number === 14 ? 1 : number - 6) as Meeting['day']
          const start = number === 14 ? 720 : 480
          return {
            sectionId: `${course.courseId}-S${row.codSeccion}`, label: String(row.codSeccion),
            teacher: `${row.apePatDocente} ${row.apeMatDocente}, ${row.nomDocente}`.trim(),
            room: row.horarios[0]?.codAula ?? null,
            capacity: row.topeAlumnos,
            occupied: active ? bundle.scenarioId === 'cupo' && number === 9 ? row.topeAlumnos : Math.max(0, row.topeAlumnos - 5) : row.matriculados,
            schedule: active ? bundle.scenarioId === 'gap-horario' && number === 9 ? null : [
              { day: bundle.scenarioId === 'cruce' && (number === 9 || number === 10) ? 3 : day, startMinute: start, endMinute: start + 120 },
              { day: bundle.scenarioId === 'cruce' && (number === 9 || number === 10) ? 3 : day, startMinute: start + 120, endMinute: start + 180 },
            ] : row.horarios.map((slot) => ({ day: (days.indexOf(slot.dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) + 1) as Meeting['day'],
              startMinute: minute(slot.horaInicio), endMinute: minute(slot.horaFin) })),
          }
        }) }))
    for (const actor of fixture.actors) {
      const approved = new Set(actor.approvedCourseIds)
      actor.preEnrollment = fixture.offer.filter((course) => !approved.has(course.courseId)
        && course.prerequisiteIds.every((id) => approved.has(id)))
        .map(({ courseId, planId, name, credits }) => ({ courseId, planId, name, credits }))
    }
    for (const item of bundle.cases.filter((item) => item.actorId.startsWith(`SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-`))) {
      const isA = item.actorId.endsWith('-A')
      const numbers = bundle.scenarioId === 'prerrequisito' && isA ? [10, 11, 12, 13]
        : bundle.scenarioId === 'prioridad' && !isA ? [8, 9, 10, 14] : isA ? [9, 10, 11, 12] : [7, 8, 9, 10]
      item.selection = numbers.map((number) => {
        const course = fixture.offer.find((course) => course.courseId === idFor(school, anchors[number]!))!
        return { courseId: course.courseId as MatriculaRegularId, sectionId: course.sections[0]!.sectionId as MatriculaRegularId }
      })
    }
  }
  return bundle
}

import type { AlumnoFixture } from '../reportes/reportes.types.js'
import type { PlanEstudiosRow } from './plan-estudios.types.js'

const courseNames = [
  'Matemática I',
  'Introducción a la Informática',
  'Lenguaje y Comunicación',
  'Metodología del Estudio',
  'Estadística',
  'Programación I',
  'Matemática II',
  'Física General',
]

export function buildPlanEstudiosFixtures(alumno: AlumnoFixture): PlanEstudiosRow[] {
  return courseNames.map((desAsignatura, index) => {
    const prerequisiteIndex = index - 4
    return {
      codPlan: alumno.codPlan,
      codAsignatura: `DEMO-${String(index + 1).padStart(3, '0')}`,
      desAsignatura,
      codAsignaturaPre: prerequisiteIndex < 0 ? '' : `DEMO-${String(prerequisiteIndex + 1).padStart(3, '0')}`,
      desAsignaturaPre: prerequisiteIndex < 0 ? '' : courseNames[prerequisiteIndex]!,
      codFacultad: alumno.codFacultad,
      codEscuela: alumno.codEscuela,
      codEspecialidad: alumno.codEspecialidad,
      ciclo: index < 4 ? 1 : 2,
      creditos: 4,
      creditosPre: 0,
      tipoAsignatura: 'O',
      codGrupo: 'GEG',
      codGrupoPre: '--',
    }
  })
}

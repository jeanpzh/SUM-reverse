import type { AlumnoFixture } from '../reportes/reportes.types.js'
import type { AsistenciaRow } from './asistencias.types.js'

type AsistenciaSeed = {
  codAsignatura: string
  desAsignatura: string
  numClases: number
  cantPresentes: number
  cantTardanzas: number
  cantFaltas: number
}

const seeds: AsistenciaSeed[] = [
  {
    codAsignatura: 'DEMO-001',
    desAsignatura: 'Matemática I',
    numClases: 16,
    cantPresentes: 14,
    cantTardanzas: 1,
    cantFaltas: 1,
  },
  {
    codAsignatura: 'DEMO-002',
    desAsignatura: 'Introducción a la Informática',
    numClases: 8,
    cantPresentes: 6,
    cantTardanzas: 1,
    cantFaltas: 1,
  },
  {
    codAsignatura: 'DEMO-003',
    desAsignatura: 'Lenguaje y Comunicación',
    numClases: 0,
    cantPresentes: 0,
    cantTardanzas: 0,
    cantFaltas: 0,
  },
]

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 10000) / 100
}

export function buildAsistenciaFixtures(alumno: AlumnoFixture): AsistenciaRow[] {
  return seeds.map((seed) => {
    const cantAsistencias = seed.cantPresentes + seed.cantTardanzas

    return {
      codAlumno: alumno.codAlumno,
      apellidoMaterno: null,
      apellidoPaterno: null,
      nombreAlumno: null,
      codSemestre: alumno.periodo,
      codFacultad: alumno.codFacultad,
      codEscuela: alumno.codEscuela,
      codEspecialidad: alumno.codEspecialidad,
      desEspecialidad: alumno.desEspecialidad,
      codPlan: alumno.codPlan,
      codAsignatura: seed.codAsignatura,
      desAsignatura: seed.desAsignatura,
      codSeccion: 1,
      numClases: seed.numClases,
      cantPresentes: seed.cantPresentes,
      cantFaltas: seed.cantFaltas,
      cantTardanzas: seed.cantTardanzas,
      cantAsistencias,
      porcentajePresentes: percentage(seed.cantPresentes, seed.numClases),
      porcentajeFaltas: percentage(seed.cantFaltas, seed.numClases),
      porcentajeTardanzas: percentage(seed.cantTardanzas, seed.numClases),
      porcentajeAsistencias: percentage(cantAsistencias, seed.numClases),
    }
  })
}

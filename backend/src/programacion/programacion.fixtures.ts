import type { AlumnoFixture } from '../reportes/reportes.types.js'
import type { HorarioProgramacion, ProgramacionRow } from './programacion.types.js'

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
const days = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']

function minutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}

function schedule(
  alumno: AlumnoFixture,
  codAsignatura: string,
  codDocente: string,
  codSeccion: number,
  horario: number,
  dia: string,
  horaInicio: string,
  horaFin: string,
  codAula: string,
  codTipoHoraAsignatura: string,
  desTipoHoraAsignatura: string,
): HorarioProgramacion {
  return {
    codSemestre: null,
    codPlan: null,
    desAsignatura: null,
    nomDocente: null,
    codAsignatura,
    codDocente,
    dia,
    horaInicio,
    horaFin,
    codAula,
    codTipoHoraAsignatura,
    desTipoHoraAsignatura,
    codFacultad: alumno.codFacultad,
    codEscuela: alumno.codEscuela,
    codEspecialidad: alumno.codEspecialidad,
    codSeccion,
    horario,
    horaInicioMin: minutes(horaInicio),
    horaFinMin: minutes(horaFin),
    topeAlumnosLab: 40,
    matriculadosLab: 20,
  }
}

export function buildProgramacionFixtures(alumno: AlumnoFixture): ProgramacionRow[] {
  return courseNames.map((desAsignatura, index) => {
    const codAsignatura = `DEMO-${String(index + 1).padStart(3, '0')}`
    const codDocente = `DOC-${index + 1}`
    const codSeccion = 1
    return {
      codAsignatura,
      desAsignatura,
      codDocente,
      nomDocente: 'DOCENTE',
      apePatDocente: 'DE',
      apeMatDocente: 'DEMOSTRACIÓN',
      ciclo: index < 4 ? 1 : 2,
      creditos: 4,
      codSeccion,
      horario: 1,
      topeAlumnos: 40,
      matriculados: 20,
      horarios: [
        schedule(alumno, codAsignatura, codDocente, codSeccion, 1, days[index % days.length]!, '08:00', '10:00', `A-${index + 1}`, 'T', 'Teoría'),
        schedule(alumno, codAsignatura, codDocente, codSeccion, 2, days[index % days.length]!, '10:00', '11:00', '--', 'P', 'Práctica'),
      ],
    }
  })
}

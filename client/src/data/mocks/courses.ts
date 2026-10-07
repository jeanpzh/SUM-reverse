import type { ApiResponseMap } from '../contracts.ts'
import { mockStudent } from './student.ts'

export const mockCourses = [
  'Matemática I', 'Introducción a la Informática', 'Lenguaje y Comunicación',
  'Metodología del Estudio', 'Estadística', 'Programación I', 'Matemática II', 'Física General',
].map((name, index) => ({ code: `DEMO-${String(index + 1).padStart(3, '0')}`, name,
  credits: 4, cycle: index < 4 ? 1 : 2 }))

const days = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const

export const mockProgramming = mockCourses.map((course, index) => ({
  ciclo: course.cycle, codAsignatura: course.code, desAsignatura: course.name,
  creditos: course.credits, codSeccion: 1, horario: 1,
  codDocente: `DOC-${index + 1}`, nomDocente: 'DOCENTE', apePatDocente: 'DE', apeMatDocente: 'DEMOSTRACIÓN',
  topeAlumnos: 40, matriculados: 20,
  horarios: [{
    codSemestre: null, codFacultad: mockStudent.codFacultad, codEscuela: mockStudent.codEscuela,
    codEspecialidad: mockStudent.codEspecialidad, codPlan: null, codAsignatura: course.code,
    desAsignatura: null, codSeccion: 1, codDocente: `DOC-${index + 1}`, nomDocente: null, horario: 1,
    dia: days[index % days.length], horaInicio: '08:00', horaFin: '10:00',
    horaInicioMin: 480, horaFinMin: 600, codAula: `A-${index + 1}`,
    topeAlumnosLab: 40, matriculadosLab: 20, codTipoHoraAsignatura: 'T', desTipoHoraAsignatura: 'Teoría',
  }, {
    codSemestre: null, codFacultad: mockStudent.codFacultad, codEscuela: mockStudent.codEscuela,
    codEspecialidad: mockStudent.codEspecialidad, codPlan: null, codAsignatura: course.code,
    desAsignatura: null, codSeccion: 1, codDocente: `DOC-${index + 1}`, nomDocente: null, horario: 2,
    dia: days[index % days.length], horaInicio: '10:00', horaFin: '11:00',
    horaInicioMin: 600, horaFinMin: 660, codAula: '--', topeAlumnosLab: 40, matriculadosLab: 20,
    codTipoHoraAsignatura: 'P', desTipoHoraAsignatura: 'Práctica',
  }],
})) satisfies ApiResponseMap['programacion']['data']['programacion']

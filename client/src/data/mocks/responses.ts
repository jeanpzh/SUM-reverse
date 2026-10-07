import type { ApiResponseMap } from '../contracts.ts'
import { mockStudent, mockProfile } from './student.ts'
import { mockCourses, mockProgramming } from './courses.ts'

const envelope = <T>(data: T): { message: null; codError: null; data: T } =>
  ({ message: null, codError: null, data })
const enrolled = mockCourses.slice(0, 3)

export const mockResponses = {
  perfil: envelope(mockProfile),
  formulario: envelope({
    alumno: mockStudent, formulario: {}, politicaPrivacidad: null, llenar: false,
    datosPersonalesCompletado: true, colegioCompletado: true, actividadProfesionalCompletado: true,
    dependenciaEconomicaCompletado: true, recursosEstudioCompletado: true, transporteCompletado: true,
    saludCompletado: true, interesAcademicoCompletado: true, contactoCompletado: true,
  }),
  matriculaInfo: envelope({
    codSemestre: mockStudent.periodo, codFacultad: mockStudent.codFacultad, fechaDB: '2026-08-10',
    fecIniMatInternet: mockStudent.infoMatricula.fecInicioMatInternet,
    fecFinMatInternet: mockStudent.infoMatricula.fecFinMatInternet,
    mensajeMatricula: 'Matrícula de demostración registrada.', mensaje: '',
    indMatHabilitada: true, matriculado: true, indMatCtrlHorario: 'S', valProgramacion: null,
    perfil: { anioIngreso: 2026, anioEstudio: 1, promedio: 15, situAcademica: 'Regular',
      permanencia: 'Regular', semestreSuspension: null, codTipoAutorizacion: null },
    creditaje: { maximo: 24, matriculados: 12 }, amonestaciones: null,
  }),
  programacion: envelope({ alumno: mockStudent, programacion: mockProgramming }),
  prematricula: envelope(enrolled.map((course) => ({
    codFacultad: 1, codEscuela: 1, codEspecialidad: 0, codArea: null, codPlan: mockStudent.codPlan,
    codAsignatura: course.code, desAsignatura: course.name, num_ciclo_ano_asig: course.cycle,
    num_creditaje: course.credits, num_rep_plan_act: 0, num_mat_equiv: 0, num_rep_total: 0,
    ind_etapa: 'Regular', gs_cod_orient: null, gs_tip_asig: null, totales_creditos: 12,
    codSeccion: 1, lisSeccion: null,
  }))),
  matricula: envelope({
    matricula: enrolled.map((course) => ({
      codSemestre: null, codFacultad: 1, desFacultad: mockStudent.desFacultad,
      codEscuela: 1, desEscuela: mockStudent.desEscuela, codEspecialidad: 0,
      codAsignatura: course.code, desAsignatura: course.name, codPlan: mockStudent.codPlan,
      desPlan: mockStudent.desPlan, codSeccion: 1, creditoAsignatura: course.credits,
      numRepitencias: 0, numRepitenciasEquiv: 0, codAlumno: null, nomAlumno: null,
      apePatAlumno: null, apeMatAlumno: null, nomDocente: 'DOCENTE', creditosMatriculados: 12,
      cicloEstudio: course.cycle, horario: 1, codAula: 'A-1', codTurno: null, tipoHorario: null,
      anioIngreso: null, correoIntitucional: null, etapa: null, sexo: 'N', usuarioMatricula: null,
      fechaMatricula: null, apePatDocente: 'DE', apeMatDocente: 'DEMOSTRACIÓN',
    })),
    datosMatricula: { fechaMatricula: '2026-08-10', codOrientacion: '0', tipoMatricula: 'Regular' },
    indMatHabilitadaLabPra: false, codFacultad: 1,
  }),
  horarios: envelope(enrolled.flatMap((course, index) => mockProgramming[index].horarios.map((slot) => ({
    codSemestre: null, codFacultad: 1, desFacultad: null, codEscuela: 1, desEscuela: null,
    codEspecialidad: 0, codAsignatura: course.code, desAsignatura: course.name,
    codPlan: null, desPlan: null, codSeccion: 1, color: index + 1,
    horaInicio: slot.horaInicio, horaFin: slot.horaFin, dia: slot.dia,
    numDia: index + 1, codTipoHoraAsignatura: slot.codTipoHoraAsignatura,
    desTipoHoraAsignatura: slot.desTipoHoraAsignatura,
  })))),
  asistencias: envelope(enrolled.map((course) => ({
    codAlumno: mockStudent.codAlumno, apellidoMaterno: null, apellidoPaterno: null, nombreAlumno: null,
    codSemestre: mockStudent.periodo, codFacultad: 1, codEscuela: 1, codEspecialidad: 0,
    desEspecialidad: mockStudent.desEspecialidad, codPlan: mockStudent.codPlan,
    codAsignatura: course.code, desAsignatura: course.name, codSeccion: 1, numClases: 16,
    cantPresentes: 14, cantFaltas: 1, cantTardanzas: 1, cantAsistencias: 15,
    porcentajePresentes: 87.5, porcentajeFaltas: 6.25, porcentajeTardanzas: 6.25, porcentajeAsistencias: 93.75,
  }))),
  plan: envelope(mockCourses.map((course, index) => ({
    codFacultad: 1, codEscuela: 1, codPlan: '2018  ', codEspecialidad: 0,
    ciclo: course.cycle, codAsignatura: course.code, desAsignatura: course.name,
    creditos: course.credits, tipoAsignatura: 'O', codGrupo: 'GEG',
    codAsignaturaPre: index >= 4 ? mockCourses[index - 4].code : '',
    desAsignaturaPre: index >= 4 ? mockCourses[index - 4].name : '', codGrupoPre: '--', creditosPre: 0,
  }))),
  evaluaciones: envelope([]), tutoria: envelope([]),
  // Assumed empty envelope only; supplied debt contract has no fields.
  deudas: envelope([]),
} satisfies ApiResponseMap

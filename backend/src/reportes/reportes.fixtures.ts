import type {
  DeudaLocalRow, EvaluacionLocalRow, FormularioData, HorarioRow, MatriculaData,
  MatriculaRow, PrematriculaRow,
} from './reportes.types.js'

const student: FormularioData['alumno'] = {
  codAlumno: 'DEMO-001', apePaterno: 'ESTUDIANTE', apeMaterno: 'DE', nomAlumno: 'DEMOSTRACIÓN',
  codFacultad: 1, desFacultad: 'Facultad de Demostración', areaFacultad: 1,
  codEscuela: 1, desEscuela: 'Programa Académico de Demostración', areaEscuela: 1,
  codEspecialidad: 0, desEspecialidad: 'Estudios Generales', codPlan: '2018  ',
  desPlan: 'Plan de Estudios 2018', ponderado: 15, actualizoFormulario: true,
  habEncuesta: false, habEncuestaEgresados: false, habMatricula: true, periodo: '2026-2',
  urlFoto: '', foto: '', codPermanencia: 'R', desPermanencia: 'Regular', codSituacion: 'R',
  desSituacion: 'Regular', regimen: 'Semestral', egresadoEG: 'N', cicloEstudios: 1,
  anioIngreso: 2026, correoInstitucional: 'estudiante@example.test', sexo: 'No especificado',
  nroTicketMatEG: 0,
  infoSemestre: {
    fecSistema: null,
    fecInicioEncuestaDocente: '2026-11-01T00:00:00.000Z', fecFinEncuestaDocente: '2026-12-01T00:00:00.000Z',
    fecInicioEncuestaDocenteS1: '2026-11-01T00:00:00.000Z', fecFinEncuestaDocenteS1: '2026-12-01T00:00:00.000Z',
    fecInicioEncuestaDocenteS2: '2026-11-01T00:00:00.000Z', fecFinEncuestaDocenteS2: '2026-12-01T00:00:00.000Z',
    fecInicioEncuestaDocenteA1: '2026-11-01T00:00:00.000Z', fecFinEncuestaDocenteA1: '2026-12-01T00:00:00.000Z',
    fecInicioEncuestaDocenteA2: '2026-11-01T00:00:00.000Z', fecFinEncuestaDocenteA2: '2026-12-01T00:00:00.000Z',
  },
  infoMatricula: {
    fecInicioMatInternet: '2026-08-01', fecFinMatInternet: '2026-08-15', indMatInternet: 'S',
    indMatObservados: 'N', indMatDeudores: 'N', indMatIngresantes: 'S', indMatExonerados: 'N',
    indMatRepMultiple: 'N', indProgramacionInterna: 'S', indPagosAdicionales: 'N', obsSemMatInternet: null,
    indCertificadoMed: 'N', indHabMatricula: 'S', numMaxRepitencias: 3, indAutoSeguro: 'N',
    indMatCtrlHorario: 'S', sfecInicioMatInternet: '01/08/2026', sfecFinMatInternet: '15/08/2026',
  },
  anioEstudio: 1, codSede: '01', sedeAlumno: 'Sede de Demostración', difCriterioCalif: false,
}

const courseData = [
  { code: 'DEMO-001', name: 'Matemática I' },
  { code: 'DEMO-002', name: 'Introducción a la Informática' },
  { code: 'DEMO-003', name: 'Lenguaje y Comunicación' },
]

const prematricula: PrematriculaRow[] = courseData.map(({ code, name }) => ({
  codFacultad: 1, codEscuela: 1, codEspecialidad: 0, codArea: null, codPlan: student.codPlan,
  codAsignatura: code, desAsignatura: name, num_ciclo_ano_asig: 1, num_creditaje: 4,
  num_rep_plan_act: 0, num_mat_equiv: 0, num_rep_total: 0, ind_etapa: 'Regular',
  gs_cod_orient: null, gs_tip_asig: null, totales_creditos: 12, codSeccion: 1, lisSeccion: null,
}))
const matriculaRows: MatriculaRow[] = courseData.map(({ code, name }, index) => ({
  codSemestre: null, codFacultad: 1, desFacultad: student.desFacultad, codEscuela: 1,
  desEscuela: student.desEscuela, codEspecialidad: 0, codAsignatura: code, desAsignatura: name,
  codPlan: student.codPlan, desPlan: student.desPlan, codSeccion: 1, creditoAsignatura: 4,
  numRepitencias: 0, numRepitenciasEquiv: 0, codAlumno: null, nomAlumno: null, apePatAlumno: null,
  apeMatAlumno: null, nomDocente: 'DOCENTE', creditosMatriculados: 12, cicloEstudio: 1,
  horario: 1, codAula: `A-${index + 1}`, codTurno: null, tipoHorario: null, anioIngreso: null,
  correoIntitucional: null, etapa: null, sexo: 'N', usuarioMatricula: null, fechaMatricula: null,
  apePatDocente: 'DE', apeMatDocente: 'DEMOSTRACIÓN',
}))
const matricula: MatriculaData = {
  matricula: matriculaRows,
  datosMatricula: { fechaMatricula: '2026-08-10', codOrientacion: '0', tipoMatricula: 'Regular' },
  indMatHabilitadaLabPra: false, codFacultad: 1,
}
const days = ['LUNES', 'MARTES', 'MIERCOLES']
const horarios: HorarioRow[] = courseData.flatMap(({ code, name }, index) => [
  { start: '08:00', end: '10:00', type: 'T', typeName: 'Teoría' },
  { start: '10:00', end: '11:00', type: 'P', typeName: 'Práctica' },
].map((slot) => ({
  codSemestre: null, codFacultad: 1, desFacultad: null, codEscuela: 1, desEscuela: null,
  codEspecialidad: 0, codAsignatura: code, desAsignatura: name, codPlan: null, desPlan: null,
  codSeccion: 1, color: index + 1, horaInicio: slot.start, horaFin: slot.end,
  dia: days[index], numDia: index + 1,
  codTipoHoraAsignatura: slot.type, desTipoHoraAsignatura: slot.typeName,
})))
const evaluaciones: EvaluacionLocalRow[] = [{
  ciclo: 1, codAsignatura: 'DEMO-001', desAsignatura: 'Matemática I',
  tipoEvaluacion: 'Evaluación de demostración', calificacion: 16,
  formula: 'Calificación sintética, sin cálculo académico',
}]
const deudas: DeudaLocalRow[] = [{
  fechaRegistro: '2026-08-10', periodoAcademico: '2026-2', concepto: 'Concepto de demostración',
  montoInicial: '100.00', montoFinal: '100.00', observacion: 'Registro sintético, sin pagos reales',
}]
const formulario: FormularioData = {
  alumno: student, formulario: {}, politicaPrivacidad: null, llenar: false,
  datosPersonalesCompletado: true, colegioCompletado: true, actividadProfesionalCompletado: true,
  dependenciaEconomicaCompletado: true, recursosEstudioCompletado: true, transporteCompletado: true,
  saludCompletado: true, interesAcademicoCompletado: true, contactoCompletado: true,
}

export const populatedFixtures = {
  formulario, prematricula, matricula, horarios, evaluaciones, deudas,
}

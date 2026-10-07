import type { ApiResponseMap, StudentRecord } from '../contracts.ts'

const surveyStart = '2026-11-01T00:00:00.000Z'
const surveyEnd = '2026-12-01T00:00:00.000Z'

export const mockStudent = {
  codAlumno: 'DEMO-001', apePaterno: 'ESTUDIANTE', apeMaterno: 'DE', nomAlumno: 'DEMOSTRACIÓN',
  codFacultad: 1, desFacultad: 'Facultad de Demostración', areaFacultad: 1,
  codEscuela: 1, desEscuela: 'Programa Académico de Demostración', areaEscuela: 1,
  codEspecialidad: 0, desEspecialidad: 'Estudios Generales',
  codPlan: '2018  ', desPlan: 'Plan de Estudios 2018', ponderado: 15,
  actualizoFormulario: true, habEncuesta: false, habEncuestaEgresados: false,
  habMatricula: true, periodo: '2026-2', urlFoto: '', foto: '',
  codPermanencia: 'R', desPermanencia: 'Regular', codSituacion: 'R', desSituacion: 'Regular',
  regimen: 'Semestral', egresadoEG: 'N', cicloEstudios: 1, anioIngreso: 2026,
  correoInstitucional: 'estudiante@example.test', sexo: 'No especificado', nroTicketMatEG: 0,
  infoSemestre: {
    fecSistema: null,
    fecInicioEncuestaDocente: surveyStart, fecFinEncuestaDocente: surveyEnd,
    fecInicioEncuestaDocenteS1: surveyStart, fecFinEncuestaDocenteS1: surveyEnd,
    fecInicioEncuestaDocenteS2: surveyStart, fecFinEncuestaDocenteS2: surveyEnd,
    fecInicioEncuestaDocenteA1: surveyStart, fecFinEncuestaDocenteA1: surveyEnd,
    fecInicioEncuestaDocenteA2: surveyStart, fecFinEncuestaDocenteA2: surveyEnd,
  },
  infoMatricula: {
    fecInicioMatInternet: '2026-08-01', fecFinMatInternet: '2026-08-15',
    indMatInternet: 'S', indMatObservados: 'N', indMatDeudores: 'N', indMatIngresantes: 'S',
    indMatExonerados: 'N', indMatRepMultiple: 'N', indProgramacionInterna: 'S',
    indPagosAdicionales: 'N', obsSemMatInternet: null, indCertificadoMed: 'N',
    indHabMatricula: 'S', numMaxRepitencias: 3, indAutoSeguro: 'N', indMatCtrlHorario: 'S',
    sfecInicioMatInternet: '01/08/2026', sfecFinMatInternet: '15/08/2026',
  },
  anioEstudio: 1, codSede: '01', sedeAlumno: 'Sede de Demostración', difCriterioCalif: false,
} satisfies StudentRecord

export const mockProfile = {
  tipoDocumento: 'Documento de demostración', numDocumento: 'DOC-DEMO',
  estadoCivil: 'No especificado', codSexo: 'N', desSexo: 'No especificado',
  fechaNacimiento: '2000-01-01', departamentoNac: 'Lima', provinciaNac: 'Lima', distritoNac: 'Lima',
  telefono: '', celular: '', correoInstitucional: mockStudent.correoInstitucional,
  correoPersonal: 'personal@example.test', departamentoDir: 'Lima', provinciaDir: 'Lima',
  distritoDir: 'Lima', direccion: 'Dirección de demostración', anioIngreso: '2026',
  codTipoIngreso: '01', desTipoIngreso: 'Ingreso de demostración', codColegioProc: 'DEMO',
  desColegioProc: 'Colegio de demostración', anioEstudio: 1, promedio: 15,
  situAcademica: 'Regular', permanencia: 'Regular', codSemUltMat: mockStudent.periodo, promUltMat: 15,
} satisfies ApiResponseMap['perfil']['data']

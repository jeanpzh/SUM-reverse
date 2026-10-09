import type { WireJson, WireJsonObject } from '../../../shared/matricula-wire.mjs'

export type ApiEnvelope<T> = { message: null; codError: null; data: T }

export type MatriculaSnapshotEnvelope = WireJsonObject & {
  message: string | null
  codError: null
  data: WireJson
}

export type PrematriculaWireRow = WireJsonObject & {
  codFacultad: number
  codEscuela: number
  codEspecialidad: number
  codArea: WireJson
  codPlan: string
  codAsignatura: string
  desAsignatura: string
  num_ciclo_ano_asig: number
  num_creditaje: number
  num_rep_plan_act: number
  num_mat_equiv: number
  num_rep_total: number
  ind_etapa: string
  gs_cod_orient: WireJson
  gs_tip_asig: WireJson
  totales_creditos: number
  codSeccion: number
  lisSeccion: WireJson
}

export type MatriculaWireRow = WireJsonObject & {
  codSemestre: WireJson
  codFacultad: number
  desFacultad: string
  codEscuela: number
  desEscuela: string
  codEspecialidad: number
  codAsignatura: string
  desAsignatura: string
  codPlan: string
  desPlan: string
  codSeccion: number
  creditoAsignatura: number
  numRepitencias: number
  numRepitenciasEquiv: number
  codAlumno: WireJson
  nomAlumno: WireJson
  apePatAlumno: WireJson
  apeMatAlumno: WireJson
  nomDocente: string
  creditosMatriculados: number
  cicloEstudio: number
  horario: number
  codAula: string
  codTurno: WireJson
  tipoHorario: WireJson
  anioIngreso: WireJson
  correoIntitucional: WireJson
  etapa: WireJson
  sexo: string
  usuarioMatricula: WireJson
  fechaMatricula: WireJson
  apePatDocente: string
  apeMatDocente: string
}

export type MatriculaWireData = WireJsonObject & {
  matricula: MatriculaWireRow[]
  datosMatricula: WireJsonObject & {
    fechaMatricula: string
    codOrientacion: string
    tipoMatricula: string
  }
  indMatHabilitadaLabPra: boolean
  codFacultad: number
}

export type HorarioWireRow = WireJsonObject & {
  codSemestre: WireJson
  codFacultad: number
  desFacultad: WireJson
  codEscuela: number
  desEscuela: WireJson
  codEspecialidad: number
  codAsignatura: string
  desAsignatura: string
  codPlan: WireJson
  desPlan: WireJson
  codSeccion: number
  color: number
  horaInicio: string
  horaFin: string
  dia: string
  numDia: number
  codTipoHoraAsignatura: string
  desTipoHoraAsignatura: string
}

export type PrematriculaRow = {
  codFacultad: number; codEscuela: number; codEspecialidad: number; codArea: null
  codPlan: string; codAsignatura: string; desAsignatura: string; num_ciclo_ano_asig: number
  num_creditaje: number; num_rep_plan_act: number; num_mat_equiv: number; num_rep_total: number
  ind_etapa: string; gs_cod_orient: null; gs_tip_asig: null; totales_creditos: number
  codSeccion: number; lisSeccion: null
}
export type MatriculaRow = {
  codSemestre: null; codFacultad: number; desFacultad: string; codEscuela: number; desEscuela: string
  codEspecialidad: number; codAsignatura: string; desAsignatura: string; codPlan: string; desPlan: string
  codSeccion: number; creditoAsignatura: number; numRepitencias: number; numRepitenciasEquiv: number
  codAlumno: null; nomAlumno: null; apePatAlumno: null; apeMatAlumno: null; nomDocente: string
  creditosMatriculados: number; cicloEstudio: number; horario: number; codAula: string; codTurno: null
  tipoHorario: null; anioIngreso: null; correoIntitucional: null; etapa: null; sexo: string
  usuarioMatricula: null; fechaMatricula: null; apePatDocente: string; apeMatDocente: string
}
export type MatriculaData = {
  matricula: MatriculaRow[]
  datosMatricula: { fechaMatricula: string; codOrientacion: string; tipoMatricula: string }
  indMatHabilitadaLabPra: boolean; codFacultad: number
}
export type HorarioRow = {
  codSemestre: null; codFacultad: number; desFacultad: null; codEscuela: number; desEscuela: null
  codEspecialidad: number; codAsignatura: string; desAsignatura: string; codPlan: null; desPlan: null
  codSeccion: number; color: number; horaInicio: string; horaFin: string; dia: string; numDia: number
  codTipoHoraAsignatura: string; desTipoHoraAsignatura: string
}
export type EvaluacionLocalRow = {
  ciclo: number; codAsignatura: string; desAsignatura: string; tipoEvaluacion: string
  calificacion: number; formula: string
}
export type DeudaLocalRow = {
  fechaRegistro: string; periodoAcademico: string; concepto: string; montoInicial: string
  montoFinal: string; observacion: string
}

export type AlumnoFixture = {
  codAlumno: string; apePaterno: string; apeMaterno: string; nomAlumno: string
  codFacultad: number; desFacultad: string; areaFacultad: number; codEscuela: number
  desEscuela: string; areaEscuela: number; codEspecialidad: number; desEspecialidad: string
  codPlan: string; desPlan: string; ponderado: number; actualizoFormulario: boolean
  habEncuesta: boolean; habEncuestaEgresados: boolean; habMatricula: boolean; periodo: string
  urlFoto: string; foto: string; codPermanencia: string; desPermanencia: string
  codSituacion: string; desSituacion: string; regimen: string; egresadoEG: string
  cicloEstudios: number; anioIngreso: number; correoInstitucional: string; sexo: string
  nroTicketMatEG: number
  infoSemestre: Record<string, string | null>
  infoMatricula: Record<string, string | number | null>
  anioEstudio: number; codSede: string; sedeAlumno: string; difCriterioCalif: boolean
}
export type FormularioData = {
  alumno: AlumnoFixture; formulario: Record<string, never>; politicaPrivacidad: null; llenar: false
  datosPersonalesCompletado: true; colegioCompletado: true; actividadProfesionalCompletado: true
  dependenciaEconomicaCompletado: true; recursosEstudioCompletado: true; transporteCompletado: true
  saludCompletado: true; interesAcademicoCompletado: true; contactoCompletado: true
}

export type ReportesDataMap = {
  prematricula: PrematriculaRow[]
  matricula: MatriculaData
  horarios: HorarioRow[]
  evaluaciones: EvaluacionLocalRow[]
  deudas: DeudaLocalRow[]
  formulario: FormularioData
}
export type ReporteKey = Exclude<keyof ReportesDataMap, 'formulario'>
export type ConsultaKey = keyof ReportesDataMap

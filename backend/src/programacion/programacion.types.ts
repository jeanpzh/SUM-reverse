import type { AlumnoFixture } from '../reportes/reportes.types.js'
import type { WireJson, WireJsonObject } from '../../../shared/matricula-wire.mjs'

export type HorarioProgramacion = {
  codSemestre: null
  codPlan: null
  desAsignatura: null
  nomDocente: null
  codAsignatura: string
  codDocente: string
  dia: string
  horaInicio: string
  horaFin: string
  codAula: string
  codTipoHoraAsignatura: string
  desTipoHoraAsignatura: string
  codFacultad: number
  codEscuela: number
  codEspecialidad: number
  codSeccion: number
  horario: number
  horaInicioMin: number
  horaFinMin: number
  topeAlumnosLab: number
  matriculadosLab: number
}

export type ProgramacionRow = {
  codAsignatura: string
  desAsignatura: string
  codDocente: string
  nomDocente: string
  apePatDocente: string
  apeMatDocente: string
  ciclo: number
  creditos: number
  codSeccion: number
  horario: number
  topeAlumnos: number
  matriculados: number
  horarios: HorarioProgramacion[]
}

export type ProgramacionWireAlumno = WireJsonObject & {
  codAlumno: string
  apePaterno: string
  apeMaterno: string
  nomAlumno: string
  codFacultad: number
  desFacultad: string
  areaFacultad: number
  codEscuela: number
  desEscuela: string
  areaEscuela: number
  codEspecialidad: number
  desEspecialidad: string
  codPlan: string
  desPlan: string
  ponderado: number
  actualizoFormulario: boolean
  habEncuesta: boolean
  habEncuestaEgresados: boolean
  habMatricula: boolean
  periodo: string
  urlFoto: string
  foto: string
  codPermanencia: string
  desPermanencia: string
  codSituacion: string
  desSituacion: string
  regimen: string
  egresadoEG: string
  cicloEstudios: number
  anioIngreso: number
  correoInstitucional: string
  sexo: string
  nroTicketMatEG: number
  infoSemestre: WireJsonObject
  infoMatricula: WireJsonObject
  anioEstudio: number
  codSede: string
  sedeAlumno: string
  difCriterioCalif: boolean
}

export type ProgramacionWireHorario = WireJsonObject & {
  codSemestre: WireJson
  codFacultad: number
  codEscuela: number
  codEspecialidad: number
  codPlan: WireJson
  codAsignatura: string
  desAsignatura: WireJson
  codSeccion: number
  codDocente: string
  nomDocente: WireJson
  horario: number
  dia: string
  horaInicio: string
  horaFin: string
  horaInicioMin: number
  horaFinMin: number
  codAula: string
  topeAlumnosLab: number
  matriculadosLab: number
  codTipoHoraAsignatura: string
  desTipoHoraAsignatura: string
}

export type ProgramacionWireRow = WireJsonObject & {
  ciclo: number
  codAsignatura: string
  desAsignatura: string
  creditos: number
  codSeccion: number
  horario: number
  codDocente: string
  nomDocente: string
  apePatDocente: string
  apeMatDocente: string
  topeAlumnos: number
  matriculados: number
  horarios: ProgramacionWireHorario[]
}

export type ProgramacionData = {
  alumno: AlumnoFixture | ProgramacionWireAlumno
  programacion: ProgramacionRow[] | ProgramacionWireRow[]
} & WireJsonObject
export type ProgramacionEnvelope = WireJsonObject & {
  message: string | null
  codError: null
  data: ProgramacionData
}
export type ConsultaProgramacionDto = { accion: 'obtenerProgramacionAsignaturas' }

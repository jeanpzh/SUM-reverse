export type SeccionMatriculaId =
  | 'cronograma'
  | 'acceso-facultad'
  | 'prematricula'
  | 'deudas'
  | 'interfaz'

export type SeccionMatricula = {
  id: SeccionMatriculaId
  titulo: string
  descripcion: string
}

export type ArticuloMatricula = {
  introduccion: string
  secciones: SeccionMatricula[]
}

export type ArticuloMatriculaData = {
  codSemestre: string
  articulo: ArticuloMatricula | null
}

export type MatriculaInformacionWireData = WireJsonObject & {
  codSemestre: string
  codFacultad: number
  fechaDB: string
  fecIniMatInternet: string
  fecFinMatInternet: string
  mensajeMatricula: string
  mensaje: string
  indMatHabilitada: boolean
  matriculado: boolean
  indMatCtrlHorario: string
  valProgramacion: WireJson
  perfil: WireJsonObject
  creditaje: Record<string, number>
  amonestaciones: WireJson
}

export type MatriculaInformacionData = ArticuloMatriculaData | MatriculaInformacionWireData

export type MatriculaInformacionEnvelope = WireJsonObject & {
  message: string | null
  codError: null
  data: MatriculaInformacionData
}
import type { WireJson, WireJsonObject } from '../../../shared/matricula-wire.mjs'

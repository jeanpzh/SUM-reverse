import type { WireJson, WireJsonObject } from './matricula-wire.mjs'

export declare const miInformacionWireKeys: readonly [
  'perfil',
  'historial',
  'formularioDatos',
  'fichaSocioeconomica',
]

export type MiInformacionWireKey = (typeof miInformacionWireKeys)[number]
export type MiInformacionRepresentation = 'candidate-v1' | 'local-v1' | 'opaque'
export type MiInformacionWireEnvelope = WireJsonObject & {
  message: string | null
  codError: null
  data: WireJson
}

export type HistorialCandidateRow = WireJsonObject & {
  codAlumno: WireJson
  codSemestre: string
  codFacultad: number
  codEscuela: number
  codEspecialidad: number
  codPlan: string
  codSeccion: number
  ciclo: number
  codTipoAsignatura: string
  creditos: number
  codAsignatura: string
  desAsignatura: string
  calificacion: number
  codTipoActa: string
  numActa: string
  numResConv: WireJson
}

export type HistorialCandidatePromedio = WireJsonObject & {
  semestre: string
  promedio: number
}

export type HistorialCandidateData = WireJsonObject & {
  historial: HistorialCandidateRow[]
  promedios: HistorialCandidatePromedio[]
  creditaje: Record<string, number>
  criterioCalificacion: boolean
  anioIngreso: number
  facultad: number
  escuela: number
}

export declare class MiInformacionWireValidationError extends Error {}

export declare function validateMiInformacionWire(
  key: MiInformacionWireKey,
  value: unknown,
  representation: MiInformacionRepresentation,
): asserts value is MiInformacionWireEnvelope

import type { WireJsonObject } from './matricula-wire.mjs'

export type PlanEstudiosRepresentation = 'candidate-v1' | 'local-v1'

export type PlanEstudiosWireRow = WireJsonObject & {
  codFacultad: number
  codEscuela: number
  codPlan: '2018  '
  codEspecialidad: number
  ciclo: number
  codAsignatura: string
  desAsignatura: string
  creditos: number
  tipoAsignatura: 'E' | 'O'
  codGrupo: 'GEG' | '--'
  codAsignaturaPre: string
  desAsignaturaPre: string
  codGrupoPre: 'GEG' | '--'
  creditosPre: number
}

export type PlanEstudiosWireEnvelope = WireJsonObject & {
  message: string | null
  codError: null
  data: PlanEstudiosWireRow[]
}

export declare class PlanEstudiosWireValidationError extends Error {}

export declare function validatePlanEstudiosWire(
  value: unknown,
): asserts value is PlanEstudiosWireEnvelope

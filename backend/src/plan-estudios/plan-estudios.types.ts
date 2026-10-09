import type {
  PlanEstudiosRepresentation,
  PlanEstudiosWireEnvelope,
} from '../../../shared/plan-estudios-wire.mjs'

export type PlanEstudiosRow = {
  codPlan: string
  codAsignatura: string
  desAsignatura: string
  codAsignaturaPre: string
  desAsignaturaPre: string
  codFacultad: number
  codEscuela: number
  codEspecialidad: number
  ciclo: number
  creditos: number
  creditosPre: number
  tipoAsignatura: 'O' | 'E'
  codGrupo: 'GEG' | '--'
  codGrupoPre: 'GEG' | '--'
}

export type PlanEstudiosEnvelope = { message: null; codError: null; data: PlanEstudiosRow[] }
export type ConsultaPlanEstudiosDto = { accion: 'obtenerPlanEstudios' }

export type PlanEstudiosSnapshotState =
  | { kind: 'disabled' }
  | { kind: 'missing' }
  | { kind: 'snapshot'; envelope: PlanEstudiosWireEnvelope }

export type PlanEstudiosConsultation = {
  representation: PlanEstudiosRepresentation
  envelope: PlanEstudiosEnvelope | PlanEstudiosWireEnvelope
}

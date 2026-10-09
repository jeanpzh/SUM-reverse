import type { MiPerfil } from '../../../raw-types/mi-perfil.ts'
import type { MatriculaFormularioDatos } from '../../../raw-types/matricula-formulario-datos.ts'
import type { MatriculaInformacion as EnrollmentInformation } from '../../../raw-types/matricula-info.ts'
import type { MatriculaInformacion as CourseProgramming } from '../../../raw-types/programacion-asignaturas.ts'
import type { ReportePreMatricula } from '../../../raw-types/reporte-pre-matricula.ts'
import type { ReporteMatricula } from '../../../raw-types/reporte-matricula.ts'
import type { ReporteHorario } from '../../../raw-types/reporte-horario.ts'
import type { Asistencias } from '../../../raw-types/mis-asistencias.ts'
import type { Tutoria } from '../../../raw-types/tutoria.ts'
import type { PlanEstudios } from '../../../raw-types/plan-studios.ts'
import type { MatriculaInformacionLocalData } from './matriculaInformacion.ts'
import type { PerfilLocal, FormularioCandidateData, FormularioLocalData, MiFichaResponse, MiHistorialResponse } from './miInformacion.ts'
import type { MiInformacionWireEnvelope } from '../../../shared/mi-informacion-wire.mjs'
import type { PlanEstudiosWireEnvelope } from '../../../shared/plan-estudios-wire.mjs'
import type { MatriculaWireKey, WireEnvelope, WireShape } from './matriculaWire.ts'

// Raw Date fields describe parsed objects; on the JSON wire they are ISO strings.
export type JsonValue<T> = T extends null | undefined ? T
  : T extends Date ? string
  : T extends (infer Item)[] ? JsonValue<Item>[]
  : T extends object ? { [Key in keyof T]: JsonValue<T[Key]> }
  : T

export type LocalReportEnvelope<T> = { message: null; codError: null; data: T }
type MiReportEnvelope<T> = Omit<MiInformacionWireEnvelope, 'data'> & { data: T }

export type EvaluacionLocalRow = {
  ciclo: number
  codAsignatura: string
  desAsignatura: string
  tipoEvaluacion: string
  calificacion: number
  formula: string
}

export type DeudaLocalRow = {
  fechaRegistro: string
  periodoAcademico: string
  concepto: string
  montoInicial: string
  montoFinal: string
  observacion: string
}

export type ApiResponseMap = {
  perfil: JsonValue<MiPerfil> | LocalReportEnvelope<PerfilLocal> | MiReportEnvelope<PerfilLocal>
  formulario: JsonValue<MatriculaFormularioDatos> | LocalReportEnvelope<FormularioLocalData> | MiReportEnvelope<FormularioCandidateData>
  historial: MiHistorialResponse
  fichaSocioeconomica: MiFichaResponse
  matriculaInfo: WireEnvelope<WireShape<EnrollmentInformation['data']>>
    | LocalReportEnvelope<MatriculaInformacionLocalData>
  programacion: WireEnvelope<WireShape<CourseProgramming['data']>>
  prematricula: WireEnvelope<WireShape<ReportePreMatricula['data']>>
  matricula: WireEnvelope<WireShape<ReporteMatricula['data']>>
  horarios: WireEnvelope<WireShape<ReporteHorario['data']>>
  evaluaciones: LocalReportEnvelope<EvaluacionLocalRow[]>
  deudas: LocalReportEnvelope<DeudaLocalRow[]>
  asistencias: JsonValue<Asistencias>
  tutoria: JsonValue<Tutoria>
  plan: JsonValue<PlanEstudios> | PlanEstudiosWireEnvelope
}

export type EndpointKey = keyof ApiResponseMap
export type StudentRecord = JsonValue<MatriculaFormularioDatos>['data']['alumno']
export type MatriculaSnapshotKey = MatriculaWireKey

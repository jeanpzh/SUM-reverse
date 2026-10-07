import type { MiPerfil } from '../../../raw-types/mi-perfil.ts'
import type { MatriculaFormularioDatos } from '../../../raw-types/matricula-formulario-datos.ts'
import type { MatriculaInformacion as EnrollmentInformation } from '../../../raw-types/matricula-info.ts'
import type { MatriculaInformacion as CourseProgramming } from '../../../raw-types/programacion-asignaturas.ts'
import type { ReportePreMatricula } from '../../../raw-types/reporte-pre-matricula.ts'
import type { ReporteMatricula } from '../../../raw-types/reporte-matricula.ts'
import type { ReporteHorario } from '../../../raw-types/reporte-horario.ts'
import type { ReporteEvaluaciones } from '../../../raw-types/reporte-evaluaciones.ts'
import type { Asistencias } from '../../../raw-types/mis-asistencias.ts'
import type { Tutoria } from '../../../raw-types/tutoria.ts'
import type { PlanEstudios } from '../../../raw-types/plan-studios.ts'

// Raw Date fields describe parsed objects; on the JSON wire they are ISO strings.
export type JsonValue<T> = T extends null | undefined ? T
  : T extends Date ? string
  : T extends (infer Item)[] ? JsonValue<Item>[]
  : T extends object ? { [Key in keyof T]: JsonValue<T[Key]> }
  : T

export type ApiResponseMap = {
  perfil: JsonValue<MiPerfil>
  formulario: JsonValue<MatriculaFormularioDatos>
  matriculaInfo: JsonValue<EnrollmentInformation>
  programacion: JsonValue<CourseProgramming>
  prematricula: JsonValue<ReportePreMatricula>
  matricula: JsonValue<ReporteMatricula>
  horarios: JsonValue<ReporteHorario>
  evaluaciones: JsonValue<ReporteEvaluaciones>
  deudas: unknown // The supplied reporte-deudas.ts is empty.
  asistencias: JsonValue<Asistencias>
  tutoria: JsonValue<Tutoria>
  plan: JsonValue<PlanEstudios>
}

export type EndpointKey = keyof ApiResponseMap
export type StudentRecord = ApiResponseMap['formulario']['data']['alumno']

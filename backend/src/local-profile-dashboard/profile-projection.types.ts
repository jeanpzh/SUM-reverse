import type { DashboardKey } from '../../../shared/local-profile-dashboard.mjs'
import type { ActorProfile } from '../matricula-regular/profile.types.js'
import type { AsistenciaEnvelope } from '../asistencias/asistencias.types.js'
import type {
  FichaSocioeconomica,
  FormularioExtendido,
  HistorialAcademico,
  PerfilAlumno,
} from '../mi-informacion/mi-informacion.types.js'
import type {
  AlumnoFixture,
  ApiEnvelope,
  DeudaLocalRow,
  EvaluacionLocalRow,
} from '../reportes/reportes.types.js'
import type { TutoriaEnvelope } from '../tutoria/tutoria.types.js'

export type CompatibleKey = Exclude<DashboardKey,
  'matriculaInfo' | 'programacion' | 'prematricula' | 'plan' | 'matricula' | 'horarios'>

export type LocalFormularioData = Omit<FormularioExtendido,
  'datosPersonalesCompletado' | 'colegioCompletado' | 'actividadProfesionalCompletado'
  | 'dependenciaEconomicaCompletado' | 'recursosEstudioCompletado' | 'transporteCompletado'
  | 'saludCompletado' | 'interesAcademicoCompletado' | 'contactoCompletado'> & {
  datosPersonalesCompletado: false
  colegioCompletado: false
  actividadProfesionalCompletado: false
  dependenciaEconomicaCompletado: false
  recursosEstudioCompletado: false
  transporteCompletado: false
  saludCompletado: false
  interesAcademicoCompletado: false
  contactoCompletado: false
}

export type CompatiblePayloadMap = {
  perfil: ApiEnvelope<PerfilAlumno> | null
  formulario: LocalFormularioData
  historial: HistorialAcademico
  fichaSocioeconomica: FichaSocioeconomica
  evaluaciones: ApiEnvelope<EvaluacionLocalRow[]>
  deudas: ApiEnvelope<DeudaLocalRow[]>
  asistencias: AsistenciaEnvelope
  tutoria: TutoriaEnvelope
}

export type CompatiblePayload<K extends CompatibleKey> = CompatiblePayloadMap[K]
export type { ActorProfile, AlumnoFixture }

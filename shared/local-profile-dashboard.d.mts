import type {
  MatriculaRegularContext,
  MatriculaRegularEnrollmentReport,
  MatriculaRegularEnvelope,
  MatriculaRegularScope,
  MatriculaRegularUuid,
} from './matricula-regular.mjs'

export declare const dashboardKeys: readonly [
  'perfil',
  'formulario',
  'historial',
  'fichaSocioeconomica',
  'matriculaInfo',
  'programacion',
  'prematricula',
  'matricula',
  'horarios',
  'evaluaciones',
  'deudas',
  'asistencias',
  'tutoria',
  'plan',
]

export type ActorId = 'SYN-SIS-A' | 'SYN-SIS-B' | 'SYN-SOFT-A' | 'SYN-SOFT-B'
export type DashboardKey = (typeof dashboardKeys)[number]
export type AcademicKey = 'matriculaInfo' | 'programacion' | 'prematricula' | 'plan'
export type ReportKey = 'matricula' | 'horarios'

export interface Identity {
  runId: MatriculaRegularUuid
  actorId: ActorId
  sessionId: MatriculaRegularUuid
}

export interface ProfileChoice {
  actorId: ActorId
  name: string
  scope: MatriculaRegularScope
}

export interface ProfileCatalog {
  serverNow: string
  profiles: ProfileChoice[]
}

export declare const scenarioIds: readonly ['regular', 'repitencia', 'tutoria', 'prerrequisito', 'cruce', 'cupo', 'deuda', 'gap-horario', 'prioridad']
export type ScenarioId = (typeof scenarioIds)[number]
export interface ScenarioProfile {
  actorId: ActorId
  summary: string
  recommendedCourseIds: string[]
  expectedResult: string
}
export interface ScenarioChoice {
  scenarioId: ScenarioId
  label: string
  description: string
  profiles: ScenarioProfile[]
}
export interface ScenarioCatalog {
  serverNow: string
  currentScenarioId: ScenarioId | null
  scenarios: ScenarioChoice[]
}
export interface ScenarioSelectionRequest {
  runId: MatriculaRegularUuid
  scenarioId: ScenarioId
}
export declare function validateScenarioId(value: unknown): asserts value is ScenarioId
export declare function validateScenarioSelectionRequest(value: unknown): asserts value is ScenarioSelectionRequest
export declare function validateScenarioCatalogResponse(value: unknown): asserts value is MatriculaRegularEnvelope<ScenarioCatalog>

export type DashboardPayloadMap<LegacyMap> = Omit<LegacyMap, AcademicKey | ReportKey | 'perfil'> & {
  perfil: (LegacyMap extends { perfil: infer P } ? P : never) | null
  plan: (LegacyMap extends { plan: infer P } ? P : never) | MatriculaRegularContext
  programacion: (LegacyMap extends { programacion: infer P } ? P : never) | MatriculaRegularContext
} & Record<Exclude<AcademicKey, 'plan' | 'programacion'>, MatriculaRegularContext> &
  Record<ReportKey, MatriculaRegularEnrollmentReport | null>

export interface DashboardRead<K extends DashboardKey, P> {
  actorId: ActorId
  sessionId: MatriculaRegularUuid
  key: K
  serverNow: string
  payload: P
}

export declare function validateDashboardKey(value: unknown): asserts value is DashboardKey
export declare function validateDashboardIdentity(value: unknown): asserts value is Identity
export declare function validateProfileCatalogResponse(
  value: unknown,
): asserts value is MatriculaRegularEnvelope<ProfileCatalog>
export declare function validateDashboardReadResponse<K extends DashboardKey, P>(
  value: unknown,
  expected: Identity & { key: K },
  validatePayload: (payload: unknown) => asserts payload is P,
): asserts value is MatriculaRegularEnvelope<DashboardRead<K, P>>

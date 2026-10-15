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

export type DashboardPayloadMap<LegacyMap> = Omit<LegacyMap, AcademicKey | ReportKey | 'perfil'> & {
  perfil: null
} & Record<AcademicKey, MatriculaRegularContext> &
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

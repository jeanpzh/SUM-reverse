import {
  validateDashboardIdentity,
  validateDashboardKey,
  validateDashboardReadResponse,
  validateProfileCatalogResponse,
  validateScenarioCatalogResponse,
  validateScenarioSelectionRequest,
} from '../../../shared/local-profile-dashboard.mjs'
import type {
  AcademicKey,
  DashboardKey,
  DashboardPayloadMap,
  DashboardRead,
  Identity,
  ProfileCatalog,
  ReportKey,
  ScenarioCatalog,
  ScenarioSelectionRequest,
} from '../../../shared/local-profile-dashboard.mjs'
import { validateContextResponse, validateEnrollmentReportResponse, validateErrorResponse } from '../../../shared/matricula-regular.mjs'
import type { MatriculaRegularContext, MatriculaRegularEnrollmentReport, MatriculaRegularEnvelope, MatriculaRegularErrorResponse } from '../../../shared/matricula-regular.mjs'
import type { ApiResponseMap, EndpointKey } from './contracts.ts'
import { parseResponse } from './transport.ts'
import type { MatriculaRegularId } from '../../../shared/matricula-regular.mjs'

export type LocalProfilePayloadMap = DashboardPayloadMap<ApiResponseMap>
export type LocalProfileCatalogResponse = MatriculaRegularEnvelope<ProfileCatalog>
export type LocalProfileRead<K extends DashboardKey> = MatriculaRegularEnvelope<DashboardRead<K, LocalProfilePayloadMap[K]>>

export type LocalProfileOperation = 'catalog' | 'read' | 'scenarios' | 'select-scenario'
export type LocalProfileApiErrorKind = 'network' | 'aborted' | 'http' | 'protocol' | 'stale' | 'inactive' | 'configuration'

export class LocalProfileApiError extends Error {
  readonly kind: LocalProfileApiErrorKind
  readonly operation: LocalProfileOperation
  readonly status?: number
  readonly code?: string
  readonly fields: readonly string[]
  readonly runId?: string
  readonly retryable: boolean

  constructor(input: {
    kind: LocalProfileApiErrorKind
    operation: LocalProfileOperation
    message: string
    status?: number
    code?: string
    fields?: readonly string[]
    runId?: string
    retryable?: boolean
  }) {
    super(input.message)
    this.name = 'LocalProfileApiError'
    this.kind = input.kind
    this.operation = input.operation
    this.status = input.status
    this.code = input.code
    this.fields = input.fields ?? []
    this.runId = input.runId
    this.retryable = input.retryable ?? false
  }
}

export function readLocalProfileActivation(input: { mode?: string; profile?: string }): 'legacy' | 'synthetic-actors' {
  const mode = input.mode?.trim() ?? ''
  const profile = input.profile?.trim() ?? ''
  if (!profile) return 'legacy'
  if (mode !== 'local' || profile !== 'synthetic-actors') {
    throw new LocalProfileApiError({ kind: 'configuration', operation: 'catalog',
      message: 'El perfil sintético requiere VITE_SUM_DATA_MODE=local y VITE_SUM_LOCAL_PROFILE=synthetic-actors.' })
  }
  return 'synthetic-actors'
}

type RequestOptions = { signal?: AbortSignal }
const prefix = '/api/local/perfiles/v1'
const academicKeys = new Set<DashboardKey>(['matriculaInfo', 'programacion', 'prematricula', 'plan'])
const reportKeys = new Set<DashboardKey>(['matricula', 'horarios'])
const compatibleKeys = new Set<DashboardKey>([
  'perfil', 'formulario', 'historial', 'fichaSocioeconomica', 'evaluaciones', 'deudas', 'asistencias', 'tutoria',
])

function errorFor(operation: LocalProfileOperation, kind: LocalProfileApiErrorKind, message: string,
  details: Partial<Pick<LocalProfileApiError, 'status' | 'code' | 'fields' | 'runId' | 'retryable'>> = {}) {
  return new LocalProfileApiError({ operation, kind, message, ...details })
}

async function json(response: Response, operation: LocalProfileOperation): Promise<unknown> {
  if (!/application\/(?:[\w.-]+\+)?json/i.test(response.headers.get('content-type') ?? '')) {
    throw errorFor(operation, 'protocol', 'La API local de perfiles no devolvió JSON.', { status: response.status })
  }
  try {
    return await response.json() as unknown
  } catch {
    throw errorFor(operation, 'protocol', 'La API local de perfiles devolvió JSON inválido.', { status: response.status })
  }
}

function parseHttpError(value: unknown, operation: LocalProfileOperation, status: number, expectedRunId?: string): never {
  if (status === 401 || status === 403) {
    const error = value && typeof value === 'object' && 'error' in value ? (value as { error: unknown }).error : null
    if (!error || typeof error !== 'object' || !('code' in error) || !('fields' in error)
      || !Array.isArray((error as { fields: unknown }).fields)
      || !(error as { fields: unknown[] }).fields.every((field) => typeof field === 'string')) {
      throw errorFor(operation, 'protocol', 'La respuesta de acceso local no cumple el contrato.', { status })
    }
    const code = typeof (error as { code: unknown }).code === 'string' ? (error as { code: string }).code : 'UNAUTHENTICATED'
    throw errorFor(operation, 'http', `La API local respondió ${code}.`, { status, code })
  }
  try {
    const assertErrorResponse: (response: unknown) => asserts response is MatriculaRegularErrorResponse = validateErrorResponse
    assertErrorResponse(value)
  } catch {
    throw errorFor(operation, 'protocol', 'La respuesta de error local no cumple el contrato.', { status })
  }
  const envelope = value as MatriculaRegularErrorResponse
  const problem = envelope.error
  if (expectedRunId !== undefined && envelope.runId !== expectedRunId && problem.code !== 'RUN_CHANGED') {
    throw errorFor(operation, 'protocol', 'La respuesta de error local pertenece a otra ejecución.', { status })
  }
  throw errorFor(operation, 'http', `La API local de perfiles respondió ${problem.code}.`, {
    status, code: problem.code, fields: problem.fields, runId: envelope.runId,
  })
}

function validatePayload<K extends DashboardKey>(key: K, payload: unknown, runId: string, actorId: MatriculaRegularId): asserts payload is LocalProfilePayloadMap[K] {
  if (key === 'perfil') {
    if (payload !== null) parseResponse('perfil', payload, true, 'local-v1')
    return
  }
  if ((key === 'plan' || key === 'programacion') && payload && typeof payload === 'object' && 'data' in payload) {
    parseResponse(key, payload, true, undefined, key === 'plan' ? 'candidate-v1' : undefined)
    return
  }
  if (academicKeys.has(key)) {
    validateContextResponse({ runId, data: payload }, runId, actorId)
    return
  }
  if (reportKeys.has(key)) {
    if (payload === null) return
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('report: objeto esperado')
    const report = payload as MatriculaRegularEnrollmentReport
    validateEnrollmentReportResponse({ runId, data: report }, {
      runId, actorId, enrollmentId: report.enrollmentId,
    })
    return
  }
  if (isCompatibleKey(key)) {
    parseResponse(key as Extract<EndpointKey, 'perfil' | 'formulario' | 'historial' | 'fichaSocioeconomica' | 'evaluaciones' | 'deudas' | 'asistencias' | 'tutoria'>,
      payload, true, key === 'perfil' || key === 'historial' || key === 'formulario' || key === 'fichaSocioeconomica' ? 'local-v1' : undefined)
    return
  }
  throw new TypeError(`Clave no cubierta: ${key}`)
}

function isCompatibleKey(key: DashboardKey): key is Extract<DashboardKey,
  'perfil' | 'formulario' | 'historial' | 'fichaSocioeconomica' | 'evaluaciones' | 'deudas' | 'asistencias' | 'tutoria'> {
  return compatibleKeys.has(key)
}

export function createLocalProfileDashboardApi(options: { fetchImpl?: typeof fetch; publicAccess?: boolean } = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)

  async function request<T>(operation: LocalProfileOperation, path: string, signal?: AbortSignal,
    validate?: (value: unknown) => asserts value is T, expectedRunId?: string,
    command?: ScenarioSelectionRequest): Promise<T> {
    if (signal?.aborted) throw errorFor(operation, 'aborted', 'La consulta local fue cancelada.')
    let response: Response
    try {
      response = await fetchImpl(`${prefix}${path}`, {
        method: command ? 'POST' : 'GET',
        headers: command ? { Accept: 'application/json', 'Content-Type': 'application/json' } : { Accept: 'application/json' },
        ...(command ? { body: JSON.stringify(command) } : {}),
        credentials: options.publicAccess ? 'include' : 'omit', signal,
      })
    } catch (cause) {
      if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) {
        throw errorFor(operation, 'aborted', 'La consulta local fue cancelada.')
      }
      throw errorFor(operation, 'network', 'No se recibió respuesta de la API local de perfiles.', { retryable: true })
    }
    const value = await json(response, operation)
    if (!response.ok) parseHttpError(value, operation, response.status, expectedRunId)
    try {
      if (!validate) throw new TypeError('Se requiere validador')
      const assertValue: (item: unknown) => asserts item is T = validate
      assertValue(value)
    } catch {
      throw errorFor(operation, 'protocol', 'La respuesta de la API local de perfiles no cumple el contrato.', { status: response.status })
    }
    return value as T
  }

  return {
    catalog(requestOptions: RequestOptions = {}): Promise<LocalProfileCatalogResponse> {
      return request('catalog', '/perfiles', requestOptions.signal, validateProfileCatalogResponse)
    },

    scenarios(requestOptions: RequestOptions = {}): Promise<MatriculaRegularEnvelope<ScenarioCatalog>> {
      return request('scenarios', '/escenarios', requestOptions.signal, validateScenarioCatalogResponse)
    },

    async selectScenario(command: ScenarioSelectionRequest, requestOptions: RequestOptions = {}): Promise<LocalProfileCatalogResponse> {
      try {
        validateScenarioSelectionRequest(command)
      } catch {
        throw errorFor('select-scenario', 'protocol', 'La selección de escenario no es válida.')
      }
      const response = await request<LocalProfileCatalogResponse>('select-scenario', '/escenarios/seleccion',
        requestOptions.signal, validateProfileCatalogResponse, command.runId, command)
      if (response.runId === command.runId) {
        throw errorFor('select-scenario', 'protocol', 'La prueba no se inició en una ejecución nueva.')
      }
      return response
    },

    read<K extends DashboardKey>(key: K, identity: Identity, requestOptions: RequestOptions = {}): Promise<LocalProfileRead<K>> {
      try {
        validateDashboardKey(key)
        validateDashboardIdentity(identity)
      } catch {
        return Promise.reject(errorFor('read', 'protocol', 'La consulta o identidad local no es válida.'))
      }
      const query = new URLSearchParams({ runId: identity.runId, actorId: identity.actorId, sessionId: identity.sessionId })
      return request('read', `/consultas/${encodeURIComponent(key)}?${query}`, requestOptions.signal,
        (value) => validateDashboardReadResponse(value, { ...identity, key },
          (payload) => validatePayload(key, payload, identity.runId, identity.actorId)), identity.runId)
    },
  }
}

export type { AcademicKey, DashboardKey, Identity, ProfileCatalog, ReportKey, MatriculaRegularContext, ScenarioCatalog }

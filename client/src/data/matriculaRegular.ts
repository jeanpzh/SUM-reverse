import {
  validateActorId,
  validateContextResponse,
  validateEnrollmentId,
  validateEnrollmentReportResponse,
  validateErrorResponse,
  validateLookupQuery,
  validateLookupResponse,
  validateOutcomeResponse,
  validateReportQuery,
  validateRenewalRequest,
  validateRequestId,
  validateSessionRequest,
  validateSessionResponse,
  validateSubmissionRequest,
} from '../../../shared/matricula-regular.mjs'
import type {
  MatriculaRegularContext,
  MatriculaRegularEnrollmentReport,
  MatriculaRegularEnvelope,
  MatriculaRegularErrorResponse,
  MatriculaRegularExpectedIdentity,
  MatriculaRegularId,
  MatriculaRegularLookup,
  MatriculaRegularOutcome,
  MatriculaRegularSession,
  MatriculaRegularSubmission,
  MatriculaRegularUuid,
} from '../../../shared/matricula-regular.mjs'

const apiPrefix = '/api/local/matricula-regular/v1'

export type MatriculaRegularOperation = 'context' | 'session' | 'renew' | 'submit' | 'result' | 'report'
export type MatriculaRegularErrorKind = 'configuration' | 'network' | 'aborted' | 'http' | 'protocol'

export class MatriculaRegularApiError extends Error {
  readonly kind: MatriculaRegularErrorKind
  readonly operation: MatriculaRegularOperation
  readonly status?: number
  readonly code?: string
  readonly fields: readonly string[]
  readonly runId?: string
  readonly retryable: boolean

  constructor(input: {
    kind: MatriculaRegularErrorKind
    operation: MatriculaRegularOperation
    message: string
    status?: number
    code?: string
    fields?: readonly string[]
    runId?: string
    retryable?: boolean
  }) {
    super(input.message)
    this.name = 'MatriculaRegularApiError'
    this.kind = input.kind
    this.operation = input.operation
    this.status = input.status
    this.code = input.code
    this.fields = input.fields ?? []
    this.runId = input.runId
    this.retryable = input.retryable ?? false
  }
}

export type MatriculaRegularApiOptions = {
  mode: string
  fetchImpl?: typeof fetch
}

type RequestOptions = { signal?: AbortSignal }
type ContextOptions = RequestOptions & { expectedRunId?: string }
type RequestIdentity = { runId: MatriculaRegularUuid; actorId: MatriculaRegularId; requestId: MatriculaRegularUuid }
type ReportIdentity = { runId: MatriculaRegularUuid; actorId: MatriculaRegularId; enrollmentId: MatriculaRegularUuid; requestId?: MatriculaRegularUuid }

async function readJson(response: Response, operation: MatriculaRegularOperation): Promise<unknown> {
  if (!/application\/(?:[\w.-]+\+)?json/i.test(response.headers.get('content-type') ?? '')) {
    throw new MatriculaRegularApiError({
      kind: 'protocol', operation, status: response.status,
      message: 'La API local de matrícula regular no devolvió JSON.',
    })
  }
  try {
    return await response.json() as unknown
  } catch {
    throw new MatriculaRegularApiError({
      kind: 'protocol', operation, status: response.status,
      message: 'La API local de matrícula regular devolvió JSON inválido.',
    })
  }
}

function parseErrorResponse(value: unknown, operation: MatriculaRegularOperation, status: number) {
  try {
    validateErrorResponse(value)
    return value
  } catch {
    throw malformed(operation, status)
  }
}

function malformed(operation: MatriculaRegularOperation, status?: number) {
  return new MatriculaRegularApiError({
    kind: 'protocol', operation, status,
    message: 'La respuesta local de matrícula regular no cumple el contrato.',
  })
}

async function request<T>(input: {
  fetchImpl: typeof fetch
  operation: MatriculaRegularOperation
  method: 'GET' | 'POST'
  path: string
  body?: unknown
  signal?: AbortSignal
  validateSuccess: (value: unknown) => asserts value is T
  expectedRunId?: string
}): Promise<T> {
  input.signal?.throwIfAborted()
  let response: Response
  try {
    response = await input.fetchImpl(`${apiPrefix}${input.path}`, {
      method: input.method,
      headers: input.method === 'POST'
        ? { Accept: 'application/json', 'Content-Type': 'application/json' }
        : { Accept: 'application/json' },
      ...(input.method === 'POST' ? { body: JSON.stringify(input.body) } : {}),
      credentials: 'omit',
      signal: input.signal,
    })
  } catch (error) {
    if (input.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new MatriculaRegularApiError({
        kind: 'aborted', operation: input.operation,
        message: 'La consulta local de matrícula regular fue cancelada.',
      })
    }
    throw new MatriculaRegularApiError({
      kind: 'network', operation: input.operation,
      message: 'No se recibió respuesta de la API local de matrícula regular.',
      retryable: input.method === 'GET',
    })
  }

  if (!response.ok) {
    const value = await readJson(response, input.operation)
    const errorResponse = parseErrorResponse(value, input.operation, response.status)
    if (input.expectedRunId !== undefined && errorResponse.runId !== input.expectedRunId && errorResponse.error.code !== 'RUN_CHANGED') {
      throw malformed(input.operation, response.status)
    }
    throw new MatriculaRegularApiError({
      kind: 'http', operation: input.operation, status: response.status,
      code: errorResponse.error.code, fields: errorResponse.error.fields, runId: errorResponse.runId,
      message: `La API local de matrícula regular respondió ${errorResponse.error.code}.`,
    })
  }

  const value = await readJson(response, input.operation)
  try {
    input.validateSuccess(value)
  } catch {
    throw malformed(input.operation, response.status)
  }
  return value
}

/** Own local synthetic API transport for MR-CONTRACT-2. It never uses mock or legacy APIs. */
export function createMatriculaRegularApi(options: MatriculaRegularApiOptions) {
  if (options.mode !== 'local') {
    throw new MatriculaRegularApiError({
      kind: 'configuration', operation: 'context',
      message: 'Matrícula regular requiere el modo local.',
    })
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)

  return {
    getContext(actorId: MatriculaRegularId, requestOptions: ContextOptions = {}): Promise<MatriculaRegularEnvelope<MatriculaRegularContext>> {
      try { validateActorId(actorId) } catch { throw malformed('context') }
      const identity = requestOptions.expectedRunId === undefined
        ? undefined
        : { runId: requestOptions.expectedRunId, actorId }
      return request<MatriculaRegularEnvelope<MatriculaRegularContext>>({
        fetchImpl, operation: 'context', method: 'GET',
        path: `/contextos/${encodeURIComponent(actorId)}`,
        signal: requestOptions.signal,
        expectedRunId: requestOptions.expectedRunId,
        validateSuccess: (value) => validateContextResponse(value, identity?.runId, actorId),
      })
    },

    createSession(request: { runId: MatriculaRegularUuid; actorId: MatriculaRegularId }, requestOptions: RequestOptions = {}): Promise<MatriculaRegularSession> {
      try { validateSessionRequest(request) } catch { throw malformed('session') }
      return requestResponse('session', '/sesiones', request, request.runId, requestOptions)
    },

    renewSession(sessionId: MatriculaRegularUuid, request: { runId: MatriculaRegularUuid; actorId: MatriculaRegularId }, requestOptions: RequestOptions = {}): Promise<MatriculaRegularSession> {
      try { validateRenewalRequest(sessionId, request) } catch { throw malformed('renew') }
      return requestResponse('renew', `/sesiones/${encodeURIComponent(sessionId)}/renovar`, request, request.runId,
        requestOptions, { ...request, sessionId })
    },

    submit(submission: MatriculaRegularSubmission, requestOptions: RequestOptions = {}): Promise<MatriculaRegularOutcome> {
      try { validateSubmissionRequest(submission) } catch { throw malformed('submit') }
      const expectedIdentity = { runId: submission.runId, actorId: submission.actorId, requestId: submission.requestId }
      return request<MatriculaRegularEnvelope<MatriculaRegularOutcome>>({
        fetchImpl, operation: 'submit', method: 'POST', path: '/solicitudes', body: submission,
        signal: requestOptions.signal, expectedRunId: submission.runId,
        validateSuccess: (value) => validateOutcomeResponse(value, expectedIdentity),
      }).then((value) => value.data)
    },

    getResult(identity: RequestIdentity, requestOptions: RequestOptions = {}): Promise<MatriculaRegularLookup> {
      try {
        validateRequestId(identity.requestId)
        validateLookupQuery({ runId: identity.runId, actorId: identity.actorId })
      } catch { throw malformed('result') }
      const query = new URLSearchParams({ runId: identity.runId, actorId: identity.actorId })
      return request<MatriculaRegularEnvelope<MatriculaRegularLookup>>({
        fetchImpl, operation: 'result', method: 'GET',
        path: `/solicitudes/${encodeURIComponent(identity.requestId)}?${query}`,
        signal: requestOptions.signal, expectedRunId: identity.runId,
        validateSuccess: (value) => validateLookupResponse(value, identity),
      }).then((value) => value.data)
    },

    getReport(identity: ReportIdentity, requestOptions: RequestOptions = {}): Promise<MatriculaRegularEnrollmentReport> {
      try {
        validateEnrollmentId(identity.enrollmentId)
        validateReportQuery({ runId: identity.runId, actorId: identity.actorId })
      } catch { throw malformed('report') }
      const query = new URLSearchParams({ runId: identity.runId, actorId: identity.actorId })
      return request<MatriculaRegularEnvelope<MatriculaRegularEnrollmentReport>>({
        fetchImpl, operation: 'report', method: 'GET',
        path: `/reportes/${encodeURIComponent(identity.enrollmentId)}?${query}`,
        signal: requestOptions.signal, expectedRunId: identity.runId,
        validateSuccess: (value) => validateEnrollmentReportResponse(value, identity),
      }).then((value) => value.data)
    },
  }

  function requestResponse(
    operation: 'session' | 'renew', path: string, body: { runId: MatriculaRegularUuid; actorId: MatriculaRegularId },
    runId: MatriculaRegularUuid, requestOptions: RequestOptions, expectedIdentity: MatriculaRegularExpectedIdentity = body,
  ): Promise<MatriculaRegularSession> {
    return request<MatriculaRegularEnvelope<MatriculaRegularSession>>({
      fetchImpl, operation, method: 'POST', path, body,
      signal: requestOptions.signal, expectedRunId: runId,
      validateSuccess: (value) => validateSessionResponse(value, expectedIdentity),
    }).then((value) => value.data)
  }
}

export type {
  MatriculaRegularContext,
  MatriculaRegularEnrollmentReport,
  MatriculaRegularErrorResponse,
  MatriculaRegularLookup,
  MatriculaRegularOutcome,
  MatriculaRegularSession,
  MatriculaRegularSubmission,
}

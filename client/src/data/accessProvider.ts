import { validateActorId } from '../../../shared/matricula-regular.mjs'
import type { ActorId } from '../../../shared/local-profile-dashboard.mjs'

export type AccessPrincipal = {
  actorId: ActorId
  campaignId: string
  runId: string
  expiresAt: string
}

export class AccessApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(status === 401 ? 'El código de acceso no es válido o venció.' : `No se pudo validar el acceso (${code}).`)
    this.name = 'AccessApiError'
    this.status = status
    this.code = code
  }
}

function validatePrincipal(value: unknown): AccessPrincipal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('La sesión de acceso no cumple el contrato.')
  if (Object.keys(value).length !== 1 || !('data' in value)) throw new Error('La sesión de acceso no cumple el contrato.')
  const data = (value as { data?: unknown }).data
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('La sesión de acceso no cumple el contrato.')
  const item = data as Record<string, unknown>
  if (Object.keys(item).length !== 4 || !['actorId', 'campaignId', 'runId', 'expiresAt'].every((key) => key in item)) {
    throw new Error('La sesión de acceso no cumple el contrato.')
  }
  try { validateActorId(item.actorId) } catch { throw new Error('La sesión de acceso no cumple el contrato.') }
  if (typeof item.actorId !== 'string' || !/^SYN-[A-Z0-9-]{1,48}$/.test(item.actorId)) {
    throw new Error('La sesión de acceso no cumple el contrato.')
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  if (typeof item.campaignId !== 'string' || !uuid.test(item.campaignId)
    || typeof item.runId !== 'string' || !uuid.test(item.runId)
    || typeof item.expiresAt !== 'string' || !Number.isFinite(Date.parse(item.expiresAt))
    || new Date(item.expiresAt).toISOString() !== item.expiresAt) {
    throw new Error('La sesión de acceso no cumple el contrato.')
  }
  return { actorId: item.actorId as ActorId, campaignId: item.campaignId, runId: item.runId, expiresAt: item.expiresAt }
}

export function createAccessProvider(options: { baseUrl?: string; fetchImpl?: typeof fetch } = {}) {
  const baseUrl = options.baseUrl ?? '/api'
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  let principal: AccessPrincipal | null = null
  let revision = 0
  let mutationTail: Promise<void> = Promise.resolve()
  let pendingLogout: Promise<void> | null = null
  let logoutFailure: Error | null = null
  const listeners = new Set<() => void>()

  function notifyLogoutState() {
    for (const listener of listeners) listener()
  }

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationTail.then(operation, operation)
    mutationTail = result.then(() => undefined, () => undefined)
    return result
  }

  function staleRequest(): Error {
    return new Error('La solicitud de acceso quedó invalidada.')
  }

  async function request(path: string, init: RequestInit = {}) {
    let response: Response
    try {
      response = await fetchImpl(`${baseUrl}/simulator/auth/v1${path}`, {
        ...init, credentials: 'include', headers: { Accept: 'application/json', ...init.headers },
      })
    } catch {
      throw new Error('No se recibió respuesta del servicio de acceso local.')
    }
    if (response.status === 204) return response
    let body: unknown
    try { body = await response.json() as unknown } catch { throw new Error('La respuesta del servicio de acceso no es JSON válido.') }
    if (!response.ok) {
      const error = body && typeof body === 'object' && 'error' in body ? (body as { error: unknown }).error : null
      if (!error || typeof error !== 'object' || !('code' in error) || !('fields' in error)
        || !Array.isArray((error as { fields: unknown }).fields)
        || !(error as { fields: unknown[] }).fields.every((field) => typeof field === 'string')) {
        throw new Error('La respuesta de error de acceso no cumple el contrato.')
      }
      const code = typeof (error as { code: unknown }).code === 'string' ? (error as { code: string }).code : 'INVALID_RESPONSE'
      throw new AccessApiError(response.status, code)
    }
    return body
  }

  return {
    getSnapshot: () => principal,
    getLogoutErrorSnapshot: () => logoutFailure,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    async login(credential: string) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(credential)) throw new AccessApiError(400, 'INVALID_REQUEST')
      const requestRevision = ++revision
      return serialize(async () => {
        if (logoutFailure) throw logoutFailure
        if (requestRevision !== revision) throw staleRequest()
        const body = await request('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) })
        const next = validatePrincipal(body)
        if (requestRevision !== revision) throw staleRequest()
        principal = next
        return next
      })
    },
    async current() {
      const requestRevision = ++revision
      return serialize(async () => {
        if (logoutFailure) throw logoutFailure
        if (requestRevision !== revision) throw staleRequest()
        const body = await request('/session')
        const next = validatePrincipal(body)
        if (requestRevision !== revision) throw staleRequest()
        principal = next
        return next
      })
    },
    async logout() {
      ++revision
      principal = null
      if (pendingLogout) return pendingLogout
      const operation = serialize(async () => {
        try {
          await request('/logout', { method: 'POST' })
          logoutFailure = null
          notifyLogoutState()
        } catch (cause) {
          const detail = cause instanceof Error ? cause.message : 'No se recibió confirmación del servicio de acceso.'
          logoutFailure = new Error(`No se pudo confirmar el cierre de sesión. ${detail}`)
          notifyLogoutState()
          throw logoutFailure
        }
      })
      pendingLogout = operation
      void operation.then(
        () => { if (pendingLogout === operation) pendingLogout = null },
        () => { if (pendingLogout === operation) pendingLogout = null },
      )
      return operation
    },
    invalidate() { ++revision; principal = null },
  }
}

export type AccessProvider = ReturnType<typeof createAccessProvider>

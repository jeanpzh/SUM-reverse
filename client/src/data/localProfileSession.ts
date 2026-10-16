import type { ApiResponseMap } from './contracts.ts'
import { LocalProfileApiError } from './localProfileDashboard.ts'
import type { LocalProfilePayloadMap } from './localProfileDashboard.ts'
import type { DashboardKey, Identity } from '../../../shared/local-profile-dashboard.mjs'
import { validateDashboardIdentity } from '../../../shared/local-profile-dashboard.mjs'
import type { MatriculaRegularSession, MatriculaRegularUuid } from '../../../shared/matricula-regular.mjs'

export const SESSION_DURATION_MS = 900_000
export const remainingSeconds = (deadlineMono: number, monotonicNow: number) => Math.max(0, Math.ceil((deadlineMono - monotonicNow) / 1000))

/** L-07: per-tab identity of the synthetic profile session (sessionStorage); never a credential. */
export const LOCAL_PROFILE_IDENTITY_KEY = 'lp:session'

export interface IdentityStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface VisibilitySource {
  readonly visibilityState: string
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/** L-07 (T-01): returning to a visible tab renews the session. Returns the disposer. */
export function bindVisibilityRenewal(doc: VisibilitySource, renew: () => Promise<void>): () => void {
  const onChange = () => {
    if (doc.visibilityState === 'visible') void renew()
  }
  doc.addEventListener('visibilitychange', onChange)
  return () => doc.removeEventListener('visibilitychange', onChange)
}

type Formulario = ApiResponseMap['formulario']
type SnapshotBase = { generation: number }
export type LocalProfileSnapshot =
  | (SnapshotBase & { status: 'anonymous'; notice: 'reset' | null })
  | (SnapshotBase & { status: 'entering' })
  | (SnapshotBase & { status: 'error'; message: string; retryable: boolean })
  | (SnapshotBase & ActiveProfile & { status: 'active'; renewing: boolean; renewError: string | null })
  | (SnapshotBase & ActiveProfile & { status: 'expired'; renewing: false; renewError: string | null })

type ActiveProfile = {
  runId: string
  actorId: Identity['actorId']
  sessionId: MatriculaRegularUuid
  startedAt: string
  expiresAt: string
  deadlineMono: number
  formulario: Formulario
}

type ReadResult<K extends DashboardKey> = { runId: string; data: { serverNow: string; payload: LocalProfilePayloadMap[K] } }
type DashboardApi = {
  catalog(options?: { signal?: AbortSignal }): Promise<{ runId: string; data: { serverNow: string; profiles: Array<{ actorId: string }> } }>
  read<K extends DashboardKey>(key: K, identity: Identity, options?: { signal?: AbortSignal }): Promise<{
    runId: string; data: { actorId: Identity['actorId']; sessionId: string; key: K; serverNow: string; payload: LocalProfilePayloadMap[K] }
  }>
}
type EnrollmentApi = {
  createSession(request: { runId: string; actorId: Identity['actorId'] }, options?: { signal?: AbortSignal }): Promise<MatriculaRegularSession>
  renewSession(sessionId: string, request: { runId: string; actorId: Identity['actorId'] }, options?: { signal?: AbortSignal }): Promise<MatriculaRegularSession>
}
type TimerScheduler = { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void }
type GuardCause = 'enter' | 'preload' | 'stay'

export function createLocalProfileSessionStore(options: {
  dashboardApi: DashboardApi
  enrollmentApi: EnrollmentApi
  monotonicNow?: () => number
  scheduler?: TimerScheduler
  identityStorage?: IdentityStorage | null
}) {
  const now = options.monotonicNow ?? (() => performance.now())
  const scheduler = options.scheduler ?? {
    set: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
    clear: (handle: unknown) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  }
  let snapshot: LocalProfileSnapshot = { status: 'anonymous', notice: null, generation: 0 }
  let entryPromise: Promise<void> | null = null
  let generation = 0
  let requestRevision = 0
  let timer: unknown = null
  const listeners = new Set<() => void>()
  const identityListeners = new Set<(kind: 'enter' | 'logout' | 'run-changed') => void>()
  const controllers = new Set<AbortController>()

  const getSnapshot = () => snapshot
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const onIdentityChange = (listener: (kind: 'enter' | 'logout' | 'run-changed') => void) => {
    identityListeners.add(listener)
    return () => { identityListeners.delete(listener) }
  }
  function publish(next: LocalProfileSnapshot) {
    snapshot = next
    for (const listener of listeners) listener()
  }
  function storeIdentity(identity: Identity | null) {
    const storage = options.identityStorage
    if (!storage) return
    try {
      if (identity) storage.setItem(LOCAL_PROFILE_IDENTITY_KEY, JSON.stringify(identity))
      else storage.removeItem(LOCAL_PROFILE_IDENTITY_KEY)
    } catch { /* storage unavailable: a reload falls back to the profile chooser */ }
  }
  function readStoredIdentity(): Identity | null {
    const storage = options.identityStorage
    if (!storage) return null
    try {
      const raw = storage.getItem(LOCAL_PROFILE_IDENTITY_KEY)
      if (raw === null) return null
      const parsed: unknown = JSON.parse(raw)
      validateDashboardIdentity(parsed)
      return parsed
    } catch {
      storeIdentity(null)
      return null
    }
  }
  function identityChanged(kind: 'enter' | 'logout' | 'run-changed') {
    generation += 1
    requestRevision += 1
    for (const controller of controllers) controller.abort()
    controllers.clear()
    for (const listener of identityListeners) listener(kind)
  }
  function cancelTimer() {
    if (timer !== null) scheduler.clear(timer)
    timer = null
  }
  function clearActive(kind: 'logout' | 'run-changed', notice: 'reset' | null = null) {
    if (snapshot.status !== 'active' && snapshot.status !== 'expired') return false
    cancelTimer()
    storeIdentity(null)
    identityChanged(kind)
    publish({ status: 'anonymous', notice, generation })
    return true
  }
  function setError(error: unknown) {
    const failure = error instanceof Error ? error : new Error('No se pudo ingresar al perfil local.')
    publish({ status: 'error', message: failure.message, retryable: error instanceof LocalProfileApiError ? error.retryable : true, generation })
  }
  function scheduleExpiry() {
    cancelTimer()
    if (snapshot.status !== 'active') return
    const delay = Math.max(0, snapshot.deadlineMono - now())
    const handle = scheduler.set(() => {
      if (timer !== handle) return
      scheduler.clear(handle)
      timer = null
      if (snapshot.status !== 'active') return
      if (now() < snapshot.deadlineMono) scheduleExpiry()
      else markExpired()
    }, delay)
    timer = handle
  }
  function markExpired() {
    if (snapshot.status !== 'active') return
    cancelTimer()
    storeIdentity(null)
    publish({ ...snapshot, status: 'expired', renewing: false, renewError: null, generation })
  }
  function observe(serverNow: string, requestGeneration = generation) {
    if (requestGeneration !== generation || (snapshot.status !== 'active' && snapshot.status !== 'expired')) return
    const serverMs = Date.parse(serverNow)
    const expiresMs = Date.parse(snapshot.expiresAt)
    if (!Number.isFinite(serverMs) || !Number.isFinite(expiresMs)) return
    const candidate = now() + Math.max(0, expiresMs - serverMs)
    const deadlineMono = Math.min(snapshot.deadlineMono, candidate)
    if (deadlineMono <= now()) {
      markExpired()
      return
    }
    if (deadlineMono !== snapshot.deadlineMono) {
      publish({ ...snapshot, deadlineMono, generation })
      if (snapshot.status === 'active') scheduleExpiry()
    }
  }
  async function enter(actorId: Identity['actorId'], entryOptions: { expectedRunId?: string } = {}): Promise<void> {
    if (entryPromise) return entryPromise
    if (snapshot.status === 'active' && snapshot.actorId === actorId) return
    if (snapshot.status === 'expired') clearActive('logout')
    const entryRevision = requestRevision
    publish({ status: 'entering', generation })
    const work = (async () => {
      try {
        const catalog = await options.dashboardApi.catalog()
        if (requestRevision !== entryRevision) return
        if (entryOptions.expectedRunId !== undefined && catalog.runId !== entryOptions.expectedRunId) {
          throw new LocalProfileApiError({ kind: 'http', operation: 'catalog', code: 'RUN_CHANGED',
            message: 'La prueba cambió antes de ingresar. Vuelve a elegir escenario y perfil.' })
        }
        const profile = catalog.data.profiles.find((candidate) => candidate.actorId === actorId)
        if (!profile) throw new LocalProfileApiError({ kind: 'protocol', operation: 'catalog', message: 'El perfil no pertenece al catálogo sintético.' })
        const session = await options.enrollmentApi.createSession({ runId: catalog.runId, actorId })
        if (requestRevision !== entryRevision) return
        const identity = { runId: session.runId, actorId, sessionId: session.sessionId }
        if (session.runId !== catalog.runId || session.actorId !== actorId || Date.parse(session.expiresAt) <= Date.parse(session.startedAt)) {
          throw new LocalProfileApiError({ kind: 'protocol', operation: 'catalog', message: 'La sesión local no corresponde al perfil elegido.' })
        }
        const formResponse = await options.dashboardApi.read('formulario', identity)
        if (requestRevision !== entryRevision) return
        if (formResponse.runId !== identity.runId || formResponse.data.actorId !== actorId
          || formResponse.data.sessionId !== identity.sessionId || formResponse.data.payload.data.alumno.codAlumno !== actorId) {
          throw new LocalProfileApiError({ kind: 'protocol', operation: 'read', message: 'El formulario no corresponde al perfil elegido.' })
        }
        const receivedAt = now()
        const serverAnchor = Date.parse(session.startedAt)
        const expiration = Date.parse(session.expiresAt)
        const deadlineMono = receivedAt + Math.max(0, expiration - serverAnchor)
        identityChanged('enter')
        const enteredGeneration = generation
        publish({ status: 'active', runId: session.runId, actorId, sessionId: session.sessionId,
          startedAt: session.startedAt, expiresAt: session.expiresAt, deadlineMono,
          formulario: formResponse.data.payload, renewing: false, renewError: null, generation: enteredGeneration })
        scheduleExpiry()
        storeIdentity(identity)
      } catch (error) {
        if (requestRevision === entryRevision) setError(error)
      }
    })()
    const wrapped = work.finally(() => { if (entryPromise === wrapped) entryPromise = null })
    entryPromise = wrapped
    await wrapped
  }
  /** L-07: on reload, renew the tab's stored session before routing; any failure clears it. Never creates a session. */
  async function resume(): Promise<void> {
    if (snapshot.status !== 'anonymous' || entryPromise) return
    const stored = readStoredIdentity()
    if (!stored) return
    const entryRevision = requestRevision
    publish({ status: 'entering', generation })
    const work = (async () => {
      try {
        const session = await options.enrollmentApi.renewSession(stored.sessionId, { runId: stored.runId, actorId: stored.actorId })
        if (requestRevision !== entryRevision) return
        if (session.runId !== stored.runId || session.actorId !== stored.actorId || session.sessionId !== stored.sessionId) {
          throw new LocalProfileApiError({ kind: 'protocol', operation: 'catalog', message: 'La sesión renovada no corresponde a la identidad guardada.' })
        }
        const formResponse = await options.dashboardApi.read('formulario', stored)
        if (requestRevision !== entryRevision) return
        if (formResponse.runId !== stored.runId || formResponse.data.actorId !== stored.actorId
          || formResponse.data.sessionId !== stored.sessionId || formResponse.data.payload.data.alumno.codAlumno !== stored.actorId) {
          throw new LocalProfileApiError({ kind: 'protocol', operation: 'read', message: 'El formulario no corresponde a la identidad guardada.' })
        }
        const deadlineMono = now() + SESSION_DURATION_MS
        identityChanged('enter')
        publish({ status: 'active', runId: session.runId, actorId: stored.actorId, sessionId: session.sessionId,
          startedAt: session.startedAt, expiresAt: session.expiresAt, deadlineMono,
          formulario: formResponse.data.payload, renewing: false, renewError: null, generation })
        scheduleExpiry()
      } catch (error) {
        storeIdentity(null)
        if (requestRevision !== entryRevision) return
        const runChanged = error instanceof Error && 'code' in error && error.code === 'RUN_CHANGED'
        publish({ status: 'anonymous', notice: runChanged ? 'reset' : null, generation })
      }
    })()
    const wrapped = work.finally(() => { if (entryPromise === wrapped) entryPromise = null })
    entryPromise = wrapped
    await wrapped
  }
  async function renew() {
    if (snapshot.status !== 'active' || snapshot.renewing) return
    const previous = snapshot
    const requestOperationRevision = requestRevision
    publish({ ...previous, renewing: true, renewError: null, generation })
    try {
      const session = await options.enrollmentApi.renewSession(previous.sessionId, { runId: previous.runId, actorId: previous.actorId })
      if (requestOperationRevision !== requestRevision) return
      if (session.runId !== previous.runId || session.actorId !== previous.actorId || session.sessionId !== previous.sessionId
        || session.startedAt !== previous.startedAt) throw new Error('La renovación local cambió la identidad de sesión.')
      const receivedAt = now()
      const serverNow = Date.parse(session.expiresAt) - SESSION_DURATION_MS
      const deadlineMono = receivedAt + Math.max(0, Date.parse(session.expiresAt) - serverNow)
      publish({ ...previous, expiresAt: session.expiresAt, deadlineMono, renewing: false, renewError: null, generation })
      scheduleExpiry()
    } catch (error) {
      if (requestOperationRevision !== requestRevision) return
      if (error instanceof Error && 'code' in error && error.code === 'RUN_CHANGED') {
        clearActive('run-changed', 'reset')
        return
      }
      if (error instanceof Error && 'code' in error && error.code === 'SESSION_EXPIRED') {
        markExpired()
        return
      }
      publish({ ...previous, renewing: false, renewError: error instanceof Error ? error.message : 'No se pudo renovar la sesión.', generation })
      if (snapshot.status === 'active') scheduleExpiry()
    }
  }
  function logout() {
    clearActive('logout')
    storeIdentity(null)
    if (snapshot.status === 'entering') {
      entryPromise = null
      requestRevision += 1
      for (const controller of controllers) controller.abort()
      controllers.clear()
      publish({ status: 'anonymous', notice: null, generation })
    }
  }
  function markRunChanged() { clearActive('run-changed', 'reset') }

  async function read<K extends DashboardKey>(key: K, requestOptions: { signal?: AbortSignal } = {}): Promise<ReadResult<K>> {
    if (snapshot.status !== 'active') throw new LocalProfileApiError({ kind: 'inactive', operation: 'read', message: 'No hay una sesión local activa.' })
    const expected = snapshot
    const requestGeneration = generation
    const requestOperationRevision = requestRevision
    const identity = { runId: expected.runId, actorId: expected.actorId, sessionId: expected.sessionId }
    const controller = new AbortController()
    controllers.add(controller)
    const forwardAbort = () => controller.abort()
    requestOptions.signal?.addEventListener('abort', forwardAbort, { once: true })
    try {
      const response = await options.dashboardApi.read(key, identity, { signal: controller.signal })
      if (requestOperationRevision !== requestRevision) throw new LocalProfileApiError({ kind: 'stale', operation: 'read', message: 'La respuesta pertenece a una identidad anterior.' })
      observe(response.data.serverNow, requestGeneration)
      if (snapshot.status !== 'active') throw new LocalProfileApiError({ kind: 'inactive', operation: 'read', message: 'La sesión local ya no está activa.' })
      return { runId: response.runId, data: { serverNow: response.data.serverNow, payload: response.data.payload } }
    } catch (error) {
      if (requestOperationRevision !== requestRevision) throw new LocalProfileApiError({ kind: 'stale', operation: 'read', message: 'La respuesta pertenece a una identidad anterior.' })
      if (error instanceof LocalProfileApiError && error.code === 'SESSION_EXPIRED') markExpired()
      if (error instanceof LocalProfileApiError && error.code === 'RUN_CHANGED') markRunChanged()
      throw error
    } finally {
      controllers.delete(controller)
      requestOptions.signal?.removeEventListener('abort', forwardAbort)
    }
  }

  return { getSnapshot, subscribe, onIdentityChange, enter, resume, renew, logout, observe, markExpired, markRunChanged, read }
}

export type LocalProfileSessionStore = ReturnType<typeof createLocalProfileSessionStore>
export function evaluateProfileGuard(snapshot: LocalProfileSnapshot, input: { pathname: string; cause: GuardCause }) {
  if (input.pathname === '/local/login') {
    return snapshot.status === 'active' ? { redirect: '/alumnoWebSum/v2/inicio' } : null
  }
  if (snapshot.status === 'active') return null
  if (snapshot.status === 'expired' && input.cause === 'stay' && input.pathname.replace(/\/$/, '') === '/local/matricula-regular') return null
  return { redirect: '/local/login' }
}
export function expiryNavigationTarget(pathname: string) {
  return pathname.replace(/\/$/, '') === '/local/matricula-regular' ? null : '/local/login'
}
export function profileRootLoaderData(snapshot: LocalProfileSnapshot): Formulario | null {
  return snapshot.status === 'active' || snapshot.status === 'expired' ? snapshot.formulario : null
}

export function activeProfileIdentity(snapshot: LocalProfileSnapshot): Identity | null {
  if (snapshot.status !== 'active' && snapshot.status !== 'expired') return null
  return { runId: snapshot.runId, actorId: snapshot.actorId, sessionId: snapshot.sessionId }
}

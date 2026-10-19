import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bindVisibilityRenewal,
  createLocalProfileSessionStore,
  evaluateProfileGuard,
  expiryNavigationTarget,
  LOCAL_PROFILE_IDENTITY_KEY,
  profileRootLoaderData,
  remainingSeconds,
  SESSION_DURATION_MS,
} from './localProfileSession.ts'
import type { IdentityStorage, LocalProfileSnapshot } from './localProfileSession.ts'
import { LocalProfileApiError } from './localProfileDashboard.ts'
import type { ApiResponseMap } from './contracts.ts'
import { MatriculaRegularApiError } from './matriculaRegular.ts'
import type { AccessProvider } from './accessProvider.ts'

const BASE = Date.parse('2026-08-11T14:00:00.000Z')
const runId = '10000000-0000-4000-8000-000000000001'
const nextRunId = '10000000-0000-4000-8000-000000000002'
const iso = (ms: number) => new Date(ms).toISOString()
const sessionIdFor = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const scope = (school: 'SISTEMAS' | 'SOFTWARE') => ({
  facultyId: 'FISI', schoolId: school, period: '2026-II',
  planId: school === 'SISTEMAS' ? 'SYN-SIS-PLAN' : 'SYN-SOFT-PLAN', modality: 'regular-virtual',
})
const actors = ['SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B'] as const
const formularioFor = (actorId: string) => ({
  message: null, codError: null, data: { alumno: { codAlumno: actorId, nomAlumno: `Nombre ${actorId}` } },
}) as unknown as ApiResponseMap['formulario']

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

type Timer = { id: number; at: number; fn: () => void }

/** Fake server clock = BASE + monotonic time; APIs ignore AbortSignal on purpose. */
function harness(options: { identityStorage?: IdentityStorage | null } = {}) {
  const clock = { t: 0 }
  const counts = { catalog: 0, create: 0, renew: 0, read: 0 }
  const createdFor: string[] = []
  const timers: Timer[] = []
  let timerId = 0
  let sessionCounter = 0
  const hooks = {
    createLatency: 0,
    run: runId,
    create: null as null | ((request: { runId: string; actorId: string }) => Promise<unknown>),
    read: null as null | ((key: string, identity: { runId: string; actorId: string; sessionId: string }) => Promise<unknown>),
    renew: null as null | ((sessionId: string, request: { runId: string; actorId: string }) => Promise<unknown>),
  }
  const sessions = new Map<string, { startedAt: string; expiresAt: string }>()
  const dashboardApi = {
    async catalog() {
      counts.catalog += 1
      return {
        runId: hooks.run,
        data: { serverNow: iso(BASE + clock.t), profiles: actors.map((actorId) => ({
          actorId, name: `Nombre ${actorId}`, scope: scope(actorId.includes('SIS') ? 'SISTEMAS' : 'SOFTWARE'),
        })) },
      }
    },
    async read(key: string, identity: { runId: string; actorId: string; sessionId: string }) {
      counts.read += 1
      if (hooks.read) return hooks.read(key, identity) as never
      return { runId: identity.runId, data: {
        actorId: identity.actorId, sessionId: identity.sessionId, key, serverNow: iso(BASE + clock.t),
        payload: key === 'formulario' ? formularioFor(identity.actorId) : { key, actorId: identity.actorId },
      } } as never
    },
  }
  const enrollmentApi = {
    async createSession(request: { runId: string; actorId: string }) {
      counts.create += 1
      createdFor.push(request.actorId)
      if (hooks.create) return hooks.create(request) as never
      const startedAt = BASE + clock.t
      sessionCounter += 1
      const session = { runId: request.runId, actorId: request.actorId, sessionId: sessionIdFor(sessionCounter),
        startedAt: iso(startedAt), expiresAt: iso(startedAt + SESSION_DURATION_MS) }
      sessions.set(session.sessionId, session)
      clock.t += hooks.createLatency
      return session as never
    },
    async renewSession(sessionId: string, request: { runId: string; actorId: string }) {
      counts.renew += 1
      if (hooks.renew) return hooks.renew(sessionId, request) as never
      const known = sessions.get(sessionId)!
      return { runId: request.runId, actorId: request.actorId, sessionId, startedAt: known.startedAt,
        expiresAt: iso(BASE + clock.t + SESSION_DURATION_MS) } as never
    },
  }
  const scheduler = {
    set(fn: () => void, ms: number) {
      timerId += 1
      timers.push({ id: timerId, at: clock.t + ms, fn })
      return timerId
    },
    clear(handle: unknown) {
      const index = timers.findIndex((timer) => timer.id === handle)
      if (index >= 0) timers.splice(index, 1)
    },
  }
  const store = createLocalProfileSessionStore({ dashboardApi, enrollmentApi, monotonicNow: () => clock.t, scheduler, identityStorage: options.identityStorage ?? null })
  const identityEvents: string[] = []
  store.onIdentityChange((kind) => identityEvents.push(kind))
  const snapshots: LocalProfileSnapshot[] = []
  store.subscribe(() => snapshots.push(store.getSnapshot()))
  return { clock, counts, createdFor, timers, hooks, dashboardApi, enrollmentApi, scheduler, store, identityEvents, snapshots }
}

const asActive = (snapshot: LocalProfileSnapshot) => {
  assert.ok(snapshot.status === 'active' || snapshot.status === 'expired', `unexpected status ${snapshot.status}`)
  return snapshot
}

test('enter_double_click_one_create: concurrent entries share one in-flight promise and one session POST', async () => {
  const h = harness()
  const first = h.store.enter('SYN-SIS-A')
  const second = h.store.enter('SYN-SIS-A')
  assert.equal(h.store.getSnapshot().status, 'entering')
  await Promise.all([first, second])
  assert.equal(h.counts.create, 1)
  const snapshot = asActive(h.store.getSnapshot())
  assert.equal(snapshot.status, 'active')
  assert.equal(snapshot.actorId, 'SYN-SIS-A')
  assert.equal(snapshot.runId, runId)
  assert.equal(snapshot.startedAt, iso(BASE))
  assert.equal(snapshot.expiresAt, iso(BASE + SESSION_DURATION_MS))
  assert.deepEqual(snapshot.formulario, formularioFor('SYN-SIS-A'))
  assert.equal(h.counts.catalog, 1)
})

test('entry for each of the four actors uses catalog -> one create -> formulario for exactly that actor', async () => {
  for (const actorId of actors) {
    const h = harness()
    await h.store.enter(actorId)
    const snapshot = asActive(h.store.getSnapshot())
    assert.equal(snapshot.actorId, actorId)
    assert.deepEqual(h.createdFor, [actorId])
    assert.equal(h.counts.read, 1)
  }
})

test('public simulator entry uses the authenticated actor, skips catalog and caps academic expiry at access expiry', async () => {
  const h = harness()
  const principal = { actorId: 'SYN-SIS-A', campaignId: runId, runId,
    expiresAt: new Date(Date.now() + 600_000).toISOString() }
  let logouts = 0
  const accessProvider = {
    getSnapshot: () => principal,
    getLogoutErrorSnapshot: () => null,
    subscribe: () => () => undefined,
    current: async () => principal,
    login: async () => principal,
    logout: async () => { logouts += 1 },
    invalidate() {},
  } as AccessProvider
  const store = createLocalProfileSessionStore({ dashboardApi: h.dashboardApi, enrollmentApi: h.enrollmentApi,
    monotonicNow: () => h.clock.t, scheduler: h.scheduler, accessProvider, publicAccess: true })
  await store.enter()
  const snapshot = asActive(store.getSnapshot())
  assert.equal(snapshot.status, 'active')
  assert.equal(snapshot.actorId, principal.actorId)
  assert.equal(h.counts.catalog, 0)
  assert.deepEqual(h.createdFor, [principal.actorId])
  assert.ok(snapshot.deadlineMono <= 600_000)
  store.logout()
  await tick()
  assert.equal(logouts, 1)
})

test('reload_new_store_anonymous: a fresh store never restores a session and nothing is written to browser storage', async () => {
  const writes: string[] = []
  const spy = { setItem: (key: string) => { writes.push(key) }, getItem: () => null, removeItem: () => undefined,
    key: () => null, length: 0 }
  Object.defineProperty(globalThis, 'sessionStorage', { value: spy, configurable: true })
  Object.defineProperty(globalThis, 'localStorage', { value: spy, configurable: true })
  try {
    const h = harness()
    await h.store.enter('SYN-SIS-A')
    await h.store.renew()
    h.store.logout()
    await h.store.enter('SYN-SOFT-B')
    assert.deepEqual(writes, [])
    const reloaded = harness()
    assert.equal(reloaded.store.getSnapshot().status, 'anonymous')
    assert.equal(reloaded.counts.create, 0)
  } finally {
    Reflect.deleteProperty(globalThis, 'sessionStorage')
    Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('navigation_no_create: reads, observations and ticks never create or renew a session', async () => {
  const h = harness()
  await h.store.enter('SYN-SIS-A')
  for (let index = 0; index < 8; index += 1) {
    h.clock.t += 1000
    await h.store.read('evaluaciones')
  }
  assert.equal(h.counts.create, 1)
  assert.equal(h.counts.renew, 0)
  assert.equal(h.counts.read, 9)
})

test('wrong_identity_response_fails: foreign session, run or formulario never becomes an active actor', async () => {
  const foreignSession = harness()
  foreignSession.hooks.create = async (request) => ({ runId: request.runId, actorId: 'SYN-SIS-B', sessionId: sessionIdFor(9),
    startedAt: iso(BASE), expiresAt: iso(BASE + SESSION_DURATION_MS) })
  await foreignSession.store.enter('SYN-SIS-A')
  assert.equal(foreignSession.store.getSnapshot().status, 'error')

  const foreignForm = harness()
  foreignForm.hooks.read = async (key, identity) => ({ runId: identity.runId, data: {
    actorId: identity.actorId, sessionId: identity.sessionId, key, serverNow: iso(BASE), payload: formularioFor('SYN-SIS-B'),
  } })
  await foreignForm.store.enter('SYN-SIS-A')
  assert.equal(foreignForm.store.getSnapshot().status, 'error')

  const foreignRun = harness()
  foreignRun.hooks.create = async (request) => ({ runId: nextRunId, actorId: request.actorId, sessionId: sessionIdFor(9),
    startedAt: iso(BASE), expiresAt: iso(BASE + SESSION_DURATION_MS) })
  await foreignRun.store.enter('SYN-SIS-A')
  assert.equal(foreignRun.store.getSnapshot().status, 'error')

  for (const failed of [foreignSession, foreignForm, foreignRun]) {
    const snapshot = failed.store.getSnapshot()
    assert.equal(JSON.stringify(snapshot).includes('SYN-SIS-B'), false)
    assert.equal(failed.identityEvents.length, 0)
  }
})

test('an actor missing from the catalog is rejected before any session POST', async () => {
  const h = harness()
  await h.store.enter('SYN-OTHER' as never)
  assert.equal(h.store.getSnapshot().status, 'error')
  assert.equal(h.counts.create, 0)
})

test('late_response_generation_ignored: A resolving after logout and B entry cannot touch B (abort ignored)', async () => {
  const h = harness()
  const slowRead = deferred<unknown>()
  h.hooks.read = (key, identity) => (identity.actorId === 'SYN-SIS-A' ? slowRead.promise
    : Promise.resolve({ runId: identity.runId, data: { actorId: identity.actorId, sessionId: identity.sessionId, key,
      serverNow: iso(BASE + h.clock.t), payload: formularioFor(identity.actorId) } }))
  const entryA = h.store.enter('SYN-SIS-A')
  await tick()
  assert.equal(h.store.getSnapshot().status, 'entering')
  h.store.logout()
  assert.equal(h.store.getSnapshot().status, 'anonymous')
  await h.store.enter('SYN-SIS-B')
  const before = asActive(h.store.getSnapshot())
  assert.equal(before.actorId, 'SYN-SIS-B')
  slowRead.resolve({ runId, data: { actorId: 'SYN-SIS-A', sessionId: sessionIdFor(1), key: 'formulario',
    serverNow: iso(BASE), payload: formularioFor('SYN-SIS-A') } })
  await entryA
  const after = asActive(h.store.getSnapshot())
  assert.equal(after, before)
  assert.equal(after.actorId, 'SYN-SIS-B')
  assert.equal(JSON.stringify(h.snapshots.slice(h.snapshots.findIndex((s) => s === before))).includes('SYN-SIS-A'), false)
})

test('cancelling an in-flight anonymous entry does not advance identity generation', async () => {
  const h = harness()
  const delayedCreate = deferred<unknown>()
  const originalCreate = h.enrollmentApi.createSession.bind(h.enrollmentApi)
  let first = true
  h.hooks.create = (request) => {
    if (first) {
      first = false
      return delayedCreate.promise as never
    }
    h.hooks.create = null
    return originalCreate(request)
  }
  const cancelledEntry = h.store.enter('SYN-SIS-A')
  await tick()
  assert.equal(h.store.getSnapshot().status, 'entering')
  h.store.logout()
  assert.equal(h.store.getSnapshot().status, 'anonymous')
  assert.equal(h.store.getSnapshot().generation, 0)
  assert.deepEqual(h.identityEvents, [])

  await h.store.enter('SYN-SIS-B')
  const activeB = asActive(h.store.getSnapshot())
  assert.equal(activeB.actorId, 'SYN-SIS-B')
  assert.equal(activeB.generation, 1)
  delayedCreate.resolve({ runId, actorId: 'SYN-SIS-A', sessionId: sessionIdFor(9),
    startedAt: iso(BASE), expiresAt: iso(BASE + SESSION_DURATION_MS) })
  await cancelledEntry
  assert.equal(h.store.getSnapshot(), activeB)
  assert.equal(h.store.getSnapshot().generation, 1)
})

test('late_response_generation_ignored: a late dashboard read after actor switch is discarded and never observed', async () => {
  const h = harness()
  await h.store.enter('SYN-SIS-A')
  const slow = deferred<unknown>()
  h.hooks.read = (key, identity) => (identity.actorId === 'SYN-SIS-A' && key === 'matriculaInfo' ? slow.promise
    : Promise.resolve({ runId: identity.runId, data: { actorId: identity.actorId, sessionId: identity.sessionId, key,
      serverNow: iso(BASE + h.clock.t), payload: key === 'formulario' ? formularioFor(identity.actorId) : null } }))
  const late = h.store.read('matriculaInfo')
  const lateOutcome = late.then(() => 'resolved', (error: unknown) => error)
  h.store.logout()
  await h.store.enter('SYN-SIS-B')
  const before = asActive(h.store.getSnapshot())
  h.clock.t += 5000
  slow.resolve({ runId, data: { actorId: 'SYN-SIS-A', sessionId: sessionIdFor(1), key: 'matriculaInfo',
    serverNow: iso(BASE + 1), payload: { actorId: 'SYN-SIS-A' } } })
  const outcome = await lateOutcome
  assert.ok(outcome instanceof LocalProfileApiError && outcome.kind === 'stale', 'stale read must reject, not resolve')
  assert.equal(h.store.getSnapshot(), before)
})

test('logout_no_http: logout is synchronous, issues zero requests and clears the actor before the next render', async () => {
  const h = harness()
  await h.store.enter('SYN-SIS-A')
  const calls = { ...h.counts }
  const listeners = h.identityEvents.length
  h.store.logout()
  assert.deepEqual(h.counts, calls)
  assert.equal(h.store.getSnapshot().status, 'anonymous')
  assert.equal(JSON.stringify(h.store.getSnapshot()).includes('SYN-SIS-A'), false)
  assert.equal(h.identityEvents.length, listeners + 1)
  assert.equal(h.timers.length, 0)
  await assert.rejects(h.store.read('evaluaciones'), (error) => error instanceof LocalProfileApiError && error.kind === 'inactive')
  assert.equal(h.counts.read, calls.read)
  h.store.logout()
  assert.equal(h.identityEvents.length, listeners + 1, 'logout of an anonymous store changes nothing')
})

test('client_deadline_never_early: latency only delays expiry; at zero the store is expired and reads stop', async () => {
  const h = harness()
  h.hooks.createLatency = 3000
  await h.store.enter('SYN-SIS-A')
  const snapshot = asActive(h.store.getSnapshot())
  const serverDeadlineMono = SESSION_DURATION_MS
  assert.ok(snapshot.deadlineMono >= serverDeadlineMono, `${snapshot.deadlineMono} < ${serverDeadlineMono}`)
  assert.equal(snapshot.deadlineMono, 3000 + SESSION_DURATION_MS)
  assert.equal(remainingSeconds(snapshot.deadlineMono, 3000), 900)
  assert.equal(remainingSeconds(snapshot.deadlineMono, 3000 + 1), 900, 'rounded upward')
  assert.equal(remainingSeconds(snapshot.deadlineMono, snapshot.deadlineMono - 1), 1)
  assert.equal(remainingSeconds(snapshot.deadlineMono, snapshot.deadlineMono), 0)
  assert.equal(remainingSeconds(snapshot.deadlineMono, snapshot.deadlineMono + 50), 0)

  // The timer must not fire before the server deadline expressed on the client monotonic clock.
  assert.equal(h.timers.length, 1)
  assert.ok(h.timers[0]!.at >= serverDeadlineMono)
  h.clock.t = serverDeadlineMono + 1
  h.timers[0]!.fn()
  assert.equal(h.store.getSnapshot().status, 'active', 'a timer firing early re-arms instead of expiring')
  assert.equal(h.timers.length, 1)
  h.clock.t = snapshot.deadlineMono
  h.timers[0]!.fn()
  const expired = h.store.getSnapshot()
  assert.equal(expired.status, 'expired')
  assert.equal(h.timers.length, 0)
  const readsBefore = h.counts.read
  await assert.rejects(h.store.read('evaluaciones'), (error) => error instanceof LocalProfileApiError && error.kind === 'inactive')
  assert.equal(h.counts.read, readsBefore)
})

test('a fresher server instant can only tighten the countdown and never loosen it', async () => {
  const h = harness()
  h.hooks.createLatency = 3000
  await h.store.enter('SYN-SIS-A')
  const start = asActive(h.store.getSnapshot())
  h.clock.t = 100_000
  await h.store.read('evaluaciones') // serverNow = BASE+100000 -> exact server deadline in mono time
  const tightened = asActive(h.store.getSnapshot())
  assert.equal(tightened.deadlineMono, SESSION_DURATION_MS)
  assert.ok(tightened.deadlineMono >= SESSION_DURATION_MS)
  assert.ok(tightened.deadlineMono < start.deadlineMono)
  assert.equal(tightened.generation, start.generation)

  h.store.observe(iso(BASE + 1))
  assert.equal(asActive(h.store.getSnapshot()).deadlineMono, SESSION_DURATION_MS, 'older instants never extend')
  h.store.observe('not-a-date')
  assert.equal(asActive(h.store.getSnapshot()).deadlineMono, SESSION_DURATION_MS)
})

test('no_fallback_on_error: protocol and network failures end in error without data or retries', async () => {
  const createFails = harness()
  createFails.hooks.create = async () => { throw new MatriculaRegularApiError({ kind: 'network', operation: 'session', message: 'sin respuesta' }) }
  await createFails.store.enter('SYN-SIS-A')
  const failed = createFails.store.getSnapshot()
  assert.equal(failed.status, 'error')
  assert.equal(createFails.counts.create, 1)
  assert.equal(createFails.counts.read, 0)
  assert.equal(JSON.stringify(failed).includes('SYN-SIS-A'), false)

  const readFails = harness()
  readFails.hooks.read = async () => { throw new LocalProfileApiError({ kind: 'protocol', operation: 'read', message: 'contrato' }) }
  await readFails.store.enter('SYN-SIS-A')
  assert.equal(readFails.store.getSnapshot().status, 'error')
  assert.equal(readFails.counts.create, 1)
  assert.equal(readFails.counts.read, 1)
  assert.equal(readFails.identityEvents.length, 0)

  // A deliberate second entry may try again; it creates a new session and never reuses the orphan.
  readFails.hooks.read = null
  await readFails.store.enter('SYN-SIS-A')
  assert.equal(readFails.store.getSnapshot().status, 'active')
  assert.equal(readFails.counts.create, 2)
})

test('observe_no_loader_rerun: reads, observations, ticks, renewal and expiry never emit an identity change', async () => {
  const h = harness()
  await h.store.enter('SYN-SIS-A')
  const entered = asActive(h.store.getSnapshot())
  assert.deepEqual(h.identityEvents, ['enter'])
  for (let index = 0; index < 20; index += 1) {
    h.clock.t += 1000
    await h.store.read('evaluaciones')
    h.store.observe(iso(BASE + h.clock.t))
  }
  await h.store.renew()
  h.store.markExpired()
  assert.deepEqual(h.identityEvents, ['enter'])
  const final = asActive(h.store.getSnapshot())
  assert.equal(final.generation, entered.generation)
  assert.equal(final.status, 'expired')
  assert.equal(final.sessionId, entered.sessionId)
  assert.equal(final.formulario, entered.formulario)
  const rootData = profileRootLoaderData(final)
  assert.equal(rootData, entered.formulario)
})

test('identity_transition_clears_cache: exactly enter, logout and run change bump generation and notify once', async () => {
  const h = harness()
  const generations = [h.store.getSnapshot().generation]
  await h.store.enter('SYN-SIS-A')
  generations.push(h.store.getSnapshot().generation)
  assert.deepEqual(h.identityEvents, ['enter'])
  h.store.logout()
  generations.push(h.store.getSnapshot().generation)
  assert.deepEqual(h.identityEvents, ['enter', 'logout'])
  await h.store.enter('SYN-SIS-B')
  generations.push(h.store.getSnapshot().generation)
  h.store.markRunChanged()
  generations.push(h.store.getSnapshot().generation)
  assert.deepEqual(h.identityEvents, ['enter', 'logout', 'enter', 'run-changed'])
  assert.deepEqual(generations.map((value, index) => index === 0 ? 0 : value - generations[index - 1]!), [0, 1, 1, 1, 1])
  const reset = h.store.getSnapshot()
  assert.equal(reset.status, 'anonymous')
  assert.equal(reset.status === 'anonymous' && reset.notice, 'reset')
})

test('entering from an expired session logs out first and then enters the new actor', async () => {
  const h = harness()
  await h.store.enter('SYN-SIS-A')
  h.store.markExpired()
  await h.store.enter('SYN-SOFT-A')
  assert.deepEqual(h.identityEvents, ['enter', 'logout', 'enter'])
  const snapshot = asActive(h.store.getSnapshot())
  assert.equal(snapshot.status, 'active')
  assert.equal(snapshot.actorId, 'SYN-SOFT-A')
  assert.equal(h.counts.create, 2)
})

test('renew keeps session identity and startedAt, moves the deadline and never touches generation', async () => {
  const h = harness()
  await h.store.enter('SYN-SIS-A')
  const before = asActive(h.store.getSnapshot())
  h.clock.t = 600_000
  await h.store.renew()
  const after = asActive(h.store.getSnapshot())
  assert.equal(after.status, 'active')
  assert.equal(after.sessionId, before.sessionId)
  assert.equal(after.startedAt, before.startedAt)
  assert.equal(after.expiresAt, iso(BASE + 600_000 + SESSION_DURATION_MS))
  assert.equal(after.deadlineMono, 600_000 + SESSION_DURATION_MS)
  assert.equal(after.generation, before.generation)
  assert.equal(after.renewing, false)
  assert.deepEqual(h.identityEvents, ['enter'])
  assert.equal(h.counts.renew, 1)
})

test('renew failures: SESSION_EXPIRED expires the session, RUN_CHANGED resets it, others keep it and show the error', async () => {
  const expired = harness()
  await expired.store.enter('SYN-SIS-A')
  expired.hooks.renew = async () => { throw new MatriculaRegularApiError({ kind: 'http', operation: 'renew', status: 409, code: 'SESSION_EXPIRED', message: 'x' }) }
  await expired.store.renew()
  assert.equal(expired.store.getSnapshot().status, 'expired')
  assert.deepEqual(expired.identityEvents, ['enter'])
  await expired.store.renew()
  assert.equal(expired.counts.renew, 1, 'expired sessions are never renewed')

  const reset = harness()
  await reset.store.enter('SYN-SIS-A')
  reset.hooks.renew = async () => { throw new MatriculaRegularApiError({ kind: 'http', operation: 'renew', status: 409, code: 'RUN_CHANGED', message: 'x' }) }
  await reset.store.renew()
  assert.equal(reset.store.getSnapshot().status, 'anonymous')
  assert.deepEqual(reset.identityEvents, ['enter', 'run-changed'])

  const transient = harness()
  await transient.store.enter('SYN-SIS-A')
  transient.hooks.renew = async () => { throw new MatriculaRegularApiError({ kind: 'network', operation: 'renew', message: 'red' }) }
  await transient.store.renew()
  const snapshot = asActive(transient.store.getSnapshot())
  assert.equal(snapshot.status, 'active')
  assert.equal(snapshot.renewing, false)
  assert.ok(snapshot.renewError)
})

test('a read answered with SESSION_EXPIRED or RUN_CHANGED moves the store without any retry', async () => {
  const expired = harness()
  await expired.store.enter('SYN-SIS-A')
  expired.hooks.read = async () => { throw new LocalProfileApiError({ kind: 'http', operation: 'read', status: 409, code: 'SESSION_EXPIRED', message: 'x' }) }
  await assert.rejects(expired.store.read('evaluaciones'), LocalProfileApiError)
  assert.equal(expired.store.getSnapshot().status, 'expired')
  assert.equal(expired.counts.read, 2)

  const reset = harness()
  await reset.store.enter('SYN-SIS-A')
  reset.hooks.read = async () => { throw new LocalProfileApiError({ kind: 'http', operation: 'read', status: 409, code: 'RUN_CHANGED', message: 'x' }) }
  await assert.rejects(reset.store.read('evaluaciones'), LocalProfileApiError)
  const snapshot = reset.store.getSnapshot()
  assert.equal(snapshot.status, 'anonymous')
  assert.equal(snapshot.status === 'anonymous' && snapshot.notice, 'reset')
})

test('expired_guard_exception: only the already mounted enrollment screen survives expiry', async () => {
  const h = harness()
  const anonymous = h.store.getSnapshot()
  assert.deepEqual(evaluateProfileGuard(anonymous, { pathname: '/alumnoWebSum/v2/inicio', cause: 'enter' }), { redirect: '/local/login' })
  assert.deepEqual(evaluateProfileGuard(anonymous, { pathname: '/local/matricula-regular', cause: 'enter' }), { redirect: '/local/login' })
  assert.equal(evaluateProfileGuard(anonymous, { pathname: '/local/login', cause: 'enter' }), null)
  assert.equal(profileRootLoaderData(anonymous), null)

  await h.store.enter('SYN-SIS-A')
  const active = h.store.getSnapshot()
  assert.equal(evaluateProfileGuard(active, { pathname: '/alumnoWebSum/v2/inicio', cause: 'enter' }), null)
  assert.equal(evaluateProfileGuard(active, { pathname: '/local/matricula-regular/reporte/x', cause: 'enter' }), null)
  assert.deepEqual(evaluateProfileGuard(active, { pathname: '/local/login', cause: 'enter' }), { redirect: '/alumnoWebSum/v2/inicio' })

  // Expiry on Home -> immediate navigation to the chooser; on the mounted enrollment screen -> stays.
  assert.equal(expiryNavigationTarget('/alumnoWebSum/v2/inicio'), '/local/login')
  assert.equal(expiryNavigationTarget('/local/matricula-regular'), null)
  assert.equal(expiryNavigationTarget('/local/matricula-regular/'), null)
  assert.equal(expiryNavigationTarget('/local/matricula-regular/reporte/abc'), '/local/login')

  h.store.markExpired()
  const expired = h.store.getSnapshot()
  assert.equal(expired.status, 'expired')
  assert.ok(profileRootLoaderData(expired))
  assert.equal(evaluateProfileGuard(expired, { pathname: '/local/matricula-regular', cause: 'stay' }), null)
  for (const cause of ['enter', 'preload'] as const) {
    assert.deepEqual(evaluateProfileGuard(expired, { pathname: '/local/matricula-regular', cause }), { redirect: '/local/login' })
  }
  assert.deepEqual(evaluateProfileGuard(expired, { pathname: '/alumnoWebSum/v2/inicio', cause: 'stay' }), { redirect: '/local/login' })
  assert.deepEqual(evaluateProfileGuard(expired, { pathname: '/local/matricula-regular/reporte/x', cause: 'enter' }), { redirect: '/local/login' })
  assert.equal(evaluateProfileGuard(expired, { pathname: '/local/login', cause: 'enter' }), null)
  const loads = h.counts.read
  await assert.rejects(h.store.read('programacion'))
  assert.equal(h.counts.read, loads, 'expired sessions issue no dashboard load')
})

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  }
}

const storedIdentity = (sessionNumber: number) =>
  JSON.stringify({ runId, actorId: 'SYN-SIS-A', sessionId: sessionIdFor(sessionNumber) })

test('resume_persists_identity: entering stores only run/actor/session for the tab; logout removes it', async () => {
  const storage = memoryStorage()
  const h = harness({ identityStorage: storage })
  await h.store.enter('SYN-SIS-A')
  const active = asActive(h.store.getSnapshot())
  assert.deepEqual(JSON.parse(storage.data.get(LOCAL_PROFILE_IDENTITY_KEY)!),
    { runId, actorId: 'SYN-SIS-A', sessionId: active.sessionId })
  assert.equal(storage.data.size, 1)
  h.store.logout()
  assert.equal(storage.data.has(LOCAL_PROFILE_IDENTITY_KEY), false)
})

test('resume_renews_on_reload: a new store renews the stored session to 15 minutes without creating one', async () => {
  const storage = memoryStorage()
  const first = harness({ identityStorage: storage })
  await first.store.enter('SYN-SIS-A')
  const before = asActive(first.store.getSnapshot())
  const reloaded = harness({ identityStorage: storage })
  reloaded.clock.t = 300_000
  reloaded.hooks.renew = async (sessionId, request) => ({ runId: request.runId, actorId: request.actorId, sessionId,
    startedAt: before.startedAt, expiresAt: iso(BASE + 300_000 + SESSION_DURATION_MS) })
  await reloaded.store.resume()
  const resumed = asActive(reloaded.store.getSnapshot())
  assert.equal(resumed.status, 'active')
  assert.equal(resumed.sessionId, before.sessionId)
  assert.equal(resumed.deadlineMono, 300_000 + SESSION_DURATION_MS)
  assert.equal(reloaded.counts.create, 0)
  assert.equal(reloaded.counts.renew, 1)
  assert.deepEqual(reloaded.identityEvents, ['enter'])
})

test('resume_expired_or_invalid: failures clear the stored identity and leave the chooser without creating sessions', async () => {
  const expiredStorage = memoryStorage({ [LOCAL_PROFILE_IDENTITY_KEY]: storedIdentity(9) })
  const expired = harness({ identityStorage: expiredStorage })
  expired.hooks.renew = async () => { throw new MatriculaRegularApiError({ kind: 'http', operation: 'renew', status: 409, code: 'SESSION_EXPIRED', message: 'x' }) }
  await expired.store.resume()
  assert.equal(expired.store.getSnapshot().status, 'anonymous')
  assert.equal(expiredStorage.data.has(LOCAL_PROFILE_IDENTITY_KEY), false)
  assert.equal(expired.counts.create, 0)

  const runChangedStorage = memoryStorage({ [LOCAL_PROFILE_IDENTITY_KEY]: storedIdentity(9) })
  const runChanged = harness({ identityStorage: runChangedStorage })
  runChanged.hooks.renew = async () => { throw new MatriculaRegularApiError({ kind: 'http', operation: 'renew', status: 409, code: 'RUN_CHANGED', message: 'x' }) }
  await runChanged.store.resume()
  const reset = runChanged.store.getSnapshot()
  assert.ok(reset.status === 'anonymous' && reset.notice === 'reset')
  assert.equal(runChangedStorage.data.has(LOCAL_PROFILE_IDENTITY_KEY), false)

  for (const raw of ['not-json', JSON.stringify({ runId, actorId: 'real-student', sessionId: sessionIdFor(9) })]) {
    const storage = memoryStorage({ [LOCAL_PROFILE_IDENTITY_KEY]: raw })
    const h = harness({ identityStorage: storage })
    await h.store.resume()
    assert.equal(h.store.getSnapshot().status, 'anonymous')
    assert.equal(h.counts.renew + h.counts.read + h.counts.create, 0)
    assert.equal(storage.data.has(LOCAL_PROFILE_IDENTITY_KEY), false)
  }

  const empty = harness({ identityStorage: memoryStorage() })
  await empty.store.resume()
  assert.equal(empty.counts.renew, 0)
  assert.equal(empty.store.getSnapshot().status, 'anonymous')
})

test('expiry_clears_identity: an expired session is never resumed after a reload', async () => {
  const storage = memoryStorage()
  const h = harness({ identityStorage: storage })
  await h.store.enter('SYN-SIS-A')
  h.store.markExpired()
  assert.equal(storage.data.has(LOCAL_PROFILE_IDENTITY_KEY), false)
})

test('visibility_renewal: only a return to a visible tab renews; disposal removes the listener', () => {
  const listeners = new Set<() => void>()
  const doc = {
    visibilityState: 'hidden',
    addEventListener: (_type: 'visibilitychange', listener: () => void) => { listeners.add(listener) },
    removeEventListener: (_type: 'visibilitychange', listener: () => void) => { listeners.delete(listener) },
  }
  let renewals = 0
  const dispose = bindVisibilityRenewal(doc, async () => { renewals += 1 })
  for (const listener of listeners) listener()
  assert.equal(renewals, 0)
  doc.visibilityState = 'visible'
  for (const listener of listeners) listener()
  assert.equal(renewals, 1)
  dispose()
  assert.equal(listeners.size, 0)
})

test('scenario entry refuses a changed run before creating a student session', async () => {
  const h = harness()
  h.hooks.run = nextRunId
  await h.store.enter('SYN-SIS-A', { expectedRunId: runId })
  assert.equal(h.counts.create, 0)
  const state = h.store.getSnapshot()
  assert.ok(state.status === 'error' && state.message.includes('La prueba cambió'))
})

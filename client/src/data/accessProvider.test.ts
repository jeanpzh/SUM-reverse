import assert from 'node:assert/strict'
import test from 'node:test'
import { AccessApiError, createAccessProvider } from './accessProvider.ts'

const principal = {
  data: {
    actorId: 'SYN-STUDENT-001',
    campaignId: '11111111-1111-4111-8111-111111111111',
    runId: '22222222-2222-4222-8222-222222222222',
    expiresAt: '2026-10-19T12:15:00.000Z',
  },
}

test('login keeps credential only in the request body and uses the HttpOnly cookie transport', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const api = createAccessProvider({ fetchImpl: async (url, init = {}) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(principal), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } })
  const credential = 'A'.repeat(43)
  await api.login(credential)
  assert.equal(calls[0]?.url, '/api/simulator/auth/v1/login')
  assert.equal(calls[0]?.init.credentials, 'include')
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), { credential })
  assert.equal(calls[0]?.url.includes(credential), false)
  assert.deepEqual(api.getSnapshot(), principal.data)
})

test('current and logout use cookie session routes without returning credentials', async () => {
  const calls: string[] = []
  const api = createAccessProvider({ fetchImpl: async (url, init = {}) => {
    calls.push(`${init.method ?? 'GET'} ${String(url)}`)
    return init.method === 'POST' && String(url).endsWith('/logout')
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(principal), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } })
  await api.current()
  await api.logout()
  assert.deepEqual(calls, ['GET /api/simulator/auth/v1/session', 'POST /api/simulator/auth/v1/logout'])
  assert.equal(api.getSnapshot(), null)
})

test('rejects noncanonical principals and invalid credentials', async () => {
  for (const malformed of [
    { ...principal, extra: true },
    { data: { ...principal.data, campaignId: 'not-a-uuid' } },
    { data: { ...principal.data, expiresAt: '2026-10-19T12:15:00Z' } },
  ]) {
    const api = createAccessProvider({ fetchImpl: async () => new Response(JSON.stringify(malformed), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }) })
    await assert.rejects(api.current(), /contrato/)
  }
  const api = createAccessProvider({ fetchImpl: async () => { throw new Error('must not be called') } })
  await assert.rejects(api.login('not-a-token'), (error) => error instanceof AccessApiError && error.status === 400)
})

test('treats auth errors as failures and ignores a response invalidated by logout', async () => {
  const api = createAccessProvider({ fetchImpl: async (_url, init = {}) => {
    if (init.method === 'POST') return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', fields: [] } }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
    return new Response(JSON.stringify(principal), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } })
  await assert.rejects(api.login('A'.repeat(43)), (error) => error instanceof AccessApiError && error.status === 401)
  const deferred: { resolve?: (response: Response) => void } = {}
  const racing = createAccessProvider({ fetchImpl: (url) => String(url).endsWith('/logout')
    ? Promise.resolve(new Response(null, { status: 204 }))
    : new Promise((resolve) => { deferred.resolve = resolve }) })
  const pending = racing.current()
  const logout = racing.logout()
  deferred.resolve?.(new Response(JSON.stringify(principal), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  await assert.rejects(pending, /invalidada/)
  await logout
  assert.equal(racing.getSnapshot(), null)
})

test('a new login waits for the previous logout response and keeps the new principal', async () => {
  const nextPrincipal = { data: { ...principal.data, actorId: 'SYN-STUDENT-002' } }
  let resolveLogout!: (response: Response) => void
  const calls: string[] = []
  const api = createAccessProvider({ fetchImpl: async (url, init = {}) => {
    const path = String(url).split('/').at(-1)!
    calls.push(`${init.method ?? 'GET'} ${path}`)
    if (path === 'session') return new Response(JSON.stringify(principal), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (path === 'logout') return new Promise((resolve) => { resolveLogout = resolve })
    return new Response(JSON.stringify(nextPrincipal), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } })

  await api.current()
  const logout = api.logout()
  const login = api.login('B'.repeat(43))
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.deepEqual(calls, ['GET session', 'POST logout'])
  resolveLogout(new Response(null, { status: 204 }))
  await logout
  assert.deepEqual(await login, nextPrincipal.data)
  assert.deepEqual(calls, ['GET session', 'POST logout', 'POST login'])
  assert.deepEqual(api.getSnapshot(), nextPrincipal.data)
})

test('a failed logout blocks later login until revocation is confirmed', async () => {
  let logoutFails = true
  const calls: string[] = []
  const api = createAccessProvider({ fetchImpl: async (url, init = {}) => {
    const path = String(url).split('/').at(-1)!
    calls.push(`${init.method ?? 'GET'} ${path}`)
    if (path === 'session') return new Response(JSON.stringify(principal), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (path === 'logout' && logoutFails) return new Response(JSON.stringify({ error: { code: 'STORAGE_UNAVAILABLE', fields: [] } }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
    if (path === 'logout') return new Response(null, { status: 204 })
    return new Response(JSON.stringify({ data: { ...principal.data, actorId: 'SYN-STUDENT-002' } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } })
  let logoutStateChanges = 0
  const unsubscribe = api.subscribe(() => { logoutStateChanges += 1 })

  await api.current()
  await assert.rejects(api.logout(), /No se pudo confirmar el cierre de sesión/)
  assert.equal(api.getSnapshot(), null)
  assert.match(api.getLogoutErrorSnapshot()?.message ?? '', /No se pudo confirmar el cierre de sesión/)
  await assert.rejects(api.login('C'.repeat(43)), /No se pudo confirmar el cierre de sesión/)
  assert.deepEqual(calls, ['GET session', 'POST logout'])

  logoutFails = false
  await api.logout()
  assert.equal(api.getLogoutErrorSnapshot(), null)
  await api.login('C'.repeat(43))
  assert.deepEqual(calls, ['GET session', 'POST logout', 'POST logout', 'POST login'])
  assert.equal(api.getSnapshot()?.actorId, 'SYN-STUDENT-002')
  assert.equal(logoutStateChanges, 2)
  unsubscribe()
})

import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { ModulesContainer } from '@nestjs/core'
import { MatriculaRegularRepository } from '../dist/matricula-regular/matricula-regular.repository.js'
import {
  createLocalProfileDashboardTestApp,
  type LocalProfileDashboardTestApp,
} from './local-profile-dashboard-test-app.js'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const BACKEND_DIR = resolve(TEST_DIR, '..')
const FACTORY_SOURCE = join(TEST_DIR, 'local-profile-dashboard-test-app.ts')
const COMPILED_ENTRY = join(BACKEND_DIR, 'dist', 'local-profile-dashboard', 'local-profile-dashboard.module.js')
const BASE_INSTANT = Date.parse('2026-08-11T14:00:00.000Z')
const actorOrder = ['SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B']
const opened: LocalProfileDashboardTestApp[] = []
const occupied: Server[] = []

async function open(options?: Parameters<typeof createLocalProfileDashboardTestApp>[0]) {
  const handle = await createLocalProfileDashboardTestApp(options)
  opened.push(handle)
  return handle
}

async function occupyEphemeralPort(): Promise<number> {
  const server = createServer()
  occupied.push(server)
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', () => resolveListen())
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Puerto efímero no disponible')
  return address.port
}

function importClosure(entry: string) {
  const files = new Set<string>()
  const packages = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (files.has(file)) continue
    files.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
      if (match[1].startsWith('.')) queue.push(resolve(dirname(file), match[1]))
      else packages.add(match[1])
    }
  }
  return { files: [...files], packages: [...packages].sort() }
}

async function postSession(origin: string, runId: string, actorId: string) {
  const response = await fetch(`${origin}/local/matricula-regular/v1/sesiones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ runId, actorId }),
  })
  return { status: response.status, body: await response.json() as { runId: string; data: { sessionId: string; startedAt: string; expiresAt: string } } }
}

function consult(origin: string, key: string, identity: { runId: string; actorId: string; sessionId: string }) {
  return fetch(`${origin}/local/perfiles/v1/consultas/${key}?${new URLSearchParams(identity)}`, {
    headers: { Accept: 'application/json' },
  })
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((handle) => handle.close()))
  await Promise.all(occupied.splice(0).map((server) => new Promise<void>((done) => {
    server.close(() => done())
  })))
})

it('composition_provenance mounts only the dashboard module and its single enrollment import', async () => {
  const { app, repository } = await open()
  const modules = [...app.get(ModulesContainer).values()]
  const moduleNames = modules.map((entry) => entry.metatype?.name ?? '').sort()
  const controllers = modules.flatMap((entry) => [...entry.controllers.values()].map((wrapper) => wrapper.metatype?.name ?? ''))
  const repositoryProviders = modules.flatMap((entry) => [...entry.providers.values()])
    .filter((wrapper) => wrapper.metatype === MatriculaRegularRepository)

  expect(moduleNames).toEqual(['InternalCoreModule', 'LocalProfileDashboardModule', 'MatriculaRegularModule', 'RootTestModule'])
  expect(controllers.sort((left, right) => left.localeCompare(right))).toEqual([
    'LocalProfileDashboardController', 'LocalScenariosController', 'MatriculaRegularController',
  ])
  expect(repositoryProviders).toHaveLength(1)
  expect(app.get(MatriculaRegularRepository)).toBe(repository)
})

it('composition_provenance has no operator, snapshot or environment reachable from the compiled graph', () => {
  const { files, packages } = importClosure(COMPILED_ENTRY)
  const relative = files.map((file) => file.slice(resolve(BACKEND_DIR, '..').length + 1))
  const directories = new Set(relative.map((file) => dirname(file)))

  expect([...directories].sort()).toEqual([
    'backend/dist/local-profile-dashboard',
    'backend/dist/matricula-regular',
    'backend/dist/matricula-regular/dto',
    'backend/dist/mi-informacion',
    'shared',
  ])
  expect(relative.filter((file) => /snapshot|app\.module|reportes|operator|datos-reales/i.test(file))).toEqual([])
  expect(relative.filter((file) => file.startsWith('backend/dist/mi-informacion'))).toEqual([
    'backend/dist/mi-informacion/mi-informacion.catalogs.js',
  ])
  expect(packages).toEqual(['@nestjs/common', 'node:crypto'])
  for (const file of files) {
    expect(readFileSync(file, 'utf8'), file).not.toMatch(/process\.env|node:fs|node:child_process|MATRICULA_SNAPSHOT/)
  }
  const factory = readFileSync(FACTORY_SOURCE, 'utf8')
  expect(factory).not.toMatch(/AppModule|app\.module|process\.env|MATRICULA_SNAPSHOT|datos-reales|snapshots?\.js/)
})

it('real_http serves the exact four-actor catalog and one create/consult session over loopback', async () => {
  const handle = await open()
  const origin = await handle.listen()

  expect(origin).toMatch(/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/)
  expect(await handle.listen()).toBe(origin)
  expect(handle.app.getHttpServer().address()).toMatchObject({ address: '127.0.0.1', family: 'IPv4' })

  const catalog = await fetch(`${origin}/local/perfiles/v1/perfiles`, { headers: { Accept: 'application/json' } })
  const catalogBody = await catalog.json() as { runId: string; data: { serverNow: string; profiles: { actorId: string; scope: { schoolId: string } }[] } }
  expect(catalog.status).toBe(200)
  expect(catalogBody.data.profiles.map(({ actorId }) => actorId)).toEqual(actorOrder)
  expect(catalogBody.data.profiles.map(({ scope }) => scope.schoolId)).toEqual(['SISTEMAS', 'SISTEMAS', 'SOFTWARE', 'SOFTWARE'])
  expect(catalogBody.runId).toBe(handle.repository.runId)

  const created = await postSession(origin, catalogBody.runId, 'SYN-SOFT-B')
  expect(created.status).toBe(200)
  expect(handle.repository.readSnapshot().sessions).toHaveLength(1)

  const identity = { runId: catalogBody.runId, actorId: 'SYN-SOFT-B', sessionId: created.body.data.sessionId }
  const read = await consult(origin, 'formulario', identity)
  const readBody = await read.json() as { data: { actorId: string; key: string; payload: { alumno: { codAlumno: string } } } }
  expect(read.status).toBe(200)
  expect(readBody.data).toMatchObject({ actorId: 'SYN-SOFT-B', key: 'formulario' })
  expect(readBody.data.payload.data.alumno.codAlumno).toBe('SYN-SOFT-B')
  expect(handle.repository.readSnapshot().sessions).toHaveLength(1)
}, 30000)

it('real_http exposes no reset, test-control or operator route', async () => {
  const handle = await open()
  const origin = await handle.listen()
  const probes = [
    ['POST', '/local/perfiles/v1/reset'],
    ['POST', '/local/matricula-regular/v1/reset'],
    ['POST', '/reset'],
    ['GET', '/'],
    ['GET', '/local/perfiles/v1/estado'],
  ] as const

  for (const [method, path] of probes) {
    const response = await fetch(`${origin}${path}`, { method })
    expect(response.status, `${method} ${path}`).toBe(404)
  }
})

it('clock_injection advances from the 14:00Z demo base by default', async () => {
  const handle = await open()
  const first = handle.clock.now().getTime()
  await new Promise((done) => setTimeout(done, 20))
  const second = handle.clock.now().getTime()

  expect(first).toBeGreaterThanOrEqual(BASE_INSTANT)
  expect(first - BASE_INSTANT).toBeLessThan(60000)
  expect(second).toBeGreaterThan(first)
})

it('clock_injection uses the caller clock for catalog, session expiry and read rejection', async () => {
  const controlled = { instant: BASE_INSTANT + 1000 }
  const clock = { now: () => new Date(controlled.instant) }
  const handle = await open({ clock })
  const origin = await handle.listen()

  expect(handle.clock).toBe(clock)
  const catalog = await (await fetch(`${origin}/local/perfiles/v1/perfiles`)).json() as { runId: string; data: { serverNow: string } }
  expect(catalog.data.serverNow).toBe('2026-08-11T14:00:01.000Z')

  const created = await postSession(origin, catalog.runId, 'SYN-SIS-A')
  expect(created.body.data.startedAt).toBe('2026-08-11T14:00:01.000Z')
  expect(created.body.data.expiresAt).toBe('2026-08-11T14:15:01.000Z')
  const identity = { runId: catalog.runId, actorId: 'SYN-SIS-A', sessionId: created.body.data.sessionId }

  controlled.instant += 899999
  expect((await consult(origin, 'formulario', identity)).status).toBe(200)
  controlled.instant += 1
  const expired = await consult(origin, 'formulario', identity)
  expect(expired.status).toBe(409)
  expect((await expired.json() as { error: { code: string } }).error.code).toBe('SESSION_EXPIRED')
}, 30000)

it('reset_isolation starts a new run with fresh actors and never shares state between instances', async () => {
  const first = await open()
  const second = await open()
  const origin = await first.listen()
  const oldRun = first.repository.runId
  const created = await postSession(origin, oldRun, 'SYN-SIS-B')
  const identity = { runId: oldRun, actorId: 'SYN-SIS-B', sessionId: created.body.data.sessionId }

  expect(first.repository).not.toBe(second.repository)
  expect(second.repository.runId).not.toBe(oldRun)
  expect(second.repository.readSnapshot().sessions).toEqual([])

  const newRun = first.reset()
  expect(newRun).toBe(first.repository.runId)
  expect(newRun).not.toBe(oldRun)
  const snapshot = first.repository.readSnapshot()
  expect(snapshot.sessions).toEqual([])
  expect(snapshot.actors.map(({ actorId }) => actorId)).toEqual(actorOrder)

  const stale = await consult(origin, 'formulario', identity)
  expect(stale.status).toBe(409)
  expect(await stale.json()).toMatchObject({ runId: newRun, error: { code: 'RUN_CHANGED' } })
}, 30000)

it('lifecycle_cleanup closes the listener idempotently and rejects later use', async () => {
  const handle = await open()
  const origin = await handle.listen()
  expect((await fetch(`${origin}/local/perfiles/v1/perfiles`)).status).toBe(200)

  await handle.close()
  await handle.close()
  await expect(fetch(`${origin}/local/perfiles/v1/perfiles`)).rejects.toThrow()
  await expect(handle.listen()).rejects.toThrow(/cerrada/)
})

it('lifecycle_cleanup aborts an occupied explicit port without touching the unknown listener', async () => {
  const port = await occupyEphemeralPort()
  const handle = await open()

  await expect(handle.listen(port)).rejects.toThrow(/ocupado/)
  await handle.close()
  const survivor = occupied[0]
  expect(survivor.listening).toBe(true)
})

it('lifecycle_cleanup validates explicit ports before binding', async () => {
  const handle = await open()

  for (const port of [-1, 1.5, 65536, Number.NaN]) {
    await expect(handle.listen(port), String(port)).rejects.toThrow(/puerto/i)
  }
  expect(handle.app.getHttpServer().listening).toBe(false)
})

it('clock_injection rejects a caller clock without now() before building anything', async () => {
  await expect(createLocalProfileDashboardTestApp({ clock: { now: 'invalid' } as never })).rejects.toThrow(/reloj/i)
})

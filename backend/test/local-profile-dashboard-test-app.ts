// Isolated, synthetic composition of the local profile dashboard (LPD-CONTRACT-1, LPD-DEC-1 D6).
//
// Shared by the bootstrap spec, scripts/start-local-profile-dashboard.mjs and later verifiers.
// It composes ONLY LocalProfileDashboardModule and its single MatriculaRegularModule import,
// with independently constructed fixtures for the four SYN actors. It never imports the operator
// application module, snapshot/operator repositories or process configuration, and exposes no
// HTTP reset route.
//
// Runtime values come from the COMPILED backend (`backend/dist`, produced by
// `pnpm --dir backend build`), so this file uses erasable TypeScript only and runs both under
// Vitest and under plain Node (`node --experimental-strip-types`, default in Node >= 22.18/24).
// A missing or stale `dist` aborts with an actionable error instead of silently using old code.
//
// Origin/config input for consumers: `listen(port?)` binds 127.0.0.1 only (port omitted or 0 =
// ephemeral) and resolves the actual origin, e.g. `http://127.0.0.1:41233`. Pass that origin as
// SUM_LOCAL_PROFILE_BACKEND_ORIGIN to client/vite.local-profile-test.config.ts.
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import type { ServerClock } from '../dist/matricula-regular/clock.js'
import type { MatriculaRegularRepository } from '../dist/matricula-regular/matricula-regular.repository.js'
import type { SyntheticFixture } from '../src/matricula-regular/profile.types.js'
import type { EnrollmentScenarioBundle } from '../src/matricula-regular/enrollment-scenarios.js'

export const LOCAL_PROFILE_DASHBOARD_HOST = '127.0.0.1'

const BACKEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD_HINT = 'ejecuta `pnpm --dir backend build` antes de usar el runtime compilado'

export type LocalProfileDashboardTestAppOptions = {
  clock?: ServerClock
  fixtures?: readonly SyntheticFixture[]
  scenarios?: readonly EnrollmentScenarioBundle[]
}

export type LocalProfileDashboardTestApp = {
  app: INestApplication
  repository: MatriculaRegularRepository
  clock: ServerClock
  listen(port?: number): Promise<string>
  reset(): string
  close(): Promise<void>
}

function newestMtime(directory: string, extension: string): number {
  let newest = 0
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) newest = Math.max(newest, newestMtime(path, extension))
    else if (entry.name.endsWith(extension)) newest = Math.max(newest, statSync(path).mtimeMs)
  }
  return newest
}

function assertCompiledRuntimeFresh(): void {
  const dist = join(BACKEND_DIR, 'dist')
  let compiled: number
  try {
    compiled = newestMtime(dist, '.js')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`No existe backend/dist: ${BUILD_HINT}`, { cause: error })
    }
    throw error
  }
  if (compiled === 0) throw new Error(`backend/dist no contiene módulos compilados: ${BUILD_HINT}`)
  if (newestMtime(join(BACKEND_DIR, 'src'), '.ts') > compiled) {
    throw new Error(`backend/dist está desactualizado respecto de backend/src: ${BUILD_HINT}`)
  }
}

async function loadCompiledRuntime() {
  assertCompiledRuntimeFresh()
  const dashboard = await import('../dist/local-profile-dashboard/local-profile-dashboard.module.js')
  const enrollment = await import('../dist/matricula-regular/matricula-regular.module.js')
  const repository = await import('../dist/matricula-regular/matricula-regular.repository.js')
  const clock = await import('../dist/matricula-regular/clock.js')
  const academicFixtures = await import('../dist/matricula-regular/academic-demo.fixtures.js')
  return {
    LocalProfileDashboardModule: dashboard.LocalProfileDashboardModule,
    MATRICULA_REGULAR_CLOCK: enrollment.MATRICULA_REGULAR_CLOCK,
    MatriculaRegularRepository: repository.MatriculaRegularRepository,
    createAdvancingSyntheticClock: clock.createAdvancingSyntheticClock,
    createSwitchableClock: clock.createSwitchableClock,
    createSyntheticAcademicDemoFixture: academicFixtures.createSyntheticAcademicDemoFixture,
  }
}

function assertClock(clock: unknown): asserts clock is ServerClock {
  if (typeof clock !== 'object' || clock === null || !('now' in clock) || typeof clock.now !== 'function') {
    throw new TypeError('El reloj inyectado debe exponer now()')
  }
}

function assertPort(port: unknown): asserts port is number {
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 0 || port > 65535) {
    throw new RangeError('El puerto debe ser un entero entre 0 y 65535')
  }
}

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
}

export async function createLocalProfileDashboardTestApp(
  options: LocalProfileDashboardTestAppOptions = {},
): Promise<LocalProfileDashboardTestApp> {
  const runtime = await loadCompiledRuntime()
  const clock = options.clock ?? runtime.createAdvancingSyntheticClock()
  assertClock(clock)
  const activeClock = options.scenarios === undefined ? clock : runtime.createSwitchableClock(clock)

  const testingModule = await Test.createTestingModule({ imports: [runtime.LocalProfileDashboardModule] })
    .overrideProvider(runtime.MATRICULA_REGULAR_CLOCK)
    .useValue(activeClock)
    .compile()
  const app = testingModule.createNestApplication({ logger: false })
  let closing: Promise<void> | undefined
  const close = () => (closing ??= app.close())
  try {
    await app.init()
  } catch (error) {
    await close()
    throw error
  }
  const repository = app.get(runtime.MatriculaRegularRepository)
  const defaultFixtures = [
    runtime.createSyntheticAcademicDemoFixture('SISTEMAS'),
    runtime.createSyntheticAcademicDemoFixture('SOFTWARE'),
  ]
  const seedFixtures = structuredClone(options.fixtures ?? defaultFixtures)
  const reset = () => repository.resetForTests(structuredClone(seedFixtures))
  reset()
  if (options.scenarios !== undefined) {
    const scenarios = await import('../dist/local-profile-dashboard/local-scenarios.service.js')
    app.get(scenarios.LocalScenariosService).configure(options.scenarios)
  }
  let listening: { requested: number; origin: Promise<string> } | undefined

  async function bind(port: number): Promise<string> {
    try {
      await app.listen(port, LOCAL_PROFILE_DASHBOARD_HOST)
    } catch (error) {
      await close()
      if (errorCode(error) === 'EADDRINUSE') {
        throw new Error(`El puerto sintético ${port} ya está ocupado`, { cause: error })
      }
      throw error
    }
    const address = app.getHttpServer().address()
    if (address === null || typeof address === 'string') {
      await close()
      throw new Error('El servidor sintético no expone un puerto TCP')
    }
    return `http://${LOCAL_PROFILE_DASHBOARD_HOST}:${address.port}`
  }

  return {
    app,
    repository,
    clock: activeClock,
    listen(port = 0) {
      if (closing !== undefined) return Promise.reject(new Error('La aplicación sintética ya está cerrada'))
      try {
        assertPort(port)
      } catch (error) {
        return Promise.reject(error)
      }
      if (listening !== undefined) {
        return port === 0 || port === listening.requested
          ? listening.origin
          : Promise.reject(new Error('La aplicación sintética ya escucha en otro puerto'))
      }
      listening = { requested: port, origin: bind(port) }
      return listening.origin
    },
    reset,
    close,
  }
}

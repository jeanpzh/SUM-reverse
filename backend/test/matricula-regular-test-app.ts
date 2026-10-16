import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { MatriculaRegularModule, MATRICULA_REGULAR_CLOCK } from '../src/matricula-regular/matricula-regular.module.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { createSyntheticClock, type ServerClock } from '../src/matricula-regular/clock.js'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'
import type { SyntheticFixture } from '../src/matricula-regular/profile.types.js'

const HOST = '127.0.0.1'
const API_PORT = 5742

export type MatriculaRegularTestApp = {
  app: INestApplication
  clock: ServerClock
  repository: MatriculaRegularRepository
  listen(): Promise<void>
  reset(): string
  close(): Promise<void>
}

export async function createMatriculaRegularTestApp(
  clock: ServerClock = createSyntheticClock(),
): Promise<MatriculaRegularTestApp> {
  const testingModule = await Test.createTestingModule({
    imports: [MatriculaRegularModule],
  })
    .overrideProvider(MATRICULA_REGULAR_CLOCK)
    .useValue(clock)
    .compile()

  const app = testingModule.createNestApplication({ logger: false })
  await app.init()
  const repository = app.get(MatriculaRegularRepository)
  let listening = false
  let closed = false

  return {
    app,
    clock,
    repository,
    async listen() {
      if (listening) return
      try {
        await app.listen(API_PORT, HOST)
        listening = true
      } catch (error) {
        await app.close()
        closed = true
        const code = error && typeof error === 'object' && 'code' in error
          ? error.code
          : undefined
        if (code === 'EADDRINUSE') {
          throw new Error(`El puerto sintético ${API_PORT} ya está ocupado`)
        }
        throw error
      }
    },
    reset() {
      const fixtures: SyntheticFixture[] = [
        createSyntheticFixture('SISTEMAS'),
        createSyntheticFixture('SOFTWARE'),
      ]
      return repository.resetForTests(fixtures)
    },
    async close() {
      if (closed) return
      closed = true
      await app.close()
    },
  }
}

export type MatriculaRegularTestShell = {
  child: ChildProcess
  close(): Promise<void>
}

export function startMatriculaRegularTestShell(): MatriculaRegularTestShell {
  const repositoryRoot = process.cwd().endsWith('/backend')
    ? resolve(process.cwd(), '..')
    : process.cwd()
  const clientRoot = resolve(repositoryRoot, 'client')
  const child = spawn('pnpm', ['exec', 'vite', '--config', 'vite.matricula-test.config.ts'], {
    cwd: clientRoot,
    detached: true,
    stdio: 'inherit',
    env: {
      PATH: process.env.PATH,
      VITE_SUM_DATA_MODE: 'local',
      VITE_SUM_API_BASE_URL: '/api',
    },
  })

  return {
    child,
    async close() {
      if (child.exitCode !== null || child.signalCode !== null) return
      const exited = new Promise<void>((resolveExit) => {
        child.once('exit', () => resolveExit())
        child.once('error', () => resolveExit())
      })
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, 'SIGTERM')
        } catch (error) {
          if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ESRCH') {
            throw error
          }
        }
      }
      await exited
    },
  }
}

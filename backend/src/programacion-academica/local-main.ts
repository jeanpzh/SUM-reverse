import { NestFactory } from '@nestjs/core'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { AcademicSchedulingModule } from './demo-module.js'

export function assertAcademicSchedulingStartup(env: NodeJS.ProcessEnv): void {
  if (env.SUM_ACADEMIC_SCHEDULING !== '1') throw new Error('SUM_ACADEMIC_SCHEDULING=1 es obligatorio')
  if (env.SIMULATOR_DEPLOYMENT === 'public') throw new Error('La programación académica demo no admite despliegue público')
  const snapshotVariable = Object.entries(env).find(([key, value]) => key.endsWith('_SNAPSHOT_DIR') && Boolean(value?.trim()))
  if (snapshotVariable) throw new Error(`La programación académica demo no admite fuentes snapshot (${snapshotVariable[0]})`)
}

export async function bootstrapAcademicScheduling(env: NodeJS.ProcessEnv = process.env) {
  assertAcademicSchedulingStartup(env)
  const port = env.PORT === undefined ? 3210 : Number(env.PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe ser un puerto TCP válido')
  const app = await NestFactory.create(AcademicSchedulingModule)
  app.enableShutdownHooks()
  await app.listen(port, '127.0.0.1')
  return app
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await bootstrapAcademicScheduling()
}

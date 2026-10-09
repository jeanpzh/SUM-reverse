import { accessSync, constants, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import {
  PlanEstudiosWireValidationError,
  validatePlanEstudiosWire,
  type PlanEstudiosWireEnvelope,
} from '../../../shared/plan-estudios-wire.mjs'
import type { PlanEstudiosSnapshotState } from '../plan-estudios/plan-estudios.types.js'

const snapshotBasename = 'plan-estudios.json'

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  return typeof error.code === 'string' ? error.code : undefined
}

export function loadPlanEstudiosSnapshot(directory: string | undefined): PlanEstudiosSnapshotState {
  if (directory === undefined) return { kind: 'disabled' }
  if (directory.length === 0 || !isAbsolute(directory)) {
    throw new Error('PLAN_ESTUDIOS_SNAPSHOT_DIR: se esperaba una ruta absoluta no vacía')
  }
  if (process.env.PLAN_ESTUDIOS_FIXTURE !== undefined) {
    throw new Error('PLAN_ESTUDIOS_SNAPSHOT_DIR: configuración incompatible con PLAN_ESTUDIOS_FIXTURE')
  }

  try {
    if (!statSync(directory).isDirectory()) throw new Error()
    accessSync(directory, constants.R_OK | constants.X_OK)
  } catch {
    throw new Error('PLAN_ESTUDIOS_SNAPSHOT_DIR: directorio inválido o inaccesible')
  }

  let source: string
  try {
    source = readFileSync(join(directory, snapshotBasename), 'utf8')
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return { kind: 'missing' }
    throw new Error(`PLAN_ESTUDIOS_SNAPSHOT_DIR (${snapshotBasename}): archivo ilegible`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(source) as unknown
  } catch {
    throw new Error(`PLAN_ESTUDIOS_SNAPSHOT_DIR (${snapshotBasename}): JSON inválido`)
  }

  try {
    validatePlanEstudiosWire(parsed)
  } catch (error) {
    const reason = error instanceof PlanEstudiosWireValidationError ? error.message : 'esquema inválido'
    throw new Error(`PLAN_ESTUDIOS_SNAPSHOT_DIR (${snapshotBasename}): ${reason}`)
  }

  return {
    kind: 'snapshot',
    envelope: structuredClone(parsed) as PlanEstudiosWireEnvelope,
  }
}

export function readPlanEstudiosSnapshot(state: PlanEstudiosSnapshotState): PlanEstudiosSnapshotState {
  if (state.kind !== 'snapshot') return state
  return { kind: 'snapshot', envelope: structuredClone(state.envelope) }
}

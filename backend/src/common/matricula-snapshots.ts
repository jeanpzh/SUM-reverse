import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import {
  validateMatriculaWire,
  type MatriculaWireKey,
  type WireJsonObject,
} from '../../../shared/matricula-wire.mjs'

const snapshotFiles: Record<MatriculaWireKey, string> = {
  matriculaInfo: 'matricula-info.json',
  programacion: 'programacion-asignaturas.json',
  prematricula: 'reporte-pre-matricula.json',
  matricula: 'reporte-matricula.json',
  horarios: 'reporte-horario.json',
}

const fixtureEnvKeys = [
  'REPORTES_FIXTURE',
  'PROGRAMACION_FIXTURE',
  'MATRICULA_INFORMACION_FIXTURE',
] as const

export type MatriculaSnapshots = Readonly<Record<MatriculaWireKey, WireJsonObject>>

export function loadMatriculaSnapshots(directory: string | undefined): MatriculaSnapshots | null {
  if (directory === undefined) return null
  if (directory.length === 0 || !isAbsolute(directory)) {
    throw new Error('MATRICULA_SNAPSHOT_DIR: se esperaba una ruta absoluta no vacía')
  }

  const conflicts = fixtureEnvKeys.filter((key) => process.env[key] !== undefined)
  if (conflicts.length > 0) {
    throw new Error(`MATRICULA_SNAPSHOT_DIR: configuración incompatible con ${conflicts.join(', ')}`)
  }

  const loaded = {} as Record<MatriculaWireKey, WireJsonObject>
  for (const key of Object.keys(snapshotFiles) as MatriculaWireKey[]) {
    const filename = snapshotFiles[key]
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(join(directory, filename), 'utf8'))
    } catch (error) {
      const reason = error instanceof SyntaxError ? 'JSON inválido' : 'archivo ausente o ilegible'
      throw new Error(`MATRICULA_SNAPSHOT_DIR ${key} (${filename}): ${reason}`)
    }

    try {
      validateMatriculaWire(key, parsed)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'esquema inválido'
      throw new Error(`MATRICULA_SNAPSHOT_DIR ${filename}: ${reason}`, { cause: error })
    }
    loaded[key] = parsed
  }

  return loaded
}

export function readMatriculaSnapshot(
  snapshots: MatriculaSnapshots | null,
  key: MatriculaWireKey,
): WireJsonObject | null {
  const value = snapshots?.[key]
  return value === undefined ? null : structuredClone(value)
}

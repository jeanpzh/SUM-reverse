import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import {
  miInformacionWireKeys,
  MiInformacionWireValidationError,
  validateMiInformacionWire,
  type MiInformacionRepresentation,
  type MiInformacionWireEnvelope,
  type MiInformacionWireKey,
} from '../../../shared/mi-informacion-wire.mjs'

const snapshotFiles: Record<MiInformacionWireKey, string> = {
  perfil: 'mi-perfil.json',
  historial: 'historial-academico.json',
  formularioDatos: 'formulario-datos-matricula.json',
  fichaSocioeconomica: 'ficha-socioeconomica.json',
}

const localKeysAllowed = ['historial', 'fichaSocioeconomica'] as const

export type MiInformacionSnapshotEntry = Readonly<{
  envelope: MiInformacionWireEnvelope
  representation: MiInformacionRepresentation
}>
export type MiInformacionSnapshots = Readonly<Partial<Record<MiInformacionWireKey, MiInformacionSnapshotEntry>>>

function parseLocalKeys(value: string | undefined, directory: string | undefined): ReadonlySet<MiInformacionWireKey> {
  if (value === undefined) return new Set()
  if (directory === undefined) {
    throw new Error('MI_INFORMACION_SNAPSHOT_LOCAL_KEYS: requiere MI_INFORMACION_SNAPSHOT_DIR')
  }

  const entries = value.split(',')
  const known = new Set<string>(localKeysAllowed)
  if (
    value.length === 0 ||
    entries.some((entry) => !known.has(entry)) ||
    new Set(entries).size !== entries.length
  ) {
    throw new Error('MI_INFORMACION_SNAPSHOT_LOCAL_KEYS: se esperaba una allowlist CSV válida')
  }
  return new Set(entries as MiInformacionWireKey[])
}

function readSnapshotFile(directory: string, key: MiInformacionWireKey, required: boolean): unknown {
  const basename = snapshotFiles[key]
  let source: string
  try {
    source = readFileSync(join(directory, basename), 'utf8')
  } catch (error) {
    if (!required && error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
    throw new Error(`MI_INFORMACION_SNAPSHOT_DIR ${key} (${basename}): archivo ausente o ilegible`)
  }

  try {
    return JSON.parse(source) as unknown
  } catch {
    throw new Error(`MI_INFORMACION_SNAPSHOT_DIR ${key} (${basename}): JSON inválido`)
  }
}

export function loadMiInformacionSnapshots(
  directory: string | undefined,
  localKeys: string | undefined,
): MiInformacionSnapshots | null {
  const explicitLocalKeys = parseLocalKeys(localKeys, directory)
  if (directory === undefined) return null
  if (directory.length === 0 || !isAbsolute(directory)) {
    throw new Error('MI_INFORMACION_SNAPSHOT_DIR: se esperaba una ruta absoluta no vacía')
  }

  const fixtureConflicts = ['MI_INFORMACION_FIXTURE', 'REPORTES_FIXTURE']
    .filter((name) => process.env[name] !== undefined)
  if (fixtureConflicts.length > 0) {
    throw new Error(`MI_INFORMACION_SNAPSHOT_DIR: configuración incompatible con ${fixtureConflicts.join(', ')}`)
  }

  const loaded: Partial<Record<MiInformacionWireKey, MiInformacionSnapshotEntry>> = {}
  for (const key of miInformacionWireKeys) {
    const isRequired = key === 'formularioDatos'
    const parsed = readSnapshotFile(directory, key, isRequired)
    if (parsed === undefined && !isRequired) continue

    const representation: MiInformacionRepresentation = key === 'perfil' || key === 'formularioDatos'
      || (key === 'historial' && !explicitLocalKeys.has(key))
      ? 'candidate-v1'
      : explicitLocalKeys.has(key) ? 'local-v1' : 'opaque'
    const basename = snapshotFiles[key]
    try {
      validateMiInformacionWire(key, parsed, representation)
    } catch (error) {
      const reason = error instanceof MiInformacionWireValidationError ? error.message : 'esquema inválido'
      throw new Error(`MI_INFORMACION_SNAPSHOT_DIR ${basename}: ${reason}`)
    }

    loaded[key] = {
      envelope: structuredClone(parsed) as MiInformacionWireEnvelope,
      representation,
    }
  }

  return loaded
}

export function readMiInformacionSnapshot(
  snapshots: MiInformacionSnapshots | null,
  key: MiInformacionWireKey,
): MiInformacionSnapshotEntry | null {
  const snapshot = snapshots?.[key]
  return snapshot === undefined ? null : structuredClone(snapshot)
}

export function miInformacionSnapshotBasename(key: MiInformacionWireKey): string {
  return snapshotFiles[key]
}

import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(ROOT, 'datos-sinteticos/plan-estudios.json')
const SYNTHETIC_DIR = resolve(ROOT, 'datos-sinteticos')
const BUILDER = resolve(ROOT, 'backend/dist/matricula-regular/enrollment-scenarios.js')

export async function assertRegularPath(path, label) {
  const stat = await lstat(path)
  if (stat.isSymbolicLink() || !stat.isDirectory() && !stat.isFile()) throw new Error(`${label}: symlink o tipo no permitido`)
}

export async function buildEnrollmentScenarioBundlesFromBytes(bytes) {
  let parsed
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new Error('datos-sinteticos/plan-estudios.json: JSON inválido')
  }
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.data)) {
    throw new Error('datos-sinteticos/plan-estudios.json:data debe ser un array')
  }
  const wanted = new Set(['20118041', '20118051', '20118066', '20118084'])
  const selected = []
  for (const row of parsed.data) {
    if (typeof row !== 'object' || row === null || !wanted.has(String(row.codAsignatura))) continue
    selected.push(Object.fromEntries(['codAsignatura', 'desAsignatura', 'creditos', 'ciclo', 'tipoAsignatura'].map((key) => [key, row[key]])))
  }
  const { buildEnrollmentScenarioBundles } = await import(new URL(`file://${BUILDER}`))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  return buildEnrollmentScenarioBundles(selected, sha256)
}

export async function loadEnrollmentScenarioBundles() {
  await assertRegularPath(SYNTHETIC_DIR, 'datos-sinteticos')
  await assertRegularPath(SOURCE, 'datos-sinteticos/plan-estudios.json')
  return buildEnrollmentScenarioBundlesFromBytes(await readFile(SOURCE))
}

export function validateEnrollmentScenarioId(value, ids) {
  if (typeof value !== 'string' || !ids.includes(value)) throw new TypeError(`Escenario inválido: ${String(value)}`)
  return value
}

import { randomBytes, randomUUID } from 'node:crypto'
import { chmod, chown, lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises'

const legacyPath = '/legacy/.env'
const runtimePath = '/runtime'
const secretPattern = /^[A-Za-z0-9_-]{32,128}$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const allowed = new Set([
  'SIMULATOR_CAMPAIGN_ID',
  'SIMULATOR_RUN_ID',
  'SIMULATOR_DB_PASSWORD',
  'SIMULATOR_METRICS_TOKEN',
  'GRAFANA_ADMIN_PASSWORD',
  'SIMULATOR_CONTENTION',
  'SIMULATOR_ACTOR_COUNT',
  'SIMULATOR_SCENARIO_PROFILE',
  'SIMULATOR_UID',
  'SIMULATOR_GID'
])
// Only meaningful with SIMULATOR_SCENARIO_PROFILE=fisi-schools; any other profile drops them (a stale value would fail the next seed).
const fisiKeys = ['SIMULATOR_FISI_FRANJA', 'SIMULATOR_FISI_IA_ACTORS', 'SIMULATOR_FISI_CAPACITY', 'SIMULATOR_FISI_SCARCE_RATIO']
for (const key of fisiKeys) allowed.add(key)

function parseLegacy(contents) {
  const values = new Map()
  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const match = /^([A-Z][A-Z0-9_]*)=([A-Za-z0-9_.-]*)$/.exec(line)
    if (match && match[2].includes('.') && match[1] !== 'SIMULATOR_FISI_SCARCE_RATIO') throw new Error(`Invalid legacy simulator environment entry at line ${index + 1}`)
    if (!match || !allowed.has(match[1]) || values.has(match[1])) {
      throw new Error(`Invalid legacy simulator environment entry at line ${index + 1}`)
    }
    values.set(match[1], match[2])
  }
  return values
}

async function readOptionalPrivateEnv(path, label) {
  try {
    const info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) {
      throw new Error(`${label} must be a regular file with mode 0600 or stricter`)
    }
    return parseLegacy(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return new Map()
    throw error
  }
}

const legacy = await readOptionalPrivateEnv(legacyPath, 'Legacy .env')
for (const key of ['SIMULATOR_UID', 'SIMULATOR_GID']) {
  const id = legacy.get(key)
  if (id !== undefined && !/^[0-9]{1,6}$/.test(id)) throw new Error(`Legacy ${key} must be numeric`)
}
await mkdir(runtimePath, { recursive: true, mode: 0o700 })
const runtimeInfo = await lstat(runtimePath)
if (!runtimeInfo.isDirectory() || runtimeInfo.isSymbolicLink()) {
  throw new Error('Runtime path must be a real directory')
}
const previous = await readOptionalPrivateEnv(`${runtimePath}/config.env`, 'Runtime config')
const value = (key, fallback) => legacy.get(key) || previous.get(key) || fallback
const config = {
  SIMULATOR_CAMPAIGN_ID: value('SIMULATOR_CAMPAIGN_ID', randomUUID()),
  SIMULATOR_RUN_ID: value('SIMULATOR_RUN_ID', randomUUID()),
  SIMULATOR_DB_PASSWORD: value('SIMULATOR_DB_PASSWORD', randomBytes(32).toString('hex')),
  SIMULATOR_METRICS_TOKEN: value('SIMULATOR_METRICS_TOKEN', randomBytes(32).toString('hex')),
  GRAFANA_ADMIN_PASSWORD: value('GRAFANA_ADMIN_PASSWORD', randomBytes(32).toString('hex')),
  SIMULATOR_CONTENTION: value('SIMULATOR_CONTENTION', 'shared'),
  SIMULATOR_ACTOR_COUNT: value('SIMULATOR_ACTOR_COUNT', '100'),
  SIMULATOR_SCENARIO_PROFILE: value('SIMULATOR_SCENARIO_PROFILE', value('SIMULATOR_CONTENTION', 'shared'))
}

if (!uuidPattern.test(config.SIMULATOR_CAMPAIGN_ID) || !uuidPattern.test(config.SIMULATOR_RUN_ID)) {
  throw new Error('Legacy campaign and run IDs must be UUIDv4 values')
}
for (const key of ['SIMULATOR_DB_PASSWORD', 'SIMULATOR_METRICS_TOKEN', 'GRAFANA_ADMIN_PASSWORD']) {
  if (!secretPattern.test(config[key])) throw new Error(`Legacy ${key} is invalid`)
}
if (!['shared', 'distributed'].includes(config.SIMULATOR_CONTENTION)) {
  throw new Error('Legacy SIMULATOR_CONTENTION must be shared or distributed')
}
if (!/^[1-9][0-9]{0,3}$/.test(config.SIMULATOR_ACTOR_COUNT) || Number(config.SIMULATOR_ACTOR_COUNT) > 2000) {
  throw new Error('SIMULATOR_ACTOR_COUNT must be an integer from 1 to 2000')
}
if (!['shared', 'ample', 'last-seat', 'multi-uniform', 'multi-hotspot', 'fisi-schools', 'distributed'].includes(config.SIMULATOR_SCENARIO_PROFILE)) {
  throw new Error('SIMULATOR_SCENARIO_PROFILE is invalid')
}

if (config.SIMULATOR_SCENARIO_PROFILE === 'fisi-schools') {
  for (const key of fisiKeys) {
    const item = legacy.get(key) || previous.get(key)
    if (item !== undefined) config[key] = item
  }
  // Same rules as the backend parser (parseFisiConfig).
  const { SIMULATOR_FISI_FRANJA: franja = '4', SIMULATOR_FISI_IA_ACTORS: ia = '0', SIMULATOR_FISI_CAPACITY: capacity = 'ample', SIMULATOR_FISI_SCARCE_RATIO: ratio } = config
  if (franja !== 'jornada' && !/^[1-9]$/.test(franja)) throw new Error('SIMULATOR_FISI_FRANJA must be an integer from 1 to 9 or jornada')
  if (!/^[0-9]{1,4}$/.test(ia) || Number(ia) > Number(config.SIMULATOR_ACTOR_COUNT)) throw new Error('SIMULATOR_FISI_IA_ACTORS must be an integer from 0 to SIMULATOR_ACTOR_COUNT')
  if (!['ample', 'scarce'].includes(capacity)) throw new Error('SIMULATOR_FISI_CAPACITY must be ample or scarce')
  if (ratio !== undefined && (capacity !== 'scarce' || !/^0?\.[0-9]{1,6}$/.test(ratio) || !/[1-9]/.test(ratio))) {
    throw new Error('SIMULATOR_FISI_SCARCE_RATIO requires scarce capacity and a decimal greater than 0 and lower than 1')
  }
}

await chmod(runtimePath, 0o700)
await chown(runtimePath, 1000, 1000)
for (const name of ['results']) {
  const path = `${runtimePath}/${name}`
  await mkdir(path, { recursive: true, mode: 0o700 })
  const info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Runtime ${name} path must be a real directory`)
  await chmod(path, 0o700)
  await chown(path, 1000, 1000)
}

const contents = `${Object.entries(config).map(([key, item]) => `${key}=${item}`).join('\n')}\n`
const temporary = `${runtimePath}/config.env.tmp`
await writeFile(temporary, contents, { mode: 0o600, flag: 'wx' })
await chown(temporary, 1000, 1000)
await chmod(temporary, 0o600)
await rename(temporary, `${runtimePath}/config.env`)
console.log('Simulator runtime initialized; secrets are stored in the private runtime directory.')

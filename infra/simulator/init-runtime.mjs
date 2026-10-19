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
  'SIMULATOR_UID',
  'SIMULATOR_GID'
])

function parseLegacy(contents) {
  const values = new Map()
  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const match = /^([A-Z][A-Z0-9_]*)=([A-Za-z0-9_-]*)$/.exec(line)
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
  SIMULATOR_CONTENTION: value('SIMULATOR_CONTENTION', 'shared')
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

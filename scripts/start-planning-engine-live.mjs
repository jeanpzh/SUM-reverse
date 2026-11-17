// Interactive runtime only. Synthetic CI runners deliberately keep their own disabled LLM configuration.
import { readFile, realpath } from 'node:fs/promises'
import { resolve, dirname, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const allowed = ['AWS_REGION', 'AWS_BEARER_TOKEN_BEDROCK', 'AWS_BEARER_TOKEN_BEDROCK_FILE', 'SUM_LLM_MODEL', 'SUM_BEDROCK_MODEL', 'SUM_LLM_TIMEOUT_MS']
async function permittedPath(path) {
  if (resolve(path).split(sep).includes('datos-reales')) throw new Error('Private directory denied')
  let canonical
  try { canonical = await realpath(path) } catch { throw new Error('Explicit configuration or credential file is unavailable') }
  if (canonical.split(sep).includes('datos-reales')) throw new Error('Private directory denied')
  return canonical
}

export async function liveEngineEnvironment(envFile, environment = process.env) {
  if (!envFile) throw new Error('SUM_PLANNING_ENV_FILE is required')
  const source = await permittedPath(envFile)
  const configuration = parseEnv(await readFile(source, 'utf8'))
  const runtime = { PATH: environment.PATH, LANG: 'C.UTF-8', HOME: environment.HOME }
  for (const key of allowed) if (configuration[key]) runtime[key] = configuration[key]
  if (!runtime.AWS_BEARER_TOKEN_BEDROCK && !runtime.AWS_BEARER_TOKEN_BEDROCK_FILE) throw new Error('Explicit Bedrock credentials are required')
  if (runtime.AWS_BEARER_TOKEN_BEDROCK_FILE) runtime.AWS_BEARER_TOKEN_BEDROCK_FILE = await permittedPath(resolve(dirname(source), runtime.AWS_BEARER_TOKEN_BEDROCK_FILE))
  const port = Number(environment.PORT || 3637)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid engine port')
  return { ...runtime, PORT: String(port), SUM_LLM_PROVIDER: 'bedrock_converse',
    AWS_EC2_METADATA_DISABLED: 'true', AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true',
    AWS_CONFIG_FILE: '/dev/null', AWS_SHARED_CREDENTIALS_FILE: '/dev/null',
    HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const env = await liveEngineEnvironment(process.env.SUM_PLANNING_ENV_FILE)
    const child = spawn(resolve(root, 'planning-engine/.venv/bin/python'), ['main.py'], {
      cwd: resolve(root, 'planning-engine'), env, stdio: 'inherit',
    })
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal))
    child.once('error', () => { console.error('Live engine could not start'); process.exitCode = 1 })
    child.once('exit', code => { process.exitCode = code ?? 1 })
  } catch {
    console.error('Live engine configuration failed; verify explicit config and credential file (values withheld)')
    process.exitCode = 1
  }
}

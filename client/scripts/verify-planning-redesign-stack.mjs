// Own every process and a fresh synthetic draft directory; never attach to operator servers.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const ports = {
  api: Number(process.env.SUM_REDESIGN_API_PORT || 3436),
  engine: Number(process.env.SUM_REDESIGN_ENGINE_PORT || 3437),
  web: Number(process.env.SUM_REDESIGN_WEB_PORT || 5436),
}
if (new Set(Object.values(ports)).size !== 3 || Object.values(ports).some(port => !Number.isInteger(port) || port < 1024 || port > 65535)) throw new Error('Three distinct valid unprivileged ports required')
const testScript = process.env.SUM_REDESIGN_TEST_SCRIPT || process.argv[2] || 'verify-planning-redesign.mjs'
if (!['verify-planning-redesign.mjs', 'verify-planning-normative.mjs', 'verify-planning-assistant.mjs'].includes(testScript)) throw new Error('Unknown synthetic acceptance script')
const evidence = resolve(process.env.SUM_REDESIGN_EVIDENCE || resolve(root, 'evidence/local/planning-redesign-2026-11-09'))
for (const port of Object.values(ports)) await new Promise((accept, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(port, '127.0.0.1', () => server.close(accept))
})
const draftDir = await mkdtemp(join(tmpdir(), 'sum-redesign-synthetic-'))
const env = { PATH: process.env.PATH, LANG: 'C.UTF-8' }
const children = []
const start = (command, args, folder, variables) => {
  const child = spawn(command, args, { cwd: resolve(root, folder), env: { ...env, ...variables }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.output = ''
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { child.output = (child.output + chunk.toString()).slice(-2500) })
  child.on('error', (error) => { child.launchError = error })
  children.push(child)
  return child
}
const ready = async (url, child) => {
  const deadline = Date.now() + 45000
  while (Date.now() < deadline) {
    if (child.launchError) throw child.launchError
    if (child.exitCode !== null) throw new Error(`Synthetic service exited ${child.exitCode}: ${child.output}`)
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return } catch { /* startup */ }
    await new Promise((accept) => setTimeout(accept, 200))
  }
  throw new Error(`Synthetic service startup timeout: ${url}: ${child.output}`)
}
try {
  const engine = start(resolve(root, 'planning-engine/.venv/bin/python'), ['main.py'], 'planning-engine', {
    PORT: String(ports.engine), SUM_LLM_PROVIDER: 'disabled', SUM_RAG_GENERATION_MODE: 'extractive',
    AWS_EC2_METADATA_DISABLED: 'true', HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1',
  })
  await ready(`http://127.0.0.1:${ports.engine}/health`, engine)
  const backend = start(process.execPath, ['dist/programacion-academica/local-main.js'], 'backend', {
    PORT: String(ports.api), SUM_ACADEMIC_SCHEDULING: '1', SIMULATOR_DEPLOYMENT: 'local', SUM_LOCAL_SCENARIOS: '0',
    SUM_ACADEMIC_DRAFT_DIR: draftDir, SUM_PLANNING_ENGINE_URL: `http://127.0.0.1:${ports.engine}`,
  })
  await ready(`http://127.0.0.1:${ports.api}/local/programacion-academica/v1/catalogo`, backend)
  const frontend = start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(ports.web), '--strictPort'], 'client', {
    VITE_SUM_DATA_MODE: 'local', VITE_SUM_API_BASE_URL: '/api', VITE_SUM_API_PROXY_TARGET: `http://127.0.0.1:${ports.api}`,
    VITE_SUM_PLANNING_API_PROXY_TARGET: `http://127.0.0.1:${ports.api}`, VITE_SUM_ACADEMIC_SCHEDULING: '1',
    VITE_SUM_SIMULATOR: '0', VITE_SUM_LOCAL_PROFILE: 'synthetic-actors',
  })
  await ready(`http://127.0.0.1:${ports.web}/local/programacion-academica`, frontend)
  console.log(`Own synthetic stack ready; fresh draft store ${draftDir}; LLM disabled`)
  const tester = spawn(process.execPath, [`scripts/${testScript}`], { cwd: resolve(root, 'client'), env: {
    ...env, SUM_REDESIGN_SYNTHETIC: '1', SUM_REDESIGN_BASE: `http://127.0.0.1:${ports.web}`,
    SUM_REDESIGN_EVIDENCE: evidence, SUM_ASSISTANT_CASES: process.env.SUM_ASSISTANT_CASES || '',
  }, stdio: 'inherit' })
  children.push(tester)
  process.exitCode = await new Promise((accept, reject) => { tester.once('error', reject); tester.once('exit', (code) => accept(code ?? 1)) })
} finally {
  if (process.exitCode) for (const child of children.slice(0,3)) console.error(JSON.stringify({serviceExit:child.exitCode,signal:child.signalCode,output:child.output}))
  for (const child of children.reverse()) if (child.exitCode === null) child.kill('SIGTERM')
  await Promise.all(children.filter((child) => child.exitCode === null && child.signalCode === null).map((child) => new Promise((accept) => child.once('exit', accept))))
  console.log(`Own synthetic stack stopped: ${JSON.stringify(children.map(child => ({ pid: child.pid, code: child.exitCode, signal: child.signalCode })))}`)
}

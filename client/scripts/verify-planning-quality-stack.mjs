// Opt-in paid evaluation only. Public reviewed corpus + independent synthetic fixtures.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { qualityProviderConfig } from './planning-quality/operator-config.mjs'
const root = fileURLToPath(new URL('../../', import.meta.url))
const provider = await qualityProviderConfig(root)
const runtime = await mkdtemp(join(tmpdir(), 'planning-quality-'))
const evidence = resolve(process.env.SUM_QUALITY_EVIDENCE || join(root, 'evidence/local/planning-answer-quality-2026-11-10/bedrock'))
await mkdir(evidence, { recursive: true })
const container = `sum-quality-${process.pid}`
const children = []
let containerStarted = false
const basic = { PATH: process.env.PATH, LANG: 'C.UTF-8', HOME: runtime }
const live = { ...basic, ...provider, AWS_CONFIG_FILE: join(runtime, 'absent-config'), AWS_SHARED_CREDENTIALS_FILE: join(runtime, 'absent-credentials') }
for (const port of [3846, 3847, 5846, 55433]) await new Promise((accept, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(port, '127.0.0.1', () => server.close(accept))
})
function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.output = ''
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { child.output = (child.output + data.toString()).slice(-2000) })
  children.push(child)
  return child
}
const completed = child => new Promise((accept, reject) => { child.once('error', reject); child.once('exit', code => accept(code)) })
async function run(command, args, cwd, env) {
  const child = start(command, args, cwd, env)
  const code = await completed(child)
  if (code !== 0) throw new Error(`Quality setup step failed: ${command.split('/').at(-1)} (output withheld to protect runtime configuration)`)
  return child.output
}
async function ready(url) {
  const deadline = Date.now() + 45000
  while (Date.now() < deadline) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return } catch { /* startup */ }
    await new Promise(accept => setTimeout(accept, 200))
  }
  throw new Error('Own synthetic quality service startup timeout')
}
try {
  const python = resolve(root, 'planning-engine/.venv/bin/python')
  const preflight = await run(python, ['-m', 'scripts.quality_preflight'], resolve(root, 'planning-engine'), live)
  console.log(preflight.trim()) // The helper prints a fixed sanitized schema only.
  await writeFile(join(evidence, 'provider-preflight.json'), preflight)
  await run('docker', ['run', '--rm', '-d', '--name', container, '--publish', '127.0.0.1:55433:5432',
    '--tmpfs', '/var/lib/postgresql/data', '--env', 'POSTGRES_USER=quality', '--env', 'POSTGRES_PASSWORD=synthetic-quality-only',
    '--env', 'POSTGRES_DB=quality', 'pgvector/pgvector:pg16'], root, basic)
  containerStarted = true
  const deadline = Date.now() + 30000
  let dbReady = false
  while (Date.now() < deadline) {
    const child = start('docker', ['exec', container, 'pg_isready', '-U', 'quality', '-d', 'quality'], root, basic)
    if (await completed(child) === 0) { dbReady = true; break }
    await new Promise(accept => setTimeout(accept, 200))
  }
  if (!dbReady) throw new Error('Own quality pgvector startup timeout')
  const env = { ...live, SUM_RAG_SOURCE: 'local', SUM_RAG_DATABASE_URL: 'postgresql+psycopg://quality:synthetic-quality-only@127.0.0.1:55433/quality', SUM_RAG_COLLECTION: 'quality' }
  const ingestion = await run(python, ['rag_ingest.py'], resolve(root, 'planning-engine'), env)
  await writeFile(join(evidence, 'ingestion.json'), ingestion) // Ingestion CLI only returns identity/count; no credentials.
  start(python, ['main.py'], resolve(root, 'planning-engine'), { ...env, PORT: '3847' })
  await ready('http://127.0.0.1:3847/health')
  start(process.execPath, ['dist/programacion-academica/local-main.js'], resolve(root, 'backend'), {
    ...basic, PORT: '3846', SUM_ACADEMIC_SCHEDULING: '1', SIMULATOR_DEPLOYMENT: 'local', SUM_LOCAL_SCENARIOS: '0',
    SUM_ACADEMIC_DRAFT_DIR: join(runtime, 'drafts'), SUM_PLANNING_ENGINE_URL: 'http://127.0.0.1:3847',
  })
  await ready('http://127.0.0.1:3846/local/programacion-academica/v1/catalogo')
  start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5846', '--strictPort'], resolve(root, 'client'), {
    ...basic, VITE_SUM_DATA_MODE: 'local', VITE_SUM_API_BASE_URL: '/api', VITE_SUM_API_PROXY_TARGET: 'http://127.0.0.1:3846',
    VITE_SUM_PLANNING_API_PROXY_TARGET: 'http://127.0.0.1:3846', VITE_SUM_ACADEMIC_SCHEDULING: '1', VITE_SUM_SIMULATOR: '0', VITE_SUM_LOCAL_PROFILE: 'synthetic-actors',
  })
  await ready('http://127.0.0.1:5846/local/programacion-academica')
  console.log('Own synthetic quality stack ready; real Bedrock + explicit public corpus index')
  const tester = spawn(process.execPath, ['scripts/verify-planning-answer-quality.mjs'], { cwd: resolve(root, 'client'), env: {
    ...basic, PLAYWRIGHT_BROWSERS_PATH: resolve(process.env.HOME, '.cache/ms-playwright'), SUM_REDESIGN_SYNTHETIC: '1', SUM_REDESIGN_BASE: 'http://127.0.0.1:5846', SUM_REDESIGN_EVIDENCE: evidence,
  }, stdio: 'inherit' })
  children.push(tester)
  process.exitCode = await completed(tester)
} finally {
  for (const child of children.reverse()) if (child.exitCode === null && !child.signalCode) child.kill('SIGTERM')
  await Promise.all(children.filter(child => child.exitCode === null && !child.signalCode).map(completed))
  if (containerStarted) await run('docker', ['stop', container], root, basic)
  console.log('Own live-quality services stopped; no provider exception bodies or credentials recorded')
}

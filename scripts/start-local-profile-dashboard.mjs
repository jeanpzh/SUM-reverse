#!/usr/bin/env node
// Developer entry for the synthetic local profile dashboard (LPD-CONTRACT-1, LPD-DEC-1 D6).
//
//   node scripts/start-local-profile-dashboard.mjs [--backend-port=N] [--frontend-port=N] [--skip-build]
//
// Starts exactly two things, both owned by this process:
//   1. the isolated backend (backend/test/local-profile-dashboard-test-app.ts: only
//      LocalProfileDashboardModule + its MatriculaRegularModule import, synthetic fixtures,
//      advancing 2026-08-11T14:00Z clock) listening on 127.0.0.1, run in-process through the
//      compiled backend/dist and Node's native type stripping (no TypeScript runtime package);
//   2. Vite with client/vite.local-profile-test.config.ts (synthetic activation, proxy limited to
//      /api/local/perfiles/v1 and /api/local/matricula-regular/v1) as a child process.
// Ports default to dynamic. An explicit port that is occupied aborts: no unknown server is
// inspected, attached to or stopped. The operator AppModule/server and snapshots are never used.
// `pnpm --dir backend build` runs first (it replaces backend/dist) unless --skip-build is given.
// Ctrl-C / SIGTERM stop only the processes and app started here. Supported: Linux, macOS, WSL.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HOST = '127.0.0.1'
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FACTORY_PATH = resolve(REPO_ROOT, 'backend/test/local-profile-dashboard-test-app.ts')
const CLIENT_ROOT = resolve(REPO_ROOT, 'client')
const VITE_CONFIG = 'vite.local-profile-test.config.ts'
const READY_MARKER = 'SUM_LOCAL_PROFILE_FRONTEND_READY'
const READY_TIMEOUT_MS = 60000
const STOP_TIMEOUT_MS = 5000
// Nonsecret execution essentials only. process.env is never spread into a child.
const ENV_ALLOWLIST = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TERM', 'TMPDIR', 'PNPM_HOME',
  'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME']

class UsageError extends Error {}

function childEnv(extra = {}) {
  const env = {}
  for (const name of ENV_ALLOWLIST) {
    if (process.env[name] !== undefined) env[name] = process.env[name]
  }
  return { ...env, ...extra }
}

function parseArguments(argv) {
  const options = { backendPort: undefined, frontendPort: undefined, skipBuild: false }
  for (let index = 0; index < argv.length; index += 1) {
    const [name, inline] = argv[index].split(/=(.*)/s)
    if (name === '--skip-build' && inline === undefined) {
      options.skipBuild = true
    } else if (name === '--backend-port' || name === '--frontend-port') {
      const raw = inline ?? argv[(index += 1)]
      if (typeof raw !== 'string' || !/^[1-9]\d{0,4}$/.test(raw) || Number(raw) > 65535) {
        throw new UsageError(`${name} requiere un entero entre 1 y 65535`)
      }
      options[name === '--backend-port' ? 'backendPort' : 'frontendPort'] = Number(raw)
    } else {
      throw new UsageError(`Argumento no soportado: ${argv[index]}`)
    }
  }
  if (options.backendPort !== undefined && options.backendPort === options.frontendPort) {
    throw new UsageError('Los puertos de backend y frontend deben ser distintos')
  }
  return options
}

function listenProbe(port) {
  return new Promise((resolveProbe, rejectProbe) => {
    const probe = createServer()
    probe.once('error', rejectProbe)
    probe.listen(port, HOST, () => {
      const address = probe.address()
      probe.close(() => resolveProbe(address.port))
    })
  })
}

async function assertPortFree(port, label) {
  try {
    await listenProbe(port)
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      throw new UsageError(`El puerto ${label} ${port} ya está ocupado; se aborta sin adjuntarse a servidores existentes`)
    }
    throw error
  }
}

function signalGroup(child, signal) {
  if (child.pid === undefined) return
  try {
    process.kill(-child.pid, signal)
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
  }
}

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolveStop) => {
    const forced = setTimeout(() => signalGroup(child, 'SIGKILL'), STOP_TIMEOUT_MS)
    child.once('exit', () => {
      clearTimeout(forced)
      resolveStop()
    })
    signalGroup(child, 'SIGTERM')
  })
}

function spawnOwned(command, args, options) {
  const child = spawn(command, args, { ...options, detached: true })
  owned.add(child)
  child.once('exit', () => owned.delete(child))
  return child
}

function runBuild() {
  return new Promise((resolveBuild, rejectBuild) => {
    const build = spawnOwned('pnpm', ['--dir', 'backend', 'build'], {
      cwd: REPO_ROOT,
      env: childEnv(),
      stdio: 'inherit',
    })
    build.once('error', rejectBuild)
    build.once('exit', (code, signal) => {
      if (code === 0) resolveBuild()
      else rejectBuild(new Error(`pnpm --dir backend build terminó con ${signal ?? `código ${code}`}`))
    })
  })
}

async function loadFactory() {
  try {
    return await import(pathToFileURL(FACTORY_PATH).href)
  } catch (error) {
    if (error?.code === 'ERR_UNKNOWN_FILE_EXTENSION') {
      throw new UsageError(`Node ${process.version} no ejecuta TypeScript nativo; usa Node >= 22.18 (o --experimental-strip-types)`)
    }
    throw error
  }
}

function pipeLines(stream, onLine) {
  let pending = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    pending += chunk
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) onLine(line)
  })
}

function startVite(backendOrigin, frontendPort) {
  const requireFromClient = createRequire(resolve(CLIENT_ROOT, 'package.json'))
  const vitePackage = requireFromClient.resolve('vite/package.json')
  const viteBin = resolve(dirname(vitePackage), JSON.parse(readFileSync(vitePackage, 'utf8')).bin.vite)
  const child = spawnOwned(process.execPath, [viteBin, '--config', VITE_CONFIG, '--clearScreen', 'false'], {
    cwd: CLIENT_ROOT,
    env: childEnv({
      SUM_LOCAL_PROFILE_BACKEND_ORIGIN: backendOrigin,
      SUM_LOCAL_PROFILE_FRONTEND_PORT: String(frontendPort),
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const ready = new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error('Vite no estuvo listo a tiempo')), READY_TIMEOUT_MS)
    const finish = (settle, value) => {
      clearTimeout(timer)
      settle(value)
    }
    pipeLines(child.stdout, (line) => {
      if (line.startsWith(`${READY_MARKER} `)) finish(resolveReady, line.slice(READY_MARKER.length + 1).trim())
      else console.log(`[vite] ${line}`)
    })
    pipeLines(child.stderr, (line) => console.error(`[vite] ${line}`))
    child.once('error', (error) => finish(rejectReady, error))
    child.once('exit', (code, signal) => {
      finish(rejectReady, new Error(`Vite terminó antes de estar listo (${signal ?? `código ${code}`})`))
    })
  })
  return { child, ready }
}

const owned = new Set()
let backend
let shuttingDown

function ensureRunning() {
  if (shuttingDown !== undefined) throw new Error('Arranque interrumpido por una señal de parada')
}

function shutdown(exitCode) {
  shuttingDown ??= (async () => {
    await Promise.all([...owned].map(stopChild))
    await backend?.close()
    process.exitCode = exitCode
  })()
  return shuttingDown
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.backendPort !== undefined) await assertPortFree(options.backendPort, 'de backend')
  if (options.frontendPort !== undefined) await assertPortFree(options.frontendPort, 'de frontend')
  if (!options.skipBuild) await runBuild()
  ensureRunning()

  const { createLocalProfileDashboardTestApp } = await loadFactory()
  backend = await createLocalProfileDashboardTestApp()
  ensureRunning()
  const backendOrigin = await backend.listen(options.backendPort ?? 0)
  const frontendPort = options.frontendPort ?? await listenProbe(0)
  ensureRunning()
  const vite = startVite(backendOrigin, frontendPort)
  const frontendOrigin = await vite.ready
  if (frontendOrigin !== `http://${HOST}:${frontendPort}`) {
    throw new Error(`Vite escucha en ${frontendOrigin}, distinto del puerto solicitado ${frontendPort}`)
  }
  vite.child.once('exit', (code, signal) => {
    if (shuttingDown !== undefined) return
    console.error(`Vite terminó inesperadamente (${signal ?? `código ${code}`}); se detiene el backend`)
    void shutdown(1)
  })

  console.log('\nDashboard de perfiles sintéticos (solo datos sintéticos, solo loopback)')
  console.log(`  Backend aislado : ${backendOrigin}`)
  console.log(`  Frontend (Vite) : ${frontendOrigin}`)
  console.log('  Reloj sintético : avanza desde 2026-08-11T14:00Z; reiniciar crea una corrida nueva')
  console.log('  Ctrl-C detiene solo los procesos iniciados por este script')
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => void shutdown(0))
}

try {
  await main()
} catch (error) {
  if (shuttingDown === undefined) console.error(error instanceof UsageError ? error.message : error)
  await shutdown(error instanceof UsageError ? 2 : 1)
  await backend?.close()
}

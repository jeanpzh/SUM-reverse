#!/usr/bin/env node
// Compatibility entrypoint. The application and scenario chooser now live in Docker Compose.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

if (process.argv.length > 2) {
  console.error('Usa docker compose -f compose.local.yaml up --build. Elige escenarios en la página con MODE = SIM desde la consola del navegador.')
  process.exitCode = 2
} else {
  const child = spawn('docker', ['compose', '-f', 'compose.local.yaml', 'up', '--build'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    stdio: 'inherit',
  })
  child.once('error', (error) => {
    console.error(`No se pudo iniciar Docker Compose: ${error.message}`)
    process.exitCode = 1
  })
  child.once('exit', (code) => { process.exitCode = code ?? 1 })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
}

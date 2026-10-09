import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const child = spawn(process.execPath, [vite, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, VITE_SUM_DATA_MODE: 'local', VITE_SUM_API_BASE_URL: '/api' },
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
child.on('error', (error) => {
  console.error(`No se pudo iniciar Vite: ${error.message}`)
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})

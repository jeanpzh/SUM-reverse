import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, type Plugin } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

// Dedicated synthetic activation of the local profile dashboard (LPD-DEC-1 D6).
//
// Startup input (explicit environment values, validated here; nothing is read from dotenv files):
//   SUM_LOCAL_PROFILE_BACKEND_ORIGIN  required, exactly `http://127.0.0.1:<port>` (the origin
//                                     returned by the isolated backend factory `listen()`).
//   SUM_LOCAL_PROFILE_FRONTEND_PORT   optional integer 1-65535, default 5743; strict (occupied
//                                     port aborts, no fallback to another port).
// Usage: scripts/start-local-profile-dashboard.mjs sets both and starts this config.

const DEFAULT_FRONTEND_PORT = 5743
const READY_MARKER = 'SUM_LOCAL_PROFILE_FRONTEND_READY'

function readBackendOrigin(raw: string | undefined): string {
  if (raw === undefined || raw === '') {
    throw new Error('SUM_LOCAL_PROFILE_BACKEND_ORIGIN es obligatorio (http://127.0.0.1:<puerto>)')
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('SUM_LOCAL_PROFILE_BACKEND_ORIGIN no es una URL válida')
  }
  const port = Number(url.port)
  const loopbackHttp = url.protocol === 'http:' && url.hostname === '127.0.0.1'
  if (!loopbackHttp || !/^[1-9]\d{0,4}$/.test(url.port) || port > 65535 || url.origin !== raw) {
    throw new Error('SUM_LOCAL_PROFILE_BACKEND_ORIGIN debe ser exactamente http://127.0.0.1:<puerto>')
  }
  return url.origin
}

function readFrontendPort(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_FRONTEND_PORT
  const port = Number(raw)
  if (!/^[1-9]\d{0,4}$/.test(raw) || port > 65535) {
    throw new Error('SUM_LOCAL_PROFILE_FRONTEND_PORT debe ser un entero entre 1 y 65535')
  }
  return port
}

// Prints the actual bound origin once; it does not intercept or answer any request.
function readyMarkerPlugin(): Plugin {
  return {
    name: 'local-profile-ready-marker',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address()
        if (address !== null && address !== undefined && typeof address !== 'string') {
          console.log(`${READY_MARKER} http://127.0.0.1:${address.port}`)
        }
      })
    },
  }
}

const backendOrigin = readBackendOrigin(process.env.SUM_LOCAL_PROFILE_BACKEND_ORIGIN)
const frontendPort = readFrontendPort(process.env.SUM_LOCAL_PROFILE_FRONTEND_PORT)

// Only the two own local namespaces reach the isolated backend; the client prepends `/api`.
const ownNamespace = {
  target: backendOrigin,
  changeOrigin: false,
  rewrite: (requestPath: string) => requestPath.replace(/^\/api/, ''),
}

export default defineConfig({
  envDir: false,
  define: {
    // `define` wins over any inherited VITE_* value and activates exactly the synthetic branch.
    'import.meta.env.VITE_SUM_DATA_MODE': JSON.stringify('local'),
    'import.meta.env.VITE_SUM_LOCAL_PROFILE': JSON.stringify('synthetic-actors'),
    'import.meta.env.VITE_SUM_API_BASE_URL': JSON.stringify('/api'),
  },
  server: {
    host: '127.0.0.1',
    port: frontendPort,
    strictPort: true,
    proxy: {
      // Anchored so that `.../v1abc` or a legacy/operator path is never proxied.
      '^/api/local/perfiles/v1(?:[/?]|$)': ownNamespace,
      '^/api/local/matricula-regular/v1(?:[/?]|$)': ownNamespace,
    },
  },
  plugins: [
    readyMarkerPlugin(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})

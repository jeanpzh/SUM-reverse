import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import type { ProxyOptions } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
function loopbackProxyTarget(value: string | undefined, envVarName: string, fallback: string) {
  if (!value) return fallback
  let target: URL
  try { target = new URL(value) } catch { throw new Error(`${envVarName} debe ser una URL HTTP de loopback.`) }
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(target.hostname)
    || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error(`${envVarName} debe apuntar a un servicio HTTP de loopback sin credenciales ni ruta.`)
  }
  return target.toString().replace(/\/$/, '')
}

function createLoopbackProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        const origin = proxyReq.getHeader('origin')
        if (typeof origin === 'string') {
          try {
            const host = new URL(origin).hostname
            if (host.endsWith('.ts.net') || ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host)) {
              proxyReq.setHeader('origin', target)
            }
          } catch {
            // Leave malformed origin untouched so backend rejects it
          }
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const sumTarget = loopbackProxyTarget(env.VITE_SUM_API_PROXY_TARGET, 'VITE_SUM_API_PROXY_TARGET', 'http://127.0.0.1:3000')
  const planningTarget = loopbackProxyTarget(env.VITE_SUM_PLANNING_API_PROXY_TARGET, 'VITE_SUM_PLANNING_API_PROXY_TARGET', sumTarget)
  const proxyRoutes: Record<string, ProxyOptions> = {
    '/api/local/programacion-academica/v1': createLoopbackProxy(planningTarget),
    '/api': createLoopbackProxy(sumTarget),
  }
  return {
  server: {
    allowedHosts: ['.ts.net'],
    proxy: proxyRoutes,
  },
  preview: {
    allowedHosts: ['.ts.net'],
    proxy: proxyRoutes,
  },
  plugins: [
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  }
})

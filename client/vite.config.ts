import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
function simulatorProxyTarget(value?: string) {
  if (!value) return 'http://127.0.0.1:3000'
  let target: URL
  try { target = new URL(value) } catch { throw new Error('VITE_SUM_API_PROXY_TARGET debe ser una URL HTTP de loopback.') }
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(target.hostname)
    || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('VITE_SUM_API_PROXY_TARGET debe apuntar a un servicio HTTP de loopback sin credenciales ni ruta.')
  }
  return target.toString().replace(/\/$/, '')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const target = simulatorProxyTarget(env.VITE_SUM_API_PROXY_TARGET)
  return {
  server: {
    proxy: {
      '/api': {
        target,
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target,
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  plugins: [
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  }
})

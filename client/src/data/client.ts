import { createSumApi } from './api.ts'
import { readDataConfig } from './config.ts'
import type { EndpointKey } from './contracts.ts'

type LocalMiKey = 'perfil' | 'historial' | 'formulario' | 'fichaSocioeconomica'

export function getDataMode() {
  return readDataConfig({ mode: import.meta.env.VITE_SUM_DATA_MODE,
    baseUrl: import.meta.env.VITE_SUM_API_BASE_URL }).mode
}

// Defer configuration errors to a loader so the router can show and retry them.
export const sumApi = {
  get<K extends EndpointKey>(key: K, options?: { signal?: AbortSignal }) {
    return createSumApi(readDataConfig({ mode: import.meta.env.VITE_SUM_DATA_MODE,
      baseUrl: import.meta.env.VITE_SUM_API_BASE_URL })).get(key, options)
  },
}

export async function loadLocalMiInformacion<K extends LocalMiKey>(key: K, options?: { signal?: AbortSignal }) {
  if (getDataMode() !== 'local') return null
  return sumApi.get(key, options)
}

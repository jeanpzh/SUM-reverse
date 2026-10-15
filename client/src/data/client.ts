import { createSumApi } from './api.ts'
import { readDataConfig } from './config.ts'
import type { ApiResponseMap, EndpointKey } from './contracts.ts'
import { createLocalProfileDashboardApi, LocalProfileApiError, readLocalProfileActivation } from './localProfileDashboard.ts'
import type { AcademicKey, DashboardKey, Identity } from './localProfileDashboard.ts'
import { createLocalProfileSessionStore, activeProfileIdentity } from './localProfileSession.ts'
import { createMatriculaRegularApi } from './matriculaRegular.ts'

type LocalMiKey = 'perfil' | 'historial' | 'formulario' | 'fichaSocioeconomica'

export function getDataMode() {
  return readDataConfig({ mode: import.meta.env.VITE_SUM_DATA_MODE,
    baseUrl: import.meta.env.VITE_SUM_API_BASE_URL }).mode
}

export function getLocalProfileActivation() {
  return readLocalProfileActivation({ mode: import.meta.env.VITE_SUM_DATA_MODE,
    profile: import.meta.env.VITE_SUM_LOCAL_PROFILE })
}

export const localProfileDashboardApi = createLocalProfileDashboardApi()
function tabSessionStorage() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

export const localProfileSessionStore = createLocalProfileSessionStore({
  dashboardApi: localProfileDashboardApi,
  enrollmentApi: createMatriculaRegularApi({ mode: 'local' }),
  identityStorage: tabSessionStorage(),
})

/** L-07: resolves once the tab's stored profile session was renewed or discarded; the root guard waits for it. */
export const localProfileReady: Promise<void> = (() => {
  try {
    return getLocalProfileActivation() === 'synthetic-actors' ? localProfileSessionStore.resume() : Promise.resolve()
  } catch {
    return Promise.resolve()
  }
})()

export function getActiveProfileIdentity(): Identity {
  const identity = activeProfileIdentity(localProfileSessionStore.getSnapshot())
  if (!identity) throw new LocalProfileApiError({ kind: 'inactive', operation: 'read', message: 'No hay un perfil local activo.' })
  return identity
}

const routeDirectKeys = new Set<DashboardKey>(['perfil', 'matriculaInfo', 'programacion', 'prematricula', 'plan', 'matricula', 'horarios'])

// Defer configuration errors to a loader so the router can show and retry them.
export const sumApi = {
  get<K extends EndpointKey>(key: K, options?: { signal?: AbortSignal }) {
    if (getLocalProfileActivation() === 'synthetic-actors') {
      if (routeDirectKeys.has(key)) {
        throw new TypeError(`La clave ${key} requiere el adaptador tipado de perfiles locales.`)
      }
      const identity = getActiveProfileIdentity()
      return localProfileDashboardApi.read(key as DashboardKey, identity, options)
        .then((response) => response.data.payload as ApiResponseMap[K])
    }
    return createSumApi(readDataConfig({ mode: import.meta.env.VITE_SUM_DATA_MODE,
      baseUrl: import.meta.env.VITE_SUM_API_BASE_URL })).get(key, options)
  },
}

export function readLocalProfileRoute<K extends AcademicKey | 'perfil' | 'matricula' | 'horarios'>(
  key: K,
  identity: Identity = getActiveProfileIdentity(),
  options?: { signal?: AbortSignal },
) {
  return localProfileDashboardApi.read(key, identity, options)
}

export async function loadLocalMiInformacion<K extends LocalMiKey>(key: K, options?: { signal?: AbortSignal }) {
  if (getDataMode() !== 'local') return null
  return sumApi.get(key, options)
}

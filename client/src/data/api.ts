import type { ApiResponseMap, EndpointKey } from './contracts.ts'
import type { DataConfig } from './config.ts'
import { readDataConfig } from './config.ts'
import { endpoints } from './endpoints.ts'
import { buildEndpointUrl, readHttpResponse } from './transport.ts'
import { mockResponses } from './mocks/responses.ts'

const localHttpKeys: EndpointKey[] = ['perfil', 'formulario', 'historial', 'fichaSocioeconomica', 'programacion',
  'prematricula', 'matricula', 'horarios', 'evaluaciones', 'deudas', 'asistencias', 'tutoria', 'plan', 'matriculaInfo']
const localOnlyKeys: EndpointKey[] = ['historial', 'fichaSocioeconomica']

export function createSumApi(config: DataConfig, fetchImpl: typeof fetch = globalThis.fetch) {
  const validated = readDataConfig(config)
  return {
    async get<K extends EndpointKey>(key: K, options: { signal?: AbortSignal } = {}): Promise<ApiResponseMap[K]> {
      options.signal?.throwIfAborted()
      if (validated.mode === 'mock' || (validated.mode === 'local' && !localHttpKeys.includes(key))
        || (validated.mode === 'api' && localOnlyKeys.includes(key))) {
        await Promise.resolve()
        options.signal?.throwIfAborted()
        return structuredClone(mockResponses[key])
      }
      const response = await fetchImpl(buildEndpointUrl(validated.baseUrl, key), {
        method: validated.mode === 'api' && 'legacyMethod' in endpoints[key]
          ? endpoints[key].legacyMethod : endpoints[key].method,
        headers: { Accept: 'application/json' },
        credentials: validated.mode === 'local' ? 'omit' : 'include', signal: options.signal,
      })
      return readHttpResponse(response, key, validated.mode === 'local')
    },
  }
}

import type { ApiResponseMap, EndpointKey } from './contracts.ts'
import type { DataConfig } from './config.ts'
import { readDataConfig } from './config.ts'
import { endpoints } from './endpoints.ts'
import { buildEndpointUrl, readHttpResponse } from './transport.ts'
import { mockResponses } from './mocks/responses.ts'

export function createSumApi(config: DataConfig, fetchImpl: typeof fetch = globalThis.fetch) {
  const validated = readDataConfig(config)
  return {
    async get<K extends EndpointKey>(key: K, options: { signal?: AbortSignal } = {}): Promise<ApiResponseMap[K]> {
      options.signal?.throwIfAborted()
      if (validated.mode === 'mock') {
        await Promise.resolve()
        options.signal?.throwIfAborted()
        return structuredClone(mockResponses[key])
      }
      const response = await fetchImpl(buildEndpointUrl(validated.baseUrl, key), {
        method: endpoints[key].method, headers: { Accept: 'application/json' },
        credentials: 'include', signal: options.signal,
      })
      return readHttpResponse(response, key)
    },
  }
}

import { HttpException, Injectable } from '@nestjs/common'
import { validateAcademicPublication, validateAcademicPublicationList } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicPublication, AcademicPublicationList } from '../../../shared/programacion-academica-api.mjs'
import { SavedDraftService } from '../programacion-academica/saved-draft.service.js'

export interface AcademicPublicationReader {
  publications(): Promise<AcademicPublicationList>
  getPublication(id: string): Promise<AcademicPublication>
}

export const ACADEMIC_PUBLICATION_READER = Symbol.for('SUM_ACADEMIC_PUBLICATION_READER')

function normalizePlanningServiceUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  let parsed: URL
  try { parsed = new URL(trimmed) } catch { throw new Error('SUM_PLANNING_SERVICE_URL debe ser una URL HTTP de loopback válida') }
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname)
    || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('SUM_PLANNING_SERVICE_URL debe apuntar a un servicio HTTP de loopback sin credenciales')
  }
  return parsed.toString().replace(/\/$/, '')
}

@Injectable()
export class HttpAcademicPublicationReader implements AcademicPublicationReader {
  constructor(
    private readonly fallback: SavedDraftService,
    private readonly baseUrl: string | null = normalizePlanningServiceUrl(process.env.SUM_PLANNING_SERVICE_URL),
    private readonly fetchImpl: typeof fetch = globalThis.fetch,
  ) {}

  async publications(): Promise<AcademicPublicationList> {
    if (!this.baseUrl) return this.fallback.publications()
    const body = await this.fetchJson(`${this.baseUrl}/local/programacion-academica/v1/publicaciones`)
    try { validateAcademicPublicationList(body) } catch {
      throw new HttpException({ error: { code: 'DRAFT_CORRUPT', message: 'La lista de publicaciones remota no superó su validación' } }, 409)
    }
    return body
  }

  async getPublication(id: string): Promise<AcademicPublication> {
    if (!this.baseUrl) return this.fallback.getPublication(id)
    const body = await this.fetchJson(`${this.baseUrl}/local/programacion-academica/v1/publicaciones/${encodeURIComponent(id)}`)
    try { validateAcademicPublication(body) } catch {
      throw new HttpException({ error: { code: 'DRAFT_CORRUPT', message: 'La publicación remota no superó su validación' } }, 409)
    }
    return body
  }

  private async fetchJson(url: string): Promise<unknown> {
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      throw new HttpException({ error: { code: 'STORAGE_UNAVAILABLE', message: 'No se pudo conectar con el servicio de planificación académica' } }, 503)
    }
    let body: unknown = null
    try { body = await response.json() } catch {
      throw new HttpException({ error: { code: 'STORAGE_UNAVAILABLE', message: 'Respuesta inválida del servicio de planificación académica' } }, 503)
    }
    if (!response.ok) {
      const payload = body && typeof body === 'object' ? body as Record<string, unknown> : { error: { code: 'UPSTREAM_ERROR', message: 'Error del servicio de planificación' } }
      throw new HttpException(payload, response.status)
    }
    return body
  }
}

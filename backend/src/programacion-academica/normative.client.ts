import { HttpException } from '@nestjs/common'
import { validateAcademicNormativeRequest, validateAcademicNormativeResponse } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicNormativeResponse } from '../../../shared/programacion-academica-api.mjs'
import { engineUrl } from './planning-engine.client.js'

export async function queryNormative(body: unknown, fetchImpl: typeof fetch = globalThis.fetch): Promise<AcademicNormativeResponse> {
  try { validateAcademicNormativeRequest(body) } catch { throw new HttpException({ error: { code: 'NORMATIVE_INVALID', message: 'Consulta normativa inválida' } }, 400) }
  const base = engineUrl()
  if (!base) throw new HttpException({ error: { code: 'NORMATIVE_UNAVAILABLE', message: 'Motor normativo no disponible' } }, 503)
  try {
    const response = await fetchImpl(`${base}/v1/normative/query`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...body, question: body.question.trim() }), signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error('Normative upstream failed')
    const result: unknown = await response.json()
    validateAcademicNormativeResponse(result, body)
    return result
  } catch {
    throw new HttpException({ error: { code: 'NORMATIVE_UPSTREAM_ERROR', message: 'No se pudo recuperar evidencia normativa válida' } }, 502)
  }
}

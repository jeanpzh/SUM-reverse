import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import { Catch, HttpException } from '@nestjs/common'
import type { Response } from 'express'
import { MatriculaRegularError } from '../matricula-regular/matricula-regular-error.filter.js'
import { SavedDraftStoreError } from '../programacion-academica/saved-draft-store.js'

const sessionCodes = new Set(['ACTOR_NOT_FOUND', 'SESSION_NOT_FOUND', 'SESSION_EXPIRED'])
const forbiddenCodes = new Set(['SESSION_CONTEXT_MISMATCH', 'SCENARIO_NOT_REGULAR', 'E2_DISABLED', 'ACTOR_NOT_ALLOWED'])

function errorDetails(exception: unknown): { status: number, code: string, message: string } {
  if (exception instanceof SavedDraftStoreError) {
    return { status: exception.status >= 500 ? 503 : exception.status, code: exception.status >= 500 ? 'STORAGE_UNAVAILABLE' : exception.code, message: exception.message }
  }
  if (exception instanceof MatriculaRegularError) {
    if (sessionCodes.has(exception.code)) return { status: 401, code: 'SESSION_REQUIRED', message: 'La sesión local ya no está activa' }
    if (forbiddenCodes.has(exception.code)) return { status: 403, code: 'ACCESS_DENIED', message: 'El perfil no está habilitado para esta propuesta' }
    return { status: exception.status, code: exception.status >= 500 ? 'LOCAL_CONTEXT_UNAVAILABLE' : exception.code, message: 'No se pudo validar el contexto local' }
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus()
    const response = exception.getResponse()
    const raw = response && typeof response === 'object' ? (response as Record<string, unknown>).error : null
    const details = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const code = typeof details.code === 'string' ? details.code : 'REQUEST_FAILED'
    const message = typeof details.message === 'string' ? details.message : 'No se pudo completar la solicitud'
    if (code === 'PUBLICATION_NOT_FOUND') return { status: 404, code: 'PUBLICATION_NOT_FOUND', message }
    if (status >= 500) return { status: 503, code: 'STORAGE_UNAVAILABLE', message: 'El almacenamiento local no está disponible' }
    return { status, code, message }
  }
  return { status: 503, code: 'STORAGE_UNAVAILABLE', message: 'No se pudo acceder al almacenamiento local' }
}

@Catch()
export class PrematriculaErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const error = errorDetails(exception)
    response.status(error.status).json({ error: { code: error.code, message: error.message } })
  }
}

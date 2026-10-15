import {
  validateRenewalRequest,
  validateSessionRequest,
} from '../../../../shared/matricula-regular.mjs'
import type { MatriculaRegularSessionRequest } from '../../../../shared/matricula-regular.mjs'

export function parseSessionRequest(value: unknown): MatriculaRegularSessionRequest {
  validateSessionRequest(value)
  return value
}

export function parseRenewalRequest(sessionId: unknown, value: unknown): MatriculaRegularSessionRequest {
  validateRenewalRequest(sessionId, value)
  return value
}

export function validationFields(error: unknown): string[] {
  const message = error instanceof Error ? error.message : ''
  const path = message.split(':', 1)[0] ?? ''
  const field = path
    .replace(/^sessionRequest\./, 'body.')
    .replace(/^renewalRequest\./, 'body.')

  return field.length > 0 ? [field] : ['body']
}

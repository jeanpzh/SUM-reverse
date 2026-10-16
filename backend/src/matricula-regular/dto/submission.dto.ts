import { validateSubmissionRequest } from '../../../../shared/matricula-regular.mjs'
import type { MatriculaRegularSubmission } from '../../../../shared/matricula-regular.mjs'

export function parseSubmissionRequest(value: unknown): MatriculaRegularSubmission {
  validateSubmissionRequest(value)
  return value
}

export function submissionValidationFields(error: unknown): string[] {
  const message = error instanceof Error ? error.message : ''
  const path = message.split(':', 1)[0] ?? ''
  const field = path.replace(/^submissionRequest\./, 'body.')
  return field.length > 0 ? [field] : ['body']
}

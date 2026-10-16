import { validateReportQuery } from '../../../../shared/matricula-regular.mjs'
import type { MatriculaRegularReportQuery } from '../../../../shared/matricula-regular.mjs'

export function parseReportQuery(value: unknown): MatriculaRegularReportQuery {
  validateReportQuery(value)
  return value
}

export function reportValidationFields(error: unknown): string[] {
  const message = error instanceof Error ? error.message : ''
  const path = message.split(':', 1)[0] ?? ''
  const field = path.replace(/^reportQuery\./, 'query.')
  return field.length > 0 ? [field] : ['query']
}

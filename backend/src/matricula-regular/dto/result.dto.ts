import { validateLookupQuery } from '../../../../shared/matricula-regular.mjs'
import type { MatriculaRegularLookupQuery } from '../../../../shared/matricula-regular.mjs'

export function parseLookupQuery(value: unknown): MatriculaRegularLookupQuery {
  validateLookupQuery(value)
  return value
}

export function lookupValidationFields(error: unknown): string[] {
  const message = error instanceof Error ? error.message : ''
  const path = message.split(':', 1)[0] ?? ''
  const field = path.replace(/^lookupQuery\./, 'query.')
  return field.length > 0 ? [field] : ['query']
}

import { PLANNING_LIMITS } from '../../../shared/academic-planning-policy.mjs'

/** Local prototype limits; not institutional academic rules. */
export const GENERATOR_LIMITS = Object.freeze({
  catalog: 128,
  availability: 32,
  inputIdLength: 80,
  generatedIdLength: 2048,
  sessions: PLANNING_LIMITS.sessions,
  candidateVisits: 200000,
  defaultElapsedMs: 2000,
  repairUnits: 16,
  repairBacktracks: 32,
  maxElapsedMs: 5000,
})

/** Size gate only; structure and academic rules still belong to the existing validator. */
export function checkScheduleSizes(value: unknown, limits: { courses?: number, teachers?: number, rooms?: number, sessions?: number } = {}): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const input = value as Record<string, unknown>
  const catalogLimit = GENERATOR_LIMITS.catalog
  const sessionLimit = limits.sessions ?? GENERATOR_LIMITS.sessions
  for (const [key, maximum] of [
    ['courses', limits.courses ?? catalogLimit], ['teachers', limits.teachers ?? catalogLimit], ['rooms', limits.rooms ?? catalogLimit],
    ['compatibleGroups', catalogLimit], ['sections', sessionLimit], ['assignments', sessionLimit],
  ] as const) {
    const rows = input[key]
    if (!Array.isArray(rows)) continue
    if (rows.length > maximum) throw new TypeError(`${key}: máximo ${maximum} elementos`)
    for (const item of rows) {
      if (typeof item === 'string' && item.length > GENERATOR_LIMITS.generatedIdLength) throw new TypeError(`${key}: identificador demasiado largo`)
      if (!item || typeof item !== 'object') continue
      for (const [field, content] of Object.entries(item)) {
        if (typeof content === 'string' && content.length > GENERATOR_LIMITS.generatedIdLength) throw new TypeError(`${key}.${field}: identificador demasiado largo`)
        if (field === 'availability' && Array.isArray(content) && content.length > GENERATOR_LIMITS.availability) throw new TypeError(`${key}.availability: máximo 32 ventanas`)
        if (field === 'courseIds' && Array.isArray(content) && (content.length > catalogLimit || content.some((id) => typeof id === 'string' && id.length > GENERATOR_LIMITS.generatedIdLength))) throw new TypeError(`${key}.courseIds: lista demasiado grande`)
      }
    }
  }
}

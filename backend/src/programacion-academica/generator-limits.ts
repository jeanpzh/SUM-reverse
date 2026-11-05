/** Local prototype limits; not institutional academic rules. */
export const GENERATOR_LIMITS = Object.freeze({
  catalog: 32,
  availability: 32,
  inputIdLength: 80,
  generatedIdLength: 2048,
  sessions: 128,
  candidateVisits: 200000,
  defaultElapsedMs: 2000,
  maxElapsedMs: 5000,
})

/** Size gate only; structure and academic rules still belong to the existing validator. */
export function checkScheduleSizes(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const input = value as Record<string, unknown>
  for (const [key, maximum] of [
    ['courses', 32], ['teachers', 32], ['rooms', 32], ['compatibleGroups', 32], ['sections', 128], ['assignments', 128],
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
        if (field === 'courseIds' && Array.isArray(content) && (content.length > 32 || content.some((id) => typeof id === 'string' && id.length > GENERATOR_LIMITS.generatedIdLength))) throw new TypeError(`${key}.courseIds: lista demasiado grande`)
      }
    }
  }
}

import type { AcademicNormativeResponse } from '../../../../shared/programacion-academica-api.mjs'

export function uniqueNormativeCitations(citations: AcademicNormativeResponse['citations']) {
  const seen = new Set<string>()
  return citations.filter((citation) => {
    // Different articles in the same PDF remain separate evidence.
    const key = JSON.stringify([citation.id, citation.documentId, citation.title, citation.article,
      citation.page, citation.url, citation.excerpt, citation.sourceClass, citation.scope,
      citation.reviewedAt, citation.effectiveFrom, citation.effectiveTo])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Detects a teaching regime explicitly named in a question. It only suggests a
// filter to the user; it never changes the filter or asserts applicability.
export type NormativeRegime = 'ordinario' | 'contratado'

export function regimeNamedIn(question: string): NormativeRegime | null {
  const text = question.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const ordinario = /\bordinari[oa]s?\b/.test(text)
  const contratado = /\bcontratad[oa]s?\b/.test(text)
  if (ordinario === contratado) return null
  return ordinario ? 'ordinario' : 'contratado'
}

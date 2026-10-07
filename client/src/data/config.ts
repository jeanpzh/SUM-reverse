export type DataConfig = { mode: 'mock'; baseUrl?: string } | { mode: 'api'; baseUrl: string }

export function validateBaseUrl(baseUrl: string) {
  if (!baseUrl || baseUrl.startsWith('//') || baseUrl.includes('\\')) {
    throw new Error('URL base de API inválida.')
  }
  if (baseUrl.startsWith('/')) return
  let url: URL
  try { url = new URL(baseUrl) } catch { throw new Error('URL base de API inválida.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('URL base debe usar HTTP/HTTPS o un prefijo relativo.')
  }
}

export function readDataConfig(values: { mode?: string; baseUrl?: string }): DataConfig {
  const mode = values.mode || 'mock'
  if (mode !== 'mock' && mode !== 'api') throw new Error('Modo de datos inválido: usa mock o api.')
  if (mode === 'mock') return { mode }
  const baseUrl = values.baseUrl?.trim()
  if (!baseUrl) throw new Error('URL base de API requerida en modo api.')
  validateBaseUrl(baseUrl)
  return { mode, baseUrl }
}

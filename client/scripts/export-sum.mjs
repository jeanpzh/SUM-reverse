// Operator-only script: agents must not run it against SUM or private snapshots.
import { chromium } from 'playwright'
import { mkdir, lstat, writeFile, copyFile, rename, rm } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { snapshotJobs, sumOrigin, validateSnapshot, hasAuthenticationFields } from '../../scripts/sum-snapshot-contract.mjs'

const output = fileURLToPath(new URL('../../datos-reales/', import.meta.url))
const replace = process.argv.includes('--replace')
let browser
let prompt
let activeJob

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    prompt?.close()
    if (browser) await browser.close().catch(() => {})
    process.exit(130)
  })
}

function matches(url, job) {
  try {
    const parsed = new URL(url)
    return parsed.origin === sumOrigin && parsed.pathname === job.path
      && parsed.searchParams.get('accion') === job.action
      && [...parsed.searchParams.keys()].every((key) => key === 'accion' || key === '_')
  } catch { return false }
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--replace')) throw new Error('ARGUMENTOS')
  if (!process.stdin.isTTY) throw new Error('REQUIERE_TERMINAL_INTERACTIVA')
  await mkdir(output, { recursive: true, mode: 0o700 })
  if (!(await lstat(output)).isDirectory()) throw new Error('DIRECTORIO_INVALIDO')
  for (const job of snapshotJobs) {
    try {
      const existing = await lstat(join(output, job.filename))
      if (!existing.isFile()) throw new Error('DESTINO_INVALIDO')
      if (!replace) throw new Error('EXISTEN_ARCHIVOS_USE_REPLACE')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ acceptDownloads: false })
  const page = await context.newPage()
  prompt = createInterface({ input: process.stdin, output: process.stdout })
  await page.goto(`${sumOrigin}/alumnoWebSum/v2/inicio`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  const consent = await prompt.question('Inicia sesión manualmente en Chromium con tu cuenta autorizada. No envíes formularios mientras se exporta. Escribe EXPORTAR para consultar tus nueve pantallas de solo lectura: ')
  if (consent.trim() !== 'EXPORTAR') throw new Error('CANCELADO')
  if (new URL(page.url()).origin !== sumOrigin) throw new Error('SESION_ORIGEN')

  // After login, allow only this origin, normal GET assets/views and whitelisted reads.
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const known = snapshotJobs.some((job) => matches(url.href, job))
    if (url.origin !== sumOrigin || !['GET', 'HEAD', 'POST'].includes(method)
      || (method === 'POST' && !known)
      || (url.searchParams.has('accion') && !known)) await route.abort()
    else await route.continue()
  })

  const captured = []
  for (const job of snapshotJobs) {
    activeJob = job
    // The screen identifies the actual GET/POST method and body for its read call.
    const nativeRequest = page.waitForRequest((request) => matches(request.url(), job)
      && ['GET', 'POST'].includes(request.method()), { timeout: 20_000 }).catch(() => null)
    await page.goto(`${sumOrigin}${job.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const request = await nativeRequest
    if (!request || new URL(page.url()).origin !== sumOrigin
      || new URL(page.url()).pathname !== job.path) throw new Error('CONSULTA_NO_DETECTADA_O_SESION')
    await delay(2000)
    const result = await page.evaluate(async ({ path, action, method, body, contentType }) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000)
      try {
        const headers = { Accept: 'application/json' }
        if (method === 'POST' && body !== null && contentType) headers['Content-Type'] = contentType
        const response = await fetch(`${path}?accion=${encodeURIComponent(action)}`, {
          method, credentials: 'same-origin', redirect: 'error', headers,
          ...(method === 'POST' && body !== null ? { body } : {}), signal: controller.signal,
        })
        if (!response.ok) return { error: `HTTP_${response.status}` }
        if (!(response.headers.get('content-type') || '').includes('json')) return { error: 'NO_JSON' }
        const text = await response.text()
        if (text.length > 10 * 1024 * 1024) return { error: 'RESPUESTA_DEMASIADO_GRANDE' }
        return { text }
      } catch { return { error: 'RED_SESION_O_TIMEOUT' } }
      finally { clearTimeout(timer) }
    }, { path: job.path, action: job.action, method: request.method(), body: request.postData(),
      contentType: request.headers()['content-type'] })
    if (result.error) throw new Error(result.error)
    let envelope
    try {
      envelope = JSON.parse(result.text)
      validateSnapshot(job, envelope)
    } catch { throw new Error('JSON_O_ESQUEMA_INVALIDO') }
    if (hasAuthenticationFields(envelope)) throw new Error('CAMPO_DE_AUTENTICACION_NO_EXPORTABLE')
    captured.push({ job, text: result.text })
    console.log(`Recibido ${captured.length}/${snapshotJobs.length}: ${job.filename}`)
  }
  // Validate the whole set before replacing any existing canonical files.
  const suffix = `${Date.now()}-${process.pid}`
  const staging = join(output, `.export-${suffix}`)
  await mkdir(staging, { mode: 0o700 })
  try {
    for (const { job, text } of captured) {
      await writeFile(join(staging, job.filename), text, { flag: 'wx', mode: 0o600 })
    }
    if (replace) {
      const backup = join(output, `backup-${suffix}`)
      await mkdir(backup, { mode: 0o700 })
      for (const job of snapshotJobs) {
        try { await copyFile(join(output, job.filename), join(backup, job.filename)) }
        catch (error) { if (error.code !== 'ENOENT') throw error }
      }
    }
    for (const job of snapshotJobs) await rename(join(staging, job.filename), join(output, job.filename))
  } finally { await rm(staging, { recursive: true, force: true }) }
  console.log('Exportación completa en datos-reales/. Ninguna respuesta se imprimió en consola.')
}

try { await main() }
catch (error) {
  // Never print Playwright errors, URLs, request bodies or server response values.
  const allowed = /^(ARGUMENTOS|REQUIERE_TERMINAL_INTERACTIVA|DIRECTORIO_INVALIDO|DESTINO_INVALIDO|EXISTEN_ARCHIVOS_USE_REPLACE|CANCELADO|SESION_ORIGEN|CONSULTA_NO_DETECTADA_O_SESION|HTTP_\d{3}|NO_JSON|RESPUESTA_DEMASIADO_GRANDE|RED_SESION_O_TIMEOUT|JSON_O_ESQUEMA_INVALIDO|CAMPO_DE_AUTENTICACION_NO_EXPORTABLE)$/
  console.error(`Exportación detenida: ${activeJob?.filename ?? 'inicio'} · ${allowed.test(error.message) ? error.message : 'ERROR_LOCAL_O_NAVEGADOR'}`)
  process.exitCode = 1
} finally {
  prompt?.close()
  if (browser) await browser.close().catch(() => {})
}

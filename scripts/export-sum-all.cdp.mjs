#!/usr/bin/env node
import { open, mkdir, lstat, realpath, unlink, chmod } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { origin, planRevision, readJobs, viewJobs } from './export-sum-all.manifest.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.resolve(scriptDirectory, '..')
const privateDirectory = path.join(projectDirectory, 'datos-reales')
const MAX_COMMAND_MS = 10000
const CLEANUP_COMMAND_MS = 2000
const VIEW_LIMIT_MS = 30000
const QUIET_MS = 2000
const BODY_LIMIT = 10 * 1024 * 1024
const MEMORY_LIMIT = 256 * 1024 * 1024
const MAX_ZIP32 = 0xffffffff
const cleanedConnections = new WeakSet()
const viewByPath = new Map(viewJobs.map((job) => [job.path, job]))
const readByPair = new Map(readJobs.map((job) => [`${job.path}\n${job.action}`, job]))

class ExportError extends Error {
  constructor(code, exitCode = 1) {
    super(code)
    this.code = code
    this.exitCode = exitCode
  }
}

function parseOptions(argv) {
  const options = { cdp: 'http://127.0.0.1:9222', target: undefined, delayMs: 2000, output: undefined, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--help') {
      options.help = true
      continue
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new ExportError('CLI_ARGUMENT')
    if (flag === '--cdp') options.cdp = value
    else if (flag === '--target') options.target = value
    else if (flag === '--delay-ms') {
      if (!/^\d+$/.test(value) || Number(value) < 2000 || !Number.isSafeInteger(Number(value))) throw new ExportError('CLI_ARGUMENT')
      options.delayMs = Number(value)
    } else if (flag === '--output') {
      if (path.basename(value) !== value || value.includes('\\') || !/^[A-Za-z0-9._-]+\.zip$/.test(value) || value === '.zip') throw new ExportError('CLI_ARGUMENT')
      options.output = value
    } else throw new ExportError('CLI_ARGUMENT')
    index += 1
  }
  let cdpUrl
  try { cdpUrl = new URL(options.cdp) } catch { throw new ExportError('CDP_URL') }
  if (cdpUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(cdpUrl.hostname) || cdpUrl.username || cdpUrl.password || cdpUrl.search || cdpUrl.hash || cdpUrl.pathname !== '/') throw new ExportError('CDP_URL')
  options.cdp = cdpUrl.origin
  return options
}

function printUsage() {
  process.stdout.write('Uso: node scripts/export-sum-all.cdp.mjs [--cdp http://127.0.0.1:9222] [--target ID] [--delay-ms 2000] [--output nombre.zip]\n')
}

function log(code, details = '') {
  process.stdout.write(`${code}${details ? ` ${details}` : ''}\n`)
}

function scopeDestination(rawUrl) {
  try {
    const url = new URL(rawUrl)
    if (url.origin !== origin) return 'other-origin'
    return viewByPath.get(url.pathname)?.slug ?? 'unknown-route'
  } catch {
    return 'invalid-url'
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ExportError('CANCELLED', 130))
    const timer = setTimeout(done, ms)
    function done() {
      signal?.removeEventListener('abort', abort)
      resolve()
    }
    function abort() {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(new ExportError('CANCELLED', 130))
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

function abortableDelay(ms, signal) { return sleep(ms, signal) }

function timeout(promise, ms, code) {
  let timer
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new ExportError(code)), ms) })]).finally(() => clearTimeout(timer))
}

function validTargetUrl(value) {
  try {
    const url = new URL(value)
    return url.origin === origin && !url.username && !url.password && viewByPath.has(url.pathname)
  } catch { return false }
}

async function selectTarget(options, cancellationSignal) {
  let response
  const timeoutSignal = AbortSignal.timeout(MAX_COMMAND_MS)
  const signal = AbortSignal.any([cancellationSignal, timeoutSignal])
  try {
    response = await fetch(`${options.cdp}/json/list`, { redirect: 'manual', signal })
  } catch {
    if (cancellationSignal.aborted) throw new ExportError('CANCELLED', 130)
    throw new ExportError(timeoutSignal.aborted ? 'CDP_DISCOVERY_TIMEOUT' : 'CDP_DISCOVERY')
  }
  if (response.url && new URL(response.url).origin !== options.cdp) throw new ExportError('CDP_DISCOVERY')
  if (!response.ok) throw new ExportError('CDP_DISCOVERY')
  let targets
  try {
    const reader = response.body?.getReader()
    if (!reader) throw new Error()
    const chunks = []
    let size = 0
    while (true) {
      const result = await reader.read()
      if (result.done) break
      size += result.value.byteLength
      if (size > 1024 * 1024) {
        await reader.cancel()
        throw new ExportError('CDP_DISCOVERY_SIZE')
      }
      chunks.push(Buffer.from(result.value))
    }
    targets = JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
  } catch (error) {
    if (error instanceof ExportError) throw error
    if (cancellationSignal.aborted) throw new ExportError('CANCELLED', 130)
    throw new ExportError(signal.aborted ? 'CDP_DISCOVERY_TIMEOUT' : 'CDP_DISCOVERY')
  }
  if (!Array.isArray(targets)) throw new ExportError('CDP_DISCOVERY')
  const pages = targets.filter((target) => target?.type === 'page' && validTargetUrl(target.url) && typeof target.id === 'string' && typeof target.webSocketDebuggerUrl === 'string').map((target) => ({
    id: target.id,
    webSocketDebuggerUrl: target.webSocketDebuggerUrl,
    initialPath: new URL(target.url).pathname
  }))
  if (options.target && pages.length === 1) throw new ExportError('TARGET_OPTION_UNNECESSARY')
  const target = options.target ? pages.find((item) => item.id === options.target) : pages.length === 1 ? pages[0] : undefined
  if (!target) throw new ExportError(pages.length > 1 && !options.target ? 'TARGET_AMBIGUOUS' : 'TARGET_NOT_FOUND')
  let socketUrl
  try { socketUrl = new URL(target.webSocketDebuggerUrl) } catch { throw new ExportError('CDP_TARGET') }
  if (socketUrl.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(socketUrl.hostname) || socketUrl.username || socketUrl.password || socketUrl.search || socketUrl.hash) throw new ExportError('CDP_TARGET')
  return target
}

function connectCdp(target) {
  if (typeof WebSocket !== 'function') throw new ExportError('NODE_WEBSOCKET_UNAVAILABLE')
  return new Promise((resolve, reject) => {
    let socket
    try { socket = new WebSocket(target.webSocketDebuggerUrl) } catch {
      reject(new ExportError('CDP_CONNECT'))
      return
    }
    let nextId = 0
    const pending = new Map()
    const listeners = new Map()
    let closed = false
    const settleClosed = () => {
      if (closed) return
      closed = true
      for (const entry of pending.values()) {
        clearTimeout(entry.timer)
        entry.reject(new ExportError('CDP_CLOSED'))
      }
      pending.clear()
      for (const entries of listeners.values()) entries.clear()
    }
    let settled = false
    const connectTimer = setTimeout(() => {
      if (settled) return
      settled = true
      try { socket.close() } catch { /* best-effort close before CDP initialization */ }
      reject(new ExportError('CDP_CONNECT_TIMEOUT'))
    }, MAX_COMMAND_MS)
    socket.addEventListener('open', () => {
      if (settled) {
        try { socket.close() } catch { /* close a connection that opened after its deadline */ }
        return
      }
      settled = true
      clearTimeout(connectTimer)
      resolve({
      on(method, listener) {
        if (!listeners.has(method)) listeners.set(method, new Set())
        listeners.get(method).add(listener)
        return () => listeners.get(method)?.delete(listener)
      },
      send(method, params = {}, timeoutMs = MAX_COMMAND_MS) {
        if (closed || socket.readyState !== WebSocket.OPEN) return Promise.reject(new ExportError('CDP_CLOSED'))
        const id = ++nextId
        return new Promise((resolveCommand, rejectCommand) => {
          const timer = setTimeout(() => {
            pending.delete(id)
            rejectCommand(new ExportError('CDP_COMMAND_TIMEOUT'))
          }, timeoutMs)
          pending.set(id, { resolve: resolveCommand, reject: rejectCommand, timer, method })
          try { socket.send(JSON.stringify({ id, method, params })) } catch {
            clearTimeout(timer)
            pending.delete(id)
            rejectCommand(new ExportError('CDP_SEND'))
          }
        })
      },
      async close() {
        settleClosed()
        if (socket.readyState === WebSocket.CLOSED) return
        await new Promise((resolveClose) => {
          const done = () => resolveClose()
          socket.addEventListener('close', done, { once: true })
          try { socket.close() } catch { resolveClose() }
          setTimeout(resolveClose, CLEANUP_COMMAND_MS)
        })
      }
      })
    })
    socket.addEventListener('message', (event) => {
      let message
      try { message = JSON.parse(String(event.data)) } catch { return }
      if (Number.isInteger(message.id)) {
        const entry = pending.get(message.id)
        if (!entry) return
        clearTimeout(entry.timer)
        pending.delete(message.id)
        if (message.error) {
          const expectedResumeState = /^(?:Debugger is not paused|Can only perform operation while paused)\.?$/i.test(String(message.error.message))
          const error = new ExportError(entry.method === 'Debugger.resume' && expectedResumeState ? 'DEBUGGER_NOT_PAUSED' : 'CDP_COMMAND')
          error.cdpCode = Number.isInteger(message.error.code) ? message.error.code : undefined
          entry.reject(error)
        } else entry.resolve(message.result ?? {})
      } else if (typeof message.method === 'string') {
        for (const listener of listeners.get(message.method) ?? []) {
          try { listener(message.params ?? {}) } catch { /* event handlers fail closed */ }
        }
      }
    })
    socket.addEventListener('error', () => {
      if (socket.readyState !== WebSocket.OPEN && !settled) {
        settled = true
        clearTimeout(connectTimer)
        try { socket.close() } catch { /* best-effort close before CDP initialization */ }
        reject(new ExportError('CDP_CONNECT'))
      }
    })
    socket.addEventListener('close', () => {
      if (!settled) {
        settled = true
        clearTimeout(connectTimer)
        reject(new ExportError('CDP_CONNECT'))
      }
    })
    socket.addEventListener('close', settleClosed)
  })
}

function actionFromRequest(request) {
  let url
  try { url = new URL(request.url) } catch { return undefined }
  const urlActions = url.searchParams.getAll('accion')
  let bodyActions = []
  const data = request.postData
  if (typeof data === 'string' && data.length <= 65536) {
    if (/^\s*\{/.test(data)) {
      const keys = data.match(/"accion"\s*:/g) ?? []
      if (keys.length === 1) {
        try {
          const parsed = JSON.parse(data)
          if (typeof parsed.accion === 'string') bodyActions = [parsed.accion]
        } catch { return undefined }
      } else if (keys.length > 1) return undefined
    } else {
      const form = new URLSearchParams(data)
      bodyActions = form.getAll('accion')
    }
  }
  const values = [...urlActions, ...bodyActions]
  return values.length === 1 ? values[0] : undefined
}

function isJsonMime(mime) { return typeof mime === 'string' && /(?:application|text)\/(?:[a-z0-9.+-]*\+)?json\b/i.test(mime) }

function makeCollector() {
  const files = new Map()
  const queries = new Map(readJobs.map((job) => [job.key, { job, status: 'missing', canonicalFile: null, captureCount: 0, lastAttemptStatus: 'missing', lastValidOrdinal: null, canonicalStale: false, code: 'NO_RESPONSE', ordinal: 0 }]))
  const views = new Map(viewJobs.map((job) => [job.slug, { slug: job.slug, status: 'failed', domFile: null, rootKind: null, selectorEvidence: 'local-only', code: 'NOT_VISITED' }]))
  let bytesUsed = 0
  let unknownJsonRequests = 0
  function deleteFile(filename) {
    const existing = files.get(filename)
    if (!existing) return
    bytesUsed -= existing.length
    files.delete(filename)
  }
  function addFile(filename, bytes) {
    if (filename.split('/').some((part) => !part || part === '.' || part === '..') || filename.startsWith('/')) throw new ExportError('ZIP_PATH')
    const manifestReserve = filename === 'datos-reales/manifest.json' ? 0 : 128 * 1024
    const existing = files.get(filename)
    const existingLength = existing?.length ?? 0
    if (bytes.length > MEMORY_LIMIT - (bytesUsed - existingLength) - manifestReserve) throw new ExportError('SIZE_LIMIT', 2)
    bytesUsed -= existingLength
    bytesUsed += bytes.length
    files.set(filename, Buffer.from(bytes))
  }
  function beginAttempt(key) {
    const query = queries.get(key)
    if (!query) return 0
    query.ordinal += 1
    query.latestOrder = query.ordinal
    query.lastAttemptStatus = 'pending'
    query.status = 'failed'
    query.code = 'PENDING_RESPONSE'
    query.canonicalStale = query.lastValidOrdinal !== null
    if (query.canonicalFile) deleteFile(`datos-reales/${query.canonicalFile}`)
    query.canonicalFile = null
    return query.ordinal
  }
  function markAttemptFailed(key, code, order = 0) {
    const query = queries.get(key)
    if (!query) return
    if (order && order !== query.latestOrder) return
    query.lastAttemptStatus = 'failed'
    query.canonicalStale = query.lastValidOrdinal !== null
    query.status = 'failed'
    query.code = code
    if (query.canonicalFile) deleteFile(`datos-reales/${query.canonicalFile}`)
    query.canonicalFile = null
  }
  function failPendingAttempt(key, code, order) {
    const query = queries.get(key)
    if (!query || query.latestOrder !== order || query.lastAttemptStatus !== 'pending') return
    markAttemptFailed(key, code, order)
  }
  function recordAttempt(key, slug, status, code, body, order) {
    const query = queries.get(key)
    if (!query) return
    if (status === 'valid') {
      query.captureCount += 1
      query.lastValidOrdinal = Math.max(query.lastValidOrdinal ?? 0, order)
    }
    if (order !== query.latestOrder) {
      if (status === 'valid') {
        if (query.lastAttemptStatus === 'pending' || query.lastAttemptStatus === 'failed') query.canonicalStale = true
        addFile(`datos-reales/responses/${key}/${slug}-${order}.json`, body)
      }
      else if (body) addFile(`datos-reales/failed-responses/${key}/${slug}-${order}.json`, body)
      return
    }
    query.lastAttemptStatus = status
    if (status === 'failed') {
      markAttemptFailed(key, code, order)
      if (body) addFile(`datos-reales/failed-responses/${key}/${slug}-${order}.json`, body)
      return
    }
    query.status = 'captured'
    query.code = null
    query.canonicalStale = false
    const occurrence = `datos-reales/responses/${key}/${slug}-${order}.json`
    addFile(occurrence, body)
    const canonical = `datos-reales/${query.job.filename}`
    addFile(canonical, body)
    query.canonicalFile = query.job.filename
  }
  function markView(slug, status, code) {
    const view = views.get(slug)
    if (view) {
      view.status = status
      view.code = code
    }
  }
  function recordDom(slug, snapshot) {
    if (!snapshot || typeof snapshot.text !== 'string') {
      markView(slug, 'failed', 'DOM_UNAVAILABLE')
      return
    }
    const serialized = JSON.stringify(snapshot)
    const bytes = Buffer.from(serialized, 'utf8')
    addFile(`datos-reales/views/${slug}.json`, bytes)
    const view = views.get(slug)
    const truncated = Object.values(snapshot.truncation ?? {}).some(Boolean)
    view.status = truncated ? 'failed' : 'captured'
    view.domFile = `views/${slug}.json`
    view.rootKind = snapshot.rootKind
    view.code = truncated ? 'DOM_TRUNCATED' : null
  }
  function finish() {
    for (const query of queries.values()) {
      if (query.lastAttemptStatus === 'pending') failPendingAttempt(query.job.key, 'REQUEST_INCOMPLETE', query.latestOrder)
      if (query.status === 'captured' && query.lastAttemptStatus !== 'failed') continue
      if (query.lastAttemptStatus === 'missing') query.code = 'NO_RESPONSE'
    }
    const queryRows = [...queries.values()].map(({ job, ...entry }) => ({ key: job.key, status: entry.status, canonicalFile: entry.canonicalFile, captureCount: entry.captureCount, lastAttemptStatus: entry.lastAttemptStatus, lastValidOrdinal: entry.lastValidOrdinal, canonicalStale: entry.canonicalStale, code: entry.code }))
    const viewRows = [...views.values()].map(({ slug, status, domFile, rootKind, selectorEvidence, code }) => ({ slug, status, domFile, rootKind, selectorEvidence, code }))
    const missing = [
      ...viewRows.filter((entry) => entry.status !== 'captured').map((entry) => `view:${entry.slug}:${entry.code}`),
      ...queryRows.filter((entry) => entry.status !== 'captured').map((entry) => `query:${entry.key}:${entry.code}`)
    ]
    const manifest = { format: 'sum-export-manifest-v1', planRevision, coverage: 'initial-view-load', views: viewRows, queries: queryRows, unknownJsonRequests, missing }
    addFile('datos-reales/manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'))
    return { files: [...files].map(([filename, bytes]) => ({ filename, bytes })), manifest }
  }
  return { files, queries, views, addFile, beginAttempt, markAttemptFailed, failPendingAttempt, recordAttempt, markView, recordDom, finish, countUnknown: () => { unknownJsonRequests += 1 }, get bytesUsed() { return bytesUsed } }
}

function decodeBody(result) {
  if (typeof result.body !== 'string') throw new ExportError('INVALID_RESPONSE', 2)
  const maximumEncodedLength = Math.ceil(BODY_LIMIT * 4 / 3) + 4
  if (result.base64Encoded ? result.body.length > maximumEncodedLength : Buffer.byteLength(result.body, 'utf8') > BODY_LIMIT) throw new ExportError('SIZE_LIMIT', 2)
  let bytes
  if (result.base64Encoded) bytes = Buffer.from(result.body, 'base64')
  else bytes = Buffer.from(result.body, 'utf8')
  if (bytes.length > BODY_LIMIT) throw new ExportError('SIZE_LIMIT', 2)
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new ExportError('INVALID_JSON', 2) }
  const envelope = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.hasOwn(parsed, 'message') && Object.hasOwn(parsed, 'codError') && Object.hasOwn(parsed, 'data') && (typeof parsed.message === 'string' || parsed.message === null)
  const valid = envelope && parsed.codError === null
  const failedEnvelope = envelope && parsed.codError !== null
  return { bytes, valid, failedEnvelope, parsed }
}

async function captureDom(cdp, job) {
  const tree = await cdp.send('Page.getFrameTree')
  const frameId = tree?.frameTree?.frame?.id
  if (typeof frameId !== 'string') throw new ExportError('DOM_UNAVAILABLE', 2)
  const world = await cdp.send('Page.createIsolatedWorld', { frameId, worldName: 'sum-export-readonly', grantUniveralAccess: false })
  if (!Number.isInteger(world.executionContextId)) throw new ExportError('DOM_UNAVAILABLE', 2)
  const expression = `(() => {
    const blocked = /token|secret|cookie|authorization|session|csrf|password/i
    const excluded = 'header,nav,aside,script,style,noscript,[hidden]'
    const truncation = { headings: false, tables: false, rows: false, cells: false, fields: false, links: false, text: false }
    const hidden = (el) => {
      if (!(el instanceof Element)) return true
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return el.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || rect.width <= 0 || rect.height <= 0
    }
    const safe = (el) => !blocked.test([...el.attributes].map(a => a.name + '=' + a.value).join(' '))
    const allowed = (el, scope) => {
      let current = el
      while (current instanceof Element) {
        if (hidden(current) || !safe(current) || current.matches(excluded)) return false
        if (current === scope) return true
        current = current.parentElement
      }
      return false
    }
    const textOf = (el, limit = 4000) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      const parts = []
      let length = 0
      let node
      while ((node = walker.nextNode())) {
        if (!allowed(node.parentElement, el)) continue
        const text = node.nodeValue.replace(/\\s+/g, ' ').trim()
        if (!text) continue
        if (length + text.length > limit) truncation.text = true
        const remaining = Math.max(0, limit - length)
        if (remaining) parts.push(text.slice(0, remaining))
        length += Math.min(text.length, remaining)
        if (length >= limit) break
      }
      return parts.join(' ').trim()
    }
    const selector = 'main, .page-content, .content-wrapper'
    const candidates = [...document.querySelectorAll(selector)].filter(el => allowed(el, document.body))
    const root = candidates[0] || document.body
    if (!root || !allowed(root, root)) return null
    const visible = [...root.querySelectorAll('*')].filter(el => allowed(el, root))
    const headingNodes = visible.filter(el => /^H[1-6]$/.test(el.tagName))
    const headings = headingNodes.slice(0, 100).map(el => textOf(el)).filter(Boolean)
    truncation.headings ||= headingNodes.length > 100
    const tableNodes = [...root.querySelectorAll('table')].filter(el => allowed(el, root))
    const tables = tableNodes.slice(0, 50).map(table => {
      const rowNodes = [...table.querySelectorAll('tr')].filter(row => allowed(row, table))
      if (rowNodes.length > 200) truncation.rows = true
      return rowNodes.slice(0, 200).map(row => {
        const cells = [...row.querySelectorAll('th,td')].filter(cell => allowed(cell, row))
        if (cells.length > 100) truncation.cells = true
        return cells.slice(0, 100).map(cell => textOf(cell))
      })
    })
    truncation.tables = tableNodes.length > tables.length
    const fieldNodes = visible.filter(el => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'hidden' && el.type !== 'password')
    const fields = fieldNodes.slice(0, 300).map(el => {
      const label = el.labels ? [...el.labels].filter(labelEl => allowed(labelEl, root)).map(labelEl => textOf(labelEl)).join(' ').trim() : ''
      const rawValue = el.tagName === 'SELECT' ? [...el.selectedOptions].filter(option => safe(option)).map(option => (option.label || option.text || '').replace(/\\s+/g, ' ').trim()).join(', ') : (el.value || '')
      if (rawValue.length > 1000) truncation.fields = true
      const value = rawValue.slice(0, 1000)
      return { label, type: el.type || el.tagName.toLowerCase(), value, ...(['checkbox', 'radio'].includes(el.type) ? { checked: el.checked } : {}) }
    })
    truncation.fields ||= fieldNodes.length > fields.length
    const linkNodes = visible.filter(el => el.tagName === 'A')
    const links = linkNodes.slice(0, 300).map(el => {
      try {
        const u = new URL(el.href)
        return { text: textOf(el), path: u.origin === location.origin ? u.pathname : '' }
      } catch {
        return { text: textOf(el), path: '' }
      }
    }).filter(link => link.text || link.path)
    truncation.links = linkNodes.length > 300
    return { format: 'sum-visible-dom-v1', routeSlug: ${JSON.stringify(job.slug)}, rootKind: root === document.body ? 'body-fallback' : root.tagName.toLowerCase(), headings, tables, fields, links, text: textOf(root, 20000), truncation }
  })()`
  const result = await cdp.send('Runtime.evaluate', { expression, contextId: world.executionContextId, returnByValue: true, awaitPromise: false })
  const value = result?.result?.value
  return value && typeof value === 'object' && typeof value.text === 'string' ? value : null
}

function watchInitialStability(cdp, mainFrameId, initialPath) {
  const inflight = new Set()
  const documents = new Set()
  const unsubscribers = []
  let lastActivity = Date.now()
  let documentPending = false
  let failure
  const on = (method, listener) => unsubscribers.push(cdp.on(method, listener))
  on('Page.frameNavigated', ({ frame }) => {
    if (frame?.parentId || !frame?.url) return
    try {
      const url = new URL(frame.url)
      if (url.origin !== origin || url.pathname !== initialPath) failure = 'SESSION_OR_SCOPE'
    } catch { failure = 'SESSION_OR_SCOPE' }
    lastActivity = Date.now()
  })
  on('Network.requestWillBeSent', (event) => {
    if (event.frameId !== mainFrameId) return
    if (event.type === 'Document') {
      try {
        const url = new URL(event.request?.url)
        if (url.origin !== origin || url.pathname !== initialPath) failure = 'SESSION_OR_SCOPE'
      } catch { failure = 'SESSION_OR_SCOPE' }
      documentPending = true
      documents.add(event.requestId)
      inflight.add(event.requestId)
      lastActivity = Date.now()
      return
    }
    if (event.type === 'XHR' || event.type === 'Fetch') {
      inflight.add(event.requestId)
      lastActivity = Date.now()
    }
  })
  on('Network.responseReceived', (event) => {
    if (!documents.has(event.requestId)) return
    const status = event.response?.status
    if (status === 401 || status === 403) failure = 'SESSION_OR_SCOPE'
    else if (status < 200 || status >= 300) failure = 'NAVIGATION_FAILED'
  })
  const requestEnded = ({ requestId }) => {
    documents.delete(requestId)
    if (inflight.delete(requestId)) lastActivity = Date.now()
    if (inflight.size === 0) documentPending = false
  }
  on('Network.loadingFinished', requestEnded)
  on('Network.loadingFailed', requestEnded)
  on('Page.lifecycleEvent', (event) => {
    if (event.frameId === mainFrameId && event.name === 'load') lastActivity = Date.now()
  })
  on('Debugger.paused', () => {
    void cdp.send('Debugger.resume').catch((error) => {
      if (error.code !== 'DEBUGGER_NOT_PAUSED') failure = 'DEBUGGER_RESUME_FAILED'
    })
  })
  return {
    async wait(signal) {
      const started = Date.now()
      const minimum = started + QUIET_MS
      while (Date.now() - started < VIEW_LIMIT_MS) {
        if (signal.aborted) throw new ExportError('CANCELLED', 130)
        if (failure) throw new ExportError(failure)
        if (Date.now() >= minimum && !documentPending && inflight.size === 0 && Date.now() - lastActivity >= QUIET_MS) return
        await abortableDelay(100, signal)
      }
      throw new ExportError('INITIAL_STABILIZE_TIMEOUT')
    },
    close() {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }
}

async function visitView(cdp, job, collector, signal, delayMs, state) {
  if (signal.aborted) throw new ExportError('CANCELLED', 130)
  const start = Date.now()
  const deadline = start + VIEW_LIMIT_MS
  const viewCdp = {
    send(method, params = {}, timeoutMs = MAX_COMMAND_MS) {
      if (signal.aborted) return Promise.reject(new ExportError('CANCELLED', 130))
      const remaining = deadline - Date.now()
      if (remaining <= 0) return Promise.reject(new ExportError('VIEW_TIMEOUT', 2))
      return cdp.send(method, params, Math.min(timeoutMs, MAX_COMMAND_MS, remaining))
    }
  }
  const epoch = ++state.epoch
  state.activeEpoch = epoch
  state.currentPath = job.path
  state.pending.set(epoch, new Map())
  let loadSeen = false
  let loadTime = 0
  const loadedLoaderIds = new Set()
  let expectedLoaderId
  let lastRelevant = Date.now()
  let navigationError
  const stopForScope = (reason, destination, status) => {
    if (navigationError === 'SESSION_OR_SCOPE') return
    navigationError = 'SESSION_OR_SCOPE'
    const safeStatus = status === 401 || status === 403 ? ` http=${status}` : ''
    log('SCOPE_DETAIL', `view=${job.slug} reason=${reason}${destination ? ` destination=${destination}` : ''}${safeStatus}`)
  }
  const unsubscribers = []
  const epochAttempts = []
  const epochTasks = []
  let bodyDrainFailed = false
  const currentRequests = state.pending.get(epoch)
  const on = (method, fn) => unsubscribers.push(cdp.on(method, fn))
  on('Page.frameNavigated', ({ frame }) => {
    if (frame?.parentId) return
    if (frame?.url) {
      let url
      try { url = new URL(frame.url) } catch {
        stopForScope('frame-navigation', 'invalid-url')
        return
      }
      if (url.origin !== origin || url.pathname !== job.path) stopForScope('frame-navigation', scopeDestination(frame.url))
      if (typeof frame.loaderId === 'string') {
        expectedLoaderId = frame.loaderId
        loadSeen = false
        loadTime = 0
      }
    }
  })
  on('Page.lifecycleEvent', (event) => {
    if (event.name !== 'load' || event.frameId !== state.mainFrameId || typeof event.loaderId !== 'string') return
    loadedLoaderIds.add(event.loaderId)
    if (event.loaderId === expectedLoaderId) {
      loadSeen = true
      loadTime = Date.now()
      lastRelevant = loadTime
    }
  })
  on('Network.requestWillBeSent', (event) => {
    if (event.type === 'Document' && event.frameId === state.mainFrameId) {
      let documentUrl
      try { documentUrl = new URL(event.request?.url) } catch {
        stopForScope('document-navigation', 'invalid-url')
        return
      }
      if (documentUrl.origin !== origin || documentUrl.pathname !== job.path) {
        stopForScope('document-navigation', scopeDestination(event.request?.url))
        return
      }
      currentRequests.set(event.requestId, { epoch, document: true, path: documentUrl.pathname, frameId: event.frameId, loaderId: event.loaderId })
      if (typeof event.loaderId === 'string') {
        expectedLoaderId = event.loaderId
        loadSeen = false
        loadTime = 0
      }
      lastRelevant = Date.now()
      return
    }
    if (event.type !== 'XHR' && event.type !== 'Fetch') return
    let url
    try { url = new URL(event.request?.url) } catch { return }
    if (url.origin !== origin || !url.pathname.startsWith('/alumnoWebSum/v2/')) return
    const action = actionFromRequest(event.request ?? {})
    const readJob = action ? readByPair.get(`${url.pathname}\n${action}`) : undefined
    const eligible = readJob && (event.request?.method === 'GET' || event.request?.method === 'POST') && event.frameId === state.mainFrameId
    if (eligible) {
      const order = collector.beginAttempt(readJob.key)
      const request = { epoch, key: readJob.key, slug: job.slug, order, method: event.request.method, path: url.pathname, action, loaderId: event.loaderId, frameId: event.frameId, status: null, mimeJson: false }
      currentRequests.set(event.requestId, request)
      epochAttempts.push({ key: readJob.key, order })
      lastRelevant = Date.now()
    } else if (url.pathname.startsWith('/alumnoWebSum/v2/')) {
      currentRequests.set(event.requestId, { epoch, unknown: true, status: null, mimeJson: false })
    }
  })
  on('Network.responseReceived', (event) => {
    const request = currentRequests.get(event.requestId)
    if (!request) return
    request.status = event.response?.status
    request.mimeJson = isJsonMime(event.response?.mimeType)
    if (request.document) {
      if (request.status === 401 || request.status === 403) stopForScope('document-http', undefined, request.status)
      else if (request.status < 200 || request.status >= 300) navigationError = 'NAVIGATION_FAILED'
      return
    }
    if (request.unknown && (request.status === 401 || request.status === 403)) {
      stopForScope('unlisted-request-http', undefined, request.status)
      return
    }
    if (!request.unknown && (event.type !== 'XHR' && event.type !== 'Fetch')) return
    if (!request.unknown && request.status !== 200) {
      request.code = request.status === 401 || request.status === 403 ? 'SESSION_OR_SCOPE' : 'HTTP_STATUS'
      if (request.code === 'SESSION_OR_SCOPE') stopForScope('allowed-request-http', undefined, request.status)
      lastRelevant = Date.now()
    } else if (!request.unknown) lastRelevant = Date.now()
  })
  on('Network.loadingFailed', (event) => {
    const request = currentRequests.get(event.requestId)
    if (!request) return
    if (request.unknown) {
      if (request.status === 401 || request.status === 403) stopForScope('unlisted-request-http', undefined, request.status)
      currentRequests.delete(event.requestId)
      return
    }
    if (request.document) {
      if (request.status === 401 || request.status === 403) stopForScope('document-http', undefined, request.status)
      currentRequests.delete(event.requestId)
      return
    }
    collector.markAttemptFailed(request.key, 'REQUEST_FAILED', request.order)
    currentRequests.delete(event.requestId)
    lastRelevant = Date.now()
    if (request.code === 'SESSION_OR_SCOPE') stopForScope('allowed-request-http', undefined, request.status)
  })
  on('Network.loadingFinished', (event) => {
    const request = currentRequests.get(event.requestId)
    if (!request) return
    currentRequests.delete(event.requestId)
    if (request.document) return
    if (request.unknown) {
      if (request.mimeJson) collector.countUnknown()
      return
    }
    if (request.code) {
      collector.markAttemptFailed(request.key, request.code, request.order)
      if (request.code === 'SESSION_OR_SCOPE') stopForScope('allowed-request-http', undefined, request.status)
      return
    }
    if (request.status !== 200 || !request.mimeJson) {
      collector.markAttemptFailed(request.key, request.status === 401 || request.status === 403 ? 'SESSION_OR_SCOPE' : 'UNEXPECTED_RESPONSE', request.order)
      if (request.status === 401 || request.status === 403) stopForScope('allowed-request-http', undefined, request.status)
      return
    }
    request.bodyPending = true
    const readBody = viewCdp.send('Network.getResponseBody', { requestId: event.requestId }).then((body) => {
      if (request.epoch !== epoch || state.activeEpoch !== epoch) return
      let decoded
      try { decoded = decodeBody(body) } catch (error) {
        collector.markAttemptFailed(request.key, error.code === 'SIZE_LIMIT' ? 'SIZE_LIMIT' : 'INVALID_RESPONSE', request.order)
        if (error.code === 'SIZE_LIMIT') navigationError = 'SIZE_LIMIT'
        return
      }
      if (decoded.valid) collector.recordAttempt(request.key, request.slug, 'valid', null, decoded.bytes, request.order)
      else {
        collector.recordAttempt(request.key, request.slug, 'failed', 'INVALID_ENVELOPE', decoded.failedEnvelope ? decoded.bytes : undefined, request.order)
      }
    }).catch((error) => {
      if (state.activeEpoch !== epoch) return
      if (error.code === 'SIZE_LIMIT') {
        collector.markAttemptFailed(request.key, 'SIZE_LIMIT', request.order)
        navigationError = 'SIZE_LIMIT'
      } else collector.markAttemptFailed(request.key, error.code === 'INVALID_JSON' ? 'INVALID_JSON' : 'BODY_UNAVAILABLE', request.order)
    }).finally(() => {
      state.bodyTasks.delete(readBody)
    })
    state.bodyTasks.add(readBody)
    epochTasks.push(readBody)
    lastRelevant = Date.now()
  })
  on('Debugger.paused', () => {
    void cdp.send('Debugger.resume').catch((error) => {
      if (error.code !== 'DEBUGGER_NOT_PAUSED') navigationError = 'DEBUGGER_RESUME_FAILED'
    })
  })
  try {
    const loaderBeforeNavigate = expectedLoaderId
    const nav = await viewCdp.send('Page.navigate', { url: origin + job.path })
    if (nav.errorText) throw new ExportError('NAVIGATION_FAILED', 2)
    if (expectedLoaderId === loaderBeforeNavigate && typeof nav.loaderId === 'string') expectedLoaderId = nav.loaderId
    if (expectedLoaderId && loadedLoaderIds.has(expectedLoaderId)) {
      loadSeen = true
      loadTime = Date.now()
    }
    while (!loadSeen && Date.now() - start < VIEW_LIMIT_MS) {
      if (signal.aborted) throw new ExportError('CANCELLED', 130)
      if (navigationError) throw new ExportError(navigationError, navigationError === 'SIZE_LIMIT' ? 2 : 1)
      await abortableDelay(100, signal)
    }
    if (!loadSeen) throw new ExportError('LOAD_TIMEOUT', 2)
    const hasPendingRequests = () => [...currentRequests.values()].some((request) => !request.unknown && !request.document)
    while (!loadSeen || Date.now() < loadTime + Math.max(QUIET_MS, delayMs) || Date.now() - lastRelevant < QUIET_MS || hasPendingRequests() || state.bodyTasks.size > 0) {
      if (signal.aborted) throw new ExportError('CANCELLED', 130)
      if (navigationError) throw new ExportError(navigationError, navigationError === 'SIZE_LIMIT' ? 2 : 1)
      if (Date.now() - start >= VIEW_LIMIT_MS) throw new ExportError('VIEW_TIMEOUT', 2)
      await abortableDelay(100, signal)
    }
    if (navigationError) throw new ExportError(navigationError, navigationError === 'SIZE_LIMIT' ? 2 : 1)
    const snapshot = await captureDom(viewCdp, job)
    collector.recordDom(job.slug, snapshot)
    await abortableDelay(0, signal)
  } catch (error) {
    const code = error instanceof ExportError ? error.code : 'VIEW_FAILED'
    collector.markView(job.slug, 'failed', code)
    if (code === 'SESSION_OR_SCOPE' || code === 'CANCELLED' || code === 'SIZE_LIMIT') throw error instanceof ExportError ? error : new ExportError(code)
    log('VIEW_FAILED', `${job.slug} ${code}`)
  } finally {
    state.activeEpoch = null
    for (const attempt of epochAttempts) collector.failPendingAttempt(attempt.key, 'REQUEST_INCOMPLETE', attempt.order)
    currentRequests.clear()
    for (const unsubscribe of unsubscribers) unsubscribe()
    state.pending.delete(epoch)
    if (!signal.aborted && epochTasks.length) {
      try { await timeout(Promise.allSettled(epochTasks), CLEANUP_COMMAND_MS, 'BODY_TIMEOUT') } catch { bodyDrainFailed = true }
    }
  }
  if (bodyDrainFailed) throw new ExportError('BODY_TIMEOUT', 2)
  const view = collector.views.get(job.slug)
  return { slug: job.slug, status: view.status, code: view.code, domFile: view.domFile }
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function buildZip(files) {
  if (files.length > 0xffff) throw new ExportError('ZIP_LIMIT', 2)
  const localParts = []
  const centralParts = []
  let localOffset = 0
  for (const file of files) {
    const name = Buffer.from(file.filename, 'utf8')
    const data = Buffer.from(file.bytes)
    if (name.length > 0xffff || data.length > MAX_ZIP32 || localOffset > MAX_ZIP32) throw new ExportError('ZIP_LIMIT', 2)
    const crc = crc32(data)
    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    name.copy(local, 30)
    localParts.push(local, data)
    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(0x0314, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE((0o100600 << 16) >>> 0, 38)
    central.writeUInt32LE(localOffset, 42)
    name.copy(central, 46)
    centralParts.push(central)
    localOffset += local.length + data.length
  }
  const centralDirectory = Buffer.concat(centralParts)
  if (localOffset + centralDirectory.length + 22 > MAX_ZIP32) throw new ExportError('ZIP_LIMIT', 2)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(localOffset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...localParts, centralDirectory, end])
}

async function acquireOutputScope(options) {
  await mkdir(privateDirectory, { recursive: true, mode: 0o700 })
  const stat = await lstat(privateDirectory)
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new ExportError('OUTPUT_DIRECTORY')
  const resolved = await realpath(privateDirectory)
  if (!resolved.startsWith(`${projectDirectory}${path.sep}`)) throw new ExportError('OUTPUT_DIRECTORY')
  if (process.platform !== 'win32') await chmod(resolved, 0o700).catch(() => { throw new ExportError('OUTPUT_PERMISSIONS') })
  const lockPath = path.join(resolved, '.sum-export.lock')
  let lock
  try { lock = await open(lockPath, 'wx', 0o600) } catch { throw new ExportError('EXPORT_LOCK') }
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const filename = options.output ?? `sum-all-json-${timestamp}.zip`
  const outputPath = path.join(resolved, filename)
  let lockIdentity
  try { lockIdentity = await lock.stat() } catch {
    await lock.close().catch(() => {})
    throw new ExportError('EXPORT_LOCK')
  }
  const scope = { directory: resolved, filename, lockPath, lock, lockIdentity }
  try {
    await lstat(outputPath)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      await releaseOutputScope(scope)
      throw new ExportError('OUTPUT_PATH')
    }
    return scope
  }
  await releaseOutputScope(scope)
  throw new ExportError('OUTPUT_EXISTS')
}

async function releaseOutputScope(scope) {
  if (!scope) return
  await scope.lock.close().catch(() => {})
  const current = await lstat(scope.lockPath).catch(() => null)
  if (current?.isFile() && current.dev === scope.lockIdentity.dev && current.ino === scope.lockIdentity.ino) await unlink(scope.lockPath).catch(() => {})
}

async function saveArchive(archive, outputScope, signal) {
  const directoryStat = await lstat(outputScope.directory).catch(() => null)
  if (!directoryStat?.isDirectory() || directoryStat.isSymbolicLink()) throw new ExportError('OUTPUT_DIRECTORY')
  const resolved = await realpath(outputScope.directory).catch(() => '')
  if (resolved !== outputScope.directory || !resolved.startsWith(`${projectDirectory}${path.sep}`)) throw new ExportError('OUTPUT_DIRECTORY')
  let outputPath
  let created = false
  let outputIdentity
  try {
    if (signal.aborted) throw new ExportError('CANCELLED', 130)
    outputPath = path.join(resolved, outputScope.filename)
    const output = await open(outputPath, 'wx', 0o600)
    created = true
    outputIdentity = await output.stat()
    try {
      await output.writeFile(archive)
      await output.sync()
    } finally {
      await output.close()
    }
    if (signal.aborted) throw new ExportError('CANCELLED', 130)
    return outputScope.filename
  } catch (error) {
    if (created && outputPath && outputIdentity) {
      const current = await lstat(outputPath).catch(() => null)
      if (current?.isFile() && current.dev === outputIdentity.dev && current.ino === outputIdentity.ino) await unlink(outputPath).catch(() => {})
    }
    if (error instanceof ExportError && error.code === 'CANCELLED') throw error
    throw new ExportError('OUTPUT_WRITE')
  }
}

async function cleanup(cdp, domains) {
  if (!cdp) return
  if (cleanedConnections.has(cdp)) return
  cleanedConnections.add(cdp)
  const commands = []
  if (domains.skipAllPauses) commands.push(['Debugger.setSkipAllPauses', { skip: false }])
  if (domains.debugger) commands.push(['Debugger.disable', {}])
  if (domains.network) commands.push(['Network.disable', {}])
  if (domains.page) commands.push(['Page.disable', {}])
  if (domains.runtime) commands.push(['Runtime.disable', {}])
  for (const [method, params] of commands) {
    try { await cdp.send(method, params, CLEANUP_COMMAND_MS) } catch { log('CLEANUP_COMMAND_FAILED', method) }
  }
  await cdp.close().catch(() => log('CLEANUP_SOCKET_FAILED'))
}

async function main() {
  let options
  try {
    options = parseOptions(process.argv.slice(2))
  } catch (error) {
    log(error.code ?? 'CLI_ARGUMENT')
    return error.exitCode ?? 1
  }
  if (options.help) {
    printUsage()
    return 0
  }
  const abortController = new AbortController()
  const abort = () => abortController.abort()
  process.once('SIGINT', abort)
  process.once('SIGTERM', abort)
  let cdp
  const domains = { page: false, runtime: false, network: false, debugger: false, skipAllPauses: false }
  let collector
  let archiveSaved = false
  let outputScope
  let initialStability
  try {
    if (typeof fetch !== 'function' || typeof WebSocket !== 'function') throw new ExportError('NODE_API_UNAVAILABLE')
    outputScope = await acquireOutputScope(options)
    if (abortController.signal.aborted) throw new ExportError('CANCELLED', 130)
    const target = await selectTarget(options, abortController.signal)
    log('TARGET_SELECTED', 'valid-page')
    if (abortController.signal.aborted) throw new ExportError('CANCELLED', 130)
    cdp = await connectCdp(target)
    if (abortController.signal.aborted) throw new ExportError('CANCELLED', 130)
    domains.page = true
    await cdp.send('Page.enable')
    domains.runtime = true
    await cdp.send('Runtime.enable')
    domains.network = true
    await cdp.send('Network.enable', { maxTotalBufferSize: 52428800, maxResourceBufferSize: 10485760, maxPostDataSize: 65536 })
    await cdp.send('Page.setLifecycleEventsEnabled', { enabled: true })
    const frameTree = await cdp.send('Page.getFrameTree')
    const mainFrameId = frameTree?.frameTree?.frame?.id
    if (!mainFrameId) throw new ExportError('CDP_FRAME')
    initialStability = watchInitialStability(cdp, mainFrameId, target.initialPath)
    domains.debugger = true
    await cdp.send('Debugger.enable')
    domains.skipAllPauses = true
    await cdp.send('Debugger.setSkipAllPauses', { skip: true })
    await cdp.send('Debugger.resume').catch((error) => { if (error.code !== 'DEBUGGER_NOT_PAUSED') throw error })
    await initialStability.wait(abortController.signal)
    initialStability.close()
    initialStability = undefined
    const state = { epoch: 0, currentPath: target.initialPath, mainFrameId, pending: new Map(), bodyTasks: new Set(), activeEpoch: null }
    collector = makeCollector()
    log('START', 'views=16 queries=12')
    let partial = false
    for (let index = 0; index < viewJobs.length; index += 1) {
      const job = viewJobs[index]
      if (abortController.signal.aborted) throw new ExportError('CANCELLED', 130)
      log('VIEW', `${index + 1}/16 ${job.slug}`)
      try { await visitView(cdp, job, collector, abortController.signal, options.delayMs, state) }
      catch (error) {
        partial = true
        if (error instanceof ExportError && ['CANCELLED', 'SESSION_OR_SCOPE'].includes(error.code)) throw error
        if (error instanceof ExportError && ['SIZE_LIMIT', 'BODY_TIMEOUT'].includes(error.code)) {
          collector.markView(job.slug, 'failed', error.code)
          break
        }
        collector.markView(job.slug, 'failed', error.code ?? 'VIEW_FAILED')
      }
      await abortableDelay(options.delayMs, abortController.signal)
    }
    const bundle = collector.finish()
    partial ||= bundle.manifest.missing.length > 0
    const zip = buildZip(bundle.files)
    const filename = await saveArchive(zip, outputScope, abortController.signal)
    archiveSaved = true
    log('ARCHIVE_SAVED', filename)
    for (const entry of bundle.manifest.missing) log('MISSING', entry)
    log('COVERAGE', `views=${bundle.manifest.views.filter((entry) => entry.status === 'captured').length}/16 queries=${bundle.manifest.queries.filter((entry) => entry.status === 'captured').length}/12 unknown=${bundle.manifest.unknownJsonRequests}`)
    return partial ? 2 : 0
  } catch (error) {
    const code = error instanceof ExportError ? error.code : 'EXPORT_FAILED'
    if (code === 'CANCELLED') {
      log('CANCELLED', 'no-archive-written')
      return 130
    }
    log(code)
    if (archiveSaved) return 2
    return error instanceof ExportError ? error.exitCode : 1
  } finally {
    initialStability?.close()
    await cleanup(cdp, domains)
    await releaseOutputScope(outputScope)
    process.removeListener('SIGINT', abort)
    process.removeListener('SIGTERM', abort)
    if (collector && !archiveSaved && abortController.signal.aborted) log('CANCELLED', 'no-archive-written')
  }
}

process.exitCode = await main()

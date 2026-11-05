import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, parse, resolve, sep } from 'node:path'

export const savedDraftFileLimit = 2 * 1024 * 1024
export const savedDraftCountLimit = 50

export type PersistedDraft = {
  schemaVersion: 1
  catalogFingerprint: string
  document: unknown
  retained: unknown
}

export class SavedDraftStoreError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
    : JSON.stringify(value) ?? 'undefined'

const checksum = (payload: unknown): string => createHash('sha256').update(canonical(payload)).digest('hex')
const safeUuid = (id: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)

export class SavedDraftStore<T = PersistedDraft> {
  private queue: Promise<void> = Promise.resolve()
  private readonly directory: string | null

  constructor(directory = process.env.SUM_ACADEMIC_DRAFT_DIR, private readonly rename = renameSync) {
    this.directory = directory?.trim() ? resolve(directory) : null
  }

  get configured(): boolean { return this.directory !== null }

  exclusive<T>(operation: () => T | Promise<T>): Promise<T> {
    const current = this.queue.then(operation, operation)
    this.queue = current.then(() => undefined, () => undefined)
    return current
  }

  list(): Array<{ id: string, payload: T | null }> {
    const root = this.root()
    const results: Array<{ id: string, payload: T | null }> = []
    let entries: string[]
    try { entries = readdirSync(root) } catch { throw this.ioError() }
    for (const entry of entries.filter((name) => name.endsWith('.json'))) {
      const id = entry.slice(0, -5)
      if (!safeUuid(id)) { results.push({ id: '', payload: null }); continue }
      try { results.push({ id, payload: this.read(id) }) }
      catch (error) {
        if (!(error instanceof SavedDraftStoreError) || error.status !== 409) throw error
        results.push({ id, payload: null })
      }
    }
    return results
  }

  read(id: string): T | null {
    if (!safeUuid(id)) return null
    const root = this.root()
    const file = join(root, `${id}.json`)
    try {
      const stat = lstatSync(file)
      if (stat.isSymbolicLink() || !stat.isFile() || stat.size > savedDraftFileLimit) throw new SavedDraftStoreError(409, 'DRAFT_CORRUPT', 'El archivo de propuesta no superó la validación')
      const envelope = JSON.parse(readFileSync(file, 'utf8')) as { payload?: unknown, checksum?: unknown }
      if (!envelope || typeof envelope !== 'object' || Object.keys(envelope).sort().join(',') !== 'checksum,payload'
        || typeof envelope.checksum !== 'string' || !/^[0-9a-f]{64}$/.test(envelope.checksum) || !('payload' in envelope)) {
        throw new SavedDraftStoreError(409, 'DRAFT_CORRUPT', 'El archivo de propuesta no superó la validación')
      }
      const expected = Buffer.from(checksum(envelope.payload), 'hex')
      const actual = Buffer.from(envelope.checksum, 'hex')
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new SavedDraftStoreError(409, 'DRAFT_CORRUPT', 'El archivo de propuesta no superó la validación')
      return envelope.payload as T
    } catch (error) {
      if (isMissing(error)) return null
      if (error instanceof SyntaxError) throw new SavedDraftStoreError(409, 'DRAFT_CORRUPT', 'El archivo de propuesta no superó la validación')
      if (error instanceof SavedDraftStoreError) throw error
      throw this.ioError()
    }
  }

  write(id: string, payload: T): void {
    if (!safeUuid(id)) throw new SavedDraftStoreError(400, 'INVALID_DRAFT_ID', 'Identificador de propuesta inválido')
    const root = this.root()
    const target = join(root, `${id}.json`)
    const temp = join(root, `.${randomUUID()}.tmp`)
    const encoded = JSON.stringify({ payload, checksum: checksum(payload) })
    if (Buffer.byteLength(encoded, 'utf8') > savedDraftFileLimit) throw new SavedDraftStoreError(413, 'DRAFT_TOO_LARGE', 'La propuesta supera el tamaño permitido')
    let descriptor: number | undefined
    try {
      try {
        const current = lstatSync(target)
        if (current.isSymbolicLink() || !current.isFile()) throw new SavedDraftStoreError(409, 'DRAFT_CORRUPT', 'El archivo de propuesta no es regular')
      } catch (error) { if (!isMissing(error)) throw error }
      descriptor = openSync(temp, 'wx', 0o600)
      writeFileSync(descriptor, encoded, 'utf8')
      fsyncSync(descriptor)
      closeSync(descriptor)
      descriptor = undefined
      this.rename(temp, target)
    } catch (error) {
      if (descriptor !== undefined) { try { closeSync(descriptor) } catch { /* ignored */ } }
      try { unlinkSync(temp) } catch { /* ignored */ }
      if (error instanceof SavedDraftStoreError) throw error
      throw this.ioError()
    }
  }

  private root(): string {
    if (!this.directory) throw new SavedDraftStoreError(503, 'DRAFT_PERSISTENCE_UNAVAILABLE', 'La persistencia de propuestas no está configurada')
    try {
      this.assertNoSymlinkPath(this.directory, true)
      if (!existsSync(this.directory)) mkdirSync(this.directory, { recursive: true, mode: 0o700 })
      this.assertNoSymlinkPath(this.directory)
      const stat = lstatSync(this.directory)
      if (!stat.isDirectory() || !isAbsolute(this.directory)) throw this.ioError()
      const canonicalPath = resolve(this.directory)
      if (!canonicalPath.endsWith(sep) && canonicalPath !== this.directory) throw this.ioError()
      return canonicalPath
    } catch (error) {
      if (error instanceof SavedDraftStoreError) throw error
      throw this.ioError()
    }
  }

  private ioError(): SavedDraftStoreError {
    return new SavedDraftStoreError(503, 'DRAFT_STORAGE_ERROR', 'No se pudo acceder al almacenamiento local de propuestas')
  }

  private assertNoSymlinkPath(path: string, allowMissing = false): void {
    const parsed = parse(path)
    let current = parsed.root
    for (const segment of path.slice(parsed.root.length).split(sep).filter(Boolean)) {
      current = join(current, segment)
      let stat
      try { stat = lstatSync(current) }
      catch (error) {
        if (allowMissing && isMissing(error)) break
        throw error
      }
      if (stat.isSymbolicLink()) throw this.ioError()
    }
  }
}

function isMissing(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
}

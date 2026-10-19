import {
  validateActorId,
  validateChoice,
  validateSubmissionRequest,
} from '../../../shared/matricula-regular.mjs'
import type {
  MatriculaRegularChoice,
  MatriculaRegularId,
  MatriculaRegularOutcome,
  MatriculaRegularSubmission,
  MatriculaRegularUuid,
} from '../../../shared/matricula-regular.mjs'
import { MatriculaRegularApiError } from './matriculaRegular.ts'
import type { createMatriculaRegularApi } from './matriculaRegular.ts'

/**
 * Local-only submission identity + recovery (MR-CONTRACT-2, T038/T043).
 * The browser keeps ONLY {runId, actorId, requestId, profileRevision, selection} of an in-progress
 * synthetic request. Never an Outcome, report, enrollmentId, sessionId or credential.
 */

export const INTENT_KEY_PREFIX = 'mr:intent:'

export type PendingIntent = Readonly<{
  runId: MatriculaRegularUuid
  actorId: MatriculaRegularId
  requestId: MatriculaRegularUuid
  profileRevision: string
  selection: readonly MatriculaRegularChoice[]
}>

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
type RecoveryApi = Pick<ReturnType<typeof createMatriculaRegularApi>, 'submit' | 'getResult'>

export type UncertainReason = 'network' | 'aborted' | 'protocol' | 'local-failure' | 'http-unrecognized' | 'uncorrelated'

export type SubmitResult =
  | { kind: 'outcome'; outcome: MatriculaRegularOutcome }
  | { kind: 'definitive'; code: string; status: number; fields: readonly string[] }
  | { kind: 'run-changed' }
  | { kind: 'conflict' }
  | { kind: 'uncertain'; reason: UncertainReason }

export type SubmitAttempt = { intent: PendingIntent; persisted: boolean; result: SubmitResult }

export type ConsultResult =
  | { kind: 'known'; outcome: MatriculaRegularOutcome }
  | { kind: 'unknown' }
  | { kind: 'run-changed' }
  | { kind: 'error'; reason: UncertainReason }

export type RestoreResult =
  | { kind: 'none' }
  | { kind: 'restored'; intent: PendingIntent }
  | { kind: 'reset'; staleRunIds: readonly MatriculaRegularUuid[] }

// HTTP codes that prove the server did NOT register this identity; they are not academic rejections.
const DEFINITIVE_CODES = new Set([
  'INVALID_REQUEST', 'ACTOR_NOT_FOUND', 'CHOICE_NOT_FOUND', 'SESSION_NOT_FOUND',
  'PROFILE_CHANGED', 'SESSION_EXPIRED', 'SESSION_CONTEXT_MISMATCH',
])
const PLACEHOLDER_SESSION_ID = '00000000-0000-4000-8000-000000000000'
const INTENT_KEYS = ['runId', 'actorId', 'requestId', 'profileRevision', 'selection']

export function intentStorageKey(runId: MatriculaRegularUuid, actorId: MatriculaRegularId): string {
  return `${INTENT_KEY_PREFIX}${runId}:${actorId}`
}

/** Canonical order (courseId, sectionId); returns a new frozen array and never mutates the input. */
export function canonicalSelection(selection: readonly MatriculaRegularChoice[]): readonly MatriculaRegularChoice[] {
  const copy = selection.map((choice) => {
    validateChoice(choice)
    return Object.freeze({ courseId: choice.courseId, sectionId: choice.sectionId })
  })
  copy.sort((a, b) => compareText(a.courseId, b.courseId) || compareText(a.sectionId, b.sectionId))
  return Object.freeze(copy)
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Builds the immutable identity+payload for one attempt. Validates it with the real wire validator. */
export function createIntent(
  input: {
    runId: MatriculaRegularUuid
    actorId: MatriculaRegularId
    profileRevision: string
    selection: readonly MatriculaRegularChoice[]
  },
  newRequestId: () => string = () => globalThis.crypto.randomUUID(),
): PendingIntent {
  const intent: PendingIntent = Object.freeze({
    runId: input.runId,
    actorId: input.actorId,
    requestId: newRequestId(),
    profileRevision: input.profileRevision,
    selection: canonicalSelection(input.selection),
  })
  validateSubmissionRequest(toSubmission(intent, PLACEHOLDER_SESSION_ID))
  return intent
}

function toSubmission(intent: PendingIntent, sessionId: MatriculaRegularUuid): MatriculaRegularSubmission {
  return {
    runId: intent.runId,
    actorId: intent.actorId,
    sessionId,
    requestId: intent.requestId,
    profileRevision: intent.profileRevision,
    selection: intent.selection.map((choice) => ({ ...choice })),
  }
}

/** The Outcome must belong to this attempt before it can be presented as a result. */
export function outcomeMatchesIntent(intent: PendingIntent, outcome: MatriculaRegularOutcome): boolean {
  return outcome.requestId === intent.requestId
    && outcome.actorId === intent.actorId
    && outcome.profileRevision === intent.profileRevision
    && outcome.selection.length === intent.selection.length
    && outcome.selection.every((choice, index) => {
      const expected = intent.selection[index]!
      return choice.courseId === expected.courseId && choice.sectionId === expected.sectionId
    })
}

/** Maps a failed MR-SUBMIT to a client state. Only structured fields are read; never messages. */
export function classifySubmitError(error: unknown): SubmitResult {
  if (!(error instanceof MatriculaRegularApiError)) return { kind: 'uncertain', reason: 'protocol' }
  if (error.kind === 'network') return { kind: 'uncertain', reason: 'network' }
  if (error.kind === 'aborted') return { kind: 'uncertain', reason: 'aborted' }
  if (error.kind !== 'http') return { kind: 'uncertain', reason: 'protocol' }
  const code = error.code ?? ''
  if (error.status === 401 || error.status === 403) {
    return { kind: 'definitive', code: 'SESSION_EXPIRED', status: error.status, fields: error.fields }
  }
  if (code === 'RUN_CHANGED') return { kind: 'run-changed' }
  if (code === 'REQUEST_CONFLICT') return { kind: 'conflict' }
  if (code === 'LOCAL_FAILURE') return { kind: 'uncertain', reason: 'local-failure' }
  if (DEFINITIVE_CODES.has(code)) {
    return { kind: 'definitive', code, status: error.status ?? 0, fields: error.fields }
  }
  return { kind: 'uncertain', reason: 'http-unrecognized' }
}

function safely<T>(action: () => T): { ok: true; value: T } | { ok: false } {
  try {
    return { ok: true, value: action() }
  } catch {
    return { ok: false }
  }
}

function persistIntent(storage: KeyValueStorage | null, intent: PendingIntent): boolean {
  if (storage === null) return false
  const stored = {
    runId: intent.runId, actorId: intent.actorId, requestId: intent.requestId,
    profileRevision: intent.profileRevision, selection: intent.selection,
  }
  return safely(() => storage.setItem(intentStorageKey(intent.runId, intent.actorId), JSON.stringify(stored))).ok
}

function clearIntent(storage: KeyValueStorage | null, intent: PendingIntent): void {
  if (storage === null) return
  safely(() => storage.removeItem(intentStorageKey(intent.runId, intent.actorId)))
}

function parseIntent(raw: string, key: string): PendingIntent | null {
  const parsed = safely<unknown>(() => JSON.parse(raw))
  if (!parsed.ok) return null
  const value = parsed.value
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const keys = Object.keys(value)
  if (keys.length !== INTENT_KEYS.length || !INTENT_KEYS.every((name) => keys.includes(name))) return null
  const record = value as Record<string, unknown>
  const candidate = safely(() => createIntent({
    runId: record.runId as string,
    actorId: record.actorId as MatriculaRegularId,
    profileRevision: record.profileRevision as string,
    selection: record.selection as MatriculaRegularChoice[],
  }, () => record.requestId as string))
  if (!candidate.ok) return null
  const intent = candidate.value
  return key === intentStorageKey(intent.runId, intent.actorId) ? intent : null
}

/**
 * Reads this actor's recoverable intent. An intent from another run is cleared (explicit reset, never
 * replayed); other actors' entries are untouched. Unavailable storage restores nothing.
 */
export function restoreIntent(
  storage: KeyValueStorage | null,
  scope: { runId: MatriculaRegularUuid; actorId: MatriculaRegularId },
): RestoreResult {
  if (storage === null) return { kind: 'none' }
  const listed = safely(() => {
    validateActorId(scope.actorId)
    const keys: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key !== null && key.startsWith(INTENT_KEY_PREFIX) && key.endsWith(`:${scope.actorId}`)) keys.push(key)
    }
    return keys
  })
  if (!listed.ok) return { kind: 'none' }

  let current: PendingIntent | null = null
  const staleRunIds: MatriculaRegularUuid[] = []
  for (const key of listed.value) {
    const raw = safely(() => storage.getItem(key))
    const intent = raw.ok && raw.value !== null ? parseIntent(raw.value, key) : null
    if (intent === null) {
      safely(() => storage.removeItem(key))
    } else if (intent.runId === scope.runId) {
      current = intent
    } else {
      staleRunIds.push(intent.runId)
      safely(() => storage.removeItem(key))
    }
  }
  if (current !== null) return { kind: 'restored', intent: current }
  return staleRunIds.length > 0 ? { kind: 'reset', staleRunIds } : { kind: 'none' }
}

/**
 * Submission/recovery orchestration without React: single-flight lock, identity persisted before the POST,
 * no automatic replay, no polling. Replays and consults are explicit user actions.
 */
export function createSubmissionFlow(deps: {
  api: RecoveryApi
  storage: KeyValueStorage | null
  newRequestId?: () => string
}) {
  let inFlight: Promise<SubmitAttempt> | null = null

  async function send(intent: PendingIntent, persisted: boolean, sessionId: MatriculaRegularUuid, signal?: AbortSignal): Promise<SubmitAttempt> {
    let result: SubmitResult
    try {
      const outcome = await deps.api.submit(toSubmission(intent, sessionId), { signal })
      result = outcomeMatchesIntent(intent, outcome)
        ? { kind: 'outcome', outcome }
        : { kind: 'uncertain', reason: 'uncorrelated' }
    } catch (error) {
      result = classifySubmitError(error)
    }
    if (result.kind === 'outcome' || result.kind === 'definitive' || result.kind === 'run-changed') {
      clearIntent(deps.storage, intent)
    }
    return { intent, persisted, result }
  }

  function guarded(start: () => Promise<SubmitAttempt>): Promise<SubmitAttempt> {
    if (inFlight !== null) return inFlight
    const attempt = start().finally(() => { inFlight = null })
    inFlight = attempt
    return attempt
  }

  return {
    isBusy: () => inFlight !== null,

    /** New attempt: identity and canonical selection fixed and stored BEFORE the first POST. */
    submit(input: {
      runId: MatriculaRegularUuid
      actorId: MatriculaRegularId
      sessionId: MatriculaRegularUuid
      profileRevision: string
      selection: readonly MatriculaRegularChoice[]
      signal?: AbortSignal
    }): Promise<SubmitAttempt> {
      return guarded(async () => {
        const intent = createIntent(input, deps.newRequestId)
        const persisted = persistIntent(deps.storage, intent)
        return send(intent, persisted, input.sessionId, input.signal)
      })
    },

    /** Manual replay of the same identity and payload; only the session may be a fresh one. */
    replay(input: { intent: PendingIntent; sessionId: MatriculaRegularUuid; signal?: AbortSignal }): Promise<SubmitAttempt> {
      return guarded(() => send(input.intent, true, input.sessionId, input.signal))
    },

    /** Read-only lookup of the identity result (needs no session). `unknown` keeps the identity. */
    async consult(input: { intent: PendingIntent; signal?: AbortSignal }): Promise<ConsultResult> {
      const { intent } = input
      try {
        const lookup = await deps.api.getResult(
          { runId: intent.runId, actorId: intent.actorId, requestId: intent.requestId },
          { signal: input.signal },
        )
        if (lookup.state === 'unknown') return { kind: 'unknown' }
        if (lookup.outcome === null || !outcomeMatchesIntent(intent, lookup.outcome)) {
          return { kind: 'error', reason: 'uncorrelated' }
        }
        clearIntent(deps.storage, intent)
        return { kind: 'known', outcome: lookup.outcome }
      } catch (error) {
        const classified = classifySubmitError(error)
        if (classified.kind === 'run-changed') {
          clearIntent(deps.storage, intent)
          return { kind: 'run-changed' }
        }
        return { kind: 'error', reason: classified.kind === 'uncertain' ? classified.reason : 'http-unrecognized' }
      }
    },
  }
}

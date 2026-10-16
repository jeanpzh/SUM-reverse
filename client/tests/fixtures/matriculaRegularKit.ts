import type {
  MatriculaRegularChoice,
  MatriculaRegularContext,
  MatriculaRegularId,
  MatriculaRegularEnrollmentReport,
  MatriculaRegularOutcome,
  MatriculaRegularSubmission,
  MatriculaRegularUuid,
} from '../../../shared/matricula-regular.mjs'

// Independent synthetic identities for client-side recovery/report tests (no AppModule, no snapshots).
export const runId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000001'
export const otherRunId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000099'
export const sessionId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000002'
export const newSessionId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000012'
export const requestId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000003'
export const enrollmentId: MatriculaRegularUuid = '00000000-0000-4000-8000-000000000004'
export const actorSis: MatriculaRegularId = 'SYN-SIS-A'
export const actorSoft: MatriculaRegularId = 'SYN-SOFT-A'
export const revisionSis = 'MR-SYN-SIS-1'
export const revisionSoft = 'MR-SYN-SOFT-1'
export const evaluatedAt = '2026-08-11T15:00:00.000Z'

// Deliberately NOT in canonical order to prove canonicalisation.
export const unorderedSelectionSis: MatriculaRegularChoice[] = [
  { courseId: 'SYN-SIS-C2', sectionId: 'SYN-SIS-S2' },
  { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
]
export const canonicalSelectionSis: MatriculaRegularChoice[] = [
  { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
  { courseId: 'SYN-SIS-C2', sectionId: 'SYN-SIS-S2' },
]
export const selectionSoft: MatriculaRegularChoice[] = [
  { courseId: 'SYN-SOFT-C1', sectionId: 'SYN-SOFT-S1' },
]

export function submission(overrides: Partial<MatriculaRegularSubmission> = {}): MatriculaRegularSubmission {
  return {
    runId, actorId: actorSis, sessionId, requestId, profileRevision: revisionSis,
    selection: canonicalSelectionSis, ...overrides,
  }
}

export function acceptedOutcome(overrides: Partial<MatriculaRegularOutcome> = {}): MatriculaRegularOutcome {
  return {
    requestId, actorId: actorSis, profileRevision: revisionSis, state: 'accepted', evaluatedAt,
    windowOrigin: 'synthetic', selection: canonicalSelectionSis, causes: [], gaps: [], enrollmentId,
    reportPath: `/local/matricula-regular/v1/reportes/${enrollmentId}`, ...overrides,
  }
}

export function rejectedOutcome(overrides: Partial<MatriculaRegularOutcome> = {}): MatriculaRegularOutcome {
  return acceptedOutcome({
    state: 'rejected', enrollmentId: null, reportPath: null,
    causes: [{ code: 'SCHEDULE_CONFLICT', courseIds: ['SYN-SIS-C1', 'SYN-SIS-C2'], sectionIds: ['SYN-SIS-S1', 'SYN-SIS-S2'], sourceIds: ['L-01'] }],
    ...overrides,
  })
}

export function pendingOutcome(overrides: Partial<MatriculaRegularOutcome> = {}): MatriculaRegularOutcome {
  return acceptedOutcome({
    state: 'configuration-pending', windowOrigin: null, enrollmentId: null, reportPath: null,
    gaps: [{ code: 'PLAN_OR_OFFER_UNKNOWN', courseIds: ['SYN-SIS-C1'], sourceIds: ['L-01'] }],
    ...overrides,
  })
}

export function enrollmentReport(overrides: Partial<MatriculaRegularEnrollmentReport> = {}): MatriculaRegularEnrollmentReport {
  return {
    enrollmentId, requestId, actorId: actorSis,
    scope: { facultyId: 'FISI', schoolId: 'SISTEMAS', period: '2026-II', planId: 'SYN-PLAN-SIS', modality: 'regular-virtual' },
    profileRevision: revisionSis, acceptedAt: evaluatedAt, windowOrigin: 'synthetic',
    rows: [
      { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1', planId: 'SYN-PLAN-SIS', name: 'Curso sintético 1', credits: 4,
        schedule: [{ day: 1, startMinute: 480, endMinute: 600 }, { day: 3, startMinute: 480, endMinute: 540 }] },
      { courseId: 'SYN-SIS-C2', sectionId: 'SYN-SIS-S2', planId: 'SYN-PLAN-SIS', name: 'Curso, "sintético" 2', credits: 3,
        schedule: [{ day: 2, startMinute: 600, endMinute: 720 }] },
    ],
    totalCredits: 7, ...overrides,
  }
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export function errorResponse(status: number, code: string, bodyRunId: string = runId, fields: string[] = []): Response {
  return jsonResponse(status, { runId: bodyRunId, error: { code, fields } })
}

export type RecordedCall = { url: string; method: string; body: unknown; order: number }

/** Records every fetch call with a shared sequence counter, then delegates to the supplied handler. */
export function recordingFetch(
  handler: (call: RecordedCall, index: number) => Response | Promise<Response>,
  sequence: { next: () => number } = counter(),
): { fetchImpl: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const call: RecordedCall = {
      url: String(input), method: init?.method ?? 'GET', order: sequence.next(),
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    }
    calls.push(call)
    return handler(call, calls.length - 1)
  }
  return { fetchImpl, calls }
}

export function counter(): { next: () => number } {
  let value = 0
  return { next: () => (value += 1) }
}

/** In-memory Storage double with a shared operation log, failure injection and key enumeration. */
export function fakeStorage(options: {
  failSet?: boolean
  failGet?: boolean
  sequence?: { next: () => number }
  seed?: Record<string, string>
} = {}) {
  const map = new Map<string, string>(Object.entries(options.seed ?? {}))
  const sequence = options.sequence ?? counter()
  const log: { op: 'set' | 'remove'; key: string; order: number }[] = []
  const storage = {
    get length() { return map.size },
    key(index: number) { return [...map.keys()][index] ?? null },
    getItem(key: string) {
      if (options.failGet) throw new DOMException('blocked', 'SecurityError')
      return map.get(key) ?? null
    },
    setItem(key: string, value: string) {
      if (options.failSet) throw new DOMException('quota', 'QuotaExceededError')
      log.push({ op: 'set', key, order: sequence.next() })
      map.set(key, value)
    },
    removeItem(key: string) {
      log.push({ op: 'remove', key, order: sequence.next() })
      map.delete(key)
    },
  }
  return { storage, map, log }
}

/** MR-CONTRACT-2 context for SYN-SIS-A with two offered courses; MR-CONTRACT-3 fields come only from overrides. */
export function syntheticContext(overrides: Partial<MatriculaRegularContext> = {}): MatriculaRegularContext {
  const planId = 'SYN-SIS-PLAN'
  return {
    actorId: actorSis,
    scope: { facultyId: 'FISI', schoolId: 'SISTEMAS', period: '2026-II', planId, modality: 'regular-virtual' },
    profileRevision: revisionSis,
    serverNow: '2026-08-11T14:00:00.000Z',
    preEnrollmentEnabled: true,
    preEnrollmentComplete: true,
    preEnrollment: [
      { courseId: 'SYN-SIS-C1', planId, name: 'Asignatura sintética 1', credits: 4 },
      { courseId: 'SYN-SIS-C2', planId, name: 'Asignatura sintética 2', credits: 3 },
    ],
    offerKnown: true,
    offer: [
      { courseId: 'SYN-SIS-C1', planId, name: 'Asignatura sintética 1', credits: 4, prerequisiteIds: [],
        sections: [{ sectionId: 'SYN-SIS-S1', capacity: 1, occupied: 0, schedule: [{ day: 1, startMinute: 480, endMinute: 540 }] }] },
      { courseId: 'SYN-SIS-C2', planId, name: 'Asignatura sintética 2', credits: 3, prerequisiteIds: [],
        sections: [{ sectionId: 'SYN-SIS-S2', capacity: 2, occupied: 2, schedule: null }] },
    ],
    calendar: { publishedRows: [], effectiveWindows: [], unknownDates: [] },
    eligibility: { state: 'eligible', windowId: null, windowOrigin: null, causes: [], gaps: [] },
    sources: [],
    ...overrides,
  }
}

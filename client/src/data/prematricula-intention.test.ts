import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchIntentionContext, fetchIntentionDemand, registerIntention } from './prematricula-intention.ts'

const identity = { runId: '10000000-0000-4000-8000-000000000001', actorId: 'SYN-SIS-A' as const, sessionId: '10000000-0000-4000-8000-000000000002' }
const draftId = '10000000-0000-4000-8000-000000000003'
const publicationId = '10000000-0000-4000-8000-000000000004'
const academicRevision = 'a'.repeat(64)
const selection = [{ courseId: 'CS101', sectionId: 'CS101-01' }]

function response(value: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => value } as Response
}

function mockFetch(value: unknown, status = 200, inspect?: (url: string, init?: RequestInit) => void): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    inspect?.(String(input), init)
    return response(value, status)
  }) as typeof fetch
}

function validContext() {
  return { revision: 'E2-INTENT-1', actorId: identity.actorId, academicRevision, draftId, draftVersion: 1,
    intention: { revision: 'E2-INTENT-1', draftId, actorId: identity.actorId, sourceId: 'regular-SISTEMAS-v1', schoolId: 'SISTEMAS',
      planId: 'SYN-SIS-PLAN', academicPeriod: '2027-I', version: 1,
      history: [{ version: 1, draftVersion: 1, publicationId, publicationVersion: 7, academicRevision, selection,
        registeredAt: '2026-11-04T10:00:00.000Z' }] },
    validation: { actorId: identity.actorId, publicationId, publicationVersion: 7, academicRevision, selection,
      credits: 3, courseCount: 1, status: 'valid', issues: [] } }
}

test('fetches only the current profile intention context and validates its actor', async () => {
  const value = { revision: 'E2-INTENT-1', actorId: identity.actorId, academicRevision, draftId: null, draftVersion: null, intention: null, validation: null }
  let body: unknown
  const result = await fetchIntentionContext(identity, mockFetch(value, 200, (url, init) => {
    assert.equal(url, '/api/local/prematricula/v1/intencion/contexto')
    body = JSON.parse(String(init?.body))
  }))
  assert.equal(result.intention, null)
  assert.deepEqual(body, { identity })
  await assert.rejects(fetchIntentionContext(identity, mockFetch({ ...value, actorId: 'SYN-SIS-B' })), /otro perfil/)
})

test('registers from saved references and correlates the returned version', async () => {
  const value = validContext()
  let body: Record<string, unknown> | undefined
  const result = await registerIntention(identity, { draftId, expectedDraftVersion: 1, expectedIntentionVersion: null, expectedAcademicRevision: academicRevision },
    mockFetch(value, 200, (_url, init) => { body = JSON.parse(String(init?.body)) as Record<string, unknown> }))
  assert.deepEqual(body, { identity, draftId, expectedDraftVersion: 1, expectedIntentionVersion: null, expectedAcademicRevision: academicRevision })
  assert.equal(result.intention?.version, 1)
  await assert.rejects(registerIntention(identity, { draftId, expectedDraftVersion: 1, expectedIntentionVersion: null, expectedAcademicRevision: academicRevision },
    mockFetch({ ...value, draftVersion: 2 })), /no corresponde/)
  await assert.rejects(registerIntention(identity, { draftId, expectedDraftVersion: 2, expectedIntentionVersion: null, expectedAcademicRevision: academicRevision },
    mockFetch({ ...value, draftVersion: 2 })), /no corresponde/)
  await assert.rejects(registerIntention(identity, { draftId, expectedDraftVersion: 1, expectedIntentionVersion: null, expectedAcademicRevision: academicRevision },
    mockFetch({ ...value, validation: { ...value.validation, status: 'insufficient', issues: [{ kind: 'insufficient', code: 'UNKNOWN_HISTORY', message: 'Pendiente', courseIds: [], sectionIds: [] }] } })), /no corresponde/)
})

test('surfaces API conflict codes and rejects malformed error envelopes', async () => {
  await assert.rejects(fetchIntentionContext(identity, mockFetch({ error: { code: 'VERSION_MISMATCH', message: 'Conflicto' } }, 409)),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'VERSION_MISMATCH' && 'status' in error && error.status === 409)
  await assert.rejects(fetchIntentionContext(identity, mockFetch({ error: 'bad' }, 409)), /formato inválido/)
})

test('requests aggregate demand without identity and correlates exact publication', async () => {
  const value = { revision: 'E2-DEMAND-1', schoolId: 'SISTEMAS', academicPeriod: '2027-I', publicationId, publicationVersion: 7,
    registeredStudents: 1, countedStudents: 1, excludedStudents: 0,
    courses: [{ courseId: 'CS101', name: 'Fundamentos', students: 1, sections: [{ sectionId: 'CS101-01', capacity: 30, students: 1 }] }] }
  let body: unknown
  const result = await fetchIntentionDemand({ publicationId, publicationVersion: 7 }, mockFetch(value, 200, (url, init) => {
    assert.equal(url, '/api/local/prematricula/v1/demanda')
    body = JSON.parse(String(init?.body))
  }))
  assert.deepEqual(body, { publicationId, publicationVersion: 7 })
  assert.deepEqual(result, value)
  await assert.rejects(fetchIntentionDemand({ publicationId, publicationVersion: 7 }, mockFetch({ ...value, publicationVersion: 8 })), /no corresponde/)
})

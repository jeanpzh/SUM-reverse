import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchIntentionImport } from './prematricula-intention.ts'

const identity = {
  runId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  actorId: 'SYN-SIS-A' as const,
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
}

const validImport = {
  runId: identity.runId,
  actorId: identity.actorId,
  profileRevision: 'MR-SIS-2027-I',
  intention: {
    version: 1,
    publicationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    publicationVersion: 1,
    academicPeriod: '2027-I',
  },
  selection: [{ courseId: 'SYN-COURSE-1', sectionId: 'SYN-SECTION-1' }],
  issues: [],
}

function response(payload: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => payload } as Response
}

test('fetchIntentionImport posts the active E2 identity and returns a validated matching transfer', async () => {
  let url = ''
  let init: RequestInit | undefined
  const result = await fetchIntentionImport(identity, async (input, options) => {
    url = String(input)
    init = options
    return response(validImport)
  })

  assert.equal(url, '/api/local/prematricula/v1/intencion/traslado')
  assert.equal(init?.method, 'POST')
  assert.equal(init?.credentials, 'omit')
  assert.deepEqual(JSON.parse(String(init?.body)), { identity })
  assert.deepEqual(result, validImport)
})

test('fetchIntentionImport rejects malformed or differently correlated responses', async () => {
  await assert.rejects(fetchIntentionImport(identity, async () => response({ ...validImport, selection: 'bad' })))
  await assert.rejects(fetchIntentionImport(identity, async () => response({ ...validImport, actorId: 'SYN-SIS-B' })), /no corresponde/)
})

test('fetchIntentionImport keeps an empty intention result valid and never interprets it as a selection', async () => {
  const empty = { ...validImport, intention: null, selection: [], issues: [] }
  const result = await fetchIntentionImport(identity, async () => response(empty))
  assert.equal(result.intention, null)
  assert.deepEqual(result.selection, [])
})

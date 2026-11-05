import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validatePreEnrollment } from './prematricula.ts'
import type { E2Identity, E2Validation } from './prematricula.ts'

const identity: E2Identity = { runId: '00000000-0000-4000-8000-000000000001', actorId: 'SYN-SIS-A', sessionId: '00000000-0000-4000-8000-000000000002' }
const request = { publicationId: '00000000-0000-4000-8000-000000000003', publicationVersion: 1,
  selection: [{ courseId: '20118091', sectionId: '20118091-A' }] }
const revision = 'a'.repeat(64)

function validResponse(actorId = identity.actorId): E2Validation {
  return { actorId, publicationId: request.publicationId, publicationVersion: request.publicationVersion, academicRevision: revision,
    selection: request.selection, credits: 4, courseCount: 1, status: 'valid', issues: [] }
}

test('E2 validate uses POST JSON identity and accepts only a matching canonical selection', async () => {
  let captured: { url: string; init: RequestInit } | undefined
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = { url: String(input), init: init ?? {} }
    return new Response(JSON.stringify(validResponse()), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  const result = await validatePreEnrollment(identity, request, revision, fetchImpl)
  assert.equal(captured?.url, '/api/local/prematricula/v1/validar')
  assert.equal(captured?.init.method, 'POST')
  assert.equal(JSON.parse(String(captured?.init.body)).identity.actorId, 'SYN-SIS-A')
  assert.deepEqual(result.selection, request.selection)
})

test('E2 validate rejects a well-formed response from a different synthetic actor', async () => {
  const fetchImpl = (async () => new Response(JSON.stringify(validResponse('SYN-SIS-B')), { status: 200 })) as typeof fetch
  await assert.rejects(validatePreEnrollment(identity, request, revision, fetchImpl), /no corresponde al perfil/)
})

test('E2 validate rejects an HTTP error without the exact local error envelope', async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'No disponible', detail: 'unexpected' } }), { status: 403 })) as typeof fetch
  await assert.rejects(validatePreEnrollment(identity, request, revision, fetchImpl), /formato inválido/)
})

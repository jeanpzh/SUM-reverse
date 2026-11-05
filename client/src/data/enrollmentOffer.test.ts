import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OFFER_API } from '../../../shared/enrollment-offer.mjs'
import { activateEnrollmentOffer, EnrollmentOfferApiError, fetchOperationalOffers, parseOperationalRunId } from './enrollmentOffer.ts'

const runId = '10000000-0000-4000-8000-000000000099'
const publicationId = '123e4567-e89b-42d3-a456-426614174000'
const offer = {
  runId, publicationId, publicationVersion: 3, offerVersion: 1, academicPeriod: '2027-I',
  schoolId: 'SISTEMAS', planId: 'SYN-SIS-PLAN', activatedAt: '2026-11-05T12:00:00.000Z',
  clockBase: '2027-03-02T03:30:00.000Z', courseCount: 4, sectionCount: 8,
}
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
})

test('operational run id parser distinguishes an absent legacy query from malformed values', () => {
  assert.deepEqual(parseOperationalRunId(undefined), { runId: null, invalid: false })
  assert.deepEqual(parseOperationalRunId(runId), { runId, invalid: false })
  assert.deepEqual(parseOperationalRunId(''), { runId: null, invalid: true })
  assert.deepEqual(parseOperationalRunId([runId]), { runId: null, invalid: true })
  assert.deepEqual(parseOperationalRunId('not-a-uuid'), { runId: null, invalid: true })
})

test('offers catalog uses the own local API and validates the active offer list', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchMock: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return respond({ activeRunId: runId, items: [offer] })
  }
  assert.deepEqual(await fetchOperationalOffers(fetchMock), { activeRunId: runId, items: [offer] })
  assert.equal(calls[0]?.url, OFFER_API)
  assert.equal(calls[0]?.init?.method, undefined)
  assert.equal(calls[0]?.init?.credentials, 'omit')
  assert.equal(calls[0]?.init?.body, undefined)
  const invalid = async () => fetchOperationalOffers(async () => respond({ activeRunId: null, items: [offer] }))
  await assert.rejects(invalid(), /oferta activa no corresponde/i)
})

test('activation sends exact publication version and active-run CAS, then correlates the returned origin', async () => {
  const request = { publicationId, publicationVersion: 3, expectedActiveRunId: runId }
  let call: { url: string; init?: RequestInit } | undefined
  const response = { offer, reused: false }
  const fetchMock: typeof fetch = async (url, init) => {
    call = { url: String(url), init }
    return respond(response)
  }
  assert.deepEqual(await activateEnrollmentOffer(request, fetchMock), response)
  assert.equal(call?.url, `${OFFER_API}/activar`)
  assert.equal(call?.init?.method, 'POST')
  assert.equal(call?.init?.credentials, 'omit')
  assert.deepEqual(JSON.parse(String(call?.init?.body)), request)

  await assert.rejects(activateEnrollmentOffer({ ...request, publicationVersion: 4 }, async () => respond(response)), /no corresponde/)
  let requests = 0
  await assert.rejects(activateEnrollmentOffer({ ...request, expectedActiveRunId: 'bad' }, async () => {
    requests += 1
    return respond(response)
  }), /UUID v4 canónico minúsculo/i)
  assert.equal(requests, 0)
})

test('activation preserves documented HTTP conflict codes and rejects malformed envelopes', async () => {
  const request = { publicationId, publicationVersion: 3, expectedActiveRunId: null }
  await assert.rejects(activateEnrollmentOffer(request, async () => respond({ error: {
    code: 'ACTIVE_OFFER_CHANGED', message: 'La oferta activa cambió.',
  } }, 409)), (error) => error instanceof EnrollmentOfferApiError
    && error.status === 409 && error.code === 'ACTIVE_OFFER_CHANGED')
  await assert.rejects(activateEnrollmentOffer(request, async () => respond({ error: {
    code: 'ACTIVE_OFFER_CHANGED', message: 'La oferta activa cambió.', extra: true,
  } }, 409)), /formato inválido/)
})

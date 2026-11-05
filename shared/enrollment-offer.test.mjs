import assert from 'node:assert/strict'
import test from 'node:test'
import { validateOfferActivationRequest, validateOfferActivationResponse, validateOperationalOfferCatalog } from './enrollment-offer.mjs'

const runId = '10000000-0000-4000-8000-000000000001'
const publicationId = '20000000-0000-4000-8000-000000000001'
const offer = () => ({ runId, publicationId, publicationVersion: 4, offerVersion: 1,
  academicPeriod: '2027-I', schoolId: 'SISTEMAS', planId: 'SYN-SIS-PLAN',
  activatedAt: '2026-11-05T12:00:00.000Z', clockBase: '2027-03-02T03:30:00.000Z', courseCount: 4, sectionCount: 8 })

test('activation requires an explicit publication version and active-context expectation', () => {
  const request = { publicationId, publicationVersion: 4, expectedActiveRunId: null }
  assert.doesNotThrow(() => validateOfferActivationRequest(request))
  assert.doesNotThrow(() => validateOfferActivationRequest({ ...request, expectedActiveRunId: runId }))
  for (const change of [{ publicationId: 'name' }, { publicationVersion: 0 }, { publicationVersion: 1.5 }, { expectedActiveRunId: '' }, { capacity: 999 }]) {
    assert.throws(() => validateOfferActivationRequest({ ...request, ...change }))
  }
  assert.throws(() => validateOfferActivationRequest({ publicationId, publicationVersion: 4 }))
})

test('operational offers retain exact provenance and reject incompatible scope or malformed timestamps', () => {
  assert.doesNotThrow(() => validateOfferActivationResponse({ offer: offer(), reused: false }))
  for (const change of [{ academicPeriod: '2026-II' }, { planId: 'OTHER' }, { schoolId: 'SOFTWARE' }, { clockBase: '2027-03-02T03:30:00Z' }, { activatedAt: '2026-02-30T00:00:00.000Z' }, { sectionCount: 0 }, { occupied: 3 }]) {
    assert.throws(() => validateOfferActivationResponse({ offer: { ...offer(), ...change }, reused: false }))
  }
  assert.throws(() => validateOfferActivationResponse({ offer: offer(), reused: 'yes' }))
})

test('catalog correlates its active context and rejects duplicate origins, runs and versions', () => {
  assert.doesNotThrow(() => validateOperationalOfferCatalog({ activeRunId: null, items: [] }))
  assert.doesNotThrow(() => validateOperationalOfferCatalog({ activeRunId: runId, items: [offer()] }))
  assert.throws(() => validateOperationalOfferCatalog({ activeRunId: null, items: [offer()] }))
  assert.throws(() => validateOperationalOfferCatalog({ activeRunId: publicationId, items: [offer()] }))
  for (const change of [{}, { runId: publicationId }, { runId: publicationId, publicationId: runId }]) {
    assert.throws(() => validateOperationalOfferCatalog({ activeRunId: runId, items: [offer(), { ...offer(), ...change }] }))
  }
})

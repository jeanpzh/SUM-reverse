import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACADEMIC_API } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicNormativeRequest, AcademicNormativeResponse } from '../../../shared/programacion-academica-api.mjs'
import { fetchAcademicNormativeAdvice, fetchAcademicProposalAdvice } from './academicScheduling.ts'

// Independently authored synthetic responses; no PDF content or operator data.
const request: AcademicNormativeRequest = { question: 'Consulta sintética', facultyId: 'FISI', academicPeriod: '2027-I', asOf: '2026-11-08', teacherType: 'unknown' }
const { question, ...context } = request
const response: AcademicNormativeResponse = { revision: 'PA-NORMATIVE-1', question, context, status: 'not-determined', answer: 'No determinado en este escenario sintético.', retrievalMode: 'lexical-only', citations: [], gaps: ['Falta evidencia sintética'] }
const fakeFetch = (body: unknown): typeof fetch => async () => new Response(JSON.stringify(body))

test('bounded antecedent reaches transport without becoming a response filter', async () => {
  const contextual = { ...request, previousQuestion: 'Pregunta anterior sintética' }
  const result = await fetchAcademicNormativeAdvice(contextual, async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).previousQuestion, contextual.previousQuestion)
    return new Response(JSON.stringify({ ...response, nextStep: 'Revisar el acuerdo sintético.' }))
  })
  assert.equal(result.nextStep, 'Revisar el acuerdo sintético.')
  assert.ok(!('previousQuestion' in result.context))
})

test('normative query posts explicit filters without identity and validates before returning', async () => {
  assert.deepEqual(await fetchAcademicNormativeAdvice(request, async (url, init) => {
    assert.equal(url, `${ACADEMIC_API}/normativa/consultas`)
    assert.equal(init?.method, 'POST')
    assert.equal(init?.credentials, 'omit')
    assert.deepEqual(JSON.parse(String(init?.body)), request)
    return new Response(JSON.stringify(response))
  }), response)
})

test('normative answer must match question and every requested filter', async () => {
  for (const body of [{ ...response, question: 'Otra pregunta' }, ...Object.entries({ facultyId: 'OTRA', academicPeriod: '2026-II', asOf: '2026-11-07', teacherType: 'ordinario' }).map(([key, value]) => ({ ...response, context: { ...context, [key]: value } }))]) {
    await assert.rejects(fetchAcademicNormativeAdvice(request, fakeFetch(body)))
  }
})

test('normative requests reject impossible dates, empty questions and extra fields before transport', async () => {
  for (const body of [{ ...request, asOf: '2026-02-29' }, { ...request, question: ' ' }, { ...request, identity: 'SYN' }]) {
    await assert.rejects(fetchAcademicNormativeAdvice(body, async () => { assert.fail('invalid request reached transport') }))
  }
})

test('normative query rejects old revisions, unsafe citations and transport failures', async () => {
  for (const body of [{ ...response, revision: 'PA-NORMATIVE-0' }, { ...response, citations: [{ url: 'javascript:alert(1)' }] }, { ...response, retrievalMode: 'invented' }]) {
    await assert.rejects(fetchAcademicNormativeAdvice(request, fakeFetch(body)))
  }
  await assert.rejects(fetchAcademicNormativeAdvice(request, async () => { throw new Error('synthetic offline') }), /synthetic offline/)
})

test('normative cancellation rejects even a transport that ignores abort while parsing', async () => {
  const controller = new AbortController()
  await assert.rejects(fetchAcademicNormativeAdvice(request, async (_url, init) => {
    assert.equal(init?.signal, controller.signal)
    controller.abort()
    return new Response(JSON.stringify(response))
  }, controller.signal), { name: 'AbortError' })
})

test('question is trimmed without changing the explicit scope', async () => {
  assert.deepEqual(await fetchAcademicNormativeAdvice({ ...request, question: '  Consulta sintética  ' }, async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).question, 'Consulta sintética')
    return new Response(JSON.stringify(response))
  }), response)
})

test('advisor accepts legacy responses and validates optional automatic normative context', async () => {
  const legacy = { proposalId: 'synthetic', editVersion: 1, source: { mode: 'deterministic-fallback', providerLabel: null }, summary: 'Resumen sintético', bottlenecks: [], recommendations: [] }
  assert.deepEqual(await fetchAcademicProposalAdvice('synthetic', 1, fakeFetch(legacy)), legacy)
  const extended = { ...legacy, normativeContext: response }
  assert.deepEqual(await fetchAcademicProposalAdvice('synthetic', 1, fakeFetch(extended)), extended)
  await assert.rejects(fetchAcademicProposalAdvice('synthetic', 1, fakeFetch({ ...extended, normativeContext: { ...response, revision: 'old' } })))
})

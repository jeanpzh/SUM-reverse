import { describe, it, expect } from 'vitest'
import { queryNormative } from './normative.client.js'

const request = { question: 'carga lectiva', facultyId: 'FISI', academicPeriod: '2026-II', asOf: '2026-11-08', teacherType: 'unknown' }
const result = { revision: 'PA-NORMATIVE-1', question: request.question, context: { facultyId: 'FISI', academicPeriod: request.academicPeriod, asOf: request.asOf, teacherType: request.teacherType }, status: 'not-determined', answer: 'Sin evidencia aplicable.', retrievalMode: 'lexical-only', citations: [], gaps: ['Corpus parcial'] }

describe('normative HTTP client; independent synthetic responses', () => {
  it('validates before sending and rejects caller paths', async () => {
    await expect(queryNormative({ ...request, filePath: '/tmp/synthetic' }, (() => { throw new Error('Must not send') }) as typeof fetch)).rejects.toMatchObject({ status: 400 })
  })
  it('sends only the fixed request to the local Python route', async () => {
    const fetcher = ((url: string, init: RequestInit) => {
      expect(url).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):\d+\/v1\/normative\/query$/)
      expect(JSON.parse(init.body as string)).toEqual(request)
      expect(init.signal).toBeDefined()
      return Promise.resolve(Response.json(result))
    }) as typeof fetch
    expect(await queryNormative(request, fetcher)).toEqual(result)
  })
  it('fails explicitly on network, malformed response and mismatched context', async () => {
    for (const fetcher of [() => Promise.reject(new Error('Synthetic timeout')), () => Promise.resolve(new Response('', { status: 500 })), () => Promise.resolve(Response.json({ ...result, question: 'otra consulta' })), () => Promise.resolve(Response.json({ ...result, approved: true }))]) {
      await expect(queryNormative(request, fetcher as typeof fetch)).rejects.toMatchObject({ status: 502 })
    }
  })
})

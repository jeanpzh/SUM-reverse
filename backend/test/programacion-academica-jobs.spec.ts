import { afterEach, expect, it, vi } from 'vitest'
import { DemoProposalService } from '../src/programacion-academica/demo-proposal.service.js'
import { validateAcademicSearch, validateAcademicSearchRequest } from '../../shared/programacion-academica-api.mjs'

// Independently constructed synthetic request. No snapshots or external service.
function setup() {
  vi.stubEnv('SUM_PLANNING_ENGINE_URL', 'http://127.0.0.1:39999')
  const service = new DemoProposalService()
  const catalog = service.getCatalog()
  const course = catalog.courses[0]
  const availability = [{ day: 1, startMinute: 480, endMinute: 1320 }]
  const request = { revision: catalog.revision, demands: [{ courseId: course.courseId, estimatedDemand: 1, targetCapacity: 45 }], resources: {
    teachers: [{ id: 'SYN-T', name: 'Synthetic', courseIds: [course.courseId], maxWeeklyMinutes: 2400, availability }],
    rooms: [{ id: 'SYN-R', name: 'Synthetic', capacity: 45, availability }],
  } }
  const output = { jobId: 'abc', state: 'running', phase: 'capacity', elapsedSeconds: 0, budgetSeconds: 30,
    progress: { requiredSessions: course.weeklySessions.length, scheduledSessions: 0, requiredSections: 1, scheduledSections: 0, improvements: 0 }, result: null, error: null }
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'POST') { output.jobId = (options.headers as Record<string, string>)['X-Job-Id']; return Response.json({ jobId: output.jobId, state: 'running', budgetSeconds: 30 }) }
    return Response.json(options?.method === 'DELETE' ? { ...output, state: 'cancelled' } : output)
  })
  vi.stubGlobal('fetch', fetcher)
  return { service, request, output, fetcher }
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })
it('validates budgets, keeps public identity separate and cancels idempotently', async () => {
  const { service, request, output, fetcher } = setup()
  expect(() => validateAcademicSearchRequest({ request, budgetSeconds: 0 })).toThrow()
  expect(() => validateAcademicSearchRequest({ request, budgetSeconds: 121 })).toThrow()
  const job = await service.startSearch({ request, budgetSeconds: 30 })
  expect(job.jobId).not.toBe('abc')
  validateAcademicSearch(await service.searchStatus(job.jobId))
  output.state = 'cancelled'
  const cancelled = await service.searchStatus(job.jobId, true)
  const calls = fetcher.mock.calls.length
  expect(await service.searchStatus(job.jobId, true)).toEqual(cancelled)
  expect(fetcher.mock.calls.length).toBe(calls)
  await expect(service.searchStatus('unknown')).rejects.toMatchObject({ status: 404 })
})
it('expired jobs stop upstream work; disabled engine is explicit', async () => {
  const { service, request, fetcher } = setup()
  const job = await service.startSearch({ request, budgetSeconds: 30 })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 16 * 60 * 1000)
  await expect(service.searchStatus(job.jobId)).rejects.toMatchObject({ status: 404 })
  expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe('DELETE')
  vi.stubEnv('SUM_PLANNING_ENGINE_URL', 'off')
  await expect(service.startSearch({ request, budgetSeconds: 30 })).rejects.toMatchObject({ status: 503 })
})
it('upstream invalid/error responses cancel CPU, discard proposal and expose failed state', async () => {
  const { service, request, output, fetcher } = setup()
  const job = await service.startSearch({ request, budgetSeconds: 30 })
  output.progress.scheduledSessions = 99999
  await expect(service.searchStatus(job.jobId)).rejects.toMatchObject({ status: 502 })
  expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe('DELETE')
  expect(await service.searchStatus(job.jobId)).toMatchObject({ state: 'failed', proposal: null, error: { code: 'ENGINE_ERROR' } })
})
it('failed snapshots never expose an incumbent and validate error shape', async () => {
  const { service, request, output } = setup()
  const job = await service.startSearch({ request, budgetSeconds: 30 })
  Object.assign(output, { state: 'failed', error: { code: 'SEARCH_FAILED', message: 'Synthetic failure' } })
  const failed = await service.searchStatus(job.jobId)
  validateAcademicSearch(failed)
  expect(failed.proposal).toBeNull()
  expect(() => validateAcademicSearch({ ...failed, error: null })).toThrow()
})
it('repeated live snapshots reuse one proposal slot and preserve saved/copy isolation', async () => {
  const { service, request, output } = setup()
  const witness = service.createProposal(request)
  expect(witness.status).toBe('complete')
  Object.assign(output, { result: { status: 'complete', coverageProof: 'complete', capacityCertificate: null, prelation: null, decisions: [],
    assignments: witness.assignments.map(a => ({ id: a.sessionId, sectionId: a.sectionId, teacherId: a.teacherId, roomId: a.roomId,
      interval: { day: a.day, startMinute: a.startMinute, endMinute: a.endMinute } })),
    exploredCandidates: 0, candidateVisits: 0, backtracks: 0, limitReason: null, diagnostics: [] },
    progress: { ...output.progress, scheduledSessions: witness.assignments.length, scheduledSections: 1, improvements: 1 } })
  const job = await service.startSearch({ request, budgetSeconds: 30 })
  const first = await service.searchStatus(job.jobId)
  for (let i = 0; i < 25; i++) expect((await service.searchStatus(job.jobId)).proposal?.proposalId).toBe(first.proposal?.proposalId)
  expect((service as unknown as { proposals: Map<string, unknown> }).proposals.size).toBe(2)
  first.proposal!.assignments.length = 0
  expect((await service.searchStatus(job.jobId)).proposal!.assignments.length).toBe(witness.assignments.length)
  expect(() => service.captureDraftRetention(first.proposal!.proposalId, 0, { schoolId: 'SISTEMAS', academicPeriod: '2027-I', request,
    demandSourceId: 'independent-120-v1', demandBaseRequest: null })).toThrowError(expect.objectContaining({ status: 409, response: { error: { code: 'SEARCH_RUNNING', message: expect.any(String) } } }))
  output.state = 'cancelled'
  expect((await service.searchStatus(job.jobId, true)).proposal!.proposalId).toBe(first.proposal!.proposalId)
})
it('lost start response retains known ownership and retries cleanup at shutdown', async () => {
  const { service, request, fetcher } = setup()
  fetcher.mockRejectedValue(new Error('lost response'))
  await expect(service.startSearch({ request, budgetSeconds: 30 })).rejects.toMatchObject({ status: 503 })
  expect((service as unknown as { searches: Map<string, unknown> }).searches.size).toBe(1)
  const before = fetcher.mock.calls.length
  await service.onModuleDestroy()
  expect(fetcher.mock.calls.slice(before).some(call => call[1]?.method === 'DELETE')).toBe(true)
})
it('cleanup transport failure never becomes a cached terminal success', async () => {
  const { service, request, fetcher } = setup()
  const job = await service.startSearch({ request, budgetSeconds: 30 })
  fetcher.mockRejectedValue(new Error('offline'))
  await expect(service.searchStatus(job.jobId, true)).rejects.toBeDefined()
  await expect(service.searchStatus(job.jobId, true)).rejects.toBeDefined()
  expect(fetcher.mock.calls.filter(call => call[1]?.method === 'DELETE').length).toBeGreaterThan(1)
})
it('caller correlation survives lost response, is idempotent, and fences delayed starts', async () => {
  const { service, request, fetcher } = setup()
  const requestId = '11111111-1111-4111-8111-111111111111'
  const input = { request, budgetSeconds: 30, requestId }
  expect((await service.startSearch(input)).jobId).toBe(requestId)
  expect((await service.startSearch(input)).jobId).toBe(requestId)
  expect(fetcher.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1)
  await expect(service.startSearch({ ...input, budgetSeconds: 2 })).rejects.toMatchObject({ status: 409 })
  const delayed = '22222222-2222-4222-8222-222222222222'
  expect((await service.searchStatus(delayed, true)).state).toBe('cancelled')
  await expect(service.startSearch({ ...input, requestId: delayed })).rejects.toMatchObject({ status: 409 })
  await service.onModuleDestroy()
})
it('transport cleanup failure survives expiry and recovers on explicit retry', async () => {
  const { service, request, output, fetcher } = setup()
  const job = await service.startSearch({ request, budgetSeconds: 30 })
  fetcher.mockRejectedValue(new Error('offline'))
  await expect(service.searchStatus(job.jobId, true)).rejects.toBeDefined()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 16 * 60 * 1000)
  await expect(service.searchStatus(job.jobId)).rejects.toBeDefined()
  expect((service as unknown as { searches: Map<string, unknown> }).searches.has(job.jobId)).toBe(true)
  fetcher.mockImplementation(async () => Response.json({ ...output, state: 'cancelled' }))
  await service.onModuleDestroy()
  const retained = (service as unknown as { searches: Map<string, { cleanupPending: boolean }> }).searches.get(job.jobId)
  expect(retained?.cleanupPending).toBe(false)
})
it('protected capacity rejects new work rather than evicting pending cleanup', async () => {
  const { service, request } = setup()
  const job = await service.startSearch({ request, budgetSeconds: 30 })
  const searches = (service as unknown as { searches: Map<string, unknown> }).searches
  for (let i = 0; i < 255; i++) searches.set(`reserved-${i}`, searches.get(job.jobId))
  await expect(service.startSearch({ request, budgetSeconds: 30 })).rejects.toMatchObject({ status: 429 })
  expect(searches.size).toBe(256)
  expect(searches.has(job.jobId)).toBe(true)
})
it('shutdown fences a lost pending start without waiting on its response', async () => {
  const { service, request, fetcher } = setup()
  let finish!: (value: Response) => void
  let internal = ''
  fetcher.mockImplementation(async (_url, options) => {
    if (options?.method === 'POST') {
      internal = (options.headers as Record<string, string>)['X-Job-Id']
      return new Promise<Response>(resolve => { finish = resolve })
    }
    return Response.json({}, { status: 404 })
  })
  const pending = service.startSearch({ request, budgetSeconds: 30 })
  await new Promise(resolve => setImmediate(resolve))
  expect(internal).toMatch(/^[a-f0-9]{32}$/)
  await service.onModuleDestroy()
  expect(fetcher.mock.calls.some(call => call[1]?.method === 'DELETE')).toBe(true)
  finish(Response.json({ jobId: internal }))
  expect((await pending).state).toBe('failed')
})
it('concurrent reservations only cancel predecessors, never a newer queued start', async () => {
  const { service, request } = setup()
  const first = service.startSearch({ request, budgetSeconds: 30 })
  const second = service.startSearch({ request, budgetSeconds: 30 })
  const [a, b] = await Promise.all([first, second])
  expect(b.state).toBe('running')
  expect((await service.searchStatus(a.jobId)).state).toBe('cancelled')
  await service.onModuleDestroy()
})

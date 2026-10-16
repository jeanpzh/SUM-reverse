import assert from 'node:assert/strict'
import { scenarioIds } from '../../../shared/local-profile-dashboard.mjs'
import { test } from 'node:test'
import {
  createLocalProfileDashboardApi,
  LocalProfileApiError,
  readLocalProfileActivation,
} from './localProfileDashboard.ts'
import { mockResponses } from './mocks/responses.ts'

const runId = '10000000-0000-4000-8000-000000000001'
const otherRunId = '30000000-0000-4000-8000-000000000001'
const sessionId = '20000000-0000-4000-8000-000000000001'
const otherSessionId = '20000000-0000-4000-8000-000000000002'
const serverNow = '2026-08-11T14:00:00.000Z'
const identity = { runId, actorId: 'SYN-SIS-A', sessionId } as const

const scope = (school: 'SISTEMAS' | 'SOFTWARE') => ({
  facultyId: 'FISI', schoolId: school, period: '2026-II',
  planId: school === 'SISTEMAS' ? 'SYN-SIS-PLAN' : 'SYN-SOFT-PLAN', modality: 'regular-virtual',
})
const profiles = [
  { actorId: 'SYN-SIS-A', name: 'Estudiante sintético A', scope: scope('SISTEMAS') },
  { actorId: 'SYN-SIS-B', name: 'Estudiante sintético B', scope: scope('SISTEMAS') },
  { actorId: 'SYN-SOFT-A', name: 'Estudiante sintético A', scope: scope('SOFTWARE') },
  { actorId: 'SYN-SOFT-B', name: 'Estudiante sintético B', scope: scope('SOFTWARE') },
]
const catalogBody = () => ({ runId, data: { serverNow, profiles: structuredClone(profiles) } })
const scenariosBody = () => ({ runId, data: {
  serverNow, currentScenarioId: 'regular',
  scenarios: scenarioIds.map((scenarioId) => ({
    scenarioId, label: scenarioId, description: 'Escenario local sintético',
    profiles: profiles.map((profile) => ({
      actorId: profile.actorId, summary: 'Historial sintético', expectedResult: 'Resultado de referencia',
      recommendedCourseIds: [profile.actorId.startsWith('SYN-SIS-') ? 'SYN-SIS-C09' : 'SYN-SOFT-C09'],
    })),
  })),
} })
const context = (actorId = 'SYN-SIS-A') => ({
  actorId, scope: scope('SISTEMAS'), profileRevision: 'MR-SYN-SIS-1', serverNow,
  preEnrollmentEnabled: false, preEnrollmentComplete: true, preEnrollment: [], offerKnown: true, offer: [],
  calendar: { publishedRows: [], effectiveWindows: [], unknownDates: [] },
  eligibility: { state: 'eligible', windowId: null, windowOrigin: null, causes: [], gaps: [] },
  sources: [],
})
const readBody = (key: string, payload: unknown, over: Record<string, unknown> = {}, envelopeRun = runId) => ({
  runId: envelopeRun,
  data: { actorId: identity.actorId, sessionId, key, serverNow, payload, ...over },
})
const jsonResponse = (body: unknown, status = 200) => Response.json(body, { status })

type Call = { url: string; init: RequestInit | undefined }
function recorder(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetchImpl: typeof fetch = async (url, init) => {
    const call = { url: String(url), init }
    calls.push(call)
    return handler(call)
  }
  return { calls, api: createLocalProfileDashboardApi({ fetchImpl }) }
}

test('activation_switch: absent keeps legacy, synthetic-actors needs local mode, anything else is a configuration error', () => {
  assert.equal(readLocalProfileActivation({}), 'legacy')
  assert.equal(readLocalProfileActivation({ mode: 'local' }), 'legacy')
  assert.equal(readLocalProfileActivation({ mode: 'api', profile: '' }), 'legacy')
  assert.equal(readLocalProfileActivation({ mode: 'mock' }), 'legacy')
  assert.equal(readLocalProfileActivation({ mode: 'local', profile: 'synthetic-actors' }), 'synthetic-actors')
  for (const values of [
    { mode: 'local', profile: 'other' },
    { mode: 'local', profile: 'Synthetic-Actors' },
    { mode: 'mock', profile: 'synthetic-actors' },
    { mode: 'api', profile: 'synthetic-actors' },
    { profile: 'synthetic-actors' },
  ]) {
    assert.throws(() => readLocalProfileActivation(values), /perfil|configuración|local/i, JSON.stringify(values))
  }
})

test('catalog is one credential-free GET without query or body and is validated to exactly four profiles', async () => {
  const { calls, api } = recorder(() => jsonResponse(catalogBody()))
  const envelope = await api.catalog()
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.url, '/api/local/perfiles/v1/perfiles')
  assert.equal(calls[0]!.init?.method, 'GET')
  assert.equal(calls[0]!.init?.credentials, 'omit')
  assert.equal(calls[0]!.init?.body, undefined)
  assert.equal(new Headers(calls[0]!.init?.headers).get('accept'), 'application/json')
  assert.equal(envelope.runId, runId)
  assert.deepEqual(envelope.data.profiles.map((profile) => profile.actorId),
    ['SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B'])

  const five = catalogBody()
  five.data.profiles.push(structuredClone(profiles[0]!))
  const broken = recorder(() => jsonResponse(five))
  await assert.rejects(broken.api.catalog(), (error) =>
    error instanceof LocalProfileApiError && error.kind === 'protocol' && error.operation === 'catalog')
})

test('scenario catalog validates all nine cases and rejects duplicated or cross-school recommendations', async () => {
  const { calls, api } = recorder(() => jsonResponse(scenariosBody()))
  const response = await api.scenarios()
  assert.equal(calls[0]!.url, '/api/local/perfiles/v1/escenarios')
  assert.equal(response.data.scenarios.length, 9)
  const malformed = scenariosBody()
  malformed.data.scenarios[0]!.profiles[0]!.recommendedCourseIds = ['SYN-SOFT-C09']
  await assert.rejects(recorder(() => jsonResponse(malformed)).api.scenarios(), /no cumple el contrato/)
  const duplicate = scenariosBody()
  duplicate.data.scenarios[1]!.scenarioId = 'regular'
  await assert.rejects(recorder(() => jsonResponse(duplicate)).api.scenarios(), /no cumple el contrato/)
})

test('starting a scenario sends one explicit POST, validates a new run and exposes stale-run errors', async () => {
  const newRunId = '10000000-0000-4000-8000-000000000099'
  const { calls, api } = recorder(() => jsonResponse({ ...catalogBody(), runId: newRunId }))
  const command = { runId, scenarioId: 'tutoria' as const }
  assert.equal((await api.selectScenario(command)).runId, newRunId)
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.url, '/api/local/perfiles/v1/escenarios/seleccion')
  assert.equal(calls[0]!.init?.method, 'POST')
  assert.equal(calls[0]!.init?.credentials, 'omit')
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), command)
  await assert.rejects(recorder(() => jsonResponse(catalogBody())).api.selectScenario(command), /ejecución nueva/)
  await assert.rejects(recorder(() => jsonResponse({ runId: newRunId, error: { code: 'RUN_CHANGED', fields: [] } }, 409))
    .api.selectScenario(command), (error) => error instanceof LocalProfileApiError && error.code === 'RUN_CHANGED')
})

test('read sends exactly runId, actorId and sessionId and returns the validated academic payload', async () => {
  const { calls, api } = recorder(() => jsonResponse(readBody('matriculaInfo', context())))
  const response = await api.read('matriculaInfo', identity)
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.url,
    `/api/local/perfiles/v1/consultas/matriculaInfo?runId=${runId}&actorId=SYN-SIS-A&sessionId=${sessionId}`)
  assert.equal(calls[0]!.init?.method, 'GET')
  assert.equal(calls[0]!.init?.credentials, 'omit')
  assert.equal(calls[0]!.init?.body, undefined)
  assert.equal(response.data.serverNow, serverNow)
  assert.equal(response.data.payload.actorId, 'SYN-SIS-A')
})

test('read rejects an invalid key or identity before any request', async () => {
  const { calls, api } = recorder(() => jsonResponse({}))
  await assert.rejects(api.read('nope' as never, identity), (error) => error instanceof LocalProfileApiError && error.kind === 'protocol')
  await assert.rejects(api.read('matriculaInfo', { ...identity, actorId: 'SYN-OTHER' } as never),
    (error) => error instanceof LocalProfileApiError && error.kind === 'protocol')
  await assert.rejects(api.read('matriculaInfo', { ...identity, sessionId: 'x' }),
    (error) => error instanceof LocalProfileApiError && error.kind === 'protocol')
  assert.equal(calls.length, 0)
})

test('wrong_identity_response_fails: a response for another run, actor, session or key is never returned', async () => {
  const wrong = [
    readBody('matriculaInfo', context(), {}, otherRunId),
    readBody('matriculaInfo', context('SYN-SIS-B'), { actorId: 'SYN-SIS-B' }),
    readBody('matriculaInfo', context(), { sessionId: otherSessionId }),
    readBody('plan', context(), {}),
    readBody('matriculaInfo', context('SYN-SIS-B')),
  ]
  for (const body of wrong) {
    const { api } = recorder(() => jsonResponse(body))
    await assert.rejects(api.read('matriculaInfo', identity), (error) =>
      error instanceof LocalProfileApiError && error.kind === 'protocol' && error.operation === 'read')
  }
})

test('payload validation accepts full reference views and rejects malformed profile/report payloads', async () => {
  const ok = async (key: 'perfil' | 'matricula' | 'horarios', payload: unknown) =>
    recorder(() => jsonResponse(readBody(key, payload))).api.read(key, identity)
  assert.equal((await ok('perfil', null)).data.payload, null)
  assert.equal((await ok('matricula', null)).data.payload, null)
  assert.equal((await ok('horarios', null)).data.payload, null)

  for (const payload of [{}, []]) {
    await assert.rejects(ok('perfil', payload), (error) => error instanceof LocalProfileApiError && error.kind === 'protocol')
  }
  await assert.rejects(ok('matricula', {}), (error) => error instanceof LocalProfileApiError && error.kind === 'protocol')
  assert.deepEqual((await ok('perfil', mockResponses.perfil)).data.payload, mockResponses.perfil)
  const programming = await recorder(() => jsonResponse(readBody('programacion', mockResponses.programacion))).api.read('programacion', identity)
  assert.deepEqual(programming.data.payload, mockResponses.programacion)
  await assert.rejects(recorder(() => jsonResponse(readBody('programacion', { data: {} }))).api.read('programacion', identity),
    (error) => error instanceof LocalProfileApiError && error.kind === 'protocol')
})

test('compatible keys reuse the existing local-v1 validators and keep the legacy envelope', async () => {
  const response = await recorder(() => jsonResponse(readBody('evaluaciones', mockResponses.evaluaciones)))
    .api.read('evaluaciones', identity)
  assert.deepEqual(response.data.payload, mockResponses.evaluaciones)
  await assert.rejects(
    recorder(() => jsonResponse(readBody('evaluaciones', { message: null, codError: null, data: [{ nope: 1 }] })))
      .api.read('evaluaciones', identity),
    (error) => error instanceof LocalProfileApiError && error.kind === 'protocol')
  await assert.rejects(
    recorder(() => jsonResponse(readBody('formulario', { message: null, codError: null, data: {} })))
      .api.read('formulario', identity),
    (error) => error instanceof LocalProfileApiError && error.kind === 'protocol')
})

test('no_fallback_on_error: network, HTTP, non-JSON and malformed failures reject once and never use mock data', async () => {
  const network = recorder(() => { throw new TypeError('offline') })
  await assert.rejects(network.api.read('evaluaciones', identity), (error) =>
    error instanceof LocalProfileApiError && error.kind === 'network' && error.retryable)
  assert.equal(network.calls.length, 1)

  const expired = recorder(() => jsonResponse({ runId, error: { code: 'SESSION_EXPIRED', fields: [] } }, 409))
  await assert.rejects(expired.api.read('evaluaciones', identity), (error) =>
    error instanceof LocalProfileApiError && error.kind === 'http' && error.status === 409
    && error.code === 'SESSION_EXPIRED' && error.runId === runId)

  const reset = recorder(() => jsonResponse({ runId: otherRunId, error: { code: 'RUN_CHANGED', fields: [] } }, 409))
  await assert.rejects(reset.api.read('evaluaciones', identity), (error) =>
    error instanceof LocalProfileApiError && error.code === 'RUN_CHANGED')

  const foreignRun = recorder(() => jsonResponse({ runId: otherRunId, error: { code: 'LOCAL_FAILURE', fields: [] } }, 500))
  await assert.rejects(foreignRun.api.read('evaluaciones', identity), (error) =>
    error instanceof LocalProfileApiError && error.kind === 'protocol')

  const html = recorder(() => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }))
  await assert.rejects(html.api.read('evaluaciones', identity), (error) =>
    error instanceof LocalProfileApiError && error.kind === 'protocol')

  const badJson = recorder(() => new Response('{', { headers: { 'content-type': 'application/json' } }))
  await assert.rejects(badJson.api.read('evaluaciones', identity), (error) =>
    error instanceof LocalProfileApiError && error.kind === 'protocol')

  const malformedError = recorder(() => jsonResponse({ message: 'boom' }, 500))
  await assert.rejects(malformedError.api.read('evaluaciones', identity), (error) =>
    error instanceof LocalProfileApiError && error.kind === 'protocol')

  for (const harness of [network, expired, reset, html, badJson, malformedError]) assert.equal(harness.calls.length, 1)
})

test('an aborted request is reported as aborted, not as a network failure', async () => {
  const controller = new AbortController()
  controller.abort()
  const { calls, api } = recorder(() => jsonResponse(catalogBody()))
  await assert.rejects(api.catalog({ signal: controller.signal }), (error) =>
    error instanceof LocalProfileApiError && error.kind === 'aborted')
  assert.equal(calls.length, 0)
})

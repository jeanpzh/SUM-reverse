import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSumApi } from './api.ts'
import { readDataConfig } from './config.ts'
import { buildEndpointUrl } from './transport.ts'
import { mockResponses } from './mocks/responses.ts'
import type { EndpointKey } from './contracts.ts'

const documented: [EndpointKey, string, string][] = [
  ['perfil', 'informacion/perfil', 'obtenerInformacionAlumno'],
  ['formulario', 'informacion/formularioDatos', 'obtenerFormularioDatosMatricula'],
  ['matriculaInfo', 'matricula/informacion', 'obtenerInformacion'],
  ['programacion', 'matricula/programacion', 'obtenerProgramacionAsignaturas'],
  ['prematricula', 'reportes/prematricula', 'obtenerAlumnoPrematricula'],
  ['matricula', 'reportes/matricula', 'obtenerAlumnoMatricula'],
  ['horarios', 'reportes/horarios', 'obtenerHorariosAsignatura'],
  ['evaluaciones', 'reportes/evaluaciones', 'recuperarEvaluacionesCalificaciones'],
  ['deudas', 'reportes/deudas', 'obtenerAlumnoDeuda'],
  ['asistencias', 'asistencia', 'obtenerResumenAsistencia'],
  ['tutoria', 'tutoria', 'obtenerListaAsignaturaTutoria'],
  ['plan', 'planEstudios', 'obtenerPlanEstudios'],
]

test('documented requests preserve observed legacy methods and session credentials', async () => {
  const legacyGet = new Set<EndpointKey>(['formulario', 'matriculaInfo', 'programacion', 'prematricula', 'matricula', 'horarios'])
  for (const [key, path, action] of documented) {
    let requests = 0
    const fetcher: typeof fetch = async (url, init) => {
      requests++
      assert.equal(String(url), `https://example.test/proxy/alumnoWebSum/v2/${path}?accion=${action}`)
      assert.equal(init?.method, legacyGet.has(key) ? 'GET' : 'POST')
      assert.equal(init?.credentials, 'include')
      assert.equal(new Headers(init?.headers).get('accept'), 'application/json')
      assert.equal(init?.body, undefined)
      return Response.json(mockResponses[key])
    }
    const result = await createSumApi({ mode: 'api', baseUrl: 'https://example.test/proxy/' }, fetcher).get(key)
    assert.deepEqual(result, mockResponses[key])
    assert.equal(requests, 1)
  }
})

test('the independent local API keeps POST and omits session credentials for all five snapshots', async () => {
  const keys = ['matriculaInfo', 'programacion', 'prematricula', 'matricula', 'horarios'] as const
  for (const key of keys) {
    let requests = 0
    const fetcher: typeof fetch = async (_url, init) => {
      requests++
      assert.equal(init?.method, 'POST')
      assert.equal(init?.credentials, 'omit')
      return Response.json(mockResponses[key])
    }
    await createSumApi({ mode: 'local', baseUrl: '/api' }, fetcher).get(key)
    assert.equal(requests, 1)
  }
})

test('URL builder handles prefixes and rejects unsupported schemes', () => {
  for (const base of ['https://example.test', 'https://example.test/']) {
    assert.equal(buildEndpointUrl(base, 'perfil'), 'https://example.test/alumnoWebSum/v2/informacion/perfil?accion=obtenerInformacionAlumno')
  }
  for (const base of ['/proxy', '/proxy/']) {
    assert.equal(buildEndpointUrl(base, 'perfil'), '/proxy/alumnoWebSum/v2/informacion/perfil?accion=obtenerInformacionAlumno')
  }
  assert.ok(buildEndpointUrl('https://example.test/proxy?test=1', 'perfil').includes('test=1&accion='))
  for (const base of ['javascript:alert(1)', '//example.test', 'ftp://example.test', '']) {
    assert.throws(() => buildEndpointUrl(base, 'perfil'), /URL base/)
  }
})

test('mock is the default and API configuration must be explicit', () => {
  assert.deepEqual(readDataConfig({}), { mode: 'mock' })
  assert.throws(() => readDataConfig({ mode: 'wrong' }), /modo/i)
  assert.throws(() => readDataConfig({ mode: 'api' }), /URL base/)
})

test('mock never fetches and each response is isolated', async () => {
  const fetcher: typeof fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
  const api = createSumApi({ mode: 'mock', baseUrl: 'https://example.test' }, fetcher)
  const first = await api.get('asistencias')
  first.data[0].desAsignatura = 'changed'
  const next = await api.get('asistencias')
  assert.equal(next.data[0].desAsignatura, mockResponses.asistencias.data[0].desAsignatura)
})

test('aborted requests stop in mock and API modes without reusing the signal', async () => {
  const controller = new AbortController()
  controller.abort()
  const mock = createSumApi({ mode: 'mock' })
  await assert.rejects(mock.get('perfil', { signal: controller.signal }), { name: 'AbortError' })
  assert.ok((await mock.get('perfil')).data.numDocumento)
  const pending = new AbortController()
  const fetcher: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    assert.equal(init?.signal, pending.signal)
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })
  const request = createSumApi({ mode: 'api', baseUrl: '/proxy' }, fetcher)
    .get('perfil', { signal: pending.signal })
  pending.abort()
  await assert.rejects(request, { name: 'AbortError' })
})

test('HTTP, login HTML, invalid JSON and malformed envelopes remain errors', async () => {
  const cases = [
    new Response('failed', { status: 500 }),
    new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } }),
    new Response('{bad', { headers: { 'content-type': 'application/json' } }),
    Response.json({ message: null, codError: 'UNAUTHORIZED', data: null }),
    Response.json({ message: null, codError: null }),
    Response.json({ message: null, codError: null, data: {} }),
    Response.json(null),
  ]
  for (const response of cases) {
    const fetcher: typeof fetch = async () => response
    await assert.rejects(createSumApi({ mode: 'api', baseUrl: '/proxy' }, fetcher).get('perfil'))
  }
})

test('JSON survey dates remain strings and unknown arrays stay opaque', async () => {
  const fetcher: typeof fetch = async () => Response.json(mockResponses.formulario)
  const result = await createSumApi({ mode: 'api', baseUrl: '/proxy' }, fetcher).get('formulario')
  assert.equal(typeof result.data.alumno.infoSemestre.fecInicioEncuestaDocente, 'string')
  const opaque: typeof fetch = async () => Response.json({ message: null, codError: null, data: [{ unknown: true }] })
  assert.deepEqual((await createSumApi({ mode: 'api', baseUrl: '/proxy' }, opaque).get('tutoria')).data, [{ unknown: true }])
})

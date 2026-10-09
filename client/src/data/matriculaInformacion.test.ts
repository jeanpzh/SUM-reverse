import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSumApi } from './api.ts'
import { toEnrollmentArticle } from './adapters.ts'
import { mockResponses } from './mocks/responses.ts'
import { validateMatriculaInformacion, type MatriculaInformacionLocalData } from './matriculaInformacion.ts'
import { parseResponse } from './transport.ts'

const localData = {
  codSemestre: '2026-2',
  articulo: {
    introduccion: 'Artículo del periodo 2026-2',
    secciones: [
      { id: 'cronograma', titulo: 'Cronograma', descripcion: 'Texto de cronograma para el periodo 2026-2.' },
      { id: 'acceso-facultad', titulo: 'Acceso', descripcion: 'Texto de acceso.' },
      { id: 'prematricula', titulo: 'Pre-matrícula', descripcion: 'Texto de pre-matrícula.' },
      { id: 'deudas', titulo: 'Deudas', descripcion: 'Texto de deudas.' },
      { id: 'interfaz', titulo: 'Interfaz', descripcion: 'Texto de interfaz.' },
    ],
  },
} satisfies MatriculaInformacionLocalData

test('matricula information validator accepts only the fixed ordered local contract', () => {
  assert.doesNotThrow(() => validateMatriculaInformacion(structuredClone(localData)))
  assert.doesNotThrow(() => validateMatriculaInformacion({ codSemestre: '2026-2', articulo: null }))

  const invalidCases = [
    { codSemestre: '2026-2' },
    { ...localData, extra: true },
    { ...localData, codSemestre: '2026-3' },
    { ...localData, articulo: {} },
    { ...localData, articulo: { ...localData.articulo, extra: true } },
    { ...localData, articulo: { ...localData.articulo, secciones: localData.articulo.secciones.slice(1) } },
    { ...localData, articulo: { ...localData.articulo, secciones: localData.articulo.secciones.map((section, index) => index ? section : { ...section, id: 'deudas' }) } },
    { ...localData, articulo: { ...localData.articulo, secciones: localData.articulo.secciones.map((section, index) => index ? section : { ...section, titulo: 3 }) } },
  ]
  for (const value of invalidCases) {
    assert.throws(() => validateMatriculaInformacion(value), /no cumple el contrato/)
  }
})

test('article adapter keeps local null empty and preserves the historical legacy wording', () => {
  const localEnvelope = { message: null, codError: null, data: structuredClone(localData) } as const
  assert.deepEqual(toEnrollmentArticle(localEnvelope.data), localData.articulo)
  assert.equal(toEnrollmentArticle({ codSemestre: '2026-2', articulo: null }), null)

  const legacy = toEnrollmentArticle(mockResponses.matriculaInfo.data)
  assert.equal(legacy?.secciones[0].descripcion,
    'Información sobre el cronograma académico relacionado con la matrícula.')
  assert.notEqual(legacy?.secciones[0].descripcion, localData.articulo.secciones[0].descripcion)
})

function rawMatriculaInfo() {
  return {
    message: null,
    codError: null,
    data: {
      codSemestre: '2026-2', codFacultad: 10, fechaDB: '2026-10-08T10:20:30-05:00',
      fecIniMatInternet: '2026-10-10', fecFinMatInternet: '2026-10-20',
      mensajeMatricula: 'Periodo de demostración', mensaje: 'Mensaje de estado',
      indMatHabilitada: false, matriculado: false, indMatCtrlHorario: 'X',
      valProgramacion: null,
      perfil: { anioIngreso: 2024, anioEstudio: 2, promedio: 14.25, situAcademica: 'Regular',
        permanencia: 'Regular', semestreSuspension: null, codTipoAutorizacion: null },
      creditaje: { libre: 18 }, amonestaciones: null,
      articulo: { opaqueExtra: ['preserve raw discriminator'] },
      wireExtra: { keep: true },
    },
    envelopeExtra: ['preserved'],
  }
}

test('raw information is selected by indMatHabilitada and preserves extra article-shaped keys', () => {
  const response = rawMatriculaInfo()
  const parsed = parseResponse('matriculaInfo', response, true)
  assert.deepEqual(parsed, response)
  const article = toEnrollmentArticle(parsed.data)
  assert.equal(article?.secciones.length, 5)
  assert.deepEqual(response.data.wireExtra, { keep: true })
})

test('raw information rejects missing required fields and wrong wire types without article fallback', () => {
  const missingDate = rawMatriculaInfo()
  delete (missingDate.data as { fechaDB?: string }).fechaDB
  assert.throws(() => parseResponse('matriculaInfo', missingDate, true), /matriculaInfo\.data\.fechaDB/)

  const wrongMessage = rawMatriculaInfo()
  ;(wrongMessage.data as { mensaje?: unknown }).mensaje = null
  assert.throws(() => parseResponse('matriculaInfo', wrongMessage, true), /matriculaInfo\.data\.mensaje/)

  const wrongDiscriminantType = rawMatriculaInfo()
  ;(wrongDiscriminantType.data as { indMatHabilitada?: unknown }).indMatHabilitada = 'false'
  assert.throws(() => parseResponse('matriculaInfo', wrongDiscriminantType, true),
    /matriculaInfo\.data\.indMatHabilitada/)

  const extraArticleOnLocalArticle = structuredClone(localData)
  ;(extraArticleOnLocalArticle as MatriculaInformacionLocalData & { extra?: boolean }).extra = true
  const localArticleEnvelope = { message: null, codError: null, data: extraArticleOnLocalArticle }
  assert.throws(() => parseResponse('matriculaInfo', localArticleEnvelope, true))
})

test('matricula information uses local transport only in local mode and preserves api compatibility', async () => {
  const localFetch: typeof fetch = async (url, init) => {
    assert.equal(String(url), '/api/alumnoWebSum/v2/matricula/informacion?accion=obtenerInformacion')
    assert.equal(init?.method, 'POST')
    assert.equal(init?.credentials, 'omit')
    assert.equal(init?.body, undefined)
    return Response.json({ message: null, codError: null, data: structuredClone(localData) })
  }
  const local = await createSumApi({ mode: 'local', baseUrl: '/api' }, localFetch).get('matriculaInfo')
  assert.deepEqual(local.data, localData)

  const apiFetch: typeof fetch = async (_url, init) => {
    assert.equal(init?.credentials, 'include')
    return Response.json(mockResponses.matriculaInfo)
  }
  const api = await createSumApi({ mode: 'api', baseUrl: '/reference-proxy' }, apiFetch).get('matriculaInfo')
  assert.equal(toEnrollmentArticle(api.data)?.secciones[0].descripcion,
    'Información sobre el cronograma académico relacionado con la matrícula.')

  const unexpectedNetwork: typeof fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
  const mock = await createSumApi({ mode: 'mock' }, unexpectedNetwork).get('matriculaInfo')
  assert.equal(toEnrollmentArticle(mock.data)?.secciones.length, 5)
})

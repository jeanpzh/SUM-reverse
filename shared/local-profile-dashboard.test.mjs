import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validateContextResponse,
  validateEnrollmentReportResponse,
  validateSessionResponse,
} from './matricula-regular.mjs'
import {
  dashboardKeys,
  validateDashboardIdentity,
  validateDashboardKey,
  validateDashboardReadResponse,
  validateProfileCatalogResponse,
} from './local-profile-dashboard.mjs'

const runId = '10000000-0000-4000-8000-000000000001'
const sessionId = '20000000-0000-4000-8000-000000000001'
const serverNow = '2026-08-11T14:00:00.000Z'
const identity = { runId, actorId: 'SYN-SIS-A', sessionId }
const expected = { ...identity, key: 'matriculaInfo' }
const scope = (school) => ({
  facultyId: 'FISI',
  schoolId: school,
  period: '2026-II',
  planId: school === 'SISTEMAS' ? 'SYN-SIS-PLAN' : 'SYN-SOFT-PLAN',
  modality: 'regular-virtual',
})
const profiles = [
  { actorId: 'SYN-SIS-A', name: 'Estudiante sintético A', scope: scope('SISTEMAS') },
  { actorId: 'SYN-SIS-B', name: 'Estudiante sintético B', scope: scope('SISTEMAS') },
  { actorId: 'SYN-SOFT-A', name: 'Estudiante sintético A', scope: scope('SOFTWARE') },
  { actorId: 'SYN-SOFT-B', name: 'Estudiante sintético B', scope: scope('SOFTWARE') },
]
const catalogResponse = () => ({ runId, data: { serverNow, profiles: structuredClone(profiles) } })
const context = {
  actorId: identity.actorId,
  scope: scope('SISTEMAS'),
  profileRevision: 'MR-SYN-SIS-1',
  serverNow,
  preEnrollmentEnabled: false,
  preEnrollmentComplete: true,
  preEnrollment: [],
  offerKnown: true,
  offer: [],
  calendar: { publishedRows: [], effectiveWindows: [], unknownDates: [] },
  eligibility: { state: 'eligible', windowId: null, windowOrigin: null, causes: [], gaps: [] },
  sources: [],
}
const contextResponse = () => ({ runId, data: {
  actorId: identity.actorId,
  sessionId,
  key: 'matriculaInfo',
  serverNow,
  payload: structuredClone(context),
} })
const validateContextPayload = (payload) =>
  validateContextResponse({ runId, data: payload }, runId, identity.actorId)

test('catalog_exact_four validates ordered synthetic profiles and rejects duplicates', () => {
  assert.doesNotThrow(() => validateProfileCatalogResponse(catalogResponse()))

  const duplicate = catalogResponse()
  duplicate.data.profiles[3] = structuredClone(duplicate.data.profiles[2])
  assert.throws(() => validateProfileCatalogResponse(duplicate), /orden fijo|actorId únicos/)

  const wrongOrder = catalogResponse()
  const first = wrongOrder.data.profiles[0]
  wrongOrder.data.profiles[0] = wrongOrder.data.profiles[1]
  wrongOrder.data.profiles[1] = first
  assert.throws(() => validateProfileCatalogResponse(wrongOrder), /orden fijo/)
})

test('identity_correlation validates MR2 identity and read correlation before payload use', () => {
  assert.doesNotThrow(() => validateDashboardIdentity(identity))
  assert.doesNotThrow(() => validateDashboardReadResponse(contextResponse(), expected, validateContextPayload))

  for (const field of ['runId', 'actorId', 'sessionId', 'key']) {
    const response = contextResponse()
    if (field === 'runId') response.runId = '30000000-0000-4000-8000-000000000001'
    else if (field === 'key') response.data.key = 'plan'
    else response.data[field] = field === 'actorId' ? 'SYN-SIS-B' : '30000000-0000-4000-8000-000000000001'
    assert.throws(() => validateDashboardReadResponse(response, expected, validateContextPayload), /esperad/)
  }
})

test('campaign identities extend the local catalog without permitting malformed IDs or free catalog entries', () => {
  assert.doesNotThrow(() => validateDashboardIdentity({ ...identity, actorId: 'SYN-SIS-U0100' }))
  for (const actorId of ['ADMIN', 'SYN-', 'SYN-student', 'SYN-A/B']) {
    assert.throws(() => validateDashboardIdentity({ ...identity, actorId }))
  }
  const changed = catalogResponse()
  changed.data.profiles[0].actorId = 'SYN-SIS-U0100'
  assert.throws(() => validateProfileCatalogResponse(changed))
})

test('extra_keys_rejected at identity, catalog, and dashboard read boundaries', () => {
  assert.throws(() => validateDashboardIdentity({ ...identity, extra: true }), /clave permitida/)
  const extraCatalog = catalogResponse()
  extraCatalog.data.extra = true
  assert.throws(() => validateProfileCatalogResponse(extraCatalog), /clave permitida/)
  const extraRead = contextResponse()
  extraRead.data.extra = true
  assert.throws(() => validateDashboardReadResponse(extraRead, expected, validateContextPayload), /clave permitida/)
})

test('bad_time_rejected for invalid and noncanonical ISO instants', () => {
  for (const invalid of ['2026-02-30T14:00:00.000Z', '2026-08-11T14:00:00Z', '2026-08-11T09:00:00.000-05:00']) {
    const response = catalogResponse()
    response.data.serverNow = invalid
    assert.throws(() => validateProfileCatalogResponse(response), /instante UTC/)
  }
})

test('payload_validator_called after valid MR2 session and context contracts', () => {
  const sessionResponse = {
    runId,
    data: {
      runId,
      actorId: identity.actorId,
      sessionId,
      startedAt: serverNow,
      expiresAt: '2026-08-11T14:15:00.000Z',
    },
  }
  assert.doesNotThrow(() => validateSessionResponse(sessionResponse, identity))
  assert.doesNotThrow(() => validateContextResponse({ runId, data: context }, runId, identity.actorId))

  let calls = 0
  validateDashboardReadResponse(contextResponse(), expected, (payload) => {
    calls += 1
    validateContextPayload(payload)
  })
  assert.equal(calls, 1)
})

test('null_report_only_dashboard allows a null dashboard report while MR2 reports reject it', () => {
  const reportRead = {
    runId,
    data: { actorId: identity.actorId, sessionId, key: 'matricula', serverNow, payload: null },
  }
  const reportExpected = { ...identity, key: 'matricula' }
  assert.doesNotThrow(() => validateDashboardReadResponse(reportRead, reportExpected, (payload) => {
    if (payload !== null) throw new TypeError('expected nullable dashboard report')
  }))
  assert.throws(() => validateEnrollmentReportResponse({ runId, data: null }, {
    runId,
    actorId: identity.actorId,
    enrollmentId: sessionId,
  }))
})

test('dashboard key set is exact and excludes arbitrary keys', () => {
  assert.deepEqual(dashboardKeys, [
    'perfil', 'formulario', 'historial', 'fichaSocioeconomica', 'matriculaInfo', 'programacion',
    'prematricula', 'matricula', 'horarios', 'evaluaciones', 'deudas', 'asistencias', 'tutoria', 'plan',
  ])
  for (const key of dashboardKeys) assert.doesNotThrow(() => validateDashboardKey(key))
  assert.throws(() => validateDashboardKey('reportes'), /dashboardKey/)
})

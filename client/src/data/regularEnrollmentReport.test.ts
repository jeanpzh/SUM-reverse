import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMatriculaRegularApi, MatriculaRegularApiError } from './matriculaRegular.ts'
import {
  buildReportView,
  parseReportSearch,
  reportLinkFromOutcome,
  REPORT_ROUTE_PATH,
} from './regularEnrollmentReport.ts'
import {
  acceptedOutcome, actorSis, enrollmentId, enrollmentReport, errorResponse, jsonResponse,
  otherRunId, pendingOutcome, recordingFetch, rejectedOutcome, runId,
} from '../../tests/fixtures/matriculaRegularKit.ts'

// ---------------------------------------------------------------------------
// T045 mapping: backend reportPath -> React route (client-owned, no arbitrary bases)
// ---------------------------------------------------------------------------

test('T045: accepted Outcome maps to the React report route with validated runId/actorId search params', () => {
  const link = reportLinkFromOutcome(acceptedOutcome(), runId)
  assert.deepEqual(link, { enrollmentId, search: { runId, actorId: actorSis } })
  assert.equal(REPORT_ROUTE_PATH, '/local/matricula-regular/reporte/$enrollmentId')
})

test('T045: the backend path is never followed — absolute, foreign or mismatched paths yield no link', () => {
  const cases = [
    acceptedOutcome({ reportPath: `https://evil.example/local/matricula-regular/v1/reportes/${enrollmentId}` }),
    acceptedOutcome({ reportPath: `//evil.example/local/matricula-regular/v1/reportes/${enrollmentId}` }),
    acceptedOutcome({ reportPath: '/local/matricula-regular/v1/reportes/00000000-0000-4000-8000-0000000000ff' }),
    acceptedOutcome({ reportPath: `/local/matricula-regular/v1/reportes/${enrollmentId}?x=1` }),
    acceptedOutcome({ reportPath: null }),
    acceptedOutcome({ enrollmentId: null }),
    rejectedOutcome(),
    pendingOutcome(),
  ]
  for (const outcome of cases) assert.equal(reportLinkFromOutcome(outcome, runId), null, String(outcome.reportPath))
})

test('T045: search params are validated with the real wire validators', () => {
  assert.deepEqual(parseReportSearch({ runId, actorId: actorSis }), { runId, actorId: actorSis })
  for (const bad of [{}, { runId }, { runId, actorId: 'real-student' }, { runId: 'x', actorId: actorSis },
    { runId, actorId: actorSis, extra: '1' }, { runId, actorId: 7 }]) {
    assert.throws(() => parseReportSearch(bad as Record<string, unknown>), TypeError, JSON.stringify(bad))
  }
})

// ---------------------------------------------------------------------------
// T044: own report API read, projection, CSV
// ---------------------------------------------------------------------------

test('T044: getReport is a pure GET on /reportes/:id with exactly runId+actorId and validates identity', async () => {
  const { fetchImpl, calls } = recordingFetch(() => jsonResponse(200, { runId, data: enrollmentReport() }))
  const api = createMatriculaRegularApi({ mode: 'local', fetchImpl })
  const report = await api.getReport({ runId, actorId: actorSis, enrollmentId })
  assert.equal(report.enrollmentId, enrollmentId)
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.method, 'GET')
  assert.equal(calls[0]!.body, undefined)
  const url = new URL(calls[0]!.url, 'http://local')
  assert.equal(url.pathname, `/api/local/matricula-regular/v1/reportes/${enrollmentId}`)
  assert.deepEqual([...url.searchParams.keys()].sort(), ['actorId', 'runId'])
})

test('T044: report of another actor/enrollment or a foreign run is malformed, REPORT_NOT_FOUND propagates (no seed fallback)', async () => {
  const wrongActor = createMatriculaRegularApi({ mode: 'local', fetchImpl: recordingFetch(() =>
    jsonResponse(200, { runId, data: enrollmentReport({ actorId: 'SYN-SOFT-A' }) })).fetchImpl })
  await assert.rejects(() => wrongActor.getReport({ runId, actorId: actorSis, enrollmentId }),
    (error: unknown) => error instanceof MatriculaRegularApiError && error.kind === 'protocol')

  const wrongRun = createMatriculaRegularApi({ mode: 'local', fetchImpl: recordingFetch(() =>
    jsonResponse(200, { runId: otherRunId, data: enrollmentReport() })).fetchImpl })
  await assert.rejects(() => wrongRun.getReport({ runId, actorId: actorSis, enrollmentId }),
    (error: unknown) => error instanceof MatriculaRegularApiError && error.kind === 'protocol')

  const calls = recordingFetch(() => errorResponse(404, 'REPORT_NOT_FOUND'))
  const missing = createMatriculaRegularApi({ mode: 'local', fetchImpl: calls.fetchImpl })
  await assert.rejects(() => missing.getReport({ runId, actorId: actorSis, enrollmentId }),
    (error: unknown) => error instanceof MatriculaRegularApiError && error.kind === 'http' && error.code === 'REPORT_NOT_FOUND')
  assert.equal(calls.calls.length, 1, 'no retry, no fallback request')
})

test('T044: the projection lists exactly the accepted courses, their count and total credits', () => {
  const view = buildReportView(enrollmentReport())
  assert.equal(view.courseCount, 2)
  assert.equal(view.totalCredits, 7)
  assert.deepEqual(view.rows.map((row) => row[0]), ['SYN-SIS-C1', 'SYN-SIS-C2'])
  assert.equal(view.rows[0]![4], 'Lun 08:00-10:00, Mié 08:00-09:00')
  assert.equal(view.scope.period, '2026-II')
  assert.equal(view.windowOriginLabel, 'Ventana sintética de prueba')
})

test('T044: CSV semantics — same headers/rows as the table, one-extension base name, no official-document claim', () => {
  const view = buildReportView(enrollmentReport())
  assert.deepEqual(view.csv.headers, view.headers)
  assert.deepEqual(view.csv.rows, view.rows)
  assert.equal(view.csv.name.includes('.'), false, 'DownloadButton appends the single .csv extension')
  assert.match(view.csv.name, /^reporte-matricula-regular-local-SYN-SIS-A$/)
  assert.ok(!/visado|constancia oficial|pdf/i.test(`${view.csv.name}${view.headers.join('')}`))
})

test('T044: published-derived window origin is labelled distinctly from synthetic', () => {
  assert.equal(buildReportView(enrollmentReport({ windowOrigin: 'published-derived' })).windowOriginLabel,
    'Ventana derivada de calendario publicado')
})

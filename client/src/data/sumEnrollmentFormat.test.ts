import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { MatriculaRegularWindow } from '../../../shared/matricula-regular.mjs'
import { enrollmentReport, syntheticContext } from '../../tests/fixtures/matriculaRegularKit.ts'
import { buildEnrollmentStatus, formatLimaDateTime, formatSumPeriod, SUM_ENROLLMENT_INFO } from './sumEnrollmentFormat.ts'

const windows: MatriculaRegularWindow[] = [
  { id: 'SYN-WINDOW-1', startsAt: '2026-08-11T14:00:00.000Z', endsAt: '2026-08-11T16:00:00.000Z', minPp: 0, origin: 'synthetic', sourceIds: ['L-02'] },
  { id: 'SYN-WINDOW-2', startsAt: '2026-08-10T11:00:00.000Z', endsAt: '2026-08-15T04:55:00.000Z', minPp: 0, origin: 'synthetic', sourceIds: ['L-02'] },
]
const calendar = { publishedRows: [], effectiveWindows: windows, unknownDates: [] }

test('O-UI-01: system date and schedule formats in America/Lima', () => {
  assert.equal(formatLimaDateTime('2026-08-11T14:00:00.000Z', 'system'), '2026-08-11 09:00:00')
  assert.equal(formatLimaDateTime('2026-08-11T14:00:00.000Z', 'schedule'), '11/08/2026 09:00:00')
})

test('midnight in Lima is 00:00:00, never 24:00:00', () => {
  assert.equal(formatLimaDateTime('2026-08-11T05:00:00.000Z', 'system'), '2026-08-11 00:00:00')
})

test('O-UI-01: periods are shown as YYYY-N', () => {
  assert.equal(formatSumPeriod('2026-II'), '2026-2')
  assert.equal(formatSumPeriod('2026-I'), '2026-1')
  assert.equal(formatSumPeriod('2026'), '2026')
})

test('V-01: an eligible actor without enrollment sees the enabled banner, the window span and can start', () => {
  const status = buildEnrollmentStatus(syntheticContext({ calendar }), null)
  assert.deepEqual(status, {
    enabled: true,
    banner: 'MATRICULA INTERNET HABILITADA',
    period: '2026-2',
    systemDate: '2026-08-11 09:00:00',
    start: '10/08/2026 06:00:00',
    end: '14/08/2026 23:55:00',
    enrolled: false,
    canStart: true,
  })
})

test('O-UI-01: an ineligible actor with a committed report sees the disabled banner and the enrollment message', () => {
  const status = buildEnrollmentStatus(syntheticContext({ calendar, eligibility: {
    state: 'ineligible', windowId: null, windowOrigin: null,
    causes: [{ code: 'OUTSIDE_WINDOW', courseIds: [], sectionIds: [], sourceIds: ['L-02'] }], gaps: [],
  } }), enrollmentReport())
  assert.equal(status.banner, 'MATRICULA INTERNET INHABILITADA')
  assert.equal(status.enrolled, true)
  assert.equal(status.canStart, false)
})

test('L-11: an eligible actor that already enrolled cannot start again; missing windows show --', () => {
  const status = buildEnrollmentStatus(syntheticContext(), enrollmentReport())
  assert.equal(status.enabled, true)
  assert.equal(status.canStart, false)
  assert.equal(status.start, '--')
  assert.equal(status.end, '--')
})

test('O-UI-01: the five information sections keep the observed titles', () => {
  assert.equal(SUM_ENROLLMENT_INFO.introduccion, 'Información importante acerca del módulo de Matrícula Vía Web')
  assert.deepEqual(SUM_ENROLLMENT_INFO.secciones.map((section) => section.titulo), [
    'Control de Cronograma de Matrícula', 'Control de Acceso de Facultad', 'Control de Pre-Matrícula',
    'Control de Deudas Registradas', 'Interfaz de Matrícula',
  ])
})

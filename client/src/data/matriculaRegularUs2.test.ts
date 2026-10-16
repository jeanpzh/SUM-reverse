import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  MatriculaRegularPublishedRow,
  MatriculaRegularWindow,
} from '../../../shared/matricula-regular.mjs'
import {
  formatCalendarRows,
  formatEffectiveWindows,
  formatEligibilityState,
  formatSourceClass,
} from './calendarPanel.ts'

const samplePublishedRowsF6: MatriculaRegularPublishedRow[] = [
  { row: 1, groupLabel: '1', day: '2026-08-10', startLocal: '06:00', endLocal: '08:00', ppMin: 17, ppMax: 19, sourceId: 'F6' },
  { row: 2, groupLabel: '2', day: '2026-08-10', startLocal: '08:00', endLocal: '10:00', ppMin: 16, ppMax: 19, sourceId: 'F6' },
  { row: 3, groupLabel: '3', day: '2026-08-10', startLocal: '10:00', endLocal: '12:00', ppMin: 15, ppMax: 19, sourceId: 'F6' },
  { row: 4, groupLabel: '4', day: '2026-08-10', startLocal: '12:00', endLocal: '14:00', ppMin: 14, ppMax: 19, sourceId: 'F6' },
  { row: 5, groupLabel: '5', day: '2026-08-10', startLocal: '14:00', endLocal: '16:00', ppMin: 13, ppMax: 19, sourceId: 'F6' },
  { row: 6, groupLabel: '6', day: '2026-08-10', startLocal: '16:00', endLocal: '18:00', ppMin: 12, ppMax: 19, sourceId: 'F6' },
  { row: 7, groupLabel: '7', day: '2026-08-10', startLocal: '18:00', endLocal: '20:00', ppMin: 11, ppMax: 19, sourceId: 'F6' },
  { row: 8, groupLabel: '6 (repetido)', day: '2026-08-10', startLocal: '20:00', endLocal: '22:00', ppMin: 10, ppMax: 19, sourceId: 'F6' },
  { row: 9, groupLabel: '7 (repetido)', day: '2026-08-10', startLocal: '22:00', endLocal: '23:59', ppMin: 0, ppMax: 19, sourceId: 'F6' },
]

const sampleSyntheticWindows: MatriculaRegularWindow[] = [
  {
    id: 'SYN-WINDOW-1',
    startsAt: '2026-08-11T14:00:00.000Z',
    endsAt: '2026-08-11T16:00:00.000Z',
    minPp: 0,
    origin: 'synthetic',
    sourceIds: ['L-02'],
  },
  {
    id: 'SYN-WINDOW-2',
    startsAt: '2026-08-12T14:00:00.000Z',
    endsAt: '2026-08-12T16:00:00.000Z',
    minPp: 0,
    origin: 'synthetic',
    sourceIds: ['L-02'],
  },
]

test('formatCalendarRows preserves exactly 9 rows of F6 transcription including repeated groups 6 and 7 (AC04, AC06, MAT01-V06)', () => {
  const rows = formatCalendarRows(samplePublishedRowsF6)
  assert.equal(rows.length, 9)

  // Validate exact columns: [Fila, Grupo, Día, Inicio local, Fin local, PP Mínimo, PP Máximo, Fuente]
  assert.deepEqual(rows[0], ['1', '1', '2026-08-10', '06:00', '08:00', '17', '19', 'F6'])
  assert.deepEqual(rows[1], ['2', '2', '2026-08-10', '08:00', '10:00', '16', '19', 'F6'])
  assert.deepEqual(rows[7], ['8', '6 (repetido)', '2026-08-10', '20:00', '22:00', '10', '19', 'F6'])
  assert.deepEqual(rows[8], ['9', '7 (repetido)', '2026-08-10', '22:00', '23:59', '0', '19', 'F6'])
})

test('formatEffectiveWindows projects synthetic test windows preserving origin and isolation from F6 (AC26, AC29, MAT01-V09)', () => {
  const windows = formatEffectiveWindows(sampleSyntheticWindows)
  assert.equal(windows.length, 2)
  assert.deepEqual(windows[0], [
    'SYN-WINDOW-1',
    '2026-08-11T14:00:00.000Z',
    '2026-08-11T16:00:00.000Z',
    '0',
    'synthetic',
    'L-02',
  ])
  assert.deepEqual(windows[1], [
    'SYN-WINDOW-2',
    '2026-08-12T14:00:00.000Z',
    '2026-08-12T16:00:00.000Z',
    '0',
    'synthetic',
    'L-02',
  ])
})

test('formatEligibilityState distinguishes eligible, ineligible, and configuration-pending without defaulting null PP to 0 (AC05, AC06, AC25, AC28)', () => {
  // Eligible state
  const eligibleStatus = formatEligibilityState({
    state: 'eligible',
    windowId: 'SYN-WINDOW-1',
    windowOrigin: 'synthetic',
    causes: [],
    gaps: [],
  })
  assert.equal(eligibleStatus.label, 'Habilitado para selección')
  assert.equal(eligibleStatus.variant, 'eligible')

  // Ineligible state (e.g. OUTSIDE_WINDOW)
  const ineligibleStatus = formatEligibilityState({
    state: 'ineligible',
    windowId: null,
    windowOrigin: null,
    causes: [{ code: 'OUTSIDE_WINDOW', courseIds: [], sectionIds: [], sourceIds: ['F6'] }],
    gaps: [],
  })
  assert.equal(ineligibleStatus.label, 'No habilitado por turno o condiciones')
  assert.equal(ineligibleStatus.variant, 'ineligible')

  // Configuration-pending state (e.g. WINDOW_UNSPECIFIED or PROFILE_MISSING)
  const pendingStatus = formatEligibilityState({
    state: 'configuration-pending',
    windowId: null,
    windowOrigin: null,
    causes: [],
    gaps: [{ code: 'WINDOW_UNSPECIFIED', courseIds: [], sourceIds: ['F6'] }],
  })
  assert.equal(pendingStatus.label, 'Pendiente de configuración (gap)')
  assert.equal(pendingStatus.variant, 'pending')
})

test('formatSourceClass distinguishes normative, observed, testimony, inferred and null (local-decision) (Constitution II/IV)', () => {
  assert.equal(formatSourceClass('normative'), 'Normativa')
  assert.equal(formatSourceClass('observed'), 'Observada')
  assert.equal(formatSourceClass('testimony'), 'Testimonio')
  assert.equal(formatSourceClass('inferred'), 'Inferencia')
  assert.equal(formatSourceClass(null), 'Decisión local')
})

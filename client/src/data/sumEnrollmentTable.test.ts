import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { MatriculaRegularOfferedCourse } from '../../../shared/matricula-regular.mjs'
import { syntheticContext } from '../../tests/fixtures/matriculaRegularKit.ts'
import {
  buildEnrollmentRows, buildSectionOptions, chooseSection, filterEnrollmentRows, removeChoice, summarizeSelection,
} from './sumEnrollmentTable.ts'

function withDisplay() {
  const base = syntheticContext()
  const offer: MatriculaRegularOfferedCourse[] = [
    { ...base.offer[0]!, cycle: 3, courseType: 'mandatory',
      sections: [{ ...base.offer[0]!.sections[0]!, label: '1', teacher: 'SINTÉTICO, DOCENTE UNO', room: null }] },
    { ...base.offer[1]!, name: 'Inglés técnico', cycle: 1, courseType: 'elective' },
  ]
  return syntheticContext({ offer, retakeCourseIds: ['SYN-SIS-C1'], creditCap: 26 })
}

test('V-02: rows are ordered by cycle and show type, code - name and the (*) of mandatory retakes', () => {
  const rows = buildEnrollmentRows(withDisplay(), [])
  assert.deepEqual(rows.map((row) => [row.cycle, row.type, row.subject, row.credits, row.mandatory, row.chosenSection]), [
    ['1', 'E - Electivo', 'SYN-SIS-C2 - Inglés técnico', 3, false, null],
    ['3', 'O - Obligatorio', 'SYN-SIS-C1 - Asignatura sintética 1 (*)', 4, true, null],
  ])
})

test('MR2 contexts without display fields render -- and keep the offer order', () => {
  const rows = buildEnrollmentRows(syntheticContext(), [{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' }])
  assert.deepEqual(rows.map((row) => [row.courseId, row.cycle, row.type, row.chosenSection]), [
    ['SYN-SIS-C1', '--', '--', 'SYN-SIS-S1'],
    ['SYN-SIS-C2', '--', '--', null],
  ])
})

test('V-05: the chosen section shows its label', () => {
  const rows = buildEnrollmentRows(withDisplay(), [{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' }])
  assert.equal(rows.find((row) => row.courseId === 'SYN-SIS-C1')!.chosenSection, '1')
})

test('incomplete pre-enrollment or offer yields no selectable rows', () => {
  assert.deepEqual(buildEnrollmentRows(syntheticContext({ preEnrollmentComplete: false }), []), [])
  assert.deepEqual(buildEnrollmentRows(syntheticContext({ offerKnown: false }), []), [])
})

test('search ignores case and accents (L-12)', () => {
  const rows = buildEnrollmentRows(withDisplay(), [])
  assert.deepEqual(filterEnrollmentRows(rows, 'ingles').map((row) => row.courseId), ['SYN-SIS-C2'])
  assert.deepEqual(filterEnrollmentRows(rows, 'INGLÉS').map((row) => row.courseId), ['SYN-SIS-C2'])
  assert.equal(filterEnrollmentRows(rows, '   ').length, 2)
  assert.equal(filterEnrollmentRows(rows, 'zzz').length, 0)
})

test('V-04: section options show label, room, teacher, occupancy and schedule', () => {
  const context = withDisplay()
  assert.deepEqual(buildSectionOptions(context.offer[0]!), [{
    sectionId: 'SYN-SIS-S1', label: '1', room: '-', teacher: 'SINTÉTICO, DOCENTE UNO', occupancy: '0 / 1', schedule: 'Lun 08:00-09:00',
  }])
})

test('full sections stay selectable: the vacancy rejection only arrives on execute', () => {
  const [option] = buildSectionOptions(syntheticContext().offer[1]!)
  assert.equal(option!.occupancy, '2 / 2')
  assert.equal(option!.label, 'SYN-SIS-S2')
  assert.equal(option!.teacher, '-')
  assert.equal(option!.room, '-')
  assert.equal('disabled' in option!, false)
})

test('choose replaces the course section, remove drops it and the totals follow (V-05)', () => {
  const chosen = chooseSection([{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' }], 'SYN-SIS-C1', 'SYN-SIS-S9')
  assert.deepEqual(chosen, [{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S9' }])
  const both = chooseSection([{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' }], 'SYN-SIS-C2', 'SYN-SIS-S2')
  assert.deepEqual(summarizeSelection(withDisplay(), both), { creditCap: '26', credits: 7, courses: 2 })
  assert.deepEqual(removeChoice(both, 'SYN-SIS-C1'), [{ courseId: 'SYN-SIS-C2', sectionId: 'SYN-SIS-S2' }])
  assert.equal(summarizeSelection(syntheticContext(), []).creditCap, '--')
})

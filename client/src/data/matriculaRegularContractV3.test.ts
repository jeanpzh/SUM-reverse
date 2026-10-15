import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateContext, validateEnrollmentReport } from '../../../shared/matricula-regular.mjs'
import { enrollmentReport, syntheticContext } from '../../tests/fixtures/matriculaRegularKit.ts'

const v3Offer = () => syntheticContext().offer.map((course, index) => ({
  ...course,
  cycle: index + 1,
  courseType: 'mandatory' as const,
  sections: course.sections.map((section) => ({ ...section, label: String(index + 1), teacher: 'SINTÉTICO, DOCENTE UNO', room: null })),
}))

test('MR3: an MR-CONTRACT-2 context without the optional fields stays valid', () => {
  assert.doesNotThrow(() => validateContext(syntheticContext()))
})

test('MR3: cycle, courseType, label, teacher, room, retakeCourseIds and creditCap are accepted', () => {
  assert.doesNotThrow(() => validateContext(syntheticContext({ offer: v3Offer(), retakeCourseIds: ['SYN-SIS-C1'], creditCap: 26 })))
  assert.doesNotThrow(() => validateContext(syntheticContext({ retakeCourseIds: [], creditCap: null })))
})

test('MR3: malformed optional fields and undeclared keys are rejected', () => {
  const cases: Array<[string, unknown]> = [
    ['cycle 0', syntheticContext({ offer: v3Offer().map((course) => ({ ...course, cycle: 0 })) })],
    ['courseType O', { ...syntheticContext(), offer: v3Offer().map((course) => ({ ...course, courseType: 'O' })) }],
    ['empty teacher', syntheticContext({ offer: v3Offer().map((course) => ({ ...course,
      sections: course.sections.map((section) => ({ ...section, teacher: '' })) })) })],
    ['empty label', syntheticContext({ offer: v3Offer().map((course) => ({ ...course,
      sections: course.sections.map((section) => ({ ...section, label: '' })) })) })],
    ['unsorted retake', syntheticContext({ retakeCourseIds: ['SYN-SIS-C2', 'SYN-SIS-C1'] })],
    ['retake not offered', syntheticContext({ retakeCourseIds: ['SYN-SIS-C9'] })],
    ['creditCap 0', syntheticContext({ creditCap: 0 })],
    ['undeclared key', { ...syntheticContext(), extra: true }],
  ]
  for (const [name, value] of cases) assert.throws(() => validateContext(value), TypeError, name)
})

test('MR3: report rows accept cycle, label and teacher; an empty teacher is rejected', () => {
  const report = enrollmentReport()
  const rows = report.rows.map((row, index) => ({
    ...row, cycle: index + 1, label: String(index + 1), teacher: index === 0 ? null : 'SINTÉTICO, DOCENTE DOS',
  }))
  assert.doesNotThrow(() => validateEnrollmentReport({ ...report, rows }))
  assert.throws(() => validateEnrollmentReport({ ...report, rows: rows.map((row) => ({ ...row, teacher: '' })) }), TypeError)
})

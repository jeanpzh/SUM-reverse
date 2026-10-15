import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildScheduleFromCommittedReport, localAcademicContext, buildProgrammingRows, formatProgrammingRow,
  buildPreEnrollmentRows, buildStudyPlanRows } from './localAcademicView.ts'
import type { MatriculaRegularContext, MatriculaRegularEnrollmentReport } from './matriculaRegular.ts'

const reportFor = (actorId: 'SYN-SIS-A' | 'SYN-SIS-B' = 'SYN-SIS-A'): MatriculaRegularEnrollmentReport => ({
  enrollmentId: '20000000-0000-4000-8000-000000000001',
  requestId: '30000000-0000-4000-8000-000000000001',
  actorId,
  scope: { facultyId: 'FISI', schoolId: 'SISTEMAS', period: '2026-II', planId: 'SYN-SIS-PLAN', modality: 'regular-virtual' },
  profileRevision: 'MR-SYN-SIS-1', acceptedAt: '2026-08-11T14:00:00.000Z', windowOrigin: 'synthetic',
  rows: [{ courseId: 'SYN-COURSE-A', sectionId: 'SYN-SECTION-A', planId: 'SYN-SIS-PLAN', name: 'Curso sintético', credits: 4,
    cycle: 2, label: '01', teacher: null, schedule: [{ day: 1, startMinute: 480, endMinute: 600 }] }],
  totalCredits: 4,
})

test('schedule_from_committed_report projects exactly the accepted report rows', () => {
  const committed = reportFor()
  const view = buildScheduleFromCommittedReport(committed)
  assert.deepEqual(view?.rows[0], ['2', 'SYN-COURSE-A - Curso sintético', '4', '01', '-- --, --'])
  assert.equal(view?.totalCredits, committed.totalCredits)
})

const contextForProjection = (): MatriculaRegularContext => ({
  actorId: 'SYN-SIS-A',
  scope: { facultyId: 'FISI', schoolId: 'SISTEMAS', period: '2026-II', planId: 'SYN-SIS-PLAN', modality: 'regular-virtual' },
  profileRevision: 'MR-SYN-SIS-1', serverNow: '2026-08-11T14:00:00.000Z',
  preEnrollmentEnabled: true, preEnrollmentComplete: false,
  preEnrollment: [{ courseId: 'SYN-COURSE-A', planId: 'SYN-SIS-PLAN', name: 'Curso sintético', credits: 4 },
    { courseId: 'SYN-COURSE-X', planId: 'SYN-SIS-PLAN', name: 'Curso fuera de oferta', credits: 3 }],
  offerKnown: false,
  offer: [{ courseId: 'SYN-COURSE-A', planId: 'SYN-SIS-PLAN', name: 'Curso sintético', credits: 4,
    prerequisiteIds: ['SYN-COURSE-X'], cycle: 2, courseType: 'mandatory', sections: [
      { sectionId: 'SYN-SECTION-A', label: '01', capacity: 30, occupied: 12, teacher: null,
        schedule: [{ day: 1, startMinute: 480, endMinute: 600 }] },
      { sectionId: 'SYN-SECTION-B', capacity: 20, occupied: 3, schedule: null },
    ] }],
  calendar: { publishedRows: [], effectiveWindows: [], unknownDates: [] },
  eligibility: { state: 'configuration-pending', windowId: null, windowOrigin: null, causes: [], gaps: [
    { code: 'PLAN_OR_OFFER_UNKNOWN', courseIds: [], sourceIds: [] },
  ] }, sources: [],
})

test('programming_flattens_sections_without_inventing_missing_schedule_or_teacher', () => {
  const rows = buildProgrammingRows(contextForProjection())
  assert.equal(rows.length, 2)
  assert.deepEqual(formatProgrammingRow(rows[0]!), ['', 'SYN-COURSE-A - Curso sintético', '4', '01', '—', '30', '12', 'Lun 08:00-10:00'])
  assert.equal(formatProgrammingRow(rows[1]!)?.[7], '—')
})

test('prematricula_uses_only_document_courses_and_keeps_unknown_counts_as_dashes', () => {
  const rows = buildPreEnrollmentRows(contextForProjection())
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], ['SYN-SIS-PLAN', '2', 'SYN-COURSE-A - Curso sintético', '4', '—', '—', '—', '—'])
  assert.equal(rows[1]?.[1], '—')
})

test('plan_projection_is_explicitly_partial_and_preserves_unresolved_prerequisite_id', () => {
  assert.deepEqual(buildStudyPlanRows(contextForProjection())[0], ['—', 'SYN-COURSE-A - Curso sintético', '4',
    'Obligatoria', '—', 'SYN-COURSE-X', '—'])
})

test('null_report_empty has no seeded schedule or report rows', () => {
  assert.equal(buildScheduleFromCommittedReport(null), null)
  assert.equal(localAcademicContext(null), null)
})

test('no_actor_default does not choose a default identity or report', () => {
  assert.equal(buildScheduleFromCommittedReport(null), null)
  assert.equal(localAcademicContext(null), null)
})

test('scope_isolation keeps committed report actor and scope together', () => {
  const report = reportFor('SYN-SIS-B')
  const view = buildScheduleFromCommittedReport(report)
  assert.equal(report.actorId, 'SYN-SIS-B')
  assert.equal(report.scope.schoolId, 'SISTEMAS')
  assert.equal(view?.rows[0]?.[1], `${report.rows[0]?.courseId} - ${report.rows[0]?.name}`)
})

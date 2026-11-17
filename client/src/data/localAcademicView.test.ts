import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildScheduleFromCommittedReport, localAcademicContext, buildProgrammingRows, formatProgrammingRow,
  buildPreEnrollmentRows, buildStudyPlanRows, buildScheduleEvents, buildProgrammingScheduleDialog,
  resolveScheduleReferenceNow } from './localAcademicView.ts'
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

test('D2: buildScheduleEvents derives sessionType, room and teacher from meeting.details and preserves legacy dash without details', () => {
  const legacyEvents = buildScheduleEvents(reportFor())
  assert.deepEqual(legacyEvents, [{
    day: 1,
    start: 480,
    end: 600,
    course: 'Curso sintético',
    section: '01',
    kind: '—',
    time: '08:00-10:00',
  }])

  const detailedReport: MatriculaRegularEnrollmentReport = {
    ...reportFor(),
    rows: [{
      courseId: 'SYN-COURSE-A',
      sectionId: 'SYN-SECTION-A',
      planId: 'SYN-SIS-PLAN',
      name: 'Algoritmos',
      credits: 4,
      cycle: 3,
      label: '1',
      teacher: 'DOCENTE A / DOCENTE B',
      schedule: [
        {
          day: 1,
          startMinute: 480,
          endMinute: 600,
          details: { sessionId: 's1', teacherId: 't1', teacherName: 'DOCENTE A', roomId: 'r1', roomName: 'Aula 101', sessionType: 'T' },
        },
        {
          day: 3,
          startMinute: 480,
          endMinute: 600,
          details: { sessionId: 's2', teacherId: 't1', teacherName: 'DOCENTE A', roomId: 'r1', roomName: 'Aula 101', sessionType: 'P' },
        },
        {
          day: 5,
          startMinute: 840,
          endMinute: 960,
          details: { sessionId: 's3', teacherId: 't2', teacherName: 'DOCENTE B', roomId: 'r2', roomName: 'Lab 2', sessionType: 'L' },
        },
        {
          day: 6,
          startMinute: 600,
          endMinute: 660,
          details: { sessionId: 's4', teacherId: 't2', teacherName: 'DOCENTE B', roomId: 'r2', roomName: 'Lab 2' },
        },
      ],
    }],
  }

  assert.deepEqual(buildScheduleEvents(detailedReport), [
    { day: 1, start: 480, end: 600, course: 'Algoritmos', section: '1', kind: 'Teoría · Aula 101', time: '08:00-10:00', sessionType: 'Teoría', room: 'Aula 101', teacher: 'DOCENTE A' },
    { day: 3, start: 480, end: 600, course: 'Algoritmos', section: '1', kind: 'Práctica · Aula 101', time: '08:00-10:00', sessionType: 'Práctica', room: 'Aula 101', teacher: 'DOCENTE A' },
    { day: 5, start: 840, end: 960, course: 'Algoritmos', section: '1', kind: 'Laboratorio · Lab 2', time: '14:00-16:00', sessionType: 'Laboratorio', room: 'Lab 2', teacher: 'DOCENTE B' },
    { day: 6, start: 600, end: 660, course: 'Algoritmos', section: '1', kind: 'Lab 2', time: '10:00-11:00', room: 'Lab 2', teacher: 'DOCENTE B' },
  ])
})

test('D2: buildProgrammingScheduleDialog shows per-session type, room and teacher when details exist and keeps 2 columns for legacy', () => {
  const legacyDialog = buildProgrammingScheduleDialog(contextForProjection().offer[0]!.sections[0]!)
  assert.deepEqual(legacyDialog, {
    headers: ['Día', 'Horas de clase'],
    rows: [['Lunes', '08:00-10:00']],
  })

  const detailedDialog = buildProgrammingScheduleDialog({
    sectionId: 'SYN-SECTION-D2',
    label: '1',
    capacity: 30,
    occupied: 10,
    teacher: 'DOCENTE A / DOCENTE B',
    room: 'Aula 101 / Lab 2',
    schedule: [
      {
        day: 1,
        startMinute: 480,
        endMinute: 600,
        details: { sessionId: 's1', teacherId: 't1', teacherName: 'DOCENTE A', roomId: 'r1', roomName: 'Aula 101', sessionType: 'T' },
      },
      {
        day: 5,
        startMinute: 840,
        endMinute: 960,
        details: { sessionId: 's2', teacherId: 't2', teacherName: 'DOCENTE B', roomId: 'r2', roomName: 'Lab 2', sessionType: 'L' },
      },
    ],
  })
  assert.deepEqual(detailedDialog, {
    headers: ['Día', 'Horas de clase', 'Tipo', 'Aula', 'Docente'],
    rows: [
      ['Lunes', '08:00-10:00', 'Teoría', 'Aula 101', 'DOCENTE A'],
      ['Viernes', '14:00-16:00', 'Laboratorio', 'Lab 2', 'DOCENTE B'],
    ],
  })
})

test('G: resolveScheduleReferenceNow prefers serverNow, falls back to report.acceptedAt, and returns null without valid context clock', () => {
  const marchReport: MatriculaRegularEnrollmentReport = {
    ...reportFor(),
    acceptedAt: '2027-03-09T14:45:00.000Z',
  }
  assert.equal(resolveScheduleReferenceNow(marchReport, '2027-03-10T15:30:00.000Z'), '2027-03-10T15:30:00.000Z')
  assert.equal(resolveScheduleReferenceNow(null, '2027-03-10T15:30:00.000Z'), '2027-03-10T15:30:00.000Z')
  assert.equal(resolveScheduleReferenceNow(marchReport, undefined), '2027-03-09T14:45:00.000Z')
  assert.equal(resolveScheduleReferenceNow(marchReport, null), '2027-03-09T14:45:00.000Z')
  assert.equal(resolveScheduleReferenceNow(marchReport, 'not-a-date'), '2027-03-09T14:45:00.000Z')
  assert.equal(resolveScheduleReferenceNow(null, null), null)
  assert.equal(resolveScheduleReferenceNow({ ...marchReport, acceptedAt: 'invalid' }, undefined), null)
})



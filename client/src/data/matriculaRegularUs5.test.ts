import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  MatriculaRegularOutcome,
} from '../../../shared/matricula-regular.mjs'
import {
  formatAcceptedSummary,
  formatOutcomeCauses,
  getDialogKind,
  isAcceptedOutcome,
  isRejectedAcademicOutcome,
} from './enrollmentResultDialog.ts'

const sampleAcceptedSistemas: MatriculaRegularOutcome = {
  requestId: '11111111-1111-4111-8111-111111111111',
  actorId: 'SYN-SIS-A',
  profileRevision: 'MR-SYN-SIS-1',
  state: 'accepted',
  evaluatedAt: '2026-08-11T15:00:00.000Z',
  windowOrigin: 'synthetic',
  selection: [
    { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
    { courseId: 'SYN-SIS-C2', sectionId: 'SYN-SIS-S2' },
  ],
  causes: [],
  gaps: [],
  enrollmentId: '22222222-2222-4222-8222-222222222222',
  reportPath: '/local/matricula-regular/v1/reportes/22222222-2222-4222-8222-222222222222',
}

const sampleAcceptedSoftware: MatriculaRegularOutcome = {
  requestId: '33333333-3333-4333-8333-333333333333',
  actorId: 'SYN-SOFT-A',
  profileRevision: 'MR-SYN-SOFT-1',
  state: 'accepted',
  evaluatedAt: '2026-08-11T15:00:00.000Z',
  windowOrigin: 'synthetic',
  selection: [
    { courseId: 'SYN-SOFT-C1', sectionId: 'SYN-SOFT-S1' },
  ],
  causes: [],
  gaps: [],
  enrollmentId: '44444444-4444-4444-8444-444444444444',
  reportPath: '/local/matricula-regular/v1/reportes/44444444-4444-4444-8444-444444444444',
}

const sampleRejectedSistemas: MatriculaRegularOutcome = {
  requestId: '55555555-5555-4555-8555-555555555555',
  actorId: 'SYN-SIS-A',
  profileRevision: 'MR-SYN-SIS-1',
  state: 'rejected',
  evaluatedAt: '2026-08-11T15:01:00.000Z',
  windowOrigin: 'synthetic',
  selection: [
    { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
    { courseId: 'SYN-SIS-C2', sectionId: 'SYN-SIS-S2' },
  ],
  causes: [
    {
      code: 'SCHEDULE_CONFLICT',
      courseIds: ['SYN-SIS-C1', 'SYN-SIS-C2'],
      sectionIds: ['SYN-SIS-S1', 'SYN-SIS-S2'],
      sourceIds: ['L-01'],
    },
    {
      code: 'SECTION_FULL',
      courseIds: ['SYN-SIS-C2'],
      sectionIds: ['SYN-SIS-S2'],
      sourceIds: ['L-01'],
    },
  ],
  gaps: [],
  enrollmentId: null,
  reportPath: null,
}

const samplePendingOutcome: MatriculaRegularOutcome = {
  requestId: '66666666-6666-4666-8666-666666666666',
  actorId: 'SYN-SIS-A',
  profileRevision: 'MR-SYN-SIS-1',
  state: 'configuration-pending',
  evaluatedAt: '2026-08-11T15:02:00.000Z',
  windowOrigin: null,
  selection: [
    { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
  ],
  causes: [],
  gaps: [
    {
      code: 'PLAN_OR_OFFER_UNKNOWN',
      courseIds: ['SYN-SIS-C1'],
      sourceIds: ['L-01'],
    },
  ],
  enrollmentId: null,
  reportPath: null,
}

test('isAcceptedOutcome strictly verifies accepted outcome invariant (AC17, AC18, D1)', () => {
  assert.equal(isAcceptedOutcome(sampleAcceptedSistemas), true)
  assert.equal(isAcceptedOutcome(sampleAcceptedSoftware), true)

  // Must reject if enrollmentId or reportPath is missing
  const missingReport: MatriculaRegularOutcome = {
    ...sampleAcceptedSistemas,
    reportPath: null,
  }
  assert.equal(isAcceptedOutcome(missingReport), false)

  // Must reject if causes exist
  const withCauses: MatriculaRegularOutcome = {
    ...sampleAcceptedSistemas,
    causes: [
      { code: 'SCHEDULE_CONFLICT', courseIds: [], sectionIds: [], sourceIds: [] },
    ],
  }
  assert.equal(isAcceptedOutcome(withCauses), false)

  // Must reject null outcome
  assert.equal(isAcceptedOutcome(null), false)
})

test('isRejectedAcademicOutcome strictly verifies academic rejection invariant (AC14, AC16, AC21, D2)', () => {
  assert.equal(isRejectedAcademicOutcome(sampleRejectedSistemas), true)

  // Must reject if causes are empty
  const emptyCauses: MatriculaRegularOutcome = {
    ...sampleRejectedSistemas,
    causes: [],
  }
  assert.equal(isRejectedAcademicOutcome(emptyCauses), false)

  // Must reject if enrollmentId is present
  const withEnrollment: MatriculaRegularOutcome = {
    ...sampleRejectedSistemas,
    enrollmentId: '22222222-2222-4222-8222-222222222222',
  }
  assert.equal(isRejectedAcademicOutcome(withEnrollment), false)

  // Must reject if gaps are present (configuration-pending is not an academic rejection)
  const withGaps: MatriculaRegularOutcome = {
    ...sampleRejectedSistemas,
    gaps: [
      { code: 'EXCEPTION_UNKNOWN', courseIds: [], sourceIds: [] },
    ],
  }
  assert.equal(isRejectedAcademicOutcome(withGaps), false)

  // Must reject null
  assert.equal(isRejectedAcademicOutcome(null), false)
})

test('getDialogKind returns D1 for accepted and D2 for rejected, but null for pending or uncertain (C-T037)', () => {
  assert.equal(getDialogKind(sampleAcceptedSistemas), 'accepted')
  assert.equal(getDialogKind(sampleAcceptedSoftware), 'accepted')
  assert.equal(getDialogKind(sampleRejectedSistemas), 'rejected')

  // Pending outcome must return null (No modal dialog for pending)
  assert.equal(getDialogKind(samplePendingOutcome), null)

  // Null outcome must return null
  assert.equal(getDialogKind(null), null)
})

test('formatOutcomeCauses presents simultaneous causes as a set without imposing arbitrary precedence (AC27)', () => {
  const causes = formatOutcomeCauses(sampleRejectedSistemas.causes)
  assert.equal(causes.length, 2)

  assert.equal(causes[0]?.code, 'SCHEDULE_CONFLICT')
  assert.equal(causes[0]?.title, 'Cruce de horarios detectado')
  assert.ok(causes[0]?.coursesSummary?.includes('SYN-SIS-C1, SYN-SIS-C2'))
  assert.ok(causes[0]?.sectionsSummary?.includes('SYN-SIS-S1, SYN-SIS-S2'))

  assert.equal(causes[1]?.code, 'SECTION_FULL')
  assert.equal(causes[1]?.title, 'Sección sin vacantes disponibles')
  assert.ok(causes[1]?.coursesSummary?.includes('SYN-SIS-C2'))
  assert.ok(causes[1]?.sectionsSummary?.includes('SYN-SIS-S2'))
})

test('formatAcceptedSummary extracts courseCount, enrollmentId and reportPath without exposing internal debug UUIDs (AC18, C-T037)', () => {
  if (!isAcceptedOutcome(sampleAcceptedSistemas)) {
    assert.fail('Expected sampleAcceptedSistemas to be accepted outcome')
  }
  const summary = formatAcceptedSummary(sampleAcceptedSistemas)
  assert.equal(summary.courseCount, 2)
  assert.equal(summary.enrollmentId, '22222222-2222-4222-8222-222222222222')
  assert.equal(summary.reportPath, '/local/matricula-regular/v1/reportes/22222222-2222-4222-8222-222222222222')

  // Verify internal requestId is not part of summary
  assert.equal('requestId' in summary, false)
})

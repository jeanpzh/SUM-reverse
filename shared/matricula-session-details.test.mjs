import assert from 'node:assert/strict'
import test from 'node:test'
import {
  matriculaRegularSessionTypes,
  validateContext,
  validateEnrollmentReport,
  validateMeeting,
} from './matricula-regular.mjs'

const runId = '10000000-0000-4000-8000-000000000001'
const enrollmentId = '20000000-0000-4000-8000-000000000001'
const requestId = '30000000-0000-4000-8000-000000000001'

function baseMeeting(details) {
  return {
    day: 1,
    startMinute: 480,
    endMinute: 600,
    ...(details === undefined ? {} : { details }),
  }
}

function baseContext(meetings) {
  return {
    actorId: 'SYN-SIS-A',
    scope: {
      facultyId: 'FISI',
      schoolId: 'SISTEMAS',
      period: '2027-I',
      planId: 'SYN-SIS-PLAN',
      modality: 'regular-virtual',
    },
    profileRevision: 'MR-TEST-1',
    serverNow: '2027-03-02T03:30:00.000Z',
    preEnrollmentEnabled: true,
    preEnrollmentComplete: true,
    preEnrollment: [{ courseId: 'SYN-SIS-C09', planId: 'SYN-SIS-PLAN', name: 'Curso 1', credits: 3 }],
    offerKnown: true,
    offer: [
      {
        courseId: 'SYN-SIS-C09',
        planId: 'SYN-SIS-PLAN',
        name: 'Curso 1',
        credits: 3,
        prerequisiteIds: [],
        sections: [
          {
            sectionId: 'SYN-SIS-S1',
            capacity: 30,
            occupied: 0,
            schedule: meetings,
            label: '1',
            teacher: 'Docente A / Docente B',
            room: 'Aula 101 / Lab 202',
          },
        ],
      },
    ],
    calendar: {
      publishedRows: [],
      effectiveWindows: [
        {
          id: 'SYN-WIN-1',
          startsAt: '2027-03-01T00:00:00.000Z',
          endsAt: '2027-03-05T00:00:00.000Z',
          minPp: 0,
          origin: 'synthetic',
          sourceIds: ['E3-PUBLICATION-1'],
        },
      ],
      unknownDates: [],
    },
    eligibility: {
      state: 'eligible',
      windowId: 'SYN-WIN-1',
      windowOrigin: 'synthetic',
      causes: [],
      gaps: [],
    },
    sources: [
      {
        id: 'E3-PUBLICATION-1',
        origin: 'local-decision',
        class: null,
        reference: 'docs/reverse-engineering/contracts/local-api/matricula-regular.md#MR-SESSION-DETAILS-1',
        date: '2026-11-17',
        status: 'local-only',
      },
    ],
  }
}

function baseReport(meetings) {
  return {
    enrollmentId,
    requestId,
    actorId: 'SYN-SIS-A',
    scope: {
      facultyId: 'FISI',
      schoolId: 'SISTEMAS',
      period: '2027-I',
      planId: 'SYN-SIS-PLAN',
      modality: 'regular-virtual',
    },
    profileRevision: 'MR-TEST-1',
    acceptedAt: '2027-03-02T03:30:00.000Z',
    windowOrigin: 'synthetic',
    rows: [
      {
        courseId: 'SYN-SIS-C09',
        sectionId: 'SYN-SIS-S1',
        planId: 'SYN-SIS-PLAN',
        name: 'Curso 1',
        credits: 3,
        schedule: meetings,
        label: '1',
        teacher: 'Docente A / Docente B',
      },
    ],
    totalCredits: 3,
  }
}

test('exposes MR-SESSION-DETAILS-1 session types and accepts legacy meetings without details', () => {
  assert.deepEqual(matriculaRegularSessionTypes, ['T', 'P', 'L'])
  const legacy = [baseMeeting()]
  assert.doesNotThrow(() => validateMeeting(legacy[0]))
  assert.doesNotThrow(() => validateContext(baseContext(legacy)))
  assert.doesNotThrow(() => validateEnrollmentReport(baseReport(legacy)))
})

test('accepts planner-originated non-SYN IDs with and without explicit sessionType in context and report', () => {
  const meetings = [
    {
      day: 1,
      startMinute: 480,
      endMinute: 600,
      details: {
        sessionId: '20118031-SEC-1-S-1',
        teacherId: 'DOC-A',
        teacherName: 'Docente Sintético Uno',
        roomId: 'AULA-101',
        roomName: 'Aula 101 AP',
        sessionType: 'T',
      },
    },
    {
      day: 1,
      startMinute: 600,
      endMinute: 720,
      details: {
        sessionId: '20118031-SEC-1-S-2',
        teacherId: 'DOC-A',
        teacherName: 'Docente Sintético Uno',
        roomId: 'AULA-101',
        roomName: 'Aula 101 AP',
        sessionType: 'P',
      },
    },
    {
      day: 4,
      startMinute: 600,
      endMinute: 720,
      details: {
        sessionId: '20118031-SEC-1-S-3',
        teacherId: 'DOC-B',
        teacherName: 'Docente Sintético Dos',
        roomId: 'LAB-202',
        roomName: 'Lab 202 AP',
        sessionType: 'L',
      },
    },
    {
      day: 5,
      startMinute: 480,
      endMinute: 600,
      details: {
        sessionId: 'untyped-session-4',
        teacherId: 'teacher-raw-4',
        teacherName: 'Docente Sin Tipo Explícito',
        roomId: 'room-raw-4',
        roomName: 'Ambiente Sin Tipo',
      },
    },
  ]

  for (const item of meetings) assert.doesNotThrow(() => validateMeeting(item))
  assert.doesNotThrow(() => validateContext(baseContext(meetings)))
  assert.doesNotThrow(() => validateEnrollmentReport(baseReport(meetings)))
})

test('rejects malformed, partial, blank, wrong-type, invalid sessionType, and extra-key meeting details', () => {
  const validDetails = {
    sessionId: 'sec-1-s1',
    teacherId: 'doc-1',
    teacherName: 'Docente Uno',
    roomId: 'room-1',
    roomName: 'Aula 101',
    sessionType: 'T',
  }

  const invalidMeetings = [
    { day: 1, startMinute: 480, endMinute: 600, details: null },
    { day: 1, startMinute: 480, endMinute: 600, details: undefined },
    { day: 1, startMinute: 480, endMinute: 600, details: 'bad' },
    { day: 1, startMinute: 480, endMinute: 600, details: [] },
    { day: 1, startMinute: 480, endMinute: 600, extra: 'nope' },
    { day: 1, startMinute: 480, endMinute: 600, details: { ...validDetails, extra: 'nope' } },
    ...(['sessionId', 'teacherId', 'teacherName', 'roomId', 'roomName'].flatMap((field) => {
      const missing = { ...validDetails }
      delete missing[field]
      return [
        baseMeeting(missing),
        baseMeeting({ ...validDetails, [field]: '' }),
        baseMeeting({ ...validDetails, [field]: '   ' }),
        baseMeeting({ ...validDetails, [field]: 123 }),
        baseMeeting({ ...validDetails, [field]: null }),
      ]
    })),
    baseMeeting({ ...validDetails, sessionType: 'X' }),
    baseMeeting({ ...validDetails, sessionType: 't' }),
    baseMeeting({ ...validDetails, sessionType: '' }),
    baseMeeting({ ...validDetails, sessionType: '   ' }),
    baseMeeting({ ...validDetails, sessionType: null }),
    baseMeeting({ ...validDetails, sessionType: undefined }),
    baseMeeting({ ...validDetails, sessionType: 1 }),
  ]

  assert.ok(runId.length > 0)
  for (const invalid of invalidMeetings) {
    assert.throws(() => validateMeeting(invalid))
    assert.throws(() => validateContext(baseContext([invalid])))
    assert.throws(() => validateEnrollmentReport(baseReport([invalid])))
  }
})

import type { MatriculaRegularContext } from '../../../shared/matricula-regular.mjs'

/** Independent synthetic Context for SSR/unit checks. Not produced by AppModule, snapshots or the backend factories. */
export function syntheticContext(overrides: Partial<MatriculaRegularContext> = {}): MatriculaRegularContext {
  return {
    actorId: 'SYN-SIS-A',
    scope: { facultyId: 'FISI', schoolId: 'SISTEMAS', period: '2026-II', planId: 'SYN-PLAN-SIS', modality: 'regular-virtual' },
    profileRevision: 'MR-SYN-SIS-1',
    serverNow: '2026-08-11T15:00:00.000Z',
    preEnrollmentEnabled: true,
    preEnrollmentComplete: true,
    preEnrollment: [
      { courseId: 'SYN-SIS-C1', planId: 'SYN-PLAN-SIS', name: 'Curso sintético 1', credits: 4 },
      { courseId: 'SYN-SIS-C2', planId: 'SYN-PLAN-SIS', name: 'Curso sintético 2', credits: 3 },
    ],
    offerKnown: true,
    offer: [
      {
        courseId: 'SYN-SIS-C1', planId: 'SYN-PLAN-SIS', name: 'Curso sintético 1', credits: 4, prerequisiteIds: [],
        sections: [{ sectionId: 'SYN-SIS-S1', capacity: 30, occupied: 0, schedule: [{ day: 1, startMinute: 480, endMinute: 600 }] }],
      },
      {
        courseId: 'SYN-SIS-C2', planId: 'SYN-PLAN-SIS', name: 'Curso sintético 2', credits: 3, prerequisiteIds: [],
        sections: [{ sectionId: 'SYN-SIS-S2', capacity: 30, occupied: 0, schedule: [{ day: 2, startMinute: 600, endMinute: 720 }] }],
      },
    ],
    calendar: {
      publishedRows: [],
      effectiveWindows: [{
        id: 'SYN-WINDOW-1', startsAt: '2026-08-11T14:00:00.000Z', endsAt: '2026-08-11T16:00:00.000Z',
        minPp: 0, origin: 'synthetic', sourceIds: ['L-01'],
      }],
      unknownDates: ['2026-08-11', '2026-08-12'],
    },
    eligibility: { state: 'eligible', windowId: 'SYN-WINDOW-1', windowOrigin: 'synthetic', causes: [], gaps: [] },
    sources: [{ id: 'L-01', origin: 'local-decision', class: null, reference: 'Decisión local sintética L-01', date: '2026-10-11', status: 'local-only' }],
    ...overrides,
  }
}

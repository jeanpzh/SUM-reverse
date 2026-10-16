import type {
  Calendar,
  EffectiveWindow,
  EnrollmentProfile,
  ProfileScope,
  PublishedRow,
  School,
  Source,
} from './profile.types.js'

const documentDate = '2026-10-11'

const publishedRows: PublishedRow[] = [
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

const documentarySources: Source[] = [
  {
    id: 'F1',
    origin: 'evidence',
    class: 'normative',
    reference: 'docs/domain/fisi/2026-II/business-rules.md; specs/001-matricula-regular-fisi/spec.md:549-550',
    date: '2026-02-26',
    status: 'documented',
  },
  {
    id: 'F2',
    origin: 'evidence',
    class: 'normative',
    reference: 'docs/domain/fisi/2026-II/business-rules.md; specs/001-matricula-regular-fisi/spec.md:549-550',
    date: '2025-12-16',
    status: 'documented',
  },
  {
    id: 'F6',
    origin: 'evidence',
    class: 'normative',
    reference: 'specs/001-matricula-regular-fisi/spec.md:567-579',
    date: '2026-07-21',
    status: 'documented',
  },
  {
    id: 'P04-P05',
    origin: 'evidence',
    class: 'testimony',
    reference: 'specs/001-matricula-regular-fisi/spec.md:165,586-588',
    date: documentDate,
    status: 'reported',
  },
  {
    id: 'L-02',
    origin: 'local-decision',
    class: null,
    reference: 'specs/001-matricula-regular-fisi/spec.md:92,595-596',
    date: documentDate,
    status: 'local-only',
  },
]

const documentaryRules = [
  { ruleId: 'F6-MONDAY-PP-BANDS', sourceIds: ['F6'], knowledge: 'known' as const },
  { ruleId: 'AUGUST-11-OPERATING-HOURS', sourceIds: ['F6', 'P04-P05'], knowledge: 'unknown' as const },
  { ruleId: 'AUGUST-12-OPERATING-HOURS', sourceIds: ['F6', 'P04-P05'], knowledge: 'unknown' as const },
  { ruleId: 'PP-ABOVE-19-TESTIMONY', sourceIds: ['F6', 'P04-P05'], knowledge: 'unknown' as const },
]

const clone = <T>(value: T): T => structuredClone(value)

function createScope(school: School): ProfileScope {
  return {
    facultyId: 'FISI',
    schoolId: school,
    period: '2026-II',
    planId: `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-PLAN`,
    modality: 'regular-virtual',
  }
}

function createSyntheticWindows(): EffectiveWindow[] {
  return [
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
}

export function createDocumentaryProfile(school: School = 'SISTEMAS'): EnrollmentProfile {
  const calendar: Calendar = {
    publishedRows: clone(publishedRows),
    effectiveWindows: [],
    unknownDates: ['2026-08-11', '2026-08-12'],
  }

  return {
    profileRevision: 'MR-FISI-2026-II-DOC-1',
    scope: createScope(school),
    sources: clone(documentarySources),
    calendar,
    rules: clone(documentaryRules),
  }
}

export function createSyntheticProfile(school: School): EnrollmentProfile {
  const sources = [
    ...clone(documentarySources),
    {
      id: 'SYN-FIXTURE',
      origin: 'local-decision' as const,
      class: null,
      reference: 'specs/001-matricula-regular-fisi/data-model.md:107-110',
      date: documentDate,
      status: 'local-only' as const,
    },
  ]

  const calendar: Calendar = {
    publishedRows: clone(publishedRows),
    effectiveWindows: createSyntheticWindows(),
    unknownDates: ['2026-08-11', '2026-08-12'],
  }

  return {
    profileRevision: school === 'SISTEMAS' ? 'MR-SYN-SIS-1' : 'MR-SYN-SOFT-1',
    scope: createScope(school),
    sources,
    calendar,
    rules: [
      ...clone(documentaryRules),
      { ruleId: 'SYN-WINDOWS-11-12', sourceIds: ['L-02', 'SYN-FIXTURE'], knowledge: 'known' },
    ],
  }
}

export function findProfile(
  profiles: readonly EnrollmentProfile[],
  scope: ProfileScope,
  profileRevision?: string,
): EnrollmentProfile | null {
  const matches = profiles.filter((profile) =>
    profile.scope.facultyId === scope.facultyId &&
    profile.scope.schoolId === scope.schoolId &&
    profile.scope.period === scope.period &&
    profile.scope.planId === scope.planId &&
    profile.scope.modality === scope.modality &&
    (profileRevision === undefined || profile.profileRevision === profileRevision),
  )

  return matches.length === 1 ? clone(matches[0]!) : null
}

export function createProfileCatalog(): EnrollmentProfile[] {
  return [
    createDocumentaryProfile('SISTEMAS'),
    createDocumentaryProfile('SOFTWARE'),
    createSyntheticProfile('SISTEMAS'),
    createSyntheticProfile('SOFTWARE'),
  ]
}

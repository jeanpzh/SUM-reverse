import type { MatriculaRegularChoice, MatriculaRegularId } from './matricula-regular.mjs'

export type E3ImportIssue = {
  courseId: string
  sectionId: string
  code: 'SCOPE_MISMATCH' | 'PUBLICATION_UNAVAILABLE' | 'COURSE_UNAVAILABLE' | 'SECTION_UNMAPPED' | 'AMBIGUOUS_MAPPING' | 'SCHEDULE_CHANGED' | 'SECTION_FULL' | 'ACADEMIC_PENDING'
}
export type E3IntentionImport = {
  runId: string
  actorId: MatriculaRegularId
  profileRevision: string
  intention: { version: number; publicationId: string; publicationVersion: number; academicPeriod: string } | null
  selection: MatriculaRegularChoice[]
  issues: E3ImportIssue[]
}
export function validateE3IntentionImport(value: unknown): asserts value is E3IntentionImport

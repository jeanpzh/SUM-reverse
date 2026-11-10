import type { E2ContextRequest, E2Identity } from './prematricula-api.mjs'

export const E2_NOTICE_REVISION: 'E2-NOTICE-1'
export type E2ScheduleNoticeRequest = E2ContextRequest
export type E2ScheduleChangeNotice = {
  revision: 'E2-NOTICE-1'
  actorId: E2Identity['actorId']
  registered: { publicationId: string; publicationVersion: number } | null
  current: { publicationId: string; publicationVersion: number } | null
  changed: boolean
  affected: Array<{ courseId: string; sectionId: string; change: 'section-removed' | 'schedule-changed' | 'course-removed' }>
  newSectionCourseIds: string[]
}
export function validateE2ScheduleNoticeRequest(value: unknown): asserts value is E2ScheduleNoticeRequest
export function validateE2ScheduleChangeNotice(value: unknown): asserts value is E2ScheduleChangeNotice

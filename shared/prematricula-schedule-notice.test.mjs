import assert from 'node:assert/strict'
import test from 'node:test'
import { validateE2ScheduleChangeNotice, validateE2ScheduleNoticeRequest } from './prematricula-schedule-notice.mjs'

const v1 = { publicationId: '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b', publicationVersion: 1 }
const v2 = { publicationId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', publicationVersion: 2 }
const notice = {
  revision: 'E2-NOTICE-1', actorId: 'SYN-SIS-A', registered: v1, current: v2, changed: true,
  affected: [{ courseId: 'C1', sectionId: 'section:["C1",1]', change: 'schedule-changed' }], newSectionCourseIds: ['C2'],
}

test('notice validator accepts the contract shapes', () => {
  assert.doesNotThrow(() => validateE2ScheduleChangeNotice(notice))
  assert.doesNotThrow(() => validateE2ScheduleChangeNotice({ ...notice, registered: v1, current: v1, changed: false, affected: [], newSectionCourseIds: [] }))
  assert.doesNotThrow(() => validateE2ScheduleChangeNotice({ ...notice, registered: null, current: v2, changed: false, affected: [], newSectionCourseIds: [] }))
  assert.doesNotThrow(() => validateE2ScheduleChangeNotice({ ...notice, registered: null, current: null, changed: false, affected: [], newSectionCourseIds: [] }))
  for (const change of ['section-removed', 'course-removed']) {
    assert.doesNotThrow(() => validateE2ScheduleChangeNotice({ ...notice, affected: [{ courseId: 'C1', sectionId: 's', change }] }))
  }
})

test('notice validator rejects malformed or inconsistent notices', () => {
  const bad = {
    'revision': { revision: 'E2-NOTICE-2' }, 'extra key': { extra: 1 }, 'actor': { actorId: 'SYN-SIS-C' }, 'bad reference': { registered: { publicationId: 'x', publicationVersion: 1 } },
    'bad version': { current: { ...v2, publicationVersion: 0 } }, 'changed not boolean': { changed: 'yes' },
    'bad change kind': { affected: [{ courseId: 'C1', sectionId: 's', change: 'moved' }] }, 'extra affected key': { affected: [{ courseId: 'C1', sectionId: 's', change: 'schedule-changed', room: 'R1' }] },
    'duplicate section': { affected: [notice.affected[0], notice.affected[0]] }, 'duplicate course': { newSectionCourseIds: ['C2', 'C2'] },
    'changed without registration': { registered: null }, 'changed but same publication': { current: v1 }, 'unchanged but different publication': { changed: false, affected: [], newSectionCourseIds: [] },
    'changes without change': { registered: v1, current: v1, changed: false },
  }
  for (const [name, change] of Object.entries(bad)) assert.throws(() => validateE2ScheduleChangeNotice({ ...notice, ...change }), TypeError, name)
})

test('notice request reuses the E2 identity validation', () => {
  const identity = { actorId: 'SYN-SIS-A', sourceId: 'regular-SISTEMAS-v1', schoolId: 'SISTEMAS', planId: 'SYN-SIS-PLAN', academicPeriod: '2027-I' }
  assert.throws(() => validateE2ScheduleNoticeRequest({}), TypeError)
  assert.throws(() => validateE2ScheduleNoticeRequest({ identity: { actorId: 'SYN-SIS-Z' } }), TypeError)
  assert.throws(() => validateE2ScheduleNoticeRequest({ identity, extra: 1 }), TypeError)
})

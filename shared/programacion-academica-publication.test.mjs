import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateAcademicPublicationRequest, validateAcademicScheduleSnapshot, validateAcademicReleasePreview, validateAcademicPublication, validateAcademicPublicationList, validateAcademicDraftSaveRequest, validateAcademicSavedDraft } from './programacion-academica-api.mjs'

// Independently constructed synthetic schedule: no snapshot or personal source.
const id = '02c58fb4-4921-4bb9-a339-f1bdab05be60'
const otherId = '364dd0cc-a7b7-464a-ac32-44700b63b680'
const at = '2026-11-04T12:00:00Z'
const schedule = () => ({ schoolId: 'SISTEMAS', academicPeriod: '2027-I', courses: [{ courseId: 'SYN-C', name: 'Curso de prueba', cycle: 1, credits: 4 }],
  sections: [{ sectionId: 'S1', courseId: 'SYN-C', courseName: 'Curso de prueba', capacity: 45, deliveryMode: 'continuous' }],
  assignments: [0, 1].map((i) => ({ sessionId: `C${i}`, sectionId: 'S1', courseId: 'SYN-C', courseName: 'Curso de prueba', teacherId: 'SYN-T', teacherName: 'Docente de prueba', roomId: 'SYN-R', roomName: 'Ambiente de prueba', day: 1, startMinute: 1080 + i * 120, endMinute: 1200 + i * 120, sessionType: i ? 'P' : 'T' })) })
const publication = () => ({ revision: 'PA-PUBLICATION-1', id, publicationVersion: 1, title: 'Publicación de prueba', sourceProposalVersion: 4, approvedVersion: 5, approvedAt: at, publishedAt: at, schedule: schedule() })
const summary = (value) => { const { revision, schedule, ...rest } = value; void revision; void schedule; return rest }
const configuration = () => ({ schoolId: 'SISTEMAS', academicPeriod: '2027-I', demandSourceId: 'existing-regular-v1', demandBaseRequest: null,
  request: { revision: 'PA-DEMO-1', demands: [{ courseId: 'SYN-C', estimatedDemand: 1, targetCapacity: 45 }],
    resources: { teachers: [{ id: 'SYN-T', name: 'Docente de prueba', courseIds: ['SYN-C'], maxWeeklyMinutes: 240, availability: [{ day: 1, startMinute: 1080, endMinute: 1320 }] }],
      rooms: [{ id: 'SYN-R', name: 'Ambiente de prueba', capacity: 45, availability: [{ day: 1, startMinute: 1080, endMinute: 1320 }] }] } } })

test('publication commands require both file and current-publication concurrency checks', () => {
  assert.doesNotThrow(() => validateAcademicPublicationRequest({ expectedVersion: 5, expectedCurrentId: null }))
  assert.doesNotThrow(() => validateAcademicPublicationRequest({ expectedVersion: 5, expectedCurrentId: id }))
  for (const value of [{ expectedVersion: 5 }, { expectedVersion: 0, expectedCurrentId: null }, { expectedVersion: 5, expectedCurrentId: '../x' }, { expectedVersion: 5, expectedCurrentId: null, assignments: [] }]) assert.throws(() => validateAcademicPublicationRequest(value))
  const save = { id: null, expectedVersion: null, title: 'Demo', configuration: configuration(), proposalId: null, proposalEditVersion: null, state: 'draft' }
  assert.doesNotThrow(() => validateAcademicDraftSaveRequest(save))
  for (const state of ['approved', 'published']) assert.throws(() => validateAcademicDraftSaveRequest({ ...save, state }))
})

test('published read contract retains course metadata and continuous typed components, without internal authority', () => {
  assert.doesNotThrow(() => validateAcademicScheduleSnapshot(schedule()))
  assert.doesNotThrow(() => validateAcademicPublication(publication()))
  assert.doesNotThrow(() => validateAcademicReleasePreview({ id, version: 4, title: 'Demo', state: 'ready-for-approval', schedule: schedule() }))
  for (const modify of [
    (v) => { v.courses[0].cycle = 0 }, (v) => { v.courses[0].name = 'Nombre incorrecto' },
    (v) => { v.courses.push(v.courses[0]) }, (v) => { v.assignments[1].startMinute += 60 },
    (v) => { v.assignments[1].teacherId = 'OTHER' }, (v) => { v.assignments = [] },
    (v) => { v.authority = {} }, (v) => { v.schoolId = 'OTHER' },
  ]) { const value = schedule(); modify(value); assert.throws(() => validateAcademicScheduleSnapshot(value)) }
  assert.throws(() => validateAcademicPublication({ ...publication(), configuration: {} }))
  assert.throws(() => validateAcademicPublication({ ...publication(), approvedVersion: 8 }))
})

test('current-publication marker is derived from unique immutable publication versions', () => {
  const first = summary(publication())
  const second = { ...first, id: otherId, publicationVersion: 2 }
  assert.doesNotThrow(() => validateAcademicPublicationList({ currentId: otherId, items: [second, first] }))
  assert.doesNotThrow(() => validateAcademicPublicationList({ currentId: null, items: [] }))
  for (const value of [{ currentId: id, items: [first, second] }, { currentId: null, items: [first] }, { currentId: id, items: [first, first] }, { currentId: otherId, items: [first, { ...second, publicationVersion: 1 }] }]) assert.throws(() => validateAcademicPublicationList(value))
})

test('locked metadata refers to exact pre-approval version and cannot hide later review decisions', () => {
  const hash = 'a'.repeat(64)
  const doc = { id, version: 4, title: 'Demo', state: 'approved', createdAt: at, updatedAt: at, configuration: configuration(), demandBase: null,
    proposal: { proposalId: 'P1', createdAt: at, expiresAt: '2026-11-04T12:15:00Z', status: 'complete', sections: schedule().sections, assignments: schedule().assignments, pending: [], diagnostics: [], coverageComplete: true,
      counts: { sections: 1, requiredSessions: 2, scheduledSessions: 2 }, stats: { exploredCandidates: 0, candidateVisits: 0, backtracks: 0, limitReason: null } },
    review: { round: 1, submittedVersion: 2, submittedAt: at, teachers: [{ teacherId: 'SYN-T', teacherName: 'Docente de prueba', fingerprint: hash, status: 'conformity', observation: '', decisionVersion: 3, decidedAt: at }],
      history: [{ type: 'submitted', version: 2, round: 1, at, teacherId: null, decision: null, observation: '', fingerprint: null }, { type: 'decision', version: 3, round: 1, at, teacherId: 'SYN-T', decision: 'conformity', observation: '', fingerprint: hash }] },
    approval: { sourceVersion: 3, approvedVersion: 4, approvedAt: at, fingerprint: hash } }
  assert.doesNotThrow(() => validateAcademicSavedDraft(doc))
  assert.doesNotThrow(() => validateAcademicSavedDraft({ ...doc, state: 'published', version: 5, publication: { publicationVersion: 1, publishedAt: at } }))
  for (const patch of [{ version: 5 }, { state: 'draft' }, { state: 'published' }, { publication: { publicationVersion: 1, publishedAt: at } },
    { approval: { ...doc.approval, sourceVersion: 2 } }, { approval: { ...doc.approval, fingerprint: null } }]) assert.throws(() => validateAcademicSavedDraft({ ...doc, ...patch }))
  const futureReview = structuredClone(doc)
  futureReview.review.teachers[0].decisionVersion = 4
  futureReview.review.history[1].version = 4
  assert.throws(() => validateAcademicSavedDraft(futureReview))
})

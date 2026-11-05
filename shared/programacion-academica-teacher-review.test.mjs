import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateAcademicReviewSubmission, validateAcademicReviewDecision, validateAcademicTeacherReview, validateAcademicDraftSaveRequest, validateAcademicSavedDraft } from './programacion-academica-api.mjs'

const at = '2026-11-04T12:00:00Z'
const fingerprint = 'a'.repeat(64)
const review = () => ({ round: 1, submittedVersion: 2, submittedAt: at,
  teachers: [{ teacherId: 'T1', teacherName: 'Docente de prueba', fingerprint, status: 'pending', observation: '', decisionVersion: null, decidedAt: null }],
  history: [{ type: 'submitted', version: 2, round: 1, at, teacherId: null, decision: null, observation: '', fingerprint: null }] })
const configuration = { schoolId: 'SISTEMAS', academicPeriod: '2027-I', demandSourceId: 'existing-regular-v1', demandBaseRequest: null,
  request: { revision: 'PA-DEMO-1', demands: [], resources: { teachers: [], rooms: [] } } }

test('review endpoints reject injected authority, malformed versions and missing observations', () => {
  assert.doesNotThrow(() => validateAcademicReviewSubmission({ expectedVersion: 1 }))
  for (const body of [{}, { expectedVersion: 0 }, { expectedVersion: 1, role: 'school' }]) assert.throws(() => validateAcademicReviewSubmission(body))
  const body = { expectedVersion: 2, round: 1, teacherId: 'T1', decision: 'conformity', observation: '' }
  assert.doesNotThrow(() => validateAcademicReviewDecision(body))
  assert.doesNotThrow(() => validateAcademicReviewDecision({ ...body, decision: 'changes-requested', observation: 'Solicito revisar el lunes' }))
  for (const patch of [{ round: 0 }, { decision: 'approved' }, { observation: 'x'.repeat(1001) }, { fingerprint }, { decision: 'changes-requested' }, { observation: ' texto ' }]) assert.throws(() => validateAcademicReviewDecision({ ...body, ...patch }))
})

test('review metadata keeps bounded history, unique teachers and versioned decisions', () => {
  assert.doesNotThrow(() => validateAcademicTeacherReview(review(), 2))
  const accepted = review()
  Object.assign(accepted.teachers[0], { status: 'conformity', decisionVersion: 3, decidedAt: at })
  accepted.history.push({ type: 'decision', version: 3, round: 1, at, teacherId: 'T1', decision: 'conformity', observation: '', fingerprint })
  assert.doesNotThrow(() => validateAcademicTeacherReview(accepted, 3))
  assert.throws(() => validateAcademicTeacherReview(accepted, 2))
  for (const modify of [
    (v) => { v.teachers.push(v.teachers[0]) },
    (v) => { v.teachers[0].status = 'conformity' },
    (v) => { v.teachers[0].fingerprint = 'not-a-hash' },
    (v) => { v.history = Array(201).fill(v.history[0]) },
    (v) => { v.history = [] },
    (v) => { v.history[0].version = 4 },
    (v) => { v.history[0].teacherId = 'T1' },
  ]) { const value = review(); modify(value); assert.throws(() => validateAcademicTeacherReview(value, 2)) }
})

test('review workflow states cannot be forged by a normal save request', () => {
  const body = { id: null, expectedVersion: null, title: 'Review demo', state: 'draft', configuration, proposalId: null, proposalEditVersion: null }
  for (const state of ['in-review', 'ready-for-approval']) assert.throws(() => validateAcademicDraftSaveRequest({ ...body, state }))
  const saved = { id: '02c58fb4-4921-4bb9-a339-f1bdab05be60', version: 2, title: 'Review demo', state: 'draft', createdAt: at, updatedAt: at, configuration, demandBase: null, proposal: null }
  assert.doesNotThrow(() => validateAcademicSavedDraft(saved))
  assert.throws(() => validateAcademicSavedDraft({ ...saved, state: 'in-review' }))
  assert.throws(() => validateAcademicSavedDraft({ ...saved, state: 'in-review', review: review() }))
  assert.throws(() => validateAcademicSavedDraft({ ...saved, state: 'ready-for-approval', review: review() }))
})

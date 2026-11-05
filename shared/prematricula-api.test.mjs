import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateE2ContextRequest, validateE2SaveRequest, validateE2Draft, validateE2Validation, validateE2SaveResponse, validateE2Context } from './prematricula-api.mjs'
const id = '02c58fb4-4921-4bb9-a339-f1bdab05be60'
const other = '364dd0cc-a7b7-464a-ac32-44700b63b680'
const hash = 'a'.repeat(64)
const identity = { actorId: 'SYN-SIS-A', runId: id, sessionId: other }
const selection = [{ courseId: '20118091', sectionId: 'section:["20118091",1]' }]
const draft = () => ({ revision: 'E2-LOCAL-1', id, version: 1, actorId: 'SYN-SIS-A', sourceId: 'regular-SISTEMAS-v1', schoolId: 'SISTEMAS', planId: 'SYN-SIS-PLAN', academicPeriod: '2027-I', publicationId: other, publicationVersion: 1, academicRevision: hash, selection, createdAt: '2026-11-04T12:00:00Z', updatedAt: '2026-11-04T12:00:00Z' })
const validation = () => ({ actorId: 'SYN-SIS-A', publicationId: other, publicationVersion: 1, academicRevision: hash, selection, credits: 4, courseCount: 1, status: 'valid', issues: [] })
test('E2 accepts only the stable two-profile demo identity and exact payload', () => {
  assert.doesNotThrow(() => validateE2ContextRequest({ identity }))
  for (const body of [{ identity: { ...identity, actorId: 'SYN-SOFT-A' } }, { identity: { ...identity, actorId: 'SYN-DEMAND-001' } }, { identity, owner: 'B' }]) assert.throws(() => validateE2ContextRequest(body))
  const body = { identity, id: null, expectedVersion: null, expectedAcademicRevision: hash, publicationId: other, publicationVersion: 1, selection }
  assert.doesNotThrow(() => validateE2SaveRequest(body))
  for (const patch of [{ expectedVersion: 1 }, { id, expectedVersion: 0 }, { academicHistory: [] }, { credits: 26 }, { publicationVersion: 0 }, { selection: [...selection, ...selection] }]) assert.throws(() => validateE2SaveRequest({ ...body, ...patch }))
})
test('E2 credit calculation has no invented 12/26 threshold and incomplete drafts remain explicit', () => {
  for (const credits of [4, 30]) assert.doesNotThrow(() => validateE2Validation({ ...validation(), credits }))
  assert.doesNotThrow(() => validateE2Validation({ ...validation(), selection: [], courseCount: 0, credits: 0, status: 'incomplete', issues: [{ kind: 'incomplete', code: 'EMPTY_SELECTION', message: 'Selecciona asignaturas cuando lo necesites.', courseIds: [], sectionIds: [] }] }))
  assert.throws(() => validateE2Validation({ ...validation(), selection: [], courseCount: 0, credits: 0 }))
  assert.throws(() => validateE2Validation({ ...validation(), status: 'valid', issues: [{ kind: 'unmet', code: 'PREREQUISITE_NOT_MET', message: 'Prerrequisito pendiente', courseIds: ['20118091'], sectionIds: [] }] }))
})
test('stored drafts retain original publication/section IDs and responses cannot mix owners or versions', () => {
  assert.doesNotThrow(() => validateE2Draft(draft()))
  assert.doesNotThrow(() => validateE2SaveResponse({ draft: draft(), validation: validation() }))
  for (const patch of [{ actorId: 'SYN-SIS-B' }, { publicationVersion: 2 }, { selection: [] }, { academicRevision: 'b'.repeat(64) }]) assert.throws(() => validateE2SaveResponse({ draft: draft(), validation: { ...validation(), ...patch } }))
  assert.throws(() => validateE2Draft({ ...draft(), state: 'enrolled' }))
})
test('a changed academic source is reported on recovery, not silently accepted', () => {
  const d = draft()
  const context = { revision: 'E2-LOCAL-1', actorId: d.actorId, sourceId: d.sourceId, schoolId: d.schoolId, planId: d.planId, academicPeriod: d.academicPeriod, academicRevision: hash, publications: { currentId: null, items: [] }, draft: d, draftValidation: validation() }
  assert.doesNotThrow(() => validateE2Context(context))
  assert.throws(() => validateE2Context({ ...context, actorId: 'SYN-SIS-B' }))
  const newHash = 'b'.repeat(64)
  const changed = { ...context, academicRevision: newHash, draftValidation: { ...validation(), academicRevision: newHash } }
  assert.throws(() => validateE2Context(changed))
  assert.doesNotThrow(() => validateE2Context({ ...changed, draftValidation: { ...changed.draftValidation, status: 'insufficient', issues: [{ kind: 'insufficient', code: 'ACADEMIC_CONTEXT_CHANGED', message: 'Revisa el contexto académico actualizado.', courseIds: [], sectionIds: [] }] } }))
})

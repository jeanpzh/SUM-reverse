import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateAcademicWorkspace, validateAcademicDraftSaveRequest, validateAcademicSavedDraft, validateAcademicDraftList, validateAcademicDraftResume } from './programacion-academica-api.mjs'

const id = '02c58fb4-4921-4bb9-a339-f1bdab05be60'
const workspace = () => ({ schoolId: 'SISTEMAS', academicPeriod: '2027-I', demandSourceId: 'existing-regular-v1', demandBaseRequest: null,
  request: { revision: 'PA-DEMO-1', demands: [{ courseId: '20118104', estimatedDemand: 180, targetCapacity: 45 }],
    resources: { teachers: [], rooms: [] }, allocationPolicy: 'balanced' } })
const save = () => ({ id: null, expectedVersion: null, title: 'Demo E1', state: 'draft', configuration: workspace(), proposalId: null, proposalEditVersion: null })
const document = () => ({ id, version: 1, title: 'Demo E1', state: 'draft', createdAt: '2026-11-04T10:00:00Z', updatedAt: '2026-11-04T10:00:00Z', configuration: workspace(), demandBase: null, proposal: null })

test('workspace retains explicit resources and separates base request from final demand', () => {
  const value = workspace()
  value.demandBaseRequest = { revision: 'PA-DEMO-1', sourceId: 'existing-regular-v1', targetPeriod: '2027-I', courses: [{ courseId: '20118104', targetCapacity: 45 }] }
  assert.doesNotThrow(() => validateAcademicWorkspace(value))
  const different = structuredClone(value)
  different.demandBaseRequest.courses[0].targetCapacity = 30
  assert.throws(() => validateAcademicWorkspace(different))
  assert.throws(() => validateAcademicWorkspace({ ...value, demandSourceId: 'independent-120-v1' }))
  assert.throws(() => validateAcademicWorkspace({ ...value, academicPeriod: '2026-II' }))
  const incomplete = workspace()
  delete incomplete.request.resources
  assert.throws(() => validateAcademicWorkspace(incomplete))
})

test('save accepts configuration-only drafts and versioned updates, never client authority', () => {
  assert.doesNotThrow(() => validateAcademicDraftSaveRequest(save()))
  assert.doesNotThrow(() => validateAcademicDraftSaveRequest({ ...save(), id, expectedVersion: 1, proposalId: 'server-retained', proposalEditVersion: 0 }))
  for (const patch of [
    { expectedVersion: 1 }, { id, expectedVersion: null }, { id, expectedVersion: 0 },
    { id: '../outside', expectedVersion: 1 }, { id: 'C:\\private', expectedVersion: 1 },
    { title: '' }, { title: ' name ' }, { title: 'x'.repeat(101) }, { state: 'approved' },
    { state: 'ready-for-review' }, { proposalEditVersion: 0 }, { proposalId: 'server-retained' },
    { authority: {} }, { assignments: [] }, { result: {} },
  ]) assert.throws(() => validateAcademicDraftSaveRequest({ ...save(), ...patch }))
})

test('saved proposal metadata and readiness cannot contradict actual result', () => {
  assert.doesNotThrow(() => validateAcademicSavedDraft(document()))
  assert.doesNotThrow(() => validateAcademicDraftResume({ draft: document() }))
  for (const patch of [
    { version: 0 }, { id: '../outside' }, { updatedAt: '2020-01-01' }, { createdAt: 'invalid' },
    { state: 'ready-for-review' }, { state: 'published' }, { authority: {} },
    { demandBase: {} }, { proposal: {} },
  ]) assert.throws(() => validateAcademicSavedDraft({ ...document(), ...patch }))
  assert.throws(() => validateAcademicDraftResume({ draft: document(), input: {} }))
})

test('saved list contains only compact unique metadata with known scope', () => {
  const item = { id, version: 1, title: 'Demo E1', state: 'draft', schoolId: 'SISTEMAS', academicPeriod: '2027-I', createdAt: '2026-11-04T10:00:00Z', updatedAt: '2026-11-04T10:00:00Z', hasSchedule: false }
  assert.doesNotThrow(() => validateAcademicDraftList({ items: [item], unavailableCount: 1 }))
  for (const value of [
    { items: [item, item], unavailableCount: 0 },
    { items: [{ ...item, state: 'ready-for-review' }], unavailableCount: 0 },
    { items: [{ ...item, configuration: workspace() }], unavailableCount: 0 },
    { items: [{ ...item, schoolId: 'OTHER' }], unavailableCount: 0 },
    { items: [], unavailableCount: -1 },
  ]) assert.throws(() => validateAcademicDraftList(value))
})

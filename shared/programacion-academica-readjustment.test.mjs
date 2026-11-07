import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canonicalReadjustmentBasis, parseReadjustmentSectionId, proposeReadjustment, readjustedEstimatedDemand, readjustmentSectionId,
  resolveAcceptedReadjustmentActions, validateAcademicReadjustmentRecord, validateReadjustmentAcceptRequest, validateReadjustmentProposal,
  validateReadjustmentProposalRequest,
} from './programacion-academica-readjustment.mjs'

const publicationId = '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b'
const basisFingerprint = 'a'.repeat(64)
const sid = readjustmentSectionId
const room = (kind, capacity) => ({ kind, capacity })

// Synthetic publication structure and E2 demand (no real data).
function build({ courses, sections }) {
  const demand = {
    revision: 'E2-DEMAND-1', schoolId: 'SISTEMAS', academicPeriod: '2027-I', publicationId, publicationVersion: 1,
    registeredStudents: 2, countedStudents: 2, excludedStudents: 0,
    courses: Object.entries(courses).map(([courseId, students]) => ({
      courseId, name: courseId, students,
      sections: (sections[courseId] ?? []).map((section) => ({ sectionId: section.sectionId, capacity: section.capacity, students: section.students ?? 0 })),
    })),
  }
  return { publicationId, publicationVersion: 1, basisFingerprint, demand,
    courses: Object.entries(sections).map(([courseId, list]) => ({ courseId, targetCapacity: list.target, sections: list.map(({ sectionId, capacity, rooms }) => ({ sectionId, capacity, rooms })) })) }
}
function sectionsOf(target, list) { const out = list.map((item, index) => ({ sectionId: sid('C', index + 1), ...item })); out.target = target; return out }

test('S1: a course over capacity opens ceil((D − K) / T) sections with the next ordinals', () => {
  const sections = { C: sectionsOf(1, [{ capacity: 1, students: 1, rooms: [room('classroom', 1)] }]) }
  const proposal = proposeReadjustment(build({ courses: { C: 2 }, sections }))
  assert.deepEqual(proposal.actions, [{
    id: 'open:C', type: 'open-section', courseId: 'C', demand: 2, capacity: 1, targetCapacity: 1, count: 1, ordinals: [2], reason: 'COURSE_DEMAND_EXCEEDS_CAPACITY',
  }])
  assert.equal(proposal.status, 'actions')
  assert.deepEqual(proposal.demand, { counted: 2, excluded: 0 })
  const wide = { C: sectionsOf(45, [{ capacity: 45, students: 0, rooms: [room('classroom', 45)] }, { capacity: 45, students: 0, rooms: [room('classroom', 45)] }]) }
  const open = proposeReadjustment(build({ courses: { C: 136 }, sections: wide })).actions[0]
  assert.equal(open.count, 2); assert.deepEqual(open.ordinals, [3, 4]); assert.equal(open.capacity, 90)
  assert.equal(proposeReadjustment(build({ courses: { C: 90 }, sections: wide })).actions.length, 0, 'D = K needs nothing')
})

test('S1: section rules — widen, laboratory, room at capacity, unknown kind', () => {
  const sections = {
    C: sectionsOf(1, [
      { capacity: 1, students: 2, rooms: [room('classroom', 3), room('classroom', 5)] },    // widen to min room 3
      { capacity: 1, students: 2, rooms: [room('classroom', 3), room('laboratory', 3)] },   // keep, laboratory
      { capacity: 3, students: 4, rooms: [room('classroom', 3)] },                         // keep, room at capacity
      { capacity: 1, students: 2, rooms: [room('classroom', 3), room(null, 3)] },          // keep, unknown kind
      { capacity: 1, students: 2, rooms: [] },                                              // keep, no rooms assigned
      { capacity: 1, students: 1, rooms: [room('classroom', 9)] },                          // n_s = k_s: nothing
      { capacity: 1000, students: 1001, rooms: [room('classroom', 5000)] },                 // cannot exceed the 1000 ceiling
    ]),
  }
  const proposal = proposeReadjustment(build({ courses: { C: 7 }, sections }))
  assert.deepEqual(proposal.actions.map((action) => [action.id, action.type, action.reason]), [
    [`widen:${sid('C', 1)}`, 'widen-cap', 'SECTION_DEMAND_EXCEEDS_CAP'],
    [`keep:${sid('C', 2)}`, 'keep', 'LABORATORY_SECTION'],
    [`keep:${sid('C', 3)}`, 'keep', 'ROOM_AT_CAPACITY'],
    [`keep:${sid('C', 4)}`, 'keep', 'ROOM_KIND_UNKNOWN'],
    [`keep:${sid('C', 5)}`, 'keep', 'ROOM_KIND_UNKNOWN'],
    [`keep:${sid('C', 7)}`, 'keep', 'ROOM_AT_CAPACITY'],
  ])
  const widen = proposal.actions[0]
  assert.deepEqual({ ...widen }, { id: `widen:${sid('C', 1)}`, type: 'widen-cap', courseId: 'C', sectionId: sid('C', 1), demand: 2, capacity: 1, newCapacity: 3, remainingExcess: 0, reason: 'SECTION_DEMAND_EXCEEDS_CAP' })
  const capped = build({ courses: { C: 1 }, sections: { C: sectionsOf(1, [{ capacity: 1, students: 5, rooms: [room('classroom', 3)] }]) } })
  assert.equal(proposeReadjustment(capped).actions[0].remainingExcess, 2, 'remainingExcess = n_s − newCapacity')
})

test('S1: actions are deterministic and sorted by course ID then section ordinal', () => {
  const sections = {
    B: sectionsOf(1, [{ capacity: 1, students: 2, rooms: [room('classroom', 5)] }]),
    A: sectionsOf(1, [{ capacity: 1, students: 0, rooms: [room('classroom', 5)] }, { capacity: 1, students: 2, rooms: [room('laboratory', 5)] }]),
  }
  sections.A.forEach((item, index) => { item.sectionId = sid('A', index + 1) })
  sections.B.forEach((item, index) => { item.sectionId = sid('B', index + 1) })
  const input = build({ courses: { B: 2, A: 3 }, sections })
  const first = proposeReadjustment(input)
  assert.deepEqual(first.actions.map((action) => action.id), [`keep:${sid('A', 2)}`, 'open:A', `widen:${sid('B', 1)}`, 'open:B'])
  assert.deepEqual(proposeReadjustment(structuredClone(input)), first)
  assert.doesNotThrow(() => validateReadjustmentProposal(first))
  const empty = proposeReadjustment(build({ courses: { C: 0 }, sections: { C: sectionsOf(1, [{ capacity: 1, students: 0, rooms: [room('classroom', 3)] }]) } }))
  assert.deepEqual([empty.status, empty.actions], ['no-change', []])
  assert.doesNotThrow(() => validateReadjustmentProposal(empty))
  assert.throws(() => proposeReadjustment({ ...input, basisFingerprint: 'x' }))
  const foreign = { C: sectionsOf(1, [{ capacity: 1, students: 0, rooms: [] }]) }
  foreign.C[0].sectionId = sid('Z', 1)
  assert.throws(() => proposeReadjustment(build({ courses: { C: 1 }, sections: foreign })), TypeError, 'a section of another course is refused')
})

test('section identity and the estimated demand of accepted open actions', () => {
  assert.equal(sid('C1', 3), 'section:["C1",3]')
  assert.deepEqual(parseReadjustmentSectionId('section:["C1",3]'), { courseId: 'C1', ordinal: 3 })
  for (const bad of ['section:["C1",0]', 'section:["C1"]', 'section: ["C1",3]', 'S1', 'section:[1,3]', 'section:["C1",3,4]', null]) assert.equal(parseReadjustmentSectionId(bad), null, String(bad))
  // n = 2, T = 45, count = 1 → exactly 3 sections: clamp(D, 91, 135)
  assert.equal(readjustedEstimatedDemand({ demand: 100, sectionCount: 2, count: 1, targetCapacity: 45 }), 100)
  assert.equal(readjustedEstimatedDemand({ demand: 3, sectionCount: 2, count: 1, targetCapacity: 45 }), 91)
  assert.equal(readjustedEstimatedDemand({ demand: 500, sectionCount: 2, count: 1, targetCapacity: 45 }), 135)
  for (const demand of [0, 50, 100, 200]) assert.equal(Math.ceil(readjustedEstimatedDemand({ demand, sectionCount: 2, count: 2, targetCapacity: 45 }) / 45), 4)
  assert.throws(() => readjustedEstimatedDemand({ demand: 1, sectionCount: 0, count: 1, targetCapacity: 45 }))
  assert.equal(canonicalReadjustmentBasis({ publicationVersion: 1, publicationId: 'x', demand: { b: 1, a: [2] } }), canonicalReadjustmentBasis({ publicationId: 'x', demand: { a: [2], b: 1 }, publicationVersion: 1 }))
})

test('S2: accept DTO rejects malformed bodies, keep IDs, 65 IDs and an empty title', () => {
  const ok = { expectedCurrentId: publicationId, expectedBasisFingerprint: basisFingerprint, acceptedActionIds: ['open:C', `widen:${sid('C', 1)}`] }
  assert.doesNotThrow(() => validateReadjustmentAcceptRequest(ok))
  assert.doesNotThrow(() => validateReadjustmentAcceptRequest({ ...ok, title: 'Reajuste de la publicación v1' }))
  const ids = (count) => Array.from({ length: count }, (_, index) => `open:C${index}`)
  assert.doesNotThrow(() => validateReadjustmentAcceptRequest({ ...ok, acceptedActionIds: ids(64) }))
  const bad = [
    { ...ok, acceptedActionIds: ids(65) }, { ...ok, acceptedActionIds: [] }, { ...ok, acceptedActionIds: [`keep:${sid('C', 1)}`] }, { ...ok, acceptedActionIds: ['open:C', 'open:C'] },
    { ...ok, acceptedActionIds: ['widen:S1'] }, { ...ok, acceptedActionIds: ['other:C'] }, { ...ok, acceptedActionIds: ['open:'] }, { ...ok, title: '' }, { ...ok, title: '   ' }, { ...ok, title: 'x'.repeat(121) },
    { ...ok, extra: 1 }, { ...ok, expectedCurrentId: 'nope' }, { ...ok, expectedBasisFingerprint: 'abc' }, { expectedBasisFingerprint: basisFingerprint, acceptedActionIds: ['open:C'] },
  ]
  for (const value of bad) assert.throws(() => validateReadjustmentAcceptRequest(value), TypeError, JSON.stringify(value).slice(0, 80))
  assert.doesNotThrow(() => validateReadjustmentProposalRequest({}))
  for (const value of [{ any: 1 }, null, [], 'x']) assert.throws(() => validateReadjustmentProposalRequest(value))
})

test('S2: proposal response validator rejects inconsistent bodies', () => {
  const proposal = proposeReadjustment(build({ courses: { C: 7 }, sections: { C: sectionsOf(1, [
    { capacity: 1, students: 2, rooms: [room('classroom', 3)] }, { capacity: 1, students: 2, rooms: [room('laboratory', 3)] }]) } }))
  assert.doesNotThrow(() => validateReadjustmentProposal(proposal))
  const clone = () => structuredClone(proposal)
  const mutate = (change) => { const value = clone(); change(value); return value }
  const open = proposal.actions.findIndex((action) => action.type === 'open-section')
  const cases = {
    'extra key': mutate((value) => { value.extra = 1 }),
    'revision': mutate((value) => { value.revision = 'PA-READJUST-2' }),
    'bad fingerprint': mutate((value) => { value.basisFingerprint = 'x' }),
    'no-change with actions': mutate((value) => { value.status = 'no-change' }),
    'actions with no-change status empty': mutate((value) => { value.actions = []; value.status = 'actions' }),
    'wrong open id': mutate((value) => { value.actions[open].id = 'open:Z' }),
    'wrong count': mutate((value) => { value.actions[open].count += 1 }),
    'wrong ordinals': mutate((value) => { value.actions[open].ordinals = [9] }),
    'widen not wider': mutate((value) => { value.actions[0].newCapacity = value.actions[0].capacity }),
    'wrong remaining excess': mutate((value) => { value.actions[0].remainingExcess = 5 }),
    'keep without excess': mutate((value) => { value.actions[1].demand = value.actions[1].capacity }),
    'keep bad reason': mutate((value) => { value.actions[1].reason = 'OTHER' }),
    'duplicate action': mutate((value) => { value.actions.push(structuredClone(value.actions[0])) }),
    'out of order': mutate((value) => { value.actions.reverse() }),
    'unknown type': mutate((value) => { value.actions[0].type = 'close-section' }),
    'section of another course': mutate((value) => { value.actions[1].courseId = 'Z' }),
  }
  for (const [name, value] of Object.entries(cases)) assert.throws(() => validateReadjustmentProposal(value), TypeError, name)
})

test('S2: persisted record validator is strict and its accepted actions must be coherent', () => {
  const record = {
    revision: 'PA-READJUST-1', basisFingerprint, publicationId, publicationVersion: 1, createdAt: '2027-01-01T00:00:00.000Z',
    acceptedActions: [{ id: 'open:C', type: 'open-section', courseId: 'C', count: 1 }, { id: `widen:${sid('C', 1)}`, type: 'widen-cap', courseId: 'C', sectionId: sid('C', 1), newCapacity: 3 }],
  }
  assert.doesNotThrow(() => validateAcademicReadjustmentRecord(record))
  const bad = [
    { revision: 'x' }, { extra: 1 }, { basisFingerprint: 'x' }, { publicationId: 'x' }, { publicationVersion: 0 }, { createdAt: 'yesterday' }, { acceptedActions: [] },
    { acceptedActions: [{ id: 'open:C', type: 'open-section', courseId: 'C' }] },
    { acceptedActions: [{ id: 'open:C', type: 'open-section', courseId: 'C', count: 0 }] },
    { acceptedActions: [{ id: 'open:C', type: 'open-section', courseId: 'C', count: 1, newCapacity: 3 }] },
    { acceptedActions: [{ id: 'open:Z', type: 'open-section', courseId: 'C', count: 1 }] },
    { acceptedActions: [{ id: `widen:${sid('C', 1)}`, type: 'widen-cap', courseId: 'Z', sectionId: sid('C', 1), newCapacity: 3 }] },
    { acceptedActions: [{ id: `widen:${sid('C', 1)}`, type: 'widen-cap', courseId: 'C', sectionId: sid('C', 1), newCapacity: 3, count: 1 }] },
    { acceptedActions: [{ id: `keep:${sid('C', 1)}`, type: 'keep', courseId: 'C' }] },
    { acceptedActions: [record.acceptedActions[0], record.acceptedActions[0]] },
  ]
  for (const change of bad) assert.throws(() => validateAcademicReadjustmentRecord({ ...record, ...change }), TypeError, JSON.stringify(change).slice(0, 80))
  const proposal = proposeReadjustment(build({ courses: { C: 7 }, sections: { C: sectionsOf(1, [{ capacity: 1, students: 2, rooms: [room('classroom', 3)] }, { capacity: 1, students: 2, rooms: [room('laboratory', 3)] }]) } }))
  const keep = proposal.actions.find((action) => action.type === 'keep').id
  assert.deepEqual(resolveAcceptedReadjustmentActions(proposal, ['open:C']).ok, true)
  assert.deepEqual(resolveAcceptedReadjustmentActions(proposal, ['open:C', keep]), { ok: false, invalidIds: [keep], actions: [] })
  assert.deepEqual(resolveAcceptedReadjustmentActions(proposal, ['open:Z']).invalidIds, ['open:Z'])
})

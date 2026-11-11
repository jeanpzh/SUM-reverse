import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROTOTYPE_TEACHER_PROFILES } from '../../../shared/prototype-teacher-profiles.mjs'
import { createAcademicPlanningDefaults } from './academicScheduling.ts'
import { buildUnifiedTeachers } from './academicResources.ts'
import type { AcademicCatalog, AcademicTeacherResource } from '../../../shared/programacion-academica-api.mjs'

test('synthetic planning defaults agree with every normative chat reference profile', () => {
  const catalog = { courses: [], referenceTeachers: PROTOTYPE_TEACHER_PROFILES.map(({ id }) => ({ id, name: id, courseIds: [] })) } as unknown as AcademicCatalog
  const defaults = createAcademicPlanningDefaults(catalog, '2027-I')
  assert.equal(defaults.lectiveHourMinutes, 60)
  for (const profile of PROTOTYPE_TEACHER_PROFILES) {
    const teacher = defaults.resources.teachers.find((t) => t.id === profile.id)!
    assert.equal(teacher.appointment, profile.regime === 'ordinario' ? 'faculty-ordinary' : 'contract')
    assert.equal(teacher.regime, ({ TC: 'tiempo-completo', DE: 'dedicacion-exclusiva', TP: 'tiempo-parcial' })[profile.dedication])
    assert.equal(teacher.maxWeeklyMinutes, profile.regime === 'ordinario' ? 720 : 600)
  }
})

test('unified local and reference resources preserve regulated teacher fields', () => {
  const teacher: AcademicTeacherResource = { id: 'SYN-T', name: 'Synthetic', courseIds: [], availability: [], maxWeeklyMinutes: 720,
    regime: 'tiempo-completo', appointment: 'faculty-ordinary', weeklyServiceHours: 30,
    loadConditions: ['renacyt-researcher'], loadAuthorizations: [{ kind: 'voluntary-declaration', reference: 'SYN-DECLARATION' }] }
  for (const references of [[], [{ id: teacher.id, name: teacher.name, courseIds: [] }]]) {
    const copy = buildUnifiedTeachers(references, [teacher], {})[0]
    for (const key of ['regime', 'appointment', 'weeklyServiceHours', 'loadConditions', 'loadAuthorizations'] as const) assert.deepEqual(copy[key], teacher[key])
  }
})

test('publication authorization conflicts use a human message at the data seam', async () => {
  const { publishAcademicDraft, academicPlanningErrorMessage } = await import('./academicScheduling.ts')
  const error = Object.assign(new Error('wire message'), { code: 'LOAD_AUTHORIZATION_REQUIRED' })
  assert.match(academicPlanningErrorMessage(error), /autorización formal/)
  const fetchImpl = (async () => new Response(JSON.stringify({ error: { code: error.code, message: 'wire message', blockers: [
    { teacherId: 'SYN-T', assignedMinutes: 960, authorizedMaxMinutes: 720, reason: 'over-authorized-load', requiredAuthorization: 'voluntary-declaration', sourceIds: ['OF-02'] },
  ] } }), { status: 409 })) as typeof fetch
  await assert.rejects(publishAcademicDraft('00000000-0000-4000-8000-000000000001', { expectedVersion: 1, expectedCurrentId: null }, fetchImpl), /autorización formal/)
})

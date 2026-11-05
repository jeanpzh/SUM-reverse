import assert from 'node:assert/strict'
import { intervalsOverlap, validateAcademicSchedule } from '../src/programacion-academica/schedule-validator.ts'
import { createSyntheticSchedule } from '../src/programacion-academica/schedule.fixtures.ts'

/** The same cases run under Node and Vitest; importing this file registers nothing. */
export function registerScheduleTests(test) {
  const interval = (startMinute, endMinute, day = 1) => ({ day, startMinute, endMinute })
  const check = (name, change, expected) => test(name, () => {
    const schedule = createSyntheticSchedule()
    change(schedule)
    const result = validateAcademicSchedule(schedule)
    assert.equal(result.valid, false)
    assert.ok(result.issues.some((issue) => issue.code === expected), JSON.stringify(result))
    for (const issue of result.issues) {
      assert.ok(issue.message.length > 0)
      assert.ok(Array.isArray(issue.assignmentIds))
      assert.ok(Object.hasOwn(issue, 'resourceId'))
      assert.ok(Object.hasOwn(issue, 'field'))
    }
  })

  for (const [name, a, b, expected] of [
    ['partial overlap', interval(540, 600), interval(570, 630), true],
    ['contained interval', interval(540, 660), interval(570, 600), true],
    ['identical interval', interval(540, 600), interval(540, 600), true],
    ['adjacent intervals', interval(540, 600), interval(600, 660), false],
    ['separate intervals', interval(540, 600), interval(660, 720), false],
    ['different days', interval(540, 600), interval(540, 600, 2), false],
    ['midnight boundary', interval(1380, 1440), interval(0, 60), false],
  ]) test(name, () => {
    assert.equal(intervalsOverlap(a, b), expected)
    assert.equal(intervalsOverlap(b, a), expected)
  })

  for (const bad of [null, interval(600, 600), interval(660, 600), interval(-1, 60),
    interval(0, 1441), interval(0.5, 60), interval(0, 60, 0), interval(0, 60, 8),
    { day: 1, startMinute: '540', endMinute: 600 }, interval(NaN, 600), interval(0, Infinity)]) {
    test(`reject invalid public interval ${JSON.stringify(bad)}`, () => {
      assert.throws(() => intervalsOverlap(bad, interval(540, 600)), TypeError)
      assert.throws(() => intervalsOverlap(interval(540, 600), bad), TypeError)
    })
  }

  test('synthetic adjacent sessions and equal room capacity are valid', () => {
    assert.deepEqual(validateAcademicSchedule(createSyntheticSchedule()), { valid: true, issues: [] })
  })
  test('an empty schedule is valid', () => {
    assert.equal(validateAcademicSchedule({ courses: [], teachers: [], rooms: [], sections: [], assignments: [], compatibleGroups: [] }).valid, true)
  })

  check('teacher overlap identifies resource and both assignments', (s) => {
    s.assignments[1].interval = interval(570, 630)
    s.assignments[1].teacherId = 'T1'
  }, 'TEACHER_CONFLICT')
  check('room overlap', (s) => {
    s.assignments[1].interval = interval(570, 630)
    s.assignments[1].roomId = 'R1'
  }, 'ROOM_CONFLICT')
  check('section overlap with distinct teacher and room', (s) => {
    s.assignments[1].interval = interval(570, 630)
    s.assignments[1].sectionId = 'S1'
  }, 'SECTION_CONFLICT')
  test('conflict contains exact teacher and assignment IDs', () => {
    const s = createSyntheticSchedule()
    s.assignments[1].interval = interval(570, 630)
    s.assignments[1].teacherId = 'T1'
    const issue = validateAcademicSchedule(s).issues.find((item) => item.code === 'TEACHER_CONFLICT')
    assert.equal(issue.resourceType, 'teacher')
    assert.equal(issue.resourceId, 'T1')
    assert.deepEqual(issue.assignmentIds, ['A1', 'A2'])
  })
  test('the same teacher and room can teach adjacent sessions up to the exact load limit', () => {
    const s = createSyntheticSchedule()
    s.assignments[1].teacherId = 'T1'
    s.assignments[1].roomId = 'R1'
    assert.equal(validateAcademicSchedule(s).valid, true)
  })
  check('insufficient room capacity', (s) => { s.rooms[0].capacity = 29 }, 'ROOM_CAPACITY')
  check('teacher outside availability', (s) => { s.teachers[0].availability = [interval(550, 720)] }, 'TEACHER_UNAVAILABLE')
  check('room outside availability', (s) => { s.rooms[0].availability = [interval(480, 590)] }, 'ROOM_UNAVAILABLE')
  check('availability on a different day', (s) => { s.teachers[0].availability[0].day = 2 }, 'TEACHER_UNAVAILABLE')
  check('empty availability is unavailable', (s) => { s.teachers[0].availability = [] }, 'TEACHER_UNAVAILABLE')
  test('contiguous and overlapping availability windows cover a full session', () => {
    const s = createSyntheticSchedule()
    s.teachers[0].availability = [interval(570, 600), interval(540, 570)]
    s.rooms[0].availability = [interval(540, 580), interval(570, 600)]
    assert.equal(validateAcademicSchedule(s).valid, true)
  })
  check('a one-minute gap is not availability', (s) => {
    s.teachers[0].availability = [interval(540, 570), interval(571, 600)]
  }, 'TEACHER_UNAVAILABLE')
  check('teacher not qualified for the course', (s) => { s.teachers[0].courseIds = ['SYN-PLANNING-B'] }, 'TEACHER_NOT_QUALIFIED')
  check('weekly load over limit', (s) => {
    s.assignments[1].teacherId = 'T1'
    s.teachers[0].maxWeeklyMinutes = 119
  }, 'TEACHER_LOAD_EXCEEDED')
  check('zero teaching load permits no assigned session', (s) => { s.teachers[0].maxWeeklyMinutes = 0 }, 'TEACHER_LOAD_EXCEEDED')
  check('explicit course group forbids overlap', (s) => { s.assignments[1].interval = interval(570, 630) }, 'COURSE_GROUP_CONFLICT')
  test('different courses may overlap without an explicit group', () => {
    const s = createSyntheticSchedule()
    s.compatibleGroups = []
    s.assignments[1].interval = interval(570, 630)
    assert.equal(validateAcademicSchedule(s).valid, true)
  })
  test('parallel sections of the same course do not cause a group conflict', () => {
    const s = createSyntheticSchedule()
    s.sections[1].courseId = 'SYN-PLANNING-A'
    s.assignments[1].interval = interval(570, 630)
    assert.equal(validateAcademicSchedule(s).valid, true)
  })

  for (const [field, resourceType] of [['teacherId', 'teacher'], ['roomId', 'room'], ['sectionId', 'section']]) {
    test(`unknown ${field} is structured`, () => {
      const s = createSyntheticSchedule()
      s.assignments[0][field] = 'UNKNOWN'
      const issue = validateAcademicSchedule(s).issues.find((item) => item.code === 'RESOURCE_NOT_FOUND')
      assert.equal(issue.resourceType, resourceType)
      assert.equal(issue.resourceId, 'UNKNOWN')
      assert.deepEqual(issue.assignmentIds, ['A1'])
    })
  }
  check('unknown section course', (s) => { s.sections[0].courseId = 'UNKNOWN' }, 'RESOURCE_NOT_FOUND')
  check('unknown qualification course', (s) => { s.teachers[0].courseIds.push('UNKNOWN') }, 'RESOURCE_NOT_FOUND')
  check('unknown compatibility course', (s) => { s.compatibleGroups[0].courseIds.push('UNKNOWN') }, 'RESOURCE_NOT_FOUND')

  for (const key of ['teachers', 'rooms', 'sections', 'assignments', 'compatibleGroups']) {
    check(`duplicate ID in ${key}`, (s) => { s[key].push(structuredClone(s[key][0])) }, 'INVALID_INPUT')
  }
  for (const bad of [null, [], 'schedule', { courses: [] }]) test(`invalid schedule shape ${JSON.stringify(bad)}`, () => {
    const result = validateAcademicSchedule(bad)
    assert.equal(result.valid, false)
    assert.ok(result.issues.every((item) => item.code === 'INVALID_INPUT'))
  })
  for (const [name, change] of [
    ['zero room capacity', (s) => { s.rooms[0].capacity = 0 }],
    ['fractional section capacity', (s) => { s.sections[0].capacity = 1.5 }],
    ['negative maximum load', (s) => { s.teachers[0].maxWeeklyMinutes = -1 }],
    ['invalid session interval', (s) => { s.assignments[0].interval = interval(600, 600) }],
    ['unknown input field', (s) => { s.extra = true }],
    ['missing assignment field', (s) => { delete s.assignments[0].roomId }],
    ['blank teacher ID', (s) => { s.teachers[0].id = ' ' }],
    ['duplicate courses', (s) => { s.courses.push(s.courses[0]) }],
    ['sparse assignment array', (s) => { delete s.assignments[0] }],
    ['sparse course array', (s) => { delete s.courses[0] }],
    ['invalid availability', (s) => { s.rooms[0].availability = [interval(0, 1441)] }],
    ['wrong collection type', (s) => { s.teachers = null }],
  ]) check(name, change, 'INVALID_INPUT')

  test('validation is repeatable and never mutates input, including availability ordering', () => {
    const s = createSyntheticSchedule()
    const before = structuredClone(s)
    const first = validateAcademicSchedule(s)
    assert.deepEqual(validateAcademicSchedule(s), first)
    assert.deepEqual(s, before)
  })
  test('synthetic fixtures are independent copies', () => {
    const s = createSyntheticSchedule()
    s.rooms[0].availability[0].startMinute = 1
    assert.equal(createSyntheticSchedule().rooms[0].availability[0].startMinute, 480)
  })
}

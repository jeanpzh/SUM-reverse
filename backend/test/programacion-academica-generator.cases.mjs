import assert from 'node:assert/strict'
import { generateAcademicSchedule } from '../src/programacion-academica/schedule-generator.ts'
import { checkSessionCoverage, createCoverageAuthority } from '../src/programacion-academica/session-coverage.ts'
import { GENERATOR_LIMITS } from '../src/programacion-academica/generator-limits.ts'
import { validateAcademicSchedule } from '../src/programacion-academica/schedule-validator.ts'
import { createSyntheticGeneratorInput } from '../src/programacion-academica/generator.fixtures.ts'

export function registerGeneratorTests(test) {
  const generate = generateAcademicSchedule
  const fixture = createSyntheticGeneratorInput
  const complete = () => generate(fixture())
  const interval = (startMinute, endMinute) => ({ day: 1, startMinute, endMinute })
  const checkStatus = (name, change, status) => test(name, () => {
    const input = fixture()
    change(input)
    const result = generate(input)
    assert.equal(result.status, status, JSON.stringify(result))
    assert.ok(result.diagnostics.length > 0)
    if (result.schedule) assert.equal(validateAcademicSchedule(result.schedule).valid, true)
    if (status !== 'complete' && result.coverage) assert.equal(result.coverage.complete, false)
  })

  test('stage-1 rounding creates two sections with both explicit weekly sessions', () => {
    const result = complete()
    assert.equal(result.status, 'complete')
    assert.equal(result.schedule.sections.length, 2)
    assert.deepEqual(result.schedule.sections.map((s) => s.capacity), [30, 30])
    assert.equal(result.requirements.length, 4)
    assert.equal(result.schedule.assignments.length, 4)
    assert.deepEqual(result.schedule.assignments.map((a) => a.interval.startMinute), [540, 600, 660, 720])
    assert.deepEqual(result.coverage, { complete: true, missingSessionIds: [], issues: [] })
    assert.equal(validateAcademicSchedule(result.schedule).valid, true)
  })
  test('variable session durations are scheduled explicitly, not derived from credits', () => {
    const input = fixture()
    input.courses[0].estimatedDemand = 1
    input.courses[0].weeklySessions = [{ id: 'long', durationMinutes: 120 }, { id: 'short', durationMinutes: 60 }]
    const result = generate(input)
    assert.equal(result.status, 'complete')
    assert.deepEqual(result.schedule.assignments.map((a) => a.interval.endMinute - a.interval.startMinute), [120, 60])
  })
  test('IDs with delimiters or escaped Unicode produce stable, distinct session IDs', () => {
    const input = fixture()
    input.courses[0].courseId = 'A:"\\\ud800'
    input.teachers[0].courseIds = [input.courses[0].courseId]
    input.courses[0].weeklySessions = [{ id: 'x:y', durationMinutes: 60 }, { id: 'x%3Ay', durationMinutes: 60 }]
    const result = generate(input)
    assert.equal(result.status, 'complete')
    assert.equal(new Set(result.requirements.map((session) => session.id)).size, 4)
    assert.deepEqual(generate(input), result)
  })
  checkStatus('zero demand creates no sections or required sessions even at zero budget', (i) => {
    i.courses[0].estimatedDemand = 0
    i.maxExplorations = 0
  }, 'complete')
  test('empty domain with no demanded courses is complete', () => {
    assert.equal(generate({ courses: [], teachers: [], rooms: [], compatibleGroups: [], windows: [], startStepMinutes: 60, maxExplorations: 0 }).status, 'complete')
  })
  checkStatus('no teachers proves impossibility in declared domain', (i) => { i.teachers = [] }, 'impossible')
  checkStatus('no rooms proves impossibility', (i) => { i.rooms = [] }, 'impossible')
  checkStatus('no windows proves impossibility', (i) => { i.windows = [] }, 'impossible')
  checkStatus('meeting longer than any window is impossible', (i) => { i.courses[0].weeklySessions = [{ id: 'long', durationMinutes: 300 }] }, 'impossible')
  checkStatus('insufficient room capacity is not silently reduced', (i) => { i.rooms[0].capacity = 29 }, 'impossible')
  checkStatus('insufficient weekly teaching load is impossible', (i) => { i.teachers[0].maxWeeklyMinutes = 60 }, 'impossible')
  checkStatus('no qualified teacher is impossible', (i) => { i.teachers[0].courseIds = [] }, 'impossible')
  checkStatus('unavailable teacher is impossible', (i) => { i.teachers[0].availability = [] }, 'impossible')
  checkStatus('unavailable room is impossible', (i) => { i.rooms[0].availability = [] }, 'impossible')
  test('partial proposals remain valid and explain missing sessions and observed rejection codes', () => {
    const input = fixture()
    input.courses[0].deliveryMode = 'split'
    input.windows = [interval(540, 600)]
    const result = generate(input)
    assert.equal(result.status, 'impossible')
    assert.equal(result.schedule.assignments.length, 1)
    assert.equal(result.coverage.missingSessionIds.length, 3)
    assert.ok(result.rejectionCounts.TEACHER_CONFLICT > 0)
    assert.ok(result.rejectionCounts.ROOM_CONFLICT > 0)
    assert.ok(result.rejectionCounts.SECTION_CONFLICT > 0)
    assert.deepEqual(result.diagnostics[0].sessionIds, result.coverage.missingSessionIds)
  })

  const backtrackInput = () => ({
    courses: ['A', 'B'].map((courseId) => ({ courseId, estimatedDemand: 1, targetCapacity: 1,
      weeklySessions: [{ id: 'weekly', durationMinutes: 60 }] })),
    teachers: [
      { id: 'T1', courseIds: ['A'], maxWeeklyMinutes: 60, availability: [interval(540, 660)] },
      { id: 'T2', courseIds: ['B'], maxWeeklyMinutes: 60, availability: [interval(540, 600)] },
    ],
    rooms: [{ id: 'R1', capacity: 1, availability: [interval(540, 660)] }],
    compatibleGroups: [{ id: 'G1', courseIds: ['A', 'B'] }],
    windows: [interval(540, 660)], startStepMinutes: 60, maxExplorations: 100,
  })
  test('backtracking moves first course to make room for a constrained course', () => {
    const result = generate(backtrackInput())
    assert.equal(result.status, 'complete')
    assert.ok(result.backtracks > 0)
    assert.deepEqual(result.schedule.assignments.map((a) => a.interval.startMinute), [600, 540])
  })
  test('explicit compatible groups prevent overlap even with distinct resources', () => {
    const input = backtrackInput()
    input.rooms.push({ id: 'R2', capacity: 1, availability: [interval(540, 660)] })
    input.windows = [interval(540, 600)]
    const result = generate(input)
    assert.equal(result.status, 'impossible')
    assert.ok(result.rejectionCounts.COURSE_GROUP_CONFLICT > 0)
    input.compatibleGroups = []
    assert.equal(generate(input).status, 'complete')
  })
  test('repeated calls are deeply reproducible and do not mutate inputs', () => {
    const input = backtrackInput()
    const before = structuredClone(input)
    assert.deepEqual(generate(input), generate(input))
    assert.deepEqual(input, before)
  })
  test('catalog enumeration is independent of course and resource insertion order', () => {
    const input = backtrackInput()
    const first = generate(input)
    input.courses.reverse()
    input.teachers.reverse()
    assert.deepEqual(generate(input).schedule.assignments, first.schedule.assignments)
  })
  test('duplicated windows do not duplicate candidate attempts', () => {
    const input = fixture()
    const before = generate(input)
    input.windows.push(structuredClone(input.windows[0]))
    const after = generate(input)
    assert.deepEqual(after.schedule, before.schedule)
    assert.equal(after.exploredCandidates, before.exploredCandidates)
  })
  test('impossibility is limited to the declared start grid', () => {
    const input = fixture()
    input.courses[0].estimatedDemand = 1
    input.courses[0].weeklySessions = [{ id: 'weekly', durationMinutes: 60 }]
    input.windows = [interval(540, 660)]
    input.teachers[0].availability = [interval(570, 630)]
    assert.equal(generate(input).status, 'impossible')
    input.startStepMinutes = 30
    const result = generate(input)
    assert.equal(result.status, 'complete')
    assert.equal(result.schedule.assignments[0].interval.startMinute, 570)
  })
  checkStatus('zero budget with outstanding candidates is search-limit, not impossible', (i) => { i.maxExplorations = 0 }, 'search-limit')
  test('budget of one returns a valid single-session prefix and incomplete coverage', () => {
    const input = fixture()
    input.courses[0].deliveryMode = 'split'
    input.maxExplorations = 1
    const result = generate(input)
    assert.equal(result.status, 'search-limit')
    assert.equal(result.exploredCandidates, 1)
    assert.equal(result.schedule.assignments.length, 1)
    assert.equal(result.coverage.complete, false)
  })
  test('exact budget can still finish complete', () => {
    const input = fixture()
    input.maxExplorations = complete().exploredCandidates
    const result = generate(input)
    assert.equal(result.status, 'complete')
    assert.equal(result.exploredCandidates, input.maxExplorations)
  })
  test('exhausting all candidates exactly at budget proves impossible', () => {
    const input = fixture()
    input.windows = [interval(540, 600)]
    input.teachers[0].courseIds = []
    input.maxExplorations = 1
    assert.equal(generate(input).status, 'impossible')
  })
  test('invalid inputs are distinct from an impossible schedule', () => {
    const result = generate(null)
    assert.equal(result.status, 'invalid-input')
    assert.equal(result.schedule, null)
    assert.equal(result.coverage, null)
    assert.equal(result.exploredCandidates, 0)
  })
  /** @type {Array<[string, (input: any) => void]>} Invalid inputs are intentional. */
  const invalidInputCases = [
    ['zero capacity', (i) => { i.courses[0].targetCapacity = 0 }],
    ['negative demand', (i) => { i.courses[0].estimatedDemand = -1 }],
    ['missing weekly declaration', (i) => { delete i.courses[0].weeklySessions }],
    ['empty weekly declaration', (i) => { i.courses[0].weeklySessions = [] }],
    ['zero duration', (i) => { i.courses[0].weeklySessions[0].durationMinutes = 0 }],
    ['fractional duration', (i) => { i.courses[0].weeklySessions[0].durationMinutes = 1.5 }],
    ['duplicate weekly ID', (i) => { i.courses[0].weeklySessions[1].id = 'first' }],
    ['duplicate courses', (i) => { i.courses.push(structuredClone(i.courses[0])) }],
    ['unknown qualification course', (i) => { i.teachers[0].courseIds.push('UNKNOWN') }],
    ['unknown group course', (i) => { i.compatibleGroups.push({ id: 'G', courseIds: ['UNKNOWN'] }) }],
    ['invalid window', (i) => { i.windows[0].day = 8 }],
    ['zero grid step', (i) => { i.startStepMinutes = 0 }],
    ['negative budget', (i) => { i.maxExplorations = -1 }],
    ['fractional budget', (i) => { i.maxExplorations = 1.5 }],
    ['excessive budget', (i) => { i.maxExplorations = 100001 }],
    ['too many required sections', (i) => { i.courses[0].estimatedDemand = Number.MAX_SAFE_INTEGER }],
    ['too many required meetings', (i) => { i.courses[0].estimatedDemand = 30 * 100 }],
    ['extra input field', (i) => { i.assignments = [] }],
    ['credits cannot replace duration', (i) => { i.courses[0].weeklySessions[0] = { id: 'first', credits: 4 } }],
    ['sparse course array', (i) => { delete i.courses[0] }],
    ['sparse weekly sessions', (i) => { delete i.courses[0].weeklySessions[0] }],
  ]
  for (const [name, change] of invalidInputCases) checkStatus(`invalid input: ${name}`, change, 'invalid-input')

  test('coverage rejects a missing weekly session even when the remaining schedule is valid', () => {
    const result = complete()
    result.schedule.assignments.pop()
    const coverage = checkSessionCoverage(result.schedule, fixture())
    assert.equal(validateAcademicSchedule(result.schedule).valid, true)
    assert.equal(coverage.complete, false)
    assert.equal(coverage.missingSessionIds.length, 1)
    assert.ok(coverage.issues.some((issue) => issue.code === 'MISSING_SESSION'))
  })
  /** @type {Array<[string, (schedule: any, input: any) => void, string]>} */
  const invalidCoverageCases = [
    ['wrong duration', (s) => { s.assignments[0].interval.endMinute -= 30 }, 'DURATION_MISMATCH'],
    ['wrong section', (s) => { s.assignments[0].sectionId = s.sections[1].id }, 'SECTION_MISMATCH'],
    ['wrong course', (s) => { s.courses.push('OTHER'); s.sections[0].courseId = 'OTHER'; s.teachers[0].courseIds.push('OTHER') }, 'CATALOG_MISMATCH'],
    ['unexpected assignment', (s) => { s.assignments[3].id = 'EXTRA' }, 'UNEXPECTED_SESSION'],
    ['duplicate assignment', (s) => { s.assignments.push(structuredClone(s.assignments[0])) }, 'INVALID_SCHEDULE'],
    ['conflicting assignment', (s) => { s.assignments[1].interval = structuredClone(s.assignments[0].interval) }, 'INVALID_SCHEDULE'],
    ['duplicate requirement', (s, i) => { i.courses[0].weeklySessions.push(structuredClone(i.courses[0].weeklySessions[0])) }, 'INVALID_SOURCE'],
    ['malformed requirement', (s, i) => { i.courses[0].weeklySessions[0].durationMinutes = NaN }, 'INVALID_SOURCE'],
    ['missing requirement field', (s, i) => { delete i.courses[0].weeklySessions[0].durationMinutes }, 'INVALID_SOURCE'],
    ['sparse requirements', (s, i) => { delete i.courses[0].weeklySessions[0] }, 'INVALID_SOURCE'],
  ]
  for (const [name, change, code] of invalidCoverageCases) test(`coverage detects ${name}`, () => {
    const result = complete()
    const originalInput = fixture()
    change(result.schedule, originalInput)
    const coverage = checkSessionCoverage(result.schedule, originalInput)
    assert.equal(coverage.complete, false)
    assert.ok(coverage.issues.some((issue) => issue.code === code), JSON.stringify(coverage))
  })
  test('coverage rejects non-array requirements and malformed schedules', () => {
    assert.equal(checkSessionCoverage(null, []).complete, false)
    assert.equal(checkSessionCoverage(complete().schedule, null).complete, false)
  })
  test('coverage and fixtures are independent and repeatable', () => {
    const result = complete()
    const before = structuredClone(result)
    assert.deepEqual(checkSessionCoverage(result.schedule, fixture()), result.coverage)
    assert.deepEqual(result, before)
    const first = fixture()
    first.courses[0].weeklySessions[0].durationMinutes = 1
    assert.equal(fixture().courses[0].weeklySessions[0].durationMinutes, 60)
  })

  test('omitting a section and all its returned requirements cannot establish completeness', () => {
    const input = fixture()
    const result = generate(input)
    const sectionId = result.schedule.sections[1].id
    result.schedule.assignments = result.schedule.assignments.filter((a) => a.sectionId !== sectionId)
    result.requirements = result.requirements.filter((r) => r.sectionId !== sectionId)
    assert.equal(checkSessionCoverage(result.schedule, result.requirements).complete, false)
    const checked = checkSessionCoverage(result.schedule, input)
    assert.equal(checked.complete, false)
    assert.equal(checked.missingSessionIds.length, 2)
  })
  test('an authority retains the original input even after caller mutation', () => {
    const input = fixture()
    const authority = createCoverageAuthority(input)
    const result = generate(input)
    input.courses[0].estimatedDemand = 0
    input.courses[0].weeklySessions.pop()
    result.requirements.length = 0
    assert.equal(authority.check(result.schedule).complete, true)
    result.schedule.assignments.pop()
    assert.equal(authority.check(result.schedule).complete, false)
  })
  test('removing a section from the proposed catalog cannot hide missing sessions', () => {
    const input = fixture(), result = generate(input)
    const section = result.schedule.sections.pop()
    result.schedule.assignments = result.schedule.assignments.filter((a) => a.sectionId !== section.id)
    const checked = checkSessionCoverage(result.schedule, input)
    assert.equal(checked.complete, false)
    assert.ok(checked.issues.some((i) => i.code === 'CATALOG_MISMATCH'))
    assert.equal(checked.missingSessionIds.length, 2)
  })
  test('proposed capacities cannot weaken original capacities', () => {
    const input = fixture(), result = generate(input)
    result.schedule.sections.forEach((s) => { s.capacity = 1 })
    result.schedule.rooms[0].capacity = 1
    assert.equal(checkSessionCoverage(result.schedule, input).complete, false)
  })
  test('proposed availability cannot authorize times absent from the original input', () => {
    const input = fixture(), result = generate(input)
    result.schedule.assignments.forEach((a) => { a.interval.day = 2 })
    result.schedule.teachers[0].availability[0].day = 2
    result.schedule.rooms[0].availability[0].day = 2
    assert.equal(validateAcademicSchedule(result.schedule).valid, true)
    const checked = checkSessionCoverage(result.schedule, input)
    assert.equal(checked.complete, false)
    assert.ok(checked.issues.some((i) => i.code === 'INVALID_SCHEDULE'))
  })
  test('catalog and availability insertion order do not change authority checks', () => {
    const input = backtrackInput(), result = generate(input)
    result.schedule.courses.reverse()
    result.schedule.teachers.reverse()
    result.schedule.sections.reverse()
    assert.equal(checkSessionCoverage(result.schedule, input).complete, true)
  })
  for (const key of ['teachers', 'rooms']) {
    checkStatus(`reject excessive availability for ${key}`, (i) => {
      i[key][0].availability = Array.from({ length: 33 }, () => interval(540, 780))
    }, 'invalid-input')
    checkStatus(`accept exact availability bound for ${key}`, (i) => {
      i[key][0].availability = Array.from({ length: 32 }, () => interval(540, 780))
    }, 'complete')
  }
  checkStatus('reject oversized source ID before generating escaped IDs', (i) => {
    i.courses[0].courseId = 'x'.repeat(81)
  }, 'invalid-input')
  checkStatus('reject oversized weekly-session ID', (i) => {
    i.courses[0].weeklySessions[0].id = 'x'.repeat(81)
  }, 'invalid-input')
  checkStatus('reject excessive qualification entries', (i) => {
    i.teachers[0].courseIds = Array.from({ length: 33 }, () => 'SYN-GEN-A')
  }, 'invalid-input')
  test('a cooperative time limit uses an injectable monotonic clock', () => {
    const input = fixture()
    input.courses[0].deliveryMode = 'split'
    let tick = 0
    const result = generate(input, { maxElapsedMs: 3, now: () => tick++ })
    assert.equal(result.status, 'search-limit')
    assert.equal(result.limitReason, 'time')
    assert.equal(result.exploredCandidates, 1)
    assert.equal(result.schedule.assignments.length, 1)
    assert.equal(result.coverage.complete, false)
  })
  test('zero elapsed allowance stops before validating a candidate', () => {
    const result = generate(fixture(), { maxElapsedMs: 0, now: () => 0 })
    assert.equal(result.status, 'search-limit')
    assert.equal(result.limitReason, 'time')
    assert.equal(result.exploredCandidates, 0)
  })
  test('enumeration limit counts duplicate candidates, not only validation attempts', () => {
    const input = fixture()
    input.courses[0].deliveryMode = 'split'
    input.windows = Array.from({ length: 32 }, () => interval(540, 600))
    const result = generate(input, { maxCandidateVisits: 5, now: () => 0 })
    assert.equal(result.status, 'search-limit')
    assert.equal(result.limitReason, 'work')
    assert.equal(result.candidateVisits, 5)
    assert.ok(result.exploredCandidates < result.candidateVisits)
  })
  test('exploration exhaustion remains distinct from temporal and work limits', () => {
    const input = fixture()
    input.maxExplorations = 1
    const result = generate(input, { now: () => 0 })
    assert.equal(result.limitReason, 'explorations')
    assert.equal(result.exploredCandidates, 1)
  })
  test('exhausting a finite domain exactly at work limit is still impossible', () => {
    const input = fixture()
    input.windows = [interval(540, 600)]
    input.teachers[0].courseIds = []
    const result = generate(input, { maxCandidateVisits: 1, now: () => 0 })
    assert.equal(result.status, 'impossible')
    assert.equal(result.limitReason, null)
  })
  test('execution options cannot exceed the prototype limits', () => {
    for (const maxElapsedMs of [-1, NaN, Infinity, GENERATOR_LIMITS.maxElapsedMs + 1]) {
      assert.throws(() => generate(fixture(), { maxElapsedMs }), TypeError)
    }
    for (const maxCandidateVisits of [-1, 0.5, GENERATOR_LIMITS.candidateVisits + 1]) {
      assert.throws(() => generate(fixture(), { maxCandidateVisits }), TypeError)
    }
  })
  test('a backwards clock is rejected rather than silently extending execution', () => {
    let tick = 3
    assert.throws(() => generate(fixture(), { now: () => tick-- }), TypeError)
  })

  test('default continuous delivery preserves requirement order and fits a 4-hour block from 18:00 to 22:00', () => {
    const input = fixture()
    input.courses[0].estimatedDemand = 1
    input.courses[0].weeklySessions = [
      { id: 'later-id', type: 'T', durationMinutes: 120 },
      { id: 'earlier-id', type: 'P', durationMinutes: 120 },
    ]
    input.windows = [{ day: 4, startMinute: 1080, endMinute: 1320 }]
    input.teachers[0].availability = structuredClone(input.windows)
    input.rooms[0].availability = structuredClone(input.windows)
    input.startStepMinutes = 60
    const result = generate(input)
    assert.equal(result.status, 'complete')
    assert.deepEqual(result.requirements.map((item) => [item.type, item.order]), [['T', 0], ['P', 1]])
    assert.ok(result.requirements[0].id.endsWith('"later-id"]'))
    assert.ok(result.requirements[1].id.endsWith('"earlier-id"]'))
    assert.deepEqual(result.schedule.assignments.map((item) => [item.interval.day, item.interval.startMinute, item.interval.endMinute]), [
      [4, 1080, 1200], [4, 1200, 1320],
    ])
  })

  test('a 6-hour continuous block fits 08:00 to 14:00', () => {
    const input = fixture()
    input.courses[0].estimatedDemand = 1
    input.courses[0].weeklySessions = [{ id: 'one', durationMinutes: 180 }, { id: 'two', durationMinutes: 180 }]
    input.teachers[0].maxWeeklyMinutes = 420
    input.windows = [{ day: 6, startMinute: 480, endMinute: 840 }]
    input.teachers[0].availability = structuredClone(input.windows)
    input.rooms[0].availability = structuredClone(input.windows)
    input.startStepMinutes = 60
    const result = generate(input)
    assert.equal(result.status, 'complete')
    assert.deepEqual(result.schedule.assignments.map((item) => [item.interval.startMinute, item.interval.endMinute]), [[480, 660], [660, 840]])
  })

  test('continuous availability proof checks starts inside the full declared window', () => {
    const input = fixture()
    input.courses[0].estimatedDemand = 1
    input.courses[0].weeklySessions = [{ id: 'first', durationMinutes: 60 }, { id: 'second', durationMinutes: 60 }]
    input.windows = [interval(540, 780)]
    input.teachers[0].availability = [interval(600, 720)]
    input.rooms[0].availability = [interval(600, 720)]
    const result = generate(input)
    assert.equal(result.status, 'complete')
    assert.equal(result.schedule.assignments[0].interval.startMinute, 600)
  })

  test('room may change between continuous components and each room retains capacity validation', () => {
    const input = fixture()
    input.courses[0].estimatedDemand = 1
    input.courses[0].weeklySessions = [{ id: 'first', durationMinutes: 120 }, { id: 'second', durationMinutes: 120 }]
    input.rooms = [
      { id: 'R1', capacity: 30, availability: [interval(1080, 1200)] },
      { id: 'R2', capacity: 30, availability: [interval(1200, 1320)] },
    ]
    input.windows = [{ day: 1, startMinute: 1080, endMinute: 1320 }]
    input.teachers[0].availability = structuredClone(input.windows)
    input.startStepMinutes = 60
    const result = generate(input)
    assert.equal(result.status, 'complete')
    assert.deepEqual(result.schedule.assignments.map((item) => item.roomId), ['R1', 'R2'])
    input.rooms[0].capacity = 29
    assert.equal(generate(input).status, 'impossible')
  })

  test('coverage rejects a reordered continuous block even when the base schedule is valid', () => {
    const input = fixture()
    input.courses[0].estimatedDemand = 1
    input.courses[0].weeklySessions = [{ id: 'first', durationMinutes: 60 }, { id: 'second', durationMinutes: 60 }]
    const result = generate(input)
    assert.equal(result.status, 'complete')
    const reordered = structuredClone(result.schedule)
    reordered.assignments[0].interval.startMinute += 60
    reordered.assignments[0].interval.endMinute += 60
    reordered.assignments[1].interval.startMinute -= 60
    reordered.assignments[1].interval.endMinute -= 60
    assert.equal(validateAcademicSchedule(reordered).valid, true)
    const coverage = checkSessionCoverage(reordered, input)
    assert.equal(coverage.complete, false)
    assert.ok(coverage.issues.some((issue) => issue.code === 'SECTION_DELIVERY_POLICY'))
  })

  test('work budget counts room choice work before forming full block combinations', () => {
    const input = fixture()
    input.courses[0].estimatedDemand = 1
    input.rooms.push({ id: 'R2', capacity: 30, availability: structuredClone(input.rooms[0].availability) })
    const result = generate(input, { maxCandidateVisits: 2, now: () => 0 })
    assert.equal(result.status, 'search-limit')
    assert.equal(result.limitReason, 'work')
    assert.equal(result.candidateVisits, 2)
    assert.equal(result.exploredCandidates, 0)
  })

  test('split mode can use separate days but keeps one teacher responsible for every section session', () => {
    const input = fixture()
    input.courses[0].estimatedDemand = 1
    input.courses[0].weeklySessions = [{ id: 'first', durationMinutes: 120 }, { id: 'second', durationMinutes: 120 }]
    input.courses[0].deliveryMode = 'split'
    input.windows = [interval(540, 660), { day: 2, startMinute: 540, endMinute: 660 }]
    input.teachers[0].availability = structuredClone(input.windows)
    input.rooms[0].availability = structuredClone(input.windows)
    const result = generate(input)
    assert.equal(result.status, 'complete')
    assert.equal(new Set(result.schedule.assignments.map((item) => item.teacherId)).size, 1)
    assert.deepEqual(result.schedule.assignments.map((item) => item.interval.day), [1, 2])
    const forged = structuredClone(result.schedule)
    forged.teachers.push({ id: 'T2', courseIds: ['SYN-GEN-A'], maxWeeklyMinutes: 240, availability: structuredClone(input.windows) })
    forged.assignments[1].teacherId = 'T2'
    const coverage = checkSessionCoverage(forged, input)
    assert.equal(coverage.complete, false)
    assert.ok(coverage.issues.some((issue) => issue.code === 'SECTION_DELIVERY_POLICY'))
  })

  test('split can schedule when no continuous teacher window covers the declared block', () => {
    const input = fixture()
    input.courses[0].estimatedDemand = 1
    input.courses[0].weeklySessions = [{ id: 'first', durationMinutes: 120 }, { id: 'second', durationMinutes: 120 }]
    input.teachers[0].availability = [{ day: 1, startMinute: 1080, endMinute: 1200 }, { day: 1, startMinute: 1201, endMinute: 1321 }]
    input.rooms[0].availability = [{ day: 1, startMinute: 1080, endMinute: 1200 }, { day: 1, startMinute: 1201, endMinute: 1321 }]
    input.windows = [{ day: 1, startMinute: 1080, endMinute: 1321 }]
    input.startStepMinutes = 1
    assert.equal(generate(input).status, 'impossible')
    input.courses[0].deliveryMode = 'split'
    assert.equal(generate(input).status, 'complete')
  })

  checkStatus('unknown delivery mode', (i) => { i.courses[0].deliveryMode = 'daily' }, 'invalid-input')
  checkStatus('empty optional session type', (i) => { i.courses[0].weeklySessions[0].type = '  ' }, 'invalid-input')
}

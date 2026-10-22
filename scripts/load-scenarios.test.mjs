import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { validateManifest } from '../load/profile-config.mjs'

const selection = [
  { courseId: 'COURSE-1', sectionId: 'SECTION-1' },
  { courseId: 'COURSE-2', sectionId: 'SECTION-1' },
  { courseId: 'COURSE-3', sectionId: 'SECTION-1' },
]

function manifest(actorCount, overrides = {}) {
  const actorSelection = () => selection.map((item) => ({ ...item }))
  const actors = Array.from({ length: actorCount }, (_, index) => ({
    actorId: `SYN-TEST-${String(index + 1).padStart(4, '0')}`,
    credential: `${String(index + 1).padStart(4, '0')}${'A'.repeat(39)}`,
    selection: actorSelection(),
  }))
  return {
    campaignId: '00000000-0000-4000-8000-000000000001',
    runId: '00000000-0000-4000-8000-000000000002',
    actors,
    selection: actorSelection(),
    contention: 'shared',
    ...overrides,
  }
}

test('legacy 100 actor manifest remains valid and preserves legacy expectations', () => {
  const validated = validateManifest(manifest(100))
  assert.equal(validated.actorCount, 100)
  assert.equal(validated.scenarioProfile, 'shared')
  assert.equal(validated.expectedAccepted, 10)
  assert.equal(validated.expectedRejected, 90)
})

test('400 actor manifest uses explicit expected outcomes and section metadata', () => {
  const value = manifest(400, {
    actorCount: 400,
    scenarioProfile: 'ample',
    expectedAccepted: 400,
    expectedRejected: 0,
    initialEnrollments: 0,
    initialRequests: 0,
    capacityBySection: selection.map((item) => ({ ...item, capacity: 400, initialOccupied: 0 })),
  })
  const validated = validateManifest(value)
  assert.equal(validated.actorCount, 400)
  assert.equal(validated.expectedAccepted, 400)
  assert.equal(validated.expectedRejected, 0)
})

test('multi-section preflight derives admission counts from actual cohort demand', () => {
  const value = manifest(400, {
    actorCount: 400, scenarioProfile: 'multi-hotspot', expectedAccepted: 100, expectedRejected: 300,
    initialEnrollments: 0, initialRequests: 0,
    capacityBySection: Array.from({ length: 5 }, (_, group) => selection.map((item, index) => ({
      courseId: item.courseId, sectionId: `GROUP-${group}`, capacity: index === 0 ? 20 : 400, initialOccupied: 0,
    }))).flat(),
  })
  delete value.selection
  value.actors.forEach((actor, index) => {
    const group = index < 320 ? 0 : 1 + ((index - 320) % 4)
    actor.selection = selection.map(item => ({ courseId: item.courseId, sectionId: `GROUP-${group}` }))
  })
  assert.equal(validateManifest(value).expectedAccepted, 100)
  assert.throws(() => validateManifest({ ...value, expectedAccepted: 99, expectedRejected: 301 }), /actual section capacity/)
})

test('manifest validation rejects count, identity, selection, and expected outcome inconsistencies', () => {
  assert.throws(() => validateManifest(manifest(400, { actorCount: 399 })), /actorCount/)
  assert.throws(() => validateManifest(manifest(400, { actorCount: 400, scenarioProfile: 'ample' })), /preflight fields/)
  const duplicateCredential = manifest(2)
  duplicateCredential.actors[1].credential = duplicateCredential.actors[0].credential
  assert.throws(() => validateManifest(duplicateCredential), /unique/)
  const repeatedCourse = manifest(1)
  repeatedCourse.selection[1] = { courseId: 'COURSE-1', sectionId: 'SECTION-2' }
  repeatedCourse.actors[0].selection = repeatedCourse.selection
  assert.throws(() => validateManifest(repeatedCourse), /selection/)
  assert.throws(() => validateManifest(manifest(2, { expectedAccepted: 2, expectedRejected: 1 })), /expectedRejected/)
  assert.throws(() => validateManifest(manifest(1, {
    actorCount: 1,
    scenarioProfile: 'ample',
    expectedAccepted: 1,
    expectedRejected: 0,
    initialEnrollments: 0,
    initialRequests: 0,
    capacityBySection: [{ courseId: 'COURSE-1', sectionId: 'SECTION-1', capacity: 1, initialOccupied: 0 }],
  })), /without capacity metadata/)
})

test('load scenarios retain distinct actors, bounded transient failures, and safe low-cardinality tags', async () => {
  const [common, mixed, resilience, retry, sessions, enrollment] = await Promise.all([
    readFile(new URL('../load/common.js', import.meta.url), 'utf8'),
    readFile(new URL('../load/mixed.js', import.meta.url), 'utf8'),
    readFile(new URL('../load/resilience.js', import.meta.url), 'utf8'),
    readFile(new URL('../load/retry.js', import.meta.url), 'utf8'),
    readFile(new URL('../load/sessions.js', import.meta.url), 'utf8'),
    readFile(new URL('../load/enrollment.js', import.meta.url), 'utf8'),
  ])
  assert.match(common, /validateManifest\(JSON\.parse\(open\(file\)\)\)/)
  const config = await readFile(new URL('../load/profile-config.mjs', import.meta.url), 'utf8')
  assert.match(config, /actorCount < 1 \|\| actorCount > 2000/)
  assert.match(common, /RENEW_BEFORE_MS = 90 \* 1000/)
  assert.match(mixed, /actorPhase/)
  assert.match(mixed, /mixed_submit_actions: \[`count==\$\{actors\.length\}`\]/)
  assert.match(resilience, /resilience_sessions_ready/)
  assert.match(resilience, /resilience_recovered: \[`count==\$\{actors\.length\}`\]/)
  assert.match(resilience, /\[502, 503, 504\]/)
  assert.match(retry, /retry_replays: \[`count==\$\{actors\.length \* 2\}`\]/)
  assert.match(sessions, /maintainSession\(config, actor, identity, 'sessions'\)/)
  assert.match(enrollment, /expectedRejected = Number\(config\.manifest\.expectedRejected\)/)
  for (const source of [common, mixed, resilience, retry, sessions, enrollment]) {
    assert.doesNotMatch(source, /tags:\s*\{[^}]*\b(?:actorId|credential|sessionId)\b/)
  }
})

test('population boundaries admit 1000 distinct students and still reject above 2000', () => {
  const value = manifest(1000, {
    actorCount: 1000, scenarioProfile: 'ample', expectedAccepted: 1000, expectedRejected: 0,
    initialEnrollments: 0, initialRequests: 0,
    capacityBySection: selection.map(item => ({ ...item, capacity: 1000, initialOccupied: 0 })),
  })
  assert.equal(validateManifest(value).actors.length, 1000)
  assert.throws(() => validateManifest(manifest(2001)), /actorCount/)
})

test('fault runner restores owned services with supported Compose commands', async () => {
  const runner = await readFile(new URL('../load/scenarios.sh', import.meta.url), 'utf8')
  assert.match(runner, /flock -n 9/)
  assert.match(runner, /trap cleanup EXIT/)
  assert.match(runner, /docker compose up -d --wait --no-deps postgres/)
  assert.doesNotMatch(runner, /docker compose start --wait/)
  assert.doesNotMatch(runner, /down\s+-v|docker\.sock|datos-reales/)
})

test('actor count accepts 1422 and rejects 2001', () => {
  assert.equal(validateManifest(manifest(1422)).actorCount, 1422)
  assert.throws(() => validateManifest(manifest(2001)), /1\.\.2000/)
})

// Mirrors the backend fisi-schools manifest shape: one shared selection per cohort, disjoint by section.
function fisiManifest(cells, { jornada = false, scarce = false } = {}) {
  const courses = ['C1', 'C2', 'C3']
  const sizes = {}
  for (const [, cohort, size] of cells) sizes[cohort] = (sizes[cohort] ?? 0) + size
  const capacityOf = (cohort, course) => (scarce && course === 0 ? Math.max(1, Math.floor(sizes[cohort] * 0.5)) : sizes[cohort])
  const sectionIds = cohort => courses.map(course => `${course}-FISI-${cohort}`)
  const actors = []
  for (const [wave, cohort, size] of cells) {
    for (let n = 0; n < size; n++) {
      const index = actors.length + 1
      actors.push({ actorId: `SYN-SIS-U${String(index).padStart(4, '0')}`, credential: `${String(index).padStart(4, '0')}${'B'.repeat(39)}`, cohort, ...(jornada ? { wave } : {}), selection: courses.map(courseId => ({ courseId, sectionId: `${courseId}-FISI-${cohort}` })) })
    }
  }
  const cohorts = Object.keys(sizes).map(cohort => ({ cohort, size: sizes[cohort], capacity: capacityOf(cohort, 0), sectionIds: sectionIds(cohort), expectedAccepted: Math.min(sizes[cohort], capacityOf(cohort, 0)) }))
  const expectedAccepted = cohorts.reduce((sum, cohort) => sum + cohort.expectedAccepted, 0)
  const waveTotals = new Map()
  for (const [wave, , size] of cells) waveTotals.set(wave, (waveTotals.get(wave) ?? 0) + size)
  return {
    campaignId: '00000000-0000-4000-8000-000000000001',
    runId: '00000000-0000-4000-8000-000000000002',
    actorCount: actors.length, actors, contention: 'shared', scenarioProfile: 'fisi-schools',
    expectedAccepted, expectedRejected: actors.length - expectedAccepted, initialEnrollments: 0, initialRequests: 0,
    capacityBySection: cohorts.flatMap(({ cohort }) => courses.map((courseId, course) => ({ courseId, sectionId: `${courseId}-FISI-${cohort}`, capacity: capacityOf(cohort, course), initialOccupied: 0 }))),
    fisi: jornada ? { mode: 'jornada', iaActors: 0, capacityMode: scarce ? 'scarce' : 'ample' } : { mode: 'franja', franja: 4, iaActors: 0, capacityMode: scarce ? 'scarce' : 'ample' },
    cohorts,
    hotCohortSize: Math.max(...cells.map(cell => cell[2])),
    ...(jornada ? { waves: [...waveTotals].map(([wave, size]) => ({ wave, label: `W${wave}`, ppFrom: 10, size })) } : {}),
  }
}
const franja4 = [[4, 'SIS', 286], [4, 'SOFT', 203], [4, 'CC', 18]]
const jornadaCells = [[1, 'SIS', 16], [1, 'SOFT', 7], [2, 'SIS', 67], [2, 'SOFT', 40], [2, 'CC', 6]]

test('fisi-schools franja manifest passes and exposes per-actor selection and cohort', () => {
  const validated = validateManifest(fisiManifest(franja4))
  assert.equal(validated.scenarioProfile, 'fisi-schools')
  assert.equal(validated.actors.length, 507)
  assert.equal(validated.expectedAccepted, 507)
  assert.ok(validated.actors.every(actor => actor.cohort && actor.selection.length === 3 && actor.wave === undefined))
  assert.equal(validateManifest(fisiManifest(franja4, { scarce: true })).expectedAccepted, 143 + 101 + 9)
})

test('fisi-schools jornada manifest passes with waves', () => {
  const validated = validateManifest(fisiManifest(jornadaCells, { jornada: true }))
  assert.deepEqual(validated.waves.map(wave => wave.size), [23, 113])
  assert.ok(validated.actors.every(actor => actor.wave >= 1 && actor.wave <= 9))
})

test('fisi-schools preflight rejects overlapping cohorts, selection drift and wave mismatches', () => {
  const overlap = fisiManifest(franja4)
  overlap.cohorts[1].sectionIds = [...overlap.cohorts[0].sectionIds]
  assert.throws(() => validateManifest(overlap), /disjoint/)

  const drift = fisiManifest(franja4)
  drift.actors[0].selection = drift.actors[300].selection.map(item => ({ ...item }))
  assert.throws(() => validateManifest(drift), /selection differs from its cohort/)

  const noSelection = fisiManifest(franja4)
  delete noSelection.actors[5].selection
  assert.throws(() => validateManifest(noSelection), /selection/)

  const sizes = fisiManifest(franja4)
  sizes.cohorts[2].size = 19
  assert.throws(() => validateManifest(sizes), /sum to the actor count|size/)

  const accepted = fisiManifest(franja4, { scarce: true })
  accepted.expectedAccepted -= 1
  accepted.expectedRejected += 1
  assert.throws(() => validateManifest(accepted), /expectedAccepted/)

  const badWaves = fisiManifest(jornadaCells, { jornada: true })
  badWaves.waves[0].size = 22
  badWaves.waves[1].size = 114
  assert.throws(() => validateManifest(badWaves), /wave 1 size differs/)

  const missingWave = fisiManifest(jornadaCells, { jornada: true })
  delete missingWave.actors[0].wave
  assert.throws(() => validateManifest(missingWave), /declared waves/)

  const unexpectedWave = fisiManifest(franja4)
  unexpectedWave.actors[0].wave = 4
  assert.throws(() => validateManifest(unexpectedWave), /only valid in jornada/)
})

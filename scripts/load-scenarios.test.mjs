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
  assert.match(config, /actorCount < 1 \|\| actorCount > 1000/)
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

test('population boundaries admit 1000 distinct students and reject 1001', () => {
  const value = manifest(1000, {
    actorCount: 1000, scenarioProfile: 'ample', expectedAccepted: 1000, expectedRejected: 0,
    initialEnrollments: 0, initialRequests: 0,
    capacityBySection: selection.map(item => ({ ...item, capacity: 1000, initialOccupied: 0 })),
  })
  assert.equal(validateManifest(value).actors.length, 1000)
  assert.throws(() => validateManifest(manifest(1001)), /actorCount/)
})

test('fault runner restores owned services with supported Compose commands', async () => {
  const runner = await readFile(new URL('../load/scenarios.sh', import.meta.url), 'utf8')
  assert.match(runner, /flock -n 9/)
  assert.match(runner, /trap cleanup EXIT/)
  assert.match(runner, /docker compose up -d --wait --no-deps postgres/)
  assert.doesNotMatch(runner, /docker compose start --wait/)
  assert.doesNotMatch(runner, /down\s+-v|docker\.sock|datos-reales/)
})

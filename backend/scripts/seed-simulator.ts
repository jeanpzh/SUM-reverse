import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { chmod, lstat, mkdir, link, unlink, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { Pool } from 'pg'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import type { ActorProfile, EnrollmentProfile, OfferedCourse } from '../src/matricula-regular/profile.types.js'
import { assertSyntheticDatabase } from './synthetic-database.js'

const connectionString = process.env.DATABASE_URL
const artifactDirectory = process.env.SIMULATOR_ARTIFACTS_DIR
const manifestName = process.env.SIMULATOR_MANIFEST_NAME ?? `manifest-${randomUUID()}.json`
const manifestPath = artifactDirectory ? resolve(artifactDirectory, manifestName) : ''
if (!connectionString) throw new Error('DATABASE_URL is required')
assertSyntheticDatabase(connectionString)
if (!artifactDirectory || !/^[a-zA-Z0-9._-]+\.json$/.test(manifestName) || !manifestPath) throw new Error('Set SIMULATOR_ARTIFACTS_DIR and an optional simple SIMULATOR_MANIFEST_NAME')
const relativeManifest = relative(resolve(artifactDirectory), manifestPath)
if (!relativeManifest || relativeManifest === '..' || relativeManifest.startsWith(`..${sep}`)) throw new Error('Manifest path must remain inside SIMULATOR_ARTIFACTS_DIR')
const pool = new Pool({ connectionString, max: 1, application_name: 'sum-simulator-seed' })
const campaignId = process.env.SIMULATOR_CAMPAIGN_ID ?? randomUUID()
const runId = process.env.SIMULATOR_RUN_ID ?? randomUUID()
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) throw new Error('Campaign and run IDs must be UUIDv4 values')
const credentialHash = (value: string) => createHash('sha256').update(value).digest()
const fixture = createSyntheticFixture('SISTEMAS')
const now = Date.now()
const profiles: EnrollmentProfile[] = [structuredClone(fixture.profile)]
profiles[0]!.calendar.effectiveWindows = [{ id: 'SYN-CAMPAIGN-WINDOW', startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 4 * 60 * 60_000).toISOString(), minPp: 0, origin: 'synthetic', sourceIds: ['SYN-FIXTURE'] }]
const actors: ActorProfile[] = Array.from({ length: 100 }, (_, index) => ({
  ...structuredClone(fixture.actors[0]!),
  actorId: `SYN-SIS-U${String(index + 1).padStart(4, '0')}`,
  name: `Estudiante sintético ${String(index + 1).padStart(4, '0')}`,
}))
const offer: OfferedCourse[] = structuredClone(fixture.offer)
const contention = process.env.SIMULATOR_CONTENTION ?? 'shared'
if (contention !== 'shared' && contention !== 'distributed') throw new Error('SIMULATOR_CONTENTION must be shared or distributed')
const sharedSelection = offer.map((course) => ({ courseId: course.courseId, sectionId: course.sections[0]!.sectionId }))
if (contention === 'shared') {
  offer.forEach((course, index) => { course.sections[0]!.capacity = index === 0 ? 10 : 100 })
} else {
  offer.forEach((course, courseIndex) => {
    const template = course.sections[0]!
    course.sections = actors.map((actor, actorIndex) => ({ ...structuredClone(template), sectionId: `${actor.actorId}-S${courseIndex + 1}`, capacity: 1, occupied: 0 }))
  })
}
const credentials = actors.map((actor) => ({ actorId: actor.actorId, credential: randomBytes(32).toString('base64url'), ...(contention === 'distributed' ? { selection: offer.map((course) => ({ courseId: course.courseId, sectionId: course.sections.find((section) => section.sectionId.startsWith(actor.actorId))!.sectionId })) } : {}) }))
const temporaryManifest = `${manifestPath}.${process.pid}.tmp`
let publishedManifest = false

try {
  await mkdir(dirname(manifestPath), { recursive: true, mode: 0o700 })
  try { await lstat(manifestPath); throw new Error('Manifest already exists; choose a new manifest name') } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await writeFile(temporaryManifest, `${JSON.stringify({ campaignId, runId, contention, expectedAccepted: contention === 'shared' ? 10 : 100, actors: credentials, selection: contention === 'shared' ? sharedSelection : undefined }, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("INSERT INTO simulator_campaigns(campaign_id,run_id,status,config) VALUES($1,$2,'open',$3)", [campaignId, runId, JSON.stringify({ profiles, offer })])
    for (const profile of profiles) await client.query('INSERT INTO simulator_profiles(campaign_id,profile_revision,profile) VALUES($1,$2,$3)', [campaignId, profile.profileRevision, JSON.stringify(profile)])
    for (const actor of actors) {
      const entry = credentials.find((item) => item.actorId === actor.actorId)!
      await client.query('INSERT INTO simulator_actors(campaign_id,actor_id,profile) VALUES($1,$2,$3)', [campaignId, actor.actorId, JSON.stringify(actor)])
      await client.query('INSERT INTO simulator_credentials(campaign_id,actor_id,credential_hash) VALUES($1,$2,$3)', [campaignId, actor.actorId, credentialHash(entry.credential)])
    }
    for (const course of offer) for (const section of course.sections) {
      const { sections: _sections, ...courseData } = course
      await client.query('INSERT INTO simulator_sections(campaign_id,course_id,section_id,capacity,occupied,course,section) VALUES($1,$2,$3,$4,$5,$6,$7)', [campaignId, course.courseId, section.sectionId, section.capacity, section.occupied, JSON.stringify(courseData), JSON.stringify({ schedule: section.schedule, label: section.label, teacher: section.teacher, room: section.room })])
    }
    await link(temporaryManifest, manifestPath)
    publishedManifest = true
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    if (publishedManifest) await unlink(manifestPath).catch(() => undefined)
    throw error
  } finally { client.release() }
  await unlink(temporaryManifest)
  await chmod(manifestPath, 0o600)
  process.stdout.write(`Seeded synthetic campaign ${campaignId} (${actors.length} actors)\n`)
} finally {
  await unlink(temporaryManifest).catch(() => undefined)
  await pool.end()
}

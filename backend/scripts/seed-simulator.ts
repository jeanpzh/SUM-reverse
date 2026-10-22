import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { chmod, lstat, mkdir, link, unlink, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { Pool } from 'pg'
import type { MatriculaRegularSubmission } from '../../shared/matricula-regular.mjs'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import type { ActorProfile, EnrollmentProfile, OfferedCourse } from '../src/matricula-regular/profile.types.js'
import { PostgresEnrollmentStore } from '../src/persistence/postgres-enrollment.store.js'
import { parseSubmissionRequest } from '../src/matricula-regular/dto/submission.dto.js'
import { assertSyntheticDatabase } from './synthetic-database.js'
import { capacityManifest, createSyntheticLoadProfile, parseActorCount, parseFisiConfig, resolveScenarioProfile } from './synthetic-load-profile.js'

const connectionString = process.env.DATABASE_URL
assertSyntheticDatabase(connectionString)
const artifactDirectory = process.env.SIMULATOR_ARTIFACTS_DIR
const manifestName = process.env.SIMULATOR_MANIFEST_NAME ?? `manifest-${randomUUID()}.json`
if (!artifactDirectory || !/^[a-zA-Z0-9._-]+\.json$/.test(manifestName)) {
  throw new Error('Set SIMULATOR_ARTIFACTS_DIR and an optional simple SIMULATOR_MANIFEST_NAME')
}
const manifestPath = resolve(artifactDirectory, manifestName)
const relativeManifest = relative(resolve(artifactDirectory), manifestPath)
if (!relativeManifest || relativeManifest === '..' || relativeManifest.startsWith(`..${sep}`)) {
  throw new Error('Manifest path must remain inside SIMULATOR_ARTIFACTS_DIR')
}
const actorCount = parseActorCount(process.env.SIMULATOR_ACTOR_COUNT)
const { scenarioProfile, contention } = resolveScenarioProfile(process.env.SIMULATOR_SCENARIO_PROFILE, process.env.SIMULATOR_CONTENTION)
const campaignId = process.env.SIMULATOR_CAMPAIGN_ID ?? randomUUID()
const runId = process.env.SIMULATOR_RUN_ID ?? randomUUID()
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
if (!uuidV4.test(campaignId) || !uuidV4.test(runId)) throw new Error('Campaign and run IDs must be UUIDv4 values')

const credentialHash = (value: string) => createHash('sha256').update(value).digest()
const fixture = createSyntheticFixture('SISTEMAS')
const now = Date.now()
const profiles: EnrollmentProfile[] = [structuredClone(fixture.profile)]
profiles[0]!.calendar.effectiveWindows = [{
  id: 'SYN-CAMPAIGN-WINDOW',
  startsAt: new Date(now - 60_000).toISOString(),
  endsAt: new Date(now + 4 * 60 * 60_000).toISOString(),
  minPp: 0,
  origin: 'synthetic',
  sourceIds: ['SYN-FIXTURE'],
}]
const fisiConfig = parseFisiConfig(process.env, scenarioProfile, actorCount)
const load = createSyntheticLoadProfile(actorCount, scenarioProfile, fixture.actors, fixture.offer, fisiConfig)
const actors: ActorProfile[] = load.actors
const offer: OfferedCourse[] = load.offer
const credentials = actors.map((actor) => ({
  actorId: actor.actorId,
  credential: randomBytes(32).toString('base64url'),
  ...(load.actorSelections.has(actor.actorId) ? { selection: load.actorSelections.get(actor.actorId)! } : {}),
  ...(load.fisi ? load.fisi.actorMeta.get(actor.actorId) : {}),
}))
const temporaryManifest = `${manifestPath}.${process.pid}.tmp`
let publishedManifest = false

function principalActorRequest(actorId: string, profileRevision: string, sessionId: string, selection: { courseId: string; sectionId: string }[], requestId: string, runId: string): MatriculaRegularSubmission {
  return parseSubmissionRequest({
    actorId,
    runId,
    sessionId,
    requestId,
    profileRevision,
    selection: [...selection].sort((a, b) => a.courseId.localeCompare(b.courseId) || a.sectionId.localeCompare(b.sectionId)),
  })
}

async function seedAuxiliaryEnrollments(pool: Pool) {
  if (scenarioProfile !== 'last-seat') return
  const store = new PostgresEnrollmentStore(pool)
  const selection = load.selection!
  for (const actor of load.auxiliaryActors) {
    const principal = { campaignId, runId, actorId: actor.actorId }
    const session = await store.createAcademicSession(principal) as { data: { sessionId: string } }
    const request = principalActorRequest(actor.actorId, profiles[0]!.profileRevision, session.data.sessionId, selection, randomUUID(), runId)
    const outcome = await store.submit(principal, request)
    if (outcome.data.state !== 'accepted') throw new Error('Last-seat auxiliary enrollment was not accepted')
  }
}

async function main() {
  const pool = new Pool({ connectionString, max: 1, application_name: 'sum-simulator-seed' })
  let createdCampaign = false
  try {
    await mkdir(dirname(manifestPath), { recursive: true, mode: 0o700 })
    try {
      await lstat(manifestPath)
      throw new Error('Manifest already exists; choose a new manifest name')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("INSERT INTO simulator_campaigns(campaign_id,run_id,status,config) VALUES($1,$2,'open',$3)", [campaignId, runId, JSON.stringify({ profiles, offer })])
      for (const profile of profiles) await client.query('INSERT INTO simulator_profiles(campaign_id,profile_revision,profile) VALUES($1,$2,$3)', [campaignId, profile.profileRevision, JSON.stringify(profile)])
      for (const actor of [...actors, ...load.auxiliaryActors]) {
        await client.query('INSERT INTO simulator_actors(campaign_id,actor_id,profile) VALUES($1,$2,$3)', [campaignId, actor.actorId, JSON.stringify(actor)])
        const credential = credentials.find((item) => item.actorId === actor.actorId)
        if (credential) await client.query('INSERT INTO simulator_credentials(campaign_id,actor_id,credential_hash) VALUES($1,$2,$3)', [campaignId, actor.actorId, credentialHash(credential.credential)])
      }
      for (const course of offer) for (const section of course.sections) {
        const { sections: _sections, ...courseData } = course
        await client.query('INSERT INTO simulator_sections(campaign_id,course_id,section_id,capacity,occupied,course,section) VALUES($1,$2,$3,$4,$5,$6,$7)', [campaignId, course.courseId, section.sectionId, section.capacity, section.occupied, JSON.stringify(courseData), JSON.stringify({ schedule: section.schedule, label: section.label, teacher: section.teacher, room: section.room })])
      }
      await client.query('COMMIT')
      createdCampaign = true
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }

    await seedAuxiliaryEnrollments(pool)
    const initialOccupied = new Map<string, number>()
    if (scenarioProfile === 'last-seat') {
      for (const choice of load.selection!) initialOccupied.set(`${choice.courseId}:${choice.sectionId}`, load.initialEnrollments)
    }
    const manifest = {
      campaignId,
      runId,
      contention,
      expectedAccepted: load.expectedAccepted,
      actors: credentials,
      ...(load.selection ? { selection: load.selection } : {}),
      actorCount: load.actorCount,
      scenarioProfile: load.scenarioProfile,
      initialEnrollments: load.initialEnrollments,
      initialRequests: load.initialRequests,
      expectedRejected: load.expectedRejected,
      capacityBySection: capacityManifest(offer, initialOccupied),
      ...(load.fisi ? {
        cohorts: load.fisi.cohorts,
        fisi: {
          mode: load.fisi.config.mode,
          ...(load.fisi.config.franja !== undefined ? { franja: load.fisi.config.franja } : {}),
          iaActors: load.fisi.config.iaActors,
          capacityMode: load.fisi.config.capacityMode,
          ...(load.fisi.config.scarceRatio !== undefined ? { scarceRatio: load.fisi.config.scarceRatio } : {}),
          sourceId: 'FISI-RANKING-2026-I',
        },
        hotCohortSize: load.fisi.hotCohortSize,
        ...(load.fisi.waves ? { waves: load.fisi.waves } : {}),
      } : {}),
    }
    await writeFile(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    await link(temporaryManifest, manifestPath)
    publishedManifest = true
    await unlink(temporaryManifest)
    await chmod(manifestPath, 0o600)
    process.stdout.write(`Seeded synthetic campaign ${campaignId} (${actors.length} actors, ${scenarioProfile})\n`)
  } catch (error) {
    // A failed prefill or artifact publication must not strand a partially seeded
    // campaign. Only remove the independently synthetic campaign created here.
    if (createdCampaign && !publishedManifest) await pool.query('DELETE FROM simulator_campaigns WHERE campaign_id=$1', [campaignId])
    throw error
  } finally {
    if (!publishedManifest) await unlink(temporaryManifest).catch(() => undefined)
    await pool.end()
  }
}

await main()

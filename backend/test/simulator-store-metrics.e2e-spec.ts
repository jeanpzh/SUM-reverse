import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'
import type { MatriculaRegularSubmission } from '../../shared/matricula-regular.mjs'
import { PostgresEnrollmentStore } from '../src/persistence/postgres-enrollment.store.js'
import { StoreMetrics } from '../src/persistence/store-metrics.js'

type Manifest = { campaignId: string }

const databaseUrl = process.env.SIMULATOR_TEST_DATABASE_URL
const campaignId = process.env.SIMULATOR_TEST_CAMPAIGN_ID
const manifestPath = process.env.SIMULATOR_TEST_MANIFEST
const enabled = Boolean(databaseUrl && campaignId && manifestPath)

describe.skipIf(!enabled)('store metrics against PostgreSQL', () => {
  it('records lock_timeout, 55P03 retries and phase histograms without changing the 503 or the later success', async () => {
    if (new URL(databaseUrl!).pathname !== '/sum_simulator_synthetic') throw new Error('Restricted to the named synthetic database')
    const manifest = JSON.parse(await readFile(manifestPath!, 'utf8')) as Manifest
    const pool = new Pool({ connectionString: databaseUrl, application_name: 'sum-simulator-e2e-metrics-admin' })
    const retryPool = new Pool({ connectionString: databaseUrl, max: 2, options: '-c lock_timeout=40ms -c statement_timeout=5000ms', application_name: 'sum-simulator-e2e-metrics' })
    const blocker = await pool.connect()
    const retryCampaignId = randomUUID()
    const retryRunId = randomUUID()
    const retryActorId = 'SYN-METRICS-0001'
    let blockerHasTransaction = false
    try {
      const sourceCampaign = await pool.query<{ config: { profiles: Record<string, unknown>[] } }>('SELECT config FROM simulator_campaigns WHERE campaign_id=$1', [manifest.campaignId])
      const sourceActor = await pool.query<{ profile: Record<string, unknown> }>('SELECT profile FROM simulator_actors WHERE campaign_id=$1 ORDER BY actor_id LIMIT 1', [manifest.campaignId])
      const sourceProfiles = await pool.query<{ profile: Record<string, unknown> }>('SELECT profile FROM simulator_profiles WHERE campaign_id=$1', [manifest.campaignId])
      const sourceSections = await pool.query<{ course: Record<string, unknown>; section_id: string; section: Record<string, unknown> }>('SELECT DISTINCT ON (course_id) course,section_id,section FROM simulator_sections WHERE campaign_id=$1 ORDER BY course_id,section_id', [manifest.campaignId])
      const actor = structuredClone(sourceActor.rows[0]!.profile) as Record<string, unknown>
      actor['actorId'] = retryActorId
      actor['name'] = 'Estudiante sintético de métricas'
      const offer = sourceSections.rows.map((row) => ({ ...row.course, sections: [{ sectionId: row.section_id, capacity: 1, occupied: 0, ...row.section }] }))
      await pool.query("INSERT INTO simulator_campaigns(campaign_id,run_id,status,config) VALUES($1,$2,'open',$3)", [retryCampaignId, retryRunId, JSON.stringify({ profiles: sourceCampaign.rows[0]!.config.profiles, offer })])
      for (const profile of sourceProfiles.rows) await pool.query('INSERT INTO simulator_profiles(campaign_id,profile_revision,profile) VALUES($1,$2,$3)', [retryCampaignId, String(profile.profile['profileRevision']), JSON.stringify(profile.profile)])
      await pool.query('INSERT INTO simulator_actors(campaign_id,actor_id,profile) VALUES($1,$2,$3)', [retryCampaignId, retryActorId, JSON.stringify(actor)])
      for (const course of offer) {
        const section = (course['sections'] as Array<Record<string, unknown>>)[0]!
        const { sections: _sections, ...courseData } = course
        const { sectionId, capacity, occupied, ...sectionData } = section
        await pool.query('INSERT INTO simulator_sections(campaign_id,course_id,section_id,capacity,occupied,course,section) VALUES($1,$2,$3,$4,$5,$6,$7)', [retryCampaignId, String(course['courseId']), sectionId, capacity, occupied, JSON.stringify(courseData), JSON.stringify(sectionData)])
      }
      const principal = { campaignId: retryCampaignId, runId: retryRunId, actorId: retryActorId }
      const metrics = new StoreMetrics()
      const store = new PostgresEnrollmentStore(retryPool, metrics)
      const academic = await store.createAcademicSession(principal) as { data: { sessionId: string } }
      const submission = { runId: retryRunId, actorId: retryActorId as `SYN-${string}`, requestId: randomUUID(), sessionId: academic.data.sessionId as `${string}-${string}-${string}-${string}-${string}`, profileRevision: String(actor['profileRevision']), selection: offer.map((course) => ({ courseId: String(course['courseId']), sectionId: String((course['sections'] as Array<Record<string, unknown>>)[0]!['sectionId']) })) } as MatriculaRegularSubmission
      const firstChoice = submission.selection[0]!
      await blocker.query('BEGIN')
      blockerHasTransaction = true
      await blocker.query('SELECT section_id FROM simulator_sections WHERE campaign_id=$1 AND course_id=$2 AND section_id=$3 FOR UPDATE', [retryCampaignId, firstChoice.courseId, firstChoice.sectionId])
      await expect(store.submit(principal, submission)).rejects.toMatchObject({ status: 503, code: 'STORAGE_UNAVAILABLE' })
      const failed = metrics.snapshot()
      expect(failed.storageErrorsTotal.lock_timeout).toBe(3)
      expect(failed.storageErrorsTotal.other).toBe(0)
      expect(failed.submitRetriesTotal['55P03']).toBe(2)
      expect(failed.submitPhaseMs.total.accepted.count).toBe(0)
      expect(failed.submitPhaseMs.section_lock_wait.failed.count).toBe(3)
      expect(failed.submitPhaseMs.total.failed.count).toBe(3)
      expect(failed.submitPhaseMs.section_lock_wait.failed.sum).toBeGreaterThanOrEqual(3 * 30)
      await blocker.query('ROLLBACK')
      blockerHasTransaction = false

      const recovered = await store.submit(principal, submission)
      expect(recovered.data.state).toBe('accepted')
      const replay = await store.submit(principal, submission)
      expect(replay.data.state).toBe('accepted')
      const ok = metrics.snapshot()
      for (const phase of ['pre_lock', 'section_lock_first', 'section_lock_wait', 'critical', 'commit', 'total'] as const) {
        expect(ok.submitPhaseMs[phase].accepted.count).toBe(1)
        expect(ok.submitPhaseMs[phase].replay.count).toBe(1)
        expect(ok.submitPhaseMs[phase].rejected.count).toBe(0)
      }
      expect(ok.submitStatements.accepted.sum).toBeGreaterThan(ok.submitStatements.replay.sum)
      expect(ok.poolAcquireMs.count).toBeGreaterThanOrEqual(5)
      expect(ok.storageErrorsTotal.lock_timeout).toBe(3)
      expect(JSON.stringify(ok)).not.toContain(retryActorId)
    } finally {
      if (blockerHasTransaction) await blocker.query('ROLLBACK').catch(() => undefined)
      blocker.release()
      await retryPool.end()
      await pool.query("UPDATE simulator_campaigns SET status='closed',closed_at=coalesce(closed_at,now()) WHERE campaign_id=$1", [retryCampaignId]).catch(() => undefined)
      await pool.query('DELETE FROM simulator_enrollment_items WHERE campaign_id=$1', [retryCampaignId]).catch(() => undefined)
      await pool.query('DELETE FROM simulator_campaigns WHERE campaign_id=$1', [retryCampaignId]).catch(() => undefined)
      await pool.end()
    }
  }, 30000)
})

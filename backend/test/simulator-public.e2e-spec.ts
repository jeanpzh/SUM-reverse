import { readFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import type { INestApplication } from '@nestjs/common'
import type { MatriculaRegularSubmission } from '../../shared/matricula-regular.mjs'
import { PostgresEnrollmentStore } from '../src/persistence/postgres-enrollment.store.js'

type Manifest = { campaignId: string; runId: string; contention: 'shared' | 'distributed'; expectedAccepted: number; actors: Array<{ actorId: string; credential: string; selection?: Array<{ courseId: string; sectionId: string }> }>; selection?: Array<{ courseId: string; sectionId: string }> }

const databaseUrl = process.env.SIMULATOR_TEST_DATABASE_URL
const campaignId = process.env.SIMULATOR_TEST_CAMPAIGN_ID
const manifestPath = process.env.SIMULATOR_TEST_MANIFEST
const enabled = Boolean(databaseUrl && campaignId && manifestPath)

describe.skipIf(!enabled)('public simulator PostgreSQL integration', () => {
  let appA: INestApplication
  let appB: INestApplication
  let manifest: Manifest
  let pool: Pool
  const origin = 'http://127.0.0.1:5189'
  const baseA = 'http://127.0.0.1:3300'
  const baseB = 'http://127.0.0.1:3301'

  async function call(base: string, path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    if (init.body) headers.set('content-type', 'application/json')
    return fetch(`${base}${path}`, { ...init, headers })
  }

  async function login(credential: string, base = baseA) {
    const response = await call(base, '/simulator/auth/v1/login', { method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ credential }) })
    const data = await response.json() as { data: { actorId: string; campaignId: string; runId: string; expiresAt: string } }
    const cookies = response.headers.getSetCookie()
    const cookie = cookies[0]?.split(';', 1)[0]
    if (response.status !== 200 || !cookie) throw new Error(`Synthetic login failed with ${response.status}`)
    return { cookie, data: data.data }
  }

  beforeAll(async () => {
    const parsed = new URL(databaseUrl!)
    if (parsed.pathname !== '/sum_simulator_synthetic') throw new Error('Public e2e tests are restricted to the named synthetic database')
    manifest = JSON.parse(await readFile(manifestPath!, 'utf8')) as Manifest
    if (manifest.campaignId !== campaignId || manifest.actors.length !== 100) throw new Error('Expected the matching 100-actor synthetic seed manifest')
    process.env.DATABASE_URL = databaseUrl
    process.env.SIMULATOR_DEPLOYMENT = 'public'
    process.env.SIMULATOR_STORAGE = 'postgres'
    process.env.SIMULATOR_CAMPAIGN_ID = campaignId
    process.env.SIMULATOR_PUBLIC_ORIGIN = origin
    process.env.SIMULATOR_INSECURE_COOKIE = '1'
    process.env.SIMULATOR_METRICS_TOKEN = 'synthetic-e2e-metrics-token'
    process.env.SIMULATOR_LOGIN_IP_LIMIT = '400'
    process.env.NODE_ENV = 'test'
    pool = new Pool({ connectionString: databaseUrl, application_name: 'sum-simulator-e2e-admin' })
    const { NestFactory } = await import('@nestjs/core')
    const { AppModule } = await import('../src/app.module.js')
    appA = await NestFactory.create(AppModule, { logger: false })
    appB = await NestFactory.create(AppModule, { logger: false })
    await Promise.all([appA.listen(3300, '127.0.0.1'), appB.listen(3301, '127.0.0.1')])
  }, 30000)

  afterAll(async () => {
    await Promise.allSettled([appA?.close(), appB?.close()])
    if (pool && campaignId) {
      await pool.query("UPDATE simulator_campaigns SET status='closed',closed_at=coalesce(closed_at,now()) WHERE campaign_id=$1", [campaignId])
      await pool.end()
    }
  }, 30000)

  it('maps exhausted PostgreSQL lock-timeout retries to 503 and accepts the same request after releasing the lock', async () => {
    const retryCampaignId = randomUUID()
    const retryRunId = randomUUID()
    const retryActorId = 'SYN-LOCK-0001'
    const retryPool = new Pool({ connectionString: databaseUrl, max: 2, options: '-c lock_timeout=40ms -c statement_timeout=5000ms', application_name: 'sum-simulator-e2e-retry' })
    const blocker = await pool.connect()
    let blockerHasTransaction = false
    try {
      const sourceCampaign = await pool.query<{ config: { profiles: Record<string, unknown>[] } }>('SELECT config FROM simulator_campaigns WHERE campaign_id=$1', [manifest.campaignId])
      const sourceActor = await pool.query<{ profile: Record<string, unknown> }>('SELECT profile FROM simulator_actors WHERE campaign_id=$1 ORDER BY actor_id LIMIT 1', [manifest.campaignId])
      const sourceProfiles = await pool.query<{ profile: Record<string, unknown> }>('SELECT profile FROM simulator_profiles WHERE campaign_id=$1', [manifest.campaignId])
      const sourceSections = await pool.query<{ course: Record<string, unknown>; section_id: string; section: Record<string, unknown> }>(`SELECT DISTINCT ON (course_id) course,section_id,section FROM simulator_sections WHERE campaign_id=$1 ORDER BY course_id,section_id`, [manifest.campaignId])
      const actor = structuredClone(sourceActor.rows[0]!.profile) as Record<string, unknown>
      actor['actorId'] = retryActorId
      actor['name'] = 'Estudiante sintético de reintento'
      const offer = sourceSections.rows.map((row) => ({ ...row.course, sections: [{ sectionId: row.section_id, capacity: 1, occupied: 0, ...row.section }] }))
      const config = { profiles: sourceCampaign.rows[0]!.config.profiles, offer }
      await pool.query("INSERT INTO simulator_campaigns(campaign_id,run_id,status,config) VALUES($1,$2,'open',$3)", [retryCampaignId, retryRunId, JSON.stringify(config)])
      for (const profile of sourceProfiles.rows) await pool.query('INSERT INTO simulator_profiles(campaign_id,profile_revision,profile) VALUES($1,$2,$3)', [retryCampaignId, String(profile.profile['profileRevision']), JSON.stringify(profile.profile)])
      await pool.query('INSERT INTO simulator_actors(campaign_id,actor_id,profile) VALUES($1,$2,$3)', [retryCampaignId, retryActorId, JSON.stringify(actor)])
      for (const course of offer) {
        const section = (course['sections'] as Array<Record<string, unknown>>)[0]!
        const { sections: _sections, ...courseData } = course
        const { sectionId, capacity, occupied, ...sectionData } = section
        await pool.query('INSERT INTO simulator_sections(campaign_id,course_id,section_id,capacity,occupied,course,section) VALUES($1,$2,$3,$4,$5,$6,$7)', [retryCampaignId, String(course['courseId']), sectionId, capacity, occupied, JSON.stringify(courseData), JSON.stringify(sectionData)])
      }
      const principal = { campaignId: retryCampaignId, runId: retryRunId, actorId: retryActorId }
      const store = new PostgresEnrollmentStore(retryPool)
      const academic = await store.createAcademicSession(principal) as { data: { sessionId: string } }
      const requestId = randomUUID()
      const submission = { runId: retryRunId, actorId: retryActorId as `SYN-${string}`, requestId, sessionId: academic.data.sessionId as `${string}-${string}-${string}-${string}-${string}`, profileRevision: String(actor['profileRevision']), selection: offer.map((course) => ({ courseId: String(course['courseId']), sectionId: String((course['sections'] as Array<Record<string, unknown>>)[0]!['sectionId']) })) } as MatriculaRegularSubmission
      const firstChoice = submission.selection[0]!
      await blocker.query('BEGIN')
      blockerHasTransaction = true
      await blocker.query('SELECT section_id FROM simulator_sections WHERE campaign_id=$1 AND course_id=$2 AND section_id=$3 FOR UPDATE', [retryCampaignId, firstChoice.courseId, firstChoice.sectionId])
      await expect(store.submit(principal, submission)).rejects.toMatchObject({ status: 503, code: 'STORAGE_UNAVAILABLE' })
      const afterTimeout = await pool.query<{ requests: string; enrollments: string; details: string; reports: string; occupied: string }>(`SELECT
        (SELECT count(*) FROM simulator_requests WHERE campaign_id=$1)::text requests,
        (SELECT count(*) FROM simulator_enrollments WHERE campaign_id=$1)::text enrollments,
        (SELECT count(*) FROM simulator_enrollment_items WHERE campaign_id=$1)::text details,
        (SELECT count(*) FROM simulator_reports WHERE campaign_id=$1)::text reports,
        (SELECT coalesce(sum(occupied),0) FROM simulator_sections WHERE campaign_id=$1)::text occupied`, [retryCampaignId])
      expect(Object.values(afterTimeout.rows[0]!).map(Number)).toEqual([0, 0, 0, 0, 0])
      await blocker.query('ROLLBACK')
      blockerHasTransaction = false
      const recovered = await store.submit(principal, submission)
      expect(recovered.data.state).toBe('accepted')
      const committed = await pool.query<{ requests: string; enrollments: string; details: string; reports: string; occupied: string }>(`SELECT
        (SELECT count(*) FROM simulator_requests WHERE campaign_id=$1)::text requests,
        (SELECT count(*) FROM simulator_enrollments WHERE campaign_id=$1)::text enrollments,
        (SELECT count(*) FROM simulator_enrollment_items WHERE campaign_id=$1)::text details,
        (SELECT count(*) FROM simulator_reports WHERE campaign_id=$1)::text reports,
        (SELECT coalesce(sum(occupied),0) FROM simulator_sections WHERE campaign_id=$1)::text occupied`, [retryCampaignId])
      expect(Object.values(committed.rows[0]!).map(Number)).toEqual([1, 1, 3, 1, 3])
    } finally {
      if (blockerHasTransaction) await blocker.query('ROLLBACK').catch(() => undefined)
      blocker.release()
      await retryPool.end()
      await pool.query("UPDATE simulator_campaigns SET status='closed',closed_at=coalesce(closed_at,now()) WHERE campaign_id=$1", [retryCampaignId]).catch(() => undefined)
      await pool.query('DELETE FROM simulator_enrollment_items WHERE campaign_id=$1', [retryCampaignId]).catch(() => undefined)
      await pool.query('DELETE FROM simulator_campaigns WHERE campaign_id=$1', [retryCampaignId]).catch(() => undefined)
    }
  }, 30000)

  it('rolls back the request, enrollment, details, report, and section counters after an injected SQL failure', async () => {
    const rollbackCampaignId = randomUUID()
    const rollbackRunId = randomUUID()
    const rollbackActorId = 'SYN-ROLLBACK-0001'
    const sourceActor = await pool.query<{ profile: Record<string, unknown> }>('SELECT profile FROM simulator_actors WHERE campaign_id=$1 ORDER BY actor_id LIMIT 1', [manifest.campaignId])
    const sourceProfiles = await pool.query<{ profile: Record<string, unknown> }>('SELECT profile FROM simulator_profiles WHERE campaign_id=$1', [manifest.campaignId])
    const sourceSections = await pool.query<{ course: Record<string, unknown>; section_id: string; section: Record<string, unknown> }>('SELECT course,section_id,section FROM simulator_sections WHERE campaign_id=$1 ORDER BY course_id,section_id', [manifest.campaignId])
    const actor = structuredClone(sourceActor.rows[0]!.profile) as Record<string, any>
    actor.actorId = rollbackActorId
    actor.name = 'Estudiante sintético de rollback'
    const courses = new Map<string, { data: Record<string, unknown>; sections: Array<{ sectionId: string; meta: Record<string, unknown> }> }>()
    for (const row of sourceSections.rows) {
      const courseId = String(row.course['courseId'])
      const item = courses.get(courseId) ?? { data: row.course, sections: [] }
      item.sections.push({ sectionId: row.section_id, meta: row.section })
      courses.set(courseId, item)
    }
    await pool.query("INSERT INTO simulator_campaigns(campaign_id,run_id,status,config) VALUES($1,$2,'open',$3)", [rollbackCampaignId, rollbackRunId, JSON.stringify({ profiles: sourceProfiles.rows.map((row) => row.profile), offer: [] })])
    for (const row of sourceProfiles.rows) await pool.query('INSERT INTO simulator_profiles(campaign_id,profile_revision,profile) VALUES($1,$2,$3)', [rollbackCampaignId, (row.profile as any).profileRevision, JSON.stringify(row.profile)])
    await pool.query('INSERT INTO simulator_actors(campaign_id,actor_id,profile) VALUES($1,$2,$3)', [rollbackCampaignId, rollbackActorId, JSON.stringify(actor)])
    for (const [courseId, item] of courses) for (const section of item.sections) await pool.query('INSERT INTO simulator_sections(campaign_id,course_id,section_id,capacity,occupied,course,section) VALUES($1,$2,$3,10,0,$4,$5)', [rollbackCampaignId, courseId, section.sectionId, JSON.stringify(item.data), JSON.stringify(section.meta)])
    const requestId = randomUUID()
    const store = appB.get(PostgresEnrollmentStore)
    const principal = { campaignId: rollbackCampaignId, runId: rollbackRunId, actorId: rollbackActorId }
    const session = await store.createAcademicSession(principal) as { data: { sessionId: string } }
    const submission = { runId: rollbackRunId, actorId: rollbackActorId as `SYN-${string}`, requestId, sessionId: session.data.sessionId as `${string}-${string}-${string}-${string}-${string}`, profileRevision: String(actor.profileRevision), selection: [...courses.keys()].map((courseId) => ({ courseId, sectionId: courses.get(courseId)!.sections[0]!.sectionId })) } as MatriculaRegularSubmission
    const trigger = `simulator_e2e_failure_${rollbackCampaignId.replaceAll('-', '')}`
    const fn = `simulator_e2e_raise_${rollbackCampaignId.replaceAll('-', '')}`
    try {
      await pool.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.campaign_id = '${rollbackCampaignId}'::uuid THEN RAISE EXCEPTION 'synthetic transaction fault' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$`)
      await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON simulator_enrollment_items FOR EACH ROW EXECUTE FUNCTION ${fn}()`)
      await expect(store.submit(principal, submission)).rejects.toMatchObject({ status: 503 })
      const rolledBack = await pool.query<{ requests: string; enrollments: string; details: string; reports: string; occupied: string }>(`SELECT
        (SELECT count(*) FROM simulator_requests WHERE campaign_id=$1)::text requests,
        (SELECT count(*) FROM simulator_enrollments WHERE campaign_id=$1)::text enrollments,
        (SELECT count(*) FROM simulator_enrollment_items WHERE campaign_id=$1)::text details,
        (SELECT count(*) FROM simulator_reports WHERE campaign_id=$1)::text reports,
        (SELECT coalesce(sum(occupied),0) FROM simulator_sections WHERE campaign_id=$1)::text occupied`, [rollbackCampaignId])
      expect(Object.values(rolledBack.rows[0]!).map(Number)).toEqual([0, 0, 0, 0, 0])
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON simulator_enrollment_items`)
      await pool.query(`DROP FUNCTION IF EXISTS ${fn}()`)
    }
    const committed = await store.submit(principal, submission)
    expect(committed.data.state).toBe('accepted')
    await store.closeCampaign(rollbackCampaignId)
    await pool.query('DELETE FROM simulator_enrollment_items WHERE campaign_id=$1', [rollbackCampaignId])
    await pool.query('DELETE FROM simulator_campaigns WHERE campaign_id=$1', [rollbackCampaignId])
  }, 30000)

  it('admits exactly ten of one hundred competitors across two instances and preserves replay, identity, and reports', async () => {
    const badOrigin = await call(baseA, '/simulator/auth/v1/login', { method: 'POST', headers: { Origin: 'http://evil.invalid' }, body: JSON.stringify({ credential: manifest.actors[0]!.credential }) })
    expect(badOrigin.status).toBe(403)
    const invalidLogin = await call(baseA, '/simulator/auth/v1/login', { method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ credential: manifest.actors[0]!.credential, unexpected: true }) })
    expect(invalidLogin.status).toBe(400)
    const unauthenticated = await call(baseA, '/simulator/auth/v1/session')
    expect(unauthenticated.status).toBe(401)
    const health = await call(baseA, '/simulator/health')
    expect(health.status).toBe(200)
    expect(await health.json()).toEqual({ status: 'ok', dataSource: 'independently-synthetic', storage: 'postgres' })
    const unauthorizedMetrics = await call(baseA, '/simulator/metrics')
    expect(unauthorizedMetrics.status).toBe(403)
    const metrics = await call(baseA, '/simulator/metrics', { headers: { Authorization: 'Bearer synthetic-e2e-metrics-token' } })
    expect(metrics.status, await metrics.clone().text()).toBe(200)
    expect((await metrics.json() as { data: { pool: { total: number }; process: { rssBytes: number } } }).data.pool.total).toBeGreaterThan(0)

    const authenticated = await Promise.all(manifest.actors.map((actor, index) => login(actor.credential, index % 2 ? baseB : baseA)))
    const mismatchedSessions = authenticated.filter((session) => session.data.campaignId !== manifest.campaignId || session.data.runId !== manifest.runId).map(({ data }) => ({ campaignId: data.campaignId, runId: data.runId }))
    expect(mismatchedSessions).toEqual([])
    const sameSession = await call(baseA, '/simulator/auth/v1/session', { headers: { Cookie: authenticated[0]!.cookie } })
    const sameSessionBody = await sameSession.json() as { data: { expiresAt: string } }
    expect(sameSessionBody.data.expiresAt).toBe(authenticated[0]!.data.expiresAt)

    const created = await Promise.all(authenticated.map(async (identity, index) => {
      const base = index % 2 ? baseB : baseA
      const response = await call(base, '/local/matricula-regular/v1/sesiones', { method: 'POST', headers: { Origin: origin, Cookie: identity.cookie }, body: JSON.stringify({ runId: manifest.runId, actorId: manifest.actors[index]!.actorId }) })
      if (response.status !== 200) throw new Error(`Synthetic academic session failed with ${response.status}`)
      return (await response.json() as { data: { sessionId: string } }).data.sessionId
    }))
    const renewed = await call(baseA, `/local/matricula-regular/v1/sesiones/${created[0]}/renovar`, { method: 'POST', headers: { Origin: origin, Cookie: authenticated[0]!.cookie }, body: JSON.stringify({ runId: manifest.runId, actorId: manifest.actors[0]!.actorId }) })
    expect(renewed.status).toBe(200)
    expect((await renewed.json() as { data: { sessionId: string } }).data.sessionId).toBe(created[0])
    const contexts = await Promise.all(authenticated.map(async (identity, index) => {
      const response = await call(index % 2 ? baseB : baseA, `/local/matricula-regular/v1/contextos/${manifest.actors[index]!.actorId}`, { headers: { Cookie: identity.cookie } })
      if (response.status !== 200) throw new Error(`Synthetic context failed with ${response.status}`)
      return await response.json() as { data: { profileRevision: string } }
    }))
    const submissions: MatriculaRegularSubmission[] = manifest.actors.map((actor, index) => ({
      runId: manifest.runId,
      actorId: actor.actorId as `SYN-${string}`,
      requestId: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
      sessionId: created[index] as `${string}-${string}-${string}-${string}-${string}`,
      profileRevision: contexts[index]!.data.profileRevision,
      selection: manifest.actors[index]!.selection ?? manifest.selection!,
    }))
    const outcomes = await Promise.all(submissions.map(async (submission, index) => {
      const response = await call(index % 2 ? baseB : baseA, '/local/matricula-regular/v1/solicitudes', { method: 'POST', headers: { Origin: origin, Cookie: authenticated[index]!.cookie }, body: JSON.stringify(submission) })
      if (response.status !== 200) throw new Error(`Synthetic submission failed with ${response.status}`)
      return (await response.json() as { data: { state: string; causes: Array<{ code: string }>; enrollmentId: string | null } }).data
    }))
    const accepted = outcomes.filter((item) => item.state === 'accepted')
    const full = outcomes.filter((item) => item.causes.some((cause) => cause.code === 'SECTION_FULL'))
    expect(accepted).toHaveLength(manifest.expectedAccepted)
    expect(full).toHaveLength(100 - manifest.expectedAccepted)

    const firstAcceptedIndex = outcomes.findIndex((item) => item.state === 'accepted')
    const replay = await call(baseB, '/local/matricula-regular/v1/solicitudes', { method: 'POST', headers: { Origin: origin, Cookie: authenticated[firstAcceptedIndex]!.cookie }, body: JSON.stringify(submissions[firstAcceptedIndex]) })
    expect(replay.status).toBe(200)
    expect((await replay.json() as { data: unknown }).data).toEqual(outcomes[firstAcceptedIndex])
    const changed = { ...submissions[firstAcceptedIndex]!, selection: submissions[firstAcceptedIndex]!.selection.slice(0, 2) }
    const conflict = await call(baseB, '/local/matricula-regular/v1/solicitudes', { method: 'POST', headers: { Origin: origin, Cookie: authenticated[firstAcceptedIndex]!.cookie }, body: JSON.stringify(changed) })
    expect(conflict.status).toBe(409)

    const acceptedEnrollmentIds = accepted.map((item) => item.enrollmentId!)
    const foreignReport = await call(baseB, `/local/matricula-regular/v1/reportes/${acceptedEnrollmentIds[0]}?runId=${manifest.runId}&actorId=${manifest.actors[(firstAcceptedIndex + 1) % 100]!.actorId}`, { headers: { Cookie: authenticated[(firstAcceptedIndex + 1) % 100]!.cookie } })
    expect([403, 404]).toContain(foreignReport.status)

    const read = await call(baseB, `/local/perfiles/v1/consultas/perfil?runId=${manifest.runId}&actorId=${manifest.actors[firstAcceptedIndex]!.actorId}&sessionId=${created[firstAcceptedIndex]}`, { headers: { Cookie: authenticated[firstAcceptedIndex]!.cookie } })
    expect(read.status).toBe(200)
    expect((await read.json() as { data: { actorId: string } }).data.actorId).toBe(manifest.actors[firstAcceptedIndex]!.actorId)
    for (const key of ['perfil', 'formulario', 'historial', 'fichaSocioeconomica', 'matriculaInfo', 'programacion', 'prematricula', 'matricula', 'horarios', 'evaluaciones', 'deudas', 'asistencias', 'tutoria', 'plan']) {
      const dashboard = await call(baseB, `/local/perfiles/v1/consultas/${key}?runId=${manifest.runId}&actorId=${manifest.actors[firstAcceptedIndex]!.actorId}&sessionId=${created[firstAcceptedIndex]}`, { headers: { Cookie: authenticated[firstAcceptedIndex]!.cookie } })
      expect(dashboard.status, `dashboard key ${key}`).toBe(200)
    }
    const catalog = await call(baseB, '/local/perfiles/v1/perfiles')
    expect(catalog.status).toBe(404)

    const secondRequest = { ...submissions[firstAcceptedIndex]!, requestId: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}` }
    const duplicateEnrollment = await call(baseB, '/local/matricula-regular/v1/solicitudes', { method: 'POST', headers: { Origin: origin, Cookie: authenticated[firstAcceptedIndex]!.cookie }, body: JSON.stringify(secondRequest) })
    expect((await duplicateEnrollment.json() as { data: { causes: Array<{ code: string }> } }).data.causes.map((item) => item.code)).toContain('ALREADY_ENROLLED')

    const oldToken = decodeURIComponent(authenticated[firstAcceptedIndex]!.cookie.split('=', 2)[1]!)
    await pool.query('UPDATE simulator_sessions SET expires_at=now()-interval \'1 second\' WHERE session_hash=$1', [createHash('sha256').update(oldToken).digest()])
    const expired = await call(baseB, '/simulator/auth/v1/session', { headers: { Cookie: authenticated[firstAcceptedIndex]!.cookie } })
    expect(expired.status).toBe(401)

    const totals = await pool.query<{ accepted: string; occupied: string; details: string; reports: string }>(`SELECT
      (SELECT count(*) FROM simulator_enrollments WHERE campaign_id=$1)::text accepted,
      (SELECT sum(occupied) FROM simulator_sections WHERE campaign_id=$1)::text occupied,
      (SELECT count(*) FROM simulator_enrollment_items WHERE campaign_id=$1)::text details,
      (SELECT count(*) FROM simulator_reports WHERE campaign_id=$1)::text reports`, [manifest.campaignId])
    expect(Object.values(totals.rows[0]!).map(Number)).toEqual([manifest.expectedAccepted, manifest.expectedAccepted * 3, manifest.expectedAccepted * 3, manifest.expectedAccepted])

    await appA.close()
    const recoveredLogin = await login(manifest.actors[firstAcceptedIndex]!.credential, baseB)
    const recover = await call(baseB, `/local/matricula-regular/v1/solicitudes/${submissions[firstAcceptedIndex]!.requestId}?runId=${manifest.runId}&actorId=${manifest.actors[firstAcceptedIndex]!.actorId}`, { headers: { Cookie: recoveredLogin.cookie } })
    expect(recover.status).toBe(200)
    await pool.query("UPDATE simulator_campaigns SET status='closed',closed_at=now() WHERE campaign_id=$1", [manifest.campaignId])
    const relogin = await login(manifest.actors[firstAcceptedIndex]!.credential, baseB)
    expect(relogin.data.actorId).toBe(manifest.actors[firstAcceptedIndex]!.actorId)
    const closedReplay = await call(baseB, '/local/matricula-regular/v1/solicitudes', { method: 'POST', headers: { Origin: origin, Cookie: relogin.cookie }, body: JSON.stringify(submissions[firstAcceptedIndex]) })
    expect(closedReplay.status).toBe(200)
    const newClosedSession = await call(baseB, '/local/matricula-regular/v1/sesiones', { method: 'POST', headers: { Origin: origin, Cookie: relogin.cookie }, body: JSON.stringify({ runId: manifest.runId, actorId: manifest.actors[firstAcceptedIndex]!.actorId }) })
    expect(newClosedSession.status).toBe(409)
  }, 90000)
})

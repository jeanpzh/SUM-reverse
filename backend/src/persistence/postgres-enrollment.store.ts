import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { randomUUID, createHash } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { MatriculaRegularEnvelope, MatriculaRegularOutcome, MatriculaRegularSubmission, MatriculaRegularId } from '../../../shared/matricula-regular.mjs'
import { evaluateAndCommitSubmission } from '../matricula-regular/matricula-regular.service.js'
import { MatriculaRegularError } from '../matricula-regular/matricula-regular-error.filter.js'
import type { ActorProfile, EnrollmentProfile, OfferedCourse } from '../matricula-regular/profile.types.js'
import type { RunState } from '../matricula-regular/store.types.js'
import type { RunSnapshot } from '../matricula-regular/store.types.js'
import type { EnrollmentReadSnapshot, EnrollmentStore, PublicPrincipal } from './enrollment-store.js'
import { SIMULATOR_POOL } from './postgres.js'
import { DEMO_SESSION_DURATION_MS } from '../matricula-regular/clock.js'

type CampaignRow = { run_id: string; status: 'open' | 'closed'; config: { profiles: EnrollmentProfile[] } }
const hash = (value: string) => createHash('sha256').update(value).digest()

@Injectable()
export class PostgresEnrollmentStore implements EnrollmentStore, OnModuleInit {
  constructor(@Inject(SIMULATOR_POOL) private readonly pool: Pool) {}

  async onModuleInit() {
    const campaignId = process.env.SIMULATOR_CAMPAIGN_ID
    if (!campaignId) throw new Error('SIMULATOR_CAMPAIGN_ID is required')
    const result = await this.pool.query<{ run_id: string }>('SELECT run_id FROM simulator_campaigns WHERE campaign_id=$1', [campaignId])
    if (!result.rows[0]) throw new Error('Configured simulator campaign does not exist in PostgreSQL')
    process.env.SIMULATOR_RUN_ID = result.rows[0].run_id
    await this.pool.query('SELECT 1')
  }

  async readSnapshot(principal: PublicPrincipal): Promise<EnrollmentReadSnapshot> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      const snapshot = await this.loadSnapshot(client, principal)
      await client.query('COMMIT')
      return snapshot
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      if (error instanceof MatriculaRegularError) throw error
      throw new MatriculaRegularError(503, principal.runId, 'STORAGE_UNAVAILABLE')
    } finally { client.release() }
  }

  async readDashboardSnapshot(principal: PublicPrincipal, academicSessionId: string): Promise<RunSnapshot> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      const session = await client.query('SELECT 1 FROM simulator_academic_sessions WHERE campaign_id=$1 AND actor_id=$2 AND session_id=$3 AND expires_at>now()', [principal.campaignId, principal.actorId, academicSessionId])
      if (!session.rowCount) throw new MatriculaRegularError(403, principal.runId, 'SESSION_CONTEXT_MISMATCH')
      const campaign = await client.query<CampaignRow>('SELECT run_id,status,config FROM simulator_campaigns WHERE campaign_id=$1', [principal.campaignId])
      if (!campaign.rows[0] || campaign.rows[0].run_id !== principal.runId) throw new MatriculaRegularError(409, principal.runId, 'RUN_CHANGED')
      const state = await this.loadRunState(client, principal, campaign.rows[0])
      await client.query('COMMIT')
      return { ...state, requests: [...state.requests.entries()], enrollments: [...state.enrollments.entries()], reports: [...state.reports.entries()] }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      if (error instanceof MatriculaRegularError) throw error
      throw new MatriculaRegularError(503, principal.runId, 'STORAGE_UNAVAILABLE')
    } finally { client.release() }
  }

  async createAcademicSession(principal: PublicPrincipal) {
    try {
      const campaign = await this.pool.query("SELECT 1 FROM simulator_campaigns WHERE campaign_id=$1 AND run_id=$2 AND status='open'", [principal.campaignId, principal.runId])
      if (!campaign.rowCount) throw new MatriculaRegularError(409, principal.runId, 'RUN_CHANGED')
      const now = new Date()
      const session = { runId: principal.runId, actorId: principal.actorId, sessionId: randomUUID(), startedAt: now.toISOString(), expiresAt: new Date(now.getTime() + DEMO_SESSION_DURATION_MS).toISOString() }
      await this.pool.query('INSERT INTO simulator_academic_sessions(session_id,campaign_id,actor_id,started_at,expires_at) VALUES($1,$2,$3,$4,$5)', [session.sessionId, principal.campaignId, principal.actorId, session.startedAt, session.expiresAt])
      return { runId: principal.runId, data: session }
    } catch (error) {
      if (error instanceof MatriculaRegularError) throw error
      throw new MatriculaRegularError(503, principal.runId, 'STORAGE_UNAVAILABLE')
    }
  }

  async renewAcademicSession(principal: PublicPrincipal, sessionId: string) {
    try {
      const campaign = await this.pool.query("SELECT 1 FROM simulator_campaigns WHERE campaign_id=$1 AND run_id=$2 AND status='open'", [principal.campaignId, principal.runId])
      if (!campaign.rowCount) throw new MatriculaRegularError(409, principal.runId, 'RUN_CHANGED')
      const result = await this.pool.query<{ started_at: Date; expires_at: Date }>(`UPDATE simulator_academic_sessions
        SET expires_at=now()+($4::text || ' milliseconds')::interval
        WHERE campaign_id=$1 AND actor_id=$2 AND session_id=$3 AND expires_at>now()
        RETURNING started_at,expires_at`, [principal.campaignId, principal.actorId, sessionId, DEMO_SESSION_DURATION_MS])
      if (!result.rows[0]) {
        const exists = await this.pool.query('SELECT expires_at>now() active FROM simulator_academic_sessions WHERE campaign_id=$1 AND actor_id=$2 AND session_id=$3', [principal.campaignId, principal.actorId, sessionId])
        if (!exists.rowCount) throw new MatriculaRegularError(404, principal.runId, 'SESSION_NOT_FOUND')
        throw new MatriculaRegularError(409, principal.runId, 'SESSION_EXPIRED')
      }
      return { runId: principal.runId, data: { runId: principal.runId, actorId: principal.actorId, sessionId, startedAt: result.rows[0].started_at.toISOString(), expiresAt: result.rows[0].expires_at.toISOString() } }
    } catch (error) {
      if (error instanceof MatriculaRegularError) throw error
      throw new MatriculaRegularError(503, principal.runId, 'STORAGE_UNAVAILABLE')
    }
  }

  async submit(principal: PublicPrincipal, request: MatriculaRegularSubmission): Promise<MatriculaRegularEnvelope<MatriculaRegularOutcome>> {
    for (let attempt = 0; ; attempt += 1) {
      try { return await this.submitTransaction(principal, request) } catch (error) {
        const code = (error as { code?: string }).code
        if (!['40P01', '40001', '55P03', '57014'].includes(code ?? '')) throw error
        if (attempt >= 2) throw new MatriculaRegularError(503, principal.runId, 'STORAGE_UNAVAILABLE')
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1) + Math.floor(Math.random() * 35)))
      }
    }
  }

  private async submitTransaction(principal: PublicPrincipal, request: MatriculaRegularSubmission): Promise<MatriculaRegularEnvelope<MatriculaRegularOutcome>> {
    if (request.actorId !== principal.actorId || request.runId !== principal.runId) throw new MatriculaRegularError(403, principal.runId, 'SESSION_CONTEXT_MISMATCH')
    let client: PoolClient | undefined
    try {
      client = await this.pool.connect()
      await client.query('BEGIN')
      const campaign = await client.query<CampaignRow>('SELECT run_id,status,config FROM simulator_campaigns WHERE campaign_id=$1 FOR SHARE', [principal.campaignId])
      const campaignRow = campaign.rows[0]
      if (!campaignRow || campaignRow.run_id !== principal.runId) throw new MatriculaRegularError(409, principal.runId, 'RUN_CHANGED')
      await client.query('SELECT actor_id FROM simulator_actors WHERE campaign_id=$1 AND actor_id=$2 FOR UPDATE', [principal.campaignId, principal.actorId])
      const keys = [...request.selection].sort((a, b) => a.courseId.localeCompare(b.courseId) || a.sectionId.localeCompare(b.sectionId))
      for (const choice of keys) await client.query('SELECT section_id FROM simulator_sections WHERE campaign_id=$1 AND course_id=$2 AND section_id=$3 FOR UPDATE', [principal.campaignId, choice.courseId, choice.sectionId])
      const state = await this.loadRunState(client, principal, campaignRow)
      if (state.requests.has(`${request.actorId}:${request.requestId}`)) {
        const result = evaluateAndCommitSubmission(state, request, new Date())
        await client.query('COMMIT')
        return result
      }
      if (campaignRow.status !== 'open') throw new MatriculaRegularError(409, principal.runId, 'RUN_CHANGED')
      const alreadyEnrolled = state.enrollments.has(principal.actorId)
      const before = new Map(state.offer.flatMap((course) => course.sections.map((section) => [`${course.courseId}:${section.sectionId}`, section.occupied] as const)))
      const result = evaluateAndCommitSubmission(state, request, new Date())
      const stored = state.requests.get(`${request.actorId}:${request.requestId}`)!
      await client.query('INSERT INTO simulator_requests(campaign_id,actor_id,request_id,payload,outcome) VALUES($1,$2,$3,$4,$5)', [principal.campaignId, principal.actorId, request.requestId, JSON.stringify(stored.payload), JSON.stringify(stored.outcome)])
      const enrollment = state.enrollments.get(principal.actorId)
      if (result.data.state === 'accepted' && enrollment && !alreadyEnrolled) {
        await client.query('INSERT INTO simulator_enrollments(campaign_id,enrollment_id,actor_id,request_id,profile_revision,accepted_at) VALUES($1,$2,$3,$4,$5,$6)', [principal.campaignId, enrollment.enrollmentId, principal.actorId, enrollment.requestId, enrollment.profileRevision, enrollment.acceptedAt])
        for (const choice of enrollment.selection) {
          await client.query('INSERT INTO simulator_enrollment_items(campaign_id,enrollment_id,course_id,section_id) VALUES($1,$2,$3,$4)', [principal.campaignId, enrollment.enrollmentId, choice.courseId, choice.sectionId])
          const counter = await client.query('UPDATE simulator_sections SET occupied=occupied+1 WHERE campaign_id=$1 AND course_id=$2 AND section_id=$3 AND occupied < capacity', [principal.campaignId, choice.courseId, choice.sectionId])
          if (!counter.rowCount) throw new Error('Section capacity exhausted after admission evaluation')
        }
        await client.query('INSERT INTO simulator_reports(campaign_id,enrollment_id,report) VALUES($1,$2,$3)', [principal.campaignId, enrollment.enrollmentId, JSON.stringify(state.reports.get(enrollment.enrollmentId))])
      }
      for (const course of state.offer) for (const section of course.sections) {
        const key = `${course.courseId}:${section.sectionId}`
        if (section.occupied !== before.get(key as `${string}:${string}`)) {
          const changed = await client.query('SELECT occupied FROM simulator_sections WHERE campaign_id=$1 AND course_id=$2 AND section_id=$3', [principal.campaignId, course.courseId, section.sectionId])
          if (!changed.rows.length || Number(changed.rows[0].occupied) !== section.occupied) throw new Error('Section counter diverged during transaction')
        }
      }
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => undefined)
      if (error instanceof MatriculaRegularError) throw error
      if (['40P01', '40001', '55P03', '57014'].includes((error as { code?: string }).code ?? '')) throw error
      throw new MatriculaRegularError(503, principal.runId, 'STORAGE_UNAVAILABLE')
    } finally { client?.release() }
  }

  async lookup(principal: PublicPrincipal, requestId: string) {
    try {
      const result = await this.pool.query<{ outcome: unknown }>('SELECT outcome FROM simulator_requests WHERE campaign_id=$1 AND actor_id=$2 AND request_id=$3', [principal.campaignId, principal.actorId, requestId])
      return { runId: principal.runId, data: result.rows[0] ? { state: 'known', outcome: result.rows[0].outcome } : { state: 'unknown', outcome: null } }
    } catch { throw new MatriculaRegularError(503, principal.runId, 'STORAGE_UNAVAILABLE') }
  }

  async report(principal: PublicPrincipal, enrollmentId: string) {
    try {
      const result = await this.pool.query<{ report: unknown }>('SELECT report FROM simulator_reports WHERE campaign_id=$1 AND enrollment_id=$2', [principal.campaignId, enrollmentId])
      if (!result.rows[0]) throw new MatriculaRegularError(404, principal.runId, 'REPORT_NOT_FOUND')
      const owner = await this.pool.query('SELECT 1 FROM simulator_enrollments WHERE campaign_id=$1 AND enrollment_id=$2 AND actor_id=$3', [principal.campaignId, enrollmentId, principal.actorId])
      if (!owner.rowCount) throw new MatriculaRegularError(404, principal.runId, 'REPORT_NOT_FOUND')
      return { runId: principal.runId, data: result.rows[0].report }
    } catch (error) {
      if (error instanceof MatriculaRegularError) throw error
      throw new MatriculaRegularError(503, principal.runId, 'STORAGE_UNAVAILABLE')
    }
  }

  async closeCampaign(campaignId: string): Promise<void> {
    await this.pool.query("UPDATE simulator_campaigns SET status='closed',closed_at=now() WHERE campaign_id=$1 AND status='open'", [campaignId])
  }

  async authenticateCredential(credential: string): Promise<{ campaignId: string; runId: string; actorId: string } | null> {
    const result = await this.pool.query<{ campaign_id: string; run_id: string; actor_id: string }>('SELECT cr.campaign_id,c.run_id,cr.actor_id FROM simulator_credentials cr JOIN simulator_campaigns c USING(campaign_id) WHERE cr.credential_hash=$1 AND c.campaign_id=$2', [hash(credential), process.env.SIMULATOR_CAMPAIGN_ID])
    const row = result.rows[0]
    return row ? { campaignId: row.campaign_id, runId: row.run_id, actorId: row.actor_id } : null
  }

  async createAccessSession(principal: PublicPrincipal, token: string, ttlMs: number) {
    const result = await this.pool.query<{ expires_at: Date }>('INSERT INTO simulator_sessions(session_hash,campaign_id,actor_id,expires_at) VALUES($1,$2,$3,now()+($4::text || \' milliseconds\')::interval) RETURNING expires_at', [hash(token), principal.campaignId, principal.actorId, ttlMs])
    return result.rows[0]!.expires_at.toISOString()
  }

  async authenticateSession(token: string): Promise<PublicPrincipal | null> {
    const result = await this.pool.query<{ campaign_id: string; run_id: string; actor_id: string }>('SELECT s.campaign_id,c.run_id,s.actor_id FROM simulator_sessions s JOIN simulator_campaigns c USING(campaign_id) WHERE s.session_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()', [hash(token)])
    const row = result.rows[0]
    return row ? { campaignId: row.campaign_id, runId: row.run_id, actorId: row.actor_id } : null
  }

  async sessionExpiry(token: string): Promise<string> {
    const result = await this.pool.query<{ expires_at: Date }>('SELECT expires_at FROM simulator_sessions WHERE session_hash=$1 AND revoked_at IS NULL AND expires_at>now()', [hash(token)])
    if (!result.rows[0]) throw new Error('UNAUTHENTICATED')
    return result.rows[0].expires_at.toISOString()
  }

  async revokeAccessSession(token: string) { await this.pool.query('UPDATE simulator_sessions SET revoked_at=now() WHERE session_hash=$1 AND revoked_at IS NULL', [hash(token)]) }

  private async loadSnapshot(client: PoolClient, principal: PublicPrincipal): Promise<EnrollmentReadSnapshot> {
    const campaign = await client.query<CampaignRow>('SELECT run_id,status,config FROM simulator_campaigns WHERE campaign_id=$1', [principal.campaignId])
    const row = campaign.rows[0]
    if (!row || row.run_id !== principal.runId) throw new MatriculaRegularError(409, principal.runId, 'RUN_CHANGED')
    const state = await this.loadRunState(client, principal, row)
    return { runId: state.runId, profiles: state.profiles, actors: state.actors, offer: state.offer }
  }

  private async loadRunState(client: PoolClient, principal: PublicPrincipal, campaign: CampaignRow): Promise<RunState> {
    const actors = await client.query<{ profile: ActorProfile }>('SELECT profile FROM simulator_actors WHERE campaign_id=$1 AND actor_id=$2', [principal.campaignId, principal.actorId])
    const profiles = await client.query<{ profile: EnrollmentProfile }>('SELECT profile FROM simulator_profiles WHERE campaign_id=$1', [principal.campaignId])
    const sections = await client.query<{ course: Omit<OfferedCourse, 'sections'>; section_id: string; capacity: number; occupied: number; section: Record<string, unknown> }>('SELECT course,section_id,capacity,occupied,section FROM simulator_sections WHERE campaign_id=$1 ORDER BY course_id,section_id', [principal.campaignId])
    const sessions = await client.query<{ session_id: string; started_at: Date; expires_at: Date }>('SELECT session_id,started_at,expires_at FROM simulator_academic_sessions WHERE campaign_id=$1 AND actor_id=$2', [principal.campaignId, principal.actorId])
    const requests = await client.query<{ request_id: string; payload: any; outcome: any }>('SELECT request_id,payload,outcome FROM simulator_requests WHERE campaign_id=$1 AND actor_id=$2', [principal.campaignId, principal.actorId])
    const enrollments = await client.query<{ enrollment_id: string; request_id: string; profile_revision: string; accepted_at: Date; selection: any }>("SELECT e.enrollment_id,e.request_id,e.profile_revision,e.accepted_at,coalesce(jsonb_agg(jsonb_build_object('courseId',i.course_id,'sectionId',i.section_id) ORDER BY i.course_id) FILTER (WHERE i.course_id IS NOT NULL),'[]') selection FROM simulator_enrollments e LEFT JOIN simulator_enrollment_items i USING(campaign_id,enrollment_id) WHERE e.campaign_id=$1 AND e.actor_id=$2 GROUP BY e.campaign_id,e.enrollment_id,e.actor_id,e.request_id,e.profile_revision,e.accepted_at", [principal.campaignId, principal.actorId])
    const reports = await client.query<{ enrollment_id: string; report: any }>('SELECT r.enrollment_id,r.report FROM simulator_reports r JOIN simulator_enrollments e USING(campaign_id,enrollment_id) WHERE r.campaign_id=$1 AND e.actor_id=$2', [principal.campaignId, principal.actorId])
    const courseMap = new Map<string, OfferedCourse>()
    for (const item of sections.rows) {
      const base = item.course as unknown as OfferedCourse
      const course = courseMap.get(base.courseId) ?? { ...base, sections: [] }
      const meta = item.section ?? {}
      course.sections.push({ sectionId: item.section_id, capacity: Number(item.capacity), occupied: Number(item.occupied), schedule: (meta['schedule'] as OfferedCourse['sections'][number]['schedule']) ?? null, ...(typeof meta['label'] === 'string' ? { label: meta['label'] } : {}), ...(meta['teacher'] === undefined ? {} : { teacher: meta['teacher'] as string | null }), ...(meta['room'] === undefined ? {} : { room: meta['room'] as string | null }) })
      courseMap.set(base.courseId, course)
    }
    return {
      runId: campaign.run_id,
      profiles: profiles.rows.map((item) => item.profile),
      actors: actors.rows.map((item) => item.profile),
      offer: [...courseMap.values()],
      sessions: sessions.rows.map((item) => ({ runId: campaign.run_id as `${string}-${string}-${string}-${string}-${string}`, actorId: principal.actorId as MatriculaRegularId, sessionId: item.session_id as `${string}-${string}-${string}-${string}-${string}`, startedAt: item.started_at.toISOString(), expiresAt: item.expires_at.toISOString() })),
      requests: new Map(requests.rows.map((item) => [`${principal.actorId}:${item.request_id}`, { payload: item.payload, outcome: item.outcome }])),
      enrollments: new Map(enrollments.rows.map((item) => [principal.actorId, { enrollmentId: item.enrollment_id, requestId: item.request_id, actorId: principal.actorId, profileRevision: item.profile_revision, selection: item.selection, acceptedAt: item.accepted_at.toISOString() }])),
      reports: new Map(reports.rows.map((item) => [item.enrollment_id, item.report])),
    }
  }
}

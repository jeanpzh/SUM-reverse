import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseFilters, HttpException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { Request } from 'express'
import { validateEnrollmentId, validateRequestId, validateSessionId } from '../../../shared/matricula-regular.mjs'
import type { MatriculaRegularId } from '../../../shared/matricula-regular.mjs'
import { parseRenewalRequest, parseSessionRequest } from '../matricula-regular/dto/session.dto.js'
import { parseSubmissionRequest } from '../matricula-regular/dto/submission.dto.js'
import { projectContext } from '../matricula-regular/context.service.js'
import { MatriculaRegularError, MatriculaRegularErrorFilter } from '../matricula-regular/matricula-regular-error.filter.js'
import { SimulatorAuthService } from './simulator-auth.service.js'
import { PostgresEnrollmentStore } from '../persistence/postgres-enrollment.store.js'
import { SIMULATOR_POOL } from '../persistence/postgres.js'
import { SimulatorMetricsInterceptor } from './simulator-metrics.interceptor.js'
import { StoreMetrics } from '../persistence/store-metrics.js'
import { activeCampaignId, PgWaitEventSampler, readDatabaseStats, readLocksWaiting, readWalStats } from './simulator-pg-stats.js'

function token(request: Request) {
  const name = process.env.SIMULATOR_INSECURE_COOKIE === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(request.hostname) ? 'simulator-session' : '__Host-simulator-session'
  const part = request.headers.cookie?.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`))
  return part ? decodeURIComponent(part.slice(name.length + 1)) : undefined
}

function requireOrigin(request: Request) {
  const expected = process.env.SIMULATOR_PUBLIC_ORIGIN
  if (!expected || request.get('origin') !== expected) throw new MatriculaRegularError(403, process.env.SIMULATOR_RUN_ID ?? '00000000-0000-4000-8000-000000000000', 'SESSION_CONTEXT_MISMATCH')
}

function rejectBody(request: Request, runId: string) {
  if (Number(request.headers['content-length'] ?? 0) > 0 || request.headers['transfer-encoding'] !== undefined) throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', ['body'])
}

function rejectQuery(request: Request, runId: string) {
  if (new URL(request.originalUrl, 'http://localhost').search) throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', ['query'])
}

function exactIdentityQuery(request: Request, principal: { runId: string; actorId: string }) {
  const params = new URL(request.originalUrl, 'http://localhost').searchParams
  if (params.size !== 2 || params.getAll('runId').length !== 1 || params.getAll('actorId').length !== 1 || [...params.keys()].some((key) => !['runId', 'actorId'].includes(key))) throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['query'])
  if (params.get('runId') !== principal.runId || params.get('actorId') !== principal.actorId) throw new MatriculaRegularError(403, principal.runId, 'SESSION_CONTEXT_MISMATCH')
}

@Controller('local/matricula-regular/v1')
@UseFilters(MatriculaRegularErrorFilter)
export class SimulatorPublicApiController {
  constructor(private readonly auth: SimulatorAuthService, private readonly store: PostgresEnrollmentStore) {}

  @Get('contextos/:actorId')
  async context(@Param('actorId') actorId: string, @Req() request: Request) {
    const principal = await this.principal(request)
    rejectQuery(request, principal.runId)
    rejectBody(request, principal.runId)
    if (principal.actorId !== actorId) throw new MatriculaRegularError(403, principal.runId, 'SESSION_CONTEXT_MISMATCH')
    const snapshot = await this.store.readSnapshot(principal)
    return projectContext({ ...snapshot, sessions: [], requests: [], enrollments: [], reports: [] }, actorId as MatriculaRegularId, new Date())
  }

  @Post('sesiones')
  @HttpCode(200)
  async createSession(@Body() body: unknown, @Req() request: Request) {
    requireOrigin(request)
    const principal = await this.principal(request)
    rejectQuery(request, principal.runId)
    let parsed
    try { parsed = parseSessionRequest(body) } catch { throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['body']) }
    if (parsed.actorId !== principal.actorId || parsed.runId !== principal.runId) throw new MatriculaRegularError(403, principal.runId, 'SESSION_CONTEXT_MISMATCH')
    return this.store.createAcademicSession(principal)
  }

  @Post('sesiones/:sessionId/renovar')
  @HttpCode(200)
  async renewSession(@Param('sessionId') sessionId: string, @Body() body: unknown, @Req() request: Request) {
    requireOrigin(request)
    const principal = await this.principal(request)
    rejectQuery(request, principal.runId)
    try { validateSessionId(sessionId) } catch { throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['sessionId']) }
    try {
      const parsed = parseRenewalRequest(sessionId, body)
      if (parsed.actorId !== principal.actorId || parsed.runId !== principal.runId) throw new MatriculaRegularError(403, principal.runId, 'SESSION_CONTEXT_MISMATCH')
    } catch (error) {
      if (error instanceof MatriculaRegularError) throw error
      throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['body'])
    }
    return this.store.renewAcademicSession(principal, sessionId)
  }

  @Post('solicitudes')
  @HttpCode(200)
  async submit(@Body() body: unknown, @Req() request: Request) {
    requireOrigin(request)
    const principal = await this.principal(request)
    rejectQuery(request, principal.runId)
    let parsed
    try { parsed = parseSubmissionRequest(body) } catch { throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['body']) }
    return this.store.submit(principal, parsed)
  }

  @Get('solicitudes/:requestId')
  async result(@Param('requestId') requestId: string, @Req() request: Request) {
    const principal = await this.principal(request)
    try { validateRequestId(requestId) } catch { throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['requestId']) }
    exactIdentityQuery(request, principal)
    rejectBody(request, principal.runId)
    return this.store.lookup(principal, requestId)
  }

  @Get('reportes/:enrollmentId')
  async report(@Param('enrollmentId') enrollmentId: string, @Req() request: Request) {
    const principal = await this.principal(request)
    try { validateEnrollmentId(enrollmentId) } catch { throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['enrollmentId']) }
    exactIdentityQuery(request, principal)
    rejectBody(request, principal.runId)
    return this.store.report(principal, enrollmentId)
  }

  private async principal(request: Request) {
    try { return await this.auth.require(token(request)) } catch (error) {
      if (error instanceof Error && error.message === 'STORAGE_UNAVAILABLE') throw new MatriculaRegularError(503, process.env.SIMULATOR_RUN_ID ?? '00000000-0000-4000-8000-000000000000', 'STORAGE_UNAVAILABLE')
      throw new MatriculaRegularError(401, process.env.SIMULATOR_RUN_ID ?? '00000000-0000-4000-8000-000000000000', 'UNAUTHENTICATED')
    }
  }
}

@Controller('simulator')
export class SimulatorOperationsController implements OnModuleInit, OnModuleDestroy {
  private readonly waitSampler = new PgWaitEventSampler()

  constructor(@Inject(SIMULATOR_POOL) private readonly pool: import('pg').Pool, private readonly metricsSnapshot: SimulatorMetricsInterceptor, @Inject(StoreMetrics) private readonly storeMetrics: StoreMetrics) {}

  onModuleInit() { this.waitSampler.start() }

  async onModuleDestroy() { await this.waitSampler.stop() }

  @Get('health')
  async health() {
    try {
      await this.pool.query('SELECT 1')
      return { status: 'ok', dataSource: 'independently-synthetic', storage: 'postgres' }
    } catch {
      throw new HttpException({ status: 'unavailable' }, 503)
    }
  }

  @Get('metrics')
  async metrics(@Req() request: Request) {
    const secret = process.env.SIMULATOR_METRICS_TOKEN
    const authorized = secret !== undefined && request.get('authorization') === `Bearer ${secret}`
    if (!authorized) throw new HttpException({ error: { code: 'FORBIDDEN', fields: [] } }, 403)
    const totals = await this.pool.query<{ requests: string; enrollments: string; active_sessions: string }>(`SELECT
      (SELECT count(*) FROM simulator_requests WHERE campaign_id=$1)::text requests,
      (SELECT count(*) FROM simulator_enrollments WHERE campaign_id=$1)::text enrollments,
      (SELECT count(*) FROM simulator_sessions WHERE campaign_id=$1 AND revoked_at IS NULL AND expires_at>now())::text active_sessions`, [activeCampaignId()])
    const routes = await this.pool.query('SELECT method,route,status,sum(count)::bigint count,round((sum(duration_total_ms)/greatest(sum(count),1))::numeric,2) avg_ms,round(max(duration_max_ms)::numeric,2) max_ms FROM simulator_http_metrics WHERE bucket_start>now()-interval \'15 minutes\' GROUP BY method,route,status ORDER BY method,route,status')
    const waits = await this.pool.query("SELECT coalesce(wait_event_type,'active') wait_event_type,count(*)::int count FROM pg_stat_activity WHERE application_name='sum-simulator' GROUP BY wait_event_type ORDER BY wait_event_type")
    const row = totals.rows[0]!
    const database = {
      waitEventsMax: this.waitSampler.readAndReset(),
      locksWaiting: await readLocksWaiting(this.pool),
      stats: await readDatabaseStats(this.pool),
      wal: await readWalStats(this.pool),
    }
    return { data: { requests: Number(row.requests), enrollments: Number(row.enrollments), activeSessions: Number(row.active_sessions), pool: { waiting: this.pool.waitingCount, total: this.pool.totalCount, idle: this.pool.idleCount }, routes: routes.rows, databaseWaitEvents: waits.rows, process: this.metricsSnapshot.snapshot(), store: this.storeMetrics.snapshot(), database } }
  }
}

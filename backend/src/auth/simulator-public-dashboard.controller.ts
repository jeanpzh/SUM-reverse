import { Controller, Get, Param, Req, UseFilters } from '@nestjs/common'
import type { Request } from 'express'
import { dashboardKeys, validateDashboardKey, validateDashboardReadResponse } from '../../../shared/local-profile-dashboard.mjs'
import type { ActorId, DashboardKey } from '../../../shared/local-profile-dashboard.mjs'
import { validateActorId, validateContextResponse, validateSessionId } from '../../../shared/matricula-regular.mjs'
import { validateMiInformacionWire } from '../../../shared/mi-informacion-wire.mjs'
import { validatePlanEstudiosWire } from '../../../shared/plan-estudios-wire.mjs'
import { validateMatriculaWire } from '../../../shared/matricula-wire.mjs'
import { projectAcademicRead, projectCommittedReport } from '../local-profile-dashboard/academic-projection.js'
import { projectProfileRead } from '../local-profile-dashboard/profile-projection.js'
import { MatriculaRegularError, MatriculaRegularErrorFilter } from '../matricula-regular/matricula-regular-error.filter.js'
import { SimulatorAuthService } from './simulator-auth.service.js'
import { PostgresEnrollmentStore } from '../persistence/postgres-enrollment.store.js'
import type { ActorProfile } from '../matricula-regular/profile.types.js'
import type { RunSnapshot } from '../matricula-regular/store.types.js'

function sessionCookie(request: Request) {
  const insecure = process.env.SIMULATOR_INSECURE_COOKIE === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(request.hostname)
  const name = insecure ? 'simulator-session' : '__Host-simulator-session'
  const part = request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))
  return part ? decodeURIComponent(part.slice(name.length + 1)) : undefined
}

@Controller('local/perfiles/v1')
@UseFilters(MatriculaRegularErrorFilter)
export class SimulatorPublicDashboardController {
  constructor(private readonly auth: SimulatorAuthService, private readonly store: PostgresEnrollmentStore) {}

  @Get('consultas/:key')
  async read(@Param('key') rawKey: string, @Req() request: Request) {
    const principal = await this.principal(request)
    const url = new URL(request.originalUrl, 'http://localhost')
    const allowed = new Set(['runId', 'actorId', 'sessionId'])
    if (url.searchParams.size !== 3 || [...url.searchParams.keys()].some((key) => !allowed.has(key)) || ['runId', 'actorId', 'sessionId'].some((key) => url.searchParams.getAll(key).length !== 1)) {
      throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['query'])
    }
    if (url.searchParams.get('runId') !== principal.runId || url.searchParams.get('actorId') !== principal.actorId) throw new MatriculaRegularError(403, principal.runId, 'SESSION_CONTEXT_MISMATCH')
    try { validateActorId(url.searchParams.get('actorId')); validateSessionId(url.searchParams.get('sessionId')) } catch { throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['query']) }
    try { validateDashboardKey(rawKey) } catch { throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['key']) }
    if (!dashboardKeys.includes(rawKey)) throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['key'])
    if (request.headers['content-length'] && Number(request.headers['content-length']) > 0) throw new MatriculaRegularError(400, principal.runId, 'INVALID_REQUEST', ['body'])

    const key = rawKey as DashboardKey
    const actorId = principal.actorId as ActorId
    const sessionId = url.searchParams.get('sessionId')!
    const snapshot = await this.store.readDashboardSnapshot(principal, sessionId)
    const actor = snapshot.actors.find((item) => item.actorId === actorId)
    if (!actor) throw new MatriculaRegularError(404, principal.runId, 'ACTOR_NOT_FOUND')
    const now = new Date()
    const payload = this.project(key, snapshot, actor, actorId, now)
    const response = { runId: principal.runId, data: { actorId, sessionId, key, serverNow: now.toISOString(), payload } }
    validateDashboardReadResponse(response, { runId: principal.runId, actorId, sessionId, key }, (value: unknown): asserts value is unknown => {
      if (key === 'perfil') {
        if (value !== null) validateMiInformacionWire('perfil', value, 'local-v1')
      } else if ((key === 'matricula' || key === 'horarios') && value === null) {
        return
      } else if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError('Dashboard payload must be an object')
      } else if (key === 'formulario') validateMiInformacionWire('formularioDatos', value, 'local-v1')
      else if (key === 'historial') validateMiInformacionWire('historial', value, 'local-v1')
      else if (key === 'fichaSocioeconomica') validateMiInformacionWire('fichaSocioeconomica', value, 'local-v1')
      else if (key === 'plan' && 'data' in value) validatePlanEstudiosWire(value)
      else if (key === 'programacion' && 'data' in value) validateMatriculaWire('programacion', value)
      else if (['matriculaInfo', 'prematricula', 'programacion', 'plan'].includes(key)) validateContextResponse({ runId: principal.runId, data: value }, principal.runId, principal.actorId as `SYN-${string}`)
    })
    return response
  }

  private project(key: DashboardKey, snapshot: RunSnapshot, actor: ActorProfile, actorId: ActorId, now: Date): unknown {
    const projectors: Record<DashboardKey, () => unknown> = {
      perfil: () => projectProfileRead('perfil', actor),
      formulario: () => ({ message: null, codError: null, data: projectProfileRead('formulario', actor) }),
      historial: () => ({ message: null, codError: null, data: projectProfileRead('historial', actor) }),
      fichaSocioeconomica: () => ({ message: null, codError: null, data: projectProfileRead('fichaSocioeconomica', actor) }),
      matriculaInfo: () => projectAcademicRead('matriculaInfo', snapshot, actorId, now),
      programacion: () => projectAcademicRead('programacion', snapshot, actorId, now),
      prematricula: () => projectAcademicRead('prematricula', snapshot, actorId, now),
      matricula: () => projectCommittedReport(snapshot, actorId),
      horarios: () => projectCommittedReport(snapshot, actorId),
      evaluaciones: () => projectProfileRead('evaluaciones', actor),
      deudas: () => projectProfileRead('deudas', actor),
      asistencias: () => projectProfileRead('asistencias', actor),
      tutoria: () => projectProfileRead('tutoria', actor),
      plan: () => projectAcademicRead('plan', snapshot, actorId, now),
    }
    return projectors[key]()
  }

  private async principal(request: Request) {
    const token = sessionCookie(request)
    try { return await this.auth.require(token) } catch (error) {
      if (error instanceof Error && error.message === 'STORAGE_UNAVAILABLE') throw new MatriculaRegularError(503, process.env.SIMULATOR_RUN_ID ?? '00000000-0000-4000-8000-000000000000', 'STORAGE_UNAVAILABLE')
      throw new MatriculaRegularError(401, process.env.SIMULATOR_RUN_ID ?? '00000000-0000-4000-8000-000000000000', 'UNAUTHENTICATED')
    }
  }
}

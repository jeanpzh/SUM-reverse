import { Injectable } from '@nestjs/common'
import {
  validateContextResponse,
  validateEnrollmentReport,
} from '../../../shared/matricula-regular.mjs'
import {
  validateDashboardReadResponse,
} from '../../../shared/local-profile-dashboard.mjs'
import { validateMiInformacionWire } from '../../../shared/mi-informacion-wire.mjs'
import type {
  ActorId,
  AcademicKey,
  DashboardKey,
  DashboardRead,
  Identity,
} from '../../../shared/local-profile-dashboard.mjs'
import type {
  MatriculaRegularContext,
  MatriculaRegularEnrollmentReport,
  MatriculaRegularEnvelope,
} from '../../../shared/matricula-regular.mjs'
import { ContextService } from '../matricula-regular/context.service.js'
import { MatriculaRegularError } from '../matricula-regular/matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from '../matricula-regular/matricula-regular.repository.js'
import { LocalProfileSessionService } from './local-profile-session.service.js'
import { projectAcademicRead, projectCommittedReport } from './academic-projection.js'
import { projectProfileRead } from './profile-projection.js'
import type { CompatiblePayloadMap } from './profile-projection.types.js'
import type { ApiEnvelope } from '../reportes/reportes.types.js'

type MiKey = 'formulario' | 'historial' | 'fichaSocioeconomica'

export type LocalDashboardPayloadMap = Omit<CompatiblePayloadMap, MiKey> &
  { [Key in MiKey]: ApiEnvelope<CompatiblePayloadMap[Key]> } &
  Record<AcademicKey, MatriculaRegularContext> &
  Record<'matricula' | 'horarios', MatriculaRegularEnrollmentReport | null>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertEmptyEnvelope(payload: unknown): void {
  if (!isRecord(payload)) {
    throw new TypeError('Respuesta local vacía inválida')
  }
  if (!Object.hasOwn(payload, 'message') || !Object.hasOwn(payload, 'codError')
    || !Object.hasOwn(payload, 'data') || Object.keys(payload).length !== 3
    || payload.message !== null || payload.codError !== null
    || !Array.isArray(payload.data) || payload.data.length !== 0) {
    throw new TypeError('Respuesta local vacía inválida')
  }
}

@Injectable()
export class LocalProfileDashboardService {
  constructor(
    private readonly repository: MatriculaRegularRepository,
    private readonly sessions: LocalProfileSessionService,
    private readonly context: ContextService,
  ) {}

  catalog() {
    return this.sessions.catalog()
  }

  read<K extends DashboardKey>(
    key: K,
    identity: Identity,
  ): MatriculaRegularEnvelope<DashboardRead<K, LocalDashboardPayloadMap[K]>> {
    const snapshot = this.repository.readSnapshot()
    const now = this.context.now()
    this.sessions.requireActive(snapshot, identity, now)
    const actorId: ActorId = identity.actorId
    try {
      const actor = snapshot.actors.find((candidate) => candidate.actorId === actorId)
      if (actor === undefined) throw new MatriculaRegularError(500, snapshot.runId, 'LOCAL_FAILURE')
      const projectors: { [Key in DashboardKey]: () => LocalDashboardPayloadMap[Key] } = {
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
      const payload = projectors[key]()
      const response = {
        runId: snapshot.runId,
        data: {
          actorId,
          sessionId: identity.sessionId,
          key,
          serverNow: now.toISOString(),
          payload,
        },
      }
      validateDashboardReadResponse(response, { ...identity, key }, (value: unknown): asserts value is LocalDashboardPayloadMap[K] => {
        if (key === 'perfil') {
          if (value !== null) throw new TypeError('Perfil sintético no disponible')
        } else if (key === 'formulario') {
          validateMiInformacionWire('formularioDatos', value, 'local-v1')
        } else if (key === 'historial') {
          validateMiInformacionWire('historial', value, 'local-v1')
        } else if (key === 'fichaSocioeconomica') {
          validateMiInformacionWire('fichaSocioeconomica', value, 'local-v1')
        } else if (key === 'matriculaInfo' || key === 'programacion' || key === 'prematricula' || key === 'plan') {
          validateContextResponse({ runId: snapshot.runId, data: value }, snapshot.runId, actorId)
        } else if (key === 'matricula' || key === 'horarios') {
          if (value !== null) validateEnrollmentReport(value)
        } else {
          assertEmptyEnvelope(value)
        }
      })
      return response
    } catch (error) {
      if (error instanceof MatriculaRegularError) throw error
      throw new MatriculaRegularError(500, snapshot.runId, 'LOCAL_FAILURE')
    }
  }
}

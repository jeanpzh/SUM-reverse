import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { validateSession, validateSessionResponse } from '../../../shared/matricula-regular.mjs'
import type {
  MatriculaRegularEnvelope,
  MatriculaRegularSession,
  MatriculaRegularSessionRequest,
} from '../../../shared/matricula-regular.mjs'
import { DEMO_SESSION_DURATION_MS, type ServerClock } from './clock.js'
import { MATRICULA_REGULAR_CLOCK } from './context.service.js'
import { MatriculaRegularError } from './matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from './matricula-regular.repository.js'

@Injectable()
export class SessionService {
  constructor(
    private readonly repository: MatriculaRegularRepository,
    @Inject(MATRICULA_REGULAR_CLOCK) private readonly clock: ServerClock,
  ) {}

  create(request: MatriculaRegularSessionRequest): Promise<MatriculaRegularEnvelope<MatriculaRegularSession>> {
    return this.repository.enqueue((state) => {
      if (request.runId !== state.runId) {
        throw new MatriculaRegularError(409, state.runId, 'RUN_CHANGED')
      }

      if (!state.actors.some((actor) => actor.actorId === request.actorId)) {
        throw new MatriculaRegularError(404, state.runId, 'ACTOR_NOT_FOUND')
      }

      const now = this.clock.now()
      const session: MatriculaRegularSession = {
        runId: state.runId,
        actorId: request.actorId,
        sessionId: randomUUID(),
        startedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + DEMO_SESSION_DURATION_MS).toISOString(),
      }
      validateSession(session)
      state.sessions.push(session)

      const response = { runId: state.runId, data: structuredClone(session) }
      validateSessionResponse(response, {
        runId: state.runId,
        actorId: request.actorId,
        sessionId: session.sessionId,
      })
      return response
    })
  }

  renew(
    sessionId: string,
    request: MatriculaRegularSessionRequest,
  ): Promise<MatriculaRegularEnvelope<MatriculaRegularSession>> {
    return this.repository.enqueue((state) => {
      if (request.runId !== state.runId) {
        throw new MatriculaRegularError(409, state.runId, 'RUN_CHANGED')
      }

      const session = state.sessions.find((candidate) => candidate.sessionId === sessionId)
      if (session === undefined) {
        throw new MatriculaRegularError(404, state.runId, 'SESSION_NOT_FOUND')
      }

      if (session.actorId !== request.actorId || session.runId !== request.runId) {
        throw new MatriculaRegularError(409, state.runId, 'SESSION_CONTEXT_MISMATCH')
      }

      const now = this.clock.now()
      if (now.getTime() >= Date.parse(session.expiresAt)) {
        throw new MatriculaRegularError(409, state.runId, 'SESSION_EXPIRED')
      }

      const renewed: MatriculaRegularSession = {
        ...session,
        expiresAt: new Date(now.getTime() + DEMO_SESSION_DURATION_MS).toISOString(),
      }
      validateSession(renewed)
      state.sessions = state.sessions.map((candidate) =>
        candidate.sessionId === sessionId ? renewed : candidate,
      )

      const response = { runId: state.runId, data: structuredClone(renewed) }
      validateSessionResponse(response, {
        runId: state.runId,
        actorId: request.actorId,
        sessionId,
      })
      return response
    })
  }
}

import { Injectable } from '@nestjs/common'
import { validateProfileCatalogResponse } from '../../../shared/local-profile-dashboard.mjs'
import { validateScope } from '../../../shared/matricula-regular.mjs'
import type {
  ActorId,
  Identity,
  ProfileCatalog,
  ProfileChoice,
} from '../../../shared/local-profile-dashboard.mjs'
import type {
  MatriculaRegularEnvelope,
  MatriculaRegularSession,
} from '../../../shared/matricula-regular.mjs'
import { ContextService } from '../matricula-regular/context.service.js'
import { MatriculaRegularError } from '../matricula-regular/matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from '../matricula-regular/matricula-regular.repository.js'
import type { RunSnapshot } from '../matricula-regular/store.types.js'

const actorOrder: ActorId[] = ['SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B']

@Injectable()
export class LocalProfileSessionService {
  constructor(
    private readonly repository: MatriculaRegularRepository,
    private readonly contextService: ContextService,
  ) {}

  catalog(): MatriculaRegularEnvelope<ProfileCatalog> {
    const snapshot = this.repository.readSnapshot()
    const profiles = actorOrder.map((actorId): ProfileChoice => {
      const actor = snapshot.actors.find((candidate) => candidate.actorId === actorId)
      if (actor === undefined) {
        throw new MatriculaRegularError(500, snapshot.runId, 'LOCAL_FAILURE')
      }
      validateScope(actor.scope)
      return {
        actorId,
        name: actor.name,
        scope: structuredClone(actor.scope),
      }
    })
    const response = {
      runId: snapshot.runId,
      data: { serverNow: this.contextService.now().toISOString(), profiles },
    }
    validateProfileCatalogResponse(response)
    return response
  }

  requireActive(
    snapshot: RunSnapshot,
    identity: Identity,
    now: Date,
  ): MatriculaRegularSession {
    if (snapshot.runId !== identity.runId) {
      throw new MatriculaRegularError(409, snapshot.runId, 'RUN_CHANGED')
    }

    if (!snapshot.actors.some((actor) => actor.actorId === identity.actorId)) {
      throw new MatriculaRegularError(404, snapshot.runId, 'ACTOR_NOT_FOUND')
    }

    const session = snapshot.sessions.find((candidate) => candidate.sessionId === identity.sessionId)
    if (session === undefined) {
      throw new MatriculaRegularError(404, snapshot.runId, 'SESSION_NOT_FOUND')
    }

    if (session.actorId !== identity.actorId || session.runId !== identity.runId) {
      throw new MatriculaRegularError(409, snapshot.runId, 'SESSION_CONTEXT_MISMATCH')
    }

    if (now.getTime() >= Date.parse(session.expiresAt)) {
      throw new MatriculaRegularError(409, snapshot.runId, 'SESSION_EXPIRED')
    }

    return structuredClone(session)
  }
}

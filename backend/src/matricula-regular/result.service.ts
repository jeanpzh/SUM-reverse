import { Injectable } from '@nestjs/common'
import { validateLookupResponse } from '../../../shared/matricula-regular.mjs'
import type {
  MatriculaRegularEnvelope,
  MatriculaRegularId,
  MatriculaRegularLookup,
  MatriculaRegularUuid,
} from '../../../shared/matricula-regular.mjs'
import { MatriculaRegularError } from './matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from './matricula-regular.repository.js'

@Injectable()
export class ResultService {
  constructor(private readonly repository: MatriculaRegularRepository) {}

  lookup(
    requestId: MatriculaRegularUuid,
    runId: MatriculaRegularUuid,
    actorId: MatriculaRegularId,
  ): MatriculaRegularEnvelope<MatriculaRegularLookup> {
    const snapshot = this.repository.readSnapshot()
    if (runId !== snapshot.runId) throw new MatriculaRegularError(409, snapshot.runId, 'RUN_CHANGED')
    if (!snapshot.actors.some((actor) => actor.actorId === actorId)) {
      throw new MatriculaRegularError(404, snapshot.runId, 'ACTOR_NOT_FOUND')
    }

    const stored = snapshot.requests.find(([key]) => key === `${actorId}:${requestId}`)?.[1]
    const data: MatriculaRegularLookup = stored === undefined
      ? { state: 'unknown', outcome: null }
      : { state: 'known', outcome: structuredClone(stored.outcome) }
    const response = { runId: snapshot.runId, data }
    validateLookupResponse(response, { runId: snapshot.runId, actorId, requestId })
    return response
  }
}

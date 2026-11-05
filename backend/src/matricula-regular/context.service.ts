import { Inject, Injectable } from '@nestjs/common'
import { validateActorId } from '../../../shared/matricula-regular.mjs'
import type { MatriculaRegularContext, MatriculaRegularEnvelope } from '../../../shared/matricula-regular.mjs'
import { MatriculaRegularError } from './matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from './matricula-regular.repository.js'
import { projectContext } from './context-projection.js'
import type { ServerClock } from './clock.js'

export { projectContext } from './context-projection.js'
export const MATRICULA_REGULAR_CLOCK = Symbol('MATRICULA_REGULAR_CLOCK')

@Injectable()
export class ContextService {
  constructor(
    private readonly repository: MatriculaRegularRepository,
    @Inject(MATRICULA_REGULAR_CLOCK) private readonly clock: ServerClock,
  ) {}

  now(runId?: string): Date {
    return this.repository.clockFor(runId, this.clock).now()
  }

  read(actorId: string, runId?: string): MatriculaRegularEnvelope<MatriculaRegularContext> {
    const snapshot = this.repository.readSnapshot(runId)
    if (!snapshot.actors.some((candidate) => candidate.actorId === actorId)) {
      throw new MatriculaRegularError(404, snapshot.runId, 'ACTOR_NOT_FOUND')
    }
    validateActorId(actorId)
    const now = this.now(snapshot.runId)
    return projectContext(snapshot, actorId, now)
  }
}

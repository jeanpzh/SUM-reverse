import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { createSyntheticFixture } from './fixtures.js'
import type { RunSnapshot, RunState } from './store.types.js'
import { createProfileCatalog } from './profiles.js'
import type { School, SyntheticFixture } from './profile.types.js'

const clone = <T>(value: T): T => structuredClone(value)

function fixtureFor(school: School): SyntheticFixture {
  return createSyntheticFixture(school)
}

function createRun(fixtures: SyntheticFixture[] = [fixtureFor('SISTEMAS'), fixtureFor('SOFTWARE')]): RunState {
  const selected = clone(fixtures)

  return {
    runId: randomUUID(),
    profiles: createProfileCatalog(),
    actors: selected.flatMap((fixture) => fixture.actors),
    offer: selected.flatMap((fixture) => fixture.offer),
    sessions: [],
    requests: new Map(),
    enrollments: new Map(),
    reports: new Map(),
  }
}

@Injectable()
export class MatriculaRegularRepository {
  private state = createRun()
  private queue: Promise<void> = Promise.resolve()

  get runId(): string {
    return this.state.runId
  }

  readSnapshot(): RunSnapshot {
    return clone({
      ...this.state,
      requests: [...this.state.requests.entries()],
      enrollments: [...this.state.enrollments.entries()],
      reports: [...this.state.reports.entries()],
    })
  }

  publishCandidate(candidate: RunState): void {
    this.state = candidate
  }

  enqueue<T>(synchronousOperation: (state: RunState) => T): Promise<T> {
    const result = this.queue.then(() => synchronousOperation(this.state))
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }

  resetForTests(fixtures?: SyntheticFixture[]): string {
    this.state = createRun(fixtures)
    return this.state.runId
  }
}

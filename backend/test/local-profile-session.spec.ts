import { Test } from '@nestjs/testing'
import type { TestingModule } from '@nestjs/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { validateProfileCatalogResponse } from '../../shared/local-profile-dashboard.mjs'
import type { Identity } from '../../shared/local-profile-dashboard.mjs'
import { createAdvancingSyntheticClock } from '../src/matricula-regular/clock.js'
import { MatriculaRegularModule, MATRICULA_REGULAR_CLOCK } from '../src/matricula-regular/matricula-regular.module.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'
import { SessionService } from '../src/matricula-regular/session.service.js'
import { LocalProfileSessionService } from '../src/local-profile-dashboard/local-profile-session.service.js'

const BASE = '2026-08-11T14:00:00.000Z'
const modules: TestingModule[] = []

async function createHarness() {
  let elapsed = 0
  const clock = createAdvancingSyntheticClock(BASE, () => elapsed)
  const testingModule = await Test.createTestingModule({
    imports: [MatriculaRegularModule],
    providers: [LocalProfileSessionService],
  })
    .overrideProvider(MATRICULA_REGULAR_CLOCK)
    .useValue(clock)
    .compile()
  modules.push(testingModule)
  return {
    service: testingModule.get(LocalProfileSessionService),
    repository: testingModule.get(MatriculaRegularRepository),
    sessionService: testingModule.get(SessionService),
    clock,
    setElapsed(value: number) {
      elapsed = value
    },
  }
}

async function createSession(
  sessionService: SessionService,
  repository: MatriculaRegularRepository,
  actorId: 'SYN-SIS-A' | 'SYN-SIS-B' = 'SYN-SIS-A',
) {
  return sessionService.create({ runId: repository.runId, actorId })
}

afterEach(async () => {
  await Promise.all(modules.splice(0).map((testingModule) => testingModule.close()))
})

describe('local profile server session and advancing clock', () => {
  it('session_boundary_899999_900000 stays active before the boundary and expires at equality', async () => {
    const { service, repository, sessionService, setElapsed, clock } = await createHarness()
    const created = await createSession(sessionService, repository)
    const identity: Identity = {
      runId: created.data.runId,
      actorId: 'SYN-SIS-A',
      sessionId: created.data.sessionId,
    }

    setElapsed(899_999)
    expect(service.requireActive(repository.readSnapshot(), identity, clock.now())).toEqual(created.data)
    setElapsed(900_000)
    expect(() => service.requireActive(repository.readSnapshot(), identity, clock.now()))
      .toThrow('SESSION_EXPIRED')
  })

  it('renew_same_identity_expiry preserves session identity and extends from server now', async () => {
    const { repository, sessionService, setElapsed } = await createHarness()
    const created = await createSession(sessionService, repository)
    setElapsed(60_000)

    const renewed = await sessionService.renew(created.data.sessionId, {
      runId: created.data.runId,
      actorId: created.data.actorId,
    })

    expect(renewed.data.sessionId).toBe(created.data.sessionId)
    expect(renewed.data.actorId).toBe(created.data.actorId)
    expect(renewed.data.startedAt).toBe(created.data.startedAt)
    expect(renewed.data.expiresAt).toBe('2026-08-11T14:16:00.000Z')
    setElapsed(960_000)
    await expect(sessionService.renew(created.data.sessionId, {
      runId: created.data.runId,
      actorId: created.data.actorId,
    })).rejects.toThrow('SESSION_EXPIRED')
  })

  it('reads_do_not_renew after repeated catalog reads', async () => {
    const { service, repository, sessionService, setElapsed } = await createHarness()
    await createSession(sessionService, repository)
    const before = repository.readSnapshot().sessions
    setElapsed(3_250)

    let latest = service.catalog()
    for (let index = 0; index < 100; index += 1) latest = service.catalog()

    validateProfileCatalogResponse(latest)
    expect(latest.data.profiles.map(({ actorId }) => actorId)).toEqual([
      'SYN-SIS-A', 'SYN-SIS-B', 'SYN-SOFT-A', 'SYN-SOFT-B',
    ])
    expect(latest.data.serverNow).toBe('2026-08-11T14:00:03.250Z')
    expect(repository.readSnapshot().sessions).toEqual(before)
  })

  it('close is absent; active lookup never mutates a read snapshot', async () => {
    const { service, repository, sessionService, clock } = await createHarness()
    const created = await createSession(sessionService, repository)
    const identity: Identity = {
      runId: created.data.runId,
      actorId: 'SYN-SIS-A',
      sessionId: created.data.sessionId,
    }
    const snapshot = repository.readSnapshot()
    const active = service.requireActive(snapshot, identity, clock.now())

    expect(active).toEqual(created.data)
    expect(snapshot.sessions).toEqual([created.data])
    expect(repository.readSnapshot().sessions).toEqual([created.data])
    expect('close' in service).toBe(false)
  })

  it('clock_monotonic clamps backward elapsed samples and clock_window_2h reaches the window end', async () => {
    let elapsed = 10
    const clock = createAdvancingSyntheticClock(BASE, () => elapsed)
    expect(clock.now().toISOString()).toBe(BASE)
    elapsed = 1_010
    expect(clock.now().toISOString()).toBe('2026-08-11T14:00:01.000Z')
    elapsed = 900
    expect(clock.now().toISOString()).toBe('2026-08-11T14:00:01.000Z')
    elapsed = 7_200_010
    expect(clock.now().toISOString()).toBe('2026-08-11T16:00:00.000Z')
  })

  it('run_actor_session_mismatch preserves contract precedence', async () => {
    const { service, repository, sessionService, clock, setElapsed } = await createHarness()
    repository.resetForTests([createSyntheticFixture('SISTEMAS')])
    const created = await createSession(sessionService, repository)
    const snapshot = repository.readSnapshot()
    const identity: Identity = {
      runId: created.data.runId,
      actorId: created.data.actorId as Identity['actorId'],
      sessionId: created.data.sessionId,
    }

    expect(() => service.requireActive(snapshot, { ...identity, runId: '30000000-0000-4000-8000-000000000001' }, clock.now()))
      .toThrow('RUN_CHANGED')
    expect(() => service.requireActive(snapshot, { ...identity, actorId: 'SYN-SOFT-A' }, clock.now()))
      .toThrow('ACTOR_NOT_FOUND')
    expect(() => service.requireActive(snapshot, { ...identity, sessionId: '30000000-0000-4000-8000-000000000001' }, clock.now()))
      .toThrow('SESSION_NOT_FOUND')
    expect(() => service.requireActive(snapshot, { ...identity, actorId: 'SYN-SIS-B' }, clock.now()))
      .toThrow('SESSION_CONTEXT_MISMATCH')
    setElapsed(900_000)
    expect(() => service.requireActive(snapshot, identity, clock.now())).toThrow('SESSION_EXPIRED')
  })
})

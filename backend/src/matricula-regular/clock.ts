export const DEMO_SESSION_DURATION_MS = 15 * 60 * 1000

export interface ServerClock {
  now(): Date
}

export function createSystemClock(): ServerClock {
  return { now: () => new Date() }
}

export function createFixedClock(instant: string | Date): ServerClock {
  const timestamp = new Date(instant).getTime()

  if (!Number.isFinite(timestamp)) {
    throw new RangeError('El instante del reloj debe ser una fecha válida')
  }

  return { now: () => new Date(timestamp) }
}

export function createSyntheticClock(day: '2026-08-11' | '2026-08-12' = '2026-08-11'): ServerClock {
  return createFixedClock(`${day}T15:00:00.000Z`)
}

export function createAdvancingSyntheticClock(
  base = '2026-08-11T14:00:00.000Z',
  elapsedNow: () => number = () => performance.now(),
): ServerClock {
  const baseTimestamp = new Date(base).getTime()
  if (!Number.isFinite(baseTimestamp) || new Date(baseTimestamp).toISOString() !== base) {
    throw new RangeError('El instante base del reloj debe ser UTC canónico')
  }

  const startedElapsed = elapsedNow()
  if (!Number.isFinite(startedElapsed)) {
    throw new RangeError('La muestra inicial del reloj debe ser finita')
  }

  let lastElapsed = 0
  return {
    now() {
      const sample = elapsedNow()
      if (Number.isFinite(sample)) {
        lastElapsed = Math.max(lastElapsed, sample - startedElapsed, 0)
      }
      return new Date(baseTimestamp + lastElapsed)
    },
  }
}

export function sessionStartedAt(clock: ServerClock): string {
  return clock.now().toISOString()
}

export function sessionExpiresAt(clock: ServerClock): string {
  return new Date(clock.now().getTime() + DEMO_SESSION_DURATION_MS).toISOString()
}

export function isSessionActive(expiresAt: string, clock: ServerClock): boolean {
  return clock.now().getTime() < new Date(expiresAt).getTime()
}

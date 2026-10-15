import { useEffect, useRef, useState } from 'react'
import { useLocation, useRouter } from '@tanstack/react-router'
import { localProfileSessionStore } from '../data/client'
import { bindVisibilityRenewal, expiryNavigationTarget, remainingSeconds, SESSION_DURATION_MS } from '../data/localProfileSession'
import type { VisibilitySource } from '../data/localProfileSession'
import { useLocalProfileSession } from '../data/useLocalProfileSession'

export function LocalProfileRouterBridge() {
  const router = useRouter()
  const pathname = useLocation({ select: (location) => location.pathname })
  const snapshot = useLocalProfileSession()
  const previousStatus = useRef(snapshot.status)

  useEffect(() => localProfileSessionStore.onIdentityChange((kind) => {
    router.clearCache()
    void router.invalidate()
    if (kind === 'logout' || kind === 'run-changed') void router.navigate({ to: '/local/login' })
  }), [router])

  // L-07 (T-01): returning to the tab resets the 15-minute timer.
  useEffect(() => bindVisibilityRenewal(document as VisibilitySource, () => localProfileSessionStore.renew()), [])

  useEffect(() => {
    const expiredNow = previousStatus.current === 'active' && snapshot.status === 'expired'
    previousStatus.current = snapshot.status
    if (expiredNow) {
      const target = expiryNavigationTarget(pathname)
      if (target) void router.navigate({ to: target })
    }
  }, [pathname, router, snapshot.status, previousStatus])
  return null
}

/** V-02 header: descending HH:MM:SS timer. Renewal is automatic (L-07); there is no renew button. */
export function LocalSessionClock() {
  const snapshot = useLocalProfileSession()
  const [clock, setClock] = useState<{ deadline: number; now: number } | null>(null)
  const activeDeadline = snapshot.status === 'active' ? snapshot.deadlineMono : null
  useEffect(() => {
    if (activeDeadline === null) return
    const initial = globalThis.setTimeout(() => setClock({ deadline: activeDeadline, now: performance.now() }), 0)
    const interval = globalThis.setInterval(() => setClock({ deadline: activeDeadline, now: performance.now() }), 1000)
    return () => {
      globalThis.clearTimeout(initial)
      globalThis.clearInterval(interval)
    }
  }, [activeDeadline])

  if (snapshot.status !== 'active' && snapshot.status !== 'expired') return <span className="session-clock">00:00:00</span>
  const seconds = snapshot.status === 'expired' ? 0
    : remainingSeconds(snapshot.deadlineMono, clock?.deadline === snapshot.deadlineMono
      ? clock.now : snapshot.deadlineMono - SESSION_DURATION_MS)
  const time = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((part) => String(part).padStart(2, '0')).join(':')
  return (
    <>
      <span className="session-clock" aria-label={`Tiempo de sesión restante ${time}`}>{time}</span>
      {snapshot.status === 'active' && snapshot.renewError && <span role="status">{snapshot.renewError}</span>}
      {snapshot.status === 'expired' && <span role="status">La sesión local venció.</span>}
    </>
  )
}

/** V-02 header «Salir»: client-only logout of the synthetic profile. */
export function LocalSignOutButton() {
  return (
    <button className="sign-out" type="button" onClick={() => localProfileSessionStore.logout()}>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2v10M6 5a9 9 0 1 0 12 0" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>{' '}Salir
    </button>
  )
}

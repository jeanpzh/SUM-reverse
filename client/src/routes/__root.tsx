import { createRootRoute, Link, Outlet, redirect, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { AcademicLocalShell } from '../components/AcademicLocalShell'
import { LocalProfileRouterBridge } from '../components/LocalSessionControls'
import { getLocalProfileActivation, localProfileReady, localProfileSessionStore, sumApi } from '../data/client'
import { evaluateProfileGuard, profileRootLoaderData } from '../data/localProfileSession'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { isLocalAcademicArea } from '../data/academicScheduling'

export const Route = createRootRoute({
  loaderDeps: () => ({ generation: localProfileSessionStore.getSnapshot().generation }),
  loader: ({ abortController, location }) => isLocalAcademicArea(location.pathname)
    ? null : getLocalProfileActivation() === 'synthetic-actors'
    ? Promise.resolve(profileRootLoaderData(localProfileSessionStore.getSnapshot()))
    : sumApi.get('formulario', { signal: abortController.signal }),
  beforeLoad: async ({ location, cause }) => {
    if (isLocalAcademicArea(location.pathname)) return
    if (getLocalProfileActivation() === 'legacy') return
    await localProfileReady
    const guard = evaluateProfileGuard(localProfileSessionStore.getSnapshot(), { pathname: location.pathname, cause })
    if (guard) throw redirect({ to: guard.redirect })
  },
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: RoutePending,
  component: function RootComponent(): ReactNode {
    const pathname: string = useLocation({ select: (location) => location.pathname })
    return isLocalAcademicArea(pathname) ? <Outlet /> : <><LocalProfileRouterBridge /><Outlet /></>
  },
  shellComponent: AcademicLocalShell,
  notFoundComponent: () => (
    <div className="not-found">
      <h2>Página no encontrada</h2>
      <Link to="/alumnoWebSum/v2/inicio">Volver al inicio</Link>
    </div>
  ),
  errorComponent: RouteError,
})

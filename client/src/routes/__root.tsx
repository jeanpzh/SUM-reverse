import { createRootRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { ProfileAwareShell } from '../components/Shell'
import { LocalProfileRouterBridge } from '../components/LocalSessionControls'
import { getLocalProfileActivation, localProfileReady, localProfileSessionStore, sumApi } from '../data/client'
import { evaluateProfileGuard, profileRootLoaderData } from '../data/localProfileSession'
import { RouteError, RoutePending } from '../components/RouteStatus'

export const Route = createRootRoute({
  loaderDeps: () => ({ generation: localProfileSessionStore.getSnapshot().generation }),
  loader: ({ abortController }) => getLocalProfileActivation() === 'synthetic-actors'
    ? Promise.resolve(profileRootLoaderData(localProfileSessionStore.getSnapshot()))
    : sumApi.get('formulario', { signal: abortController.signal }),
  beforeLoad: async ({ location, cause }) => {
    if (getLocalProfileActivation() === 'legacy') return
    await localProfileReady
    const guard = evaluateProfileGuard(localProfileSessionStore.getSnapshot(), { pathname: location.pathname, cause })
    if (guard) throw redirect({ to: guard.redirect })
  },
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: RoutePending,
  component: function RootComponent() { return <><LocalProfileRouterBridge /><Outlet /></> },
  shellComponent: ProfileAwareShell,
  notFoundComponent: () => (
    <div className="not-found">
      <h2>Página no encontrada</h2>
      <Link to="/alumnoWebSum/v2/inicio">Volver al inicio</Link>
    </div>
  ),
  errorComponent: RouteError,
})

import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { Shell } from '../components/Shell'
import { sumApi } from '../data/client'
import { RouteError, RoutePending } from '../components/RouteStatus'

export const Route = createRootRoute({
  loader: ({ abortController }) => sumApi.get('formulario', { signal: abortController.signal }),
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: RoutePending,
  shellComponent: Shell,
  component: Outlet,
  notFoundComponent: () => (
    <div className="not-found">
      <h2>Página no encontrada</h2>
      <Link to="/alumnoWebSum/v2/inicio">Volver al inicio</Link>
    </div>
  ),
  errorComponent: RouteError,
})

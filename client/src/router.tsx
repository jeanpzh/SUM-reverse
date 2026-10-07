import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { RouteError, RoutePending } from './components/RouteStatus'

export const router = createRouter({ routeTree, scrollRestoration: true, defaultPreload: 'intent',
  defaultStaleTime: 60_000, defaultPendingComponent: RoutePending, defaultErrorComponent: RouteError })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

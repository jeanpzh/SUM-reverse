import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { TableScreen } from '../screens/TableScreens'
import { RouteError, RoutePending } from '../components/RouteStatus'

export const Route = createFileRoute('/alumnoWebSum/v2/tutoria')({
  loader: ({ abortController }) => sumApi.get('tutoria', { signal: abortController.signal }),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    return <TableScreen id="tutoria" response={Route.useLoaderData()} />
  },
})

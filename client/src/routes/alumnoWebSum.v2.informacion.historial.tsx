import { createFileRoute } from '@tanstack/react-router'
import { TableScreen } from '../screens/TableScreens'
import { loadLocalMiInformacion } from '../data/client'
import { RouteError, RoutePending } from '../components/RouteStatus'

export const Route = createFileRoute('/alumnoWebSum/v2/informacion/historial')({
  loader: ({ abortController }) => loadLocalMiInformacion('historial', { signal: abortController.signal }),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    return <TableScreen id="historial" response={Route.useLoaderData()} />
  },
})

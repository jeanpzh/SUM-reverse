import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { TableScreen } from '../screens/TableScreens'
import { RouteError, RoutePending } from '../components/RouteStatus'

export const Route = createFileRoute('/alumnoWebSum/v2/matricula/programacion')({
  loader: ({ abortController }) => sumApi.get('programacion', { signal: abortController.signal }),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    return <TableScreen id="programacion-asignaturas" response={Route.useLoaderData()} />
  },
})

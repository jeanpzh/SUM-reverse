import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { TableScreen } from '../screens/TableScreens'

export const Route = createFileRoute('/alumnoWebSum/v2/asistencia')({
  loader: ({ abortController }) => sumApi.get('asistencias', { signal: abortController.signal }),
  component: function RouteComponent() {
    return <TableScreen id="asistencia" response={Route.useLoaderData()} />
  },
})

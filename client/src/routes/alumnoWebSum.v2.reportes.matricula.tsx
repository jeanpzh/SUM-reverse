import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { TableScreen } from '../screens/TableScreens'

export const Route = createFileRoute('/alumnoWebSum/v2/reportes/matricula')({
  loader: ({ abortController }) => sumApi.get('matricula', { signal: abortController.signal }),
  component: function RouteComponent() {
    return <TableScreen id="reportes-matricula" response={Route.useLoaderData()} />
  },
})

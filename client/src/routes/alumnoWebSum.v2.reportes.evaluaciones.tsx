import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { TableScreen } from '../screens/TableScreens'

export const Route = createFileRoute('/alumnoWebSum/v2/reportes/evaluaciones')({
  loader: ({ abortController }) => sumApi.get('evaluaciones', { signal: abortController.signal }),
  component: function RouteComponent() {
    return <TableScreen id="reportes-evaluaciones" response={Route.useLoaderData()} />
  },
})

import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { TableScreen } from '../screens/TableScreens'

export const Route = createFileRoute('/alumnoWebSum/v2/reportes/prematricula')({
  loader: ({ abortController }) => sumApi.get('prematricula', { signal: abortController.signal }),
  component: function RouteComponent() {
    return <TableScreen id="reportes-prematricula" response={Route.useLoaderData()} />
  },
})

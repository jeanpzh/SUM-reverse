import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { TableScreen } from '../screens/TableScreens'

export const Route = createFileRoute('/alumnoWebSum/v2/reportes/deudas')({
  loader: ({ abortController }) => sumApi.get('deudas', { signal: abortController.signal }),
  component: function RouteComponent() {
    return <TableScreen id="reportes-deudas" response={Route.useLoaderData()} />
  },
})

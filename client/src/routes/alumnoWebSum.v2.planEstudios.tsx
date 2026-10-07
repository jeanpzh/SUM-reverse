import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { TableScreen } from '../screens/TableScreens'

export const Route = createFileRoute('/alumnoWebSum/v2/planEstudios')({
  loader: ({ abortController }) => sumApi.get('plan', { signal: abortController.signal }),
  component: function RouteComponent() {
    return <TableScreen id="plan-estudios" response={Route.useLoaderData()} />
  },
})

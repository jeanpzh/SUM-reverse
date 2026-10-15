import { createFileRoute } from '@tanstack/react-router'
import { getLocalProfileActivation, readLocalProfileRoute, sumApi } from '../data/client'
import { TableScreen } from '../screens/TableScreens'
import { LocalAcademicView } from '../screens/LocalAcademicView'
import { RouteError, RoutePending } from '../components/RouteStatus'

export const Route = createFileRoute('/alumnoWebSum/v2/planEstudios')({
  loader: async ({ abortController }) => getLocalProfileActivation() === 'synthetic-actors'
    ? { mode: 'synthetic-actors' as const,
      response: await readLocalProfileRoute('plan', undefined, { signal: abortController.signal }) }
    : { mode: 'legacy' as const, response: await sumApi.get('plan', { signal: abortController.signal }) },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    const loaded = Route.useLoaderData()
    return loaded.mode === 'synthetic-actors'
      ? <LocalAcademicView kind="plan" response={loaded.response.data.payload} />
      : <TableScreen id="plan-estudios" response={loaded.response} />
  },
})

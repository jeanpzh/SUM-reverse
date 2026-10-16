import { createFileRoute } from '@tanstack/react-router'
import { getLocalProfileActivation, readLocalProfileRoute, sumApi } from '../data/client'
import { TableScreen } from '../screens/TableScreens'
import { LocalAcademicView } from '../screens/LocalAcademicView'
import { RouteError, RoutePending } from '../components/RouteStatus'

export const Route = createFileRoute('/alumnoWebSum/v2/matricula/programacion')({
  loader: async ({ abortController }) => getLocalProfileActivation() === 'synthetic-actors'
    ? { mode: 'synthetic-actors' as const,
      response: await readLocalProfileRoute('programacion', undefined, { signal: abortController.signal }) }
    : { mode: 'legacy' as const, response: await sumApi.get('programacion', { signal: abortController.signal }) },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    const loaded = Route.useLoaderData()
    return loaded.mode === 'synthetic-actors'
      ? 'data' in loaded.response.data.payload
        ? <TableScreen id="programacion-asignaturas" response={loaded.response.data.payload} />
        : <LocalAcademicView kind="programacion" response={loaded.response.data.payload} />
      : <TableScreen id="programacion-asignaturas" response={loaded.response} />
  },
})

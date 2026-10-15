import { createFileRoute } from '@tanstack/react-router'
import { getLocalProfileActivation, readLocalProfileRoute, sumApi } from '../data/client'
import { TableScreen } from '../screens/TableScreens'
import { LocalAcademicView } from '../screens/LocalAcademicView'

export const Route = createFileRoute('/alumnoWebSum/v2/reportes/horarios')({
  loader: async ({ abortController }) => getLocalProfileActivation() === 'synthetic-actors'
    ? { mode: 'synthetic-actors' as const,
      response: await readLocalProfileRoute('horarios', undefined, { signal: abortController.signal }) }
    : { mode: 'legacy' as const, response: await sumApi.get('horarios', { signal: abortController.signal }) },
  component: function RouteComponent() {
    const loaded = Route.useLoaderData()
    return loaded.mode === 'synthetic-actors'
      ? <LocalAcademicView kind="horarios" response={loaded.response.data.payload} />
      : <TableScreen id="reportes-horarios" response={loaded.response} />
  },
})

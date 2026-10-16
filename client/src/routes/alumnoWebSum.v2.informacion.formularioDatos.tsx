import { createFileRoute } from '@tanstack/react-router'
import { getDataMode, getLocalProfileActivation, sumApi } from '../data/client'
import { StudentForms } from '../screens/StudentForms'
import { RouteError, RoutePending } from '../components/RouteStatus'

export const Route = createFileRoute('/alumnoWebSum/v2/informacion/formularioDatos')({
  loader: async ({ abortController }) => getLocalProfileActivation() === 'synthetic-actors'
    ? { mode: 'synthetic-actors' as const, profile: null }
    : { mode: 'legacy' as const, profile: getDataMode() === 'local'
      ? null : await sumApi.get('perfil', { signal: abortController.signal }) },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    const loaded = Route.useLoaderData()
    return <StudentForms profile={loaded.profile} />
  },
})

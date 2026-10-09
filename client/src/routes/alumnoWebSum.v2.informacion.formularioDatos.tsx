import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { getDataMode } from '../data/client'
import { StudentForms } from '../screens/StudentForms'
import { RouteError, RoutePending } from '../components/RouteStatus'

export const Route = createFileRoute('/alumnoWebSum/v2/informacion/formularioDatos')({
  loader: ({ abortController }) => getDataMode() === 'local'
    ? Promise.resolve(null)
    : sumApi.get('perfil', { signal: abortController.signal }),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    return <StudentForms profile={Route.useLoaderData()} />
  },
})

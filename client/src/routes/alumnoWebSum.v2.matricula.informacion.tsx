import { createFileRoute } from '@tanstack/react-router'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { sumApi } from '../data/client'
import { EnrollmentInfo } from '../screens/EnrollmentInfo'

export const Route = createFileRoute('/alumnoWebSum/v2/matricula/informacion')({
  loader: ({ abortController }) => sumApi.get('matriculaInfo', { signal: abortController.signal }),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    return <EnrollmentInfo response={Route.useLoaderData()} />
  },
})

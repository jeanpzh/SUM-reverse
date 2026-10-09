import { createFileRoute } from '@tanstack/react-router'
import { StudentForms } from '../screens/StudentForms'
import { loadLocalMiInformacion } from '../data/client'
import { RouteError, RoutePending } from '../components/RouteStatus'

export const Route = createFileRoute('/alumnoWebSum/v2/informacion/fichaSocioeconomica')({
  loader: ({ abortController }) => loadLocalMiInformacion('fichaSocioeconomica', { signal: abortController.signal }),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    return <StudentForms socioeconomic ficha={Route.useLoaderData()} />
  },
})

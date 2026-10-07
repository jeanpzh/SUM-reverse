import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { StudentForms } from '../screens/StudentForms'

export const Route = createFileRoute('/alumnoWebSum/v2/informacion/formularioDatos')({
  loader: ({ abortController }) => sumApi.get('perfil', { signal: abortController.signal }),
  component: function RouteComponent() {
    return <StudentForms profile={Route.useLoaderData()} />
  },
})

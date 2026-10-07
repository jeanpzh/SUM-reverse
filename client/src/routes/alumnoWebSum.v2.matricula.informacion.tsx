import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { EnrollmentInfo } from '../screens/EnrollmentInfo'

export const Route = createFileRoute('/alumnoWebSum/v2/matricula/informacion')({
  loader: ({ abortController }) => sumApi.get('matriculaInfo', { signal: abortController.signal }),
  component: function RouteComponent() {
    return <EnrollmentInfo response={Route.useLoaderData()} />
  },
})

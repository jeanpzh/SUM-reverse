import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { Profile } from '../screens/Profile'

export const Route = createFileRoute('/alumnoWebSum/v2/informacion/perfil')({
  loader: ({ abortController }) => sumApi.get('perfil', { signal: abortController.signal }),
  component: function RouteComponent() {
    return <Profile response={Route.useLoaderData()} />
  },
})

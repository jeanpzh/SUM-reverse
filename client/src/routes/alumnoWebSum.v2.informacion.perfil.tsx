import { createFileRoute } from '@tanstack/react-router'
import { sumApi } from '../data/client'
import { Profile } from '../screens/Profile'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { getDataMode } from '../data/client'
import { rememberMiRepresentation } from '../data/miInformacion'

export const Route = createFileRoute('/alumnoWebSum/v2/informacion/perfil')({
  loader: async ({ abortController }) => {
    const mode = getDataMode()
    const local = mode === 'local'
    const response = await sumApi.get('perfil', { signal: abortController.signal })
    if (mode === 'mock') rememberMiRepresentation(response, 'local-v1')
    return { response, local, representation: mode === 'mock' ? 'local-v1' as const : undefined }
  },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    const { response, local, representation } = Route.useLoaderData()
    return <Profile response={response} local={local} representation={representation} />
  },
})

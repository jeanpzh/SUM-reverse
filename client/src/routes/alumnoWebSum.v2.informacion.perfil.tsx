import { createFileRoute } from '@tanstack/react-router'
import { getLocalProfileActivation, readLocalProfileRoute, sumApi } from '../data/client'
import { Profile } from '../screens/Profile'
import { LocalAcademicView } from '../screens/LocalAcademicView'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { getDataMode } from '../data/client'
import { rememberMiRepresentation } from '../data/miInformacion'

export const Route = createFileRoute('/alumnoWebSum/v2/informacion/perfil')({
  loader: async ({ abortController }) => {
    if (getLocalProfileActivation() === 'synthetic-actors') {
      return { mode: 'synthetic-actors' as const,
        response: await readLocalProfileRoute('perfil', undefined, { signal: abortController.signal }) }
    }
    const mode = getDataMode()
    const local = mode === 'local'
    const response = await sumApi.get('perfil', { signal: abortController.signal })
    if (mode === 'mock') rememberMiRepresentation(response, 'local-v1')
    return { mode: 'legacy' as const, response, local, representation: mode === 'mock' ? 'local-v1' as const : undefined }
  },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    const loaded = Route.useLoaderData()
    if (loaded.mode === 'synthetic-actors') return <LocalAcademicView kind="perfil" response={loaded.response.data.payload} />
    return <Profile response={loaded.response} local={loaded.local} representation={loaded.representation} />
  },
})

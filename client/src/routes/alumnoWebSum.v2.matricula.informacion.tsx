import { createFileRoute } from '@tanstack/react-router'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { getLocalProfileActivation, readLocalProfileRoute, sumApi } from '../data/client'
import { EnrollmentInfo } from '../screens/EnrollmentInfo'
import { MatriculaInfoSum } from '../screens/MatriculaInfoSum'

export const Route = createFileRoute('/alumnoWebSum/v2/matricula/informacion')({
  loader: async ({ abortController }) => {
    if (getLocalProfileActivation() !== 'synthetic-actors') {
      return { mode: 'legacy' as const, response: await sumApi.get('matriculaInfo', { signal: abortController.signal }) }
    }
    const [info, enrollment] = await Promise.all([
      readLocalProfileRoute('matriculaInfo', undefined, { signal: abortController.signal }),
      readLocalProfileRoute('matricula', undefined, { signal: abortController.signal }),
    ])
    return { mode: 'synthetic-actors' as const, context: info.data.payload, report: enrollment.data.payload }
  },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    const loaded = Route.useLoaderData()
    return loaded.mode === 'synthetic-actors'
      ? <MatriculaInfoSum context={loaded.context} report={loaded.report} />
      : <EnrollmentInfo response={loaded.response} />
  },
})

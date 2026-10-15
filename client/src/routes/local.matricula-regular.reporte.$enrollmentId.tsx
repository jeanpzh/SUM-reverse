import { createFileRoute, redirect } from '@tanstack/react-router'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { createMatriculaRegularApi } from '../data/matriculaRegular'
import { parseReportSearch } from '../data/regularEnrollmentReport'
import { RegularEnrollmentReportView } from '../screens/RegularEnrollmentReport'
import { getLocalProfileActivation } from '../data/client'
import { activeProfileIdentity } from '../data/localProfileSession'
import { localProfileSessionStore } from '../data/client'

export const Route = createFileRoute('/local/matricula-regular/reporte/$enrollmentId')({
  validateSearch: parseReportSearch,
  loaderDeps: ({ search }) => ({ runId: search.runId, actorId: search.actorId }),
  // Read-only GET against the own local API; RouteError.invalidate reloads this GET and never submits.
  loader: async ({ params, deps, abortController }) => {
    if (getLocalProfileActivation() !== 'synthetic-actors') return { mode: 'unavailable' as const }
    const identity = activeProfileIdentity(localProfileSessionStore.getSnapshot())
    if (!identity || identity.runId !== deps.runId || identity.actorId !== deps.actorId) {
      throw redirect({ to: '/alumnoWebSum/v2/reportes/matricula' })
    }
    return { mode: 'synthetic-actors' as const, report: await createMatriculaRegularApi({ mode: 'local' })
      .getReport({ ...deps, enrollmentId: params.enrollmentId }, { signal: abortController.signal }) }
  },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RegularEnrollmentReportRoute() {
    const loaded = Route.useLoaderData()
    if (loaded.mode === 'unavailable') return <section className="route-status" role="status">
      <h2>Matrícula regular local no disponible</h2>
      <p>Esta demostración solo está disponible con el perfil sintético local activado.</p>
    </section>
    return <RegularEnrollmentReportView report={loaded.report} />
  },
})

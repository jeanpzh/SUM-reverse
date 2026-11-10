import { useRouter } from '@tanstack/react-router'
import { PlanningFetchLoading } from './PlanningFetchLoading'

export function RoutePending() {
  return (
    <div className="route-status route-status--pending" role="status">
      <PlanningFetchLoading label="Cargando información…" layout="page" />
    </div>
  )
}

export function RouteError({ error }: { error: unknown }) {
  const router = useRouter()
  return (
    <section className="route-status" role="alert">
      <h2>No se pudo cargar la información</h2>
      <p>{error instanceof Error ? error.message : 'La consulta no se pudo completar.'}</p>
      <button onClick={() => { void router.invalidate() }}>Intentar de nuevo</button>
    </section>
  )
}

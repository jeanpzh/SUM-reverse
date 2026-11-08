import { createFileRoute } from '@tanstack/react-router'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { AcademicScheduling } from '../screens/AcademicScheduling'
import { isAcademicSchedulingEnabled } from '../data/academicScheduling'
import { parsePlanningView, type PlanningPreparationView } from '../data/planningSession'

export type PlanningStage = 'preparacion' | 'horario' | 'revision' | 'aprobacion'

export interface AcademicSchedulingSearch {
  etapa?: PlanningStage
  vista?: PlanningPreparationView
}

export const PLANNING_STAGES: readonly { id: PlanningStage; label: string }[] = [
  { id: 'preparacion', label: 'Preparación' },
  { id: 'horario', label: 'Horario' },
  { id: 'revision', label: 'Revisión docente' },
  { id: 'aprobacion', label: 'Aprobación' },
] as const

export function validateAcademicSchedulingSearch(search: Record<string, unknown>): AcademicSchedulingSearch {
  const etapa = search.etapa === 'horario' || search.etapa === 'revision' || search.etapa === 'aprobacion'
    ? search.etapa : 'preparacion'
  return etapa === 'preparacion' ? { etapa, vista: parsePlanningView(search.vista, etapa) } : { etapa }
}

export const Route = createFileRoute('/local/programacion-academica')({
  validateSearch: validateAcademicSchedulingSearch,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function AcademicSchedulingRoute() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    const stage = search.etapa ?? 'preparacion'
    return isAcademicSchedulingEnabled() ? <AcademicScheduling currentStage={stage} preparationView={search.vista}
      onPreparationViewChange={(vista) => { void navigate({ search: { etapa: 'preparacion', vista } }) }} />
      : <section role="status">El módulo de programación académica local no está habilitado.</section>
  },
})

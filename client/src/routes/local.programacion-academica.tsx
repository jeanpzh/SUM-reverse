import { createFileRoute } from '@tanstack/react-router'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { AcademicScheduling } from '../screens/AcademicScheduling'
import { isAcademicSchedulingEnabled } from '../data/academicScheduling'

export type PlanningStage = 'preparacion' | 'horario' | 'revision' | 'aprobacion'

export interface AcademicSchedulingSearch {
  etapa?: PlanningStage
}

export const PLANNING_STAGES: readonly { id: PlanningStage; label: string }[] = [
  { id: 'preparacion', label: 'Preparación' },
  { id: 'horario', label: 'Horario' },
  { id: 'revision', label: 'Revisión docente' },
  { id: 'aprobacion', label: 'Aprobación' },
] as const

export function validateAcademicSchedulingSearch(search: Record<string, unknown>): AcademicSchedulingSearch {
  const etapa = typeof search.etapa === 'string' ? search.etapa : undefined
  if (etapa === 'preparacion' || etapa === 'horario' || etapa === 'revision' || etapa === 'aprobacion') {
    return { etapa }
  }
  return { etapa: 'preparacion' }
}

export const Route = createFileRoute('/local/programacion-academica')({
  validateSearch: validateAcademicSchedulingSearch,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function AcademicSchedulingRoute() {
    const search = Route.useSearch()
    const stage = search.etapa ?? 'preparacion'
    return isAcademicSchedulingEnabled() ? <AcademicScheduling currentStage={stage} />
      : <section role="status">El módulo de programación académica local no está habilitado.</section>
  },
})

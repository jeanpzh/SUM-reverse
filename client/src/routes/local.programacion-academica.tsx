import { createFileRoute } from '@tanstack/react-router'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { AcademicScheduling } from '../screens/AcademicScheduling'
import { isAcademicSchedulingEnabled } from '../data/academicScheduling'

export const Route = createFileRoute('/local/programacion-academica')({
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function AcademicSchedulingRoute() {
    return isAcademicSchedulingEnabled() ? <AcademicScheduling />
      : <section role="status">El módulo de programación académica local no está habilitado.</section>
  },
})

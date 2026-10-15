import { createFileRoute } from '@tanstack/react-router'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { RegularEnrollment } from '../screens/RegularEnrollment'

export const Route = createFileRoute('/local/matricula-regular')({
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: RegularEnrollment,
})

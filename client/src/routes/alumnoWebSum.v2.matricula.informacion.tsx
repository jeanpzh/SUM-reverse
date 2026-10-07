import { createFileRoute } from '@tanstack/react-router'
import { EnrollmentInfo } from '../screens/EnrollmentInfo'

export const Route = createFileRoute('/alumnoWebSum/v2/matricula/informacion')({
  component: () => <EnrollmentInfo />,
})

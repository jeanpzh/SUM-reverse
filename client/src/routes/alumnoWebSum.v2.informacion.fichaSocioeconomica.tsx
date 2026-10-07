import { createFileRoute } from '@tanstack/react-router'
import { StudentForms } from '../screens/StudentForms'

export const Route = createFileRoute('/alumnoWebSum/v2/informacion/fichaSocioeconomica')({
  component: () => <StudentForms socioeconomic />,
})

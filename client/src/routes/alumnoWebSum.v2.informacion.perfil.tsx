import { createFileRoute } from '@tanstack/react-router'
import { Profile } from '../screens/Profile'

export const Route = createFileRoute('/alumnoWebSum/v2/informacion/perfil')({
  component: () => <Profile />,
})

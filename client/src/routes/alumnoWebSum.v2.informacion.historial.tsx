import { createFileRoute } from '@tanstack/react-router'
import { TableScreen } from '../screens/TableScreens'

export const Route = createFileRoute('/alumnoWebSum/v2/informacion/historial')({
  component: () => <TableScreen id="historial" />,
})

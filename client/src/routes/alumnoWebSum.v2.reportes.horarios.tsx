import { createFileRoute } from '@tanstack/react-router'
import { TableScreen } from '../screens/TableScreens'

export const Route = createFileRoute('/alumnoWebSum/v2/reportes/horarios')({
  component: () => <TableScreen id="reportes-horarios" />,
})

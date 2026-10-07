import { createFileRoute } from '@tanstack/react-router'
import { TableScreen } from '../screens/TableScreens'

export const Route = createFileRoute('/alumnoWebSum/v2/reportes/matricula')({
  component: () => <TableScreen id="reportes-matricula" />,
})

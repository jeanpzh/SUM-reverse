import { createFileRoute } from '@tanstack/react-router'
import { Manuals } from '../screens/Manuals'

export const Route = createFileRoute('/alumnoWebSum/v2/manuales')({ component: () => <Manuals /> })

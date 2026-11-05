import { createFileRoute, redirect } from '@tanstack/react-router'
import { LocalModules } from '../screens/LocalModules'
import { isLocalAcademicArea } from '../data/academicScheduling'

export const Route = createFileRoute('/local/modulos')({
  beforeLoad: () => {
    if (!isLocalAcademicArea('/local/modulos')) throw redirect({ to: '/alumnoWebSum/v2/inicio' })
  },
  component: LocalModules,
})

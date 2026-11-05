import { createFileRoute, redirect } from '@tanstack/react-router'
import { isLocalAcademicArea } from '../data/academicScheduling'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: isLocalAcademicArea('/') ? '/local/modulos' : '/alumnoWebSum/v2/inicio' })
  },
})

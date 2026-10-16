import { createFileRoute, redirect } from '@tanstack/react-router'
import { LocalProfileLogin } from '../screens/LocalProfileLogin'
import { getLocalProfileActivation } from '../data/client'

export const Route = createFileRoute('/local/login')({
  beforeLoad: () => {
    if (getLocalProfileActivation() !== 'synthetic-actors') throw redirect({ to: '/alumnoWebSum/v2/inicio' })
  },
  component: LocalProfileLogin,
})

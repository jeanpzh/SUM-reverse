import { createFileRoute } from '@tanstack/react-router'
import { LocalProfileLogin } from '../screens/LocalProfileLogin'

export const Route = createFileRoute('/local/login')({ component: LocalProfileLogin })

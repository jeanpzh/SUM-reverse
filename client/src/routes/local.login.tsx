import { createFileRoute, redirect } from '@tanstack/react-router'
import { LocalProfileLogin } from '../screens/LocalProfileLogin'
import { getLocalProfileActivation, localProfileSessionStore } from '../data/client'
import { parseOperationalRunId } from '../data/enrollmentOffer'

type LoginSearch = { runId?: string; invalid?: true }
function validateLoginSearch(search: Record<string, unknown>): LoginSearch {
  const parsed = parseOperationalRunId(search.runId)
  if (parsed.invalid) return { invalid: true }
  return parsed.runId ? { runId: parsed.runId } : {}
}

export const Route = createFileRoute('/local/login')({
  validateSearch: validateLoginSearch,
  beforeLoad: ({ search }) => {
    if (getLocalProfileActivation() !== 'synthetic-actors') throw redirect({ to: '/alumnoWebSum/v2/inicio' })
    const snapshot = localProfileSessionStore.getSnapshot()
    if (!search.runId && !search.invalid && snapshot.status === 'anonymous' && snapshot.reentryRunId) {
      throw redirect({ to: '/local/login', search: { runId: snapshot.reentryRunId } })
    }
  },
  component: function LocalProfileLoginRoute() {
    const search = Route.useSearch()
    return <LocalProfileLogin key={search.runId ?? (search.invalid ? 'invalid' : 'legacy')}
      operationalRunId={search.runId ?? null} invalidRunId={search.invalid === true} />
  },
})

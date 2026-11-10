import { createContext, useContext, type ReactNode } from 'react'
import { usePlanningSession } from '../data/planningSession'

type PlanningSessionValue = ReturnType<typeof usePlanningSession>

const PlanningSessionContext = createContext<PlanningSessionValue | null>(null)

export function PlanningSessionProvider({ children }: { children: ReactNode }): ReactNode {
  const value = usePlanningSession()
  return <PlanningSessionContext.Provider value={value}>{children}</PlanningSessionContext.Provider>
}

// The provider and its consumer hook share this context for one session per shell.
// eslint-disable-next-line react-refresh/only-export-components
export function usePlanningSessionContext(): PlanningSessionValue {
  const value = useContext(PlanningSessionContext)
  if (!value) throw new Error('usePlanningSessionContext requires PlanningSessionProvider')
  return value
}

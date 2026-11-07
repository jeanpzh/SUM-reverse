import { createContext, useContext } from 'react'

export const PlanningPortalContext = createContext<HTMLElement | null>(null)

export function usePlanningPortalContainer(): HTMLElement | undefined {
  return useContext(PlanningPortalContext) ?? undefined
}

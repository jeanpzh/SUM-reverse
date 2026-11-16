import { useSyncExternalStore } from 'react'

// Shared state of the assistance rail. The rail (opened by the workspace host) and
// the advisor (whose state lives with the result strip) are siblings in the tree, so
// they meet through this small store instead of through props the host would forward.
export type PlanningAssistTab = 'consejero' | 'normativa'

interface PlanningAssistSnapshot {
  tab: PlanningAssistTab
  /** Element of the Consejero tab that receives the advisor panel. */
  slot: HTMLElement | null
  /** Number of mounted advisors (one per proposal strip). */
  advisors: number
  openRequests: number
  closeRequests: number
}

let snapshot: PlanningAssistSnapshot = { tab: 'consejero', slot: null, advisors: 0, openRequests: 0, closeRequests: 0 }
let focusedRequests = 0
const listeners = new Set<() => void>()

function update(patch: Partial<PlanningAssistSnapshot>) {
  snapshot = { ...snapshot, ...patch }
  listeners.forEach((listener) => listener())
}

export const planningAssist = {
  getTab(): PlanningAssistTab {
    return snapshot.tab
  },
  setTab(tab: PlanningAssistTab) {
    if (snapshot.tab !== tab) update({ tab })
  },
  /** Ask the host to show the rail on the given tab. */
  requestOpen(tab: PlanningAssistTab) {
    update({ tab, openRequests: snapshot.openRequests + 1 })
  },
  /** Ask the host to close the rail and return focus to its toggle. */
  requestClose() {
    update({ closeRequests: snapshot.closeRequests + 1 })
  },
  setSlot(slot: HTMLElement | null) {
    if (snapshot.slot !== slot) update({ slot })
  },
  /** Clears the slot only if it still is the given element (an unmounting panel never evicts its successor). */
  clearSlot(slot: HTMLElement) {
    if (snapshot.slot === slot) update({ slot: null })
  },
  registerAdvisor() {
    update({ advisors: snapshot.advisors + 1 })
    return () => update({ advisors: snapshot.advisors - 1 })
  },
  /** True once per open request, so the rail moves focus only when it was asked to open. */
  consumeFocusRequest() {
    if (snapshot.openRequests <= focusedRequests) return false
    focusedRequests = snapshot.openRequests
    return true
  },
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const getSnapshot = () => snapshot

export function usePlanningAssist() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

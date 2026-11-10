import { useState } from 'react'

// A layout change never supplies the user's intent to open a modal. Reset before
// committing the new layout so the workspace is never briefly made inert.
export function usePlanningAssistantDisplay(railLayout: boolean) {
  const [display, setDisplay] = useState({ railLayout, open: railLayout, expanded: false })
  let current = display
  if (display.railLayout !== railLayout) {
    current = { railLayout, open: false, expanded: false }
    setDisplay(current)
  }

  return {
    open: current.open,
    expanded: current.expanded,
    setOpen: (open: boolean) => setDisplay(previous => ({
      railLayout, open, expanded: open ? previous.expanded : false,
    })),
    setExpanded: (expanded: boolean) => setDisplay(previous => ({ ...previous, railLayout, expanded })),
  }
}

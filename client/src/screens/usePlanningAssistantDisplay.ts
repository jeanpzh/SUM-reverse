import { useLayoutEffect, useRef, useState } from 'react'
import { usePlanningAssist } from './PlanningAssistState'

// A layout change never supplies the user's intent to open a modal. Reset before
// committing the new layout so the workspace is never briefly made inert.
// Open/close requests from the advisor (see PlanningAssistState) are explicit intent.
export function usePlanningAssistantDisplay(railLayout: boolean) {
  const { openRequests, closeRequests } = usePlanningAssist()
  const [display, setDisplay] = useState({ railLayout, open: false, expanded: false, opened: openRequests, closed: closeRequests })
  let current = display
  if (display.railLayout !== railLayout) {
    current = { railLayout, open: false, expanded: false, opened: openRequests, closed: closeRequests }
  } else if (display.opened !== openRequests || display.closed !== closeRequests) {
    const open = display.opened !== openRequests
    current = { ...display, open, expanded: open ? display.expanded : false, opened: openRequests, closed: closeRequests }
  }
  if (current !== display) setDisplay(current)

  const handledClose = useRef(closeRequests)
  useLayoutEffect(() => {
    if (handledClose.current === closeRequests) return
    handledClose.current = closeRequests
    document.getElementById('planning-toggle-chat')?.focus()
  }, [closeRequests])

  return {
    open: current.open,
    expanded: current.expanded,
    setOpen: (open: boolean) => setDisplay(previous => ({
      ...previous, railLayout, open, expanded: open ? previous.expanded : false,
    })),
    setExpanded: (expanded: boolean) => setDisplay(previous => ({ ...previous, railLayout, expanded })),
  }
}

import { useRef } from 'react'

// Radix returns focus only to a <Trigger>. Overlays opened from controls elsewhere in the screen
// (controlled `open`) record the focused element as they open and give focus back on close.
// onOpenAutoFocus runs before Radix moves focus into the content, so activeElement is the opener.
export function useReturnFocus(onOpenAutoFocus?: (event: Event) => void, onCloseAutoFocus?: (event: Event) => void) {
  const opener = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (event: Event) => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event)
      const target = opener.current
      opener.current = null
      if (event.defaultPrevented || !target?.isConnected || target === document.body) return
      event.preventDefault()
      target.focus()
    },
  }
}

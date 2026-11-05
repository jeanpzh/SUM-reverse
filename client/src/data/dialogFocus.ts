/** Keep keyboard focus within an open modal, including native dialogs with one action. */
export function containDialogTab(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>,
  dialog: HTMLDialogElement, initialFocus: HTMLElement | null = null) {
  if (event.key !== 'Tab') return
  const controls = dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  const first = controls[0]
  const last = controls[controls.length - 1]
  const active = dialog.ownerDocument.activeElement
  if (!first || !last) {
    event.preventDefault()
    dialog.focus()
  } else if (event.shiftKey && (active === first || active === initialFocus || active === dialog)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || active === dialog)) {
    event.preventDefault()
    first.focus()
  }
}

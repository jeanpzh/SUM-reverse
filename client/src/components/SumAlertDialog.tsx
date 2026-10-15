import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import './SumEnrollment.css'

export type SumAlertKind = 'warning' | 'success' | 'error'

const ALERT_ICONS: Record<SumAlertKind, ReactNode> = {
  warning: (
    <svg width="56" height="56" viewBox="0 0 24 24"><path d="M12 2 1 21h22L12 2zm-1 7h2v6h-2V9zm0 8h2v2h-2v-2z" fill="currentColor" /></svg>
  ),
  success: (
    <svg width="56" height="56" viewBox="0 0 24 24">
      <path d="M2 21h4V9H2v12zm20-11a2 2 0 0 0-2-2h-6.3l1-4.6V3a1.5 1.5 0 0 0-.4-1L13.2 1 6.6 7.6A2 2 0 0 0 6 9v10a2 2 0 0 0 2 2h9a2 2 0 0 0 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-2z" fill="currentColor" />
    </svg>
  ),
  error: (
    <svg width="56" height="56" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
}

export interface SumAlertDialogProps {
  kind: SumAlertKind
  children: ReactNode
  actions: ReactNode
  /** Escape handler; omit it for alerts that cannot be dismissed (the success redirect). */
  onDismiss?: () => void
}

/** «Aviso» alert of V-06/V-07; the error variant is the authorized local inference L-08. Mount it only while open. */
export function SumAlertDialog({ kind, children, actions, onDismiss }: SumAlertDialogProps) {
  const titleId = useId()
  const bodyId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  return (
    <dialog ref={dialogRef} className={`sum-alert sum-alert--${kind}`} aria-labelledby={titleId} aria-describedby={bodyId}
      onCancel={(event) => { event.preventDefault(); onDismiss?.() }}>
      <div className="sum-alert__icon" aria-hidden="true">{ALERT_ICONS[kind]}</div>
      <h2 id={titleId} className="sum-alert__title">Aviso</h2>
      <div id={bodyId} className="sum-alert__body">{children}</div>
      <div className="sum-alert__actions">{actions}</div>
    </dialog>
  )
}

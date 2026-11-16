// Confirmation dialog of Aprobación y publicación, restyled as the Approval board
// (paper, 16px radius, float shadow, question title, verb + object confirm). It reuses the shared
// AlertDialog primitives (focus return, Escape, portal inside .planning-root) and keeps the
// ConfirmRequest contract of components/ui/ConfirmDialog.
import { useCallback, useRef, useState, type ReactNode } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/AlertDialog'
import type { ConfirmOptions, ConfirmRequest } from '../components/ui/ConfirmDialog'
import './PlanningApprovalDialog.css'

export type PlanningApprovalConfirmRequest = ConfirmRequest & { eyebrow?: string }

export function PlanningApprovalDialog({ request, onClose }: { request: PlanningApprovalConfirmRequest | null; onClose: () => void }) {
  return <AlertDialog open={request !== null} onOpenChange={(open) => { if (!open) onClose() }}>
    {request && <AlertDialogContent className="planning-approval-dialog">
      <AlertDialogHeader className="planning-approval-dialog__header">
        <span className="planning-approval-dialog__eyebrow">{request.eyebrow ?? 'Confirmación · simulación local'}</span>
        <AlertDialogTitle className="planning-approval-dialog__title">{request.title}</AlertDialogTitle>
        <AlertDialogDescription className="planning-approval-dialog__description">{request.description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="planning-approval-dialog__footer">
        <AlertDialogCancel className="planning-approval-dialog__cancel">Cancelar</AlertDialogCancel>
        <AlertDialogAction className="planning-approval-dialog__confirm"
          onClick={() => { void request.onConfirm(); onClose() }}>{request.confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>}
  </AlertDialog>
}

// One dialog for the panel: `ask` resolves true on confirm and false on cancel or Escape,
// like useConfirm; `request` stays available for callers that pass an onConfirm callback.
// eslint-disable-next-line react-refresh/only-export-components
export function usePlanningApprovalConfirm(): [ReactNode, (request: PlanningApprovalConfirmRequest) => void, (options: ConfirmOptions & { eyebrow?: string }) => Promise<boolean>] {
  const [request, setRequest] = useState<PlanningApprovalConfirmRequest | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)
  const settle = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
  }, [])
  const open = useCallback((next: PlanningApprovalConfirmRequest) => setRequest(next), [])
  const ask = useCallback((options: ConfirmOptions & { eyebrow?: string }) => new Promise<boolean>((resolve) => {
    resolver.current?.(false)
    resolver.current = resolve
    setRequest({ ...options, onConfirm: () => settle(true) })
  }), [settle])
  const element = <PlanningApprovalDialog request={request} onClose={() => { setRequest(null); settle(false) }} />
  return [element, open, ask]
}

// Confirmation built on the shadcn AlertDialog. Escape and "Cancelar" cancel; confirming starts the
// action and closes the dialog in the same event. useConfirm() replaces window.confirm with a promise.
import { useCallback, useRef, useState, type ReactNode } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './AlertDialog'
import { buttonVariants } from './Button'

export type ConfirmRequest = {
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  return (
    <AlertDialog open={request !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      {request && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request.title}</AlertDialogTitle>
            <AlertDialogDescription>{request.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={request.destructive ? buttonVariants({ variant: 'destructive' }) : undefined}
              onClick={() => { void request.onConfirm(); onClose() }}
            >
              {request.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}

export type ConfirmOptions = Omit<ConfirmRequest, 'onConfirm'>

// const [confirmElement, confirm] = useConfirm(); render confirmElement once, then
// `if (!(await confirm({ title, description, confirmLabel }))) return`.
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): [ReactNode, (options: ConfirmOptions) => Promise<boolean>] {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)
  const settle = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
  }, [])
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false)
    resolver.current = resolve
    setRequest({ ...options, onConfirm: () => settle(true) })
  }), [settle])
  const element = <ConfirmDialog request={request} onClose={() => { setRequest(null); settle(false) }} />
  return [element, confirm]
}

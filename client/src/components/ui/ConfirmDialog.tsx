// Confirmation built on the shadcn Dialog. The caller keeps the pending request in state;
// confirming closes the dialog first and then runs the action.
import { Button } from './Button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './Dialog'

export type ConfirmRequest = {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      {request && (
        <DialogContent role="alertdialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{request.title}</DialogTitle>
            <DialogDescription>{request.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={() => { onClose(); void request.onConfirm() }}>{request.confirmLabel}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}

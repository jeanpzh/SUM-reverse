// shadcn/ui Dialog (registry "dialog", default style), adapted: --planning-* tokens through
// @theme inline semantic colors, portal inside .planning-root, no lucide/animate dependencies.
import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentProps, HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { usePlanningPortalContainer } from './planningPortal'
import { CloseIcon } from './CloseIcon'
import { useReturnFocus } from './returnFocus'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

function DialogPortal(props: ComponentProps<typeof DialogPrimitive.Portal>) {
  const container = usePlanningPortalContainer()
  return <DialogPrimitive.Portal container={container} {...props} />
}

function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay className={cn('fixed inset-0 z-[999] bg-overlay', className)} {...props} />
}

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean
}

function DialogContent({ className, children, showCloseButton = true, onOpenAutoFocus, onCloseAutoFocus, ...props }: DialogContentProps) {
  const returnFocus = useReturnFocus(onOpenAutoFocus, onCloseAutoFocus)
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        aria-modal="true"
        className={cn('fixed left-1/2 top-1/2 z-[1000] grid w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto box-border border border-border bg-background p-6 text-foreground shadow-planning rounded-planning-floating', className)}
        {...props}
        {...returnFocus}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close className="absolute right-4 top-4 inline-flex cursor-pointer items-center justify-center rounded-planning-control border-0 bg-transparent p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <CloseIcon />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 pr-8 text-left', className)} {...props} />
}

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('m-0 text-lg font-semibold leading-tight', className)} {...props} />
}

function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('m-0 text-sm text-muted-foreground', className)} {...props} />
}

export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }

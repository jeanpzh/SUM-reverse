// shadcn/ui AlertDialog (registry "alert-dialog", default style), adapted like Dialog.tsx:
// --planning-* semantic utilities, portal inside .planning-root and focus return to the opener.
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import type { ComponentProps, HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { buttonVariants } from './Button'
import { usePlanningPortalContainer } from './planningPortal'
import { useReturnFocus } from './returnFocus'

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger

function AlertDialogPortal(props: ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  const container = usePlanningPortalContainer()
  return <AlertDialogPrimitive.Portal container={container} {...props} />
}

function AlertDialogOverlay({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return <AlertDialogPrimitive.Overlay className={cn('fixed inset-0 z-[999] bg-overlay', className)} {...props} />
}

function AlertDialogContent({ className, onOpenAutoFocus, onCloseAutoFocus, ...props }: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  const returnFocus = useReturnFocus(onOpenAutoFocus, onCloseAutoFocus)
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        className={cn('fixed left-1/2 top-1/2 z-[1000] grid w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto box-border border border-solid border-border bg-background p-6 font-[inherit] text-sm text-foreground shadow-planning rounded-planning-floating', className)}
        {...props}
        {...returnFocus}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
}

function AlertDialogTitle({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title className={cn('m-0 text-lg font-semibold leading-tight', className)} {...props} />
}

function AlertDialogDescription({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description className={cn('m-0 text-sm text-muted-foreground', className)} {...props} />
}

function AlertDialogAction({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return <AlertDialogPrimitive.Action className={cn(buttonVariants(), className)} {...props} />
}

function AlertDialogCancel({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return <AlertDialogPrimitive.Cancel className={cn(buttonVariants({ variant: 'outline' }), className)} {...props} />
}

export {
  AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
}

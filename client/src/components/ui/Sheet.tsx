// shadcn/ui Sheet (registry "sheet", default style), adapted like Dialog.tsx.
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { usePlanningPortalContainer } from './planningPortal'
import { CloseIcon } from './CloseIcon'
import { useReturnFocus } from './returnFocus'

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close

function SheetPortal(props: ComponentProps<typeof SheetPrimitive.Portal>) {
  const container = usePlanningPortalContainer()
  return <SheetPrimitive.Portal container={container} {...props} />
}

function SheetOverlay({ className, ...props }: ComponentProps<typeof SheetPrimitive.Overlay>) {
  return <SheetPrimitive.Overlay className={cn('fixed inset-0 z-[999] bg-overlay', className)} {...props} />
}

const sheetVariants = cva('fixed z-[1000] flex flex-col gap-4 overflow-y-auto box-border bg-background p-6 text-foreground shadow-planning', {
  variants: {
    side: {
      top: 'inset-x-0 top-0 max-h-[85dvh] border-b border-border',
      bottom: 'inset-x-0 bottom-0 max-h-[85dvh] border-t border-border',
      left: 'inset-y-0 left-0 h-dvh w-[min(28rem,90vw)] border-r border-border',
      right: 'inset-y-0 right-0 h-dvh w-[min(28rem,90vw)] border-l border-border',
    },
  },
  defaultVariants: { side: 'right' },
})

interface SheetContentProps extends ComponentProps<typeof SheetPrimitive.Content>, VariantProps<typeof sheetVariants> {
  showCloseButton?: boolean
}

function SheetContent({ side = 'right', className, children, showCloseButton = true, onOpenAutoFocus, onCloseAutoFocus, ...props }: SheetContentProps) {
  const returnFocus = useReturnFocus(onOpenAutoFocus, onCloseAutoFocus)
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content className={cn(sheetVariants({ side }), className)} {...props} {...returnFocus}>
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute right-4 top-4 inline-flex cursor-pointer items-center justify-center rounded-planning-control border-0 bg-transparent p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <CloseIcon />
            <span className="sr-only">Cerrar</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2 pr-8 text-left', className)} {...props} />
}

function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
}

function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('m-0 text-lg font-semibold text-foreground', className)} {...props} />
}

function SheetDescription({ className, ...props }: ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('m-0 text-sm text-muted-foreground', className)} {...props} />
}

export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }

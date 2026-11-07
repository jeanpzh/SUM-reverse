import * as Primitive from '@radix-ui/react-dialog'
import type { ComponentProps } from 'react'
import { usePlanningPortalContainer } from './planningPortal'
import './ui.css'
export const Dialog = Primitive.Root
export const DialogTrigger = Primitive.Trigger
export const DialogClose = Primitive.Close
export const DialogTitle = Primitive.Title
export const DialogDescription = Primitive.Description
export function DialogContent(props: ComponentProps<typeof Primitive.Content>) {
  const container = usePlanningPortalContainer()
  return <Primitive.Portal container={container}><Primitive.Overlay className="planning-ui-overlay"/><Primitive.Content {...props} className={`planning-ui-dialog ${props.className ?? ''}`} /></Primitive.Portal>
}

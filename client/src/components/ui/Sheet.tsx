import * as Primitive from '@radix-ui/react-dialog'
import type { ComponentProps } from 'react'
import { usePlanningPortalContainer } from './planningPortal'
import './ui.css'
export const Sheet = Primitive.Root
export const SheetTrigger = Primitive.Trigger
export const SheetClose = Primitive.Close
export const SheetTitle = Primitive.Title
export const SheetDescription = Primitive.Description
export function SheetContent(props: ComponentProps<typeof Primitive.Content>) {
  const container = usePlanningPortalContainer()
  return <Primitive.Portal container={container}><Primitive.Overlay className="planning-ui-overlay"/><Primitive.Content {...props} className={`planning-ui-sheet ${props.className ?? ''}`} /></Primitive.Portal>
}

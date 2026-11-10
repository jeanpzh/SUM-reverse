import type { ComponentProps } from 'react'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'

export const Collapsible = CollapsiblePrimitive.Root
export function CollapsibleTrigger({ className = '', ...props }: ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return <CollapsiblePrimitive.Trigger className={`planning-disclosure-trigger ${className}`} {...props} />
}
export const CollapsibleContent = CollapsiblePrimitive.Content

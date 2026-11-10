import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return <CheckboxPrimitive.Root data-slot="checkbox" className={cn('peer box-border min-w-0 max-w-full rounded-planning-control border border-solid border-input bg-background font-[inherit] text-sm leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center p-0 align-middle data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground', className)} {...props}>
    <CheckboxPrimitive.Indicator className="group inline-flex items-center justify-center">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-3 group-data-[state=indeterminate]:hidden"><path d="m5 12 4 4L19 6" /></svg>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="hidden size-3 group-data-[state=indeterminate]:block"><path d="M5 12h14" /></svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
}

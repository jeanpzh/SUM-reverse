import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" className={cn('box-border min-w-0 max-w-full rounded-planning-control border border-solid border-input bg-background font-[inherit] text-sm leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 flex h-10 w-full px-3 py-2 file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-muted-foreground', className)} {...props} />
}

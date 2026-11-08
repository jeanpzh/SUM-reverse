import './controls.css'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn('box-border min-w-0 max-w-full rounded-planning-control border border-solid border-input bg-background font-[inherit] text-sm leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 flex min-h-20 w-full px-3 py-2 placeholder:text-muted-foreground', className)} {...props} />
}

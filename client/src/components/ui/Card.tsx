import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('box-border min-w-0 rounded-planning-panel border border-solid border-border bg-background font-[inherit] text-sm text-foreground', className)} {...props} />
}
export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('box-border flex min-w-0 flex-col gap-2 p-4', className)} {...props} />
}
export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('m-0 font-[inherit] text-lg font-semibold leading-6 text-foreground', className)} {...props} />
}
export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('m-0 font-[inherit] text-sm leading-5 text-muted-foreground', className)} {...props} />
}
export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('box-border min-w-0 p-4 pt-0', className)} {...props} />
}
export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('box-border flex min-w-0 flex-wrap items-center gap-2 p-4 pt-0', className)} {...props} />
}

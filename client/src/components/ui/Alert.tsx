import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

const alertVariants = cva('box-border relative min-w-0 w-full rounded-planning-control border border-solid p-4 font-[inherit] text-sm leading-5 [overflow-wrap:anywhere] [&>svg]:size-4', {
  variants: { variant: {
    default: 'border-border bg-background text-foreground',
    warning: 'border-warning/30 bg-warning-surface text-warning',
    destructive: 'border-destructive/30 bg-destructive-surface text-destructive',
  } },
  defaultVariants: { variant: 'default' },
})

// Set role="alert" explicitly for urgent content; routine notices stay quiet.
export function Alert({ className, variant, ...props }: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div className={cn(alertVariants({ variant }), className)} {...props} />
}
export function AlertTitle({ className, ...props }: ComponentProps<'h5'>) {
  return <h5 className={cn('m-0 mb-1 font-[inherit] text-sm font-medium leading-5', className)} {...props} />
}
export function AlertDescription({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('text-sm leading-5 [&_p]:m-0', className)} {...props} />
}

import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

const badgeVariants = cva('box-border inline-flex max-w-full items-center rounded-planning-control border border-solid px-2 py-1 font-[inherit] text-[13px] font-semibold leading-4 whitespace-nowrap', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'border-border bg-transparent text-foreground',
      success: 'border-success/30 bg-success-surface text-success',
      warning: 'border-warning/30 bg-warning-surface text-warning',
      destructive: 'border-destructive/30 bg-destructive-surface text-destructive',
    },
  },
  defaultVariants: { variant: 'default' },
})

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

// eslint-disable-next-line react-refresh/only-export-components
export { badgeVariants }

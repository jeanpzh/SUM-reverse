import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

const buttonVariants = cva('planning-ui-button', { variants: { variant: { default: 'planning-ui-button--primary', secondary: 'planning-ui-button--secondary', outline: 'planning-ui-button--outline', ghost: 'planning-ui-button--ghost', destructive: 'planning-ui-button--destructive' }, size: { default: 'planning-ui-button--default', sm: 'planning-ui-button--sm', lg: 'planning-ui-button--lg', icon: 'planning-ui-button--icon' } }, defaultVariants: { variant: 'default', size: 'default' } })
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean; children?: ReactNode }
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

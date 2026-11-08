import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('box-border bg-transparent font-[inherit] text-[13px] font-medium leading-5 text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-50', className)} {...props} />
}

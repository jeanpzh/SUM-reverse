import './Table.css'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export interface TableProps extends ComponentProps<'table'> {
  /** Long tables: the wrapper scrolls in both axes and the header row stays visible. */
  stickyHeader?: boolean
  /** Extra classes for the scroll wrapper, e.g. a different max-height. */
  containerClassName?: string
}

export function Table({ className, stickyHeader = false, containerClassName, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      data-sticky-header={stickyHeader ? '' : undefined}
      className={cn('relative min-w-0 w-full overflow-auto', stickyHeader && 'max-h-[min(70dvh,40rem)] rounded-planning-panel border border-solid border-border', containerClassName)}
    >
      <table data-slot="table" className={cn('box-border w-full border-collapse border-0 bg-background font-[inherit] text-sm tabular-nums text-foreground', className)} {...props} />
    </div>
  )
}
export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('box-border border-solid border-border font-[inherit] tabular-nums border-0 bg-muted [&_tr]:border-b', className)} {...props} />
}
export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('box-border border-solid border-border font-[inherit] tabular-nums border-0 bg-background [&_tr:last-child]:border-0', className)} {...props} />
}
export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return <tfoot data-slot="table-footer" className={cn('box-border border-solid border-border font-[inherit] tabular-nums border-t bg-muted font-medium', className)} {...props} />
}
export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr data-slot="table-row" className={cn('box-border border-solid border-border font-[inherit] tabular-nums border-b bg-transparent transition-colors hover:bg-muted data-[state=selected]:bg-accent', className)} {...props} />
}
export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return <th data-slot="table-head" className={cn('box-border border-solid border-border font-[inherit] tabular-nums h-10 border-0 border-b bg-muted px-4 text-left align-middle text-[13px] font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0', className)} {...props} />
}
export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn('box-border border-solid border-border font-[inherit] tabular-nums border-0 border-b bg-transparent p-4 align-middle [&:has([role=checkbox])]:pr-0', className)} {...props} />
}
export function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return <caption data-slot="table-caption" className={cn('box-border border-solid border-border font-[inherit] tabular-nums mt-4 border-0 bg-transparent text-sm text-muted-foreground', className)} {...props} />
}

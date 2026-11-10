import './controls.css'
import './NativeSelect.css'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function NativeSelect({ className, size, ...props }: ComponentProps<'select'>) {
  return <div data-slot="native-select-wrapper" className="relative min-w-0 max-w-full">
    <select data-slot="native-select" size={size} className={cn('box-border min-w-0 max-w-full rounded-planning-control border border-solid border-input bg-background font-[inherit] text-sm leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 w-full px-3 py-1', !props.multiple && (!size || size === 1) && 'h-8 appearance-none pr-8', className)} {...props} />
    {!props.multiple && (!size || size === 1) && <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"><path d="m6 9 6 6 6-6" /></svg>}
  </div>
}

export function NativeSelectOption(props: ComponentProps<'option'>) {
  return <option {...props} />
}

export function NativeSelectOptGroup(props: ComponentProps<'optgroup'>) {
  return <optgroup {...props} />
}

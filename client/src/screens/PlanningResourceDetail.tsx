import { useSyncExternalStore, type ReactNode } from 'react'
import { Sheet, SheetContent, SheetTitle } from '../components/ui/Sheet'

const subscribe = (callback: () => void) => {
  const media = window.matchMedia('(max-width: 1023px)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
const isNarrow = () => window.matchMedia('(max-width: 1023px)').matches

export function PlanningResourceDetail({ label, onClose, children }: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const narrow = useSyncExternalStore(subscribe, isNarrow, () => false)
  if (narrow) return <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
    <SheetContent side="bottom" className="academic-resource-workbench__inspector-pane planning-resource-detail-sheet" aria-describedby={undefined} showCloseButton={false}>
      <SheetTitle className="sr-only">{label}</SheetTitle>
      {children}
    </SheetContent>
  </Sheet>
  return <aside className="academic-resource-workbench__inspector-pane" aria-label={label} onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>{children}</aside>
}

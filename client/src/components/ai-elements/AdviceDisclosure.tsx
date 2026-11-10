import type { ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/Collapsible'

// The same disclosure interface is used for sources, limits and execution metadata.
export function AdviceDisclosure({ label, children }: { label: string; children: ReactNode }) {
  return <Collapsible className="normative-advice__details">
    <CollapsibleTrigger className="normative-advice__details-trigger flex w-full items-center text-left">
      <span>{label}</span>
    </CollapsibleTrigger>
    <CollapsibleContent className="normative-advice__details-content">{children}</CollapsibleContent>
  </Collapsible>
}

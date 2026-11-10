import { Maximize2, Minimize2, MessageSquare, X } from 'lucide-react'
import type { PlanningPeriod } from '../data/academicScheduling'
import { Button } from '../components/ui/Button'
import { PlanningNormativeChat } from './PlanningNormativeChat'
import type { NormativeChat } from './useNormativeChat'
import './PlanningContextPanel.css'

export interface PlanningContextPanelProps {
  academicPeriod: PlanningPeriod
  chat: NormativeChat
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onClose: () => void
}

export function PlanningContextPanel({ academicPeriod, chat, expanded, onExpandedChange, onClose }: PlanningContextPanelProps) {
  return (
    <section className="planning-copilot" aria-label="Asistente normativo">
      <header className="planning-copilot__header">
        <span className="planning-copilot__title">
          <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Asistente normativo</span>
        </span>
        <div className="planning-copilot__controls">
          <Button variant="ghost" size="icon" type="button"
            aria-label={expanded ? 'Restaurar tamaño' : 'Expandir al ancho completo'}
            title={expanded ? 'Restaurar tamaño' : 'Expandir al ancho completo'}
            onClick={() => onExpandedChange(!expanded)}>
            {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" type="button" aria-label="Cerrar asistente" title="Cerrar asistente" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </header>
      <div id="planning-chat-body" className="planning-copilot__body">
        <PlanningNormativeChat academicPeriod={academicPeriod} chat={chat} />
      </div>
    </section>
  )
}

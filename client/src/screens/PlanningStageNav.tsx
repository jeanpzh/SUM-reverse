import { Button } from '../components/ui/Button'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { PlanningStage } from '../routes/local.programacion-academica'
import { PLANNING_STAGES } from '../routes/local.programacion-academica'

export interface PlanningStageNavProps {
  currentStage: PlanningStage
}

export function PlanningStageNav({ currentStage }: PlanningStageNavProps): ReactNode {
  return (
    <nav className="planning-stage-nav mb-4 min-w-0 border-0 border-b border-solid border-border" aria-label="Etapas de programación">
      <ol className="planning-stage-nav__list m-0 flex min-w-0 list-none flex-wrap gap-1 p-0">
        {PLANNING_STAGES.map((stage) => {
          const isActive = stage.id === currentStage
          return (
            <li key={stage.id} className="planning-stage-nav__item min-w-0">
              <Button asChild variant="ghost" className={isActive ? 'border-border bg-accent font-semibold' : 'text-muted-foreground'}>
                <Link
                  to="/local/programacion-academica"
                  search={{ etapa: stage.id }}
                  className={`planning-stage-nav__link ${isActive ? 'planning-stage-nav__link--active' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="planning-stage-nav__label">{stage.label}</span>
                </Link>
              </Button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

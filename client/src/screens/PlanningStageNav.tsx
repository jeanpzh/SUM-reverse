import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { PlanningStage } from '../routes/local.programacion-academica'
import { PLANNING_STAGES } from '../routes/local.programacion-academica'

export interface PlanningStageNavProps {
  currentStage: PlanningStage
  nextActionLabel?: string | null
}

export function PlanningStageNav({ currentStage, nextActionLabel }: PlanningStageNavProps): ReactNode {
  return (
    <nav id="planning-tour-stages" className="planning-stage-nav mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-border pb-2" aria-label="Etapas de programación">
      <ol className="planning-stage-nav__list m-0 flex min-w-0 list-none flex-wrap gap-1.5 p-0">
        {PLANNING_STAGES.map((stage, index) => {
          const isActive = stage.id === currentStage
          return (
            <li key={stage.id} className="planning-stage-nav__item min-w-0">
              <Button
                asChild
                variant="ghost"
                className={
                  isActive
                    ? 'border-2 border-primary bg-accent font-semibold text-foreground shadow-xs'
                    : 'border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground'
                }
              >
                <Link
                  to="/local/programacion-academica"
                  search={{ etapa: stage.id }}
                  className={`planning-stage-nav__link ${isActive ? 'planning-stage-nav__link--active' : ''}`}
                  aria-label={stage.label}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span aria-hidden="true" className="tabular-nums">{index + 1}.</span>
                  <span className="planning-stage-nav__label">{stage.label}</span>
                  {isActive && <Badge variant="success" aria-hidden="true" className="ml-0.5 px-1.5 py-0 text-[12px]">Etapa actual</Badge>}
                </Link>
              </Button>
            </li>
          )
        })}
      </ol>
      {nextActionLabel && (
        <div className="planning-stage-nav__next flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground" aria-live="polite">
          <span>Siguiente paso recomendado:</span>
          <Badge variant="success" className="font-semibold">{nextActionLabel}</Badge>
        </div>
      )}
    </nav>
  )
}

import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ArrowRight } from 'lucide-react'
import type { PlanningStage } from '../routes/local.programacion-academica'
import { PLANNING_STAGES } from '../routes/local.programacion-academica'
import { cn } from '../lib/utils'

export interface PlanningStageNavProps {
  currentStage: PlanningStage
  nextActionLabel?: string | null
}

export function PlanningStageNav({ currentStage, nextActionLabel }: PlanningStageNavProps): ReactNode {
  return (
    <nav
      className="planning-stage-nav mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2.5 border-0 border-b border-solid border-border bg-transparent pb-2"
      aria-label="Etapas de programación"
    >
      <ol className="planning-stage-nav__list m-0 flex min-w-0 list-none flex-wrap items-center gap-1 p-0">
        {PLANNING_STAGES.map((stage, index) => {
          const isActive = stage.id === currentStage
          return (
            <li key={stage.id} className="planning-stage-nav__item min-w-0">
              <Button
                asChild
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'h-8 px-3 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-foreground font-semibold border border-border/80 shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <Link
                  to="/local/programacion-academica"
                  search={{ etapa: stage.id }}
                  className={`planning-stage-nav__link ${isActive ? 'planning-stage-nav__link--active' : ''}`}
                  aria-label={stage.label}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span aria-hidden="true" className="mr-1.5 tabular-nums text-muted-foreground font-normal">
                    {index + 1}.
                  </span>
                  <span className="planning-stage-nav__label">{stage.label}</span>
                </Link>
              </Button>
            </li>
          )
        })}
      </ol>

      {nextActionLabel && (
        <div
          className="planning-stage-nav__next flex min-w-0 items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <span className="hidden sm:inline">Siguiente paso:</span>
          <Badge
            variant="outline"
            className="font-medium text-foreground border-border bg-accent/40 gap-1 text-xs"
          >
            <span>{nextActionLabel}</span>
            <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
          </Badge>
        </div>
      )}
    </nav>
  )
}

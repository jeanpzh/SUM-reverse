import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { PlanningStage } from '../routes/local.programacion-academica'
import { PLANNING_STAGES } from '../routes/local.programacion-academica'

export interface PlanningStageNavProps {
  currentStage: PlanningStage
}

export function PlanningStageNav({ currentStage }: PlanningStageNavProps): ReactNode {
  return (
    <nav className="planning-stage-nav" aria-label="Etapas de programación">
      <ol className="planning-stage-nav__list">
        {PLANNING_STAGES.map((stage) => {
          const isActive = stage.id === currentStage
          return (
            <li key={stage.id} className="planning-stage-nav__item">
              <Link
                to="/local/programacion-academica"
                search={{ etapa: stage.id }}
                className={`planning-stage-nav__link ${isActive ? 'planning-stage-nav__link--active' : ''}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="planning-stage-nav__label">{stage.label}</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

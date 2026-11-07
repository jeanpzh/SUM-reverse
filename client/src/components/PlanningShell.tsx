import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import './PlanningShell.css'

export function PlanningShell({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="planning-root">
      <nav className="planning-rail" aria-label="Programación académica">
        <div className="planning-rail__brand">
          <span className="planning-rail__product">Programación</span>
        </div>
        <div className="planning-rail__nav">
          <Link
            to="/local/programacion-academica"
            className="planning-rail__item planning-rail__item--active"
            aria-current="page"
          >
            Programaciones
          </Link>
        </div>
        <div className="planning-rail__footer">
          <Link
            to="/local/modulos"
            className="planning-rail__back"
          >
            ← Módulos locales
          </Link>
        </div>
      </nav>
      <main className="planning-main">
        {children}
      </main>
    </div>
  )
}

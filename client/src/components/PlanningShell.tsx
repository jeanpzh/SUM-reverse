import { useEffect, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { PlanningPortalContext } from './ui/planningPortal'
import './PlanningShell.css'


export function PlanningShell({ children }: { children: ReactNode }): ReactNode {
  const [mode, setMode] = useState<'light' | 'dark' | 'system'>(() => {
    try { const value = localStorage.getItem('planning-theme'); return value === 'light' || value === 'dark' ? value : 'system' } catch { return 'system' }
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  const [portal, setPortal] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => { try { localStorage.setItem('planning-theme', mode) } catch { /* storage may be unavailable */ } }, [mode])
  const theme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode
  return (
    <div className="planning-root" data-theme={theme}>
      <nav className="planning-rail" aria-label="Programación académica">
        <div className="planning-rail__brand"><span className="planning-rail__product">Programación</span></div>
        <div className="planning-rail__nav"><Link to="/local/programacion-academica" className="planning-rail__item">Programaciones</Link></div>
        <div className="planning-rail__footer">
          <label className="planning-theme-label" htmlFor="planning-theme">Tema</label>
          <select id="planning-theme" value={mode} onChange={event => setMode(event.target.value as typeof mode)}>
            <option value="light">Claro</option><option value="dark">Oscuro</option><option value="system">Sistema</option>
          </select>
          <Link to="/local/modulos" className="planning-rail__back">← Módulos locales</Link>
        </div>
      </nav>
      <PlanningPortalContext.Provider value={portal}>
        <main className="planning-main">{children}</main>
        <div className="planning-portal-container" ref={setPortal} />
      </PlanningPortalContext.Provider>
    </div>
  )
}

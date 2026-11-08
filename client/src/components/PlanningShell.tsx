import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from './ui/Button'
import { Label } from './ui/Label'
import { NativeSelect } from './ui/NativeSelect'
import { Toaster } from './ui/Sonner'
import { PlanningPortalContext } from './ui/planningPortal'
import './PlanningShell.css'

type ThemeMode = 'light' | 'dark' | 'system'

const PlanningControlsContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void } | null>(null)

// The shell has a single destination, so it has no navigation rail (user decision, 2026-11-08).
// The theme selector and the way back to the local modules live in the scope header instead.
export function PlanningShellControls(): ReactNode {
  const controls = useContext(PlanningControlsContext)
  if (!controls) return null
  return (
    <div className="planning-shell-controls flex min-w-0 flex-wrap items-center gap-2">
      <Label htmlFor="planning-theme" className="text-[13px] text-muted-foreground">Tema</Label>
      <NativeSelect id="planning-theme" value={controls.mode} onChange={(event) => controls.setMode(event.target.value as ThemeMode)}>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
        <option value="system">Sistema</option>
      </NativeSelect>
      <Button asChild variant="ghost" size="sm">
        <Link to="/local/modulos">← Módulos locales</Link>
      </Button>
    </div>
  )
}

export function PlanningShell({ children }: { children: ReactNode }): ReactNode {
  const [mode, setMode] = useState<ThemeMode>(() => {
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
      <PlanningControlsContext.Provider value={{ mode, setMode }}>
        <PlanningPortalContext.Provider value={portal}>
          <main className="planning-main">{children}</main>
          <div className="planning-portal-container" ref={setPortal} />
          <Toaster theme={theme} />
        </PlanningPortalContext.Provider>
      </PlanningControlsContext.Provider>
    </div>
  )
}

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import {
  LayoutDashboard, BookOpen, Users, CalendarDays, ClipboardCheck, BadgeCheck,
  Check, ArrowLeft,
} from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarRail, useSidebar,
} from './ui/Sidebar'
import { Toaster } from './ui/Sonner'
import { PlanningPortalContext } from './ui/planningPortal'
import { PlanningSessionProvider, usePlanningSessionContext } from './PlanningSessionProvider'
import { ThemeProvider, useTheme, type Theme } from './theme-provider'
import { PlanningScopeBarContext } from './planningSlots'
import type { PlanningStage } from '../routes/local.programacion-academica'
import { derivePlanningProgress, type PlanningPreparationView } from '../data/planningSession'
import './PlanningShell.css'

export type ThemeMode = Theme

interface NavItemConfig {
  id: string
  label: string
  icon: typeof LayoutDashboard
  to: string
  search: { etapa: PlanningStage; vista?: PlanningPreparationView }
  isActive: (stage: PlanningStage, vista: PlanningPreparationView) => boolean
}

const NAV_GROUPS: readonly { stage: PlanningStage; label: string; items: readonly NavItemConfig[] }[] = [
  { stage: 'preparacion', label: 'Preparación', items: [
    {
      id: 'cursos',
      label: 'Oferta de cursos',
      icon: BookOpen,
      to: '/local/programacion-academica',
      search: { etapa: 'preparacion', vista: 'cursos' },
      isActive: (stage, vista) => stage === 'preparacion' && vista !== 'recursos',
    },
    {
      id: 'recursos',
      label: 'Docentes y ambientes',
      icon: Users,
      to: '/local/programacion-academica',
      search: { etapa: 'preparacion', vista: 'recursos' },
      isActive: (stage, vista) => stage === 'preparacion' && vista === 'recursos',
    },
  ] },
  { stage: 'horario', label: 'Programación', items: [
    {
      id: 'horario',
      label: 'Horario',
      icon: CalendarDays,
      to: '/local/programacion-academica',
      search: { etapa: 'horario' },
      isActive: (stage) => stage === 'horario',
    },
    {
      id: 'revision',
      label: 'Revisión docente',
      icon: ClipboardCheck,
      to: '/local/programacion-academica',
      search: { etapa: 'revision' },
      isActive: (stage) => stage === 'revision',
    },
    {
      id: 'aprobacion',
      label: 'Aprobación y publicación',
      icon: BadgeCheck,
      to: '/local/programacion-academica',
      search: { etapa: 'aprobacion' },
      isActive: (stage) => stage === 'aprobacion',
    },
  ] },
]

function PlanningSidebar({ stage, vista }: { stage: PlanningStage; vista: PlanningPreparationView }): ReactNode {
  const { state } = usePlanningSessionContext()
  const progress = derivePlanningProgress(state)
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <Sidebar collapsible="icon" id="planning-tour-nav">
      <nav className="planning-stage-rail" aria-label="Etapas de la propuesta">
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.stage} className={group.label ? undefined : 'py-0'}>
            {group.label && <SidebarGroupLabel>
              <span>{group.label}</span>
            </SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map((item) => {
                const active = item.isActive(stage, vista)
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to} search={item.search} aria-current={active ? 'page' : undefined}
                        onClick={() => { if (isMobile) setOpenMobile(false) }}>
                        <Icon aria-hidden="true" />
                        <span className="planning-sidebar__label">{item.label}</span>
                        {progress[item.search.etapa] === 'done' && <span className="planning-sidebar__completed group-data-[collapsible=icon]:hidden">
                          <Check className="size-3" aria-hidden="true" /><span className="sr-only">completado</span>
                        </span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <p className="planning-sidebar__provenance group-data-[collapsible=icon]:hidden"
          title="Datos sintéticos. Prototipo local; no es una pantalla oficial SUM.">
          <span aria-hidden="true">Datos sintéticos · local</span>
          <span className="sr-only">Datos sintéticos. Prototipo local; no es una pantalla oficial SUM.</span>
        </p>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Módulos">
              <Link to="/local/modulos" onClick={() => { if (isMobile) setOpenMobile(false) }}>
                <ArrowLeft aria-hidden="true" />
                <span>Módulos</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      </nav>
      <SidebarRail />
    </Sidebar>
  )
}

function PlanningShellContent({ children }: { children: ReactNode }): ReactNode {
  const { theme } = useTheme()
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
  )
  const [scopeBar, setScopeBar] = useState<HTMLDivElement | null>(null)
  const [portal, setPortal] = useState<HTMLDivElement | null>(null)

  // Listen to system theme preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  // Track active router state
  const search = useLocation({
    select: (location) => location.search as { etapa?: PlanningStage; vista?: PlanningPreparationView },
  })
  const stage: PlanningStage = search?.etapa ?? 'preparacion'
  const vista: PlanningPreparationView = search?.vista ?? 'resumen'

  return (
    <div className="planning-root" data-theme={resolvedTheme}>
      <PlanningPortalContext.Provider value={portal}>
        <PlanningSessionProvider>
          <SidebarProvider className="planning-shell-layout" style={{ '--sidebar-width': '216px' } as CSSProperties}>
            <PlanningScopeBarContext.Provider value={scopeBar}>
              <a href="#planning-main-content" className="planning-skip-link">Saltar al contenido principal</a>
              <div className="planning-scope-bar-slot" ref={setScopeBar} />
              <div className="planning-shell-body">
            <PlanningSidebar stage={stage} vista={vista} />
            <SidebarInset className="planning-main-wrapper">
              <main id="planning-main-content" className="planning-main" tabIndex={-1}>
                {children}
              </main>
            </SidebarInset>
            </div>
            </PlanningScopeBarContext.Provider>
          </SidebarProvider>
          <div className="planning-portal-container" ref={setPortal} />
          <Toaster theme={resolvedTheme} />
        </PlanningSessionProvider>
      </PlanningPortalContext.Provider>
    </div>
  )
}

export function PlanningShell({ children }: { children: ReactNode }): ReactNode {
  return (
    <ThemeProvider defaultTheme="light" storageKey="planning-theme">
      <PlanningShellContent>{children}</PlanningShellContent>
    </ThemeProvider>
  )
}

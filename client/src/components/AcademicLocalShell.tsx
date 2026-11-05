import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useLocation } from '@tanstack/react-router'
import { ProfileAwareShell } from './Shell'
import { isAcademicSchedulingRoute, isLocalAcademicArea } from '../data/academicScheduling'
import './AcademicLocalShell.css'

/** Local module routes use a standalone wrapper, leaving the student shell unchanged. */
export function AcademicLocalShell({ children }: { children: ReactNode }): ReactNode {
  const pathname: string = useLocation({ select: (location) => location.pathname })
  if (isLocalAcademicArea(pathname)) return <main className="academic-local-layout">
    {isAcademicSchedulingRoute(pathname) && <Link className="academic-local-layout__back" to="/local/modulos">← Módulos locales</Link>}
    {children}
  </main>
  return <ProfileAwareShell>{children}</ProfileAwareShell>
}

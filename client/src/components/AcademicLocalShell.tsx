import type { ReactNode } from 'react'
import { useLocation } from '@tanstack/react-router'
import { ProfileAwareShell } from './Shell'
import { isAcademicSchedulingRoute, isLocalAcademicArea } from '../data/academicScheduling'
import { PlanningShell } from './PlanningShell'
import './AcademicLocalShell.css'

/** Local module routes use a standalone wrapper, leaving the student shell unchanged. */
export function AcademicLocalShell({ children }: { children: ReactNode }): ReactNode {
  const pathname: string = useLocation({ select: (location) => location.pathname })
  if (isAcademicSchedulingRoute(pathname)) return <PlanningShell>{children}</PlanningShell>
  if (isLocalAcademicArea(pathname)) return <main className="academic-local-layout">
    {children}
  </main>
  return <ProfileAwareShell>{children}</ProfileAwareShell>
}

import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '../components/ui/Button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/Collapsible'
import { PlanningResultStrip } from './PlanningResultStrip'

export interface PlanningPreparationSummaryProps {
  selectedCourses: number
  invalidCourses: number
  teachers: number
  rooms: number
  offerReady: boolean
  catalogCourseCount: number
  onSelectAllCourses: () => void
  selectionDisabled: boolean
  invalidOfferNote?: string
  children?: ReactNode
}

export function PlanningPreparationSummary({ selectedCourses, invalidCourses, teachers, rooms, offerReady,
  catalogCourseCount, onSelectAllCourses, selectionDisabled, invalidOfferNote, children,
}: PlanningPreparationSummaryProps): ReactNode {
  const checks = [
    { text: `${selectedCourses} cursos seleccionados`, ready: selectedCourses > 0, view: 'cursos' },
    { text: invalidCourses ? `${invalidCourses} con datos por corregir` : 'Demanda y capacidad completas', ready: invalidCourses === 0, view: 'cursos' },
    { text: `${teachers} docentes · ${rooms} ambientes`, ready: teachers > 0 && rooms > 0, view: 'recursos' },
  ] as const
  const ready = offerReady && checks.every((check) => check.ready)
  return <PlanningResultStrip ariaLabel="Lista de preparación" status={ready ? 'ready' : 'incomplete'} label={ready ? 'Oferta lista para generar' : 'Oferta incompleta'}
    facts={checks.map((check) => <Link key={check.view + check.text} to="/local/programacion-academica" search={{ etapa: 'preparacion', vista: check.view }}>{check.text}</Link>)}
    action={ready ? <Collapsible className="planning-readiness-disclosure"><CollapsibleTrigger asChild><Button variant="link">Ver resumen</Button></CollapsibleTrigger><CollapsibleContent><ul>{checks.map((check) => <li key={check.text}>✓ {check.text}</li>)}</ul></CollapsibleContent></Collapsible> : null}>
    {!ready && invalidOfferNote && <p className="planning-status-bar__subtext">{invalidOfferNote}</p>}
    {selectedCourses === 0 && catalogCourseCount > 0 && <Button id="planning-tour-primary" className="planning-empty-offer-primary" disabled={selectionDisabled} onClick={onSelectAllCourses}>Seleccionar los {catalogCourseCount} cursos del catálogo</Button>}
    {children}
  </PlanningResultStrip>
}

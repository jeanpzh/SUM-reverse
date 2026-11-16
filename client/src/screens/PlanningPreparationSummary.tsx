import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '../components/ui/Button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/Collapsible'
import './PlanningPreparationSummary.css'

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
    `${selectedCourses} cursos seleccionados`,
    invalidCourses ? `${invalidCourses} con datos por corregir` : 'Demanda y capacidad completas',
    `${teachers} docentes · ${rooms} ambientes`,
  ]
  const ready = offerReady && selectedCourses > 0 && invalidCourses === 0 && teachers > 0 && rooms > 0
  if (selectedCourses === 0 && catalogCourseCount > 0) return <section className="planning-status-bar planning-preparation-empty" data-status="incomplete" aria-label="Lista de preparación">
    <span className="planning-eyebrow">03 · Sin cursos</span>
    <h2>Aún no hay cursos en la oferta</h2>
    <p>El catálogo tiene {catalogCourseCount} cursos para la oferta.</p>
    <Button id="planning-tour-primary" disabled={selectionDisabled} onClick={onSelectAllCourses}>Seleccionar los {catalogCourseCount} cursos del catálogo</Button>
    <p className="planning-preparation-empty__note">Una propuesta vacía no está lista para revisión.</p>
    {children}
  </section>
  return <section className="planning-status-bar planning-preparation-summary" data-status={ready ? 'ready' : 'incomplete'} aria-label="Lista de preparación">
    <div className="planning-status-bar__strip">
      <strong role="status" className="planning-status-bar__state-row">{ready ? '✓ Oferta lista para generar' : '△ Oferta incompleta'}</strong>
      <div className="planning-status-bar__facts">
        <span className="planning-status-bar__fact">{ready ? `${selectedCourses} cursos · demanda y capacidad completas` : checks[0]}</span>
        {!ready && <span className="planning-status-bar__fact"><Link to="/local/programacion-academica" search={{ etapa: 'preparacion', vista: 'cursos' }}>{checks[1]}</Link></span>}
        <span className="planning-status-bar__fact"><Link to="/local/programacion-academica" search={{ etapa: 'preparacion', vista: 'recursos' }}>{checks[2]}</Link></span>
      </div>
      {ready && <Collapsible className="planning-readiness-disclosure planning-status-bar__actions"><CollapsibleTrigger asChild><Button variant="link">Ver resumen</Button></CollapsibleTrigger><CollapsibleContent><ul>{checks.map((check) => <li key={check}>✓ {check}</li>)}</ul></CollapsibleContent></Collapsible>}
    </div>
    {!ready && <p className="planning-preparation-summary__helper">{invalidCourses > 0 ? `Puedes generar ahora; los ${invalidCourses} cursos con datos por corregir quedarán como pendientes con su causa.` : invalidOfferNote ?? 'Completa los recursos de la oferta antes de generar.'}</p>}
    {children}
  </section>
}

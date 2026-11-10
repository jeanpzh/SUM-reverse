import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '../components/ui/Button'
import { CircleCheck, CircleAlert } from 'lucide-react'
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
  children: ReactNode
}


export function PlanningPreparationSummary({
  selectedCourses,
  invalidCourses,
  teachers,
  rooms,
  offerReady,
  catalogCourseCount,
  onSelectAllCourses,
  selectionDisabled,
  invalidOfferNote,
  children,
}: PlanningPreparationSummaryProps): ReactNode {
  const rows = [
    { text: `${selectedCourses} cursos seleccionados`, ready: selectedCourses > 0, action: 'Revisar cursos', view: 'cursos' },
    { text: invalidCourses > 0 ? `${invalidCourses} cursos con datos por corregir` : 'Demanda y capacidad completas', ready: invalidCourses === 0, action: invalidCourses > 0 ? 'Corregir' : null, view: 'cursos' },
    { text: `${teachers} docentes · ${rooms} ambientes`, ready: teachers > 0 && rooms > 0, action: 'Revisar recursos', view: 'recursos' },
    { text: offerReady ? 'Oferta lista para generar' : 'Oferta incompleta', ready: offerReady },
  ] as const

  return (
    <section className="planning-preparation-summary" aria-label="Resumen de preparación">
      <h3 className="planning-preparation-summary__title">Lista de preparación</h3>
      <ul className="planning-preparation-summary__list">
        {rows.map((row) => (
          <li key={row.text} className="planning-preparation-summary__row" data-ready={row.ready}>
            {row.ready ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
            <span>{row.text}</span>
            {'action' in row && row.action && <Button asChild variant="link" size="sm">
              <Link to="/local/programacion-academica" search={{ etapa: 'preparacion', vista: row.view }}>{row.action}</Link>
            </Button>}
          </li>
        ))}
      </ul>
      {invalidOfferNote && <p className="planning-preparation-summary__note">{invalidOfferNote}</p>}
      {selectedCourses === 0 && catalogCourseCount > 0 && (
        <Button type="button" variant="link" disabled={selectionDisabled} onClick={onSelectAllCourses}>
          Seleccionar los {catalogCourseCount} cursos del catálogo
        </Button>
      )}
      <p className="planning-preparation-summary__note">Los cambios quedan en memoria hasta generar o guardar.</p>
      {children}
    </section>
  )
}

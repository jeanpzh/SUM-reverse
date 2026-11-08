import type { ReactNode } from 'react'
import './PlanningPreparationSummary.css'

type Props = {
  selectedCourses: number
  invalidCourses: number
  teachers: number
  rooms: number
  offerReady: boolean
  children: ReactNode
}

export function PlanningPreparationSummary({ selectedCourses, invalidCourses, teachers, rooms, offerReady, children }: Props) {
  return <section className="planning-preparation-summary" aria-labelledby="planning-preparation-summary-title">
    <h2 id="planning-preparation-summary-title">Resumen de preparación</h2>
    <dl className="planning-preparation-summary__counts">
      <div><dt>Cursos seleccionados</dt><dd>{selectedCourses}</dd></div>
      <div><dt>Cursos inválidos</dt><dd>{invalidCourses}</dd></div>
      <div><dt>Docentes</dt><dd>{teachers}</dd></div>
      <div><dt>Ambientes</dt><dd>{rooms}</dd></div>
      <div><dt>Estado de la oferta</dt><dd>{offerReady ? 'Oferta lista' : 'Oferta incompleta'}</dd></div>
    </dl>
    {children}
  </section>
}

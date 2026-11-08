import type { ReactNode } from 'react'
import './PlanningPreparationSummary.css'
import { Card, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

type Props = {
  selectedCourses: number
  invalidCourses: number
  teachers: number
  rooms: number
  offerReady: boolean
  children: ReactNode
}

export function PlanningPreparationSummary({ selectedCourses, invalidCourses, teachers, rooms, offerReady, children }: Props) {
  return <section className="planning-preparation-summary min-w-0 text-foreground" aria-labelledby="planning-preparation-summary-title">
    <h2 className="m-0 mb-4 text-lg font-semibold" id="planning-preparation-summary-title">Resumen de preparación</h2>
    <Card>
      <CardContent className="p-4">
        <dl className="planning-preparation-summary__counts m-0 grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-5 [&>div]:min-w-0 [&>div]:[overflow-wrap:anywhere] [&_dt]:text-[13px] [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:mt-2 [&_dd]:font-semibold [&_dd]:tabular-nums">
          <div><dt>Cursos seleccionados</dt><dd>{selectedCourses}</dd></div>
          <div><dt>Cursos inválidos</dt><dd>{invalidCourses}</dd></div>
          <div><dt>Docentes</dt><dd>{teachers}</dd></div>
          <div><dt>Ambientes</dt><dd>{rooms}</dd></div>
          <div><dt>Estado de la oferta</dt><dd><Badge variant={offerReady ? 'success' : 'warning'}>{offerReady ? 'Oferta lista' : 'Oferta incompleta'}</Badge></dd></div>
        </dl>
      </CardContent>
    </Card>
    {children}
  </section>
}

import type { AcademicAdvisorResponse } from '../../data/academicScheduling'
import { AdviceDisclosure } from './AdviceDisclosure'
import { MessageResponse } from './MessageResponse'

export function AdvisorFindings({ advice }: { advice: AcademicAdvisorResponse }) {
  if (!advice.bottlenecks.length) return <MessageResponse>{advice.summary}</MessageResponse>
  return <section aria-label="Hallazgos de planificación" className="min-w-0 text-sm">
    <h4 className="m-0 text-sm font-semibold">Qué limita la cobertura</h4>
    <ul className="m-0 mt-2 grid list-none gap-2 p-0">
      {advice.bottlenecks.map((item, index) => <li key={`${item.category}-${index}`} className="border-0 border-b border-solid border-border py-2">
        <strong>{item.title}</strong>
        <span className="mt-1 block text-muted-foreground">{item.affectedSessionCount} componentes afectados</span>
        <AdviceDisclosure label={`Ver detalle: ${item.title}`}><p className="m-0">{item.detail}</p></AdviceDisclosure>
      </li>)}
    </ul>
    <AdviceDisclosure label="Ver explicación completa"><MessageResponse>{advice.summary}</MessageResponse></AdviceDisclosure>
  </section>
}

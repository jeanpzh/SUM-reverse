import type { AcademicAdvisorResponse } from '../../data/academicScheduling'
import { AdviceDisclosure } from './AdviceDisclosure'
import { MessageResponse } from './MessageResponse'

export function AdvisorFindings({ advice }: { advice: AcademicAdvisorResponse }) {
  if (!advice.bottlenecks.length) return <MessageResponse>{advice.summary}</MessageResponse>
  return <section aria-label="Hallazgos de planificación" className="planning-findings min-w-0">
    <h4 className="sr-only">Qué limita la cobertura</h4>
    <ol role="list" className="planning-findings__list">
      {advice.bottlenecks.map((item, index) => <li key={`${item.category}-${index}`} className="planning-findings__item">
        <span className="planning-findings__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <span className="min-w-0">
          <strong>{item.title}</strong>: {item.affectedSessionCount} {item.affectedSessionCount === 1 ? 'componente afectado' : 'componentes afectados'}.
          <AdviceDisclosure label={`Ver detalle: ${item.title}`}><p className="m-0">{item.detail}</p></AdviceDisclosure>
        </span>
      </li>)}
    </ol>
    <AdviceDisclosure label="Ver explicación completa"><MessageResponse>{advice.summary}</MessageResponse></AdviceDisclosure>
  </section>
}

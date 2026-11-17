import type { AcademicAdvisorResponse } from '../../data/academicScheduling'
import { AdviceDisclosure } from './AdviceDisclosure'
import { MessageResponse } from './MessageResponse'

export function AdvisorFindings({ advice }: { advice: AcademicAdvisorResponse }) {
  if (!advice.bottlenecks.length) return <MessageResponse>{advice.summary}</MessageResponse>
  return <section aria-label="Hallazgos de planificación" className="planning-findings min-w-0">
    <h4 className="sr-only">Qué limita la cobertura</h4>
    <ul className="planning-findings__list">
      {advice.bottlenecks.map((item, index) => <li key={`${item.category}-${index}`} className="planning-findings__item">
        <span className="planning-findings__index">{item.affectedSessionCount}<span className="sr-only"> componentes afectados:</span></span>
        <span className="min-w-0">{item.title}</span>
      </li>)}
    </ul>
    <AdviceDisclosure label="Ver evidencia y motivos">
      <p>Las señales pueden afectar a una misma sesión; sus cifras no se suman.</p>
      {advice.bottlenecks.map((item, index) => <div key={`${item.category}-${index}`}>
        <h4>{item.title}</h4>
        <p>{item.detail}</p>
      </div>)}
    </AdviceDisclosure>
  </section>
}

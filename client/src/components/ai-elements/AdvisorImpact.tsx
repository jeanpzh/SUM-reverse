import type { AcademicAdvisorResponse } from '../../data/academicScheduling'
import { AdviceDisclosure } from './AdviceDisclosure'

export function AdvisorImpact({ impact }: { impact: AcademicAdvisorResponse['verifiedImpact'] }) {
  if (!impact) return <div role="status" className="planning-impact" data-advisor-impact="pending">
    <p className="m-0">Sin vista previa vigente para esta selección.</p>
  </div>
  return <section role="status" aria-live="polite" aria-label="Impacto de la selección" className="planning-impact min-w-0" data-advisor-impact="verified">
    <h4 className="planning-impact__title">Simulación verificada en CP-SAT</h4>
    <table className="planning-impact__table">
      <caption className="sr-only">Cobertura actual y simulada para la selección vigente</caption>
      <thead><tr>
        <th scope="col">Cobertura</th>
        <th scope="col">Actual</th>
        <th scope="col">Simulada</th>
      </tr></thead>
      <tbody>
        <tr><th scope="row">Secciones completas</th>
          <td>{impact.currentCompleteSections}/{impact.totalSections}</td>
          <td data-projected>{impact.projectedCompleteSections}/{impact.totalSections}</td></tr>
        <tr><th scope="row">Componentes asignados</th>
          <td>{impact.currentScheduledSessions}/{impact.requiredSessions}</td>
          <td data-projected>{impact.projectedScheduledSessions}/{impact.requiredSessions}</td></tr>
      </tbody>
    </table>
    <p className="planning-impact__note">{impact.solverStatus === 'search-limit' ? 'Búsqueda inconclusa: se alcanzó el límite de simulación.'
      : impact.solverStatus === 'impossible' ? 'La simulación no encontró una solución completa con estas condiciones.' : 'La simulación completó la cobertura.'}</p>
    <AdviceDisclosure label="Alcance de la simulación">
      <p className="m-0">Resultado para esta selección y versión. La regeneración realiza una nueva búsqueda y puede obtener otra cobertura.</p>
    </AdviceDisclosure>
  </section>
}

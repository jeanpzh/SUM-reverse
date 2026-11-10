import type { AcademicAdvisorResponse } from '../../data/academicScheduling'
import { AdviceDisclosure } from './AdviceDisclosure'

export function AdvisorImpact({ impact }: { impact: AcademicAdvisorResponse['verifiedImpact'] }) {
  if (!impact) return <div role="status" className="border border-solid border-border p-3 text-sm" data-advisor-impact="pending">
    <p className="m-0">Sin vista previa vigente para esta selección.</p>
  </div>
  return <section role="status" aria-live="polite" aria-label="Impacto de la selección" className="min-w-0 border border-solid border-border p-3 text-sm" data-advisor-impact="verified">
    <h4 className="m-0 mb-3 text-sm font-semibold">Simulación verificada en CP-SAT</h4>
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">Cobertura actual y simulada para la selección vigente</caption>
      <thead><tr className="border-0 border-b border-solid border-border">
        <th scope="col" className="py-2 pr-2 font-medium">Cobertura</th>
        <th scope="col" className="px-2 py-2 text-right font-medium">Actual</th>
        <th scope="col" className="py-2 pl-2 text-right font-medium">Simulada</th>
      </tr></thead>
      <tbody>
        <tr><th scope="row" className="py-2 pr-2 font-normal">Secciones completas</th>
          <td className="px-2 py-2 text-right tabular-nums">{impact.currentCompleteSections}/{impact.totalSections}</td>
          <td className="py-2 pl-2 text-right font-semibold tabular-nums">{impact.projectedCompleteSections}/{impact.totalSections}</td></tr>
        <tr><th scope="row" className="py-2 pr-2 font-normal">Componentes asignados</th>
          <td className="px-2 py-2 text-right tabular-nums">{impact.currentScheduledSessions}/{impact.requiredSessions}</td>
          <td className="py-2 pl-2 text-right font-semibold tabular-nums">{impact.projectedScheduledSessions}/{impact.requiredSessions}</td></tr>
      </tbody>
    </table>
    <p className="mb-0 text-muted-foreground">{impact.solverStatus === 'search-limit' ? 'Búsqueda inconclusa: se alcanzó el límite de simulación.'
      : impact.solverStatus === 'impossible' ? 'La simulación no encontró una solución completa con estas condiciones.' : 'La simulación completó la cobertura.'}</p>
    <AdviceDisclosure label="Alcance de la simulación">
      <p className="m-0">Resultado para esta selección y versión. La regeneración realiza una nueva búsqueda y puede obtener otra cobertura.</p>
    </AdviceDisclosure>
  </section>
}

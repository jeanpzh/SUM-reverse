import type { AdvisorOutcome as Outcome } from '../../data/advisorOutcome'

const delta = (after: number, before: number) => `${after - before > 0 ? '+' : ''}${after - before}`

export function AdvisorOutcome({ outcome }: { outcome: Outcome }) {
  const pending = outcome.requiredComponents - outcome.after.components
  return <section role="status" aria-label="Resultado de las recomendaciones" data-advisor-outcome
    className="planning-outcome">
    <h3 className="planning-outcome__title">Resultado de aplicar {outcome.recommendationCount} {outcome.recommendationCount === 1 ? 'recomendación' : 'recomendaciones'}</h3>
    <dl className="planning-outcome__facts">
      <div><dt>Componentes asignados</dt>
        <dd>{outcome.before.components} → {outcome.after.components}/{outcome.requiredComponents} ({delta(outcome.after.components, outcome.before.components)})</dd></div>
      <div><dt>Secciones completas</dt>
        <dd>{outcome.before.completeSections} → {outcome.after.completeSections}/{outcome.totalSections} ({delta(outcome.after.completeSections, outcome.before.completeSections)})</dd></div>
    </dl>
    <p className="planning-outcome__note">Cobertura obtenida en esta regeneración. {pending === 0 ? 'Sin componentes pendientes.' : pending === 1 ? 'Queda 1 componente pendiente.' : `Quedan ${pending} componentes pendientes.`}</p>
  </section>
}

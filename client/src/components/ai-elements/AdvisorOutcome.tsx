import type { AdvisorOutcome as Outcome } from '../../data/advisorOutcome'

const delta = (after: number, before: number) => `${after - before > 0 ? '+' : ''}${after - before}`

export function AdvisorOutcome({ outcome }: { outcome: Outcome }) {
  const pending = outcome.requiredComponents - outcome.after.components
  return <section role="status" aria-label="Resultado de las recomendaciones" data-advisor-outcome
    className="my-3 min-w-0 rounded-md border border-solid border-border p-3 text-sm">
    <h3 className="m-0 text-sm font-semibold">Resultado de aplicar {outcome.recommendationCount} {outcome.recommendationCount === 1 ? 'recomendación' : 'recomendaciones'}</h3>
    <dl className="my-2 grid gap-2">
      <div className="flex flex-wrap justify-between gap-x-3"><dt>Componentes asignados</dt>
        <dd className="m-0 tabular-nums">{outcome.before.components} → {outcome.after.components}/{outcome.requiredComponents} ({delta(outcome.after.components, outcome.before.components)})</dd></div>
      <div className="flex flex-wrap justify-between gap-x-3"><dt>Secciones completas</dt>
        <dd className="m-0 tabular-nums">{outcome.before.completeSections} → {outcome.after.completeSections}/{outcome.totalSections} ({delta(outcome.after.completeSections, outcome.before.completeSections)})</dd></div>
    </dl>
    <p className="m-0 text-muted-foreground">Cobertura obtenida en esta regeneración. {pending === 0 ? 'Sin componentes pendientes.' : pending === 1 ? 'Queda 1 componente pendiente.' : `Quedan ${pending} componentes pendientes.`}</p>
  </section>
}

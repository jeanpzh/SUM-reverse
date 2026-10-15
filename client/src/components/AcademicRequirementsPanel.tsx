import type { ReactNode } from 'react'
import type {
  MatriculaRegularContext,
  MatriculaRegularOutcome,
} from '../../../shared/matricula-regular.mjs'
import {
  buildAcademicRequirementsViewModel,
} from '../data/academicRequirements'
import './AcademicRequirementsPanel.css'

export interface AcademicRequirementsPanelProps {
  context: MatriculaRegularContext
  outcome?: MatriculaRegularOutcome | null
}

export function AcademicRequirementsPanel({
  context,
  outcome,
}: AcademicRequirementsPanelProps): ReactNode {
  const vm = buildAcademicRequirementsViewModel(context, outcome)

  return (
    <section
      className="academic-requirements-panel"
      aria-labelledby="academic-requirements-title"
    >
      <header className="academic-requirements-panel__header">
        <h3
          id="academic-requirements-title"
          className="academic-requirements-panel__title"
        >
          Requisitos Académicos y Condiciones de Matrícula
        </h3>
        <p className="academic-requirements-panel__subtitle">
          Evaluación de condiciones normativas, límites de carga académica y fuentes aplicables para el periodo {vm.period}.
        </p>
      </header>

      <div className="academic-requirements-panel__meta-bar">
        <div className="academic-requirements-panel__scope-info">
          <span className="academic-requirements-panel__scope-item">
            Escuela: <strong>{vm.schoolId}</strong>
          </span>
          <span className="academic-requirements-panel__scope-item">
            Plan: <strong>{vm.planId}</strong>
          </span>
          <span className="academic-requirements-panel__scope-item">
            Periodo: <strong>{vm.period}</strong>
          </span>
        </div>

        <span
          className={`academic-requirements-panel__badge academic-requirements-panel__badge--${vm.statusBadge.variant}`}
          aria-label={vm.statusBadge.ariaLabel}
        >
          {vm.statusBadge.label}
        </span>
      </div>

      <div className="academic-requirements-panel__status-description">
        {vm.statusBadge.description}
      </div>

      {vm.hasUnmetConditions && (
        <div className="academic-requirements-panel__section" role="region" aria-labelledby="causes-heading">
          <h4 id="causes-heading" className="academic-requirements-panel__section-title">
            Condiciones y Causas de No Conformidad Identificadas ({vm.causes.length})
          </h4>
          <ul className="academic-requirements-panel__causes-list">
            {vm.causes.map((cause) => (
              <li key={cause.code} className="academic-requirements-panel__cause-card">
                <div className="academic-requirements-panel__card-title">{cause.title}</div>
                <p className="academic-requirements-panel__card-desc">{cause.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!vm.hasUnmetConditions && !vm.hasPendingGaps && (
        <div className="academic-requirements-panel__empty-msg" role="status">
          No se registran causas de inhabilitación ni impedimentos normativos en el contexto actual.
        </div>
      )}

      {vm.hasPendingGaps && (
        <div
          className="academic-requirements-panel__section"
          role="status"
          aria-live="polite"
          aria-labelledby="gaps-heading"
        >
          <h4 id="gaps-heading" className="academic-requirements-panel__section-title">
            Brechas de Información Pendientes de Configuración ({vm.gaps.length})
          </h4>
          <ul className="academic-requirements-panel__gaps-list">
            {vm.gaps.map((gap) => (
              <li key={gap.code} className="academic-requirements-panel__gap-card">
                <div className="academic-requirements-panel__card-title">{gap.title}</div>
                <p className="academic-requirements-panel__card-desc">{gap.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {vm.sources.length > 0 && (
        <div className="academic-requirements-panel__section">
          <h4 className="academic-requirements-panel__section-title">
            Fuentes Normativas y Trazabilidad Documental
          </h4>
          <div className="academic-requirements-panel__table-wrapper">
            <table className="academic-requirements-panel__sources-table">
              <thead>
                <tr>
                  <th>Fuente</th>
                  <th>Origen</th>
                  <th>Clasificación</th>
                  <th>Referencia</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {vm.sources.map((source) => (
                  <tr key={source.id}>
                    <td><strong>{source.id}</strong></td>
                    <td>{source.originLabel}</td>
                    <td>{source.classLabel}</td>
                    <td>{source.reference}</td>
                    <td>{source.date}</td>
                    <td>{source.statusLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <footer className="academic-requirements-panel__disclaimer">
        Nota local: Las condiciones de matrícula y requisitos académicos se evalúan en el servidor al enviar la solicitud.
        Este panel presenta el estado del contexto académico y sus fuentes documentadas; no constituye registro de matrícula
        ni aprueba requisitos por omisión.
      </footer>
    </section>
  )
}

import { Link } from '@tanstack/react-router'
import { AcademicRequirementsPanel } from '../components/AcademicRequirementsPanel'
import { PageTitle } from '../components/Common'
import { EnrollmentCalendarPanel } from '../components/EnrollmentCalendarPanel'
import { PreEnrollmentPanel } from '../components/PreEnrollmentPanel'
import { buildEnrollmentStatus, SUM_ENROLLMENT_INFO } from '../data/sumEnrollmentFormat'
import type { MatriculaRegularContext, MatriculaRegularEnrollmentReport } from '../../../shared/matricula-regular.mjs'
import './MatriculaInfoSum.css'

/** O-UI-01 (#30) / V-01 (#31) for the synthetic profile. Local verification panels stay collapsed below. */
export function MatriculaInfoSum({ context, report }: {
  context: MatriculaRegularContext
  report: MatriculaRegularEnrollmentReport | null
}) {
  const status = buildEnrollmentStatus(context, report)
  return (
    <div className="matricula-info-sum">
      <PageTitle>Información de Matrícula</PageTitle>
      <div className="matricula-info-sum__grid">
        <section className="matricula-info-sum__card" aria-labelledby="matricula-info-sum-intro">
          <h3 id="matricula-info-sum-intro" className="matricula-info-sum__intro">{SUM_ENROLLMENT_INFO.introduccion}</h3>
          <ol className="matricula-info-sum__sections">
            {SUM_ENROLLMENT_INFO.secciones.map((section, index) => (
              <li key={section.titulo}>
                <h4>{index + 1}. {section.titulo}</h4>
                <p>{section.parts.map((part, partIndex) => part.strong
                  ? <strong key={partIndex}>{part.text}</strong>
                  : <span key={partIndex}>{part.text}</span>)}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="matricula-info-sum__card" aria-label="Estado de matrícula">
          <p className={`matricula-info-sum__banner matricula-info-sum__banner--${status.enabled ? 'enabled' : 'disabled'}`}
            role="status">{status.banner}</p>
          <dl className="matricula-info-sum__tiles">
            <div><dt>Periodo Académico</dt><dd>{status.period}</dd></div>
            <div><dt>Fecha del Sistema</dt><dd>{status.systemDate}</dd></div>
            <div><dt>Inicio de Matrícula</dt><dd>{status.start}</dd></div>
            <div><dt>Fin de Matrícula</dt><dd>{status.end}</dd></div>
          </dl>
          {status.enrolled && (
            <p className="matricula-info-sum__registered">
              Usted registra matrícula en el presente semestre{' '}
              <Link to="/alumnoWebSum/v2/reportes/matricula">Ver Matrícula</Link>
            </p>
          )}
          {status.canStart && (
            <Link className="matricula-info-sum__start" to="/local/matricula-regular">Iniciar Matrícula</Link>
          )}
        </section>
      </div>
      <details className="matricula-info-sum__local">
        <summary>Detalle local de verificación (no forma parte de la interfaz SUM)</summary>
        <PreEnrollmentPanel context={context} />
        <EnrollmentCalendarPanel calendar={context.calendar} eligibility={context.eligibility}
          sources={context.sources} serverNow={context.serverNow} />
        <AcademicRequirementsPanel context={context} />
      </details>
    </div>
  )
}

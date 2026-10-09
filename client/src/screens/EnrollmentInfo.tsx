import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { PageTitle } from '../components/Common'
import { toEnrollmentArticle } from '../data/adapters'
import type { ApiResponseMap } from '../data/contracts'
import { isRawMatriculaInformacion } from '../data/matriculaInformacion'
import './EnrollmentInfo.css'

function EnrollmentMessage({ message }: { message: string }) {
  const parts: ReactNode[] = []
  let previousEnd = 0
  // Recreate the supplied report link as a local route, without executing HTML.
  const reportLink = /<a\b(?=[^>]*\bid\s*=\s*["']irRepMat["'])[^>]*>([^<]*)<\/a\s*>/gi
  for (const match of message.matchAll(reportLink)) {
    parts.push(message.slice(previousEnd, match.index))
    parts.push(<Link key={match.index} to="/alumnoWebSum/v2/reportes/matricula">
      {match[1].trim() || 'Ver matrícula'}
    </Link>)
    previousEnd = match.index + match[0].length
  }
  parts.push(message.slice(previousEnd))
  return <>{parts}</>
}

export function EnrollmentInfo({ response }: { response: ApiResponseMap['matriculaInfo'] }) {
  const data = response.data
  const article = toEnrollmentArticle(data)
  const raw = isRawMatriculaInformacion(data) ? data : null

  return (
    <div className="screen-matricula-informacion">
      <header className="enrollment-info__header">
        <PageTitle>Información de Matrícula</PageTitle>
        <p className="enrollment-info__subtitle">
          Consulta el estado informado, el cronograma y la orientación del módulo.
        </p>
        <p className="enrollment-info__period">
          <span>Periodo académico</span>
          <strong>{data.codSemestre}</strong>
        </p>
      </header>

      {raw && (
        <div className="enrollment-info__record-grid">
          <section className="enrollment-info__panel" aria-labelledby="enrollment-info-status-title">
            <h3 className="enrollment-info__section-title" id="enrollment-info-status-title">
              Estado de Matrícula
            </h3>
            <dl className="enrollment-info__status-list">
              <div className="enrollment-info__status-message">
                <dt>Mensaje de matrícula</dt>
                <dd>{raw.mensajeMatricula}</dd>
              </div>
              {!raw.indMatHabilitada && (
                <div className="enrollment-info__status-complement">
                  <dt>Información complementaria</dt>
                  <dd><EnrollmentMessage message={raw.mensaje} /></dd>
                </div>
              )}
            </dl>
          </section>

          <section className="enrollment-info__panel" aria-labelledby="enrollment-info-schedule-title">
            <h3 className="enrollment-info__section-title" id="enrollment-info-schedule-title">
              Cronograma de matrícula
            </h3>
            <dl className="enrollment-info__date-list">
              <div>
                <dt>Fecha del sistema</dt>
                <dd>{raw.fechaDB}</dd>
              </div>
              <div>
                <dt>Inicio de matrícula por Internet</dt>
                <dd>{raw.fecIniMatInternet}</dd>
              </div>
              <div>
                <dt>Fin de matrícula por Internet</dt>
                <dd>{raw.fecFinMatInternet}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {raw && !raw.indMatHabilitada && raw.valProgramacion !== null && (
        <section className="enrollment-info__panel enrollment-info__profile" aria-labelledby="enrollment-info-profile-title">
          <h3 className="enrollment-info__section-title" id="enrollment-info-profile-title">
            Perfil académico
          </h3>
          <dl className="enrollment-info__profile-list">
            <div><dt>Permanencia</dt><dd>{raw.perfil.permanencia}</dd></div>
            <div><dt>Año de ingreso</dt><dd>{raw.perfil.anioIngreso}</dd></div>
            <div><dt>Año de estudio</dt><dd>{raw.perfil.anioEstudio}</dd></div>
            <div><dt>Promedio</dt><dd>{raw.perfil.promedio}</dd></div>
            <div><dt>Situación académica</dt><dd>{raw.perfil.situAcademica}</dd></div>
          </dl>
          <p className="enrollment-info__schedule-note">
            Información de cronograma disponible para esta consulta.
          </p>
        </section>
      )}

      {article ? (
        <section className="enrollment-info__orientation" aria-labelledby="enrollment-info-orientation-title">
          <header className="enrollment-info__orientation-header">
            <p className="enrollment-info__local-note">
              <strong>Orientación local de demostración</strong>
              {raw && <span>; no forma parte de la respuesta del estado académico.</span>}
              {!raw && <span>. Contenido informativo de la réplica local.</span>}
            </p>
            <h3 className="enrollment-info__section-title" id="enrollment-info-orientation-title">
              {article.introduccion}
            </h3>
          </header>

          <div className="enrollment-info__orientation-layout">
            <nav className="enrollment-info__index" aria-label="Índice de orientación local">
              <h4 className="enrollment-info__index-title">En esta orientación</h4>
              <ol>
                {article.secciones.map(({ id, titulo }) => (
                  <li key={id}>
                    <a href={`#matricula-orientacion-${id}`}>{titulo}</a>
                  </li>
                ))}
              </ol>
            </nav>

            <ol className="enrollment-info__sections">
              {article.secciones.map(({ id, titulo, descripcion }) => (
                <li key={id}>
                  <h4 id={`matricula-orientacion-${id}`} tabIndex={-1}>{titulo}</h4>
                  <p>{descripcion}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : (
        <p className="enrollment-info__empty">No hay información de matrícula disponible.</p>
      )}
    </div>
  )
}

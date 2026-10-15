import type { ReactNode } from 'react'
import { DataTable, DownloadButton } from './Common'
import type {
  MatriculaRegularContext,
} from '../../../shared/matricula-regular.mjs'
import {
  formatPreEnrollmentStatus,
  formatPreEnrollmentRows,
  buildPreEnrollmentCsvData,
} from '../data/prematriculaPanel'
import './PreEnrollmentPanel.css'

const TABLE_HEADERS = ['Código', 'Asignatura', 'Créditos', 'Plan']

export interface PreEnrollmentPanelProps {
  context: MatriculaRegularContext
}

export function PreEnrollmentPanel({ context }: PreEnrollmentPanelProps): ReactNode {
  const { preEnrollmentEnabled, preEnrollmentComplete, preEnrollment, actorId } = context
  const status = formatPreEnrollmentStatus(preEnrollmentEnabled)
  const csvData = buildPreEnrollmentCsvData(preEnrollment, actorId)
  const tableRows = formatPreEnrollmentRows(preEnrollment)

  return (
    <section className="pre-enrollment-panel" aria-labelledby="pre-enrollment-title">
      <header className="pre-enrollment-panel__header">
        <div className="pre-enrollment-panel__title-group">
          <h3 id="pre-enrollment-title" className="pre-enrollment-panel__title">
            Documento de Prematrícula (Asignaturas Pendientes)
          </h3>
          <p className="pre-enrollment-panel__subtitle">
            Asignaturas pendientes correspondientes al plan de estudios para preparación de horario.
          </p>
        </div>

        <div className="pre-enrollment-panel__actions">
          {preEnrollment.length > 0 && (
            <DownloadButton
              name={csvData.name}
              headers={csvData.headers}
              rows={csvData.rows}
            />
          )}
        </div>
      </header>

      <div className="pre-enrollment-panel__meta-bar">
        <div className="pre-enrollment-panel__status-item">
          <span className="pre-enrollment-panel__meta-label">Estado de habilitación:</span>
          <span
            className={`pre-enrollment-panel__status-badge pre-enrollment-panel__status-badge--${status.variant}`}
            aria-label={`Habilitación de prematrícula: ${status.label}`}
          >
            {status.label}
          </span>
        </div>

        <div className="pre-enrollment-panel__status-item">
          <span className="pre-enrollment-panel__meta-label">Completitud del documento:</span>
          <span
            className={`pre-enrollment-panel__completeness-badge ${
              preEnrollmentComplete
                ? 'pre-enrollment-panel__completeness-badge--complete'
                : 'pre-enrollment-panel__completeness-badge--incomplete'
            }`}
          >
            {preEnrollmentComplete ? 'Completo' : 'Incompleto (gap: PLAN_OR_OFFER_UNKNOWN)'}
          </span>
        </div>
      </div>

      {!preEnrollmentComplete && (
        <div className="pre-enrollment-panel__warning-banner" role="status" aria-live="polite">
          <p>
            <strong>Aviso de completitud:</strong> La información de prematrícula está marcada como incompleta
            en el contexto académico. No se inventan asignaturas elegibles ni se autoriza selección.
          </p>
        </div>
      )}

      {preEnrollmentComplete && preEnrollment.length === 0 && (
        <div className="pre-enrollment-panel__empty-banner" role="status">
          <p>
            <strong>Documento vacío:</strong> El estudiante no registra asignaturas pendientes en su plan para este periodo.
          </p>
        </div>
      )}

      <div className="pre-enrollment-panel__table-container">
        <DataTable
          headers={TABLE_HEADERS}
          rows={tableRows}
          empty={
            !preEnrollmentComplete
              ? 'Documento incompleto — asignaturas pendientes desconocidas.'
              : 'No hay asignaturas pendientes registradas en este documento.'
          }
          footer={true}
        />
      </div>

      <footer className="pre-enrollment-panel__footer">
        <p className="pre-enrollment-panel__disclaimer">
          Nota local: El archivo CSV generado es un extracto tabular sintético para apoyo en la planificación.
          No representa ni sustituye el reporte oficial ni el documento PDF del SUM.
          La descarga no tiene efectos en la matrícula ni habilita la inscripción por sí misma.
        </p>
      </footer>
    </section>
  )
}

import type { ReactNode } from 'react'
import { DataTable } from './Common'
import type {
  MatriculaRegularCalendar,
  MatriculaRegularEligibility,
  MatriculaRegularSource,
} from '../../../shared/matricula-regular.mjs'
import {
  formatCalendarRows,
  formatEffectiveWindows,
  formatEligibilityState,
  formatSourceClass,
} from '../data/calendarPanel'
import './EnrollmentCalendarPanel.css'

const CALENDAR_HEADERS = ['Fila', 'Grupo', 'Día', 'Inicio', 'Fin', 'PP Mín', 'PP Máx', 'Fuente']
const WINDOWS_HEADERS = ['Ventana', 'Inicio UTC', 'Fin UTC', 'PP Mín', 'Origen', 'Fuentes']
const SOURCES_HEADERS = ['ID', 'Origen', 'Clase', 'Referencia', 'Fecha', 'Estado']

export interface EnrollmentCalendarPanelProps {
  calendar: MatriculaRegularCalendar
  eligibility: MatriculaRegularEligibility
  sources: readonly MatriculaRegularSource[]
  serverNow: string
}

export function EnrollmentCalendarPanel({
  calendar,
  eligibility,
  sources,
  serverNow,
}: EnrollmentCalendarPanelProps): ReactNode {
  const eligibilityStatus = formatEligibilityState(eligibility)
  const publishedTableRows = formatCalendarRows(calendar.publishedRows)
  const effectiveWindowsRows = formatEffectiveWindows(calendar.effectiveWindows)

  const sourcesTableRows = sources.map((s) => [
    s.id,
    s.origin === 'evidence' ? 'Evidencia' : 'Decisión local',
    formatSourceClass(s.class),
    s.reference,
    s.date,
    s.status,
  ])

  return (
    <section className="enrollment-calendar-panel" aria-labelledby="calendar-panel-title">
      <header className="enrollment-calendar-panel__header">
        <h3 id="calendar-panel-title" className="enrollment-calendar-panel__title">
          Calendario de Matrícula y Habilitación por Turno
        </h3>
        <p className="enrollment-calendar-panel__subtitle">
          Cronograma publicado según F6 y ventanas de evaluación sintética independiente.
        </p>
      </header>

      {/* Barra de estado de habilitación del estudiante */}
      <div className="enrollment-calendar-panel__status-bar">
        <div className="enrollment-calendar-panel__status-item">
          <span className="enrollment-calendar-panel__label">Estado actual de acceso:</span>
          <span
            className={`enrollment-calendar-panel__badge enrollment-calendar-panel__badge--${eligibilityStatus.variant}`}
            aria-label={`Estado de habilitación: ${eligibilityStatus.label}`}
          >
            {eligibilityStatus.label}
          </span>
        </div>

        <div className="enrollment-calendar-panel__status-item">
          <span className="enrollment-calendar-panel__label">Hora del servidor (UTC):</span>
          <span className="enrollment-calendar-panel__value">{serverNow}</span>
        </div>

        <div className="enrollment-calendar-panel__status-item">
          <span className="enrollment-calendar-panel__label">Ventana asignada:</span>
          <span className="enrollment-calendar-panel__value">
            {eligibility.windowId ?? 'Ninguna'}
            {eligibility.windowOrigin ? ` (${eligibility.windowOrigin})` : ''}
          </span>
        </div>
      </div>

      {/* Avisos de brecha horaria / gaps normativos */}
      {calendar.unknownDates.length > 0 && (
        <div
          className="enrollment-calendar-panel__gap-banner"
          role="status"
          aria-live="polite"
        >
          <h4 className="enrollment-calendar-panel__gap-title">Aviso de Brecha Horaria (Días 11 y 12 de agosto)</h4>
          <p>
            El cronograma publicado documental (F6) fija fechas pero no especifica franjas horarias operativas para los días{' '}
            <strong>{calendar.unknownDates.join(' y ')}</strong>. No se asumen horarios arbitrarios en el perfil oficial.
          </p>
          <p className="enrollment-calendar-panel__gap-note">
            Las pruebas locales utilizan ventanas de evaluación con procedencia explícita <em>synthetic</em> (L-02),
            completamente aisladas de la transcripción oficial.
          </p>
        </div>
      )}

      {/* Causas de no habilitación (si existen) */}
      {eligibility.causes.length > 0 && (
        <div className="enrollment-calendar-panel__causes-card" role="region" aria-label="Causas de no habilitación">
          <h4 className="enrollment-calendar-panel__causes-title">Causas de restricción de turno:</h4>
          <ul className="enrollment-calendar-panel__causes-list">
            {eligibility.causes.map((cause, idx) => (
              <li key={`${cause.code}-${idx}`}>
                <strong>{cause.code}:</strong> Fuera de la franja horaria permitida o condición insatisfecha según fuentes {cause.sourceIds.join(', ')}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gaps de configuración (si existen) */}
      {eligibility.gaps.length > 0 && (
        <div className="enrollment-calendar-panel__gaps-card" role="region" aria-label="Gaps de configuración">
          <h4 className="enrollment-calendar-panel__gaps-title">Condiciones pendientes de configuración (Gaps):</h4>
          <ul className="enrollment-calendar-panel__gaps-list">
            {eligibility.gaps.map((gap, idx) => (
              <li key={`${gap.code}-${idx}`}>
                <strong>{gap.code}:</strong> Configuración no determinada en fuentes {gap.sourceIds.join(', ')}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabla 1: Calendario publicado F6 (9 filas idénticas) */}
      <div className="enrollment-calendar-panel__section">
        <h4 className="enrollment-calendar-panel__section-heading">
          Calendario Publicado Oficial (F6 — 10 de Agosto de 2026)
        </h4>
        <p className="enrollment-calendar-panel__section-desc">
          Transcripción idéntica de las 9 filas del cuadro F6, conservando grupos repetidos 6 y 7 y rangos de ponderado.
        </p>
        <DataTable
          headers={CALENDAR_HEADERS}
          rows={publishedTableRows}
          empty="No hay filas de calendario publicadas."
          footer={true}
        />
      </div>

      {/* Tabla 2: Ventanas de prueba sintéticas */}
      {calendar.effectiveWindows.length > 0 && (
        <div className="enrollment-calendar-panel__section">
          <h4 className="enrollment-calendar-panel__section-heading">
            Ventanas de Turno Efectivas (Pruebas Sintéticas L-02)
          </h4>
          <p className="enrollment-calendar-panel__section-desc">
            Ventanas configuradas para verificación local (origen synthetic). No modifican la transcripción F6 ni pretenden suplir horarios oficiales.
          </p>
          <DataTable
            headers={WINDOWS_HEADERS}
            rows={effectiveWindowsRows}
            empty="No hay ventanas de evaluación registradas."
            footer={true}
          />
        </div>
      )}

      {/* Tabla 3: Registro de Fuentes y Procedencia */}
      <div className="enrollment-calendar-panel__section">
        <h4 className="enrollment-calendar-panel__section-heading">
          Fuentes Documentales y Procedencia
        </h4>
        <DataTable
          headers={SOURCES_HEADERS}
          rows={sourcesTableRows}
          empty="No hay fuentes registradas."
          footer={true}
        />
      </div>
    </section>
  )
}

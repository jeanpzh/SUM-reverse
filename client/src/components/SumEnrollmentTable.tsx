import { useState } from 'react'
import type { Ref } from 'react'
import type { MatriculaRegularChoice, MatriculaRegularContext, MatriculaRegularId } from '../../../shared/matricula-regular.mjs'
import { buildEnrollmentRows, filterEnrollmentRows, summarizeSelection } from '../data/sumEnrollmentTable'
import './SumEnrollment.css'

function HandIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 24 28" aria-hidden="true">
      <path d="M9 2a2 2 0 0 1 4 0v9l1-.2a2 2 0 0 1 2 1.3l.2.4.6-.2a2 2 0 0 1 2.5 1.4l.1.4a2 2 0 0 1 2.6 1.6V20a8 8 0 0 1-8 8h-1a7 7 0 0 1-6-3.4L3 19a2 2 0 0 1 3.2-2.4L9 19V2z" fill="currentColor" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 12H7L6 9z" fill="currentColor" />
    </svg>
  )
}

/** V-02 notices. The yellow notice is shown only when a mandatory retake exists (gap: unobserved otherwise). */
export function SumEnrollmentNotices({ showMandatoryNotice }: { showMandatoryNotice: boolean }) {
  return (
    <>
      <p className="sum-enrollment__note">
        <span aria-hidden="true">ℹ </span><strong>Nota Importante:</strong> Después de efectuar su matrícula, debe acercarse a la
        Oficina de Matrícula de su facultad para recoger su Reporte Oficial de Matrícula y entregar toda la documentación que haya
        sido especificada por su facultad (constancias, comprobantes de pagos, etc.); de lo contrario, su matrícula será observada.
      </p>
      {showMandatoryNotice && (
        <p className="sum-enrollment__mandatory-note">
          (*) Asignatura Obligatoria por presentar una o más repitencias, Art. 18 Reglamento General de Matrícula.
        </p>
      )}
    </>
  )
}

export interface SumEnrollmentTableProps {
  context: MatriculaRegularContext
  choices: readonly MatriculaRegularChoice[]
  disabled: boolean
  executeDisabled: boolean
  onPick: (courseId: MatriculaRegularId) => void
  onRemove: (courseId: MatriculaRegularId) => void
  onExecute: () => void
  executeRef?: Ref<HTMLButtonElement>
  headingRef?: Ref<HTMLHeadingElement>
}

/** V-02/V-03/V-05: course table, search, totals and «Ejecutar Matrícula». Rules are evaluated by the server on submit. */
export function SumEnrollmentTable({
  context, choices, disabled, executeDisabled, onPick, onRemove, onExecute, executeRef, headingRef,
}: SumEnrollmentTableProps) {
  const [query, setQuery] = useState('')
  const rows = filterEnrollmentRows(buildEnrollmentRows(context, choices), query)
  const summary = summarizeSelection(context, choices)
  return (
    <section className="sum-enrollment__table-card" aria-labelledby="sum-enrollment-heading">
      <h3 id="sum-enrollment-heading" ref={headingRef} tabIndex={-1} className="sr-only">Registro de matrícula</h3>
      <div className="sum-enrollment__search">
        <label>Búsqueda:<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </div>
      <div className="table-overflow">
        <table className="sum-enrollment__table">
          <thead>
            <tr><th>Ciclo</th><th>tipo</th><th>Asignatura</th><th>Créditos</th><th>Sección Elegida</th><th>Elegir Sección</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.courseId} className={row.mandatory ? 'sum-enrollment__row--mandatory' : undefined}
                title={row.mandatory ? 'Matrícula obligatoria' : undefined}>
                <td><span className="sum-enrollment__cycle">{row.cycle}</span></td>
                <td>{row.type}</td>
                <td>{row.subject}</td>
                <td>{row.credits}</td>
                <td>{row.chosenSection ? <span className="sum-enrollment__section-badge">{row.chosenSection}</span> : '--'}</td>
                <td className="sum-enrollment__actions">
                  <button type="button" className="sum-enrollment__pick" disabled={disabled}
                    aria-label={`Elegir sección de ${row.subject}`} onClick={() => onPick(row.courseId)}>
                    <HandIcon />
                  </button>
                  {row.chosenSection && (
                    <button type="button" className="sum-enrollment__remove" disabled={disabled}
                      aria-label={`Quitar sección de ${row.subject}`} onClick={() => onRemove(row.courseId)}>
                      <TrashIcon />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="empty-cell" colSpan={6}>No hay asignaturas disponibles para matrícula.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <dl className="sum-enrollment__totals">
        <div><dt>Tope de créditos:</dt><dd>{summary.creditCap}</dd></div>
        <div><dt>Créditos matriculados:</dt><dd>{summary.credits}</dd></div>
        <div><dt>Asignaturas matriculadas:</dt><dd>{summary.courses}</dd></div>
      </dl>
      <div className="sum-enrollment__execute">
        <button ref={executeRef} type="button" className="sum-enrollment__execute-button" disabled={executeDisabled} onClick={onExecute}>
          Ejecutar Matrícula
        </button>
      </div>
    </section>
  )
}

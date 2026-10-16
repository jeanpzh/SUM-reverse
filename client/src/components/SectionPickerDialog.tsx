import { Fragment, useEffect, useRef, useState } from 'react'
import type { MatriculaRegularId, MatriculaRegularOfferedCourse } from '../../../shared/matricula-regular.mjs'
import { buildSectionOptions } from '../data/sumEnrollmentTable'
import './SumEnrollment.css'

export interface SectionPickerDialogProps {
  course: MatriculaRegularOfferedCourse
  currentSectionId: MatriculaRegularId | null
  onAccept: (sectionId: MatriculaRegularId) => void
  onCancel: () => void
}

/** V-04 «Secciones disponibles». Mount with `key={course.courseId}` while open. «Horarios» expands a row (L-09). */
export function SectionPickerDialog({ course, currentSectionId, onAccept, onCancel }: SectionPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<MatriculaRegularId | null>(currentSectionId)
  const [expanded, setExpanded] = useState<MatriculaRegularId | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  const options = buildSectionOptions(course)
  return (
    <dialog ref={dialogRef} className="course-schedule-dialog sum-section-dialog" aria-labelledby="sum-section-dialog-title"
      onCancel={(event) => { event.preventDefault(); onCancel() }}>
      <header className="course-schedule-dialog__header">
        <h2 id="sum-section-dialog-title">Secciones disponibles</h2>
        <button type="button" className="course-schedule-dialog__close" onClick={onCancel} aria-label="Cerrar secciones disponibles">×</button>
      </header>
      <div className="course-schedule-dialog__body">
        <p className="sum-section-dialog__course"><span>Asignatura</span><strong>{course.courseId} - {course.name}</strong></p>
        <table>
          <thead>
            <tr><th>Horarios</th><th>Sección</th><th>Aula</th><th>Docente</th><th>Matriculados / Vacantes</th><th>Seleccione</th></tr>
          </thead>
          <tbody>
            {options.map((option) => (
              <Fragment key={option.sectionId}>
                <tr>
                  <td>
                    <button type="button" className="sum-section-dialog__schedule-toggle"
                      aria-expanded={expanded === option.sectionId} aria-label={`Ver horarios de la sección ${option.label}`}
                      onClick={() => setExpanded((current) => current === option.sectionId ? null : option.sectionId)}>
                      {expanded === option.sectionId ? '−' : '+'}
                    </button>
                  </td>
                  <td><span className="sum-enrollment__section-badge">{option.label}</span></td>
                  <td>{option.room}</td>
                  <td>{option.teacher}</td>
                  <td>{option.occupancy}</td>
                  <td>
                    <input type="radio" name="sum-section" value={option.sectionId} checked={selected === option.sectionId}
                      aria-label={`Seleccionar sección ${option.label}`} onChange={() => setSelected(option.sectionId)} />
                  </td>
                </tr>
                {expanded === option.sectionId && (
                  <tr><td colSpan={6}>{option.schedule}</td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="sum-section-dialog__actions">
        <button type="button" className="sum-button sum-button--success" disabled={selected === null}
          onClick={() => { if (selected !== null) onAccept(selected) }}>✓ Aceptar</button>
        <button type="button" className="sum-button sum-button--danger" onClick={onCancel}>✕ Cancelar</button>
      </footer>
    </dialog>
  )
}

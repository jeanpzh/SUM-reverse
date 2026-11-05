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

export type SectionPickerRow = { sectionId: string; label: string; room: string; teacher: string; schedule: string; plannedCapacity: number | null; occupancy?: string }
export type SectionPickerPresentationProps = { courseLabel: string; currentSectionId: string | null; rows: SectionPickerRow[]; capacityHeading: string; onAccept: (sectionId: string) => void; onCancel: () => void }

/** Shared picker presentation. E3 keeps its original wrapper, labels and occupancy data. */
export function SectionPickerPresentation({ courseLabel, currentSectionId, rows, capacityHeading, onAccept, onCancel }: SectionPickerPresentationProps) {
  const [selected, setSelected] = useState<string | null>(currentSectionId)
  const [expanded, setExpanded] = useState<string | null>(null)
  return <><PickerRows courseLabel={courseLabel} rows={rows} capacityHeading={capacityHeading}
    selected={selected} expanded={expanded} setSelected={setSelected} setExpanded={setExpanded} />
    <footer className="sum-section-dialog__actions"><button type="button" className="sum-button sum-button--success" disabled={selected === null}
      onClick={() => { if (selected !== null) onAccept(selected) }}>✓ Aceptar</button>
      <button type="button" className="sum-button sum-button--danger" onClick={onCancel}>✕ Cancelar</button></footer></>
}

function PickerRows({ courseLabel, rows, capacityHeading, selected, expanded, setSelected, setExpanded }: {
  courseLabel: string; rows: SectionPickerRow[]; capacityHeading: string
  selected: string | null; expanded: string | null; setSelected: (value: string | null) => void; setExpanded: (value: string | null) => void
}) {
  return <>
    <p className="sum-section-dialog__course"><span>Asignatura</span><strong>{courseLabel}</strong></p>
    <table><thead><tr><th>Horarios</th><th>Sección</th><th>Aula</th><th>Docente</th><th>{capacityHeading}</th><th>Seleccione</th></tr></thead>
      <tbody>{rows.map((option) => <Fragment key={option.sectionId}>
        <tr><td><button type="button" className="sum-section-dialog__schedule-toggle" aria-expanded={expanded === option.sectionId}
          aria-label={`Ver horarios de la sección ${option.label}`} onClick={() => setExpanded(expanded === option.sectionId ? null : option.sectionId)}>{expanded === option.sectionId ? '−' : '+'}</button></td>
          <td><span className="sum-enrollment__section-badge">{option.label}</span></td><td>{option.room}</td><td>{option.teacher}</td>
          <td>{capacityHeading === 'Capacidad planificada' ? option.plannedCapacity ?? '—' : option.occupancy}</td>
          <td><input type="radio" name="sum-section" value={option.sectionId} checked={selected === option.sectionId} aria-label={`Seleccionar sección ${option.label}`}
            onChange={() => setSelected(option.sectionId)} /></td></tr>
        {expanded === option.sectionId && <tr><td colSpan={6}>{option.schedule}</td></tr>}
      </Fragment>)}</tbody></table>
  </>
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
      <div className="course-schedule-dialog__body"><PickerRows courseLabel={`${course.courseId} - ${course.name}`}
        rows={options.map((option) => ({ ...option, plannedCapacity: null }))} capacityHeading="Matriculados / Vacantes"
        selected={selected} expanded={expanded} setSelected={(value) => setSelected(value as MatriculaRegularId | null)}
        setExpanded={(value) => setExpanded(value as MatriculaRegularId | null)} /></div>
      <footer className="sum-section-dialog__actions">
        <button type="button" className="sum-button sum-button--success" disabled={selected === null}
          onClick={() => { if (selected !== null) onAccept(selected) }}>✓ Aceptar</button>
        <button type="button" className="sum-button sum-button--danger" onClick={onCancel}>✕ Cancelar</button>
      </footer>
    </dialog>
  )
}

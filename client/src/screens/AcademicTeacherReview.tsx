import { useMemo, useState } from 'react'
import type { AcademicProposal } from '../data/academicScheduling'
import type { AcademicTeacherReview } from '../../../shared/programacion-academica-api.mjs'
import { academicSectionLabel, aggregateAcademicBlocks, formatAcademicDuration, formatAcademicMinute } from '../data/academicScheduling'
import './AcademicTeacherReview.css'

type Props = {
  review: AcademicTeacherReview | undefined
  proposal: AcademicProposal | null
  draftId: string | null
  draftVersion: number | null
  derivedState: string
  dirty: boolean
  busy: boolean
  error: string | null
  onSubmit: () => void
  onRespond: (teacherId: string, decision: 'conformity' | 'changes-requested', observation: string) => void
}

const statusLabels = { pending: 'Pendiente', conformity: 'Conforme', 'changes-requested': 'Observó cambios', outdated: 'Desactualizado' } as const

export function AcademicTeacherReview({ review, proposal, draftId, draftVersion, derivedState, dirty, busy, error, onSubmit, onRespond }: Props) {
  const [role, setRole] = useState<'school' | 'teacher'>('school')
  const [teacherId, setTeacherId] = useState('')
  const [observation, setObservation] = useState('')
  const [observationTeacherId, setObservationTeacherId] = useState('')
  const teachers = useMemo(() => review?.teachers ?? [], [review])
  const selectedTeacher = teachers.find((teacher) => teacher.teacherId === teacherId) ?? teachers[0]
  const currentObservation = observationTeacherId === selectedTeacher?.teacherId ? observation : selectedTeacher?.observation ?? ''
  const counts = useMemo(() => teachers.reduce((result, teacher) => ({ ...result, [teacher.status]: result[teacher.status] + 1 }),
    { pending: 0, conformity: 0, 'changes-requested': 0, outdated: 0 }), [teachers])
  const blocks = proposal && selectedTeacher ? aggregateAcademicBlocks(proposal).filter((block) => block.teacherId === selectedTeacher.teacherId) : []
  const hasSchedule = Boolean(proposal?.status === 'complete' && proposal.coverageComplete && proposal.assignments.length)
  const enabled = Boolean(draftId && draftVersion && !dirty && !busy)

  return <details className="academic-teacher-review" open={Boolean(review)}>
    <summary>Revisión docente simulada <span>{review ? `Ronda ${review.round}` : 'Sin enviar'}</span></summary>
    <p className="academic-teacher-review__disclaimer">Prototipo local sin autenticación: este selector demuestra una interacción y no concede permisos.</p>
    <div className="academic-teacher-review__toolbar">
      <label>Vista simulada
        <select aria-label="Rol simulado de revisión" value={role} onChange={(event) => setRole(event.currentTarget.value as 'school' | 'teacher')}>
          <option value="school">Escuela</option><option value="teacher">Docente</option>
        </select>
      </label>
      {teachers.length > 0 && <label>Docente
        <select aria-label="Docente de revisión" value={selectedTeacher?.teacherId ?? ''} onChange={(event) => {
          const nextId = event.currentTarget.value
          setTeacherId(nextId)
        }}>
          {teachers.map((teacher) => <option key={teacher.teacherId} value={teacher.teacherId}>{teacher.teacherName} · {statusLabels[teacher.status]}</option>)}
        </select>
      </label>}
      <div className="academic-teacher-review__counts" aria-label="Resumen de revisión">
        <span>Pendientes {counts.pending}</span><span>Observados {counts['changes-requested']}</span>
        <span>Desactualizados {counts.outdated}</span><span>Conformes {counts.conformity}</span>
      </div>
    </div>
    {dirty && <p className="academic-teacher-review__warning" role="status">Revisión guardada, cambios locales pendientes. Guarda el horario antes de enviar o responder; el estado no refleja todavía la edición actual.</p>}
    {review && <p className="academic-teacher-review__state" role="status">Estado de la versión guardada: {derivedState} · versión {draftVersion}</p>}
    {!review && <p className="academic-teacher-review__state">Guarda una propuesta con horario completo para iniciar la revisión.</p>}
    {role === 'school' && <div className="academic-teacher-review__actions">
      <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary"
        disabled={!enabled || !hasSchedule} onClick={onSubmit}>Enviar a revisión</button>
      <button type="button" className="academic-scheduling__text-button" onClick={() => document.querySelector('.academic-scheduling__result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Editar horario</button>
    </div>}
    {selectedTeacher ? <>
      <p className="academic-teacher-review__state">Horario agrupado por bloque · {selectedTeacher.teacherName} · {statusLabels[selectedTeacher.status]}
        {selectedTeacher.decisionVersion !== null && ` · respuesta v${selectedTeacher.decisionVersion} de ronda ${review?.round}`}</p>
      {role === 'school' && selectedTeacher.observation && <p className="academic-teacher-review__observation-readonly"><strong>Observación docente:</strong> {selectedTeacher.observation}</p>}
      {dirty && <p className="academic-teacher-review__warning">La tabla muestra la edición local; la conformidad guardada corresponde al horario anterior.</p>}
      {blocks.length ? <div className="academic-teacher-review__table-wrap"><table><thead><tr><th>Curso</th><th>Sección</th><th>Día</th><th>Horario</th><th>Componentes</th><th>Ambiente</th></tr></thead>
        <tbody>{blocks.map((block) => <tr key={`${block.sectionId}-${block.day}-${block.startMinute}`}>
          <td>{block.courseName}</td><td>{academicSectionLabel(proposal!, block.sectionId)} · {block.capacity ?? '—'}</td><td>{['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][block.day]}</td>
          <td>{formatAcademicMinute(block.startMinute)}–{formatAcademicMinute(block.endMinute)} · {formatAcademicDuration(block.durationMinutes)}</td>
          <td>{block.componentDetails.map((item) => item.type).join(' + ')}</td><td>{block.roomNames.join(', ')}</td>
        </tr>)}</tbody></table></div> : <p className="academic-teacher-review__state">No hay bloques asignados a este docente.</p>}
      {role === 'teacher' && <label className="academic-teacher-review__observation">Observación
        <textarea maxLength={1000} aria-label="Observación docente" value={currentObservation} onChange={(event) => {
          setObservation(event.currentTarget.value)
          setObservationTeacherId(selectedTeacher.teacherId)
        }} />
      </label>}
      {role === 'teacher' && !currentObservation.trim() && <p className="academic-teacher-review__state">Escribe una observación para solicitar cambios; la conformidad puede enviarse sin texto.</p>}
      {role === 'teacher' && <div className="academic-teacher-review__actions">
        <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary" disabled={!enabled || !review || !selectedTeacher || selectedTeacher.status === 'outdated' || !currentObservation.trim()}
          onClick={() => onRespond(selectedTeacher.teacherId, 'changes-requested', currentObservation.trim())}>Solicitar cambios</button>
        <button type="button" className="academic-scheduling__button" disabled={!enabled || !review || !selectedTeacher || selectedTeacher.status === 'outdated'}
          onClick={() => onRespond(selectedTeacher.teacherId, 'conformity', currentObservation.trim())}>Dar conformidad</button>
      </div>}
    </> : null}
    {error && <p className="academic-teacher-review__error" role="alert">{error}</p>}
    {busy && <p className="academic-teacher-review__state" role="status">Actualizando revisión…</p>}
    {review && <details className="academic-teacher-review__history"><summary>Historial ({review.history.length})</summary><ol>
      {review.history.map((event, index) => <li key={`${event.version}-${event.round}-${event.type}-${index}`}>
        <strong>{event.type === 'submitted' ? 'Envío' : event.type === 'invalidated' ? 'Revisión invalidada' : statusLabels[event.decision === 'conformity' ? 'conformity' : 'changes-requested']}</strong>
        <span>Ronda {event.round} · v{event.version} · {new Date(event.at).toLocaleString('es-PE')}</span>
        {event.teacherId && <span>{teachers.find((teacher) => teacher.teacherId === event.teacherId)?.teacherName ?? event.teacherId}</span>}
        {event.observation && <p>{event.observation}</p>}
      </li>)}
    </ol></details>}
  </details>
}

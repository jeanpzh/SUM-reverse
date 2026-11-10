import { useMemo, useState } from 'react'
import { CircleAlert, CircleCheck, Clock } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button, buttonVariants } from '../components/ui/Button'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Label } from '../components/ui/Label'
import { Alert } from '../components/ui/Alert'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table'
import { Textarea } from '../components/ui/Textarea'
import type { AcademicProposal } from '../data/academicScheduling'
import type { AcademicTeacherReview } from '../../../shared/programacion-academica-api.mjs'
import { academicSectionLabel, aggregateAcademicBlocks, formatAcademicDuration, formatAcademicMinute } from '../data/academicScheduling'
import './AcademicTeacherReview.css'

type Props = {
  primaryActionId?: string
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

export function AcademicTeacherReview({ primaryActionId, review, proposal, draftId, draftVersion, derivedState, dirty, busy, error, onSubmit, onRespond }: Props) {
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

  const emptyMessage = !proposal
    ? 'Aún no se envió a revisión. Genera un horario completo y guárdalo para enviarlo.'
    : !hasSchedule ? 'Aún no se envió a revisión. Completa y guarda el horario para enviarlo.'
    : dirty || !draftId || !draftVersion ? 'Aún no se envió a revisión. Guarda el horario completo para enviarlo.'
    : 'El horario está completo y guardado. Ya puedes enviarlo a revisión.'

  return <section className="academic-teacher-review" aria-label="Revisión docente simulada">
    <div className="academic-teacher-review__strip">
      <strong className="academic-teacher-review__status" role="status">
        {!review ? <CircleAlert size={16} aria-hidden="true" /> : derivedState === 'Lista para aprobación' ? <CircleCheck size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
        {review ? derivedState : 'Sin enviar'}
      </strong>
      {review && <>
        <span>{teachers.length} docentes</span><span>{counts.conformity} conformes</span>
        <span>{counts['changes-requested']} con cambios solicitados</span><span>{counts.pending} pendientes</span>
        {counts.outdated > 0 && <span>{counts.outdated} desactualizados</span>}
      </>}
      <small>Revisión simulada{review ? ` · ronda ${review.round} · versión ${draftVersion}` : ''}</small>
    </div>
    {!review && <p className="academic-teacher-review__empty">{emptyMessage}</p>}
    {teachers.length > 0 && <section className="academic-teacher-review__section" aria-labelledby="academic-review-teachers-title">
      <h3 id="academic-review-teachers-title">Docentes</h3>
      <div className="academic-teacher-review__table-wrap"><Table stickyHeader aria-label="Estado de revisión por docente">
        <TableHeader><TableRow><TableHead>Docente</TableHead><TableHead>Estado</TableHead><TableHead>Observación</TableHead><TableHead>Respuesta</TableHead></TableRow></TableHeader>
        <TableBody>{teachers.map((teacher) => <TableRow key={teacher.teacherId} data-teacher-id={teacher.teacherId} data-state={teacher.teacherId === selectedTeacher?.teacherId ? 'selected' : undefined}>
          <TableCell>{teacher.teacherName}</TableCell>
          <TableCell><span className="academic-teacher-review__status">{teacher.status === 'conformity' ? <CircleCheck size={16} aria-hidden="true" /> : teacher.status === 'pending' ? <Clock size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}{statusLabels[teacher.status]}</span></TableCell>
          <TableCell>{teacher.observation || '—'}</TableCell>
          <TableCell><Button type="button" variant="link" size="sm" aria-label={`Registrar respuesta de ${teacher.teacherName}`} aria-controls="academic-review-detail"
            onClick={() => { setTeacherId(teacher.teacherId); setRole('teacher') }}>Registrar respuesta</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
    </section>}
    <div className="academic-teacher-review__toolbar">
      <div className="academic-teacher-review__field"><Label htmlFor="academic-review-role">Vista simulada</Label>
        <NativeSelect id="academic-review-role" aria-label="Rol simulado de revisión" value={role} onChange={(event) => setRole(event.currentTarget.value as 'school' | 'teacher')}>
          <option value="school">Escuela</option><option value="teacher">Docente</option>
        </NativeSelect>
      </div>
      {teachers.length > 0 && <div className="academic-teacher-review__field"><Label htmlFor="academic-review-teacher">Docente</Label>
        <NativeSelect id="academic-review-teacher" aria-label="Docente de revisión" value={selectedTeacher?.teacherId ?? ''} onChange={(event) => {
          const nextId = event.currentTarget.value
          setTeacherId(nextId)
        }}>
          {teachers.map((teacher) => <option key={teacher.teacherId} value={teacher.teacherId}>{teacher.teacherName} · {statusLabels[teacher.status]}</option>)}
        </NativeSelect>
      </div>}
    </div>
    {dirty && review && <p className="academic-teacher-review__warning" role="status">Revisión guardada, cambios locales pendientes. Guarda el horario antes de enviar o responder; el estado no refleja todavía la edición actual.</p>}
    {role === 'school' && <div className="academic-teacher-review__actions">
      {primaryActionId !== 'submit-review' && enabled && hasSchedule && <Button variant="outline" type="button"
        onClick={onSubmit}>Enviar a revisión</Button>}
      <Button variant="ghost" asChild><Link to="/local/programacion-academica" search={{ etapa: 'horario' }}>Editar horario</Link></Button>
    </div>}
    {selectedTeacher ? <section id="academic-review-detail" className="academic-teacher-review__section" aria-label="Detalle de respuesta docente">
      <h3>{selectedTeacher.teacherName}</h3>
      <p className="academic-teacher-review__state">{selectedTeacher.teacherName} · {statusLabels[selectedTeacher.status]}
        {selectedTeacher.decisionVersion !== null && ` · respuesta v${selectedTeacher.decisionVersion} de ronda ${review?.round}`}</p>
      {role === 'school' && selectedTeacher.observation && <p className="academic-teacher-review__observation-readonly"><strong>Observación docente:</strong> {selectedTeacher.observation}</p>}
      {dirty && <p className="academic-teacher-review__warning">La tabla muestra la edición local; la conformidad guardada corresponde al horario anterior.</p>}
      {blocks.length ? <div className="academic-teacher-review__table-wrap"><Table stickyHeader><TableHeader><TableRow><TableHead>Curso</TableHead><TableHead>Sección</TableHead><TableHead>Día</TableHead><TableHead>Horario</TableHead><TableHead>Componentes</TableHead><TableHead>Ambiente</TableHead></TableRow></TableHeader>
        <TableBody>{blocks.map((block) => <TableRow key={`${block.sectionId}-${block.day}-${block.startMinute}`}>
          <TableCell>{block.courseName}</TableCell><TableCell>{academicSectionLabel(proposal!, block.sectionId)} · {block.capacity ?? '—'}</TableCell><TableCell>{['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][block.day]}</TableCell>
          <TableCell>{formatAcademicMinute(block.startMinute)}–{formatAcademicMinute(block.endMinute)} · {formatAcademicDuration(block.durationMinutes)}</TableCell>
          <TableCell>{block.componentDetails.map((item) => item.type).join(' + ')}</TableCell><TableCell>{block.roomNames.join(', ')}</TableCell>
        </TableRow>)}</TableBody></Table></div> : <p className="academic-teacher-review__state">No hay bloques asignados a este docente.</p>}
      {role === 'teacher' && <Label className="academic-teacher-review__observation">Observación
        <Textarea maxLength={1000} aria-label="Observación docente" value={currentObservation} onChange={(event) => {
          setObservation(event.currentTarget.value)
          setObservationTeacherId(selectedTeacher.teacherId)
        }} />
      </Label>}
      {role === 'teacher' && !currentObservation.trim() && <p className="academic-teacher-review__state">Escribe una observación para solicitar cambios; la conformidad puede enviarse sin texto.</p>}
      {role === 'teacher' && <div className="academic-teacher-review__actions">
        <Button variant="outline" type="button" disabled={!enabled || !review || !selectedTeacher || selectedTeacher.status === 'outdated' || !currentObservation.trim()}
          onClick={() => onRespond(selectedTeacher.teacherId, 'changes-requested', currentObservation.trim())}>Solicitar cambios</Button>
        <Button type="button" variant="outline" disabled={!enabled || !review || !selectedTeacher || selectedTeacher.status === 'outdated'}
          onClick={() => onRespond(selectedTeacher.teacherId, 'conformity', currentObservation.trim())}>Dar conformidad</Button>
      </div>}
    </section> : null}
    {error && <Alert variant="destructive" role="alert">{error}</Alert>}
    {busy && <p className="academic-teacher-review__state" role="status">Actualizando revisión…</p>}
    {review && <details className="academic-teacher-review__history"><summary className={`planning-disclosure-trigger ${buttonVariants({ variant: 'ghost' })}`}>Historial ({review.history.length})</summary><ol>
      {review.history.map((event, index) => <li key={`${event.version}-${event.round}-${event.type}-${index}`}>
        <strong>{event.type === 'submitted' ? 'Envío' : event.type === 'invalidated' ? 'Revisión invalidada' : statusLabels[event.decision === 'conformity' ? 'conformity' : 'changes-requested']}</strong>
        <span>Ronda {event.round} · v{event.version} · {new Date(event.at).toLocaleString('es-PE')}</span>
        {event.teacherId && <span>{teachers.find((teacher) => teacher.teacherId === event.teacherId)?.teacherName ?? event.teacherId}</span>}
        {event.observation && <p>{event.observation}</p>}
      </li>)}
    </ol></details>}
    <details>
      <summary className={`planning-disclosure-trigger ${buttonVariants({ variant: 'ghost' })}`}>Alcance de la simulación</summary>
      <p>Prototipo local sin autenticación: este selector demuestra una interacción y no concede permisos.</p>
    </details>
  </section>
}

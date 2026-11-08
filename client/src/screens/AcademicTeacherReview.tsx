import { useMemo, useState } from 'react'
import { Button, buttonVariants } from '../components/ui/Button'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Label } from '../components/ui/Label'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/Collapsible'
import { Alert } from '../components/ui/Alert'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table'
import { Badge } from '../components/ui/Badge'
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
  const [expanded, setExpanded] = useState(Boolean(review))
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

  // Keep native details/summary for verification selectors; Radix owns disclosure state.
  return <Collapsible asChild open={expanded} onOpenChange={setExpanded}>
    <details className="academic-teacher-review" open={expanded}>
      <CollapsibleTrigger asChild>
        <summary onClick={(event) => { event.preventDefault(); setExpanded((value) => !value) }}>Revisión docente simulada <Badge variant="outline">{review ? `Ronda ${review.round}` : 'Sin enviar'}</Badge></summary>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Native details: read-only disclosures stay openable inside the locked fieldset. */}
        <details>
          <summary className={buttonVariants({ variant: 'ghost' })}>Alcance de la simulación</summary>
          <p>Prototipo local sin autenticación: este selector demuestra una interacción y no concede permisos.</p>
        </details>
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
          <div className="academic-teacher-review__counts" aria-label="Resumen de revisión">
            <Badge variant="outline">Pendientes {counts.pending}</Badge><Badge variant="outline">Observados {counts['changes-requested']}</Badge>
            <Badge variant="outline">Desactualizados {counts.outdated}</Badge><Badge variant="outline">Conformes {counts.conformity}</Badge>
          </div>
        </div>
        {dirty && <p className="academic-teacher-review__warning" role="status">Revisión guardada, cambios locales pendientes. Guarda el horario antes de enviar o responder; el estado no refleja todavía la edición actual.</p>}
        {review && <p className="academic-teacher-review__state" role="status">Estado de la versión guardada: {derivedState} · versión {draftVersion}</p>}
        {!review && <p className="academic-teacher-review__state">Guarda una propuesta con horario completo para iniciar la revisión.</p>}
        {role === 'school' && teachers.length > 0 && <p className="academic-teacher-review__state">Para registrar una respuesta, selecciona Docente en Vista simulada.</p>}
        {role === 'school' && <div className="academic-teacher-review__actions">
          <Button variant="outline" type="button"
            disabled={!enabled || !hasSchedule} onClick={onSubmit}>Enviar a revisión</Button>
          <Button variant="ghost" type="button" onClick={() => document.querySelector('.academic-scheduling__result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Editar horario</Button>
        </div>}
        {selectedTeacher ? <>
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
            <Button type="button" variant={primaryActionId === 'record-response' && enabled && review && selectedTeacher && selectedTeacher.status !== 'outdated' ? 'default' : 'outline'} disabled={!enabled || !review || !selectedTeacher || selectedTeacher.status === 'outdated'}
              onClick={() => onRespond(selectedTeacher.teacherId, 'conformity', currentObservation.trim())}>Dar conformidad</Button>
          </div>}
        </> : null}
        {error && <Alert variant="destructive" role="alert">{error}</Alert>}
        {busy && <p className="academic-teacher-review__state" role="status">Actualizando revisión…</p>}
        {review && <details className="academic-teacher-review__history"><summary className={buttonVariants({ variant: 'ghost' })}>Historial ({review.history.length})</summary><ol>
          {review.history.map((event, index) => <li key={`${event.version}-${event.round}-${event.type}-${index}`}>
            <strong>{event.type === 'submitted' ? 'Envío' : event.type === 'invalidated' ? 'Revisión invalidada' : statusLabels[event.decision === 'conformity' ? 'conformity' : 'changes-requested']}</strong>
            <span>Ronda {event.round} · v{event.version} · {new Date(event.at).toLocaleString('es-PE')}</span>
            {event.teacherId && <span>{teachers.find((teacher) => teacher.teacherId === event.teacherId)?.teacherName ?? event.teacherId}</span>}
            {event.observation && <p>{event.observation}</p>}
          </li>)}
        </ol></details>}
      </CollapsibleContent>
    </details>
  </Collapsible>
}

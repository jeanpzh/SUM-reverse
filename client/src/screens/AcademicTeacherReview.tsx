import { createPortal } from 'react-dom'
import { PlanningResultStrip } from './PlanningResultStrip'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import type { AcademicProposal } from '../data/academicScheduling'
import type { AcademicTeacherReview } from '../../../shared/programacion-academica-api.mjs'
import { academicSectionLabel, aggregateAcademicBlocks, formatAcademicMinute } from '../data/academicScheduling'
import { usePlanningSessionContext } from '../components/PlanningSessionProvider'
import './AcademicTeacherReview.css'

type Props = {
  actionContainer?: HTMLElement | null
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
  onRespond: (teacherId: string, decision: 'conformity' | 'changes-requested', observation: string) => Promise<boolean>
}

type ReviewTeacher = AcademicTeacherReview['teachers'][number]
type ReviewStatus = ReviewTeacher['status']

const statusLabels: Record<ReviewStatus, string> = { pending: 'Pendiente', conformity: 'Conforme', 'changes-requested': 'Observó cambios', outdated: 'Desactualizado' }
// Glyph + text: status never relies on color alone (DESIGN-v2 §8). Glyphs follow the Review board.
const statusGlyphs: Record<ReviewStatus, string> = { pending: '·', conformity: '✓', 'changes-requested': '△', outdated: '○' }
// «Los que requieren atención primero».
const attentionRank: Record<ReviewStatus, number> = { 'changes-requested': 0, outdated: 1, pending: 2, conformity: 3 }
const shortDays = ['—', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// «10–12» when both ends fall on the hour (board), «10:30–12:00» otherwise.
function timeRange(start: number, end: number) {
  if (start % 60 === 0 && end % 60 === 0) return `${start / 60}–${end / 60}`
  return `${formatAcademicMinute(start)}–${formatAcademicMinute(end)}`
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

export function AcademicTeacherReview({ actionContainer, primaryActionId, review, proposal, draftId, draftVersion, dirty, busy, error, onSubmit, onRespond }: Props) {
  const { state } = usePlanningSessionContext()
  const sectionRef = useRef<HTMLElement>(null)
  const responseInFlight = useRef(false)
  const [role, setRole] = useState<'school' | 'teacher'>('school')
  const [teacherId, setTeacherId] = useState('')
  const [paneOpen, setPaneOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [observation, setObservation] = useState('')
  const [observationTeacherId, setObservationTeacherId] = useState('')
  const teachers = useMemo(() => review?.teachers ?? [], [review])
  const ordered = useMemo(() => teachers.map((teacher, index) => ({ teacher, index }))
    .sort((a, b) => attentionRank[a.teacher.status] - attentionRank[b.teacher.status] || a.index - b.index)
    .map((item) => item.teacher), [teachers])
  const normalizedQuery = query.trim().toLocaleLowerCase('es')
  const visible = normalizedQuery ? ordered.filter((teacher) => teacher.teacherName.toLocaleLowerCase('es').includes(normalizedQuery)) : ordered
  const selectedTeacher = teachers.find((teacher) => teacher.teacherId === teacherId) ?? ordered[0]
  const currentObservation = observationTeacherId === selectedTeacher?.teacherId ? observation : selectedTeacher?.observation ?? ''
  const counts = useMemo(() => teachers.reduce((result, teacher) => ({ ...result, [teacher.status]: result[teacher.status] + 1 }),
    { pending: 0, conformity: 0, 'changes-requested': 0, outdated: 0 }), [teachers])
  const blocks = proposal && selectedTeacher ? aggregateAcademicBlocks(proposal).filter((block) => block.teacherId === selectedTeacher.teacherId) : []
  const hasSchedule = Boolean(proposal?.status === 'complete' && proposal.coverageComplete && proposal.assignments.length)
  const enabled = Boolean(draftId && draftVersion && !dirty && !busy)
  // A round is open for the saved version while it is in review or already past it (approval, publication).
  const roundOpen = ['in-review', 'ready-for-approval', 'approved', 'published'].includes(state.draft.savedState)
  const canSubmit = !roundOpen && enabled && hasSchedule
  const decisionEvent = (teacher: ReviewTeacher) => review?.history.filter((event) => event.type === 'decision' && event.teacherId === teacher.teacherId).at(-1)
  const responseLabel = (teacher: ReviewTeacher) => {
    if (teacher.decisionVersion === null) return null
    const event = decisionEvent(teacher)
    return `v${teacher.decisionVersion} · ronda ${event?.round ?? review?.round}`
  }

  const emptyMessage = !proposal
    ? 'Aún no se envió a revisión. Genera un horario completo y guárdalo para enviarlo.'
    : !hasSchedule ? 'Aún no se envió a revisión. Completa y guarda el horario para enviarlo.'
    : dirty || !draftId || !draftVersion ? 'Aún no se envió a revisión. Guarda el horario completo para enviarlo.'
    : 'El horario está completo y guardado. Ya puedes enviarlo a revisión.'

  const stripLabel = !review ? 'Sin enviar'
    : counts.pending > 0 ? 'Respuestas pendientes'
    : counts['changes-requested'] > 0 ? 'Cambios solicitados'
    : counts.outdated > 0 ? 'Respuestas desactualizadas'
    : 'Todas conformes'
  const fact = (count: number, text: string) => <><b>{count}</b> {text}</>
  const stripFacts = review ? [
    fact(counts.conformity, counts.conformity === 1 ? 'conforme' : 'conformes'),
    ...(counts['changes-requested'] ? [fact(counts['changes-requested'], counts['changes-requested'] === 1 ? 'observó cambios' : 'observaron cambios')] : []),
    ...(counts.outdated ? [fact(counts.outdated, counts.outdated === 1 ? 'desactualizada' : 'desactualizadas')] : []),
    ...(counts.pending ? [fact(counts.pending, 'sin respuesta')] : []),
  ] : ['Revisión simulada']

  const openTeacher = (id: string, nextRole?: 'school' | 'teacher') => {
    setTeacherId(id)
    setPaneOpen(true)
    if (nextRole) setRole(nextRole)
  }
  const closeDetail = () => {
    const id = selectedTeacher?.teacherId
    setPaneOpen(false)
    if (!id) return
    requestAnimationFrame(() => {
      const row = Array.from(sectionRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-teacher-id]') ?? [])
        .find((item) => item.dataset.teacherId === id)
      row?.querySelector<HTMLButtonElement>('.academic-teacher-review__name')?.focus()
    })
  }
  const respondToFirstPending = () => {
    const pending = ordered.find((teacher) => teacher.status === 'pending')
    if (pending) openTeacher(pending.teacherId)
    setRole('teacher')
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('#academic-review-detail textarea')?.focus())
  }
  const respond = async (decision: 'conformity' | 'changes-requested') => {
    if (responseInFlight.current || busy || !selectedTeacher) return
    responseInFlight.current = true
    try {
      const recorded = await onRespond(selectedTeacher.teacherId, decision, currentObservation.trim())
      if (!recorded) return
      const next = ordered.find((teacher) => teacher.teacherId !== selectedTeacher.teacherId && teacher.status === 'pending')
      if (next) {
        openTeacher(next.teacherId, 'teacher')
        requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('#academic-review-detail textarea')?.focus())
      } else closeDetail()
    } finally {
      responseInFlight.current = false
    }
  }

  const roleControl = <label className="academic-teacher-review__role"><span>Vista simulada</span>
    <select aria-label="Rol simulado de revisión" value={role} onChange={(event) => setRole(event.currentTarget.value as 'school' | 'teacher')}>
      <option value="school">Escuela</option><option value="teacher">Docente</option>
    </select>
  </label>
  const inHead = (node: ReactNode) => actionContainer ? createPortal(node, actionContainer) : node

  return <section ref={sectionRef} className="academic-teacher-review" aria-label="Revisión docente simulada">
    {inHead(roleControl)}
    {actionContainer && primaryActionId === 'record-response' && createPortal(<Button id="planning-tour-primary" onClick={respondToFirstPending}>Registrar respuesta ({counts.pending})</Button>, actionContainer)}
    {actionContainer && canSubmit && primaryActionId !== 'submit-review' && createPortal(<Button type="button" variant="outline" onClick={onSubmit}>Enviar a revisión</Button>, actionContainer)}
    {!actionContainer && canSubmit && primaryActionId !== 'submit-review' && <Button type="button" variant="outline" onClick={onSubmit}>Enviar a revisión</Button>}
    <PlanningResultStrip status={review && teachers.every((teacher) => teacher.status === 'conformity') ? 'ready' : 'incomplete'}
      ariaLabel="Estado de la ronda" label={stripLabel} facts={stripFacts} />
    <p className="academic-teacher-review__note">La vista simulada no otorga permisos: solo cambia qué controles muestra el prototipo. No hay plazos ni escalamiento automático.</p>

    {!review && <p className="academic-teacher-review__empty">{emptyMessage}</p>}
    {dirty && review && <p className="academic-teacher-review__warning" role="status">Revisión guardada, cambios locales pendientes. Guarda el horario antes de enviar o responder; el estado no refleja todavía la edición actual.</p>}
    {error && <div className="academic-teacher-review__alert" role="alert"><span aria-hidden="true">△</span>{error}</div>}
    {busy && <p className="academic-teacher-review__note" role="status">Actualizando revisión…</p>}

    {teachers.length > 0 && <>
      <div className="academic-teacher-review__toolbar">
        <input type="search" aria-label="Buscar docente" placeholder="Buscar docente" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
        <span>{normalizedQuery ? `${visible.length} de ${plural(teachers.length, 'docente', 'docentes')}` : plural(teachers.length, 'docente', 'docentes')} · los que requieren atención primero</span>
      </div>
      <div className="academic-teacher-review__split">
        <div className="academic-teacher-review__table-wrap" role="region" aria-label="Lista de docentes en revisión" tabIndex={0}>
          <table aria-label="Docentes en revisión">
            <thead><tr><th scope="col">Docente</th><th scope="col">Estado</th><th scope="col">Observación</th><th scope="col">Respuesta</th></tr></thead>
            <tbody>{visible.map((teacher) => {
              const selected = paneOpen && teacher.teacherId === selectedTeacher?.teacherId
              const response = responseLabel(teacher)
              return <tr key={teacher.teacherId} data-teacher-id={teacher.teacherId} aria-selected={selected} data-selected={selected || undefined}>
                <td><button type="button" className="academic-teacher-review__name" aria-controls="academic-review-detail" aria-expanded={selected}
                  onClick={() => openTeacher(teacher.teacherId)}>{teacher.teacherName}</button></td>
                <td><span className="academic-teacher-review__status" data-status={teacher.status}><span aria-hidden="true">{statusGlyphs[teacher.status]}</span>{statusLabels[teacher.status]}</span></td>
                <td className={teacher.observation ? 'academic-teacher-review__observation-cell' : 'academic-teacher-review__muted'}>{teacher.observation || '—'}</td>
                <td>{teacher.status === 'pending'
                  ? <button type="button" className="academic-teacher-review__row-action" aria-label={`Registrar respuesta de ${teacher.teacherName}`} aria-controls="academic-review-detail"
                    onClick={() => openTeacher(teacher.teacherId, 'teacher')}>Registrar respuesta</button>
                  : <span className="academic-teacher-review__mono academic-teacher-review__muted">{response ?? '—'}</span>}</td>
              </tr>
            })}
            {visible.length === 0 && <tr><td colSpan={4} className="academic-teacher-review__muted">Ningún docente coincide con la búsqueda.</td></tr>}</tbody>
          </table>
        </div>
        {paneOpen && selectedTeacher && <aside id="academic-review-detail" className="academic-teacher-review__pane" aria-labelledby="academic-review-pane-title">
          <div className="academic-teacher-review__pane-head">
            <div>
              <span className="academic-teacher-review__eyebrow">{selectedTeacher.decisionVersion !== null ? `Respuesta ${responseLabel(selectedTeacher)?.replace(' · ', ' de ')}` : `Sin respuesta · ronda ${review?.round}`}</span>
              <h2 id="academic-review-pane-title">{selectedTeacher.teacherName}</h2>
            </div>
            <button type="button" className="academic-teacher-review__close" aria-label="Cerrar detalle" onClick={closeDetail}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" /></svg>
            </button>
          </div>
          {dirty && <p className="academic-teacher-review__warning">La tabla muestra la edición local; la conformidad guardada corresponde al horario anterior.</p>}
          {role === 'school' && selectedTeacher.observation && <p className="academic-teacher-review__observation-readonly"><span className="academic-teacher-review__eyebrow">Observación docente</span>{selectedTeacher.observation}</p>}
          {blocks.length ? <div className="academic-teacher-review__blocks" role="region" aria-label={`Horario asignado de ${selectedTeacher.teacherName}`} tabIndex={0}>
            <table aria-label={`Bloques de ${selectedTeacher.teacherName}`}>
              <thead><tr><th scope="col">Curso</th><th scope="col">Secc.</th><th scope="col">Día</th><th scope="col">Horario</th><th scope="col">Ambiente</th></tr></thead>
              <tbody>{blocks.map((block) => <tr key={`${block.sectionId}-${block.day}-${block.startMinute}`}>
                <td>{block.courseName}</td>
                <td className="academic-teacher-review__mono">{academicSectionLabel(proposal!, block.sectionId)}</td>
                <td>{shortDays[block.day]}</td>
                <td className="academic-teacher-review__mono">{timeRange(block.startMinute, block.endMinute)}</td>
                <td>{block.roomNames.join(', ')}</td>
              </tr>)}</tbody>
            </table>
          </div> : <p className="academic-teacher-review__small">No hay bloques asignados a este docente.</p>}
          {role === 'school' && selectedTeacher.observation && <p className="academic-teacher-review__small">La observación queda registrada; no se convierte en restricción automáticamente. Ajusta el horario y envía una nueva ronda.</p>}
          {role === 'teacher' && <div className="academic-teacher-review__form">
            <span className="academic-teacher-review__eyebrow">Vista Docente · simulada</span>
            <label className="academic-teacher-review__observation"><span>Observación</span>
              <textarea rows={3} maxLength={1000} aria-label="Observación docente" value={currentObservation} onChange={(event) => {
                setObservation(event.currentTarget.value)
                setObservationTeacherId(selectedTeacher.teacherId)
              }} />
            </label>
            {!currentObservation.trim() && <p className="academic-teacher-review__small">Escribe una observación para solicitar cambios; la conformidad puede enviarse sin texto.</p>}
            <div className="academic-teacher-review__actions">
              <button type="button" className="academic-teacher-review__button" disabled={!enabled || !review || selectedTeacher.status === 'outdated' || (selectedTeacher.status === 'changes-requested' && currentObservation.trim() === selectedTeacher.observation) || !currentObservation.trim()}
                onClick={() => void respond('changes-requested')}>Solicitar cambios</button>
              <button type="button" className="academic-teacher-review__button" disabled={!enabled || !review || selectedTeacher.status === 'outdated' || (selectedTeacher.status === 'conformity' && currentObservation.trim() === selectedTeacher.observation)}
                onClick={() => void respond('conformity')}>Dar conformidad</button>
            </div>
          </div>}
        </aside>}
      </div>
    </>}

    {review && <details className="academic-teacher-review__history"><summary>Historial ({review.history.length})</summary><ol>
      {review.history.map((event, index) => <li key={`${event.version}-${event.round}-${event.type}-${index}`}>
        <strong>{event.type === 'submitted' ? 'Envío' : event.type === 'invalidated' ? 'Revisión invalidada' : statusLabels[event.decision === 'conformity' ? 'conformity' : 'changes-requested']}</strong>
        <span className="academic-teacher-review__muted">Ronda {event.round} · v{event.version} · {new Date(event.at).toLocaleString('es-PE')}</span>
        {event.teacherId && <span>{teachers.find((teacher) => teacher.teacherId === event.teacherId)?.teacherName ?? event.teacherId}</span>}
        {event.observation && <p>{event.observation}</p>}
      </li>)}
    </ol></details>}
  </section>
}

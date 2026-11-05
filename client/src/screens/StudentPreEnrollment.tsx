import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getDataMode, localProfileSessionStore } from '../data/client'
import { fetchPreEnrollmentContext, fetchPreEnrollmentPublication, validatePreEnrollment, savePreEnrollment, buildPreEnrollmentSchedule } from '../data/prematricula'
import type { E2Choice, E2Context, E2Identity, E2PublicationResponse, E2Validation } from '../data/prematricula'
import { academicSectionLabel, isAcademicSchedulingEnabled } from '../data/academicScheduling'
import { chooseSection, removeChoice } from '../data/sumEnrollmentTable'
import { StudentIntentionPanel } from './StudentIntentionPanel'
import { SectionPickerPresentation } from '../components/SectionPickerDialog'
import { WeeklySchedule } from './WeeklySchedule'
import './StudentPreEnrollment.css'

function enabled() {
  return getDataMode() === 'local' && import.meta.env.VITE_SUM_DEVTOOLS === '1'
    && isAcademicSchedulingEnabled({ VITE_SUM_ACADEMIC_SCHEDULING: import.meta.env.VITE_SUM_ACADEMIC_SCHEDULING,
      VITE_SUM_SIMULATOR: import.meta.env.VITE_SUM_SIMULATOR })
}

export function StudentPreEnrollment() {
  const snapshot = useSyncExternalStore(localProfileSessionStore.subscribe, localProfileSessionStore.getSnapshot, localProfileSessionStore.getSnapshot)
  const active = snapshot.status === 'active' ? { runId: snapshot.runId, actorId: snapshot.actorId, sessionId: snapshot.sessionId } : null
  if (!enabled() || !active || (active.actorId !== 'SYN-SIS-A' && active.actorId !== 'SYN-SIS-B')) return null
  const identity: E2Identity = { ...active, actorId: active.actorId as E2Identity['actorId'] }
  return <PreEnrollmentPanel key={`${identity.runId}:${identity.actorId}:${identity.sessionId}`} identity={identity} />
}

function PreEnrollmentPanel({ identity }: { identity: E2Identity }) {
  const [context, setContext] = useState<E2Context | null>(null)
  const [publication, setPublication] = useState<E2PublicationResponse | null>(null)
  const [publicationId, setPublicationId] = useState('')
  const [selection, setSelection] = useState<E2Choice[]>([])
  const [validation, setValidation] = useState<E2Validation | null>(null)
  const [dialogCourse, setDialogCourse] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [apiUnavailable, setApiUnavailable] = useState(false)
  const validationToken = useRef(0)
  const selectionRevision = useRef(0)
  const queryToken = useRef(0)
  const saveToken = useRef(0)
  const queryController = useRef<AbortController | null>(null)
  const saveController = useRef<AbortController | null>(null)
  const { runId, actorId, sessionId } = identity

  useEffect(() => {
    const controller = new AbortController()
    const initialQueryToken = queryToken.current
    const initialSelectionRevision = selectionRevision.current
    const isInitialHydrationCurrent = () => !controller.signal.aborted
      && initialQueryToken === queryToken.current
      && initialSelectionRevision === selectionRevision.current
    const requestIdentity: E2Identity = { runId, actorId, sessionId }
    void fetchPreEnrollmentContext(requestIdentity, fetch, controller.signal).then((value) => {
      setApiUnavailable(false)
      setContext(value)
      const initialPublicationId = value.draft?.publicationId ?? value.publications.currentId ?? ''
      setPublicationId(initialPublicationId)
      setWorkspaceHydrated(value.draft === null)
      if (value.draft) {
        void fetchPreEnrollmentPublication(requestIdentity, value.draft.publicationId, value.academicRevision, fetch, controller.signal).then((publicationValue) => {
          if (isInitialHydrationCurrent()) {
            setPublication(publicationValue)
            setSelection(value.draft!.selection.map((choice) => ({ ...choice })))
            setValidation(value.draftValidation)
            setWorkspaceHydrated(true)
          }
        }).catch((cause: unknown) => { if (isInitialHydrationCurrent()) setError(cause instanceof Error ? cause.message : 'La publicación guardada no está disponible.') })
      }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        const unavailable = !!cause && typeof cause === 'object' && 'status' in cause && cause.status === 403
        setApiUnavailable(unavailable)
        setError(unavailable ? 'La propuesta no está disponible para este escenario local.' : cause instanceof Error ? cause.message : 'No se pudo consultar el borrador local.')
      }
    })
    return () => controller.abort()
  }, [runId, actorId, sessionId])
  useEffect(() => () => { queryToken.current += 1; saveToken.current += 1; queryController.current?.abort(); saveController.current?.abort() }, [])

  useEffect(() => {
    if (!publication || !context) return
    const token = ++validationToken.current
    const requestSelection = selection.map((item) => ({ ...item }))
    const requestIdentity: E2Identity = { runId, actorId, sessionId }
    const controller = new AbortController()
    void validatePreEnrollment(requestIdentity, { publicationId: publication.publication.id, publicationVersion: publication.publication.publicationVersion,
      selection: requestSelection }, context.academicRevision, fetch, controller.signal).then((value) => {
      if (token === validationToken.current) setValidation(value)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted && token === validationToken.current) {
        const unavailable = !!cause && typeof cause === 'object' && 'status' in cause && cause.status === 403
        setApiUnavailable(unavailable)
        setError(unavailable ? 'La propuesta no está disponible para este escenario local.' : cause instanceof Error ? cause.message : 'No se pudo validar la propuesta.')
      }
    })
    return () => controller.abort()
  }, [publication, selection, runId, actorId, sessionId, context])

  const currentPublication = context?.publications.items.find((item) => item.id === context.publications.currentId)
  const oldPublicationAvailable = !!currentPublication && !!publication && currentPublication.id !== publication.publication.id
  const selectedCourse = publication?.publication.schedule.courses.find((course) => course.courseId === dialogCourse) ?? null
  const selectedSections = selectedCourse ? publication?.publication.schedule.sections.filter((section) => section.courseId === selectedCourse.courseId) ?? [] : []
  const events = useMemo(() => publication ? buildPreEnrollmentSchedule(publication, selection) : [], [publication, selection])
  const editSelection = (next: E2Choice[]) => {
    validationToken.current += 1
    selectionRevision.current += 1
    setSelection(next)
    setValidation(null)
    setDirty(true)
    setError('')
  }
  const queryPublication = async (id = publicationId) => {
    if (!id || !context) return false
    const samePublication = publication?.publication.id === id
    if (dirty && !samePublication && !window.confirm('Consultar otra publicación descartará los cambios sin guardar. El borrador guardado no cambia. ¿Continuar?')) return false
    queryController.current?.abort()
    const controller = new AbortController()
    queryController.current = controller
    const token = ++queryToken.current
    validationToken.current += 1
    const requestIdentity: E2Identity = { runId, actorId, sessionId }
    try {
      setBusy(true); setError(''); setNotice('')
      const value = await fetchPreEnrollmentPublication(requestIdentity, id, context.academicRevision, fetch, controller.signal)
      if (token !== queryToken.current) return false
      setApiUnavailable(false)
      setPublication(value)
      setPublicationId(id)
      if (!samePublication) {
        setSelection([])
        selectionRevision.current += 1
        setDirty(false)
        setWorkspaceHydrated(true)
      }
      setValidation(null)
      return true
    } catch (cause) {
      if (controller.signal.aborted) return false
      const unavailable = !!cause && typeof cause === 'object' && 'status' in cause && cause.status === 403
      setApiUnavailable(unavailable)
      setError(unavailable ? 'La propuesta no está disponible para este escenario local.' : cause instanceof Error ? cause.message : 'La publicación no está disponible para este perfil.')
    }
    finally { if (token === queryToken.current) setBusy(false) }
    return false
  }
  const choosePublication = (id: string) => {
    if (id === publicationId) return
    if (!window.confirm('Cambiar de publicación limpiará la selección actual. El borrador guardado no se modifica hasta que elijas Guardar. ¿Continuar?')) return
    queryController.current?.abort(); queryToken.current += 1; validationToken.current += 1
    setPublicationId(id); setPublication(null); setSelection([]); selectionRevision.current += 1
    setWorkspaceHydrated(false); setValidation(null); setDirty(false); setNotice('')
  }
  const recover = async () => {
    if (dirty && !window.confirm('Recuperar el borrador reemplazará los cambios sin guardar. ¿Continuar?')) return
    queryController.current?.abort()
    const controller = new AbortController()
    queryController.current = controller
    const token = ++queryToken.current
    validationToken.current += 1
    const requestIdentity: E2Identity = { runId, actorId, sessionId }
    try {
      setBusy(true); setError('')
      const fresh = await fetchPreEnrollmentContext(requestIdentity, fetch, controller.signal)
      if (!fresh.draft || !fresh.draftValidation) throw new Error('No hay un borrador recuperable para este perfil.')
      const publicationValue = await fetchPreEnrollmentPublication(requestIdentity, fresh.draft.publicationId, fresh.academicRevision, fetch, controller.signal)
      if (token !== queryToken.current) return
      setContext(fresh); setPublication(publicationValue); setPublicationId(fresh.draft.publicationId)
      setSelection(fresh.draft.selection.map((choice) => ({ ...choice }))); selectionRevision.current += 1
      setValidation(fresh.draftValidation); setDirty(false); setWorkspaceHydrated(true)
      setNotice(`Borrador versión ${fresh.draft.version} recuperado. La publicación guardada permanece seleccionada.`)
    } catch (cause) { if (token === queryToken.current) {
      const unavailable = !!cause && typeof cause === 'object' && 'status' in cause && cause.status === 403
      setApiUnavailable(unavailable)
      setError(unavailable ? 'La propuesta no está disponible para este escenario local.' : cause instanceof Error ? cause.message : 'No se pudo recuperar el borrador.')
    } }
    finally { if (token === queryToken.current) setBusy(false) }
  }
  const save = async () => {
    if (!context || !publication) return
    const requestSelection = selection.map((item) => ({ ...item }))
    const requestSelectionRevision = selectionRevision.current
    const token = ++saveToken.current
    saveController.current?.abort()
    const controller = new AbortController()
    saveController.current = controller
    const requestIdentity: E2Identity = { runId, actorId, sessionId }
    try {
      setBusy(true); setError(''); setNotice('')
      const response = await savePreEnrollment(requestIdentity, { publicationId: publication.publication.id,
        publicationVersion: publication.publication.publicationVersion, selection: requestSelection,
        id: context.draft?.id ?? null, expectedVersion: context.draft?.version ?? null,
        expectedAcademicRevision: context.academicRevision }, fetch, controller.signal)
      if (token !== saveToken.current) return
      setApiUnavailable(false)
      setContext((current) => current ? { ...current, draft: response.draft, draftValidation: response.validation } : current)
      if (selectionRevision.current === requestSelectionRevision && (context.draft?.id ?? response.draft.id) === response.draft.id) {
        setValidation(response.validation); setDirty(false)
      }
      setNotice(`Borrador guardado · versión ${response.draft.version}.`)
    } catch (cause) { if (token === saveToken.current) {
      const unavailable = !!cause && typeof cause === 'object' && 'status' in cause && cause.status === 403
      setApiUnavailable(unavailable)
      setError(unavailable ? 'La propuesta no está disponible para este escenario local.' : cause instanceof Error ? cause.message : 'No se pudo guardar el borrador.')
    } }
    finally { if (token === saveToken.current) setBusy(false) }
  }

  if (!context) return <details className="student-premat"><summary>Mi propuesta de prematrícula</summary>
    <p role={error ? 'alert' : 'status'}>{error || 'Consultando la propuesta personal…'}</p>
    {apiUnavailable && <p role="status">No hay acciones de prematrícula disponibles para este escenario.</p>}</details>

  const eligibilities = new Map(publication?.eligibility.map((item) => [item.courseId, item.issues]) ?? [])
  const currentSelection = new Map(selection.map((choice) => [choice.courseId, choice.sectionId]))
  return <details className="student-premat"><summary>Mi propuesta de prematrícula</summary>
    <div className="student-premat__body">
      <p className="student-premat__note">Borrador personal local: no reserva vacantes ni confirma matrícula. No se aplican límites institucionales no verificados.</p>
      {!apiUnavailable && <div className="student-premat__controls">
        <label>Publicación académica
          <select value={publicationId} onChange={(event) => choosePublication(event.target.value)} disabled={busy}>
            <option value="">Seleccione una publicación</option>
            {context.publications.items.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.publicationVersion} · {item.id === context.publications.currentId ? 'Vigente' : 'Anterior'}</option>)}
          </select>
        </label>
        <button type="button" disabled={!publicationId || busy} onClick={() => void queryPublication()}>Consultar</button>
        {context.draft && <button type="button" disabled={busy} onClick={() => void recover()}>Recuperar borrador v{context.draft.version}</button>}
        <button type="button" disabled={!publication || busy || !workspaceHydrated} onClick={() => void save()}>Guardar borrador</button>
      </div>}
      {oldPublicationAvailable && <p className="student-premat__warning" role="status">Hay una publicación vigente más reciente. Esta propuesta conserva la referencia guardada hasta cambiarla explícitamente.</p>}
      {context.draft && context.draft.academicRevision !== context.academicRevision && <p className="student-premat__warning" role="status">El contexto académico cambió desde el guardado; revísalo antes de volver a guardar.</p>}
      {error && <p className="student-premat__error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      {apiUnavailable && <p role="status">No hay acciones de prematrícula disponibles para este escenario.</p>}
      {publication && !apiUnavailable && <>
        <p>{publication.publication.title} · {publication.publication.schedule.schoolId} · {publication.publication.schedule.academicPeriod} · publicación {publication.publication.publicationVersion}</p>
        <StudentIntentionPanel identity={identity} draft={context.draft} academicRevision={context.academicRevision}
          displayedPublicationId={publication.publication.id} displayedPublicationVersion={publication.publication.publicationVersion}
          selection={selection} dirty={dirty} busy={busy || !workspaceHydrated}
          validation={validation} />
        <div className="table-card"><div className="table-overflow"><table><thead><tr><th>Asignatura</th><th>Créditos</th><th>Estado</th><th>Sección elegida</th><th>Elegir sección</th></tr></thead>
          <tbody>{publication.publication.schedule.courses.map((course) => {
            const sectionId = currentSelection.get(course.courseId)
            const section = publication.publication.schedule.sections.find((item) => item.sectionId === sectionId)
            const issues = eligibilities.get(course.courseId) ?? []
            return <tr key={course.courseId}><td>{course.courseId} - {course.name}</td><td>{course.credits}</td>
              <td>{issues.length ? issues.map((issue) => issue.message).join(' · ') : 'Disponible para propuesta'}</td>
              <td>{section ? academicSectionLabel({ sections: publication.publication.schedule.sections }, section.sectionId) : '--'}</td><td><button type="button" disabled={busy} onClick={() => setDialogCourse(course.courseId)}>Elegir</button>
                {sectionId && <button type="button" disabled={busy} onClick={() => editSelection(removeChoice(selection, course.courseId))}>Quitar</button>}</td></tr>
          })}</tbody></table></div></div>
        <dl><div><dt>Créditos seleccionados</dt><dd>{validation?.credits ?? '…'}</dd></div><div><dt>Asignaturas</dt><dd>{validation?.courseCount ?? selection.length}</dd></div>
          <div><dt>Estado de validación</dt><dd>{validation ? ({ valid: 'Válido', unmet: 'Requisitos incumplidos', insufficient: 'Información insuficiente', incomplete: 'Borrador incompleto' } as const)[validation.status] : 'Validando'}</dd></div></dl>
        {validation?.issues.map((issue, index) => <p key={`${issue.code}-${index}`} className="student-premat__warning">{issue.message}</p>)}
        <WeeklySchedule data={null} displayEvents={events} />
        {selectedCourse && <PickerDialog course={selectedCourse} sections={selectedSections} assignments={publication.publication.schedule.assignments} selection={selection} onCancel={() => setDialogCourse(null)}
          onAccept={(sectionId) => { const next = chooseSection(selection, selectedCourse.courseId, sectionId); editSelection(next); setDialogCourse(null) }} />}
      </>}
    </div>
  </details>
}

function PickerDialog({ course, sections, assignments, selection, onCancel, onAccept }: { course: E2PublicationResponse['publication']['schedule']['courses'][number]; sections: E2PublicationResponse['publication']['schedule']['sections']; assignments: E2PublicationResponse['publication']['schedule']['assignments']; selection: E2Choice[]; onCancel: () => void; onAccept: (id: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = dialogRef.current; if (dialog && !dialog.open) dialog.showModal(); return () => { if (dialog?.open) dialog.close() } }, [])
  const rows = sections.map((section) => {
    const meetings = assignments.filter((assignment) => assignment.sectionId === section.sectionId)
    const schedule = meetings.map((assignment) => `${['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][assignment.day]} ${String(Math.floor(assignment.startMinute / 60)).padStart(2, '0')}:${String(assignment.startMinute % 60).padStart(2, '0')}-${String(Math.floor(assignment.endMinute / 60)).padStart(2, '0')}:${String(assignment.endMinute % 60).padStart(2, '0')}`).join(', ') || 'Horario no especificado'
    return { sectionId: section.sectionId, label: academicSectionLabel({ sections }, section.sectionId), room: [...new Set(meetings.map((a) => a.roomName))].join(', ') || '—', teacher: [...new Set(meetings.map((a) => a.teacherName))].join(', ') || '—', schedule, plannedCapacity: section.capacity }
  })
  return <dialog ref={dialogRef} className="course-schedule-dialog sum-section-dialog" aria-labelledby="e2-section-dialog-title"
    onCancel={(event) => { event.preventDefault(); onCancel() }}><header className="course-schedule-dialog__header"><h2 id="e2-section-dialog-title">Secciones disponibles</h2>
      <button type="button" className="course-schedule-dialog__close" aria-label="Cerrar secciones disponibles" onClick={onCancel}>×</button></header>
    <div className="course-schedule-dialog__body"><SectionPickerPresentation courseLabel={`${course.courseId} - ${course.name}`} currentSectionId={selection.find((item) => item.courseId === course.courseId)?.sectionId ?? null}
      rows={rows} capacityHeading="Capacidad planificada" onAccept={onAccept} onCancel={onCancel} /></div></dialog>
}

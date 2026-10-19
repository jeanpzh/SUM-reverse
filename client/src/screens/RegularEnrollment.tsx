import { EnrollmentCalendarPanel } from '../components/EnrollmentCalendarPanel'
import { CourseSelectionPanel } from '../components/CourseSelectionPanel'
import { AcademicRequirementsPanel } from '../components/AcademicRequirementsPanel'
import { EnrollmentResultDialog } from '../components/EnrollmentResultDialog'
import { PreEnrollmentPanel } from '../components/PreEnrollmentPanel'
import { SectionPickerDialog } from '../components/SectionPickerDialog'
import { SumAlertDialog } from '../components/SumAlertDialog'
import { SumEnrollmentNotices, SumEnrollmentTable } from '../components/SumEnrollmentTable'
import { chooseSection, removeChoice } from '../data/sumEnrollmentTable'
import { Outlet, useChildMatches, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useId, useRef, useSyncExternalStore } from 'react'
import type { ReactNode, Ref } from 'react'
import { PageTitle, StudentSummary } from '../components/Common'
import { createMatriculaRegularApi, MatriculaRegularApiError } from '../data/matriculaRegular'
import type { MatriculaRegularContext } from '../data/matriculaRegular'
import {
  createSubmissionFlow,
  INTENT_KEY_PREFIX,
  restoreIntent,
} from '../data/matriculaRegularRecovery'
import type { KeyValueStorage, PendingIntent, SubmitAttempt, UncertainReason } from '../data/matriculaRegularRecovery'
import { formatOutcomeCauses, getDialogKind } from '../data/enrollmentResultDialog'
import { REPORT_ROUTE_PATH, reportLinkFromOutcome } from '../data/regularEnrollmentReport'
import { getLocalProfileActivation, localProfileSessionStore } from '../data/client'
import type { StudentSummaryData } from '../data/adapters'
import type {
  MatriculaRegularChoice,
  MatriculaRegularEnvelope,
  MatriculaRegularId,
  MatriculaRegularOutcome,
  MatriculaRegularSession,
} from '../../../shared/matricula-regular.mjs'
import './RegularEnrollment.css'

interface AuthorizedActor {
  readonly id: MatriculaRegularId
  readonly label: string
  readonly school: 'Sistemas' | 'Software'
}

const AUTHORIZED_SYNTHETIC_ACTORS: readonly AuthorizedActor[] = [
  { id: 'SYN-SIS-A', label: 'SYN-SIS-A (Ingeniería de Sistemas - Estudiante A)', school: 'Sistemas' },
  { id: 'SYN-SIS-B', label: 'SYN-SIS-B (Ingeniería de Sistemas - Estudiante B)', school: 'Sistemas' },
  { id: 'SYN-SOFT-A', label: 'SYN-SOFT-A (Ingeniería de Software - Estudiante A)', school: 'Software' },
  { id: 'SYN-SOFT-B', label: 'SYN-SOFT-B (Ingeniería de Software - Estudiante B)', school: 'Software' },
]


type Notice = { tone: 'info' | 'warning'; message: string }
type UncertainReasonView = UncertainReason | 'conflict' | 'restored'
interface UncertainState {
  intent: PendingIntent
  reason: UncertainReasonView
  lookup: 'none' | 'unknown' | 'error'
  persisted: boolean
}
type SubmissionPhase = 'idle' | 'submitting' | 'uncertain'

const UNCERTAIN_MESSAGES: Record<UncertainReasonView, string> = {
  network: 'No se recibió respuesta de la API local; la solicitud pudo o no haberse procesado.',
  aborted: 'El envío se interrumpió antes de recibir respuesta; la solicitud pudo o no haberse procesado.',
  protocol: 'La respuesta de la API local no pudo interpretarse según el contrato.',
  'local-failure': 'La API local informó un fallo interno antes de confirmar el resultado.',
  'http-unrecognized': 'La API local respondió con un error no reconocido por el contrato.',
  uncorrelated: 'La respuesta recibida no corresponde a esta solicitud (selección o revisión distintas) y no se presenta como resultado.',
  conflict: 'La API local detectó la misma identidad con un contenido distinto; se conserva la solicitud original.',
  restored: 'Se recuperó una solicitud de esta ejecución cuya respuesta no se confirmó antes de recargar la pantalla.',
}

const LOOKUP_MESSAGES = {
  unknown: 'Aún no hay un resultado publicado para esta solicitud en esta ejecución. Esto no confirma que no haya sido recibida: puede estar en cola.',
  error: 'No se pudo consultar el resultado. La solicitud sigue sin confirmarse.',
} as const

interface DefinitiveHandling { message: string; resetSession: boolean; resetSelection: boolean }

const DEFINITIVE_HANDLING: Record<string, DefinitiveHandling> = {
  INVALID_REQUEST: { message: 'La API local rechazó el formato de la solicitud (error de protocolo, no un rechazo académico). No se registró nada.', resetSession: false, resetSelection: false },
  ACTOR_NOT_FOUND: { message: 'El actor no existe en el catálogo sintético de esta ejecución. No se registró nada.', resetSession: true, resetSelection: true },
  CHOICE_NOT_FOUND: { message: 'Alguna asignatura o sección elegida no existe en el catálogo de esta ejecución. No se registró nada; vuelva a elegir.', resetSession: false, resetSelection: true },
  SESSION_NOT_FOUND: { message: 'La sesión local ya no existe. No se registró nada; inicie sesión de nuevo y vuelva a elegir.', resetSession: true, resetSelection: true },
  SESSION_EXPIRED: { message: 'La sesión local venció antes de registrar la solicitud. No se registró nada; inicie sesión de nuevo y vuelva a elegir.', resetSession: true, resetSelection: true },
  SESSION_CONTEXT_MISMATCH: { message: 'La sesión local no corresponde a este actor o ejecución. No se registró nada; inicie sesión de nuevo.', resetSession: true, resetSelection: true },
  PROFILE_CHANGED: { message: 'El perfil académico cambió desde que se cargó el contexto. No se registró nada; se actualizó el contexto, vuelva a elegir.', resetSession: false, resetSelection: true },
}

const RUN_RESET_MESSAGE = 'La ejecución local cambió (reinicio del entorno). Se descartó la solicitud pendiente sin reenviarla; vuelva a ingresar y elegir.'

function browserStorage(): KeyValueStorage | null {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

function preserveLateIntent(storage: KeyValueStorage | null, key: string, value: string | null) {
  if (value === null || storage === null) return
  try { storage.setItem(key, value) } catch { /* storage may be unavailable; the current flow reports that limitation */ }
}

/** Route component: the report route is a child of this path, so the registration screen yields to the Outlet. */
export function RegularEnrollment() {
  const childMatches = useChildMatches()
  if (childMatches.length > 0) return <Outlet />
  if (getLocalProfileActivation() !== 'synthetic-actors') {
    return <section className="route-status" role="status"><h2>Matrícula regular local no disponible</h2>
      <p>Esta demostración solo está disponible con el perfil sintético local activado.</p></section>
  }
  return <LocalProfileEnrollmentScreen />
}

/** L-10: delay of the success alert before the automatic redirect (observed redirect, unmeasured delay). */
const SUCCESS_REDIRECT_MS = 2000

function LocalProfileEnrollmentScreen() {
  const snapshot = useSyncExternalStore(localProfileSessionStore.subscribe,
    localProfileSessionStore.getSnapshot, localProfileSessionStore.getSnapshot)
  const localStatus = snapshot.status
  const profileRunId = snapshot.status === 'active' ? snapshot.runId : null
  const profileActorId = snapshot.status === 'active' ? snapshot.actorId : null
  const profileSessionId = snapshot.status === 'active' ? snapshot.sessionId : null
  const profileGeneration = snapshot.generation
  const [contextEnvelope, setContextEnvelope] = useState<MatriculaRegularEnvelope<MatriculaRegularContext> | null>(null)
  const [contextRevision, setContextRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedChoices, setSelectedChoices] = useState<MatriculaRegularChoice[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [uncertain, setUncertain] = useState<UncertainState | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [resultOutcome, setResultOutcome] = useState<MatriculaRegularOutcome | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pickerCourseId, setPickerCourseId] = useState<MatriculaRegularId | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [storage] = useState(browserStorage)
  const [flow] = useState(() => createSubmissionFlow({ api: createMatriculaRegularApi({ mode: 'local', publicAccess: import.meta.env.VITE_SUM_SIMULATOR === '1' }), storage }))
  const navigate = useNavigate()
  const submitControllerRef = useRef<AbortController | null>(null)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uncertainRef = useRef<UncertainState | null>(null)
  const registerHeadingRef = useRef<HTMLHeadingElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)
  const updateUncertain = useCallback((value: UncertainState | null) => {
    uncertainRef.current = value
    setUncertain(value)
  }, [])

  useEffect(() => localProfileSessionStore.subscribe(() => {
    if (localProfileSessionStore.getSnapshot().status === 'expired') setSelectedChoices([])
  }), [])

  useEffect(() => {
    if (localStatus !== 'active' || !profileRunId || !profileActorId || !profileSessionId) {
      return
    }
    const identity = { runId: profileRunId, actorId: profileActorId, sessionId: profileSessionId }
    const controller = new AbortController()
    localProfileSessionStore.read('matriculaInfo', { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return
        const context = data.payload
        if (context.actorId !== profileActorId) {
          throw new Error('El contexto no corresponde al perfil activo.')
        }
        const envelope = { runId: profileRunId, data: context }
        if (context.eligibility.state !== 'eligible' || !context.preEnrollmentComplete || !context.offerKnown) setSelectedChoices([])
        if (!flow.isBusy()) {
          const restored = restoreIntent(storage, { runId: identity.runId, actorId: identity.actorId })
          if (restored.kind === 'restored' && uncertainRef.current?.intent.requestId !== restored.intent.requestId) {
            updateUncertain({ intent: restored.intent, reason: 'restored', lookup: 'none', persisted: true })
          } else if (restored.kind === 'reset') {
            updateUncertain(null)
            setSelectedChoices([])
            setNotice({ tone: 'warning', message: RUN_RESET_MESSAGE })
          }
        }
        setContextEnvelope(envelope)
        setError(null)
        setLoading(false)
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return
        setLoading(false)
        setError(failure instanceof Error ? failure.message : 'No se pudo cargar el contexto local.')
      })
    return () => controller.abort()
  }, [localStatus, profileRunId, profileActorId, profileSessionId, profileGeneration, contextRevision, flow, storage, updateUncertain])

  useEffect(() => () => {
    submitControllerRef.current?.abort()
    if (redirectTimerRef.current !== null) clearTimeout(redirectTimerRef.current)
  }, [])

  const session: MatriculaRegularSession | null = snapshot.status === 'active' || snapshot.status === 'expired'
    ? { runId: snapshot.runId, actorId: snapshot.actorId, sessionId: snapshot.sessionId,
      startedAt: snapshot.startedAt, expiresAt: snapshot.expiresAt }
    : null

  /** V-07: success alert + automatic redirect; rejection opens the error alert (L-08); pending keeps a notice. */
  const showOutcome = (outcome: MatriculaRegularOutcome) => {
    setResultOutcome(outcome)
    if (outcome.state === 'configuration-pending') {
      setNotice({ tone: 'warning', message: 'La solicitud requiere configuración local y no se presenta como matrícula.' })
      return
    }
    const current = localProfileSessionStore.getSnapshot()
    if (outcome.state === 'accepted' && current.status !== 'active') {
      setNotice({ tone: 'info', message: 'La solicitud fue aceptada. Inicie sesión de nuevo para consultar su reporte de matrícula.' })
      return
    }
    setDialogOpen(true)
    if (outcome.state !== 'accepted' || current.status !== 'active') return
    const link = reportLinkFromOutcome(outcome, current.runId)
    redirectTimerRef.current = setTimeout(() => {
      redirectTimerRef.current = null
      setDialogOpen(false)
      if (!link) {
        setNotice({ tone: 'warning', message: 'No se pudo construir un enlace local válido al reporte.' })
        return
      }
      // L-07: in SUM the redirect is a new page and resets the 15-minute timer (V-07 → V-08).
      void localProfileSessionStore.renew()
      void navigate({ to: REPORT_ROUTE_PATH, params: { enrollmentId: link.enrollmentId }, search: link.search })
    }, SUCCESS_REDIRECT_MS)
  }

  const handleSubmit = async () => {
    if (snapshot.status !== 'active' || !contextEnvelope || submitting || flow.isBusy() || uncertainRef.current) return
    if (!selectedChoices.length || contextEnvelope.data.eligibility.state !== 'eligible') return
    const generation = snapshot.generation
    const controller = new AbortController()
    submitControllerRef.current = controller
    setNotice(null)
    setSubmitting(true)
    const attemptPromise = flow.submit({ runId: snapshot.runId, actorId: snapshot.actorId, sessionId: snapshot.sessionId,
      profileRevision: contextEnvelope.data.profileRevision, selection: selectedChoices, signal: controller.signal })
    const intentKey = `${INTENT_KEY_PREFIX}${snapshot.runId}:${snapshot.actorId}`
    const serializedIntent = storage?.getItem(intentKey) ?? null
    const attempt = await attemptPromise
    if (localProfileSessionStore.getSnapshot().generation !== generation) {
      preserveLateIntent(storage, intentKey, serializedIntent)
      return
    }
    if (controller.signal.aborted) return
    setSubmitting(false)
    if (attempt.result.kind === 'outcome') {
      updateUncertain(null)
      showOutcome(attempt.result.outcome)
    } else if (attempt.result.kind === 'run-changed') {
      localProfileSessionStore.markRunChanged()
    } else if (attempt.result.kind === 'definitive') {
      updateUncertain(null)
      setNotice({ tone: 'warning', message: DEFINITIVE_HANDLING[attempt.result.code]?.message ?? `La API local respondió ${attempt.result.code}.` })
      if (attempt.result.code === 'SESSION_EXPIRED') localProfileSessionStore.markExpired()
      if (attempt.result.status === 401 || attempt.result.status === 403) localProfileSessionStore.markAccessExpired()
    } else {
      updateUncertain({ intent: attempt.intent, reason: attempt.result.kind === 'conflict' ? 'conflict' : attempt.result.reason,
        lookup: 'none', persisted: attempt.persisted })
    }
  }

  const handleConsult = async () => {
    const pending = uncertainRef.current
    if (!pending || lookupBusy || submitting) return
    const controller = new AbortController()
    submitControllerRef.current = controller
    setLookupBusy(true)
    const generation = localProfileSessionStore.getSnapshot().generation
    const result = await flow.consult({ intent: pending.intent, signal: controller.signal })
    if (controller.signal.aborted || localProfileSessionStore.getSnapshot().generation !== generation) return
    setLookupBusy(false)
    if (result.kind === 'known') {
      updateUncertain(null)
      showOutcome(result.outcome)
    } else if (result.kind === 'run-changed') localProfileSessionStore.markRunChanged()
    else updateUncertain({ ...pending, lookup: result.kind === 'unknown' ? 'unknown' : 'error' })
  }

  const handleReplay = async () => {
    if (snapshot.status !== 'active') return
    const pending = uncertainRef.current
    if (!pending || submitting || lookupBusy || flow.isBusy()) return
    const controller = new AbortController()
    submitControllerRef.current = controller
    setSubmitting(true)
    const generation = snapshot.generation
    const intentKey = `${INTENT_KEY_PREFIX}${pending.intent.runId}:${pending.intent.actorId}`
    const serializedIntent = storage?.getItem(intentKey) ?? null
    const attempt = await flow.replay({ intent: pending.intent, sessionId: snapshot.sessionId, signal: controller.signal })
    if (localProfileSessionStore.getSnapshot().generation !== generation) {
      preserveLateIntent(storage, intentKey, serializedIntent)
      return
    }
    if (controller.signal.aborted) return
    setSubmitting(false)
    if (attempt.result.kind === 'outcome') {
      updateUncertain(null)
      showOutcome(attempt.result.outcome)
    } else if (attempt.result.kind === 'run-changed') localProfileSessionStore.markRunChanged()
    else if (attempt.result.kind === 'uncertain' || attempt.result.kind === 'conflict') {
      updateUncertain({ intent: attempt.intent, reason: attempt.result.kind === 'conflict' ? 'conflict' : attempt.result.reason,
        lookup: 'none', persisted: attempt.persisted })
    }
  }

  // L-06/L-08 (T-01): closing the rejection returns to the registration with an empty selection and fresh vacancies.
  const closeRejected = () => {
    setDialogOpen(false)
    setSelectedChoices([])
    setResultOutcome(null)
    setContextRevision((value) => value + 1)
    setTimeout(() => registerHeadingRef.current?.focus(), 0)
  }

  const phase: SubmissionPhase = submitting ? 'submitting' : uncertain ? 'uncertain' : 'idle'
  const acceptedOutcome = resultOutcome?.state === 'accepted' ? resultOutcome : null
  const rejectedOutcome = dialogOpen && resultOutcome?.state === 'rejected' ? resultOutcome : null
  const context = contextEnvelope?.data
  const expired = snapshot.status === 'expired'
  const choices = uncertain?.intent.selection ?? selectedChoices
  const selectionDisabled = snapshot.status !== 'active' || submitting || uncertain !== null
    || acceptedOutcome !== null || context?.eligibility.state !== 'eligible'
  const pickerCourse = context && pickerCourseId
    ? context.offer.find((course) => course.courseId === pickerCourseId) ?? null
    : null

  return (
    <div className="regular-enrollment">
      <header className="regular-enrollment__header">
        <PageTitle>Matrícula Regular (Prototipo Local)</PageTitle>
        <p className="regular-enrollment__subtitle">Entorno de evaluación y verificación sintética independiente.</p>
      </header>
      {loading && <section className="route-status" role="status">Consultando el contexto del perfil activo…</section>}
      {error && !loading && (
        <section className="route-status" role="alert">
          <h2>No se pudo cargar la información</h2>
          <p>{error}</p>
          <button type="button" onClick={() => setContextRevision((value) => value + 1)}>Intentar de nuevo</button>
        </section>
      )}
      {expired && <p role="status">La sesión local venció. La selección y los envíos están deshabilitados; se permite consultar manualmente un resultado pendiente.</p>}
      {context && session && (
        <>
          <StudentSummary />
          <SumEnrollmentNotices showMandatoryNotice={(context.retakeCourseIds ?? []).length > 0} />
          {context.eligibility.state !== 'eligible' && (
            <p className="sum-enrollment__blocked" role="status">La matrícula no está habilitada para este perfil sintético en este momento.</p>
          )}
          <SumEnrollmentTable context={context} choices={choices} disabled={selectionDisabled}
            executeDisabled={selectionDisabled || choices.length === 0 || phase !== 'idle'}
            onPick={setPickerCourseId}
            onRemove={(courseId) => setSelectedChoices((current) => removeChoice(current, courseId))}
            onExecute={() => setConfirmOpen(true)}
            executeRef={submitButtonRef} headingRef={registerHeadingRef} />
          <SubmissionRecoveryNotice phase={phase} uncertain={uncertain ? { reason: uncertain.reason, lookup: uncertain.lookup } : null}
            storageNotice={uncertain !== null && !uncertain.persisted} notice={notice} hasSession={snapshot.status === 'active'}
            lookupBusy={lookupBusy} onConsult={() => void handleConsult()} onReplay={() => void handleReplay()} />
          <details className="regular-enrollment__local-details">
            <summary>Detalle local de verificación (no forma parte de la interfaz SUM)</summary>
            <PreEnrollmentPanel context={context} />
            <EnrollmentCalendarPanel calendar={context.calendar} eligibility={context.eligibility}
              sources={context.sources} serverNow={context.serverNow} />
            <AcademicRequirementsPanel context={context} outcome={resultOutcome} />
          </details>
        </>
      )}
      {pickerCourse && (
        <SectionPickerDialog key={pickerCourse.courseId} course={pickerCourse}
          currentSectionId={choices.find((item) => item.courseId === pickerCourse.courseId)?.sectionId ?? null}
          onAccept={(sectionId) => {
            setSelectedChoices((current) => chooseSection(current, pickerCourse.courseId, sectionId))
            setPickerCourseId(null)
          }}
          onCancel={() => setPickerCourseId(null)} />
      )}
      {confirmOpen && (
        <SumAlertDialog kind="warning" onDismiss={() => setConfirmOpen(false)} actions={<>
          <button type="button" className="sum-button sum-button--success"
            onClick={() => { setConfirmOpen(false); void handleSubmit() }}>EJECUTAR</button>
          <button type="button" className="sum-button sum-button--light" onClick={() => setConfirmOpen(false)}>CANCELAR</button>
        </>}>
          <p>Revise cuidadosamente las asignaturas seleccionadas. ¿Está seguro de ejecutar la matrícula?</p>
        </SumAlertDialog>
      )}
      {dialogOpen && acceptedOutcome && (
        <SumAlertDialog kind="success"
          actions={<button type="button" className="sum-button sum-button--light" disabled>REDIRECCIONANDO...</button>}>
          <p><strong>La Matrícula se registró exitosamente. Lo estamos redireccionando a su reporte de matrícula.</strong></p>
        </SumAlertDialog>
      )}
      {rejectedOutcome && (
        <SumAlertDialog kind="error" onDismiss={closeRejected}
          actions={<button type="button" className="sum-button sum-button--light" onClick={closeRejected}>ACEPTAR</button>}>
          <ul className="sum-alert__causes">
            {formatOutcomeCauses(rejectedOutcome.causes).map((cause, index) => (
              <li key={`${cause.code}-${index}`}>
                <strong>{cause.title}</strong>{cause.coursesSummary ? ` — ${cause.coursesSummary}` : ''}
                <br />{cause.description}
              </li>
            ))}
          </ul>
        </SumAlertDialog>
      )}
    </div>
  )
}

export function RegularEnrollmentScreen() {
  const [selectedActorId, setSelectedActorId] = useState<MatriculaRegularId>('SYN-SIS-A')
  const [contextEnvelope, setContextEnvelope] = useState<MatriculaRegularEnvelope<MatriculaRegularContext> | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<MatriculaRegularSession | null>(null)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionNotice, setSessionNotice] = useState('')
  const [selectedChoices, setSelectedChoices] = useState<MatriculaRegularChoice[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [uncertain, setUncertain] = useState<UncertainState | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [resultOutcome, setResultOutcome] = useState<MatriculaRegularOutcome | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [storage] = useState(browserStorage)
  const [flow] = useState(() => createSubmissionFlow({ api: createMatriculaRegularApi({ mode: 'local', publicAccess: import.meta.env.VITE_SUM_SIMULATOR === '1' }), storage }))
  const navigate = useNavigate()
  const sessionRef = useRef<MatriculaRegularSession | null>(null)
  const sessionControllerRef = useRef<AbortController | null>(null)
  const submitControllerRef = useRef<AbortController | null>(null)
  const uncertainRef = useRef<UncertainState | null>(null)
  const registerHeadingRef = useRef<HTMLHeadingElement>(null)
  const acceptedHeadingRef = useRef<HTMLHeadingElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)
  const updateSession = useCallback((value: MatriculaRegularSession | null) => {
    sessionRef.current = value
    setSession(value)
  }, [])
  const updateUncertain = useCallback((value: UncertainState | null) => {
    uncertainRef.current = value
    setUncertain(value)
  }, [])
  const acceptEnvelope = useCallback((envelope: MatriculaRegularEnvelope<MatriculaRegularContext>) => {
    const current = sessionRef.current
    if (current && (current.runId !== envelope.runId || current.actorId !== envelope.data.actorId
      || Date.parse(envelope.data.serverNow) >= Date.parse(current.expiresAt))) {
      updateSession(null)
      setSelectedChoices([])
      setSessionNotice('La sesión local terminó o cambió el entorno. Ingrese de nuevo.')
    }
    if (envelope.data.eligibility.state !== 'eligible' || !envelope.data.preEnrollmentComplete || !envelope.data.offerKnown) setSelectedChoices([])
    // Recovery: a stored identity from this run is restored as uncertain; one from another run is cleared with a warning.
    if (!flow.isBusy()) {
      const restored = restoreIntent(storage, { runId: envelope.runId, actorId: envelope.data.actorId })
      const inMemory = uncertainRef.current
      if (restored.kind === 'restored') {
        if (inMemory?.intent.requestId !== restored.intent.requestId) {
          updateUncertain({ intent: restored.intent, reason: 'restored', lookup: 'none', persisted: true })
        }
      } else if (restored.kind === 'reset' || (inMemory !== null && inMemory.intent.runId !== envelope.runId)) {
        updateUncertain(null)
        setSelectedChoices([])
        setNotice({ tone: 'warning', message: RUN_RESET_MESSAGE })
      }
    }
    setContextEnvelope(envelope)
  }, [updateSession, updateUncertain, flow, storage])

  const actorSelectId = useId()
  const activeControllerRef = useRef<AbortController | null>(null)

  const loadContext = useCallback((actorId: MatriculaRegularId) => {
    activeControllerRef.current?.abort()
    const controller = new AbortController()
    activeControllerRef.current = controller

    setLoading(true)
    setError(null)

    const api = createMatriculaRegularApi({ mode: 'local', publicAccess: import.meta.env.VITE_SUM_SIMULATOR === '1' })
    api.getContext(actorId, { signal: controller.signal })
      .then((envelope) => {
        if (controller.signal.aborted) return
        acceptEnvelope(envelope)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setLoading(false)
        if (err instanceof MatriculaRegularApiError) {
          if (err.status === 401 || err.status === 403) localProfileSessionStore.markAccessExpired()
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Ocurrió un error inesperado al consultar el contexto de matrícula.')
        }
      })
  }, [acceptEnvelope])

  useEffect(() => {
    activeControllerRef.current?.abort()
    const controller = new AbortController()
    activeControllerRef.current = controller

    const api = createMatriculaRegularApi({ mode: 'local', publicAccess: import.meta.env.VITE_SUM_SIMULATOR === '1' })
    api.getContext(selectedActorId, { signal: controller.signal })
      .then((envelope) => {
        if (controller.signal.aborted) return
        acceptEnvelope(envelope)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setLoading(false)
        if (err instanceof MatriculaRegularApiError) {
          if (err.status === 401 || err.status === 403) localProfileSessionStore.markAccessExpired()
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Ocurrió un error inesperado al consultar el contexto de matrícula.')
        }
      })

    return () => {
      activeControllerRef.current?.abort()
      activeControllerRef.current = null
      sessionControllerRef.current?.abort()
      sessionControllerRef.current = null
    }
  }, [selectedActorId, acceptEnvelope])

  // Leaving the screen interrupts an in-flight request; the stored identity then stays consultable.
  useEffect(() => () => { submitControllerRef.current?.abort() }, [])

  const handleActorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextActorId = e.target.value
    const matchedActor = AUTHORIZED_SYNTHETIC_ACTORS.find((actor) => actor.id === nextActorId)
    if (!matchedActor) {
      return
    }
    activeControllerRef.current?.abort()
    setContextEnvelope(null)
    setError(null)
    setLoading(true)
    sessionControllerRef.current?.abort()
    updateSession(null)
    setSessionBusy(false)
    setSessionNotice('')
    setSelectedChoices([])
    // Each actor keeps its own stored identity; only the in-memory view is reset here.
    updateUncertain(null)
    setNotice(null)
    setResultOutcome(null)
    setDialogOpen(false)
    setSelectedActorId(matchedActor.id)
  }

  const handleSession = async (renew: boolean) => {
    if (!contextEnvelope || sessionBusy) return
    sessionControllerRef.current?.abort()
    const controller = new AbortController()
    sessionControllerRef.current = controller
    setSessionBusy(true)
    setSessionNotice('')
    const identity = { runId: contextEnvelope.runId, actorId: selectedActorId }
    const current = sessionRef.current
    try {
      const api = createMatriculaRegularApi({ mode: 'local', publicAccess: import.meta.env.VITE_SUM_SIMULATOR === '1' })
      const next = renew && current
        ? await api.renewSession(current.sessionId, identity, { signal: controller.signal })
        : await api.createSession(identity, { signal: controller.signal })
      if (controller.signal.aborted) return
      updateSession(next)
      setSessionNotice(renew ? 'Sesión local renovada explícitamente.' : 'Sesión local iniciada. Elegir asignaturas no registra matrícula.')
    } catch (failure) {
      if (controller.signal.aborted) return
      if (failure instanceof MatriculaRegularApiError && (failure.code === 'SESSION_EXPIRED' || failure.code === 'RUN_CHANGED')) {
        updateSession(null)
        setSelectedChoices([])
      }
      if (failure instanceof MatriculaRegularApiError && (failure.status === 401 || failure.status === 403)) localProfileSessionStore.markAccessExpired()
      setSessionNotice(failure instanceof Error ? failure.message : 'No se pudo iniciar o renovar la sesión local.')
    } finally {
      if (!controller.signal.aborted) setSessionBusy(false)
    }
  }

  const handleRefresh = () => {
    loadContext(selectedActorId)
  }

  const resetAfterRunChange = () => {
    updateUncertain(null)
    updateSession(null)
    setSelectedChoices([])
    setResultOutcome(null)
    setNotice({ tone: 'warning', message: RUN_RESET_MESSAGE })
    loadContext(selectedActorId)
  }

  const handleOutcome = (outcome: MatriculaRegularOutcome) => {
    updateUncertain(null)
    setResultOutcome(outcome)
    if (outcome.state === 'configuration-pending') {
      setNotice({ tone: 'warning', message: 'Solicitud pendiente de configuración: faltan datos para evaluarla y no se registró matrícula. Cambiar la elección crea una solicitud nueva.' })
    } else if (getDialogKind(outcome) === null) {
      setNotice({ tone: 'warning', message: 'El resultado recibido no tiene un estado presentable; no se registró matrícula.' })
    } else {
      setNotice(null)
      setDialogOpen(true)
    }
  }

  const applyAttempt = (attempt: SubmitAttempt, previouslyPersisted = true) => {
    setSubmitting(false)
    const { result } = attempt
    if (result.kind === 'outcome') {
      handleOutcome(result.outcome)
    } else if (result.kind === 'run-changed') {
      resetAfterRunChange()
    } else if (result.kind === 'definitive') {
      const handling = DEFINITIVE_HANDLING[result.code]
      updateUncertain(null)
      setNotice({ tone: 'warning', message: handling?.message ?? `La API local respondió ${result.code}.` })
      if (handling?.resetSession) updateSession(null)
      if (handling?.resetSelection) {
        setSelectedChoices([])
        loadContext(selectedActorId)
      }
    } else {
      setNotice(null)
      updateUncertain({
        intent: attempt.intent,
        reason: result.kind === 'conflict' ? 'conflict' : result.reason,
        lookup: 'none',
        persisted: attempt.persisted && previouslyPersisted,
      })
    }
  }

  const handleSubmit = async () => {
    const current = sessionRef.current
    if (!contextEnvelope || !current || submitting || flow.isBusy() || uncertainRef.current !== null) return
    if (selectedChoices.length === 0 || contextEnvelope.data.eligibility.state !== 'eligible') return
    const controller = new AbortController()
    submitControllerRef.current = controller
    setNotice(null)
    setSubmitting(true)
    const attempt = await flow.submit({
      runId: contextEnvelope.runId,
      actorId: selectedActorId,
      sessionId: current.sessionId,
      profileRevision: contextEnvelope.data.profileRevision,
      selection: selectedChoices,
      signal: controller.signal,
    })
    if (controller.signal.aborted) return
    applyAttempt(attempt)
  }

  const handleConsult = async () => {
    const pending = uncertainRef.current
    if (!pending || lookupBusy || submitting) return
    const controller = new AbortController()
    submitControllerRef.current = controller
    setLookupBusy(true)
    const result = await flow.consult({ intent: pending.intent, signal: controller.signal })
    if (controller.signal.aborted) return
    setLookupBusy(false)
    if (result.kind === 'known') handleOutcome(result.outcome)
    else if (result.kind === 'run-changed') resetAfterRunChange()
    else updateUncertain({ ...pending, lookup: result.kind === 'unknown' ? 'unknown' : 'error' })
  }

  const handleReplay = async () => {
    const pending = uncertainRef.current
    const current = sessionRef.current
    if (!pending || !current || submitting || lookupBusy || flow.isBusy()) return
    const controller = new AbortController()
    submitControllerRef.current = controller
    setSubmitting(true)
    const attempt = await flow.replay({ intent: pending.intent, sessionId: current.sessionId, signal: controller.signal })
    if (controller.signal.aborted) return
    applyAttempt(attempt, pending.persisted)
  }

  const focusAfterDialogClose = () => {
    setTimeout(() => {
      const opener = submitButtonRef.current
      if (opener && !opener.disabled) opener.focus()
      else (acceptedHeadingRef.current ?? registerHeadingRef.current)?.focus()
    }, 0)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    if (resultOutcome?.state === 'rejected') {
      // L-06: a definitive academic rejection returns to an empty selection; nothing is resent.
      setSelectedChoices([])
      setResultOutcome(null)
    }
    focusAfterDialogClose()
  }

  const handleViewReport = (_reportPath?: string, dialogEnrollmentId?: string) => {
    const runId = contextEnvelope?.runId
    const link = resultOutcome && runId ? reportLinkFromOutcome(resultOutcome, runId) : null
    setDialogOpen(false)
    if (!link || (dialogEnrollmentId !== undefined && dialogEnrollmentId !== link.enrollmentId)) {
      setNotice({ tone: 'warning', message: 'No se pudo construir un enlace local válido al reporte de esta matrícula.' })
      return
    }
    void navigate({ to: REPORT_ROUTE_PATH, params: { enrollmentId: link.enrollmentId }, search: link.search })
  }

  const contextData = contextEnvelope?.data
  const phase: SubmissionPhase = submitting ? 'submitting' : uncertain ? 'uncertain' : 'idle'
  const acceptedOutcome = resultOutcome?.state === 'accepted' ? resultOutcome : null
  const displayedChoices = uncertain ? uncertain.intent.selection : selectedChoices

  return (
    <div className="regular-enrollment">
      <header className="regular-enrollment__header">
        <PageTitle>Matrícula Regular (Prototipo Local)</PageTitle>
        <p className="regular-enrollment__subtitle">
          Entorno de evaluación y verificación sintética independiente.
        </p>
      </header>

      <section className="regular-enrollment__actor-bar" aria-labelledby="actor-selector-heading">
        <h3 id="actor-selector-heading" className="sr-only">Selección de actor synthetic</h3>
        <div className="regular-enrollment__actor-selector">
          <label htmlFor={actorSelectId}>Actor del catálogo autorizado:</label>
          <select
            id={actorSelectId}
            className="regular-enrollment__select"
            value={selectedActorId}
            onChange={handleActorChange}
            disabled={loading || sessionBusy || submitting}
          >
            {AUTHORIZED_SYNTHETIC_ACTORS.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="regular-enrollment__refresh-button"
          onClick={handleRefresh}
          disabled={loading || sessionBusy}
        >
          {loading ? 'Cargando contexto…' : 'Actualizar contexto'}
        </button>
      </section>

      {loading && (
        <section className="route-status" role="status" aria-live="polite">
          <p>Consultando contexto académico synthetic…</p>
        </section>
      )}

      {error && !loading && (
        <section className="route-status" role="alert">
          <h2>No se pudo cargar la información</h2>
          <p>{error}</p>
          <button type="button" onClick={handleRefresh}>
            Intentar de nuevo
          </button>
        </section>
      )}

      {!loading && !error && contextData && (
        <div className="regular-enrollment__content">
          <RegularEnrollmentBody
            context={contextData}
            session={session}
            sessionBusy={sessionBusy}
            sessionNotice={sessionNotice}
            onSession={(renew) => { void handleSession(renew) }}
            choices={displayedChoices}
            onChoices={setSelectedChoices}
            selectionDisabled={session === null || sessionBusy || submitting || uncertain !== null
              || acceptedOutcome !== null || contextData.eligibility.state !== 'eligible'}
            outcome={resultOutcome}
          >
            <SubmissionPanel
              phase={phase}
              uncertain={uncertain ? { reason: uncertain.reason, lookup: uncertain.lookup } : null}
              storageNotice={uncertain !== null && !uncertain.persisted}
              notice={notice}
              hasSession={session !== null}
              selectionCount={displayedChoices.length}
              eligible={contextData.eligibility.state === 'eligible'}
              acceptedOutcome={acceptedOutcome}
              lookupBusy={lookupBusy}
              onSubmit={() => { void handleSubmit() }}
              onConsult={() => { void handleConsult() }}
              onReplay={() => { void handleReplay() }}
              onViewReport={handleViewReport}
              registerHeadingRef={registerHeadingRef}
              acceptedHeadingRef={acceptedHeadingRef}
              submitButtonRef={submitButtonRef}
            />
          </RegularEnrollmentBody>
        </div>
      )}

      <EnrollmentResultDialog
        outcome={resultOutcome}
        isOpen={dialogOpen}
        onClose={handleDialogClose}
        onViewReport={handleViewReport}
      />
    </div>
  )
}

export interface RegularEnrollmentBodyProps {
  context: MatriculaRegularContext
  session: MatriculaRegularSession | null
  sessionBusy: boolean
  sessionNotice: string
  onSession: (renew: boolean) => void
  choices: readonly MatriculaRegularChoice[]
  onChoices: (choices: MatriculaRegularChoice[]) => void
  selectionDisabled: boolean
  showSessionControls?: boolean
  outcome: MatriculaRegularOutcome | null
  children?: ReactNode
}

/** Context panels. Rules beyond access are evaluated by the server on submit and shown from the Outcome. */
export function RegularEnrollmentBody({
  context, session, sessionBusy, sessionNotice, onSession, choices, onChoices, selectionDisabled, showSessionControls = true, outcome, children,
}: RegularEnrollmentBodyProps) {
  const studentSummaryData: StudentSummaryData = {
    name: `Estudiante Sintético (${context.actorId})`,
    code: context.actorId,
    period: context.scope.period,
    faculty: context.scope.facultyId === 'FISI' ? 'Facultad de Ingeniería de Sistemas e Informática' : context.scope.facultyId,
    specialty: 'Pregrado Regular (Sintético)',
    plan: context.scope.planId,
    program: context.scope.schoolId === 'SISTEMAS'
      ? 'E.P. de Ingeniería de Sistemas'
      : context.scope.schoolId === 'SOFTWARE'
        ? 'E.P. de Ingeniería de Software'
        : `Escuela: ${context.scope.schoolId}`,
  }

  return (
    <div className="regular-enrollment__main-grid">
      <PreEnrollmentPanel context={context} />
      <EnrollmentCalendarPanel calendar={context.calendar} eligibility={context.eligibility}
        sources={context.sources} serverNow={context.serverNow} />
      {showSessionControls && <section className="regular-enrollment__panel" aria-labelledby="local-session-heading">
        <h3 id="local-session-heading">Sesión local de 15 minutos</h3>
        <p>La lectura del contexto no renueva la sesión. La renovación requiere una acción explícita.</p>
        {session && <p>Inicio UTC: {session.startedAt}. Vencimiento UTC: {session.expiresAt}.</p>}
        <button type="button" disabled={sessionBusy || context.eligibility.state !== 'eligible' || session !== null}
          onClick={() => onSession(false)}>Iniciar sesión local</button>
        <button type="button" disabled={sessionBusy || session === null}
          onClick={() => onSession(true)}>Renovar sesión local</button>
        <p role="status" aria-live="polite">{sessionBusy ? 'Procesando sesión local…' : sessionNotice}</p>
      </section>}
      <CourseSelectionPanel context={context} selectedChoices={choices} onSelectionChange={onChoices}
        disabled={selectionDisabled} />
      {children}
      <div className="regular-enrollment__panel regular-enrollment__panel--summary">
        <StudentSummary student={studentSummaryData} />
      </div>

      <section className="regular-enrollment__panel" aria-labelledby="academic-context-title">
        <h3 id="academic-context-title" className="regular-enrollment__section-title">
          Contexto de Ejecución y Procedencia
        </h3>
        <span className="regular-enrollment__provenance-badge">local-only</span>
        <p className="regular-enrollment__note">
          Datos emitidos por la API local propia. No representan internos privados ni datos de producción de SUM.
        </p>

        <dl className="regular-enrollment__data-list">
          <div>
            <dt>Revisión de perfil</dt>
            <dd>{context.profileRevision}</dd>
          </div>
          <div>
            <dt>Modalidad</dt>
            <dd>{context.scope.modality}</dd>
          </div>
          <div>
            <dt>Hora del servidor</dt>
            <dd>{context.serverNow}</dd>
          </div>
        </dl>
      </section>

      <AcademicRequirementsPanel context={context} outcome={outcome} />

      <section className="regular-enrollment__panel" aria-labelledby="eligibility-status-title">
        <h3 id="eligibility-status-title" className="regular-enrollment__section-title">
          Evaluación de Acceso y Estado
        </h3>
        <dl className="regular-enrollment__data-list">
          <div>
            <dt>Estado de habilitación</dt>
            <dd>
              {context.eligibility.state === 'eligible' && (
                <span className="regular-enrollment__tag regular-enrollment__tag--eligible">Habilitado (eligible)</span>
              )}
              {context.eligibility.state === 'ineligible' && (
                <span className="regular-enrollment__tag regular-enrollment__tag--ineligible">No habilitado (ineligible)</span>
              )}
              {context.eligibility.state === 'configuration-pending' && (
                <span className="regular-enrollment__tag regular-enrollment__tag--pending">Pendiente de configuración (configuration-pending)</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Ventana asignada</dt>
            <dd>{context.eligibility.windowId ?? 'Ninguna'}</dd>
          </div>
          <div>
            <dt>Origen de ventana</dt>
            <dd>{context.eligibility.windowOrigin ?? 'No especificado'}</dd>
          </div>
          <div>
            <dt>Prematrícula habilitada</dt>
            <dd>
              {context.preEnrollmentEnabled === true ? 'Sí' : context.preEnrollmentEnabled === false ? 'No' : 'Desconocido (gap)'}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

export interface SubmissionPanelProps {
  phase: SubmissionPhase
  uncertain: { reason: UncertainReasonView; lookup: 'none' | 'unknown' | 'error' } | null
  storageNotice: boolean
  notice: Notice | null
  hasSession: boolean
  selectionCount: number
  eligible: boolean
  acceptedOutcome: MatriculaRegularOutcome | null
  lookupBusy?: boolean
  onSubmit: () => void
  onConsult: () => void
  onReplay: () => void
  onViewReport: () => void
  registerHeadingRef?: Ref<HTMLHeadingElement>
  acceptedHeadingRef?: Ref<HTMLHeadingElement>
  submitButtonRef?: Ref<HTMLButtonElement>
}

/** Submit / uncertain / pending states. Never a blocking modal; reads and consults stay available. */
export function SubmissionPanel({
  phase, uncertain, storageNotice, notice, hasSession, selectionCount, eligible, acceptedOutcome, lookupBusy = false,
  onSubmit, onConsult, onReplay, onViewReport, registerHeadingRef, acceptedHeadingRef, submitButtonRef,
}: SubmissionPanelProps) {
  const submitting = phase === 'submitting'
  const canSubmit = hasSession && selectionCount > 0 && eligible && phase === 'idle' && acceptedOutcome === null
  return (
    <section className="regular-enrollment__panel regular-enrollment__submission"
      aria-labelledby="registration-heading" aria-busy={submitting}>
      <h3 id="registration-heading" ref={registerHeadingRef} tabIndex={-1} className="regular-enrollment__section-title">
        Registro de matrícula
      </h3>
      <p className="regular-enrollment__note">
        Enviar solicita la matrícula con la elección actual. Las reglas se evalúan en el servidor local al enviar;
        elegir asignaturas no reserva cupos ni registra matrícula.
      </p>
      <button ref={submitButtonRef} type="button" className="regular-enrollment__submit-button"
        disabled={!canSubmit} onClick={onSubmit}>Enviar solicitud de matrícula</button>
      <SubmissionRecoveryNotice phase={phase} uncertain={uncertain} storageNotice={storageNotice} notice={notice}
        hasSession={hasSession} lookupBusy={lookupBusy} onConsult={onConsult} onReplay={onReplay} />

      {acceptedOutcome && (
        <div className="regular-enrollment__accepted">
          <h3 id="accepted-result-heading" ref={acceptedHeadingRef} tabIndex={-1} className="regular-enrollment__section-title">
            Matrícula aceptada
          </h3>
          <p>
            La solicitud fue aceptada en el sistema local con {acceptedOutcome.selection.length} asignatura(s).
            El reporte local está disponible cuando lo solicite.
          </p>
          <button type="button" onClick={onViewReport}>Ver reporte local</button>
        </div>
      )}
    </section>
  )
}

export interface SubmissionRecoveryNoticeProps {
  phase: SubmissionPhase
  uncertain: SubmissionPanelProps['uncertain']
  storageNotice: boolean
  notice: Notice | null
  hasSession: boolean
  lookupBusy?: boolean
  onConsult: () => void
  onReplay: () => void
}

/** Local-only recovery (L-04): sending status, uncertain result with manual consult/replay, and notices. Not part of SUM. */
export function SubmissionRecoveryNotice({
  phase, uncertain, storageNotice, notice, hasSession, lookupBusy = false, onConsult, onReplay,
}: SubmissionRecoveryNoticeProps) {
  const submitting = phase === 'submitting'
  return (
    <>
      <p className="regular-enrollment__live" role="status" aria-live="polite">
        {submitting ? 'Enviando solicitud… espere el resultado; la lectura del contexto sigue disponible.' : ''}
      </p>
      {uncertain && (
        <div className="regular-enrollment__uncertain" role="status" aria-live="polite">
          <h4>Resultado no confirmado</h4>
          <p>{UNCERTAIN_MESSAGES[uncertain.reason]} No se muestra éxito ni rechazo: esto no equivale a un rechazo académico.</p>
          {uncertain.lookup !== 'none' && <p>{LOOKUP_MESSAGES[uncertain.lookup]}</p>}
          {storageNotice && (
            <p>
              No se pudo guardar la identidad de esta solicitud en el navegador: se conserva solo en memoria y,
              si recarga la página, no podrá consultarla ni repetirla.
            </p>
          )}
          <p>Consulte el resultado; si aún no existe, puede repetir manualmente el mismo envío con una sesión local vigente.</p>
          <div className="regular-enrollment__uncertain-actions">
            <button type="button" disabled={lookupBusy || submitting} onClick={onConsult}>Consultar resultado</button>
            <button type="button" disabled={!hasSession || lookupBusy || submitting} onClick={onReplay}>Repetir el mismo envío</button>
          </div>
          {!hasSession && <p>Inicie una sesión local para poder repetir el envío.</p>}
        </div>
      )}
      {notice && (
        <p className={`regular-enrollment__notice regular-enrollment__notice--${notice.tone}`} role="status" aria-live="polite">
          {notice.message}
        </p>
      )}
    </>
  )
}

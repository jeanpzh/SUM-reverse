import { useEffect, useRef, useState } from 'react'
import type { E2Choice, E2Identity, E2Validation } from '../data/prematricula'
import type { E2Draft } from '../../../shared/prematricula-api.mjs'
import { fetchIntentionContext, registerIntention } from '../data/prematricula-intention'
import type { E2IntentionContext } from '../data/prematricula-intention'
import './StudentIntentionPanel.css'

type Props = { identity: E2Identity; draft: E2Draft | null; academicRevision: string; displayedPublicationId: string; displayedPublicationVersion: number; selection: E2Choice[]; dirty: boolean; busy: boolean; validation: E2Validation | null }

function sameSelection(left: readonly E2Choice[], right: readonly E2Choice[]) {
  const canonical = (choices: readonly E2Choice[]) => JSON.stringify(choices.map(({ courseId, sectionId }) => [courseId, sectionId]).sort((a, b) => a[0].localeCompare(b[0])))
  return canonical(left) === canonical(right)
}

export function StudentIntentionPanel({ identity, draft, academicRevision, displayedPublicationId, displayedPublicationVersion, selection, dirty, busy, validation }: Props) {
  const [context, setContext] = useState<E2IntentionContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)
  const requestToken = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const { runId, actorId, sessionId } = identity

  useEffect(() => {
    const token = ++requestToken.current
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    queueMicrotask(() => {
      if (token === requestToken.current) { setLoading(true); setRegistering(false) }
    })
    void fetchIntentionContext({ runId, actorId, sessionId }, fetch, controller.signal).then((value) => {
      if (token === requestToken.current) { setContext(value); setError('') }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted && token === requestToken.current) setError(cause instanceof Error ? cause.message : 'No se pudo consultar la intención local.')
    }).finally(() => { if (token === requestToken.current) setLoading(false) })
    return () => controller.abort()
  }, [runId, actorId, sessionId, draft?.version, draft?.id, refresh])

  useEffect(() => () => { requestToken.current += 1; controllerRef.current?.abort() }, [])

  const record = context?.intention?.history.at(-1) ?? null
  const currentSaved = !!draft && !!context && context.draftId === draft.id && context.draftVersion === draft.version
    && draft.academicRevision === academicRevision && displayedPublicationId === draft.publicationId
    && displayedPublicationVersion === draft.publicationVersion && sameSelection(selection, draft.selection) && !dirty
  const savedRecordMatches = !!draft && !!record && record.draftVersion === draft.version && record.publicationId === draft.publicationId
    && record.publicationVersion === draft.publicationVersion && sameSelection(record.selection, draft.selection)
  const validationMatches = !!draft && !!validation && validation.actorId === identity.actorId && validation.publicationId === draft.publicationId
    && validation.publicationVersion === draft.publicationVersion && validation.academicRevision === draft.academicRevision
    && sameSelection(validation.selection, draft.selection)
  const intentNeedsReview = !!context?.validation && context.validation.status !== 'valid'
  const statusText = intentNeedsReview ? 'Intención requiere nueva verificación' : savedRecordMatches ? 'Intención registrada' : !currentSaved && context?.intention ? 'Intención anterior conservada' : validation ?
    ({ valid: 'Lista para registrar', unmet: 'Requisitos incumplidos', insufficient: 'Verificaciones pendientes', incomplete: 'Selección incompleta' } as const)[validation.status] : 'Sin validación disponible'
  const canRegister = currentSaved && validationMatches && !savedRecordMatches && !busy && !registering && !loading && validation.status === 'valid'

  const submit = async () => {
    if (!canRegister || !draft || !context) return
    const token = ++requestToken.current
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setRegistering(true); setError(''); setNotice('')
    try {
      const value = await registerIntention(identity, { draftId: draft.id, expectedDraftVersion: draft.version,
        expectedIntentionVersion: context.intention?.version ?? null, expectedAcademicRevision: academicRevision }, fetch, controller.signal)
      if (token === requestToken.current) {
        setContext(value)
        setNotice(value.intention?.version === 1 ? 'Intención registrada sobre el borrador guardado.' : `Intención actualizada · versión ${value.intention?.version}.`)
      }
    } catch (cause) {
      if (controller.signal.aborted || token !== requestToken.current) return
      const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : ''
      const message = cause instanceof Error ? cause.message : 'No se pudo registrar la intención.'
      setError(message)
      setNotice(code.includes('VERSION') || code.includes('STALE') ? 'La versión cambió. Se conserva la selección actual; actualiza el contexto antes de volver a intentar.' : '')
      if (code.includes('VERSION') || code.includes('STALE') || code.includes('CAS')) setRefresh((value) => value + 1)
    } finally { if (token === requestToken.current) setRegistering(false) }
  }

  return <section className="student-intention" aria-labelledby="student-intention-title">
    <header className="student-intention__heading"><h3 id="student-intention-title">Intención de prematrícula</h3>
      <span>{loading ? 'Consultando…' : statusText}</span></header>
    <p>Registro local de la última versión guardada. No reserva secciones ni confirma matrícula; las reglas institucionales no verificadas no se evalúan aquí.</p>
    {record && context?.intention && <dl className="student-intention__summary">
      <div><dt>Versión de intención</dt><dd>{context.intention.version}</dd></div><div><dt>Borrador guardado</dt><dd>v{record.draftVersion}</dd></div>
      <div><dt>Publicación</dt><dd>{record.publicationId} · v{record.publicationVersion}</dd></div><div><dt>Registrada</dt><dd>{new Date(record.registeredAt).toLocaleString('es-PE')}</dd></div>
    </dl>}
    {validation && validation.status !== 'valid' && <p className="student-intention__blocked" role="status">
      {validation.status === 'unmet' ? 'No se puede registrar: hay requisitos incumplidos.' : validation.status === 'insufficient' ? 'No se puede registrar: hay verificaciones pendientes. La advertencia de alcance no las sustituye.' : 'No se puede registrar: completa una selección no vacía.'}
      {validation.issues.map((issue, index) => <span key={`${issue.code}-${index}`}>{issue.message}</span>)}
    </p>}
    {!draft && <p role="status">Guarda un borrador para habilitar el registro de intención.</p>}
    {draft && !currentSaved && <p role="status">El registro requiere mostrar sin cambios la selección y la publicación del borrador guardado v{draft.version}.</p>}
    {savedRecordMatches && <p role="status">La intención ya corresponde al borrador guardado actual. Guarda una nueva versión si deseas actualizarla.</p>}
    {context?.validation && context.intention && (!savedRecordMatches || intentNeedsReview) && <p role="status">
      La intención registrada requiere nueva verificación: {({ valid: 'válida', unmet: 'tiene requisitos incumplidos', insufficient: 'tiene verificaciones pendientes y queda excluida del conteo válido', incomplete: 'está incompleta' } as const)[context.validation.status]}.
      {context.validation.issues.map((issue, index) => <span key={`${issue.code}-${index}`}>{issue.message}</span>)}
    </p>}
    <div className="student-intention__actions">
      <button type="button" disabled={!canRegister} onClick={() => void submit()}>{registering ? 'Registrando…' : context?.intention ? 'Actualizar intención' : 'Registrar intención'}</button>
      <button type="button" disabled={loading || registering} onClick={() => setRefresh((value) => value + 1)}>Actualizar historial</button>
    </div>
    {error && <p className="student-intention__error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {context?.intention && <details className="student-intention__history"><summary>Historial propio · {context.intention.history.length} versión(es)</summary>
      <ol>{[...context.intention.history].reverse().map((item) => <li key={item.version}>Intención v{item.version} · borrador v{item.draftVersion} · publicación {item.publicationId} v{item.publicationVersion} · {new Date(item.registeredAt).toLocaleString('es-PE')}</li>)}</ol>
    </details>}
  </section>
}

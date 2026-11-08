import { useEffect, useMemo, useRef, useState } from 'react'
import type { AcademicDraftState, AcademicPublication, AcademicPublicationList, AcademicReleasePreview, AcademicScheduleSnapshot } from '../../../shared/programacion-academica-api.mjs'
import { aggregateAcademicBlocks, academicSectionLabel, formatAcademicDuration, formatAcademicMinute } from '../data/academicScheduling'
import { fetchAcademicPublication, fetchAcademicPublications, fetchAcademicReleasePreview, fetchCurrentAcademicPublication } from '../data/academicScheduling'
import { activateEnrollmentOffer, fetchOperationalOffers } from '../data/enrollmentOffer'
import type { OperationalOffer, OperationalOfferCatalog } from '../data/enrollmentOffer'
import { ConfirmDialog, type ConfirmRequest } from '../components/ui/ConfirmDialog'
import './AcademicPublicationPanel.css'

type PreviewSource = { id: string; version: number; schedule: AcademicScheduleSnapshot; title: string; label: string; source: 'draft' | 'publication'; state: AcademicDraftState }

type Props = {
  draftId: string | null
  draftVersion: number | null
  draftTitle: string
  draftState: AcademicDraftState
  dirty: boolean
  busy: boolean
  onApprove: () => Promise<void>
  onPublish: (expectedCurrentId: string | null) => Promise<void>
  onFork: (id: string, version: number) => Promise<void>
  onError: (message: string | null) => void
  onMessage: (message: string | null) => void
}

const days = ['—', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const stateLabels: Record<AcademicDraftState, string> = {
  draft: 'Borrador', 'ready-for-review': 'Lista para revisión', 'in-review': 'En revisión docente',
  'ready-for-approval': 'Lista para aprobación', approved: 'Aprobada (simulada)', published: 'Publicada (simulada)',
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString('es-PE')
}

export function AcademicPublicationPanel({ draftId, draftVersion, draftTitle, draftState, dirty, busy,
  onApprove, onPublish, onFork, onError, onMessage }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [publicationList, setPublicationList] = useState<AcademicPublicationList | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [selectedPublicationId, setSelectedPublicationId] = useState('')
  const [preview, setPreview] = useState<PreviewSource | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [workingScope, setWorkingScope] = useState<string | null>(null)
  const [offerCatalog, setOfferCatalog] = useState<OperationalOfferCatalog | null>(null)
  const [offerError, setOfferError] = useState<string | null>(null)
  const [activation, setActivation] = useState<{ offer: OperationalOffer; reused: boolean } | null>(null)
  const [activating, setActivating] = useState(false)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const requestIntent = useRef(0)
  const listIntent = useRef(0)
  const scopeKey = `${draftId ?? ''}|${draftVersion ?? ''}|${dirty}|${selectedPublicationId}`
  const working = workingScope === scopeKey
  const selectedSummary = publicationList?.items.find((item) => item.id === selectedPublicationId) ?? null
  const currentPreview = !dirty && preview && preview.source === 'draft' && preview.id === draftId && preview.version === draftVersion ? preview : null
  const publicationPreview = selectedSummary && preview?.source === 'publication' && preview.id === selectedSummary.id ? preview : null
  const currentLabel = publicationList?.items.find((item) => item.id === publicationList.currentId)
  const frozen = draftState === 'approved' || draftState === 'published'
  const canUseRelease = Boolean(draftId && draftVersion && !dirty && !busy && !working)
  const canApprove = canUseRelease && draftState === 'ready-for-approval'
    && currentPreview?.id === draftId && currentPreview.version === draftVersion && currentPreview.state === 'ready-for-approval'
  const canPublish = canUseRelease && draftState === 'approved'
    && currentPreview?.id === draftId && currentPreview.version === draftVersion && currentPreview.state === 'approved'
    && Boolean(publicationList) && !listLoading && !listError && !selectedPublicationId
  const publishDisabledReason = draftState === 'published' ? 'Esta versión ya está publicada'
    : draftState !== 'approved' ? 'Primero aprueba la versión'
    : !publicationList || listLoading
    ? 'Cargando publicaciones…'
    : listError ? 'No se pudieron cargar las publicaciones'
    : selectedPublicationId ? 'Selecciona la versión actual (estás consultando una publicación anterior)'
    : dirty ? 'Hay cambios sin guardar'
    : !currentPreview || currentPreview.state !== 'approved' ? 'Actualiza la vista previa de la versión aprobada'
    : !canPublish ? 'La publicación no está disponible en este estado' : ''
  const approveDisabledReason = dirty ? 'Hay cambios sin guardar'
    : !currentPreview ? 'Actualiza la vista previa de la versión actual'
    : 'La versión debe estar lista para aprobación'

  const blocks = useMemo(() => preview ? aggregateAcademicBlocks(preview.schedule) : [], [preview])
  const cycleByCourse = useMemo(() => new Map(preview?.schedule.courses.map((course) => [course.courseId, course.cycle]) ?? []), [preview])
  const refreshPublications = async () => {
    const intent = ++listIntent.current
    setListError(null)
    setListLoading(true)
    try {
      const result = await fetchAcademicPublications(globalThis.fetch)
      if (intent === listIntent.current) {
        setPublicationList(result)
        if (selectedPublicationId && !result.items.some((item) => item.id === selectedPublicationId)) setSelectedPublicationId('')
      }
    } catch (error) {
      if (intent === listIntent.current) {
        setPublicationList(null)
        setListError(error instanceof Error ? error.message : 'No se pudo consultar el historial local.')
      }
    } finally {
      if (intent === listIntent.current) setListLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshPublications() }, 0)
    return () => window.clearTimeout(timer)
    // Load once on mount; refreshes after writes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshPreview = async () => {
    const selected = selectedSummary
    if (!selected && (!draftId || !draftVersion)) return
    const id = selected?.id ?? draftId!
    const version = selected?.approvedVersion ?? draftVersion!
    const intent = ++requestIntent.current
    setPreview(null)
    setPreviewError(null)
    setWorkingScope(scopeKey)
    try {
      let next: PreviewSource
      if (selected) {
        const publication: AcademicPublication = id === publicationList?.currentId
          ? await fetchCurrentAcademicPublication() : await fetchAcademicPublication(id)
        if (publication.id !== id || publication.publicationVersion !== selected.publicationVersion) {
          throw new Error('El historial cambió mientras se consultaba. Actualiza publicaciones y vuelve a seleccionar la versión.')
        }
        next = { id: publication.id, version: publication.approvedVersion, schedule: publication.schedule,
          title: publication.title, label: `Publicación ${publication.publicationVersion}`, source: 'publication', state: 'published' }
      } else {
        const release: AcademicReleasePreview = await fetchAcademicReleasePreview(id)
        if (release.version !== version) throw new Error('La propuesta cambió. Actualiza la versión y vuelve a consultar la vista previa.')
        next = { id: release.id, version: release.version, schedule: release.schedule, title: release.title,
          label: `Versión ${release.version}`, source: 'draft', state: release.state }
      }
      if (intent === requestIntent.current && (selected || (id === draftId && version === draftVersion))) setPreview(next)
    } catch (error) {
      if (intent === requestIntent.current) setPreviewError(error instanceof Error ? error.message : 'No se pudo consultar la vista previa local.')
    } finally {
      if (intent === requestIntent.current) setWorkingScope(null)
    }
  }

  useEffect(() => {
    let timer: number | undefined
    if (draftState === 'approved' && draftId && draftVersion && !dirty && !selectedPublicationId) {
      timer = window.setTimeout(() => { void refreshPreview() }, 0)
    }
    return () => { if (timer !== undefined) window.clearTimeout(timer) }
    // The preview is refreshed only when the approved draft identity/state becomes current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, draftVersion, draftState, dirty, selectedPublicationId])

  const approve = () => {
    if (!canApprove || !draftId || !draftVersion) return
    setConfirmRequest({
      title: 'Aprobar (simulada)',
      description: `¿Aprobar (simulada) la propuesta «${draftTitle}», versión ${draftVersion}?`,
      confirmLabel: 'Aprobar',
      onConfirm: async () => {
        onError(null)
        onMessage(null)
        await onApprove()
        await refreshPublications()
      },
    })
  }

  const publish = () => {
    if (!canPublish) return
    const currentId = publicationList!.currentId
    const replacing = currentLabel ? ` La publicación vigente será la versión ${currentLabel.publicationVersion} (${currentLabel.title}).` : ' No hay una publicación vigente.'
    setConfirmRequest({
      title: 'Publicar (simulada)',
      description: `¿Publicar (simulada) «${draftTitle}»?${replacing}`,
      confirmLabel: 'Publicar',
      onConfirm: async () => {
        onError(null)
        onMessage(null)
        await onPublish(currentId)
        await refreshPublications()
      },
    })
  }

  const fork = () => {
    const sourceId = selectedSummary?.id ?? (frozen ? draftId : null)
    const sourceVersion = selectedSummary ? selectedSummary.approvedVersion + 1 : draftVersion
    const sourceTitle = selectedSummary?.title ?? draftTitle
    if (!sourceId || !sourceVersion || (!selectedSummary && !frozen) || dirty || busy || working) return
    setConfirmRequest({
      title: 'Crear nuevo borrador',
      description: `¿Crear un nuevo borrador desde «${sourceTitle}»? El documento de origen permanecerá sin cambios.`,
      confirmLabel: 'Crear borrador',
      onConfirm: async () => {
        onError(null)
        onMessage(null)
        // The planning session tracks its own busy state for the new draft.
        await onFork(sourceId, sourceVersion)
        setSelectedPublicationId('')
        setPreview(null)
      },
    })
  }

  const displayPreview = selectedSummary ? preview?.source === 'publication' && preview.id === selectedSummary.id ? preview : null : currentPreview
  const canActivate = Boolean(selectedSummary && publicationPreview?.schedule.schoolId === 'SISTEMAS'
    && publicationPreview.schedule.academicPeriod === '2027-I' && !busy && !activating && !working)

  const refreshOffers = async () => {
    setOfferError(null)
    setActivation(null)
    try {
      setOfferCatalog(await fetchOperationalOffers())
    } catch (error) {
      setOfferCatalog(null)
      setOfferError(error instanceof Error ? error.message : 'No se pudo consultar las ofertas operativas locales.')
    }
  }

  const activatePublication = async () => {
    if (!selectedSummary || !publicationPreview || !canActivate) return
    setActivating(true)
    setOfferError(null)
    setActivation(null)
    try {
      const publication = selectedSummary.id === publicationList?.currentId
        ? await fetchCurrentAcademicPublication() : await fetchAcademicPublication(selectedSummary.id)
      if (publication.id !== selectedSummary.id || publication.publicationVersion !== selectedSummary.publicationVersion
        || publication.schedule.schoolId !== 'SISTEMAS' || publication.schedule.academicPeriod !== '2027-I') {
        throw new Error('La publicación seleccionada cambió o no corresponde a la oferta Sistemas 2027-I.')
      }
      const current = await fetchOperationalOffers()
      setOfferCatalog(current)
      const existing = current.items.find((item) => item.publicationId === publication.id
        && item.publicationVersion === publication.publicationVersion)
      if (current.activeRunId && !existing && !window.confirm(
        `Ya existe una oferta operativa activa (${current.activeRunId}). ¿Crear un contexto nuevo para publicación ${publication.publicationVersion}? Las ofertas anteriores conservarán sus matrículas.`)) return
      const result = await activateEnrollmentOffer({ publicationId: publication.id,
        publicationVersion: publication.publicationVersion, expectedActiveRunId: current.activeRunId })
      setActivation(result)
      setOfferCatalog(await fetchOperationalOffers())
    } catch (error) {
      setOfferError(error instanceof Error ? error.message : 'No se pudo activar la publicación local.')
    } finally {
      setActivating(false)
    }
  }

  return <details className="academic-publication" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary>Aprobación y publicación simuladas</summary>
    <p className="academic-publication__note">Prototipo local sin autenticación ni efecto oficial. La aprobación congela el documento; las consultas locales muestran una sola tabla en modo lectura.</p>
    <div className="academic-publication__actions">
      <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary"
        disabled={working || busy || listLoading} onClick={() => void refreshPublications()}>{listLoading ? 'Actualizando…' : 'Actualizar publicaciones'}</button>
      <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary"
        disabled={working || busy || (selectedSummary ? !selectedSummary : !draftId)} onClick={() => void refreshPreview()}>
        {working ? 'Consultando…' : 'Actualizar vista previa'}
      </button>
      <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary"
        disabled={!canApprove} aria-describedby={!canApprove ? 'academic-approve-reason' : undefined} onClick={approve}>Aprobar (simulada)</button>
      {!canApprove && <span id="academic-approve-reason" className="academic-publication__status">{approveDisabledReason}</span>}
      <button type="button" className="academic-scheduling__button" disabled={!canPublish}
        aria-describedby={!canPublish ? 'academic-publish-reason' : undefined} onClick={publish}>Publicar (simulada)</button>
      {!canPublish && <span id="academic-publish-reason" className="academic-publication__status">{publishDisabledReason}</span>}
    </div>
    <label className="academic-publication__history">Consultar publicación
      <select aria-label="Consultar publicación" value={selectedPublicationId} disabled={working || busy}
        onChange={(event) => { requestIntent.current += 1; setWorkingScope(null); setSelectedPublicationId(event.currentTarget.value); setPreview(null); setPreviewError(null) }}>
        <option value="">Propuesta actual · {draftTitle}</option>
        {publicationList?.items.map((item) => <option key={item.id} value={item.id}>
          {item.id === publicationList.currentId ? 'Vigente' : 'Anterior'} · Publicación {item.publicationVersion} · {item.title} · {dateLabel(item.publishedAt)}
        </option>)}
      </select>
    </label>
    {publicationList && <p className="academic-publication__status" role="status">{publicationList.currentId
      ? `Vigente: publicación ${currentLabel?.publicationVersion ?? '—'} · ${currentLabel?.title ?? publicationList.currentId}.`
      : 'No hay una publicación vigente.'}</p>}
    {listError && <p className="academic-publication__error" role="alert">No se pudo actualizar el historial: {listError}</p>}
    {(selectedSummary || frozen) && <div className="academic-publication__metadata">
      {selectedSummary ? <>
        <span>{selectedSummary.id === publicationList?.currentId ? 'Vigente' : 'Anterior'} · publicación {selectedSummary.publicationVersion}</span>
        <span>Publicada {dateLabel(selectedSummary.publishedAt)}</span>
        <span>Versión aprobada {selectedSummary.approvedVersion}</span>
      </> : <span>{draftState === 'approved' ? 'Aprobada (simulada)' : 'Publicada (simulada)'} · {draftTitle} · versión {draftVersion}</span>}
      <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary"
        disabled={busy || working || dirty} onClick={fork}>Crear nuevo borrador</button>
    </div>}
    {previewError && <p className="academic-publication__error" role="alert">No se pudo consultar la vista previa: {previewError}</p>}
    {displayPreview && <section className="academic-publication__preview" aria-label="Horario de la propuesta consultada">
      <p>{displayPreview.title} · {displayPreview.schedule.schoolId} · {displayPreview.schedule.academicPeriod} · {displayPreview.label}
        {selectedSummary ? ' · solo lectura' : ` · ${stateLabels[displayPreview.state]}`}
      </p>
      <div className="table-card academic-publication__table"><table><thead><tr>
        <th>Código</th><th>Asignatura</th><th>Ciclo</th><th>Sección</th><th>Capacidad</th><th>Docente</th><th>Ambiente</th><th>Día</th><th>Horario</th><th>Componentes</th>
      </tr></thead><tbody>{blocks.map((block) => <tr key={`${block.sectionId}-${block.day}-${block.startMinute}`}>
        <td>{block.courseId}</td><td>{block.courseName}</td><td>{cycleByCourse.get(block.courseId) ?? '—'}</td>
        <td>{academicSectionLabel(preview!.schedule, block.sectionId)}</td><td>{block.capacity ?? '—'}</td><td>{block.teacherName}</td><td>{block.roomNames.join(', ')}</td>
        <td>{days[block.day]}</td><td>{formatAcademicMinute(block.startMinute)}–{formatAcademicMinute(block.endMinute)} · {formatAcademicDuration(block.durationMinutes)}</td>
        <td>{block.componentDetails.map((component) => `${component.type} · ${formatAcademicDuration(component.durationMinutes)}`).join(' + ')}</td>
      </tr>)}</tbody></table></div>
    </section>}
    <section className="academic-publication__metadata" aria-labelledby="academic-publication-activation">
      <h3 id="academic-publication-activation">Matrícula local 2027-I</h3>
      <p>La activación crea un contexto sintético para una publicación de Sistemas 2027-I. No modifica la publicación ni las matrículas de otras ofertas.</p>
      <div className="academic-publication__actions">
        <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary"
          disabled={activating || busy} onClick={() => void refreshOffers()}>{activating ? 'Procesando…' : 'Actualizar ofertas operativas'}</button>
        <button type="button" className="academic-scheduling__button" disabled={!canActivate}
          onClick={() => void activatePublication()}>{activating ? 'Activando…' : 'Activar publicación seleccionada'}</button>
      </div>
      {!selectedSummary && <p className="academic-publication__status">Selecciona una publicación y actualiza su vista previa para habilitar la activación.</p>}
      {selectedSummary && publicationPreview && !canActivate && <p className="academic-publication__status">La activación requiere una publicación de Sistemas 2027-I con vista previa vigente.</p>}
      {offerError && <p className="academic-publication__error" role="alert">{offerError}</p>}
      {activation && <p className="academic-publication__status" role="status">
        {activation.reused ? 'La publicación ya tenía una oferta operativa.' : 'Oferta operativa creada.'} Origen: {activation.offer.publicationId} · publicación {activation.offer.publicationVersion} · oferta {activation.offer.offerVersion} · ejecución {activation.offer.runId}.
        {' '}<a href={`/local/login?runId=${encodeURIComponent(activation.offer.runId)}`}>Abrir matrícula 2027-I</a>
      </p>}
      {offerCatalog && <div className="academic-publication__status" aria-label="Ofertas operativas disponibles">
        <p>{offerCatalog.activeRunId ? `Ejecución activa: ${offerCatalog.activeRunId}.` : 'No hay oferta operativa activa.'}</p>
        {offerCatalog.items.map((offer) => <p key={offer.runId}>
          <a href={`/local/login?runId=${encodeURIComponent(offer.runId)}`}>Abrir matrícula 2027-I · oferta {offer.offerVersion}</a>
          {' '}<span>Origen {offer.publicationId} · publicación {offer.publicationVersion} · {offer.courseCount} cursos · {offer.sectionCount} secciones</span>
        </p>)}
      </div>}
    </section>
    {!displayPreview && <p className="academic-publication__status">{selectedSummary
      ? 'Actualiza la vista previa para consultar esta publicación sin editarla.'
      : draftId ? `Propuesta actual · ${draftTitle} · versión ${draftVersion} · ${stateLabels[draftState]}${dirty ? ' · cambios locales sin guardar' : ''}. Actualiza la vista previa para continuar.`
        : 'Guarda una propuesta antes de consultar una vista previa.'}</p>}
    <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
  </details>
}

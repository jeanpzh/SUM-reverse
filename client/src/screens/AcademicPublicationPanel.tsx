import { PlanningFetchLoading } from '../components/PlanningFetchLoading'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Label } from '../components/ui/Label'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/Collapsible'
import { Alert } from '../components/ui/Alert'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table'
import { toast } from '../components/ui/Sonner'
import type { AcademicDraftState, AcademicPublication, AcademicPublicationList, AcademicReleasePreview, AcademicScheduleSnapshot } from '../../../shared/programacion-academica-api.mjs'
import { aggregateAcademicBlocks, academicSectionLabel, formatAcademicDuration, formatAcademicMinute } from '../data/academicScheduling'
import { fetchAcademicPublication, fetchAcademicPublications, fetchAcademicReleasePreview, fetchCurrentAcademicPublication } from '../data/academicScheduling'
import { activateEnrollmentOffer, fetchOperationalOffers } from '../data/enrollmentOffer'
import type { OperationalOffer, OperationalOfferCatalog } from '../data/enrollmentOffer'
import { ConfirmDialog, useConfirm, type ConfirmRequest } from '../components/ui/ConfirmDialog'
import { LoadBlockerList } from './PlanningDecisions'
import { PUBLICATION_BLOCK_EXPLANATION } from '../data/planningDecisions'
import type { LoadAuthorizationBlocker } from '../../../shared/academic-normative-profile.mjs'
import './AcademicPublicationPanel.css'

type PreviewSource = { id: string; version: number; schedule: AcademicScheduleSnapshot; title: string; label: string; source: 'draft' | 'publication'; state: AcademicDraftState }

type Props = {
  // Blockers reported with the current proposal (normative.blockers). Approval does not clear them; only publication is blocked.
  loadBlockers?: readonly LoadAuthorizationBlocker[]
  teacherNames?: Record<string, string>
  period?: string
  primaryActionId?: string
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

export function AcademicPublicationPanel({ loadBlockers = [], teacherNames = {}, period = '2027-I', primaryActionId, draftId, draftVersion, draftTitle, draftState, dirty, busy,
  onApprove, onPublish, onFork, onError, onMessage }: Props) {
  const [confirmElement, confirm] = useConfirm()
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
  const publishBlocked = loadBlockers.length > 0
  const canPublish = !publishBlocked && canUseRelease && draftState === 'approved'
    && currentPreview?.id === draftId && currentPreview.version === draftVersion && currentPreview.state === 'approved'
    && Boolean(publicationList) && !listLoading && !listError && !selectedPublicationId
  const publishDisabledReason = draftState === 'published' ? 'Esta versión ya está publicada'
    : draftState !== 'approved' ? 'Primero aprueba la versión'
    : publishBlocked ? `Hay ${loadBlockers.length} ${loadBlockers.length === 1 ? 'bloqueo' : 'bloqueos'} de carga docente`
    : !publicationList || listLoading
    ? 'Cargando publicaciones…'
    : listError ? 'No se pudieron cargar las publicaciones'
    : selectedPublicationId ? 'Selecciona la versión actual (estás consultando una publicación anterior)'
    : dirty ? 'Hay cambios sin guardar'
    : previewError ? 'No se pudo cargar la vista previa. Usa Actualizar vista previa para reintentar.'
    : !currentPreview || currentPreview.state !== 'approved' ? 'Espera a que cargue la vista previa de la versión aprobada'
    : !canPublish ? 'La publicación no está disponible en este estado' : ''
  const approveDisabledReason = dirty ? 'Hay cambios sin guardar'
    : draftState !== 'ready-for-approval' ? 'La versión debe estar lista para aprobación'
    : previewError ? 'No se pudo cargar la vista previa. Usa Actualizar vista previa para reintentar.'
    : !currentPreview ? 'Espera a que cargue la vista previa de la versión actual'
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
    if (selectedSummary || (draftId && draftVersion && !dirty)) {
      timer = window.setTimeout(() => { void refreshPreview() }, 0)
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      requestIntent.current += 1
    }
    // Reload on source/version changes; cleanup invalidates late responses from the previous source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, draftVersion, draftState, dirty, selectedPublicationId, selectedSummary?.id, selectedSummary?.publicationVersion])

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
      if (current.activeRunId && !existing) setActivating(false)
      if (current.activeRunId && !existing && !(await confirm({
        title: 'Activar publicación seleccionada',
        description: `Ya existe una oferta operativa activa (${current.activeRunId}). ¿Crear un contexto nuevo para publicación ${publication.publicationVersion}? Las ofertas anteriores conservarán sus matrículas.`,
        confirmLabel: 'Activar publicación seleccionada',
      }))) return
      setActivating(true)
      const result = await activateEnrollmentOffer({ publicationId: publication.id,
        publicationVersion: publication.publicationVersion, expectedActiveRunId: current.activeRunId })
      setActivation(result)
      setOfferCatalog(await fetchOperationalOffers())
      toast.success(result.reused ? 'La publicación ya tenía una oferta operativa.' : 'Oferta operativa creada.')
    } catch (error) {
      setOfferError(error instanceof Error ? error.message : 'No se pudo activar la publicación local.')
    } finally {
      setActivating(false)
    }
  }

  const blockingReason = dirty ? 'Hay cambios sin guardar'
    : draftState === 'approved' ? canPublish ? '' : publishDisabledReason
    : frozen ? '' : canApprove ? 'Primero aprueba la versión'
    : draftState !== 'ready-for-approval' ? `${approveDisabledReason}. Vuelve a Revisión docente para completar la revisión.` : approveDisabledReason

  return <section className="academic-publication" aria-label="Aprobación y publicación simuladas">
      <div className="academic-publication__strip">
        <strong className="academic-publication__state" role="status">
          {frozen || canApprove ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
          {stateLabels[draftState]}
        </strong>
        <span>{draftVersion ? `Versión ${draftVersion}` : 'Sin versión guardada'}</span>
        <span>{dirty ? 'Cambios sin guardar' : draftId ? 'Guardada' : 'Sin guardar'}</span>
        {primaryActionId === 'approve' && canApprove && <Button id="academic-approve-action" type="button" size="sm" onClick={approve}>Aprobar (simulada)</Button>}
      </div>
      {publishBlocked && <section className="academic-publication__section academic-publication__blockers" aria-labelledby="academic-publication-blockers">
        <h3 id="academic-publication-blockers">Bloqueos de publicación ({loadBlockers.length})</h3>
        <p className="academic-publication__status" role="status">{PUBLICATION_BLOCK_EXPLANATION}{frozen ? ' Esta versión está congelada: crea un nuevo borrador, registra la autorización en el docente y regenera la propuesta.' : ''}</p>
        <LoadBlockerList blockers={loadBlockers} teacherNames={teacherNames} period={period} />
      </section>}
      {blockingReason && <p id={draftState === 'approved' ? 'academic-publish-reason' : 'academic-approve-reason'} className="academic-publication__status">{blockingReason}</p>}
      <section className="academic-publication__section" aria-labelledby="academic-publication-title">
        <h3 id="academic-publication-title">Decisión</h3>
        {draftState === 'approved' && <div className="academic-publication__actions">
          <Button variant="outline" type="button" disabled={!canPublish}
            aria-describedby={!canPublish ? 'academic-publish-reason' : undefined} onClick={publish}>Publicar (simulada)</Button>
        </div>}
        <p className="academic-publication__status">{draftState === 'published' ? 'Esta versión ya está publicada.' : draftState === 'approved' ? 'La aprobación congela el documento. Publicar requiere una confirmación independiente.' : 'La aprobación congela el documento; la publicación se confirma después.'}</p>
        {!selectedSummary && previewError && <Button variant="outline" type="button" disabled={working || busy || !draftId} onClick={() => void refreshPreview()}>Reintentar vista previa de la versión</Button>}
      </section>
      <section className="academic-publication__section" aria-labelledby="academic-publications-title">
        <h3 id="academic-publications-title">Publicaciones</h3>
        <div className="academic-publication__toolbar">
        <div className="academic-publication__history"><Label htmlFor="academic-publication-select">Consultar publicación</Label>
          <NativeSelect id="academic-publication-select" aria-label="Consultar publicación" value={selectedPublicationId} disabled={working || busy}
            onChange={(event) => { requestIntent.current += 1; setWorkingScope(null); setSelectedPublicationId(event.currentTarget.value); setPreview(null); setPreviewError(null) }}>
            <option value="">Propuesta actual · {draftTitle}</option>
            {publicationList?.items.map((item) => <option key={item.id} value={item.id}>
              {item.id === publicationList.currentId ? 'Vigente' : 'Anterior'} · Publicación {item.publicationVersion} · {item.title} · {dateLabel(item.publishedAt)}
            </option>)}
          </NativeSelect>
        </div>
          <Button variant="outline" size="sm" type="button" disabled={working || busy || listLoading}
            onClick={() => void refreshPublications()}>{listLoading ? 'Actualizando…' : 'Actualizar publicaciones'}</Button>
          {selectedSummary && <Button variant="outline" size="sm" type="button" disabled={working || busy}
            onClick={() => void refreshPreview()}>{working ? 'Consultando…' : 'Actualizar vista previa'}</Button>}
        </div>
        {publicationList && <p className="academic-publication__status" role="status">{publicationList.currentId
          ? `Vigente: publicación ${currentLabel?.publicationVersion ?? '—'} · ${currentLabel?.title ?? publicationList.currentId}.`
          : 'No hay una publicación vigente.'}</p>}
        {listLoading && <PlanningFetchLoading label="Cargando publicaciones…" layout="table" />}
        {working && <PlanningFetchLoading label="Consultando vista previa…" layout="publication-table" />}
        {listError && <Alert variant="destructive" role="alert">No se pudo actualizar el historial: {listError}</Alert>}
        {(selectedSummary || frozen) && <div className="academic-publication__metadata">
          {selectedSummary ? <>
            <span>{selectedSummary.id === publicationList?.currentId ? 'Vigente' : 'Anterior'} · publicación {selectedSummary.publicationVersion}</span>
            <span>Publicada {dateLabel(selectedSummary.publishedAt)}</span>
            <span>Versión aprobada {selectedSummary.approvedVersion}</span>
          </> : <span>{draftState === 'approved' ? 'Aprobada (simulada)' : 'Publicada (simulada)'} · {draftTitle} · versión {draftVersion}</span>}
          <Button variant="outline" type="button"
            disabled={busy || working || dirty} onClick={fork}>Crear nuevo borrador</Button>
        </div>}
        {previewError && <Alert variant="destructive" role="alert">No se pudo consultar la vista previa: {previewError}</Alert>}
        {displayPreview && <section className="academic-publication__preview" aria-label="Horario de la propuesta consultada">
          <p>{displayPreview.title} · {displayPreview.schedule.schoolId} · {displayPreview.schedule.academicPeriod} · {displayPreview.label}
            {selectedSummary ? ' · solo lectura' : ` · ${stateLabels[displayPreview.state]}`}
          </p>
          <div className="academic-publication__table"><Table stickyHeader><TableHeader><TableRow>
            <TableHead>Código</TableHead><TableHead>Asignatura</TableHead><TableHead>Ciclo</TableHead><TableHead>Sección</TableHead><TableHead>Capacidad</TableHead><TableHead>Docente</TableHead><TableHead>Ambiente</TableHead><TableHead>Día</TableHead><TableHead>Horario</TableHead><TableHead>Componentes</TableHead>
          </TableRow></TableHeader><TableBody>{blocks.map((block) => <TableRow key={`${block.sectionId}-${block.day}-${block.startMinute}`}>
            <TableCell>{block.courseId}</TableCell><TableCell>{block.courseName}</TableCell><TableCell>{cycleByCourse.get(block.courseId) ?? '—'}</TableCell>
            <TableCell>{academicSectionLabel(preview!.schedule, block.sectionId)}</TableCell><TableCell>{block.capacity ?? '—'}</TableCell><TableCell>{block.teacherName}</TableCell><TableCell>{block.roomNames.join(', ')}</TableCell>
            <TableCell>{days[block.day]}</TableCell><TableCell>{formatAcademicMinute(block.startMinute)}–{formatAcademicMinute(block.endMinute)} · {formatAcademicDuration(block.durationMinutes)}</TableCell>
            <TableCell>{block.componentDetails.map((component) => `${component.type} · ${formatAcademicDuration(component.durationMinutes)}`).join(' + ')}</TableCell>
          </TableRow>)}</TableBody></Table></div>
        </section>}
        {!displayPreview && <p className="academic-publication__status">{selectedSummary
          ? 'La vista previa de esta publicación se carga automáticamente; puedes reintentar si falla.'
          : draftId ? `Propuesta actual · ${draftTitle} · versión ${draftVersion} · ${stateLabels[draftState]}${dirty ? ' · cambios locales sin guardar' : ''}. La vista previa se carga al guardar los cambios.`
            : 'Guarda una propuesta antes de consultar una vista previa.'}</p>}
        <Collapsible className="academic-publication__evidence">
          <CollapsibleTrigger asChild><Button variant="ghost" type="button">Alcance de la simulación</Button></CollapsibleTrigger>
          <CollapsibleContent><p>Prototipo local sin autenticación ni efecto oficial. La aprobación congela el documento.</p></CollapsibleContent>
        </Collapsible>
      </section>
        <section className="academic-publication__section" aria-labelledby="academic-publication-activation">
          <h3 id="academic-publication-activation">Matrícula local 2027-I</h3>
          <div className="academic-publication__actions">
            <Button variant="outline" type="button"
              disabled={activating || busy} onClick={() => void refreshOffers()}>{activating ? 'Procesando…' : 'Actualizar ofertas operativas'}</Button>
            <Button variant="outline" type="button" disabled={!canActivate}
              onClick={() => void activatePublication()}>{activating ? 'Activando…' : 'Activar publicación seleccionada'}</Button>
          </div>
          <p className="academic-publication__status">{!selectedSummary
            ? 'Selecciona una publicación de Sistemas 2027-I y espera su vista previa para activar una oferta operativa.'
            : !publicationPreview ? 'Espera la vista previa vigente de la publicación de Sistemas 2027-I para activar una oferta operativa.'
            : !canActivate ? 'La activación requiere una publicación de Sistemas 2027-I con vista previa vigente.'
            : 'La publicación de Sistemas 2027-I tiene vista previa vigente y puede activarse como oferta operativa.'}</p>
          <Collapsible>
            <CollapsibleTrigger asChild><Button variant="ghost" type="button">Alcance de la activación</Button></CollapsibleTrigger>
            <CollapsibleContent><p>La activación crea un contexto sintético para una publicación de Sistemas 2027-I. No modifica la publicación ni las matrículas de otras ofertas.</p></CollapsibleContent>
          </Collapsible>
          {offerError && <Alert variant="destructive" role="alert">{offerError}</Alert>}
          {activation && <p className="academic-publication__status" role="status">
            Origen: {activation.offer.publicationId} · publicación {activation.offer.publicationVersion} · oferta {activation.offer.offerVersion} · ejecución {activation.offer.runId}.
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
        {confirmElement}
        <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </section>
}

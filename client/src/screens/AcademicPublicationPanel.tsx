import { useMemo, useRef, useState } from 'react'
import type { AcademicDraftState, AcademicPublication, AcademicPublicationList, AcademicReleasePreview, AcademicScheduleSnapshot } from '../../../shared/programacion-academica-api.mjs'
import { aggregateAcademicBlocks, academicSectionLabel, formatAcademicDuration, formatAcademicMinute } from '../data/academicScheduling'
import { fetchAcademicPublication, fetchAcademicPublications, fetchAcademicReleasePreview, fetchCurrentAcademicPublication } from '../data/academicScheduling'
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
  onBusyChange: (busy: boolean) => void
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
  onApprove, onPublish, onFork, onBusyChange, onError, onMessage }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [publicationList, setPublicationList] = useState<AcademicPublicationList | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [selectedPublicationId, setSelectedPublicationId] = useState('')
  const [preview, setPreview] = useState<PreviewSource | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [workingScope, setWorkingScope] = useState<string | null>(null)
  const requestIntent = useRef(0)
  const listIntent = useRef(0)
  const scopeKey = `${draftId ?? ''}|${draftVersion ?? ''}|${dirty}|${selectedPublicationId}`
  const working = workingScope === scopeKey
  const currentPreview = !dirty && preview && preview.source === 'draft' && preview.id === draftId && preview.version === draftVersion ? preview : null
  const selectedSummary = publicationList?.items.find((item) => item.id === selectedPublicationId) ?? null
  const currentLabel = publicationList?.items.find((item) => item.id === publicationList.currentId)
  const frozen = draftState === 'approved' || draftState === 'published'
  const canUseRelease = Boolean(draftId && draftVersion && !dirty && !busy && !working)
  const canApprove = canUseRelease && draftState === 'ready-for-approval'
    && currentPreview?.id === draftId && currentPreview.version === draftVersion && currentPreview.state === 'ready-for-approval'
  const canPublish = canUseRelease && draftState === 'approved'
    && currentPreview?.id === draftId && currentPreview.version === draftVersion && currentPreview.state === 'approved'
    && Boolean(publicationList) && !listLoading && !listError && !selectedPublicationId

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

  const approve = async () => {
    if (!canApprove || !draftId || !draftVersion) return
    if (!window.confirm(`¿Aprobar (simulada) la propuesta «${draftTitle}», versión ${draftVersion}?`)) return
    onError(null)
    onMessage(null)
    await onApprove()
  }

  const publish = async () => {
    if (!canPublish) return
    const currentId = publicationList!.currentId
    const replacing = currentLabel ? ` La publicación vigente será la versión ${currentLabel.publicationVersion} (${currentLabel.title}).` : ' No hay una publicación vigente.'
    if (!window.confirm(`¿Publicar (simulada) «${draftTitle}»?${replacing}`)) return
    onError(null)
    onMessage(null)
    await onPublish(currentId)
    await refreshPublications()
  }

  const fork = async () => {
    const sourceId = selectedSummary?.id ?? (frozen ? draftId : null)
    const sourceVersion = selectedSummary ? selectedSummary.approvedVersion + 1 : draftVersion
    const sourceTitle = selectedSummary?.title ?? draftTitle
    if (!sourceId || !sourceVersion || (!selectedSummary && !frozen) || dirty || busy || working) return
    if (!window.confirm(`¿Crear un nuevo borrador desde «${sourceTitle}»? El documento de origen permanecerá sin cambios.`)) return
    onError(null)
    onMessage(null)
    onBusyChange(true)
    try {
      await onFork(sourceId, sourceVersion)
      setSelectedPublicationId('')
      setPreview(null)
    } finally {
      onBusyChange(false)
    }
  }

  const displayPreview = selectedSummary ? preview?.source === 'publication' && preview.id === selectedSummary.id ? preview : null : currentPreview

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
        disabled={!canApprove} onClick={() => void approve()}>Aprobar (simulada)</button>
      <button type="button" className="academic-scheduling__button" disabled={!canPublish}
        onClick={() => void publish()}>Publicar (simulada)</button>
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
        disabled={busy || working || dirty} onClick={() => void fork()}>Crear nuevo borrador</button>
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
    {!displayPreview && <p className="academic-publication__status">{selectedSummary
      ? 'Actualiza la vista previa para consultar esta publicación sin editarla.'
      : draftId ? `Propuesta actual · ${draftTitle} · versión ${draftVersion} · ${stateLabels[draftState]}${dirty ? ' · cambios locales sin guardar' : ''}. Actualiza la vista previa para continuar.`
        : 'Guarda una propuesta antes de consultar una vista previa.'}</p>}
  </details>
}

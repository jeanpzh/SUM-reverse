import { createPortal } from 'react-dom'
import { PlanningResultStrip } from './PlanningResultStrip'
import { PlanningFetchLoading } from '../components/PlanningFetchLoading'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '../components/ui/Button'
import { toast } from '../components/ui/Sonner'
import type { AcademicDraftState } from '../../../shared/programacion-academica-api.mjs'
import { aggregateAcademicBlocks, academicSectionCoverage, academicSectionLabel, formatAcademicDuration, formatAcademicMinute } from '../data/academicScheduling'
import {
  createPublicationFlowController,
  defaultPublicationFlowClient,
  derivePublicationView,
  nextAutoListRefreshReason,
  type PublicationFlowClient,
  type PublicationFlowState,
  type PublicationPreviewSource,
} from '../data/planningPublicationFlow'
import { activateEnrollmentOffer, fetchOperationalOffers } from '../data/enrollmentOffer'
import type { OperationalOffer, OperationalOfferCatalog } from '../data/enrollmentOffer'
import { usePlanningSessionContext } from '../components/PlanningSessionProvider'
import { usePlanningApprovalConfirm } from './PlanningApprovalDialog'
import './AcademicPublicationPanel.css'

type Props = {
  active?: boolean
  actionContainer?: HTMLElement | null
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
  flowClient?: PublicationFlowClient
  initialFlowState?: PublicationFlowState
}

export function AcademicPublicationHeaderActions({
  primaryActionId,
  canPublish,
  canApprove,
  draftVersion,
  reasonId,
  onPublish,
  onApprove,
}: {
  primaryActionId?: string
  canPublish: boolean
  canApprove: boolean
  draftVersion: number | null
  reasonId: string
  onPublish: () => void
  onApprove: () => void
}) {
  const publishIsPrimary = primaryActionId === 'publish'
  return (
    <>
      <Button
        type="button"
        variant={publishIsPrimary ? 'default' : 'outline'}
        id={publishIsPrimary ? 'planning-tour-primary' : undefined}
        className="academic-publication__publish"
        disabled={!canPublish}
        aria-describedby="academic-publish-reason"
        onClick={onPublish}
      >
        Publicar
      </Button>
      {primaryActionId === 'approve' && (
        <Button
          id="planning-tour-primary"
          disabled={!canApprove}
          aria-describedby={!canApprove ? reasonId : undefined}
          onClick={onApprove}
        >
          Aprobar versión {draftVersion}
        </Button>
      )}
    </>
  )
}

const days = ['—', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const stateLabels: Record<AcademicDraftState, string> = {
  draft: 'Borrador', 'ready-for-review': 'Lista para revisión', 'in-review': 'En revisión docente',
  'ready-for-approval': 'Lista para aprobación', approved: 'Aprobada (simulada)', published: 'Publicada (simulada)',
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString('es-PE')
}

type TeacherStatus = 'pending' | 'conformity' | 'changes-requested' | 'outdated'
type StepView = { tone: 'done' | 'now' | 'upcoming'; text: string; strong?: boolean }

// Glyph + text for every status (never color alone). Glyphs follow the Approval and Review boards.
const teacherLabels: Record<TeacherStatus, string> = { pending: 'Pendiente', conformity: 'Conforme', 'changes-requested': 'Observó cambios', outdated: 'Desactualizado' }
const teacherGlyphs: Record<TeacherStatus, string> = { pending: '·', conformity: '✓', 'changes-requested': '△', outdated: '○' }
const teacherSummaryLabels: Record<TeacherStatus, string> = { pending: 'pendientes', conformity: 'conformes', 'changes-requested': 'con cambios', outdated: 'desactualizadas' }
const teacherRank: Record<TeacherStatus, number> = { 'changes-requested': 0, outdated: 1, pending: 2, conformity: 3 }
const stateGlyphs: Record<AcademicDraftState, string> = { draft: '○', 'ready-for-review': '○', 'in-review': '◐', 'ready-for-approval': '●', approved: '✓', published: '✓' }
const shortStates: Record<AcademicDraftState, string> = {
  draft: 'Borrador', 'ready-for-review': 'Lista para revisión', 'in-review': 'En revisión', 'ready-for-approval': 'Lista', approved: 'Aprobada', published: 'Publicada',
}

// «14 nov 2026 · 18:20»; «—» when the contract carries no date for the row.
function versionDate(value: string | null | undefined) {
  const date = value ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) return '—'
  const day = date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '')
  return `${day} · ${date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

function AcademicPublicationPreviewDetails({
  displayPreview,
  hasSelectedPublication,
}: {
  displayPreview: PublicationPreviewSource
  hasSelectedPublication: boolean
}) {
  const blocks = useMemo(() => aggregateAcademicBlocks(displayPreview.schedule), [displayPreview])
  const cycleByCourse = useMemo(
    () => new Map(displayPreview.schedule.courses.map((course) => [course.courseId, course.cycle])),
    [displayPreview],
  )
  return (
    <details
      className="academic-publication__preview"
      key={`${displayPreview.source}-${displayPreview.id}-${displayPreview.version}`}
      open={hasSelectedPublication}
    >
      <summary>
        Vista previa de {displayPreview.source === 'publication' ? 'la publicación' : 'la propuesta'} ·{' '}
        {new Set(displayPreview.schedule.assignments.map((assignment) => assignment.sectionId)).size} secciones
      </summary>
      <p className="academic-publication__muted academic-publication__small">
        {displayPreview.title} · {displayPreview.schedule.schoolId} · {displayPreview.schedule.academicPeriod} ·{' '}
        {displayPreview.label}
        {hasSelectedPublication ? ' · solo lectura' : ` · ${stateLabels[displayPreview.state]}`}
      </p>
      <div className="academic-publication__table academic-publication__preview-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Asignatura</th>
              <th scope="col">Ciclo</th>
              <th scope="col">Sección</th>
              <th scope="col">Capacidad</th>
              <th scope="col">Docente</th>
              <th scope="col">Ambiente</th>
              <th scope="col">Día</th>
              <th scope="col">Horario</th>
              <th scope="col">Componentes</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => (
              <tr key={`${block.sectionId}-${block.day}-${block.startMinute}`}>
                <td className="academic-publication__mono">{block.courseId}</td>
                <td>{block.courseName}</td>
                <td className="academic-publication__mono">{cycleByCourse.get(block.courseId) ?? '—'}</td>
                <td className="academic-publication__mono">
                  {academicSectionLabel(displayPreview.schedule, block.sectionId)}
                </td>
                <td className="academic-publication__mono">{block.capacity ?? '—'}</td>
                <td>{block.teacherName}</td>
                <td>{block.roomNames.join(', ')}</td>
                <td>{days[block.day]}</td>
                <td className="academic-publication__mono">
                  {formatAcademicMinute(block.startMinute)}–{formatAcademicMinute(block.endMinute)} ·{' '}
                  {formatAcademicDuration(block.durationMinutes)}
                </td>
                <td>
                  {block.componentDetails
                    .map((component) => `${component.type} · ${formatAcademicDuration(component.durationMinutes)}`)
                    .join(' + ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function AcademicPublicationPanel({
  active = true,
  actionContainer,
  primaryActionId,
  draftId,
  draftVersion,
  draftTitle,
  draftState,
  dirty,
  busy,
  onApprove,
  onPublish,
  onFork,
  onError,
  onMessage,
  flowClient,
  initialFlowState,
}: Props) {
  const { state: session } = usePlanningSessionContext()
  const [confirmElement, openConfirm, confirm] = usePlanningApprovalConfirm()
  const scope = useMemo(() => ({ draftId, draftVersion, draftState, dirty }), [draftId, draftVersion, draftState, dirty])
  const resolvedFlowClient = flowClient ?? defaultPublicationFlowClient
  const [flow] = useState(() => createPublicationFlowController(resolvedFlowClient, scope, initialFlowState))
  const flowState = useSyncExternalStore(flow.subscribe, flow.getState, flow.getState)
  const [offerCatalog, setOfferCatalog] = useState<OperationalOfferCatalog | null>(null)
  const [offerError, setOfferError] = useState<string | null>(null)
  const [activation, setActivation] = useState<{ offer: OperationalOffer; reused: boolean } | null>(null)
  const [activating, setActivating] = useState(false)
  const activeRef = useRef(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    flow.mount()
    return () => flow.dispose()
  }, [flow])

  useEffect(() => {
    flow.syncScope(scope)
  }, [flow, scope])

  const flowView = derivePublicationView(flowState, { busy, activating, currentScope: scope })
  const {
    listLoading,
    listFresh,
    working,
    selectedSummary,
    currentPreview,
    publicationPreview,
    currentLabel,
    canApprove,
    canPublish,
    canActivate,
  } = flowView
  const { publicationList, listError, selectedPublicationId, previewError } = flowState
  const displayPreview = selectedSummary ? publicationPreview : currentPreview
  const frozen = draftState === 'approved' || draftState === 'published'
  const publishDisabledReason = draftState === 'published' ? 'Esta versión ya está publicada'
    : draftState !== 'approved' ? 'Primero aprueba la versión'
    : listError ? 'No se pudieron cargar las publicaciones. Reintenta actualizar el historial.'
    : !listFresh || listLoading ? 'Cargando publicaciones…'
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

  const autoListReason = flowView.scopeSynced ? nextAutoListRefreshReason(flowState, active) : null
  useEffect(() => {
    if (!autoListReason) return
    const timer = window.setTimeout(() => {
      void flow.refreshPublications(autoListReason, active)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [flow, autoListReason, active, flowState.scope])

  const previewTargetKey = selectedSummary
    ? `pub:${selectedSummary.id}:${selectedSummary.publicationVersion}`
    : draftId && draftVersion && !dirty
      ? `draft:${draftId}:${draftVersion}:${draftState}`
      : null
  useEffect(() => {
    if (!flowView.scopeSynced || !previewTargetKey) return
    const timer = window.setTimeout(() => {
      void flow.refreshPreview()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [flow, flowView.scopeSynced, previewTargetKey])

  const approve = () => {
    if (!canApprove || !draftId || !draftVersion) return
    openConfirm({
      title: `¿Aprobar la versión ${draftVersion}?`,
      description: `«${draftTitle}» queda aprobada (simulada) y congelada: no se podrá editar. Publicar requiere una confirmación independiente.`,
      confirmLabel: `Aprobar versión ${draftVersion}`,
      onConfirm: async () => {
        onError(null)
        onMessage(null)
        await onApprove()
      },
    })
  }

  const publish = () => {
    if (!canPublish || !publicationList) return
    const currentId = publicationList.currentId
    const replacing = currentLabel ? ` La publicación vigente será la versión ${currentLabel.publicationVersion} (${currentLabel.title}).` : ' No hay una publicación vigente.'
    openConfirm({
      title: `¿Publicar la versión ${draftVersion}?`,
      description: `La publicación (simulada) de «${draftTitle}» queda disponible para consulta y es inmutable. Publicar es una confirmación distinta de aprobar.${replacing}`,
      confirmLabel: `Publicar versión ${draftVersion}`,
      onConfirm: async () => {
        onError(null)
        onMessage(null)
        await onPublish(currentId)
        window.setTimeout(() => {
          if (flow.getState().scope.draftState === 'approved') {
            void flow.refreshPublications('manual', activeRef.current)
          }
        }, 0)
      },
    })
  }

  // Row action of the Versiones table: the source is the row's document (a frozen current draft or a publication).
  const fork = (sourceId: string, sourceVersion: number, sourceTitle: string) => {
    if (dirty || busy || working) return
    openConfirm({
      title: '¿Crear un nuevo borrador?',
      description: `¿Crear un nuevo borrador desde «${sourceTitle}»? El documento de origen permanecerá sin cambios.`,
      confirmLabel: 'Crear borrador',
      onConfirm: async () => {
        onError(null)
        onMessage(null)
        // The planning session tracks its own busy state for the new draft.
        await onFork(sourceId, sourceVersion)
        flow.selectPublication('')
        setActivation(null)
      },
    })
  }

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
        ? await resolvedFlowClient.fetchCurrentPublication() : await resolvedFlowClient.fetchPublication(selectedSummary.id)
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
        title: `¿Activar la publicación ${publication.publicationVersion}?`,
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

  // --- Derived view data (Approval board). Only data the client already holds: nothing is invented. ---
  const review = session.draft.review
  const proposal = session.proposal
  const draftSummary = session.draftList?.items.find((item) => item.id === draftId) ?? null
  const teachers = useMemo(() => review?.teachers ?? [], [review])
  const orderedTeachers = useMemo(() => teachers.map((teacher, index) => ({ teacher, index }))
    .sort((a, b) => teacherRank[a.teacher.status] - teacherRank[b.teacher.status] || a.index - b.index).map((item) => item.teacher), [teachers])
  const teacherCounts = useMemo(() => teachers.reduce((result, teacher) => ({ ...result, [teacher.status]: result[teacher.status] + 1 }),
    { pending: 0, conformity: 0, 'changes-requested': 0, outdated: 0 }), [teachers])
  const coverage = proposal ? academicSectionCoverage(proposal) : null
  const sectionTotal = proposal?.sections.length ?? 0
  const coverageOk = Boolean(proposal && coverage && proposal.coverageComplete && coverage.partial + coverage.pending === 0 && sectionTotal > 0)
  const responsesOk = teachers.length > 0 && teacherCounts.conformity === teachers.length
  const savedOk = Boolean(draftId && draftVersion && !dirty)
  const serverOk = Boolean(currentPreview && ['ready-for-approval', 'approved', 'published'].includes(currentPreview.state))
  const conditions = [
    { id: 'coverage', ok: coverageOk, label: 'Cobertura completa del horario', value: coverage ? `${coverage.complete} / ${sectionTotal}` : '—' },
    { id: 'responses', ok: responsesOk, label: 'Respuestas docentes vigentes y conformes', value: teachers.length ? `${teacherCounts.conformity} / ${teachers.length}` : '—' },
    { id: 'saved', ok: savedOk, label: 'Sin cambios sin guardar', value: draftVersion ? `v${draftVersion}` : '—' },
    { id: 'server', ok: serverOk, label: 'Versión lista para aprobación según el servidor', value: currentPreview ? shortStates[currentPreview.state] : previewError ? 'Error' : '…' },
  ]
  const approvalStep: StepView = draftState === 'approved' || draftState === 'published'
    ? { tone: 'done', text: 'Aprobada (simulada)' }
    : draftState === 'ready-for-approval' && !dirty ? { tone: 'now', text: canApprove ? 'Lista para aprobar' : approveDisabledReason, strong: canApprove }
    : { tone: 'upcoming', text: dirty ? 'Hay cambios sin guardar' : 'Completa la revisión docente' }
  const publishStep: StepView = draftState === 'published' ? { tone: 'done', text: 'Publicada (simulada)' }
    : canPublish ? { tone: 'now', text: 'Lista para publicar', strong: true }
    : { tone: 'upcoming', text: publishDisabledReason || 'Primero aprueba la versión' }
  const steps: Array<{ label: string; view: StepView }> = [
    { label: '01 · Borrador', view: draftId ? { tone: 'done', text: `Guardada como v${draftVersion}` } : { tone: 'now', text: 'Sin guardar', strong: true } },
    { label: '02 · Revisión docente', view: review ? { tone: responsesOk ? 'done' : 'now', text: `Ronda ${review.round} · ${teacherCounts.conformity} ${teacherCounts.conformity === 1 ? 'conforme' : 'conformes'}`, strong: !responsesOk }
      : { tone: 'upcoming', text: 'Sin enviar' } },
    { label: '03 · Aprobación', view: approvalStep },
    { label: '04 · Publicación', view: publishStep },
  ]
  const shownTeachers = orderedTeachers.slice(0, 5)
  const restTeachers = orderedTeachers.slice(5)
  const restSummary = restTeachers.length === 0 ? '' : restTeachers.every((teacher) => teacher.status === 'conformity') ? 'todas conformes'
    : (['changes-requested', 'outdated', 'pending', 'conformity'] as const).map((status) => ({ status, count: restTeachers.filter((teacher) => teacher.status === status).length }))
      .filter((item) => item.count > 0).map((item) => `${item.count} ${teacherSummaryLabels[item.status]}`).join(', ')

  // Versiones: the current draft plus the publications of the local history (a published draft is one row).
  const publicationItems = publicationList?.items.filter((item) => item.id !== draftId) ?? []
  const currentPublication = publicationList?.items.find((item) => item.id === draftId) ?? null
  const reasonId = draftState === 'approved' || draftState === 'published' ? 'academic-publish-reason' : 'academic-approve-reason'
  const approveReasonText = draftState === 'ready-for-approval' ? approveDisabledReason : 'La versión debe estar lista para aprobación'

  return <section className="academic-publication" aria-label="Aprobación y publicación simuladas">
    <PlanningResultStrip status={dirty ? 'incomplete' : draftState} label={stateLabels[draftState]}
      facts={[draftVersion ? `Versión ${draftVersion}` : 'Sin versión guardada', dirty ? 'Cambios sin guardar' : draftId ? 'Guardada' : 'Sin guardar']} />
    {actionContainer && createPortal(<AcademicPublicationHeaderActions primaryActionId={primaryActionId} canPublish={canPublish}
      canApprove={canApprove} draftVersion={draftVersion} reasonId={reasonId} onPublish={publish} onApprove={approve} />, actionContainer)}

    <ol className="academic-publication__steps" aria-label="Ciclo de la versión">
      {steps.map((step, index) => <li key={step.label} className="academic-publication__step" data-tone={step.view.tone} aria-current={step.view.tone === 'now' ? 'step' : undefined}>
        <span className="academic-publication__eyebrow" data-current={step.view.tone === 'now' || undefined}>{step.label}</span>
        <span id={index === 3 ? 'academic-publish-reason' : index === 2 ? 'academic-approve-reason' : undefined}
          data-muted={step.view.tone === 'upcoming' || undefined} data-strong={step.view.strong || undefined}>{step.view.text}</span>
      </li>)}
    </ol>
    {!actionContainer && draftState === 'approved' && <p className="academic-publication__note">{publishDisabledReason || approveReasonText}</p>}

    <div className="academic-publication__columns">
      <section aria-labelledby="academic-readiness-title">
        <h2 id="academic-readiness-title">Condiciones para aprobar</h2>
        <p className="academic-publication__muted">{draftVersion ? `Calculadas con los datos guardados de la versión ${draftVersion}.` : 'Guarda una propuesta para calcularlas.'}</p>
        {conditions.map((condition) => <div className="academic-publication__check" key={condition.id} data-ok={condition.ok || undefined}>
          <span aria-hidden="true">{condition.ok ? '✓' : '○'}</span>
          <span>{condition.label}<span className="sr-only">: {condition.ok ? 'cumple' : 'pendiente'}</span></span>
          <span className="academic-publication__mono">{condition.value}</span>
        </div>)}
        <details className="academic-publication__evidence">
          <summary>Ver evidencia de cada condición</summary>
          <ul>
            <li>Cobertura: {coverage ? `${coverage.complete} secciones completas, ${coverage.partial} parciales y ${coverage.pending} pendientes.` : 'sin propuesta cargada.'}</li>
            <li>Respuestas: {review ? `ronda ${review.round}, enviada ${dateLabel(review.submittedAt)} sobre la versión ${review.submittedVersion}; conformes: ${teacherCounts.conformity}, con cambios: ${teacherCounts['changes-requested']}, desactualizadas: ${teacherCounts.outdated}, pendientes: ${teacherCounts.pending}.` : 'sin revisión enviada.'}</li>
            <li>Guardado: {draftVersion ? `versión ${draftVersion}${dirty ? ', con cambios locales sin guardar' : ', sin cambios locales'}.` : 'sin versión guardada.'}</li>
            <li>Servidor: {currentPreview ? `la vista previa de la versión ${currentPreview.version} indica «${stateLabels[currentPreview.state]}».` : previewError ? 'la vista previa no se pudo cargar.' : 'la vista previa aún no se cargó.'}</li>
          </ul>
        </details>
      </section>
      <section aria-labelledby="academic-responses-title">
        <div className="academic-publication__section-head">
          <h2 id="academic-responses-title">Respuestas docentes</h2>
          <Link to="/local/programacion-academica" search={{ etapa: 'revision' }}>Abrir revisión</Link>
        </div>
        <p className="academic-publication__muted">{review ? `Ronda ${review.round} sobre la instantánea v${review.submittedVersion}.` : 'Aún no se envió a revisión.'}</p>
        {review && <div className="academic-publication__table">
          <table aria-label={`Respuestas docentes, ronda ${review.round}`}>
            <thead><tr><th scope="col">Docente</th><th scope="col">Estado</th><th scope="col">Observación</th></tr></thead>
            <tbody>
              {shownTeachers.map((teacher) => <tr key={teacher.teacherId}>
                <td>{teacher.teacherName}</td>
                <td><span className="academic-publication__status" data-status={teacher.status}><span aria-hidden="true">{teacherGlyphs[teacher.status]}</span>{teacherLabels[teacher.status]}</span></td>
                <td className={teacher.observation ? 'academic-publication__wrap' : 'academic-publication__muted'}>{teacher.observation || '—'}</td>
              </tr>)}
              {restTeachers.length > 0 && <tr><td colSpan={3} className="academic-publication__muted academic-publication__small">{restTeachers.length} más · {restSummary}</td></tr>}
              {teachers.length === 0 && <tr><td colSpan={3} className="academic-publication__muted">La revisión no tiene docentes.</td></tr>}
            </tbody>
          </table>
        </div>}
      </section>
    </div>

    <section aria-labelledby="academic-versions-title" className="academic-publication__versions">
      <h2 id="academic-versions-title">Versiones</h2>
      <div className="academic-publication__table">
        <table aria-label="Versiones de la propuesta">
          <thead><tr><th scope="col">Versión</th><th scope="col">Estado</th><th scope="col">Guardada</th><th scope="col">Cobertura</th><th scope="col"><span className="sr-only">Acción</span></th></tr></thead>
          <tbody>
            {draftId && draftVersion && <tr>
              <td className="academic-publication__mono">v{draftVersion}</td>
              <td><span className="academic-publication__status" data-status={draftState}><span aria-hidden="true">{stateGlyphs[draftState]}</span>
                {draftState === 'published' && currentPublication ? `Publicada · ${currentPublication.id === publicationList?.currentId ? 'Vigente' : 'Anterior'}` : stateLabels[draftState]}{dirty ? ' · cambios sin guardar' : ''}</span></td>
              <td className="academic-publication__mono academic-publication__muted">{versionDate(draftSummary?.updatedAt)}</td>
              <td className="academic-publication__mono">{coverage && !dirty ? `${coverage.complete} / ${sectionTotal}` : '—'}</td>
              <td className="academic-publication__action"><span className="academic-publication__muted">Actual</span>
                {frozen && <button type="button" className="academic-publication__button" disabled={busy || working || dirty}
                  aria-label={`Crear nuevo borrador desde la versión ${draftVersion}`} onClick={() => fork(draftId, draftVersion, draftTitle)}>Crear nuevo borrador</button>}</td>
            </tr>}
            {publicationItems.map((item) => <tr key={item.id}>
              <td className="academic-publication__wrap"><span className="academic-publication__mono">v{item.approvedVersion}</span> <span className="academic-publication__muted">{item.title} · publicación {item.publicationVersion}</span></td>
              <td><span className="academic-publication__status" data-status="published"><span aria-hidden="true">✓</span>Publicada · {item.id === publicationList?.currentId ? 'Vigente' : 'Anterior'}</span></td>
              <td className="academic-publication__mono academic-publication__muted">{versionDate(item.publishedAt)}</td>
              <td className="academic-publication__mono">—</td>
              <td className="academic-publication__action"><button type="button" className="academic-publication__button" disabled={busy || working || dirty}
                aria-label={`Crear nuevo borrador desde la publicación ${item.publicationVersion}`} onClick={() => fork(item.id, item.approvedVersion + 1, item.title)}>Crear nuevo borrador</button></td>
            </tr>)}
            {!draftId && publicationItems.length === 0 && <tr><td colSpan={5} className="academic-publication__muted">Aún no hay versiones guardadas ni publicadas.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="academic-publication__small academic-publication__muted">Una versión publicada es de solo lectura. Para cambiarla se crea un nuevo borrador; la versión anterior permanece intacta.</p>
    </section>

    <section aria-labelledby="academic-publications-title" className="academic-publication__publications">
      <div className="academic-publication__toolbar">
        <h2 id="academic-publications-title">Publicaciones</h2>
        <label className="academic-publication__history"><span className="academic-publication__muted">Consultar publicación</span>
          <select id="academic-publication-select" aria-label="Consultar publicación" value={selectedPublicationId} disabled={working || busy}
            onChange={(event) => { flow.selectPublication(event.currentTarget.value); setActivation(null); setOfferError(null) }}>
            <option value="">Propuesta actual · {draftTitle}</option>
            {publicationList?.items.map((item) => <option key={item.id} value={item.id}>
              {item.id === publicationList.currentId ? 'Vigente' : 'Anterior'} · Publicación {item.publicationVersion} · {item.title} · {dateLabel(item.publishedAt)}
            </option>)}
          </select>
        </label>
        <span className="academic-publication__spacer" />
        <button type="button" className="academic-publication__button" disabled={working || busy || listLoading}
          onClick={() => void flow.refreshPublications('manual', active)}>{listLoading ? 'Actualizando…' : 'Actualizar publicaciones'}</button>
        <button type="button" className="academic-publication__button" disabled={working || busy || (!selectedSummary && !draftId)}
          onClick={() => void flow.refreshPreview()}>{working ? 'Consultando…' : !selectedSummary && previewError ? 'Reintentar vista previa' : 'Actualizar vista previa'}</button>
      </div>
      {publicationList && <p className="academic-publication__note" role="status">{publicationList.currentId
        ? `Vigente: publicación ${currentLabel?.publicationVersion ?? '—'} · ${currentLabel?.title ?? publicationList.currentId}.`
        : 'No hay una publicación vigente.'}</p>}
      {listLoading && <PlanningFetchLoading label="Cargando publicaciones…" layout="table" />}
      {working && <PlanningFetchLoading label="Consultando vista previa…" layout="publication-table" />}
      {listError && <div className="academic-publication__alert" role="alert">
        <span aria-hidden="true">△</span>
        <span>No se pudo actualizar el historial: {listError}</span>
        <button type="button" className="academic-publication__button academic-publication__button--paper"
          disabled={working || busy || listLoading} onClick={() => void flow.refreshPublications('manual', active)}>
          Reintentar publicaciones
        </button>
      </div>}
      {previewError && <div className="academic-publication__alert" role="alert"><span aria-hidden="true">△</span>No se pudo consultar la vista previa: {previewError}</div>}
      {selectedSummary && <p className="academic-publication__note">{selectedSummary.id === publicationList?.currentId ? 'Vigente' : 'Anterior'} · publicación {selectedSummary.publicationVersion} · publicada {dateLabel(selectedSummary.publishedAt)} · versión aprobada {selectedSummary.approvedVersion}</p>}
      <details className="academic-publication__scope" open>
        <summary>Alcance de la activación · simulación local</summary>
        <div className="academic-publication__scope-row">
          <span className="academic-publication__scope-text">Acciones de la simulación local sobre la matrícula 2027-I. Prototipo sin autenticación ni efecto oficial; activar crea un contexto sintético para una publicación de Sistemas 2027-I, sin modificar la publicación ni las matrículas de otras ofertas.</span>
          <button type="button" className="academic-publication__button academic-publication__button--paper" disabled={activating || busy} onClick={() => void refreshOffers()}>{activating ? 'Procesando…' : 'Actualizar ofertas operativas'}</button>
          <button type="button" className="academic-publication__button academic-publication__button--paper" disabled={!canActivate} onClick={() => void activatePublication()}>{activating ? 'Activando…' : 'Activar publicación seleccionada'}</button>
        </div>
        <p className="academic-publication__note">{!selectedSummary
          ? 'Selecciona una publicación de Sistemas 2027-I y espera su vista previa para activar una oferta operativa.'
          : !publicationPreview ? 'Espera la vista previa vigente de la publicación de Sistemas 2027-I para activar una oferta operativa.'
          : !canActivate ? 'La activación requiere una publicación de Sistemas 2027-I con vista previa vigente.'
          : 'La publicación de Sistemas 2027-I tiene vista previa vigente y puede activarse como oferta operativa.'}</p>
        {offerError && <div className="academic-publication__alert" role="alert"><span aria-hidden="true">△</span>{offerError}</div>}
        {activation && <p className="academic-publication__note" role="status">
          Origen: {activation.offer.publicationId} · publicación {activation.offer.publicationVersion} · oferta {activation.offer.offerVersion} · ejecución {activation.offer.runId}.
          {' '}<a href={`/local/login?runId=${encodeURIComponent(activation.offer.runId)}`}>Abrir matrícula 2027-I</a>
        </p>}
        {offerCatalog && <div className="academic-publication__note" aria-label="Ofertas operativas disponibles">
          <p>{offerCatalog.activeRunId ? `Ejecución activa: ${offerCatalog.activeRunId}.` : 'No hay oferta operativa activa.'}</p>
          {offerCatalog.items.map((offer) => <p key={offer.runId}>
            <a href={`/local/login?runId=${encodeURIComponent(offer.runId)}`}>Abrir matrícula 2027-I · oferta {offer.offerVersion}</a>
            {' '}<span>Origen {offer.publicationId} · publicación {offer.publicationVersion} · {offer.courseCount} cursos · {offer.sectionCount} secciones</span>
          </p>)}
        </div>}
      </details>
      {displayPreview ? (
        <AcademicPublicationPreviewDetails displayPreview={displayPreview} hasSelectedPublication={Boolean(selectedSummary)} />
      ) : <p className="academic-publication__note">{selectedSummary
        ? 'La vista previa de esta publicación se carga automáticamente; puedes reintentar si falla.'
        : draftId ? `Propuesta actual · ${draftTitle} · versión ${draftVersion} · ${stateLabels[draftState]}${dirty ? ' · cambios locales sin guardar' : ''}. La vista previa se carga al guardar los cambios.`
          : 'Guarda una propuesta antes de consultar una vista previa.'}</p>}
    </section>
    {confirmElement}
  </section>
}

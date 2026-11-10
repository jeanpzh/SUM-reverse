import { resolvePlanningNormative, workspaceNormativeContext } from './normative-planning.js'
import { randomUUID } from 'node:crypto'
import { HttpException, Injectable } from '@nestjs/common'
import { validateAcademicDraftList, validateAcademicDraftSaveRequest, validateAcademicPublication, validateAcademicPublicationList, validateAcademicPublicationRequest, validateAcademicReleasePreview, validateAcademicScheduleSnapshot, validateAcademicReviewDecision, validateAcademicReviewSubmission, validateAcademicSavedDraft } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicDraftList, AcademicDraftSaveRequest, AcademicSavedDraft, AcademicReviewDecision, AcademicTeacherReview, AcademicPublication, AcademicPublicationList, AcademicPublicationRequest, AcademicReleasePreview } from '../../../shared/programacion-academica-api.mjs'
import { DemoProposalService } from './demo-proposal.service.js'
import type { TrustedDraftRetention } from './demo-proposal.service.js'
import { SavedDraftStore, SavedDraftStoreError } from './saved-draft-store.js'
import type { PersistedDraft } from './saved-draft-store.js'
import { hasCompleteNonemptyProposal, isReviewReady, makeReviewTeacher, reviewEvent, reviewMatchesSnapshot, teacherFingerprints } from './teacher-review.js'
import { approvalFingerprint, createScheduleSnapshot } from './academic-release.js'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
    : JSON.stringify(value) ?? 'undefined'

@Injectable()
export class SavedDraftService {
  private readonly store = new SavedDraftStore()

  constructor(private readonly proposals: DemoProposalService) {}

  list(): Promise<AcademicDraftList> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      let entries: ReturnType<SavedDraftStore['list']>
      try { entries = this.store.list() } catch (error) { this.rethrowStoreError(error) }
      const items: AcademicDraftList['items'] = []
      let unavailableCount = 0
      for (const entry of entries) {
        const payload = entry.payload
        if (!payload || !this.isValidPayload(payload, entry.id)) { unavailableCount++; continue }
        const draft = payload.document as AcademicSavedDraft
        items.push({ id: draft.id, version: draft.version, title: draft.title, state: draft.state,
          schoolId: draft.configuration.schoolId, academicPeriod: draft.configuration.academicPeriod,
          createdAt: draft.createdAt, updatedAt: draft.updatedAt, hasSchedule: Boolean(draft.proposal?.assignments.length) })
      }
      items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))
      const result = { items: items.slice(0, 50), unavailableCount: Math.min(1000, unavailableCount + Math.max(0, items.length - 50)) }
      validateAcademicDraftList(result)
      return result
    })
  }

  save(value: unknown): Promise<AcademicSavedDraft> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      try { validateAcademicDraftSaveRequest(value) } catch { throw this.httpError(400, 'INVALID_REQUEST', 'Solicitud de guardado inválida') }
      const request = value as AcademicDraftSaveRequest
      const id = request.id ?? randomUUID()
      let entries: ReturnType<SavedDraftStore['list']>
      try { entries = this.store.list() } catch (error) { this.rethrowStoreError(error) }
      if (!request.id && entries.some((entry) => entry.id === id)) throw this.httpError(409, 'DRAFT_ID_CONFLICT', 'No se pudo asignar un identificador nuevo')
      let previous: PersistedDraft | null = null
      try { previous = request.id ? this.store.read(id) : null }
      catch (error) { this.rethrowStoreError(error) }
      if (request.id && !previous) throw this.httpError(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
      if (request.id && previous && !this.isValidPayload(previous, id)) throw this.httpError(409, 'DRAFT_CORRUPT', 'La propuesta guardada no superó su validación')
      const previousDraft = previous?.document as AcademicSavedDraft | undefined
      if (previousDraft && previousDraft.version !== request.expectedVersion) throw this.httpError(409, 'VERSION_MISMATCH', 'La propuesta cambió en otra sesión; recárgala antes de guardar')
      if (previousDraft && this.isLocked(previousDraft)) throw this.httpError(409, 'DRAFT_LOCKED', 'La propuesta aprobada o publicada es inmutable; crea un nuevo borrador para editarla')
      if (!request.id && entries.length >= 50) throw this.httpError(429, 'DRAFT_CAPACITY', 'Se alcanzó el máximo de propuestas guardadas')
      const validated = this.proposals.validateDraftWorkspace(request.configuration)
      let retained: TrustedDraftRetention | null = null
      let proposal = null
      if (request.proposalId !== null && request.proposalEditVersion !== null) {
        retained = this.proposals.captureDraftRetention(request.proposalId, request.proposalEditVersion, request.configuration)
        proposal = retained.view
      }
      const now = new Date().toISOString()
      const draft: AcademicSavedDraft = {
        id,
        version: (previousDraft?.version ?? 0) + 1,
        title: request.title,
        state: request.state,
        createdAt: previousDraft?.createdAt ?? now,
        updatedAt: now,
        configuration: structuredClone(request.configuration),
        demandBase: validated.demandBase,
        proposal: proposal ? structuredClone(proposal) : null,
      }
      if (previousDraft?.origin) draft.origin = structuredClone(previousDraft.origin)
      if (previousDraft?.review) {
        draft.review = structuredClone(previousDraft.review)
        this.synchronizeReview(draft)
        draft.state = !draft.proposal || !hasCompleteNonemptyProposal(draft.proposal) ? 'draft'
          : (isReviewReady(draft) ? 'ready-for-approval' : 'in-review')
      }
      try { validateAcademicSavedDraft(draft) } catch { throw this.httpError(422, 'DRAFT_INVALID', 'La propuesta no cumple los criterios de validación') }
      const payload: PersistedDraft = { schemaVersion: 1, catalogFingerprint: this.proposals.getCatalogFingerprint(), document: draft, retained }
      if (!this.isValidPayload(payload, id)) throw this.httpError(422, 'DRAFT_INVALID', 'La propuesta no supera la validación del catálogo actual')
      try { this.store.write(id, payload) } catch (error) { this.rethrowStoreError(error) }
      return structuredClone(draft)
    })
  }

  resume(id: string, value: unknown): Promise<{ draft: AcademicSavedDraft }> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      if (!uuidPattern.test(id)) throw this.httpError(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1
        || !Number.isSafeInteger((value as Record<string, unknown>).expectedVersion) || ((value as Record<string, unknown>).expectedVersion as number) < 1) {
        throw this.httpError(400, 'INVALID_REQUEST', 'Se requiere la versión esperada de la propuesta')
      }
      let payload: PersistedDraft | null
      try { payload = this.store.read(id) } catch (error) { this.rethrowStoreError(error) }
      if (!payload) throw this.httpError(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
      if (!this.isValidPayload(payload, id)) throw this.httpError(409, 'DRAFT_CORRUPT', 'La propuesta guardada no superó su validación')
      const draft = structuredClone(payload.document as AcademicSavedDraft)
      if (draft.version !== (value as { expectedVersion: number }).expectedVersion) throw this.httpError(409, 'VERSION_MISMATCH', 'La propuesta cambió en otra sesión; recárgala antes de continuar')
      if (this.isLocked(draft)) return { draft }
      let restored = null
      if (payload.retained !== null) {
        restored = this.proposals.restoreDraftRetention(payload.retained as TrustedDraftRetention, draft.configuration)
      }
      draft.proposal = restored
      return { draft }
    })
  }

  preview(id: string): Promise<AcademicReleasePreview> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      const { draft } = this.readStoredDraft(id)
      let schedule
      try {
        schedule = createScheduleSnapshot(this.proposals.getCatalog(), draft)
        validateAcademicScheduleSnapshot(schedule)
      } catch (error) {
        throw this.httpError(422, 'RELEASE_INCOMPLETE', error instanceof Error ? error.message : 'Se requiere un horario completo y válido')
      }
      const result: AcademicReleasePreview = { id: draft.id, version: draft.version, title: draft.title, state: draft.state, schedule }
      validateAcademicReleasePreview(result)
      return result
    })
  }

  approve(id: string, value: unknown): Promise<{ draft: AcademicSavedDraft }> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      const expectedVersion = this.expectedVersion(value)
      const { payload, draft } = this.readStoredDraft(id)
      if (draft.version !== expectedVersion) throw this.httpError(409, 'VERSION_MISMATCH', 'La propuesta cambió; recárgala antes de aprobar')
      if (this.isLocked(draft)) throw this.httpError(409, 'DRAFT_LOCKED', 'La propuesta ya fue aprobada o publicada')
      if (draft.state !== 'ready-for-approval' || !isReviewReady(draft) || !draft.review?.teachers.length
        || draft.review.teachers.some((teacher) => teacher.status !== 'conformity')) {
        throw this.httpError(422, 'APPROVAL_NOT_READY', 'Se requiere un horario completo con todas las conformidades vigentes')
      }
      try { validateAcademicScheduleSnapshot(createScheduleSnapshot(this.proposals.getCatalog(), draft)) }
      catch (error) { throw this.httpError(422, 'APPROVAL_NOT_READY', error instanceof Error ? error.message : 'El horario no está listo para aprobar') }

      const now = new Date().toISOString()
      const sourceVersion = draft.version
      draft.version += 1
      draft.updatedAt = now
      draft.state = 'approved'
      draft.approval = { sourceVersion, approvedVersion: draft.version, approvedAt: now, fingerprint: approvalFingerprint(draft) }
      this.writeReleaseDraft(payload, draft)
      return { draft: structuredClone(draft) }
    })
  }

  publish(id: string, value: unknown): Promise<{ draft: AcademicSavedDraft }> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      try { validateAcademicPublicationRequest(value) }
      catch { throw this.httpError(400, 'INVALID_REQUEST', 'Solicitud de publicación inválida') }
      const request = value as AcademicPublicationRequest
      const { payload, draft } = this.readStoredDraft(id)
      if (draft.version !== request.expectedVersion) throw this.httpError(409, 'VERSION_MISMATCH', 'La propuesta cambió; recárgala antes de publicar')
      if (draft.state === 'published') throw this.httpError(409, 'DRAFT_LOCKED', 'La propuesta ya fue publicada')
      if (draft.state !== 'approved' || !draft.approval) throw this.httpError(422, 'PUBLICATION_NOT_APPROVED', 'Solo se pueden publicar propuestas aprobadas')

      const records = this.readPublicationRecords()
      const currentId = records.length ? records[0]!.draft.id : null
      if (request.expectedCurrentId !== currentId) throw this.httpError(409, 'PUBLICATION_CURRENT_CHANGED', 'La publicación vigente cambió; actualiza la lista antes de publicar')
      const publicationVersion = records.reduce((highest, record) => Math.max(highest, record.draft.publication!.publicationVersion), 0) + 1
      let snapshot
      try {
        if (approvalFingerprint(draft) !== draft.approval.fingerprint) throw new Error('La huella de aprobación no coincide con el contenido congelado')
        snapshot = createScheduleSnapshot(this.proposals.getCatalog(), draft)
        validateAcademicScheduleSnapshot(snapshot)
      } catch (error) {
        throw this.httpError(409, 'DRAFT_CORRUPT', error instanceof Error ? error.message : 'La propuesta aprobada no superó la validación')
      }

      const blockers = resolvePlanningNormative(workspaceNormativeContext(draft.configuration), draft.configuration.request.resources.teachers)
        .report(snapshot.assignments).blockers
      if (blockers.length) throw new HttpException({ error: { code: 'LOAD_AUTHORIZATION_REQUIRED',
        message: 'Falta registrar la autorización formal de carga docente o corregir las asignaciones antes de publicar.', blockers } }, 409)

      const now = new Date().toISOString()
      draft.version += 1
      draft.updatedAt = now
      draft.state = 'published'
      draft.publication = { publicationVersion, publishedAt: now }
      this.writeReleaseDraft(payload, draft)
      return { draft: structuredClone(draft) }
    })
  }

  fork(id: string, value: unknown): Promise<{ draft: AcademicSavedDraft }> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      const expectedVersion = this.expectedVersion(value)
      const { payload, draft: source } = this.readStoredDraft(id)
      if (source.version !== expectedVersion) throw this.httpError(409, 'VERSION_MISMATCH', 'La propuesta cambió; recárgala antes de crear un borrador')
      if (!this.isLocked(source)) throw this.httpError(422, 'DRAFT_NOT_FROZEN', 'Solo una propuesta aprobada o publicada puede originar otro borrador')

      const entries = this.readStoreEntries()
      if (entries.length >= 50) throw this.httpError(429, 'DRAFT_CAPACITY', 'Se alcanzó el máximo de propuestas guardadas')
      let newId = randomUUID()
      if (entries.some((entry) => entry.id === newId)) throw this.httpError(409, 'DRAFT_ID_CONFLICT', 'No se pudo asignar un identificador nuevo')
      let proposal = null
      let retained: TrustedDraftRetention | null = null
      if (payload.retained !== null) {
        const restored = this.proposals.restoreDraftRetention(payload.retained as TrustedDraftRetention, source.configuration)
        proposal = structuredClone(restored)
        retained = this.proposals.captureDraftRetention(restored.proposalId, restored.editVersion ?? 0, source.configuration)
      } else {
        throw this.httpError(409, 'DRAFT_CORRUPT', 'La propuesta aprobada no conserva una fuente de horario confiable')
      }

      const now = new Date().toISOString()
      const forkTitle = `${source.title} (nuevo borrador)`.slice(0, 100)
      const fork: AcademicSavedDraft = {
        id: newId,
        version: 1,
        title: forkTitle,
        state: 'draft',
        createdAt: now,
        updatedAt: now,
        configuration: structuredClone(source.configuration),
        demandBase: structuredClone(source.demandBase),
        proposal,
        origin: { draftId: source.id, version: source.version, publicationVersion: source.publication?.publicationVersion ?? null },
      }
      try { validateAcademicSavedDraft(fork) } catch { throw this.httpError(409, 'DRAFT_CORRUPT', 'No se pudo validar el nuevo borrador') }
      const nextPayload: PersistedDraft = { schemaVersion: 1, catalogFingerprint: this.proposals.getCatalogFingerprint(), document: fork, retained }
      if (!this.isValidPayload(nextPayload, newId)) throw this.httpError(409, 'DRAFT_CORRUPT', 'El nuevo borrador no superó la validación local')
      try { this.store.write(newId, nextPayload) } catch (error) { this.rethrowStoreError(error) }
      return { draft: structuredClone(fork) }
    })
  }

  publications(): Promise<AcademicPublicationList> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      const records = this.readPublicationRecords()
      const items = records.map(({ draft }) => this.publicationSummary(draft))
      const result: AcademicPublicationList = { currentId: records[0]?.draft.id ?? null, items }
      try { validateAcademicPublicationList(result) } catch { throw this.httpError(409, 'DRAFT_CORRUPT', 'El historial de publicaciones no superó su validación') }
      return result
    })
  }

  currentPublication(): Promise<AcademicPublication> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      const current = this.readPublicationRecords()[0]
      if (!current) throw this.httpError(404, 'PUBLICATION_NOT_FOUND', 'No hay una publicación vigente')
      return this.publicationFromDraft(current.draft)
    })
  }

  getPublication(id: string): Promise<AcademicPublication> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      const { draft } = this.readStoredDraft(id)
      if (draft.state !== 'published') throw this.httpError(404, 'PUBLICATION_NOT_FOUND', 'No se encontró la publicación')
      return this.publicationFromDraft(draft)
    })
  }

  submitReview(id: string, value: unknown): Promise<{ draft: AcademicSavedDraft }> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      if (!uuidPattern.test(id)) throw this.httpError(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
      try { validateAcademicReviewSubmission(value) } catch { throw this.httpError(400, 'INVALID_REQUEST', 'Solicitud de envío a revisión inválida') }
      const { payload, draft } = this.readReviewDraft(id, (value as { expectedVersion: number }).expectedVersion)
      if (!hasCompleteNonemptyProposal(draft.proposal)) throw this.httpError(422, 'REVIEW_INCOMPLETE', 'Se requiere un horario completo y validado para enviarlo a revisión')
      if (draft.state !== 'draft' && draft.state !== 'ready-for-review' && draft.state !== 'in-review' && draft.state !== 'ready-for-approval') {
        throw this.httpError(422, 'REVIEW_NOT_SUBMITTED', 'La propuesta no está lista para revisión')
      }
      const now = new Date().toISOString()
      const version = draft.version + 1
      const round = (draft.review?.round ?? 0) + 1
      const fingerprints = teacherFingerprints(draft)
      const previousTeachers = new Map((draft.review?.teachers ?? []).map((teacher) => [teacher.teacherId, teacher]))
      const teachers = [...fingerprints].map(([teacherId, current]) => {
        const previous = previousTeachers.get(teacherId)
        if (previous?.status === 'conformity' && previous.fingerprint === current.fingerprint) return structuredClone(previous)
        return makeReviewTeacher(teacherId, current.teacherName, current.fingerprint)
      })
      const history = [...(draft.review?.history ?? [])]
      this.requireHistoryCapacity(history, 1)
      history.push(reviewEvent('submitted', version, round, now))
      draft.version = version
      draft.updatedAt = now
      draft.review = { round, submittedVersion: version, submittedAt: now, teachers, history }
      draft.state = isReviewReady(draft) ? 'ready-for-approval' : 'in-review'
      this.writeReviewDraft(payload, draft)
      return { draft: structuredClone(draft) }
    })
  }

  decideReview(id: string, value: unknown): Promise<{ draft: AcademicSavedDraft }> {
    return this.store.exclusive(() => {
      this.requireConfigured()
      if (!uuidPattern.test(id)) throw this.httpError(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
      try { validateAcademicReviewDecision(value) } catch { throw this.httpError(400, 'INVALID_REQUEST', 'Respuesta docente inválida') }
      const decision = value as AcademicReviewDecision
      const { payload, draft } = this.readReviewDraft(id, decision.expectedVersion)
      const review = draft.review
      if (!review || !review.round) throw this.httpError(422, 'REVIEW_NOT_SUBMITTED', 'La propuesta no se ha enviado a revisión')
      if (!hasCompleteNonemptyProposal(draft.proposal)) throw this.httpError(422, 'REVIEW_INCOMPLETE', 'Se requiere un horario completo y validado para responder')
      if (decision.round !== review.round) throw this.httpError(409, 'REVIEW_ROUND_MISMATCH', 'La ronda de revisión cambió; recarga la propuesta')
      const teacher = review.teachers.find((item) => item.teacherId === decision.teacherId)
      if (!teacher) throw this.httpError(422, 'TEACHER_NOT_ASSIGNED', 'El docente no está asignado al horario actual')
      if (teacher.status === 'outdated') throw this.httpError(422, 'TEACHER_REVIEW_OUTDATED', 'El horario del docente cambió; vuelve a enviarlo a revisión')
      const current = teacherFingerprints(draft).get(teacher.teacherId)
      if (!current || current.fingerprint !== teacher.fingerprint) throw this.httpError(422, 'TEACHER_REVIEW_OUTDATED', 'El horario del docente cambió; vuelve a enviarlo a revisión')
      const now = new Date().toISOString()
      const version = draft.version + 1
      this.requireHistoryCapacity(review.history, 1)
      teacher.status = decision.decision
      teacher.observation = decision.observation
      teacher.decisionVersion = version
      teacher.decidedAt = now
      review.history.push(reviewEvent('decision', version, review.round, now, teacher.teacherId, teacher.fingerprint, decision.decision, decision.observation))
      draft.version = version
      draft.updatedAt = now
      draft.state = isReviewReady(draft) ? 'ready-for-approval' : 'in-review'
      this.writeReviewDraft(payload, draft)
      return { draft: structuredClone(draft) }
    })
  }

  private isValidPayload(payload: PersistedDraft, id: string): boolean {
    try {
      if (!payload || typeof payload !== 'object' || Object.keys(payload).sort().join(',') !== 'catalogFingerprint,document,retained,schemaVersion'
        || payload.schemaVersion !== 1 || !this.proposals.acceptsCatalogFingerprint(payload.catalogFingerprint)) return false
      const draft = payload.document as AcademicSavedDraft
      validateAcademicSavedDraft(draft)
      if (draft.id !== id) return false
      if (this.isLocked(draft)) {
        if (!draft.approval || approvalFingerprint(draft) !== draft.approval.fingerprint) return false
        const normalized = structuredClone(draft)
        normalized.state = 'ready-for-approval'
        delete normalized.approval
        delete normalized.publication
        if (!reviewMatchesSnapshot(normalized)) return false
        try { validateAcademicScheduleSnapshot(createScheduleSnapshot(this.proposals.getCatalog(), draft)) } catch { return false }
      } else if (!reviewMatchesSnapshot(draft)) return false
      const trusted = this.proposals.validateDraftWorkspace(draft.configuration)
      if (canonical(trusted.demandBase) !== canonical(draft.demandBase)) return false
      if (payload.retained === null) return draft.proposal === null
      if (!payload.retained || typeof payload.retained !== 'object' || Array.isArray(payload.retained)) return false
      const retained = payload.retained as TrustedDraftRetention
      if (Object.keys(retained).sort().join(',') !== 'automaticView,input,request,resources,view') return false
      if (!draft.proposal || canonical(draft.proposal) !== canonical(retained.view)) return false
      this.proposals.validateDraftRetention(retained, draft.configuration)
      return true
    } catch { return false }
  }

  private readReviewDraft(id: string, expectedVersion: number): { payload: PersistedDraft, draft: AcademicSavedDraft } {
    let payload: PersistedDraft | null
    try { payload = this.store.read(id) } catch (error) { this.rethrowStoreError(error) }
    if (!payload) throw this.httpError(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
    if (!this.isValidPayload(payload, id)) throw this.httpError(409, 'DRAFT_CORRUPT', 'La propuesta guardada no superó su validación')
    const draft = structuredClone(payload.document as AcademicSavedDraft)
    if (draft.version !== expectedVersion) throw this.httpError(409, 'VERSION_MISMATCH', 'La propuesta cambió en otra sesión; recárgala antes de continuar')
    if (this.isLocked(draft)) throw this.httpError(409, 'DRAFT_LOCKED', 'La propuesta aprobada o publicada es inmutable')
    return { payload, draft }
  }

  private readStoredDraft(id: string): { payload: PersistedDraft, draft: AcademicSavedDraft } {
    if (!uuidPattern.test(id)) throw this.httpError(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
    let payload: PersistedDraft | null
    try { payload = this.store.read(id) } catch (error) { this.rethrowStoreError(error) }
    if (!payload) throw this.httpError(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
    if (!this.isValidPayload(payload, id)) throw this.httpError(409, 'DRAFT_CORRUPT', 'La propuesta guardada no superó su validación')
    return { payload, draft: structuredClone(payload.document as AcademicSavedDraft) }
  }

  private expectedVersion(value: unknown): number {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1
      || !Number.isSafeInteger((value as Record<string, unknown>).expectedVersion)
      || ((value as Record<string, unknown>).expectedVersion as number) < 1) {
      throw this.httpError(400, 'INVALID_REQUEST', 'Se requiere la versión esperada de la propuesta')
    }
    return (value as { expectedVersion: number }).expectedVersion
  }

  private isLocked(draft: AcademicSavedDraft): boolean {
    return draft.state === 'approved' || draft.state === 'published'
  }

  private writeReleaseDraft(payload: PersistedDraft, draft: AcademicSavedDraft): void {
    try { validateAcademicSavedDraft(draft) } catch { throw this.httpError(409, 'DRAFT_CORRUPT', 'La propuesta no superó la validación de publicación') }
    const nextPayload: PersistedDraft = { ...payload, document: draft }
    if (!this.isValidPayload(nextPayload, draft.id)) throw this.httpError(409, 'DRAFT_CORRUPT', 'La propuesta no superó la validación de publicación')
    try { this.store.write(draft.id, nextPayload) } catch (error) { this.rethrowStoreError(error) }
  }

  private readStoreEntries(): ReturnType<SavedDraftStore['list']> {
    try { return this.store.list() } catch (error) { this.rethrowStoreError(error) }
  }

  private readPublicationRecords(): Array<{ id: string, payload: PersistedDraft, draft: AcademicSavedDraft }> {
    const entries = this.readStoreEntries()
    const publications: Array<{ id: string, payload: PersistedDraft, draft: AcademicSavedDraft }> = []
    for (const entry of entries) {
      if (!entry.id || !entry.payload || !this.isValidPayload(entry.payload, entry.id)) {
        throw this.httpError(409, 'DRAFT_CORRUPT', 'No se puede determinar con certeza la publicación vigente: hay una propuesta inválida')
      }
      const draft = entry.payload.document as AcademicSavedDraft
      if (draft.state === 'published') publications.push({ id: entry.id, payload: entry.payload, draft })
    }
    const versions = new Set<number>()
    for (const record of publications) {
      const version = record.draft.publication!.publicationVersion
      if (versions.has(version)) throw this.httpError(409, 'DRAFT_CORRUPT', 'Hay números de publicación duplicados')
      versions.add(version)
    }
    for (let version = 1; version <= publications.length; version++) {
      if (!versions.has(version)) throw this.httpError(409, 'DRAFT_CORRUPT', 'La secuencia de publicaciones no es continua')
    }
    publications.sort((left, right) => right.draft.publication!.publicationVersion - left.draft.publication!.publicationVersion)
    return publications
  }

  private publicationSummary(draft: AcademicSavedDraft): AcademicPublicationList['items'][number] {
    if (draft.state !== 'published' || !draft.approval || !draft.publication) throw this.httpError(409, 'DRAFT_CORRUPT', 'Metadatos de publicación incompletos')
    return {
      id: draft.id,
      publicationVersion: draft.publication.publicationVersion,
      title: draft.title,
      sourceProposalVersion: draft.approval.sourceVersion,
      approvedVersion: draft.approval.approvedVersion,
      approvedAt: draft.approval.approvedAt,
      publishedAt: draft.publication.publishedAt,
    }
  }

  private publicationFromDraft(draft: AcademicSavedDraft): AcademicPublication {
    const summary = this.publicationSummary(draft)
    let schedule
    try { schedule = createScheduleSnapshot(this.proposals.getCatalog(), draft) }
    catch { throw this.httpError(409, 'DRAFT_CORRUPT', 'La propuesta publicada no superó la validación del catálogo') }
    const result: AcademicPublication = { revision: 'PA-PUBLICATION-1', ...summary, schedule }
    try { validateAcademicPublication(result) } catch { throw this.httpError(409, 'DRAFT_CORRUPT', 'La publicación no superó su validación') }
    return result
  }

  private synchronizeReview(draft: AcademicSavedDraft): void {
    const review = draft.review!
    const current = teacherFingerprints(draft)
    const previous = new Map(review.teachers.map((teacher) => [teacher.teacherId, teacher]))
    const nextTeachers: typeof review.teachers = []
    const invalidations: ReturnType<typeof reviewEvent>[] = []
    for (const [teacherId, currentTeacher] of current) {
      const existing = previous.get(teacherId)
      if (!existing) {
        const lastInvalidation = [...review.history].reverse().find((event) => event.type === 'invalidated' && event.teacherId === teacherId
          && event.round === review.round)
        const previousDecision = lastInvalidation && review.history.filter((event) => event.type === 'decision' && event.teacherId === teacherId
          && event.fingerprint === lastInvalidation.fingerprint && event.version < lastInvalidation.version).at(-1)
        if (lastInvalidation) {
          nextTeachers.push({ ...makeReviewTeacher(teacherId, currentTeacher.teacherName, currentTeacher.fingerprint), status: 'outdated',
            observation: previousDecision?.observation ?? '', decisionVersion: previousDecision?.version ?? null, decidedAt: previousDecision?.at ?? null })
        } else nextTeachers.push(makeReviewTeacher(teacherId, currentTeacher.teacherName, currentTeacher.fingerprint))
      } else if (existing.fingerprint === currentTeacher.fingerprint) {
        nextTeachers.push({ ...existing, teacherName: currentTeacher.teacherName })
      } else {
        nextTeachers.push({ ...existing, teacherName: currentTeacher.teacherName, fingerprint: currentTeacher.fingerprint, status: 'outdated' })
        invalidations.push(reviewEvent('invalidated', draft.version, review.round, draft.updatedAt,
          teacherId, existing.fingerprint, null, existing.observation))
      }
    }
    if (draft.proposal === null) {
      for (const [teacherId, existing] of previous) {
        if (existing.status !== 'outdated') invalidations.push(reviewEvent('invalidated', draft.version, review.round, draft.updatedAt,
          teacherId, existing.fingerprint, null, existing.observation))
      }
      review.teachers = []
    } else {
      for (const [teacherId, existing] of previous) {
        if (current.has(teacherId) || existing.status === 'outdated') continue
        invalidations.push(reviewEvent('invalidated', draft.version, review.round, draft.updatedAt, teacherId, existing.fingerprint, null, existing.observation))
      }
      review.teachers = nextTeachers
    }
    this.requireHistoryCapacity(review.history, invalidations.length)
    review.history.push(...invalidations)
  }

  private requireHistoryCapacity(history: AcademicTeacherReview['history'], additions: number): void {
    if (history.length + additions > 200) throw this.httpError(429, 'REVIEW_HISTORY_LIMIT', 'Se alcanzó el máximo de eventos del historial de revisión')
  }

  private writeReviewDraft(payload: PersistedDraft, draft: AcademicSavedDraft): void {
    try { validateAcademicSavedDraft(draft) } catch { throw this.httpError(409, 'DRAFT_CORRUPT', 'La propuesta de revisión no superó su validación') }
    if (!reviewMatchesSnapshot(draft)) throw this.httpError(409, 'DRAFT_CORRUPT', 'La revisión no corresponde al horario actual')
    const nextPayload: PersistedDraft = { ...payload, document: draft }
    if (!this.isValidPayload(nextPayload, draft.id)) throw this.httpError(409, 'DRAFT_CORRUPT', 'La propuesta de revisión no superó su validación')
    try { this.store.write(draft.id, nextPayload) } catch (error) { this.rethrowStoreError(error) }
  }

  private requireConfigured(): void {
    if (!this.store.configured) throw this.httpError(503, 'DRAFT_PERSISTENCE_UNAVAILABLE', 'La persistencia de propuestas no está configurada')
  }

  private rethrowStoreError(error: unknown): never {
    if (error instanceof SavedDraftStoreError) throw this.httpError(error.status, error.code, error.message)
    throw this.httpError(503, 'DRAFT_STORAGE_ERROR', 'No se pudo acceder al almacenamiento local de propuestas')
  }

  private httpError(status: number, code: string, message: string): HttpException {
    return new HttpException({ error: { code, message } }, status)
  }
}

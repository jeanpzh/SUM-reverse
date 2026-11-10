import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { HttpException, Inject, Injectable } from '@nestjs/common'
import { E2_REVISION, validateE2Context, validateE2ContextRequest, validateE2Draft, validateE2PublicationRequest, validateE2PublicationResponse, validateE2SaveRequest, validateE2SaveResponse, validateE2ValidateRequest, validateE2Validation } from '../../../shared/prematricula-api.mjs'
import type { E2Choice, E2Context, E2Draft, E2Identity, E2Issue, E2PublicationResponse, E2SaveRequest, E2SaveResponse, E2Validation } from '../../../shared/prematricula-api.mjs'
import { validateE2Demand, validateE2DemandRequest, validateE2Intention, validateE2IntentionContext, validateE2RegisterIntentionRequest } from '../../../shared/prematricula-intention.mjs'
import type { E2Demand, E2Intention, E2IntentionContext, E2RegisterIntentionRequest } from '../../../shared/prematricula-intention.d.mts'
import { validateE3IntentionImport } from '../../../shared/matricula-intention-import.mjs'
import type { E3ImportIssue, E3IntentionImport } from '../../../shared/matricula-intention-import.d.mts'
import { MatriculaRegularRepository } from '../matricula-regular/matricula-regular.repository.js'
import { ContextService } from '../matricula-regular/context.service.js'
import { evaluateSelectionAdmission } from '../matricula-regular/selection.rules.js'
import { LocalProfileSessionService } from '../local-profile-dashboard/local-profile-session.service.js'
import { LocalScenariosService } from '../local-profile-dashboard/local-scenarios.service.js'
import { ACADEMIC_PUBLICATION_READER } from '../common/academic-publication-reader.js'
import type { AcademicPublicationReader } from '../common/academic-publication-reader.js'
import { classify } from '../programacion-academica/demand-estimator.js'
import { projectActor } from '../programacion-academica/demand-fixtures.js'
import { SavedDraftStore, SavedDraftStoreError } from '../programacion-academica/saved-draft-store.js'
import { intervalsOverlap } from '../programacion-academica/schedule-validator.js'
import type { AcademicPublication } from '../../../shared/programacion-academica-api.d.mts'
import type { ActorProfile } from '../matricula-regular/profile.types.js'
import type { MatriculaRegularChoice } from '../../../shared/matricula-regular.mjs'

type E2Payload = { schemaVersion: 1, document: E2Draft, intention?: E2Intention }
type E2Store = SavedDraftStore<E2Payload>
const sourceId = 'regular-SISTEMAS-v1' as const
const schoolId = 'SISTEMAS' as const
const planId = 'SYN-SIS-PLAN' as const
const academicPeriod = '2027-I' as const
const issueMessages: Record<string, string> = {
  COURSE_ALREADY_APPROVED: 'La asignatura ya figura aprobada al corte.',
  COURSE_RECOGNIZED: 'La asignatura figura reconocida por equivalencia.',
  COURSE_NOT_IN_PLAN: 'La asignatura no pertenece al plan conocido.',
  UNKNOWN_PLAN: 'El plan académico no está confirmado.',
  UNKNOWN_HISTORY: 'El historial académico no está confirmado.',
  UNKNOWN_EQUIVALENCES: 'El estado de equivalencias no está confirmado.',
  INVALID_MAPPING: 'La correspondencia académica no está completa.',
  INVALID_RECORD: 'El registro académico sintético no es consistente.',
  PREREQUISITE_MAPPING_UNKNOWN: 'No se pudo confirmar la correspondencia del prerrequisito.',
  PREREQUISITE_NOT_MET: 'No consta aprobado un prerrequisito requerido.',
}

function fail(status: number, code: string, message: string): never {
  throw new HttpException({ error: { code, message } }, status)
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}

function academicRevision(actor: ActorProfile): string {
  const projected = projectActor(actor)
  return createHash('sha256').update(canonical({
    actorId: actor.actorId,
    schoolId: actor.scope.schoolId,
    planId: actor.scope.planId,
    planKnown: projected.planKnown,
    historyKnown: projected.historyKnown,
    equivalencesKnown: projected.equivalencesKnown,
    courses: projected.courses,
    attempts: projected.attempts,
    equivalentCourseCodes: projected.equivalentCourseCodes,
  })).digest('hex')
}

function ownerKey(draft: Pick<E2Draft, 'actorId' | 'sourceId' | 'schoolId' | 'planId' | 'academicPeriod'>): string {
  return [draft.actorId, draft.sourceId, draft.schoolId, draft.planId, draft.academicPeriod].join('\u0000')
}

@Injectable()
export class PrematriculaService {
  private readonly store: E2Store

  constructor(
    private readonly repository: MatriculaRegularRepository,
    private readonly context: ContextService,
    private readonly sessions: LocalProfileSessionService,
    private readonly scenarios: LocalScenariosService,
    @Inject(ACADEMIC_PUBLICATION_READER) private readonly publications: AcademicPublicationReader,
  ) {
    const directory = process.env.SUM_ACADEMIC_DRAFT_DIR?.trim()
    this.store = new SavedDraftStore<E2Payload>(directory ? join(directory, 'e2-prematricula') : undefined)
  }

  async getContext(value: unknown): Promise<E2Context> {
    const identity = this.validateIdentity(value, validateE2ContextRequest)
    const { actor, revision } = identity
    const publications = await this.supportedPublicationList()
    this.assertIdentityCurrent((value as { identity: E2Identity }).identity, actor, revision)
    const draft = this.findOwnerDraft(actor.actorId)
    const draftValidation = draft ? await this.validateSelection(actor, revision, draft.publicationId, draft.publicationVersion, draft.selection, draft.academicRevision !== revision) : null
    const result: E2Context = { revision: E2_REVISION, actorId: actor.actorId as E2Identity['actorId'], sourceId, schoolId, planId, academicPeriod, academicRevision: revision, publications, draft, draftValidation }
    validateE2Context(result)
    return result
  }

  async getPublication(value: unknown): Promise<E2PublicationResponse> {
    const identity = this.validateIdentity(value, validateE2PublicationRequest)
    const request = value as { identity: E2Identity; publicationId: string }
    const publication = await this.publication(request.publicationId)
    if (publication.schedule.schoolId !== schoolId || publication.schedule.academicPeriod !== academicPeriod) {
      fail(422, 'PUBLICATION_NOT_SUPPORTED', 'La publicación no pertenece al contexto de prematrícula disponible')
    }
    this.assertIdentityCurrent(request.identity, identity.actor, identity.revision)
    const result: E2PublicationResponse = { actorId: identity.actor.actorId as E2Identity['actorId'], academicRevision: identity.revision, publication, eligibility: this.eligibility(identity.actor, publication) }
    validateE2PublicationResponse(result)
    return result
  }

  async validate(value: unknown): Promise<E2Validation> {
    const identity = this.validateIdentity(value, validateE2ValidateRequest)
    const request = value as { identity: E2Identity; publicationId: string, publicationVersion: number, selection: E2Choice[] }
    const result = await this.validateSelection(identity.actor, identity.revision, request.publicationId, request.publicationVersion, request.selection)
    this.assertIdentityCurrent(request.identity, identity.actor, identity.revision)
    validateE2Validation(result)
    return result
  }

  async save(value: unknown): Promise<E2SaveResponse> {
    let request: E2SaveRequest
    try { validateE2SaveRequest(value); request = value }
    catch { return fail(400, 'INVALID_REQUEST', 'La solicitud de guardado no cumple el contrato E2') }
    const actor = this.requireIdentity(request.identity)
    const revision = academicRevision(actor)
    if (request.expectedAcademicRevision !== revision) fail(409, 'ACADEMIC_CONTEXT_CHANGED', 'El contexto académico cambió; vuelve a validar antes de guardar')
    const publication = await this.publication(request.publicationId)
    if (publication.publicationVersion !== request.publicationVersion) fail(409, 'PUBLICATION_VERSION_MISMATCH', 'La versión de publicación seleccionada ya no coincide')
    this.validateSelectionRefs(publication, request.selection)
    return this.store.exclusive(() => {
      const currentActor = this.requireIdentity(request.identity)
      const currentRevision = academicRevision(currentActor)
      if (currentRevision !== request.expectedAcademicRevision || currentActor.actorId !== actor.actorId) fail(409, 'ACADEMIC_CONTEXT_CHANGED', 'El contexto académico cambió; vuelve a validar antes de guardar')
      const entries = this.entries()
      const owned = this.uniqueOwnerDraft(entries, currentActor.actorId)
      const now = new Date().toISOString()
      let previous: E2Draft | null = null
      let previousPayload: E2Payload | null = null
      let id: string
      if (request.id === null) {
        if (request.expectedVersion !== null) fail(400, 'INVALID_REQUEST', 'Un borrador nuevo no admite versión previa')
        id = randomUUID()
        if (entries.some((entry) => entry.id === id)) fail(409, 'DRAFT_ID_CONFLICT', 'No se pudo asignar un identificador nuevo')
        if (owned) fail(409, 'DRAFT_ALREADY_EXISTS', 'Ya existe un borrador para este perfil; recupéralo antes de guardar uno nuevo')
      } else {
        let payload: E2Payload | null
        try { payload = this.store.read(request.id) } catch (error) { this.storageFailure(error) }
        if (!payload || !this.isValidPayload(payload, request.id)) fail(409, 'DRAFT_CORRUPT', 'El borrador no superó su validación')
        previousPayload = payload
        previous = payload.document
        if (ownerKey(previous) !== ownerKey(this.owner(currentActor.actorId))) fail(403, 'DRAFT_OWNER_MISMATCH', 'El borrador pertenece a otro perfil')
        if (previous.version !== request.expectedVersion) fail(409, 'VERSION_MISMATCH', 'El borrador cambió en otra sesión; recupéralo antes de guardar')
        if (owned && owned.id !== previous.id) fail(409, 'DUPLICATE_OWNER_DRAFT', 'Hay más de un borrador para este perfil')
        id = request.id
      }
      if (entries.length >= 50 && !previous) fail(503, 'STORAGE_UNAVAILABLE', 'Se alcanzó el límite local de borradores')
      const validation = this.makeValidation(currentActor, currentRevision, publication, request.selection)
      const draft: E2Draft = {
        revision: E2_REVISION, id, version: (previous?.version ?? 0) + 1, actorId: currentActor.actorId as E2Identity['actorId'],
        sourceId, schoolId, planId, academicPeriod, publicationId: publication.id, publicationVersion: publication.publicationVersion,
        academicRevision: currentRevision, selection: structuredClone(request.selection), createdAt: previous?.createdAt ?? now, updatedAt: now,
      }
      try { validateE2Draft(draft) } catch { fail(400, 'INVALID_REQUEST', 'El borrador no cumple el contrato E2') }
      const nextPayload: E2Payload = { schemaVersion: 1, document: draft }
      if (previousPayload?.intention) nextPayload.intention = structuredClone(previousPayload.intention)
      try { this.store.write(id, nextPayload) } catch (error) { this.storageFailure(error) }
      const result = { draft, validation }
      validateE2SaveResponse(result)
      return result
    })
  }

  async getIntentionContext(value: unknown): Promise<E2IntentionContext> {
    const identity = this.validateIdentity(value, validateE2ContextRequest)
    const draft = this.findOwnerDraft(identity.actor.actorId)
    const payload = draft ? this.readPayload(draft.id) : null
    let validation: E2Validation | null = null
    if (payload?.intention) {
      const latest = payload.intention.history.at(-1)!
      validation = await this.revalidateIntention(identity.actor, identity.revision, latest)
      this.assertIdentityCurrent((value as { identity: E2Identity }).identity, identity.actor, identity.revision)
    }
    const result: E2IntentionContext = {
      revision: 'E2-INTENT-1', actorId: identity.actor.actorId as E2Identity['actorId'], academicRevision: identity.revision,
      draftId: draft?.id ?? null, draftVersion: draft?.version ?? null,
      intention: payload?.intention ? structuredClone(payload.intention) : null, validation,
    }
    try { validateE2IntentionContext(result) } catch { fail(409, 'DRAFT_CORRUPT', 'La intención no corresponde al contexto guardado') }
    return result
  }

  async registerIntention(value: unknown): Promise<E2IntentionContext> {
    let request: E2RegisterIntentionRequest
    try { validateE2RegisterIntentionRequest(value); request = value } catch { return fail(400, 'INVALID_REQUEST', 'La solicitud de intención no cumple el contrato E2') }
    const actor = this.requireIdentity(request.identity)
    const revision = academicRevision(actor)
    if (request.expectedAcademicRevision !== revision) fail(409, 'VERSION_MISMATCH', 'El contexto académico cambió; recupéralo antes de registrar')
    return this.store.exclusive(async () => {
      const currentActor = this.requireIdentity(request.identity)
      const currentRevision = academicRevision(currentActor)
      if (currentActor.actorId !== actor.actorId || currentRevision !== request.expectedAcademicRevision) fail(409, 'VERSION_MISMATCH', 'El contexto académico cambió; recupéralo antes de registrar')
      const payload = this.readPayload(request.draftId)
      if (!payload) fail(404, 'DRAFT_NOT_FOUND', 'No se encontró el borrador guardado')
      if (ownerKey(payload.document) !== ownerKey(this.owner(currentActor.actorId))) fail(403, 'DRAFT_OWNER_MISMATCH', 'El borrador pertenece a otro perfil')
      if (payload.document.version !== request.expectedDraftVersion) fail(409, 'VERSION_MISMATCH', 'El borrador cambió; recupéralo antes de registrar')
      const currentIntentionVersion = payload.intention?.version ?? null
      if (currentIntentionVersion !== request.expectedIntentionVersion) fail(409, 'INTENTION_VERSION_MISMATCH', 'La intención cambió; recupérala antes de registrar')
      if (payload.intention && payload.intention.history.at(-1)?.draftVersion === payload.document.version) fail(422, 'INTENTION_UNCHANGED', 'Esta versión del borrador ya tiene una intención registrada')
      if (payload.intention && payload.intention.version >= 100) fail(409, 'INTENTION_HISTORY_LIMIT', 'Se alcanzó el límite local de historial de intenciones')
      if (payload.document.academicRevision !== currentRevision) fail(422, 'INTENTION_VERIFICATIONS_PENDING', 'El contexto académico guardado ya no está vigente')
      const publication = await this.publication(payload.document.publicationId)
      const verifiedActor = this.requireIdentity(request.identity)
      if (verifiedActor.actorId !== currentActor.actorId || academicRevision(verifiedActor) !== request.expectedAcademicRevision) fail(409, 'VERSION_MISMATCH', 'El contexto académico cambió; recupéralo antes de registrar')
      const latestPayload = this.readPayload(request.draftId)
      if (!latestPayload || ownerKey(latestPayload.document) !== ownerKey(this.owner(currentActor.actorId))
        || latestPayload.document.version !== request.expectedDraftVersion || (latestPayload.intention?.version ?? null) !== request.expectedIntentionVersion) fail(409, 'VERSION_MISMATCH', 'El borrador o la intención cambiaron durante el registro')
      if (publication.publicationVersion !== payload.document.publicationVersion) fail(409, 'VERSION_MISMATCH', 'La publicación guardada ya no se puede recuperar en su versión exacta')
      const validation = this.makeValidation(currentActor, currentRevision, publication, payload.document.selection)
      if (validation.status === 'incomplete') fail(422, 'INTENTION_INCOMPLETE', 'La selección guardada está vacía o incompleta')
      if (validation.status === 'unmet') fail(422, 'INTENTION_REQUIREMENTS_UNMET', 'La selección guardada incumple requisitos conocidos')
      if (validation.status === 'insufficient') fail(422, 'INTENTION_VERIFICATIONS_PENDING', 'Hay verificaciones académicas pendientes')
      const record = {
        version: (currentIntentionVersion ?? 0) + 1, draftVersion: payload.document.version,
        publicationId: publication.id, publicationVersion: publication.publicationVersion,
        academicRevision: currentRevision, selection: structuredClone(payload.document.selection), registeredAt: new Date().toISOString(),
      }
      const history = [...(payload.intention?.history ?? []), record]
      const intention: E2Intention = { revision: 'E2-INTENT-1', draftId: payload.document.id,
        actorId: currentActor.actorId as E2Identity['actorId'], sourceId, schoolId, planId, academicPeriod,
        version: history.length, history }
      try { validateE2Intention(intention) } catch { fail(409, 'DRAFT_CORRUPT', 'El historial de intención no supera su validación') }
      try { this.store.write(payload.document.id, { ...payload, intention }) } catch (error) { this.storageFailure(error) }
      return this.intentionContext(currentActor, currentRevision, payload.document, intention, validation)
    })
  }

  async transferIntention(value: unknown): Promise<E3IntentionImport> {
    let identity: E2Identity
    try {
      validateE2ContextRequest(value)
      identity = (value as { identity: E2Identity }).identity
    } catch { return fail(400, 'INVALID_REQUEST', 'La solicitud no cumple el contrato E2') }

    const actor = this.requireIdentity(identity)
    const initial = this.repository.readSnapshot(identity.runId)
    const initialRevision = actor.profileRevision
    const initialAcademicRevision = academicRevision(actor)
    const draft = this.findOwnerDraft(actor.actorId)
    const payload = draft ? this.readPayload(draft.id) : null
    const intention = payload?.intention ?? null
    const latest = intention?.history.at(-1) ?? null
    let publication: AcademicPublication | null = null
    if (latest) {
      try { publication = await this.publication(latest.publicationId, true) }
      catch (error) {
        if (!(error instanceof HttpException) || error.getStatus() !== 404) throw error
      }
      this.assertTransferContext(identity, actor.actorId, initial.runId, initialRevision, initialAcademicRevision, intention)
    }

    const current = this.repository.readSnapshot(identity.runId)
    const currentActor = current.actors.find(item => item.actorId === actor.actorId)
    if (current.runId !== initial.runId || !currentActor || currentActor.profileRevision !== initialRevision) {
      fail(409, 'ACADEMIC_CONTEXT_CHANGED', 'El contexto E3 cambió durante la consulta')
    }

    const selection: MatriculaRegularChoice[] = []
    const issues: E3ImportIssue[] = []
    const sourceScopeMatches = intention !== null
      && currentActor.scope.facultyId === 'FISI'
      && currentActor.scope.modality === 'regular-virtual'
      && intention.schoolId === currentActor.scope.schoolId
      && intention.planId === currentActor.scope.planId
      && intention.academicPeriod === currentActor.scope.period
    const claimedCourses = new Set<string>()

    for (const source of latest?.selection ?? []) {
      if (!sourceScopeMatches) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId, code: 'SCOPE_MISMATCH' })
        continue
      }
      if (!publication || publication.id !== latest!.publicationId
        || publication.publicationVersion !== latest!.publicationVersion) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId, code: 'PUBLICATION_UNAVAILABLE' })
        continue
      }
      if (publication.schedule.schoolId !== intention!.schoolId
        || publication.schedule.academicPeriod !== intention!.academicPeriod) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId, code: 'SCOPE_MISMATCH' })
        continue
      }
      if (!publication.schedule.courses.some(course => course.courseId === source.courseId)
        || !publication.schedule.sections.some(section => section.courseId === source.courseId && section.sectionId === source.sectionId)) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId, code: 'COURSE_UNAVAILABLE' })
        continue
      }

      const courseIds = current.offer
        .filter(course => course.planId === currentActor.scope.planId
          && currentActor.scenarioData?.courseCodes?.[course.courseId] === source.courseId)
        .map(course => course.courseId)
      if (courseIds.length !== 1) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId,
          code: courseIds.length ? 'AMBIGUOUS_MAPPING' : 'COURSE_UNAVAILABLE' })
        continue
      }

      const origins = currentActor.scenarioData?.sectionOrigins?.filter(origin =>
        origin.publicationId === intention!.history.at(-1)!.publicationId
        && origin.publicationVersion === latest!.publicationVersion
        && origin.courseId === source.courseId
        && origin.sectionId === source.sectionId,
      ) ?? []
      if (!origins.length) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId, code: 'SECTION_UNMAPPED' })
        continue
      }
      if (origins.length !== 1) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId, code: 'AMBIGUOUS_MAPPING' })
        continue
      }

      const targetCourseId = courseIds[0]!
      const targetCourse = current.offer.find(course => course.courseId === targetCourseId)!
      const targetSection = targetCourse.sections.find(section => section.sectionId === origins[0]!.offeredSectionId)
      if (!targetSection) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId, code: 'SECTION_UNMAPPED' })
        continue
      }
      if (claimedCourses.has(targetCourseId)) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId, code: 'AMBIGUOUS_MAPPING' })
        continue
      }

      const sourceSchedule = publication.schedule.assignments
        .filter(item => item.courseId === source.courseId && item.sectionId === source.sectionId)
        .map(({ day, startMinute, endMinute }) => ({ day, startMinute, endMinute }))
        .sort((left, right) => left.day - right.day || left.startMinute - right.startMinute || left.endMinute - right.endMinute)
      const targetSchedule = targetSection.schedule === null ? null : [...targetSection.schedule]
        .sort((left, right) => left.day - right.day || left.startMinute - right.startMinute || left.endMinute - right.endMinute)
      if (!sourceSchedule.length || targetSchedule === null || canonical(sourceSchedule) !== canonical(targetSchedule)) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId, code: 'SCHEDULE_CHANGED' })
        continue
      }
      if (targetSection.occupied >= targetSection.capacity) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId, code: 'SECTION_FULL' })
        continue
      }
      const choice: MatriculaRegularChoice = {
        courseId: targetCourseId as MatriculaRegularChoice['courseId'],
        sectionId: targetSection.sectionId as MatriculaRegularChoice['sectionId'],
      }
      const admission = evaluateSelectionAdmission(currentActor, current.offer, [choice])
      if (admission.unknownChoices.length || admission.causes.length || admission.gaps.length) {
        issues.push({ courseId: source.courseId, sectionId: source.sectionId, code: 'ACADEMIC_PENDING' })
        continue
      }
      claimedCourses.add(targetCourseId)
      selection.push(choice)
    }

    const result: E3IntentionImport = {
      runId: current.runId,
      actorId: currentActor.actorId as E2Identity['actorId'],
      profileRevision: currentActor.profileRevision,
      intention: intention && latest ? {
        version: intention.version,
        publicationId: latest.publicationId,
        publicationVersion: latest.publicationVersion,
        academicPeriod: intention.academicPeriod,
      } : null,
      selection,
      issues,
    }
    try { validateE3IntentionImport(result) } catch { fail(409, 'TRANSFER_INVALID', 'El resultado de traslado no superó su validación') }
    return result
  }

  private assertTransferContext(identity: E2Identity, actorId: string, runId: string, profileRevision: string, academicContextRevision: string, intention: E2Intention | null): void {
    const actor = this.requireIdentity(identity)
    const snapshot = this.repository.readSnapshot(identity.runId)
    const latestDraft = this.findOwnerDraft(actorId)
    const latestPayload = latestDraft ? this.readPayload(latestDraft.id) : null
    const latestIntention = latestPayload?.intention ?? null
    if (snapshot.runId !== runId || actor.actorId !== actorId || actor.profileRevision !== profileRevision
      || academicRevision(actor) !== academicContextRevision || canonical(latestIntention) !== canonical(intention)) {
      fail(409, 'ACADEMIC_CONTEXT_CHANGED', 'La intención o el contexto E3 cambió durante la consulta')
    }
  }

  async getDemand(value: unknown): Promise<E2Demand> {
    try { validateE2DemandRequest(value) } catch { return fail(400, 'INVALID_REQUEST', 'La consulta de demanda no cumple el contrato E2') }
    if (process.env.SIMULATOR_DEPLOYMENT === 'public' || process.env.SUM_LOCAL_SCENARIOS !== '1' || process.env.SUM_ACADEMIC_SCHEDULING !== '1') fail(403, 'E2_DISABLED', 'La prematrícula local no está habilitada')
    if (this.scenarios.catalog().data.currentScenarioId !== 'regular') fail(403, 'SCENARIO_NOT_REGULAR', 'La demanda requiere el escenario regular')
    const request = value as { publicationId: string, publicationVersion: number }
    const publication = await this.publication(request.publicationId)
    if (publication.publicationVersion !== request.publicationVersion) fail(409, 'VERSION_MISMATCH', 'La publicación solicitada no coincide con su versión exacta')
    return this.store.exclusive(() => {
      if (process.env.SIMULATOR_DEPLOYMENT === 'public' || process.env.SUM_LOCAL_SCENARIOS !== '1' || process.env.SUM_ACADEMIC_SCHEDULING !== '1') fail(403, 'E2_DISABLED', 'La prematrícula local no está habilitada')
      if (this.scenarios.catalog().data.currentScenarioId !== 'regular') fail(403, 'SCENARIO_NOT_REGULAR', 'La demanda requiere el escenario regular')
      const entries = this.entries()
      const seenOwners = new Set<string>()
      const latestByOwner = new Map<string, E2Intention>()
      for (const entry of entries) {
        if (!entry.id || !entry.payload || !this.isValidPayload(entry.payload, entry.id)) fail(409, 'DRAFT_CORRUPT', 'No se puede calcular una demanda confiable: hay un borrador inválido')
        const key = ownerKey(entry.payload.document)
        if (seenOwners.has(key)) fail(409, 'DRAFT_CORRUPT', 'Hay más de un borrador para un propietario')
        seenOwners.add(key)
        const intention = entry.payload.intention
        if (!intention) continue
        const latest = intention.history.at(-1)!
        if (latest.publicationId === request.publicationId && latest.publicationVersion === request.publicationVersion) latestByOwner.set(key, intention)
      }
      const demandCourses = publication.schedule.courses.map(course => ({
        courseId: course.courseId, name: course.name, students: 0,
        sections: publication.schedule.sections.filter(section => section.courseId === course.courseId).map(section => ({ sectionId: section.sectionId, capacity: section.capacity, students: 0 })),
      }))
      let countedStudents = 0
      let excludedStudents = 0
      const snapshot = this.repository.readSnapshot()
      for (const intention of latestByOwner.values()) {
        const actor = snapshot.actors.find(item => item.actorId === intention.actorId)
        if (!actor || actor.scope.schoolId !== schoolId || actor.scope.planId !== planId || !actor.academic || !actor.scenarioData?.courseCodes) {
          excludedStudents++
          continue
        }
        const latest = intention.history.at(-1)!
        const currentRevision = academicRevision(actor)
        const saved = this.makeValidation(actor, currentRevision, publication, latest.selection, latest.academicRevision !== currentRevision)
        if (saved.status !== 'valid' || latest.academicRevision !== currentRevision) { excludedStudents++; continue }
        countedStudents++
        for (const choice of latest.selection) {
          const course = demandCourses.find(item => item.courseId === choice.courseId)
          const section = course?.sections.find(item => item.sectionId === choice.sectionId)
          if (course && section) { course.students++; section.students++ }
        }
      }
      const result: E2Demand = { revision: 'E2-DEMAND-1', schoolId, academicPeriod, publicationId: publication.id,
        publicationVersion: publication.publicationVersion, registeredStudents: latestByOwner.size, countedStudents, excludedStudents, courses: demandCourses }
      try { validateE2Demand(result) } catch { fail(409, 'DRAFT_CORRUPT', 'La demanda agregada no superó su validación') }
      return result
    })
  }

  private validateIdentity<T extends { identity: E2Identity }>(value: unknown, validator: (value: unknown) => asserts value is T) {
    try { validator(value) } catch { fail(400, 'INVALID_REQUEST', 'La solicitud no cumple el contrato E2') }
    const request = value as T
    const actor = this.requireIdentity(request.identity)
    return { actor, revision: academicRevision(actor) }
  }

  private requireIdentity(identity: E2Identity): ActorProfile {
    if (process.env.SIMULATOR_DEPLOYMENT === 'public' || process.env.SUM_LOCAL_SCENARIOS !== '1' || process.env.SUM_ACADEMIC_SCHEDULING !== '1') {
      fail(403, 'E2_DISABLED', 'La prematrícula local no está habilitada')
    }
    const snapshot = this.repository.readSnapshot(identity.runId)
    this.sessions.requireActive(snapshot, identity, this.context.now(snapshot.runId))
    if (!this.repository.hasOperationalRun(identity.runId)
      && this.scenarios.catalog().data.currentScenarioId !== 'regular') fail(403, 'SCENARIO_NOT_REGULAR', 'La prematrícula requiere el escenario regular')
    if (identity.actorId !== 'SYN-SIS-A' && identity.actorId !== 'SYN-SIS-B') fail(403, 'ACTOR_NOT_ALLOWED', 'El perfil no está habilitado para esta propuesta')
    const actor = snapshot.actors.find((item) => item.actorId === identity.actorId)
    if (!actor || actor.scope.schoolId !== schoolId || actor.scope.planId !== planId) fail(403, 'ACTOR_NOT_ALLOWED', 'El perfil no pertenece al plan de Sistemas')
    if (!actor.academic || !actor.scenarioData?.courseCodes) fail(409, 'ACADEMIC_CONTEXT_UNAVAILABLE', 'No se pudo proyectar el contexto académico sintético')
    return actor
  }

  private assertIdentityCurrent(identity: E2Identity, original: ActorProfile, revision: string): void {
    const actor = this.requireIdentity(identity)
    if (actor.profileRevision !== original.profileRevision || academicRevision(actor) !== revision) {
      fail(409, 'ACADEMIC_CONTEXT_CHANGED', 'El contexto académico cambió durante la consulta')
    }
  }

  private async publication(id: string, allowIncompatibleScope = false): Promise<AcademicPublication> {
    let publication: AcademicPublication
    try { publication = await this.publications.getPublication(id) }
    catch (error) {
      const response = error instanceof HttpException ? error.getResponse() : null
      const code = response && typeof response === 'object' ? (response as Record<string, unknown>).error : null
      if (code && typeof code === 'object' && ['PUBLICATION_NOT_FOUND', 'DRAFT_NOT_FOUND'].includes(String((code as Record<string, unknown>).code))) fail(404, 'PUBLICATION_NOT_FOUND', 'No se encontró la publicación seleccionada')
      if (error instanceof HttpException && error.getStatus() === 503) fail(503, 'STORAGE_UNAVAILABLE', 'No se pudo acceder al almacenamiento local de publicaciones')
      fail(409, 'PUBLICATION_UNAVAILABLE', 'La publicación no superó su validación')
    }
    if (!allowIncompatibleScope && (publication.schedule.schoolId !== schoolId || publication.schedule.academicPeriod !== academicPeriod)) {
      fail(422, 'PUBLICATION_SCOPE_MISMATCH', 'La prematrícula sintética requiere una publicación de Sistemas 2027-I')
    }
    return publication
  }

  private async supportedPublicationList() {
    const list = await this.publications.publications()
    const supported = await Promise.all(list.items.map(async (item) => {
      const publication = await this.publications.getPublication(item.id)
      return publication.schedule.schoolId === schoolId && publication.schedule.academicPeriod === academicPeriod ? item : null
    }))
    const items = supported.filter((item): item is NonNullable<typeof item> => item !== null)
    return { currentId: items.some((item) => item.id === list.currentId) ? list.currentId : null, items }
  }

  private makeValidation(actor: ActorProfile, revision: string, publication: AcademicPublication, selection: E2Choice[], contextChanged = false): E2Validation {
    this.validateSelectionRefs(publication, selection)
    const learner = projectActor(actor)
    const issues: E2Issue[] = []
    if (!selection.length) issues.push({ kind: 'incomplete', code: 'EMPTY_SELECTION', message: 'Selecciona al menos una asignatura.', courseIds: [], sectionIds: [] })
    if (contextChanged) issues.push({ kind: 'insufficient', code: 'ACADEMIC_CONTEXT_CHANGED', message: 'El contexto académico cambió desde que se guardó este borrador.', courseIds: selection.map((choice) => choice.courseId), sectionIds: selection.map((choice) => choice.sectionId) })
    for (const choice of selection) {
      const outcome = classify(learner, choice.courseId, false)
      if (outcome.category !== 'eligible') {
        const kind = outcome.category === 'insufficient' ? 'insufficient' : 'unmet'
        issues.push({ kind, code: outcome.code, message: issueMessages[outcome.code] ?? 'La habilitación académica no está confirmada.', courseIds: [choice.courseId], sectionIds: [choice.sectionId] })
      }
    }
    const assignments = publication.schedule.assignments
    for (let left = 0; left < selection.length; left++) for (let right = left + 1; right < selection.length; right++) {
      const a = selection[left]!
      const b = selection[right]!
      const intervalsA = assignments.filter((item) => item.sectionId === a.sectionId && item.courseId === a.courseId)
      const intervalsB = assignments.filter((item) => item.sectionId === b.sectionId && item.courseId === b.courseId)
      if (intervalsA.some((first) => intervalsB.some((second) => intervalsOverlap(
        { day: first.day, startMinute: first.startMinute, endMinute: first.endMinute },
        { day: second.day, startMinute: second.startMinute, endMinute: second.endMinute },
      )))) {
        issues.push({ kind: 'unmet', code: 'SCHEDULE_CONFLICT', message: 'Las secciones seleccionadas tienen horarios superpuestos.', courseIds: [a.courseId, b.courseId], sectionIds: [a.sectionId, b.sectionId] })
      }
    }
    const credits = selection.reduce((sum, choice) => sum + (publication.schedule.courses.find((course) => course.courseId === choice.courseId)?.credits ?? 0), 0)
    const kind = issues.some((issue) => issue.kind === 'unmet') ? 'unmet' : issues.some((issue) => issue.kind === 'insufficient') ? 'insufficient' : issues.length ? 'incomplete' : 'valid'
    return { actorId: actor.actorId as E2Identity['actorId'], publicationId: publication.id, publicationVersion: publication.publicationVersion, academicRevision: revision, selection: structuredClone(selection), credits, courseCount: selection.length, status: kind, issues }
  }

  private async validateSelection(actor: ActorProfile, revision: string, publicationId: string, version: number, selection: E2Choice[], contextChanged = false): Promise<E2Validation> {
    const publication = await this.publication(publicationId)
    if (publication.publicationVersion !== version) fail(409, 'PUBLICATION_VERSION_MISMATCH', 'La publicación cambió de versión')
    return this.makeValidation(actor, revision, publication, selection, contextChanged)
  }

  private validateSelectionRefs(publication: AcademicPublication, selection: E2Choice[]): void {
    for (const choice of selection) {
      if (!publication.schedule.courses.some((course) => course.courseId === choice.courseId)) fail(400, 'COURSE_NOT_IN_PUBLICATION', 'La asignatura no pertenece a la publicación seleccionada')
      if (!publication.schedule.sections.some((section) => section.courseId === choice.courseId && section.sectionId === choice.sectionId)) fail(400, 'SECTION_COURSE_MISMATCH', 'La sección no pertenece a la asignatura seleccionada')
    }
  }

  private eligibility(actor: ActorProfile, publication: AcademicPublication): E2PublicationResponse['eligibility'] {
    const learner = projectActor(actor)
    return publication.schedule.courses.map((course) => {
      const outcome = classify(learner, course.courseId, false)
      const issues: E2Issue[] = outcome.category === 'eligible' ? [] : [{ kind: outcome.category === 'insufficient' ? 'insufficient' : 'unmet', code: outcome.code, message: issueMessages[outcome.code] ?? 'La habilitación académica no está confirmada.', courseIds: [course.courseId], sectionIds: [] }]
      return { courseId: course.courseId, issues }
    })
  }

  private findOwnerDraft(actorId: string): E2Draft | null {
    return this.uniqueOwnerDraft(this.entries(), actorId)
  }

  private uniqueOwnerDraft(entries: Array<{ id: string, payload: E2Payload | null }>, actorId: string): E2Draft | null {
    const matches: E2Draft[] = []
    for (const entry of entries) {
      if (!entry.id || !entry.payload || !this.isValidPayload(entry.payload, entry.id)) fail(409, 'DRAFT_CORRUPT', 'Hay un borrador que no superó su validación')
      if (ownerKey(entry.payload.document) === ownerKey(this.owner(actorId))) matches.push(entry.payload.document)
    }
    if (matches.length > 1) fail(409, 'DUPLICATE_OWNER_DRAFT', 'Hay más de un borrador para este perfil')
    return matches[0] ?? null
  }

  private entries(): Array<{ id: string, payload: E2Payload | null }> {
    try { return this.store.list() } catch (error) { this.storageFailure(error) }
  }

  private isValidPayload(value: E2Payload, id: string): boolean {
    if (!value || typeof value !== 'object' || !['document,schemaVersion', 'document,intention,schemaVersion'].includes(Object.keys(value).sort().join(',')) || value.schemaVersion !== 1) return false
    if ('intention' in value && value.intention === undefined) return false
    try {
      validateE2Draft(value.document)
      if (value.document.id !== id) return false
      if (value.intention !== undefined) {
        validateE2Intention(value.intention)
        if (value.intention.draftId !== id || value.intention.actorId !== value.document.actorId
          || value.intention.sourceId !== value.document.sourceId || value.intention.schoolId !== value.document.schoolId
          || value.intention.planId !== value.document.planId || value.intention.academicPeriod !== value.document.academicPeriod
          || value.intention.history.some(record => record.draftVersion > value.document.version)) return false
      }
      return true
    } catch { return false }
  }

  private readPayload(id: string): E2Payload | null {
    let payload: E2Payload | null
    try { payload = this.store.read(id) } catch (error) { this.storageFailure(error) }
    if (payload && !this.isValidPayload(payload, id)) fail(409, 'DRAFT_CORRUPT', 'El borrador no superó su validación')
    return payload
  }

  private async revalidateIntention(actor: ActorProfile, revision: string, record: E2Intention['history'][number]): Promise<E2Validation> {
    try { return await this.validateSelection(actor, revision, record.publicationId, record.publicationVersion, record.selection, record.academicRevision !== revision) }
    catch (error) {
      if (error instanceof HttpException && error.getStatus() === 404) {
        return { actorId: actor.actorId as E2Identity['actorId'], publicationId: record.publicationId, publicationVersion: record.publicationVersion,
          academicRevision: revision, selection: structuredClone(record.selection), credits: 0, courseCount: record.selection.length,
          status: 'insufficient', issues: [{ kind: 'insufficient', code: 'PUBLICATION_UNAVAILABLE', message: 'La publicación guardada ya no está disponible.', courseIds: record.selection.map(choice => choice.courseId), sectionIds: record.selection.map(choice => choice.sectionId) }] }
      }
      throw error
    }
  }

  private intentionContext(actor: ActorProfile, revision: string, draft: E2Draft, intention: E2Intention, validation: E2Validation): E2IntentionContext {
    const result: E2IntentionContext = { revision: 'E2-INTENT-1', actorId: actor.actorId as E2Identity['actorId'], academicRevision: revision,
      draftId: draft.id, draftVersion: draft.version, intention: structuredClone(intention), validation }
    try { validateE2IntentionContext(result) } catch { fail(409, 'DRAFT_CORRUPT', 'La intención no corresponde al contexto guardado') }
    return result
  }

  private owner(actorId: string): E2Draft {
    return { actorId: actorId as E2Identity['actorId'], sourceId, schoolId, planId, academicPeriod } as E2Draft
  }

  private storageFailure(error: unknown): never {
    if (error instanceof SavedDraftStoreError && error.status === 409) fail(409, error.code === 'DRAFT_CORRUPT' ? 'DRAFT_CORRUPT' : 'STORAGE_CORRUPT', error.message)
    fail(503, 'STORAGE_UNAVAILABLE', 'No se pudo acceder al almacenamiento local de borradores')
  }
}

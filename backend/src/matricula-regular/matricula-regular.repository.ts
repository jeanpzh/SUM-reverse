import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { validateOperationalOffer, validateOperationalOfferCatalog } from '../../../shared/enrollment-offer.mjs'
import { validateActorId, validateEnrollmentReport, validateOutcome, validateSession } from '../../../shared/matricula-regular.mjs'
import type { OperationalOffer } from '../../../shared/enrollment-offer.mjs'
import { OperationalStorageError } from './operational-run-store.js'
import type { OperationalRunDocument, OperationalRunStore } from './operational-run-store.js'
import { MatriculaRegularError } from './matricula-regular-error.filter.js'
import { createAdvancingSyntheticClock } from './clock.js'
import type { ServerClock } from './clock.js'
import { createSyntheticFixture } from './fixtures.js'
import type { RunSnapshot, RunState } from './store.types.js'
import { createProfileCatalog } from './profiles.js'
import type { School, SyntheticFixture } from './profile.types.js'
import { projectContext } from './context-projection.js'
import { validateSyntheticAcademicRecord } from './academic-demo.validation.js'

const clone = <T>(value: T): T => structuredClone(value)

type OperationalRun = { offer: OperationalOffer; state: RunState; clock: ServerClock }

function fixtureFor(school: School): SyntheticFixture {
  return createSyntheticFixture(school)
}

function createRun(fixtures: SyntheticFixture[] = [fixtureFor('SISTEMAS'), fixtureFor('SOFTWARE')]): RunState {
  const selected = clone(fixtures)

  return {
    runId: randomUUID(),
    profiles: createProfileCatalog(),
    actors: selected.flatMap((fixture) => fixture.actors),
    offer: selected.flatMap((fixture) => fixture.offer),
    sessions: [],
    requests: new Map(),
    enrollments: new Map(),
    reports: new Map(),
  }
}

function snapshotOf(state: RunState): RunSnapshot {
  return clone({
    ...state,
    requests: [...state.requests.entries()],
    enrollments: [...state.enrollments.entries()],
    reports: [...state.reports.entries()],
  })
}

function restoreState(snapshot: RunSnapshot, offer: OperationalOffer): RunState {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.profiles)
    || !Array.isArray(snapshot.actors) || !Array.isArray(snapshot.offer) || !Array.isArray(snapshot.sessions)
    || !Array.isArray(snapshot.requests) || !Array.isArray(snapshot.enrollments) || !Array.isArray(snapshot.reports)) {
    throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'La oferta operativa no superó su validación')
  }
  if (Object.keys(snapshot).sort().join(',') !== 'actors,enrollments,offer,profiles,reports,requests,runId,sessions'
    || snapshot.runId !== offer.runId) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Contexto operativo inválido')
  for (const actor of snapshot.actors) {
    if (!actor || !['SYN-SIS-A', 'SYN-SIS-B'].includes(actor.actorId) || actor.scope?.period !== '2027-I'
      || actor.scope.facultyId !== 'FISI' || actor.scope.schoolId !== 'SISTEMAS' || actor.scope.planId !== offer.planId
      || actor.scope.modality !== 'regular-virtual' || !actor.profileRevision || !actor.scenarioData?.courseCodes
      || !actor.academic || actor.academic.catalog.some((course) => course.planId !== offer.planId)) {
      throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'La oferta operativa no superó su validación')
    }
    validateSyntheticAcademicRecord(actor, actor.academic)
    validateActorId(actor.actorId)
    projectContext(snapshot, actor.actorId, new Date(offer.clockBase))
  }
  if (snapshot.actors.length !== 2 || snapshot.profiles.length !== 1
    || snapshot.actors[0]?.actorId !== 'SYN-SIS-A' || snapshot.actors[1]?.actorId !== 'SYN-SIS-B'
    || snapshot.profiles[0]?.scope?.period !== '2027-I' || snapshot.profiles[0]?.scope?.facultyId !== 'FISI'
    || snapshot.profiles[0]?.scope?.schoolId !== 'SISTEMAS' || snapshot.profiles[0]?.scope?.planId !== offer.planId
    || snapshot.profiles[0]?.profileRevision !== snapshot.actors[0]?.profileRevision
    || snapshot.actors.some((actor) => actor.profileRevision !== snapshot.profiles[0]?.profileRevision)
    || snapshot.offer.length !== offer.courseCount || snapshot.offer.reduce((sum, course) => sum + course.sections.length, 0) !== offer.sectionCount) {
    throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'La oferta operativa no superó su validación')
  }
  const actorIds = new Set(snapshot.actors.map((actor) => actor.actorId))
  const courseIds = new Set<string>()
  const sectionIds = new Set<string>()
  const sections = new Map<string, { courseId: string; capacity: number; occupied: number }>()
  for (const course of snapshot.offer) {
    if (course.planId !== offer.planId || !course.courseId || courseIds.has(course.courseId) || !Array.isArray(course.sections)) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Oferta duplicada')
    courseIds.add(course.courseId)
    for (const section of course.sections) {
      if (!section.sectionId || sectionIds.has(section.sectionId) || !Number.isSafeInteger(section.capacity) || section.capacity < 1
        || !Number.isSafeInteger(section.occupied) || section.occupied < 0 || section.occupied > section.capacity
        || !Array.isArray(section.schedule) || section.schedule.length === 0) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Sección inválida')
      sectionIds.add(section.sectionId)
      sections.set(section.sectionId, { ...section, courseId: course.courseId })
    }
  }
  const requestMap = new Map<string, RunSnapshot['requests'][number][1]>()
  for (const actor of snapshot.actors) {
    const origins = actor.scenarioData?.sectionOrigins
    if (!Array.isArray(origins) || origins.length !== sectionIds.size || new Set(origins.map((origin) => origin.offeredSectionId)).size !== origins.length
      || origins.some((origin) => origin.publicationId !== offer.publicationId || origin.publicationVersion !== offer.publicationVersion
        || typeof origin.sectionId !== 'string' || !origin.sectionId
        || !sections.has(origin.offeredSectionId)
        || actor.scenarioData?.courseCodes[sections.get(origin.offeredSectionId)!.courseId] !== origin.courseId)) {
      throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Correspondencias de publicación inválidas')
    }
  }
  for (const entry of snapshot.requests) {
    if (!Array.isArray(entry) || entry.length !== 2) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Solicitud inválida')
    const [key, value] = entry
    if (!value?.payload || !value.outcome || !actorIds.has(value.payload.actorId)
      || value.outcome.actorId !== value.payload.actorId || value.outcome.requestId !== key.slice(value.payload.actorId.length + 1)
      || key !== `${value.payload.actorId}:${value.outcome.requestId}`
      || value.payload.profileRevision !== snapshot.actors.find((actor) => actor.actorId === value.payload.actorId)?.profileRevision) {
      throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Solicitud sin correlación')
    }
    if (Object.keys(value.payload).sort().join(',') !== 'actorId,profileRevision,selection'
      || value.outcome.profileRevision !== value.payload.profileRevision) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Solicitud inválida')
    validateOutcome(value.outcome)
    if (JSON.stringify(value.payload.selection) !== JSON.stringify(value.outcome.selection)) {
      throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Selección de solicitud y resultado no corresponde')
    }
    if (requestMap.has(key)) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Solicitud duplicada')
    requestMap.set(key, value)
  }
  const enrollments = new Map<string, RunSnapshot['enrollments'][number][1]>()
  const enrolledActors = new Set<string>()
  const occupiedBySection = new Map<string, number>()
  for (const entry of snapshot.enrollments) {
    if (!Array.isArray(entry) || entry.length !== 2) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Matrícula inválida')
    const [key, enrollment] = entry
    const request = requestMap.get(`${enrollment.actorId}:${enrollment.requestId}`)
    if (typeof key !== 'string' || enrolledActors.has(key) || key !== enrollment.actorId || enrollments.has(enrollment.enrollmentId) || !actorIds.has(enrollment.actorId)
      || !request || request.outcome.state !== 'accepted' || request.outcome.enrollmentId !== enrollment.enrollmentId
      || enrollment.profileRevision !== request.payload.profileRevision || enrollment.acceptedAt !== request.outcome.evaluatedAt || !Array.isArray(enrollment.selection)) {
      throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Matrícula sin solicitud aceptada')
    }
    if (JSON.stringify(enrollment.selection) !== JSON.stringify(request.payload.selection)
      || JSON.stringify(enrollment.selection) !== JSON.stringify(request.outcome.selection)) {
      throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Selección de matrícula y solicitud no corresponde')
    }
    for (const choice of enrollment.selection) {
      if (!courseIds.has(choice.courseId) || sections.get(choice.sectionId)?.courseId !== choice.courseId) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Selección de matrícula desconocida')
      occupiedBySection.set(choice.sectionId, (occupiedBySection.get(choice.sectionId) ?? 0) + 1)
    }
    enrolledActors.add(key)
    enrollments.set(enrollment.enrollmentId, enrollment)
  }
  for (const value of requestMap.values()) {
    if (value.outcome.state === 'accepted') {
      if (!value.outcome.enrollmentId || !enrollments.has(value.outcome.enrollmentId)) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Resultado aceptado sin matrícula')
    } else if (value.outcome.enrollmentId !== null) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Resultado no aceptado con matrícula')
  }
  for (const [sectionId, section] of sections) {
    if (section.occupied !== (occupiedBySection.get(sectionId) ?? 0)) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Ocupación sin integridad')
  }
  const reportMap = new Map<string, RunSnapshot['reports'][number][1]>()
  for (const entry of snapshot.reports) {
    if (!Array.isArray(entry) || entry.length !== 2) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Reporte inválido')
    const [key, report] = entry
    if (!report || key !== report.enrollmentId || !enrollments.has(report.enrollmentId)) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Reporte sin matrícula')
    validateEnrollmentReport(report)
    if (reportMap.has(key)) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Reporte duplicado')
    reportMap.set(key, report)
  }
  if (reportMap.size !== enrollments.size || [...enrollments.values()].some((enrollment) => {
    const report = reportMap.get(enrollment.enrollmentId)
    return !report || report.requestId !== enrollment.requestId || report.actorId !== enrollment.actorId
      || report.profileRevision !== enrollment.profileRevision || report.acceptedAt !== enrollment.acceptedAt
      || JSON.stringify(report.scope) !== JSON.stringify(snapshot.actors.find((actor) => actor.actorId === enrollment.actorId)?.scope)
      || report.rows.length !== enrollment.selection.length
      || enrollment.selection.some((choice) => !report.rows.some((row) => row.courseId === choice.courseId && row.sectionId === choice.sectionId))
  })) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Reporte y matrícula no corresponden')
  for (const session of snapshot.sessions) {
    validateSession(session)
    if (session.runId !== offer.runId || !actorIds.has(session.actorId)) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Sesión de otro contexto')
  }
  return {
    ...clone(snapshot),
    requests: new Map(snapshot.requests),
    enrollments: new Map(snapshot.enrollments),
    reports: new Map(snapshot.reports),
  }
}

@Injectable()
export class MatriculaRegularRepository {
  private state = createRun()
  private queue: Promise<void> = Promise.resolve()
  private store: OperationalRunStore | null = null
  private readonly operational = new Map<string, OperationalRun>()
  private corruptStorage = false
  private activeRunId: string | null = null
  configureOperationalStore(store: OperationalRunStore): void {
    if (this.store) throw new Error('Operational storage already configured')
    this.store = store
    this.restoreOperationalRuns()
  }

  get runId(): string {
    return this.state.runId
  }

  get activeOperationalRunId(): string | null {
    this.assertOperationalStorage()
    return this.activeRunId
  }

  listOperationalOffers(): OperationalOffer[] {
    this.assertOperationalStorage()
    return [...this.operational.values()].map(({ offer }) => clone(offer))
      .sort((left, right) => right.offerVersion - left.offerVersion)
  }

  readSnapshot(runId?: string): RunSnapshot {
    if (runId !== undefined) {
      const operational = this.operational.get(runId)
      if (operational) return snapshotOf(operational.state)
      if (runId !== this.state.runId) throw new MatriculaRegularError(409, this.state.runId, 'RUN_CHANGED')
    }
    return snapshotOf(this.state)
  }

  clockFor(runId: string | undefined, fallback: ServerClock): ServerClock {
    if (runId === undefined || runId === this.state.runId) return fallback
    const operational = this.operational.get(runId)
    if (!operational) throw new MatriculaRegularError(409, this.state.runId, 'RUN_CHANGED')
    return operational.clock
  }

  hasOperationalRun(runId: string): boolean {
    return this.operational.has(runId)
  }

  hasEnrollmentInOtherOffer(runId: string, actorId: string): boolean {
    const current = this.operational.get(runId)
    if (!current) return false
    return [...this.operational.values()].some((other) =>
      other.offer.runId !== runId
      && other.offer.academicPeriod === current.offer.academicPeriod
      && other.offer.schoolId === current.offer.schoolId
      && other.offer.planId === current.offer.planId
      && other.state.enrollments.has(actorId),
    )
  }

  publishCandidate(candidate: RunState): void {
    if (candidate.runId === this.state.runId) this.state = candidate
    else throw new MatriculaRegularError(409, this.state.runId, 'RUN_CHANGED')
  }

  enqueue<T>(synchronousOperation: (state: RunState) => T, runId?: string): Promise<T> {
    return this.enqueueGlobal(() => {
      const selected = runId === undefined || runId === this.state.runId
        ? { state: this.state, operational: null as OperationalRun | null }
        : { state: this.operational.get(runId)?.state, operational: this.operational.get(runId) ?? null }
      if (!selected.state) throw new MatriculaRegularError(409, this.state.runId, 'RUN_CHANGED')

      if (selected.operational === null) return synchronousOperation(selected.state)

      const candidate = clone(selected.state)
      const result = synchronousOperation(candidate)
      const document = { schemaVersion: 1 as const, offer: selected.operational.offer, snapshot: snapshotOf(candidate) }
      try {
        this.writeOperational(document)
      } catch {
        throw new MatriculaRegularError(503, selected.operational.offer.runId, 'STORAGE_UNAVAILABLE')
      }
      selected.operational.state = candidate
      return result
    })
  }

  enqueueGlobal<T>(synchronousOperation: () => T): Promise<T> {
    const result = this.queue.then(synchronousOperation)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }

  activateOperational(offer: OperationalOffer, candidate: RunState, expectedActiveRunId: string | null): void {
    this.assertOperationalStorage()
    const prior = [...this.operational.values()].find((entry) =>
      entry.offer.publicationId === offer.publicationId && entry.offer.publicationVersion === offer.publicationVersion,
    )
    if (prior) return
    if (this.operational.size >= 50) throw new OperationalStorageError(429, 'OFFER_QUOTA_EXCEEDED', 'Se alcanzó el límite de ofertas sintéticas')
    if (this.activeRunId !== expectedActiveRunId) throw new Error('ACTIVE_OFFER_CHANGED')
    if (offer.runId === this.activeRunId || candidate.runId !== offer.runId) throw new Error('RUN_ID_CONFLICT')
    const run: OperationalRun = {
      offer: clone(offer), state: clone(candidate), clock: createAdvancingSyntheticClock(offer.clockBase),
    }
    this.writeOperational({ schemaVersion: 1, offer: run.offer, snapshot: snapshotOf(run.state) })
    this.operational.set(offer.runId, run)
    this.activeRunId = offer.runId
  }

  resetForTests(fixtures?: SyntheticFixture[]): string {
    this.state = createRun(fixtures)
    return this.state.runId
  }

  private writeOperational(document: OperationalRunDocument): void {
    try {
      validateOperationalOffer(document.offer)
      const candidate = restoreState(document.snapshot, document.offer)
      if (candidate.runId !== document.offer.runId) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Contexto de otra oferta')
      if (!this.store?.configured) throw new OperationalStorageError(503, 'STORAGE_UNAVAILABLE', 'El almacenamiento operativo no está configurado')
      this.store.write(document.offer.runId, document)
    }
    catch (error) {
      if (error instanceof OperationalStorageError) throw error
      throw new OperationalStorageError(503, 'STORAGE_UNAVAILABLE', 'No se pudo persistir la oferta operativa')
    }
  }

  private restoreOperationalRuns(): void {
    if (!this.store?.configured) return
    try {
      const entries = this.store.list()
      if (entries.length > 50 || entries.some((entry) => entry.payload === null)) {
        this.corruptStorage = true
        return
      }
      const restored: OperationalRun[] = []
      for (const { id, payload } of entries) {
        if (!payload || payload.schemaVersion !== 1 || !payload.offer || payload.offer.runId !== id) throw new Error('corrupt')
        validateOperationalOffer(payload.offer)
        const state = restoreState(payload.snapshot, payload.offer)
        if (state.runId !== id || state.actors.some((actor) => actor.scope.schoolId !== 'SISTEMAS'
          || actor.scope.planId !== 'SYN-SIS-PLAN' || actor.scope.facultyId !== 'FISI')) throw new Error('corrupt')
        state.sessions = []
        restored.push({ offer: clone(payload.offer), state, clock: createAdvancingSyntheticClock(payload.offer.clockBase) })
      }
      restored.sort((left, right) => left.offer.offerVersion - right.offer.offerVersion)
      validateOperationalOfferCatalog({ activeRunId: restored.at(-1)?.offer.runId ?? null, items: restored.map((run) => run.offer) })
      const enrollmentKeys = new Set<string>()
      for (const run of restored) {
        for (const actorId of run.state.enrollments.keys()) {
          const key = JSON.stringify([run.offer.academicPeriod, run.offer.schoolId, run.offer.planId, actorId])
          if (enrollmentKeys.has(key)) throw new Error('Duplicate enrollment across operational offers')
          enrollmentKeys.add(key)
        }
      }
      for (const run of restored) {
        this.operational.set(run.offer.runId, run)
        if (run.offer.runId === restored.at(-1)?.offer.runId) this.activeRunId = run.offer.runId
      }
    } catch {
      this.corruptStorage = true
    }
  }

  private assertOperationalStorage(): void {
    if (!this.store?.configured) throw new OperationalStorageError(503, 'STORAGE_UNAVAILABLE', 'La oferta operativa local no está habilitada')
    if (!this.store.configured) throw new OperationalStorageError(503, 'STORAGE_UNAVAILABLE', 'El almacenamiento operativo local no está configurado')
    if (this.corruptStorage) throw new OperationalStorageError(409, 'DRAFT_CORRUPT', 'Una oferta operativa no superó su validación')
  }
}

import { HttpException, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { validateOfferActivationRequest, validateOfferActivationResponse, validateOperationalOfferCatalog } from '../../../shared/enrollment-offer.mjs'
import type { OfferActivationRequest, OperationalOffer, OperationalOfferCatalog } from '../../../shared/enrollment-offer.mjs'
import type { AcademicPublication } from '../../../shared/programacion-academica-api.d.mts'
import { SavedDraftService } from '../programacion-academica/saved-draft.service.js'
import { MatriculaRegularRepository } from './matricula-regular.repository.js'
import { createOperationalRun, E3_CLOCK_BASE } from './operational-offer.factory.js'
import { OperationalOfferStore } from './operational-offer.store.js'

const fail = (status: number, code: string, message: string): never => {
  throw new HttpException({ error: { code, message } }, status)
}

@Injectable()
export class OperationalOfferService {
  constructor(
    private readonly repository: MatriculaRegularRepository,
    private readonly publications: SavedDraftService,
    store: OperationalOfferStore,
  ) { this.repository.configureOperationalStore(store) }

  catalog(): OperationalOfferCatalog {
    try {
      const response = { activeRunId: this.repository.activeOperationalRunId, items: this.repository.listOperationalOffers() }
      validateOperationalOfferCatalog(response)
      return response
    } catch (error) {
      this.rethrow(error)
    }
  }

  async activate(value: unknown): Promise<{ offer: OperationalOffer; reused: boolean }> {
    let request: OfferActivationRequest
    try {
      validateOfferActivationRequest(value)
      request = value
    } catch { return fail(400, 'INVALID_REQUEST', 'Solicitud de activación inválida') }

    let publication: AcademicPublication
    try { publication = await this.publications.getPublication(request.publicationId) }
    catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 500
      const response = error instanceof HttpException ? error.getResponse() : null
      const body = response && typeof response === 'object' ? response as Record<string, unknown> : {}
      const nested = body.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : {}
      if (status === 404 || ['PUBLICATION_NOT_FOUND', 'DRAFT_NOT_FOUND'].includes(String(nested.code))) {
        return fail(404, 'PUBLICATION_NOT_FOUND', 'No se encontró la publicación indicada')
      }
      if (status === 503) return fail(503, 'STORAGE_UNAVAILABLE', 'No se pudo acceder al almacenamiento local')
      return fail(409, 'PUBLICATION_VERSION_MISMATCH', 'La publicación cambió o no superó su validación')
    }
    if (publication.publicationVersion !== request.publicationVersion) {
      return fail(409, 'PUBLICATION_VERSION_MISMATCH', 'La versión solicitada no corresponde a la publicación vigente')
    }
    if (publication.schedule.academicPeriod !== '2027-I') {
      return fail(422, 'ACTIVATION_NOT_SUPPORTED', 'La matrícula operativa local solo admite publicaciones 2027-I')
    }
    if (publication.schedule.schoolId !== 'SISTEMAS') {
      return fail(422, 'ACADEMIC_CONTEXT_UNAVAILABLE', 'La publicación no corresponde al ámbito sintético de Sistemas')
    }

    try {
      const result = await this.repository.enqueueGlobal(() => {
        const previous = this.repository.listOperationalOffers().find((offer) =>
          offer.publicationId === publication.id && offer.publicationVersion === publication.publicationVersion,
        )
        if (previous) return { offer: previous, reused: true }
        if (this.repository.activeOperationalRunId !== request.expectedActiveRunId) {
          throw new OfferDomainError(409, 'ACTIVE_OFFER_CHANGED', 'La oferta activa cambió; actualiza antes de activar')
        }
        const offer: OperationalOffer = {
          runId: randomUUID(),
          publicationId: publication.id,
          publicationVersion: publication.publicationVersion,
          offerVersion: this.repository.listOperationalOffers().reduce((max, item) => Math.max(max, item.offerVersion), 0) + 1,
          academicPeriod: '2027-I',
          schoolId: 'SISTEMAS',
          planId: 'SYN-SIS-PLAN',
          activatedAt: new Date().toISOString(),
          clockBase: E3_CLOCK_BASE,
          courseCount: publication.schedule.courses.length,
          sectionCount: publication.schedule.sections.length,
        }
        let candidate
        try { candidate = createOperationalRun(publication, offer) }
        catch (error) {
          if (error instanceof Error && error.message === 'COURSE_UNMAPPED') {
            throw new OfferDomainError(422, 'COURSE_UNMAPPED', 'La publicación contiene cursos sin correspondencia sintética inequívoca')
          }
          throw new OfferDomainError(422, 'ACADEMIC_CONTEXT_UNAVAILABLE', 'La publicación no pudo integrarse al contexto académico sintético')
        }
        this.repository.activateOperational(offer, candidate, request.expectedActiveRunId)
        return { offer, reused: false }
      })
      validateOfferActivationResponse(result)
      return result
    } catch (error) {
      this.rethrow(error)
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof OfferDomainError) fail(error.status, error.code, error.message)
    if (error instanceof HttpException) throw error
    if (error && typeof error === 'object' && 'status' in error && 'code' in error
      && Number.isInteger((error as { status: unknown }).status) && typeof (error as { code: unknown }).code === 'string') {
      const status = (error as { status: number }).status
      const code = (error as { code: string }).code
      if (status === 409 && code === 'DRAFT_CORRUPT') fail(409, code, 'Una oferta operativa no superó su validación')
      if (status === 429) fail(429, code, 'Se alcanzó el límite de ofertas sintéticas')
      if (status === 503) fail(503, 'STORAGE_UNAVAILABLE', 'No se pudo acceder al almacenamiento local')
    }
    throw new HttpException({ error: { code: 'STORAGE_UNAVAILABLE', message: 'No se pudo acceder al almacenamiento local' } }, 503)
  }
}

class OfferDomainError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}

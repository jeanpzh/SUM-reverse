import { Body, Controller, Get, Headers, HttpCode, HttpException, Post, Req, UseFilters } from '@nestjs/common'
import type { Request } from 'express'
import { DemoProposalService } from './demo-proposal.service.js'
import { DemoHttpErrorFilter } from './demo-http.filter.js'
import { DemoAccessService } from './demo-access.js'
import { SavedDraftService } from './saved-draft.service.js'

const fail = (status: number, code: string, message: string): never => { throw new HttpException({ error: { code, message } }, status) }
const loopback = (value: string | undefined): boolean => value === 'localhost' || value === '127.0.0.1' || value === '[::1]' || value === '::1'

function assertNoReadInput(request: Request): void {
  if (Object.keys(request.query).length > 0 || Number(request.headers['content-length'] ?? 0) > 0 || request.headers['transfer-encoding']) {
    fail(400, 'UNEXPECTED_INPUT', 'La consulta no acepta query ni body')
  }
}

export function assertWriteScope(request: Request, origin: string | undefined, fetchSite: string | undefined): void {
  if (Object.keys(request.query).length) fail(400, 'UNEXPECTED_INPUT', 'La escritura no acepta query')
  if (origin) {
    let originHost: string
    try { originHost = new URL(origin).hostname } catch { return fail(403, 'CROSS_SITE', 'Origen no permitido') }
    if (!loopback(originHost)) fail(403, 'CROSS_SITE', 'Origen no permitido')
  }
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) fail(403, 'CROSS_SITE', 'Petición cross-site no permitida')
  if (!request.is('application/json')) fail(400, 'JSON_REQUIRED', 'Se requiere un body JSON')
}

@Controller('local/programacion-academica/v1')
@UseFilters(DemoHttpErrorFilter)
export class DemoController {
  private readonly access = new DemoAccessService()

  constructor(private readonly proposals: DemoProposalService, private readonly savedDrafts: SavedDraftService) {}

  @Get('catalogo')
  async getCatalog(@Req() request: Request) {
    await this.access.assertAllowed(request)
    assertNoReadInput(request)
    return this.proposals.getCatalog()
  }

  @Post('propuestas')
  @HttpCode(200)
  async createProposal(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.proposals.createProposal(body)
  }

  @Post('demanda/estimar')
  @HttpCode(200)
  async estimateDemand(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.proposals.estimateDemand(body)
  }

  @Post('propuestas/:proposalId/ajustes')
  @HttpCode(200)
  async adjustProposal(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined,
    @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    const proposalId = request.params.proposalId
    if (typeof proposalId === 'string') return this.proposals.adjustProposal(proposalId, body)
    return fail(404, 'PROPOSAL_NOT_FOUND', 'No se encontró la propuesta o ya expiró')
  }

  @Get('propuestas/:proposalId')
  async getProposal(@Req() request: Request) {
    await this.access.assertAllowed(request)
    assertNoReadInput(request)
    const proposalId = request.params.proposalId
    if (typeof proposalId === 'string') return this.proposals.getProposal(proposalId)
    return fail(404, 'PROPOSAL_NOT_FOUND', 'No se encontró la propuesta o ya expiró')
  }

  @Get('borradores')
  async listDrafts(@Req() request: Request) {
    await this.access.assertAllowed(request)
    assertNoReadInput(request)
    return this.savedDrafts.list()
  }

  @Post('borradores/guardar')
  @HttpCode(200)
  async saveDraft(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    return this.savedDrafts.save(body)
  }

  @Post('borradores/:id/continuar')
  @HttpCode(200)
  async resumeDraft(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    const id = request.params.id
    if (typeof id !== 'string') return fail(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
    return this.savedDrafts.resume(id, body)
  }

  @Get('borradores/:id/vista-previa')
  async previewDraft(@Req() request: Request) {
    await this.access.assertAllowed(request)
    assertNoReadInput(request)
    const id = request.params.id
    if (typeof id !== 'string') return fail(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
    return this.savedDrafts.preview(id)
  }

  @Post('borradores/:id/aprobar')
  @HttpCode(200)
  async approveDraft(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    const id = request.params.id
    if (typeof id !== 'string') return fail(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
    return this.savedDrafts.approve(id, body)
  }

  @Post('borradores/:id/publicar')
  @HttpCode(200)
  async publishDraft(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    const id = request.params.id
    if (typeof id !== 'string') return fail(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
    return this.savedDrafts.publish(id, body)
  }

  @Post('borradores/:id/nuevo-borrador')
  @HttpCode(200)
  async forkDraft(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    const id = request.params.id
    if (typeof id !== 'string') return fail(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
    return this.savedDrafts.fork(id, body)
  }

  @Get('publicaciones')
  async listPublications(@Req() request: Request) {
    await this.access.assertAllowed(request)
    assertNoReadInput(request)
    return this.savedDrafts.publications()
  }

  @Get('publicaciones/vigente')
  async currentPublication(@Req() request: Request) {
    await this.access.assertAllowed(request)
    assertNoReadInput(request)
    return this.savedDrafts.currentPublication()
  }

  @Get('publicaciones/:id')
  async getPublication(@Req() request: Request) {
    await this.access.assertAllowed(request)
    assertNoReadInput(request)
    const id = request.params.id
    if (typeof id !== 'string') return fail(404, 'PUBLICATION_NOT_FOUND', 'No se encontró la publicación')
    return this.savedDrafts.getPublication(id)
  }

  @Post('borradores/:id/revision/enviar')
  @HttpCode(200)
  async submitDraftReview(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    const id = request.params.id
    if (typeof id !== 'string') return fail(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
    return this.savedDrafts.submitReview(id, body)
  }

  @Post('borradores/:id/revision/responder')
  @HttpCode(200)
  async decideDraftReview(@Req() request: Request, @Headers('origin') origin: string | undefined, @Headers('sec-fetch-site') fetchSite: string | undefined, @Body() body: unknown) {
    await this.access.assertAllowed(request)
    assertWriteScope(request, origin, fetchSite)
    const id = request.params.id
    if (typeof id !== 'string') return fail(404, 'DRAFT_NOT_FOUND', 'No se encontró la propuesta guardada')
    return this.savedDrafts.decideReview(id, body)
  }
}

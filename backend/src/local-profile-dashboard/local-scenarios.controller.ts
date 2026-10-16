import { Body, Controller, Get, HttpCode, Post, Req, UseFilters } from '@nestjs/common'
import type { Request } from 'express'
import {
  validateScenarioSelectionRequest,
} from '../../../shared/local-profile-dashboard.mjs'
import type { ScenarioSelectionRequest } from '../../../shared/local-profile-dashboard.mjs'
import { MatriculaRegularError, MatriculaRegularErrorFilter } from '../matricula-regular/matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from '../matricula-regular/matricula-regular.repository.js'
import { LocalScenariosService } from './local-scenarios.service.js'

const CATALOG_PATH = '/local/perfiles/v1/escenarios'
const SELECTION_PATH = '/local/perfiles/v1/escenarios/seleccion'

@Controller('local/perfiles/v1/escenarios')
@UseFilters(MatriculaRegularErrorFilter)
export class LocalScenariosController {
  constructor(
    private readonly repository: MatriculaRegularRepository,
    private readonly scenarios: LocalScenariosService,
  ) {}

  @Get()
  catalog(@Req() request: Request) {
    const url = new URL(request.originalUrl, 'http://127.0.0.1')
    const fields: string[] = []
    for (const key of url.searchParams.keys()) fields.push(`query.${key || 'empty'}`)
    if (this.hasBody(request)) fields.push('body')
    if (url.pathname !== CATALOG_PATH) fields.push('path')
    if (fields.length > 0) this.invalid(fields)
    return this.scenarios.catalog()
  }

  @Post('seleccion')
  @HttpCode(200)
  select(@Body() body: unknown, @Req() request: Request) {
    const url = new URL(request.originalUrl, 'http://127.0.0.1')
    const fields = [...url.searchParams.keys()].map((key) => `query.${key || 'empty'}`)
    if (url.pathname !== SELECTION_PATH) fields.push('path')
    try {
      validateScenarioSelectionRequest(body)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const field = /scenarioSelectionRequest\.([A-Za-z][A-Za-z0-9]*)/.exec(message)?.[1]
        ?? /\b(runId|scenarioId)\b/.exec(message)?.[1]
      fields.push(field ? `body.${field}` : 'body')
    }
    if (fields.length > 0) this.invalid(fields)
    const selection = body as ScenarioSelectionRequest
    return this.scenarios.select(selection.runId, selection.scenarioId)
  }

  private hasBody(request: Request): boolean {
    return Number(request.headers['content-length'] ?? 0) > 0
      || request.headers['transfer-encoding'] !== undefined
  }

  private invalid(fields: string[]): never {
    throw new MatriculaRegularError(400, this.repository.runId, 'INVALID_REQUEST', [...new Set(fields)].sort())
  }
}

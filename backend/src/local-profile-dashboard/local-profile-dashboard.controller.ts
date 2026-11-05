import { Controller, Get, Param, Req, UseFilters } from '@nestjs/common'
import type { Request } from 'express'
import {
  validateDashboardIdentity,
  validateDashboardKey,
} from '../../../shared/local-profile-dashboard.mjs'
import { validateSessionId } from '../../../shared/matricula-regular.mjs'
import type { DashboardKey } from '../../../shared/local-profile-dashboard.mjs'
import { MatriculaRegularError, MatriculaRegularErrorFilter } from '../matricula-regular/matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from '../matricula-regular/matricula-regular.repository.js'
import { LocalProfileDashboardService } from './local-profile-dashboard.service.js'

const PROFILE_PATH = '/local/perfiles/v1/perfiles'
const CONSULTATION_PATH = '/local/perfiles/v1/consultas/'
const identityFields = ['runId', 'actorId', 'sessionId'] as const

@Controller('local/perfiles/v1')
@UseFilters(MatriculaRegularErrorFilter)
export class LocalProfileDashboardController {
  constructor(
    private readonly repository: MatriculaRegularRepository,
    private readonly dashboard: LocalProfileDashboardService,
  ) {}

  @Get('perfiles')
  catalog(@Req() request: Request) {
    const url = new URL(request.originalUrl, 'http://127.0.0.1')
    const fields = new Set<string>()
    const queryKeys = [...url.searchParams.keys()]
    if (queryKeys.some((key) => key !== 'runId') || url.searchParams.getAll('runId').length > 1) {
      for (const key of queryKeys.filter((item) => item !== 'runId' || url.searchParams.getAll('runId').length > 1)) fields.add(`query.${key || 'empty'}`)
    }
    if (url.searchParams.has('runId')) {
      try { validateSessionId(url.searchParams.get('runId')) } catch { fields.add('query.runId') }
    }
    if (this.hasBody(request)) fields.add('body')
    if (url.pathname !== PROFILE_PATH) fields.add('path')
    if (fields.size > 0) this.invalid([...fields])
    return this.dashboard.catalog(url.searchParams.get('runId') ?? undefined)
  }

  @Get('consultas/:key')
  read(
    @Param('key') rawKey: string,
    @Req() request: Request,
  ) {
    const url = new URL(request.originalUrl, 'http://127.0.0.1')
    const counts = new Map<string, number>()
    for (const key of url.searchParams.keys()) counts.set(key, (counts.get(key) ?? 0) + 1)
    const fields = new Set<string>()
    for (const [key, count] of counts) {
      if (!identityFields.some((field) => field === key) || count !== 1) {
        fields.add(`query.${key || 'empty'}`)
      }
    }
    for (const key of identityFields) if (!url.searchParams.has(key)) fields.add(`query.${key}`)
    if (this.hasBody(request)) fields.add('body')
    if (url.pathname !== `${CONSULTATION_PATH}${encodeURIComponent(rawKey)}`) fields.add('path')

    let key: DashboardKey | undefined
    try {
      validateDashboardKey(rawKey)
      key = rawKey
    } catch {
      fields.add('key')
    }
    if (fields.size > 0) this.invalid([...fields])
    if (key === undefined) this.invalid(['key'])

    const identity = {
      runId: url.searchParams.get('runId'),
      actorId: url.searchParams.get('actorId'),
      sessionId: url.searchParams.get('sessionId'),
    }
    try {
      validateDashboardIdentity(identity)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const field = /\b(runId|actorId|sessionId)\b/.exec(message)?.[1]
      this.invalid([`query.${field ?? 'identity'}`])
    }

    return this.dashboard.read(key, identity)
  }

  private hasBody(request: Request): boolean {
    return Number(request.headers['content-length'] ?? 0) > 0
      || request.headers['transfer-encoding'] !== undefined
  }

  private invalid(fields: string[]): never {
    throw new MatriculaRegularError(400, this.repository.runId, 'INVALID_REQUEST', fields)
  }
}

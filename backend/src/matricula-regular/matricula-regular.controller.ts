import { Body, Controller, Get, HttpCode, Param, Post, Req, UseFilters } from '@nestjs/common'
import type { Request } from 'express'
import { validateActorId, validateEnrollmentId, validateRequestId, validateSessionId } from '../../../shared/matricula-regular.mjs'
import type { MatriculaRegularSubmission } from '../../../shared/matricula-regular.mjs'
import { MatriculaRegularError, MatriculaRegularErrorFilter } from './matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from './matricula-regular.repository.js'
import { ContextService } from './context.service.js'
import { SessionService } from './session.service.js'
import { parseRenewalRequest, parseSessionRequest, validationFields } from './dto/session.dto.js'
import { MatriculaRegularService } from './matricula-regular.service.js'
import { MatriculaRegularSubmissionPipe } from './matricula-regular.pipe.js'
import { ResultService } from './result.service.js'
import { ReportService } from './report.service.js'
import { lookupValidationFields, parseLookupQuery } from './dto/result.dto.js'
import { parseReportQuery, reportValidationFields } from './dto/report.dto.js'

const ROUTE_PREFIX = '/local/matricula-regular/v1/contextos/'

function invalidFields(request: Request): string[] {
  const url = new URL(request.originalUrl, 'http://127.0.0.1')
  const queryFields = [...new Set(
    [...url.searchParams.keys()].map((key) => `query.${key || 'empty'}`),
  )]
  const hasBody = Number(request.headers['content-length'] ?? 0) > 0
    || request.headers['transfer-encoding'] !== undefined

  return [...queryFields, ...(hasBody ? ['body'] : [])].sort()
}

function invalidReadFields(request: Request): string[] {
  const url = new URL(request.originalUrl, 'http://127.0.0.1')
  const counts = new Map<string, number>()
  for (const key of url.searchParams.keys()) counts.set(key, (counts.get(key) ?? 0) + 1)
  const queryFields = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => `query.${key || 'empty'}`)
  const hasBody = Number(request.headers['content-length'] ?? 0) > 0
    || request.headers['transfer-encoding'] !== undefined

  return [...new Set([...queryFields, ...(hasBody ? ['body'] : [])])].sort()
}

@Controller('local/matricula-regular/v1')
@UseFilters(MatriculaRegularErrorFilter)
export class MatriculaRegularController {
  constructor(
    private readonly contextService: ContextService,
    private readonly repository: MatriculaRegularRepository,
    private readonly sessionService: SessionService,
    private readonly matriculaRegularService: MatriculaRegularService,
    private readonly resultService: ResultService,
    private readonly reportService: ReportService,
  ) {}

  @Get('contextos/:actorId')
  readContext(@Param('actorId') actorId: string, @Req() request: Request) {
    const snapshot = this.repository.readSnapshot()
    const fields = invalidFields(request)
    if (fields.length > 0) {
      throw new MatriculaRegularError(400, snapshot.runId, 'INVALID_REQUEST', fields)
    }

    const expectedPath = `${ROUTE_PREFIX}${encodeURIComponent(actorId)}`
    const actualPath = new URL(request.originalUrl, 'http://127.0.0.1').pathname
    if (actualPath !== expectedPath) {
      throw new MatriculaRegularError(400, snapshot.runId, 'INVALID_REQUEST', ['path'])
    }

    try {
      validateActorId(actorId)
    } catch {
      throw new MatriculaRegularError(400, snapshot.runId, 'INVALID_REQUEST', ['actorId'])
    }

    return this.contextService.read(actorId)
  }

  @Post('sesiones')
  @HttpCode(200)
  createSession(@Body() body: unknown, @Req() request: Request) {
    const runId = this.repository.runId
    const queryFields = invalidFields(request).filter((field) => field.startsWith('query.'))
    if (queryFields.length > 0) {
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', queryFields)
    }

    try {
      return this.sessionService.create(parseSessionRequest(body))
    } catch (error) {
      if (error instanceof MatriculaRegularError) throw error
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', validationFields(error))
    }
  }

  @Post('sesiones/:sessionId/renovar')
  @HttpCode(200)
  renewSession(
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    const runId = this.repository.runId
    const queryFields = invalidFields(request).filter((field) => field.startsWith('query.'))
    if (queryFields.length > 0) {
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', queryFields)
    }

    try {
      validateSessionId(sessionId)
    } catch {
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', ['sessionId'])
    }

    try {
      return this.sessionService.renew(sessionId, parseRenewalRequest(sessionId, body))
    } catch (error) {
      if (error instanceof MatriculaRegularError) throw error
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', validationFields(error))
    }
  }

  @Post('solicitudes')
  @HttpCode(200)
  submit(
    @Body(MatriculaRegularSubmissionPipe) body: MatriculaRegularSubmission,
    @Req() request: Request,
  ) {
    const runId = this.repository.runId
    const fields = invalidFields(request).filter((field) => field.startsWith('query.'))
    if (fields.length > 0) {
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', fields)
    }
    return this.matriculaRegularService.submit(body)
  }

  @Get('solicitudes/:requestId')
  readResult(@Param('requestId') requestId: string, @Req() request: Request) {
    const runId = this.repository.runId
    const fields = invalidReadFields(request)
    if (fields.length > 0) {
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', fields)
    }

    try {
      validateRequestId(requestId)
    } catch {
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', ['requestId'])
    }

    try {
      const query = parseLookupQuery(request.query)
      return this.resultService.lookup(requestId, query.runId, query.actorId)
    } catch (error) {
      if (error instanceof MatriculaRegularError) throw error
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', lookupValidationFields(error))
    }
  }

  @Get('reportes/:enrollmentId')
  readReport(@Param('enrollmentId') enrollmentId: string, @Req() request: Request) {
    const runId = this.repository.runId
    const fields = invalidReadFields(request)
    if (fields.length > 0) {
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', fields)
    }

    try {
      validateEnrollmentId(enrollmentId)
    } catch {
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', ['enrollmentId'])
    }

    try {
      const query = parseReportQuery(request.query)
      return this.reportService.read(enrollmentId, query.runId, query.actorId)
    } catch (error) {
      if (error instanceof MatriculaRegularError) throw error
      throw new MatriculaRegularError(400, runId, 'INVALID_REQUEST', reportValidationFields(error))
    }
  }
}

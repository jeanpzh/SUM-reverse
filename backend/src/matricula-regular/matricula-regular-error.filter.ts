import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import { Catch } from '@nestjs/common'
import type { Response } from 'express'

export class MatriculaRegularError extends Error {
  constructor(
    readonly status: number,
    readonly runId: string,
    readonly code: string,
    readonly fields: string[] = [],
  ) {
    super(code)
    this.name = 'MatriculaRegularError'
  }
}

@Catch(MatriculaRegularError)
export class MatriculaRegularErrorFilter implements ExceptionFilter<MatriculaRegularError> {
  catch(exception: MatriculaRegularError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    response.status(exception.status).json({
      runId: exception.runId,
      error: { code: exception.code, fields: [...exception.fields].sort() },
    })
  }
}

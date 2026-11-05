import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import type { Response } from 'express'

@Catch()
export class DemoHttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      const error = typeof body === 'object' && body !== null && 'error' in body
        ? (body as { error: { code: string; message: string } }).error
        : { code: status === 400 ? 'INVALID_REQUEST' : 'HTTP_ERROR', message: typeof body === 'string' ? body : exception.message }
      response.status(status).json({ error })
      return
    }
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'No se pudo completar la solicitud local' } })
  }
}

import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

export type ReadonlyQueryRoute<Key extends string> = {
  key: Key
  action: string
}

export function validateReadonlyQuery<Key extends string>(
  request: Request,
  routes: Readonly<Record<string, ReadonlyQueryRoute<Key>>>,
): ReadonlyQueryRoute<Key> {
  const expected = routes[request.path]
  const action = request.query.accion
  if (!expected || typeof action !== 'string' || action !== expected.action) {
    throw new BadRequestException({
      message: 'Acción de consulta inválida.', codError: 'INVALID_ACTION', data: null,
    })
  }

  if (Object.keys(request.query).some((key) => key !== 'accion')) {
    throw new BadRequestException({
      message: 'Parámetro de consulta no admitido.', codError: 'INVALID_QUERY', data: null,
    })
  }

  const body = request.body
  const unparsedBody = body === undefined && (
    Number(request.headers['content-length'] ?? 0) > 0 || request.headers['transfer-encoding'] !== undefined
  )
  if (unparsedBody || (body !== undefined && (typeof body !== 'object' || body === null || Array.isArray(body) || Object.keys(body).length > 0))) {
    throw new BadRequestException({
      message: 'La consulta no admite cuerpo de datos.', codError: 'INVALID_BODY', data: null,
    })
  }

  return expected
}

export const ConsultaReadOnlyRequest = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<Request>(),
)

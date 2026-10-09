import { Injectable, type PipeTransform } from '@nestjs/common'
import type { Request } from 'express'
import { validateReadonlyQuery, type ReadonlyQueryRoute } from '../common/readonly-query.js'
import type { ConsultaAsistenciaDto } from './asistencias.types.js'

const expectedActions = {
  '/alumnoWebSum/v2/asistencia': {
    key: 'asistencia',
    action: 'obtenerResumenAsistencia',
  },
} satisfies Record<string, ReadonlyQueryRoute<'asistencia'>>

@Injectable()
export class ConsultaAsistenciaPipe implements PipeTransform<Request, ConsultaAsistenciaDto> {
  transform(request: Request): ConsultaAsistenciaDto {
    validateReadonlyQuery<'asistencia'>(request, expectedActions)
    return { accion: 'obtenerResumenAsistencia' }
  }
}

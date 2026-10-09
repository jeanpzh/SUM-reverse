import { Injectable, type PipeTransform } from '@nestjs/common'
import type { Request } from 'express'
import { validateReadonlyQuery, type ReadonlyQueryRoute } from '../common/readonly-query.js'
import type { ConsultaProgramacionDto } from './dto/consulta-programacion.dto.js'

const expectedActions = {
  '/alumnoWebSum/v2/matricula/programacion': {
    key: 'programacion',
    action: 'obtenerProgramacionAsignaturas',
  },
} satisfies Record<string, ReadonlyQueryRoute<'programacion'>>

@Injectable()
export class ConsultaProgramacionPipe implements PipeTransform<Request, ConsultaProgramacionDto> {
  transform(request: Request): ConsultaProgramacionDto {
    validateReadonlyQuery<'programacion'>(request, expectedActions)
    return { accion: 'obtenerProgramacionAsignaturas' }
  }
}

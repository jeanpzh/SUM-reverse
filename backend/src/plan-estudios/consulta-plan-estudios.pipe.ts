import { Injectable, type PipeTransform } from '@nestjs/common'
import type { Request } from 'express'
import { validateReadonlyQuery, type ReadonlyQueryRoute } from '../common/readonly-query.js'
import type { ConsultaPlanEstudiosDto } from './dto/consulta-plan-estudios.dto.js'

const expectedActions = {
  '/alumnoWebSum/v2/planEstudios': {
    key: 'planEstudios',
    action: 'obtenerPlanEstudios',
  },
} satisfies Record<string, ReadonlyQueryRoute<'planEstudios'>>

@Injectable()
export class ConsultaPlanEstudiosPipe implements PipeTransform<Request, ConsultaPlanEstudiosDto> {
  transform(request: Request): ConsultaPlanEstudiosDto {
    validateReadonlyQuery<'planEstudios'>(request, expectedActions)
    return { accion: 'obtenerPlanEstudios' }
  }
}

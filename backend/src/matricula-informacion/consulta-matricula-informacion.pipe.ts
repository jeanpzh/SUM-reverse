import { Injectable, type PipeTransform } from '@nestjs/common'
import type { Request } from 'express'
import { validateReadonlyQuery, type ReadonlyQueryRoute } from '../common/readonly-query.js'
import type { ConsultaMatriculaInformacionDto } from './dto/consulta-matricula-informacion.dto.js'

const expectedActions = {
  '/alumnoWebSum/v2/matricula/informacion': {
    key: 'obtenerInformacion',
    action: 'obtenerInformacion',
  },
} satisfies Record<string, ReadonlyQueryRoute<'obtenerInformacion'>>

@Injectable()
export class ConsultaMatriculaInformacionPipe
  implements PipeTransform<Request, ConsultaMatriculaInformacionDto>
{
  transform(request: Request): ConsultaMatriculaInformacionDto {
    validateReadonlyQuery(request, expectedActions)
    return { accion: 'obtenerInformacion' }
  }
}

import { Injectable, type PipeTransform } from '@nestjs/common'
import type { Request } from 'express'
import { validateReadonlyQuery, type ReadonlyQueryRoute } from '../common/readonly-query.js'
import type { ConsultaTutoriaDto } from './dto/consulta-tutoria.dto.js'

const expectedActions = {
  '/alumnoWebSum/v2/tutoria': {
    key: 'tutoria',
    action: 'obtenerListaAsignaturaTutoria',
  },
} satisfies Record<string, ReadonlyQueryRoute<'tutoria'>>

@Injectable()
export class ConsultaTutoriaPipe implements PipeTransform<Request, ConsultaTutoriaDto> {
  transform(request: Request): ConsultaTutoriaDto {
    validateReadonlyQuery<'tutoria'>(request, expectedActions)
    return { accion: 'obtenerListaAsignaturaTutoria' }
  }
}

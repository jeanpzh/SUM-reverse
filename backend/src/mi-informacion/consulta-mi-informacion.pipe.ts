import { Injectable, type PipeTransform } from '@nestjs/common'
import type { Request } from 'express'
import { validateReadonlyQuery, type ReadonlyQueryRoute } from '../common/readonly-query.js'
import type { MiInformacionKey } from './mi-informacion.types.js'

const expectedActions = {
  '/alumnoWebSum/v2/informacion/perfil': { key: 'perfil', action: 'obtenerInformacionAlumno' },
  '/alumnoWebSum/v2/informacion/historial': { key: 'historial', action: 'obtenerHistorialAcademico' },
  '/alumnoWebSum/v2/informacion/formularioDatos': { key: 'formularioDatos', action: 'obtenerFormularioDatosMatricula' },
  '/alumnoWebSum/v2/informacion/fichaSocioeconomica': { key: 'fichaSocioeconomica', action: 'obtenerFichaSocioeconomica' },
} satisfies Record<string, ReadonlyQueryRoute<MiInformacionKey>>

@Injectable()
export class ConsultaMiInformacionPipe implements PipeTransform<Request, MiInformacionKey> {
  transform(request: Request): MiInformacionKey {
    return validateReadonlyQuery<MiInformacionKey>(request, expectedActions).key
  }
}

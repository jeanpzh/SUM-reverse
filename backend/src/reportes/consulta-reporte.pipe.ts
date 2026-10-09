import { Injectable, type PipeTransform } from '@nestjs/common'
import type { Request } from 'express'
import { validateReadonlyQuery, type ReadonlyQueryRoute } from '../common/readonly-query.js'
import type { ConsultaReporteDto } from './dto/consulta-reporte.dto.js'
import type { ReporteKey } from './reportes.types.js'

const expectedActions = {
  '/alumnoWebSum/v2/reportes/prematricula': { key: 'prematricula', action: 'obtenerAlumnoPrematricula' },
  '/alumnoWebSum/v2/reportes/matricula': { key: 'matricula', action: 'obtenerAlumnoMatricula' },
  '/alumnoWebSum/v2/reportes/horarios': { key: 'horarios', action: 'obtenerHorariosAsignatura' },
  '/alumnoWebSum/v2/reportes/evaluaciones': { key: 'evaluaciones', action: 'recuperarEvaluacionesCalificaciones' },
  '/alumnoWebSum/v2/reportes/deudas': { key: 'deudas', action: 'obtenerAlumnoDeuda' },
} satisfies Record<string, ReadonlyQueryRoute<ReporteKey>>

@Injectable()
export class ConsultaReportePipe implements PipeTransform<Request, ConsultaReporteDto> {
  transform(request: Request): ConsultaReporteDto {
    const { action } = validateReadonlyQuery<ReporteKey>(request, expectedActions)
    return { accion: action }
  }
}

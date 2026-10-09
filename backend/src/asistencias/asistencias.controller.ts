import { Controller, HttpCode, Post } from '@nestjs/common'
import { ConsultaReadOnlyRequest } from '../common/readonly-query.js'
import { ConsultaAsistenciaPipe } from './consulta-asistencia.pipe.js'
import { AsistenciasService } from './asistencias.service.js'
import type { ConsultaAsistenciaDto } from './asistencias.types.js'

@Controller('alumnoWebSum/v2')
export class AsistenciasController {
  constructor(private readonly service: AsistenciasService) {}

  @Post('asistencia')
  @HttpCode(200)
  asistencia(@ConsultaReadOnlyRequest(ConsultaAsistenciaPipe) _query: ConsultaAsistenciaDto) {
    return this.service.consultar()
  }
}

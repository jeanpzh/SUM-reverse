import { Controller, HttpCode, Post } from '@nestjs/common'
import { ConsultaReadOnlyRequest } from '../common/readonly-query.js'
import { ConsultaProgramacionPipe } from './consulta-programacion.pipe.js'
import type { ConsultaProgramacionDto } from './dto/consulta-programacion.dto.js'
import { ProgramacionService } from './programacion.service.js'

@Controller('alumnoWebSum/v2')
export class ProgramacionController {
  constructor(private readonly service: ProgramacionService) {}

  @Post('matricula/programacion')
  @HttpCode(200)
  consultar(@ConsultaReadOnlyRequest(ConsultaProgramacionPipe) _query: ConsultaProgramacionDto) {
    return this.service.consultar()
  }
}

import { Controller, HttpCode, Post } from '@nestjs/common'
import { ConsultaReadOnlyRequest } from '../common/readonly-query.js'
import { ConsultaTutoriaPipe } from './consulta-tutoria.pipe.js'
import type { ConsultaTutoriaDto } from './dto/consulta-tutoria.dto.js'
import { TutoriaService } from './tutoria.service.js'

@Controller('alumnoWebSum/v2')
export class TutoriaController {
  constructor(private readonly service: TutoriaService) {}

  @Post('tutoria')
  @HttpCode(200)
  consultar(@ConsultaReadOnlyRequest(ConsultaTutoriaPipe) _query: ConsultaTutoriaDto) {
    return this.service.consultar()
  }
}

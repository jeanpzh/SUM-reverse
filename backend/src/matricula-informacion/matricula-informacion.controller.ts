import { Controller, HttpCode, Post } from '@nestjs/common'
import { ConsultaReadOnlyRequest } from '../common/readonly-query.js'
import type { ConsultaMatriculaInformacionDto } from './dto/consulta-matricula-informacion.dto.js'
import { ConsultaMatriculaInformacionPipe } from './consulta-matricula-informacion.pipe.js'
import { MatriculaInformacionService } from './matricula-informacion.service.js'

@Controller('alumnoWebSum/v2')
export class MatriculaInformacionController {
  constructor(private readonly service: MatriculaInformacionService) {}

  @Post('matricula/informacion')
  @HttpCode(200)
  consultar(
    @ConsultaReadOnlyRequest(ConsultaMatriculaInformacionPipe)
    _query: ConsultaMatriculaInformacionDto,
  ) {
    return this.service.consultar()
  }
}

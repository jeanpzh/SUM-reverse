import { Controller, HttpCode, Post, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ConsultaReadOnlyRequest } from '../common/readonly-query.js'
import { ConsultaPlanEstudiosPipe } from './consulta-plan-estudios.pipe.js'
import type { ConsultaPlanEstudiosDto } from './dto/consulta-plan-estudios.dto.js'
import { PlanEstudiosService } from './plan-estudios.service.js'

@Controller('alumnoWebSum/v2')
export class PlanEstudiosController {
  constructor(private readonly service: PlanEstudiosService) {}

  @Post('planEstudios')
  @HttpCode(200)
  consultar(
    @ConsultaReadOnlyRequest(ConsultaPlanEstudiosPipe) _query: ConsultaPlanEstudiosDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = this.service.consultar()
    response.setHeader('X-SUM-PLAN-Representation', result.representation)
    return result.envelope
  }
}

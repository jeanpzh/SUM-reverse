import { Controller, HttpCode, Post, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ConsultaReadOnlyRequest } from '../common/readonly-query.js'
import { ConsultaMiInformacionPipe } from './consulta-mi-informacion.pipe.js'
import { MiInformacionService } from './mi-informacion.service.js'
import type { MiInformacionKey } from './mi-informacion.types.js'

@Controller('alumnoWebSum/v2/informacion')
export class MiInformacionController {
  constructor(private readonly service: MiInformacionService) {}

  @Post('perfil') @HttpCode(200)
  perfil(
    @ConsultaReadOnlyRequest(ConsultaMiInformacionPipe) _key: MiInformacionKey,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.consultar('perfil', response)
  }

  @Post('historial') @HttpCode(200)
  historial(
    @ConsultaReadOnlyRequest(ConsultaMiInformacionPipe) _key: MiInformacionKey,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.consultar('historial', response)
  }

  @Post('formularioDatos') @HttpCode(200)
  formularioDatos(
    @ConsultaReadOnlyRequest(ConsultaMiInformacionPipe) _key: MiInformacionKey,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.consultar('formularioDatos', response)
  }

  @Post('fichaSocioeconomica') @HttpCode(200)
  fichaSocioeconomica(
    @ConsultaReadOnlyRequest(ConsultaMiInformacionPipe) _key: MiInformacionKey,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.consultar('fichaSocioeconomica', response)
  }

  private consultar(key: MiInformacionKey, response: Response) {
    const result = this.service.consultar(key)
    response.setHeader('X-SUM-MI-Representation', result.representation)
    return result.envelope
  }
}

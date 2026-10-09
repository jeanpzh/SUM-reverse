import { Controller, HttpCode, Post } from '@nestjs/common'
import { ConsultaReadOnlyRequest } from '../common/readonly-query.js'
import type { ConsultaReporteDto } from './dto/consulta-reporte.dto.js'
import { ConsultaReportePipe } from './consulta-reporte.pipe.js'
import { ReportesService } from './reportes.service.js'

@Controller('alumnoWebSum/v2')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Post('reportes/prematricula') @HttpCode(200)
  prematricula(@ConsultaReadOnlyRequest(ConsultaReportePipe) _query: ConsultaReporteDto) {
    return this.service.consultar('prematricula')
  }

  @Post('reportes/matricula') @HttpCode(200)
  matricula(@ConsultaReadOnlyRequest(ConsultaReportePipe) _query: ConsultaReporteDto) {
    return this.service.consultar('matricula')
  }

  @Post('reportes/horarios') @HttpCode(200)
  horarios(@ConsultaReadOnlyRequest(ConsultaReportePipe) _query: ConsultaReporteDto) {
    return this.service.consultar('horarios')
  }

  @Post('reportes/evaluaciones') @HttpCode(200)
  evaluaciones(@ConsultaReadOnlyRequest(ConsultaReportePipe) _query: ConsultaReporteDto) {
    return this.service.consultar('evaluaciones')
  }

  @Post('reportes/deudas') @HttpCode(200)
  deudas(@ConsultaReadOnlyRequest(ConsultaReportePipe) _query: ConsultaReporteDto) {
    return this.service.consultar('deudas')
  }
}

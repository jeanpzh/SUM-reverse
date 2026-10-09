import { Module } from '@nestjs/common'
import { ConsultaReportePipe } from './consulta-reporte.pipe.js'
import { ReportesController } from './reportes.controller.js'
import { ReportesRepository } from './reportes.repository.js'
import { ReportesService } from './reportes.service.js'

@Module({
  controllers: [ReportesController],
  providers: [ConsultaReportePipe, ReportesRepository, ReportesService],
  exports: [ReportesRepository],
})
export class ReportesModule {}

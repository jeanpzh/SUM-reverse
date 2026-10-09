import { Module } from '@nestjs/common'
import { ReportesModule } from '../reportes/reportes.module.js'
import { ConsultaPlanEstudiosPipe } from './consulta-plan-estudios.pipe.js'
import { PlanEstudiosController } from './plan-estudios.controller.js'
import { PlanEstudiosRepository } from './plan-estudios.repository.js'
import { PlanEstudiosService } from './plan-estudios.service.js'

@Module({
  imports: [ReportesModule],
  controllers: [PlanEstudiosController],
  providers: [ConsultaPlanEstudiosPipe, PlanEstudiosRepository, PlanEstudiosService],
})
export class PlanEstudiosModule {}

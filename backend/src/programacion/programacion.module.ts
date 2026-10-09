import { Module } from '@nestjs/common'
import { ReportesModule } from '../reportes/reportes.module.js'
import { ConsultaProgramacionPipe } from './consulta-programacion.pipe.js'
import { ProgramacionController } from './programacion.controller.js'
import { ProgramacionRepository } from './programacion.repository.js'
import { ProgramacionService } from './programacion.service.js'

@Module({
  imports: [ReportesModule],
  controllers: [ProgramacionController],
  providers: [ConsultaProgramacionPipe, ProgramacionRepository, ProgramacionService],
})
export class ProgramacionModule {}

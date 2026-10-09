import { Module } from '@nestjs/common'
import { ReportesModule } from '../reportes/reportes.module.js'
import { ConsultaMiInformacionPipe } from './consulta-mi-informacion.pipe.js'
import { MiInformacionController } from './mi-informacion.controller.js'
import { MiInformacionRepository } from './mi-informacion.repository.js'
import { MiInformacionService } from './mi-informacion.service.js'

@Module({
  imports: [ReportesModule],
  controllers: [MiInformacionController],
  providers: [ConsultaMiInformacionPipe, MiInformacionRepository, MiInformacionService],
})
export class MiInformacionModule {}

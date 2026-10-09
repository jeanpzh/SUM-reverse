import { Module } from '@nestjs/common'
import { ReportesModule } from '../reportes/reportes.module.js'
import { AsistenciasController } from './asistencias.controller.js'
import { AsistenciasRepository } from './asistencias.repository.js'
import { AsistenciasService } from './asistencias.service.js'
import { ConsultaAsistenciaPipe } from './consulta-asistencia.pipe.js'

@Module({
  imports: [ReportesModule],
  controllers: [AsistenciasController],
  providers: [ConsultaAsistenciaPipe, AsistenciasRepository, AsistenciasService],
})
export class AsistenciasModule {}

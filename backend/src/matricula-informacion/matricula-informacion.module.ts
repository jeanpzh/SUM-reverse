import { Module } from '@nestjs/common'
import { ReportesModule } from '../reportes/reportes.module.js'
import { ConsultaMatriculaInformacionPipe } from './consulta-matricula-informacion.pipe.js'
import { MatriculaInformacionController } from './matricula-informacion.controller.js'
import { MatriculaInformacionRepository } from './matricula-informacion.repository.js'
import { MatriculaInformacionService } from './matricula-informacion.service.js'

@Module({
  imports: [ReportesModule],
  controllers: [MatriculaInformacionController],
  providers: [
    ConsultaMatriculaInformacionPipe,
    MatriculaInformacionRepository,
    MatriculaInformacionService,
  ],
})
export class MatriculaInformacionModule {}

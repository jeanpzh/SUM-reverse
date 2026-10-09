import { Module } from '@nestjs/common'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'
import { ReportesModule } from './reportes/reportes.module.js'
import { MiInformacionModule } from './mi-informacion/mi-informacion.module.js'
import { AsistenciasModule } from './asistencias/asistencias.module.js'
import { MatriculaInformacionModule } from './matricula-informacion/matricula-informacion.module.js'
import { ProgramacionModule } from './programacion/programacion.module.js'
import { PlanEstudiosModule } from './plan-estudios/plan-estudios.module.js'
import { TutoriaModule } from './tutoria/tutoria.module.js'

@Module({
  imports: [
    ReportesModule,
    MiInformacionModule,
    AsistenciasModule,
    MatriculaInformacionModule,
    ProgramacionModule,
    PlanEstudiosModule,
    TutoriaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common'
import { MatriculaRegularModule } from '../matricula-regular/matricula-regular.module.js'
import { LocalProfileDashboardModule } from '../local-profile-dashboard/local-profile-dashboard.module.js'
import { AcademicSchedulingModule } from '../programacion-academica/demo-module.js'
import { PrematriculaController } from './prematricula.controller.js'
import { PrematriculaService } from './prematricula.service.js'

@Module({
  imports: [MatriculaRegularModule, LocalProfileDashboardModule, AcademicSchedulingModule],
  controllers: [PrematriculaController],
  providers: [PrematriculaService],
  exports: [PrematriculaService],
})
export class PrematriculaModule {}

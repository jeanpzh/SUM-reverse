import { Module } from '@nestjs/common'
import { MatriculaRegularModule } from '../matricula-regular/matricula-regular.module.js'
import { LocalProfileDashboardController } from './local-profile-dashboard.controller.js'
import { LocalProfileDashboardService } from './local-profile-dashboard.service.js'
import { LocalProfileSessionService } from './local-profile-session.service.js'
import { LocalScenariosController } from './local-scenarios.controller.js'
import { LocalScenariosService } from './local-scenarios.service.js'

@Module({
  imports: [MatriculaRegularModule],
  controllers: [LocalProfileDashboardController, LocalScenariosController],
  providers: [LocalProfileSessionService, LocalProfileDashboardService, LocalScenariosService],
  exports: [LocalProfileSessionService, LocalProfileDashboardService, LocalScenariosService],
})
export class LocalProfileDashboardModule {}

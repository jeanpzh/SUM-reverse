import { Module } from '@nestjs/common'
import { MatriculaRegularModule } from '../matricula-regular/matricula-regular.module.js'
import { LocalProfileDashboardController } from './local-profile-dashboard.controller.js'
import { LocalProfileDashboardService } from './local-profile-dashboard.service.js'
import { LocalProfileSessionService } from './local-profile-session.service.js'

@Module({
  imports: [MatriculaRegularModule],
  controllers: [LocalProfileDashboardController],
  providers: [LocalProfileSessionService, LocalProfileDashboardService],
  exports: [LocalProfileSessionService, LocalProfileDashboardService],
})
export class LocalProfileDashboardModule {}

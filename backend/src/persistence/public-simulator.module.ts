import { Module } from '@nestjs/common'
import { createSimulatorPool, SIMULATOR_POOL } from './postgres.js'
import { PostgresEnrollmentStore } from './postgres-enrollment.store.js'
import { ENROLLMENT_STORE } from './enrollment-store.js'
import { SimulatorAuthService } from '../auth/simulator-auth.service.js'
import { SimulatorAuthController } from '../auth/simulator-auth.controller.js'
import { SimulatorOperationsController, SimulatorPublicApiController } from '../auth/simulator-public-api.controller.js'
import { SimulatorPublicDashboardController } from '../auth/simulator-public-dashboard.controller.js'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { SimulatorMetricsInterceptor } from '../auth/simulator-metrics.interceptor.js'
import { IDENTITY_PROVIDER } from '../auth/identity-provider.js'

@Module({
  controllers: [SimulatorAuthController, SimulatorPublicApiController, SimulatorPublicDashboardController, SimulatorOperationsController],
  providers: [
    { provide: SIMULATOR_POOL, useFactory: createSimulatorPool },
    PostgresEnrollmentStore,
    SimulatorAuthService,
    SimulatorMetricsInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: SimulatorMetricsInterceptor },
    { provide: ENROLLMENT_STORE, useExisting: PostgresEnrollmentStore },
    { provide: IDENTITY_PROVIDER, useExisting: PostgresEnrollmentStore },
  ],
  exports: [SIMULATOR_POOL, ENROLLMENT_STORE],
})
export class PublicSimulatorPersistenceModule {}

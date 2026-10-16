import { Module } from '@nestjs/common'
import { createSwitchableClock, createSystemClock } from './clock.js'
import { ContextService, MATRICULA_REGULAR_CLOCK } from './context.service.js'
import { MatriculaRegularController } from './matricula-regular.controller.js'
import { MatriculaRegularRepository } from './matricula-regular.repository.js'
import { SessionService } from './session.service.js'
import { MatriculaRegularService } from './matricula-regular.service.js'
import { MatriculaRegularSubmissionPipe } from './matricula-regular.pipe.js'
import { ResultService } from './result.service.js'
import { ReportService } from './report.service.js'

export { MATRICULA_REGULAR_CLOCK } from './context.service.js'

@Module({
  controllers: [MatriculaRegularController],
  providers: [
    MatriculaRegularRepository,
    ContextService,
    SessionService,
    MatriculaRegularService,
    ResultService,
    ReportService,
    MatriculaRegularSubmissionPipe,
    { provide: MATRICULA_REGULAR_CLOCK, useFactory: () => createSwitchableClock(createSystemClock()) },
  ],
  exports: [MatriculaRegularRepository, ContextService, SessionService, MatriculaRegularService, ResultService, ReportService, MATRICULA_REGULAR_CLOCK],
})
export class MatriculaRegularModule {}

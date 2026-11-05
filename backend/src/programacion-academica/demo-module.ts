import { Module } from '@nestjs/common'
import { DemoController } from './demo.controller.js'
import { DemoHttpErrorFilter } from './demo-http.filter.js'
import { DemoProposalService } from './demo-proposal.service.js'
import { SavedDraftService } from './saved-draft.service.js'

@Module({
  controllers: [DemoController],
  providers: [DemoProposalService, SavedDraftService, DemoHttpErrorFilter],
  exports: [SavedDraftService],
})
export class AcademicSchedulingModule {}

import { Module } from '@nestjs/common'
import { ACADEMIC_PUBLICATION_READER, HttpAcademicPublicationReader } from '../common/academic-publication-reader.js'
import { DemoController } from './demo.controller.js'
import { DemoHttpErrorFilter } from './demo-http.filter.js'
import { DemoProposalService } from './demo-proposal.service.js'
import { SavedDraftService } from './saved-draft.service.js'

@Module({
  controllers: [DemoController],
  providers: [
    DemoProposalService,
    SavedDraftService,
    DemoHttpErrorFilter,
    {
      provide: ACADEMIC_PUBLICATION_READER,
      inject: [SavedDraftService],
      useFactory: (fallback: SavedDraftService) => new HttpAcademicPublicationReader(fallback),
    },
  ],
  exports: [SavedDraftService, ACADEMIC_PUBLICATION_READER],
})
export class AcademicSchedulingModule {}

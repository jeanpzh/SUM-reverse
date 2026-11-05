import { Module } from '@nestjs/common'
import { AcademicSchedulingModule } from '../programacion-academica/demo-module.js'
import { MatriculaRegularModule } from './matricula-regular.module.js'
import { OperationalOfferController } from './operational-offer.controller.js'
import { OperationalOfferService } from './operational-offer.service.js'
import { OperationalOfferStore } from './operational-offer.store.js'

@Module({
  imports: [AcademicSchedulingModule, MatriculaRegularModule],
  controllers: [OperationalOfferController],
  providers: [OperationalOfferService, OperationalOfferStore],
  exports: [OperationalOfferService],
})
export class OperationalOfferModule {}

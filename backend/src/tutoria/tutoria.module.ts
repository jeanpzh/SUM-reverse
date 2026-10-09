import { Module } from '@nestjs/common'
import { ConsultaTutoriaPipe } from './consulta-tutoria.pipe.js'
import { TutoriaController } from './tutoria.controller.js'
import { TutoriaRepository } from './tutoria.repository.js'
import { TutoriaService } from './tutoria.service.js'

@Module({
  controllers: [TutoriaController],
  providers: [ConsultaTutoriaPipe, TutoriaRepository, TutoriaService],
})
export class TutoriaModule {}

import { Injectable } from '@nestjs/common'
import { TutoriaRepository } from './tutoria.repository.js'
import type { TutoriaEnvelope } from './tutoria.types.js'

@Injectable()
export class TutoriaService {
  constructor(private readonly repository: TutoriaRepository) {}

  consultar(): TutoriaEnvelope {
    return { message: null, codError: null, data: this.repository.read() }
  }
}

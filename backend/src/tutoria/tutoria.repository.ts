import { Injectable } from '@nestjs/common'
import type { TutoriaData } from './tutoria.types.js'

@Injectable()
export class TutoriaRepository {
  private readonly data: TutoriaData = []

  read(): TutoriaData {
    return structuredClone(this.data)
  }
}

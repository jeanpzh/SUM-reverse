import { Injectable } from '@nestjs/common'
import { ProgramacionRepository } from './programacion.repository.js'
import type { ProgramacionEnvelope } from './programacion.types.js'

@Injectable()
export class ProgramacionService {
  constructor(private readonly repository: ProgramacionRepository) {}

  consultar(): ProgramacionEnvelope {
    const snapshot = this.repository.readSnapshot()
    if (snapshot !== null) return snapshot
    return { message: null, codError: null, data: this.repository.read() }
  }
}

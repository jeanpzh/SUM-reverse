import { Injectable } from '@nestjs/common'
import { MatriculaInformacionRepository } from './matricula-informacion.repository.js'
import type { MatriculaInformacionEnvelope } from './matricula-informacion.types.js'

@Injectable()
export class MatriculaInformacionService {
  constructor(private readonly repository: MatriculaInformacionRepository) {}

  consultar(): MatriculaInformacionEnvelope {
    const snapshot = this.repository.readSnapshot()
    if (snapshot !== null) return snapshot
    return { message: null, codError: null, data: this.repository.read() }
  }
}

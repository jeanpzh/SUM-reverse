import { Injectable } from '@nestjs/common'
import { AsistenciasRepository } from './asistencias.repository.js'
import type { AsistenciaEnvelope } from './asistencias.types.js'

@Injectable()
export class AsistenciasService {
  constructor(private readonly repository: AsistenciasRepository) {}

  consultar(): AsistenciaEnvelope {
    return { message: null, codError: null, data: this.repository.read() }
  }
}

import { Injectable } from '@nestjs/common'
import { ReportesRepository } from '../reportes/reportes.repository.js'
import { buildAsistenciaFixtures } from './asistencias.fixtures.js'
import type { AsistenciaRow } from './asistencias.types.js'

@Injectable()
export class AsistenciasRepository {
  private readonly fixtures: AsistenciaRow[]

  constructor(private readonly reportes: ReportesRepository) {
    const mode = process.env.ASISTENCIAS_FIXTURE
    if (mode !== undefined && mode !== 'populated' && mode !== 'empty') {
      throw new Error(`ASISTENCIAS_FIXTURE inválido: ${mode}. Use populated o empty.`)
    }

    this.fixtures = mode === 'empty'
      ? []
      : buildAsistenciaFixtures(this.reportes.readFormulario().alumno)
  }

  read(): AsistenciaRow[] {
    return structuredClone(this.fixtures)
  }
}

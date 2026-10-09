import { Injectable } from '@nestjs/common'
import { ReportesRepository } from '../reportes/reportes.repository.js'
import { buildProgramacionFixtures } from './programacion.fixtures.js'
import type { ProgramacionData, ProgramacionEnvelope } from './programacion.types.js'

@Injectable()
export class ProgramacionRepository {
  private readonly data: ProgramacionData

  constructor(private readonly reportes: ReportesRepository) {
    const mode = process.env.PROGRAMACION_FIXTURE
    if (mode !== undefined && mode !== 'populated' && mode !== 'empty') {
      throw new Error(`PROGRAMACION_FIXTURE inválido: ${mode}. Use populated o empty.`)
    }

    const alumno = reportes.readFormulario().alumno
    this.data = {
      alumno,
      programacion: mode === 'empty' ? [] : buildProgramacionFixtures(alumno),
    }
  }

  read(): ProgramacionData {
    return structuredClone(this.data)
  }

  readSnapshot(): ProgramacionEnvelope | null {
    return this.reportes.readMatriculaSnapshot('programacion') as ProgramacionEnvelope | null
  }
}

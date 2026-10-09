import { Injectable } from '@nestjs/common'
import { ReportesRepository } from '../reportes/reportes.repository.js'
import { createArticuloMatricula } from './matricula-informacion.fixtures.js'
import type {
  MatriculaInformacionData,
  MatriculaInformacionEnvelope,
} from './matricula-informacion.types.js'

type FixtureMode = 'populated' | 'empty'

@Injectable()
export class MatriculaInformacionRepository {
  private readonly fixtureMode: FixtureMode

  constructor(private readonly reportesRepository: ReportesRepository) {
    const mode = process.env.MATRICULA_INFORMACION_FIXTURE
    if (mode !== undefined && mode !== 'populated' && mode !== 'empty') {
      throw new Error(
        `MATRICULA_INFORMACION_FIXTURE inválido: ${mode}. Use populated o empty.`,
      )
    }

    this.fixtureMode = mode ?? 'populated'
  }

  read(): MatriculaInformacionData {
    const codSemestre = this.reportesRepository.readFormulario().alumno.periodo
    const articulo = this.fixtureMode === 'empty'
      ? null
      : createArticuloMatricula(codSemestre)

    return structuredClone({ codSemestre, articulo })
  }

  readSnapshot(): MatriculaInformacionEnvelope | null {
    return this.reportesRepository.readMatriculaSnapshot('matriculaInfo') as MatriculaInformacionEnvelope | null
  }
}

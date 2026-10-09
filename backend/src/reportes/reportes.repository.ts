import { Injectable } from '@nestjs/common'
import {
  loadMatriculaSnapshots,
  readMatriculaSnapshot as cloneMatriculaSnapshot,
  type MatriculaSnapshots,
} from '../common/matricula-snapshots.js'
import type { MatriculaWireKey } from '../../../shared/matricula-wire.mjs'
import { populatedFixtures } from './reportes.fixtures.js'
import type {
  ConsultaKey,
  FormularioData,
  MatriculaSnapshotEnvelope,
  ReportesDataMap,
} from './reportes.types.js'

type FixtureCatalog = typeof populatedFixtures

@Injectable()
export class ReportesRepository {
  private readonly fixtures: FixtureCatalog
  private readonly matriculaSnapshots: MatriculaSnapshots | null

  constructor() {
    this.matriculaSnapshots = loadMatriculaSnapshots(process.env.MATRICULA_SNAPSHOT_DIR)
    const mode = process.env.REPORTES_FIXTURE
    if (mode !== undefined && mode !== 'populated' && mode !== 'empty') {
      throw new Error(`REPORTES_FIXTURE inválido: ${mode}. Use populated o empty.`)
    }

    this.fixtures = structuredClone(populatedFixtures)
    if (mode === 'empty') {
      this.fixtures.prematricula = []
      this.fixtures.matricula.matricula = []
      this.fixtures.horarios = []
      this.fixtures.evaluaciones = []
      this.fixtures.deudas = []
    }
  }

  read<Key extends ConsultaKey>(key: Key): ReportesDataMap[Key]
  read(key: ConsultaKey): ReportesDataMap[ConsultaKey] {
    return structuredClone(this.fixtures[key])
  }

  readFormulario(): FormularioData {
    return structuredClone(this.fixtures.formulario)
  }

  readMatriculaSnapshot(key: MatriculaWireKey): MatriculaSnapshotEnvelope | null {
    return cloneMatriculaSnapshot(this.matriculaSnapshots, key) as MatriculaSnapshotEnvelope | null
  }
}

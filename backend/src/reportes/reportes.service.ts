import { Injectable } from '@nestjs/common'
import { ReportesRepository } from './reportes.repository.js'
import type {
  ApiEnvelope,
  ConsultaKey,
  MatriculaSnapshotEnvelope,
  ReportesDataMap,
} from './reportes.types.js'

@Injectable()
export class ReportesService {
  constructor(private readonly repository: ReportesRepository) {}

  consultar<Key extends ConsultaKey>(
    key: Key,
  ): ApiEnvelope<ReportesDataMap[Key]> | MatriculaSnapshotEnvelope {
    if (key === 'prematricula' || key === 'matricula' || key === 'horarios') {
      const snapshot = this.repository.readMatriculaSnapshot(key)
      if (snapshot !== null) return snapshot
    }
    return { message: null, codError: null, data: this.repository.read(key) }
  }
}

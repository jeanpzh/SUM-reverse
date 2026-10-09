import { Injectable } from '@nestjs/common'
import { loadPlanEstudiosSnapshot, readPlanEstudiosSnapshot } from '../common/plan-estudios-snapshots.js'
import { ReportesRepository } from '../reportes/reportes.repository.js'
import { buildPlanEstudiosFixtures } from './plan-estudios.fixtures.js'
import type { PlanEstudiosRow, PlanEstudiosSnapshotState } from './plan-estudios.types.js'

@Injectable()
export class PlanEstudiosRepository {
  private readonly data: PlanEstudiosRow[]
  private readonly snapshot: PlanEstudiosSnapshotState

  constructor(reportes: ReportesRepository) {
    this.snapshot = loadPlanEstudiosSnapshot(process.env.PLAN_ESTUDIOS_SNAPSHOT_DIR)
    if (this.snapshot.kind !== 'disabled') {
      this.data = []
      return
    }

    const mode = process.env.PLAN_ESTUDIOS_FIXTURE
    if (mode !== undefined && mode !== 'populated' && mode !== 'empty') {
      throw new Error('PLAN_ESTUDIOS_FIXTURE: se esperaba populated o empty')
    }

    this.data = mode === 'empty'
      ? []
      : buildPlanEstudiosFixtures(reportes.readFormulario().alumno)
  }

  read(): PlanEstudiosRow[] {
    return structuredClone(this.data)
  }

  readSnapshot(): PlanEstudiosSnapshotState {
    return readPlanEstudiosSnapshot(this.snapshot)
  }
}

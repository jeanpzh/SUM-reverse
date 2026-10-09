import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { PlanEstudiosRepository } from './plan-estudios.repository.js'
import type { PlanEstudiosConsultation } from './plan-estudios.types.js'

@Injectable()
export class PlanEstudiosService {
  constructor(private readonly repository: PlanEstudiosRepository) {}

  consultar(): PlanEstudiosConsultation {
    const snapshot = this.repository.readSnapshot()
    if (snapshot.kind === 'missing') {
      throw new HttpException({
        message: 'plan.plan-estudios.json: snapshot no disponible',
        codError: 'SNAPSHOT_MISSING',
        data: null,
      }, HttpStatus.SERVICE_UNAVAILABLE)
    }
    if (snapshot.kind === 'snapshot') {
      return { representation: 'candidate-v1', envelope: snapshot.envelope }
    }
    return {
      representation: 'local-v1',
      envelope: { message: null, codError: null, data: this.repository.read() },
    }
  }
}
